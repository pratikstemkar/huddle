import {
  buildMessages,
  checkReceipts,
  chunk,
  sendPending,
  type ClaimedPush,
  type PostJson,
  type PushStore,
} from '../../supabase/functions/send-push/push';

const row = (over: Partial<ClaimedPush> = {}): ClaimedPush => ({
  id: 'n1',
  user_id: 'u1',
  kind: 'trip_locked',
  title: 'Goa is happening',
  body: 'Palolem · 12–15 Mar',
  url: '/trip/t1',
  attempts: 1,
  tokens: ['ExponentPushToken[a]'],
  badge: 2,
  ...over,
});

function fakeStore(claimed: ClaimedPush[], due: { ticket_id: string; token: string; created_at: string }[] = []) {
  const statuses = new Map<string, string>();
  const store = {
    claim: jest.fn(async () => claimed),
    setStatus: jest.fn(async (ids: string[], status: string) => ids.forEach((id) => statuses.set(id, status))),
    saveTickets: jest.fn(async () => {}),
    dropTokens: jest.fn(async () => {}),
    dueTickets: jest.fn(async () => due),
    deleteTickets: jest.fn(async () => {}),
  } satisfies PushStore;
  return { store, statuses };
}

/** Answers each push request with one ticket per message from `answer`. */
const expo = (answer: (to: string) => unknown): jest.MockedFunction<PostJson> =>
  jest.fn(async (_url, body) => ({ status: 200, body: { data: (body as { to: string }[]).map((m) => answer(m.to)) } }));

describe('buildMessages', () => {
  it('sends one message per device, with where to go and the badge', () => {
    const out = buildMessages([row({ tokens: ['ExponentPushToken[a]', 'ExponentPushToken[b]'] })]);
    expect(out).toHaveLength(2);
    expect(out[0].message).toEqual({
      to: 'ExponentPushToken[a]',
      title: 'Goa is happening',
      body: 'Palolem · 12–15 Mar',
      data: { url: '/trip/t1', notificationId: 'n1' },
      sound: 'default',
      badge: 2,
      channelId: 'default',
      priority: 'high',
    });
  });
});

describe('chunk', () => {
  it('splits into batches', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});

describe('sendPending', () => {
  it('does nothing when nothing is pending', async () => {
    const { store } = fakeStore([]);
    const post = expo(() => ({}));
    await expect(sendPending(store, post)).resolves.toMatchObject({ claimed: 0 });
    expect(post).not.toHaveBeenCalled();
  });

  it('marks it sent and keeps the ticket for the receipt check', async () => {
    const { store, statuses } = fakeStore([row()]);
    const post = expo(() => ({ status: 'ok', id: 'tk1' }));
    const summary = await sendPending(store, post, { pushUrl: 'http://fake/push' });
    expect(post.mock.calls[0][0]).toBe('http://fake/push');
    expect(store.saveTickets).toHaveBeenCalledWith([{ ticket_id: 'tk1', token: 'ExponentPushToken[a]', notification_id: 'n1' }]);
    expect(statuses.get('n1')).toBe('sent');
    expect(summary).toMatchObject({ claimed: 1, sent: 1, failed: 0 });
  });

  it('skips people with no device', async () => {
    const { store, statuses } = fakeStore([row({ tokens: [] })]);
    const post = expo(() => ({}));
    await sendPending(store, post);
    expect(statuses.get('n1')).toBe('skipped');
    expect(post).not.toHaveBeenCalled();
  });

  it('forgets a device Expo says is gone, and counts it sent if another device took it', async () => {
    const { store, statuses } = fakeStore([row({ tokens: ['ExponentPushToken[old]', 'ExponentPushToken[new]'] })]);
    const post = expo((to) =>
      to.includes('old') ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok', id: 'tk2' },
    );
    await sendPending(store, post);
    expect(store.dropTokens).toHaveBeenCalledWith(['ExponentPushToken[old]']);
    expect(statuses.get('n1')).toBe('sent');
  });

  it('tries again later when Expo is unreachable, and gives up after five tries', async () => {
    const { store, statuses } = fakeStore([row({ id: 'early', attempts: 2 }), row({ id: 'late', attempts: 5 })]);
    const post: PostJson = jest.fn(async () => {
      throw new Error('offline');
    });
    const summary = await sendPending(store, post);
    expect(statuses.get('early')).toBe('pending');
    expect(statuses.get('late')).toBe('failed');
    expect(summary).toMatchObject({ retrying: 1, failed: 1 });
  });

  it('treats a 5xx as unreachable', async () => {
    const { store, statuses } = fakeStore([row()]);
    const post: PostJson = jest.fn(async () => ({ status: 503, body: null }));
    await sendPending(store, post);
    expect(statuses.get('n1')).toBe('pending');
  });

  it('fails for good on a permanent error', async () => {
    const { store, statuses } = fakeStore([row()]);
    const post = expo(() => ({ status: 'error', details: { error: 'InvalidCredentials' } }));
    await sendPending(store, post);
    expect(statuses.get('n1')).toBe('failed');
  });

  it('sends at most 100 messages per request', async () => {
    const tokens = Array.from({ length: 150 }, (_, i) => `ExponentPushToken[${i}]`);
    const { store } = fakeStore([row({ tokens })]);
    const post = expo(() => ({ status: 'ok', id: 'tk' }));
    await sendPending(store, post);
    expect(post).toHaveBeenCalledTimes(2);
    expect((post.mock.calls[0][1] as unknown[]).length).toBe(100);
    expect((post.mock.calls[1][1] as unknown[]).length).toBe(50);
  });
});

describe('checkReceipts', () => {
  const now = new Date('2026-11-21T12:00:00Z');

  it('waits 15 minutes before asking', async () => {
    const { store } = fakeStore([]);
    await checkReceipts(store, expo(() => ({})), { now });
    expect(store.dueTickets).toHaveBeenCalledWith(new Date('2026-11-21T11:45:00Z'), 1000);
  });

  it('drops dead devices and deletes answered tickets', async () => {
    const { store } = fakeStore([], [
      { ticket_id: 'ok1', token: 'ExponentPushToken[a]', created_at: '2026-11-21T11:30:00Z' },
      { ticket_id: 'dead', token: 'ExponentPushToken[b]', created_at: '2026-11-21T11:30:00Z' },
      { ticket_id: 'waiting', token: 'ExponentPushToken[c]', created_at: '2026-11-21T11:30:00Z' },
      { ticket_id: 'ancient', token: 'ExponentPushToken[d]', created_at: '2026-11-19T11:30:00Z' },
    ]);
    const post: PostJson = jest.fn(async () => ({
      status: 200,
      body: { data: { ok1: { status: 'ok' }, dead: { status: 'error', details: { error: 'DeviceNotRegistered' } } } },
    }));
    const summary = await checkReceipts(store, post, { now, receiptsUrl: 'http://fake/receipts' });
    expect(post).toHaveBeenCalledWith('http://fake/receipts', { ids: ['ok1', 'dead', 'waiting', 'ancient'] });
    expect(store.dropTokens).toHaveBeenCalledWith(['ExponentPushToken[b]']);
    expect(store.deleteTickets).toHaveBeenCalledWith(['ok1', 'dead', 'ancient']);
    expect(summary).toEqual({ checked: 3, droppedTokens: 1 });
  });

  it('leaves tickets alone when Expo is unreachable', async () => {
    const { store } = fakeStore([], [{ ticket_id: 't', token: 'x', created_at: '2026-11-21T11:00:00Z' }]);
    const post: PostJson = jest.fn(async () => {
      throw new Error('offline');
    });
    await checkReceipts(store, post, { now });
    expect(store.deleteTickets).not.toHaveBeenCalled();
  });
});
