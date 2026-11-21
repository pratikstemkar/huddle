// The send-push function's logic, kept free of Deno APIs so Jest can test it (see __tests__/supabase).
// index.ts wires it to Supabase and fetch.

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
/** Expo takes at most 100 messages per request and 1000 receipt ids. */
export const MESSAGES_PER_REQUEST = 100;
export const RECEIPTS_PER_REQUEST = 1000;
export const MAX_ATTEMPTS = 5;
/** Receipts are ready about 15 minutes after sending and gone after a day. */
export const RECEIPT_DELAY_MS = 15 * 60 * 1000;
export const RECEIPT_TTL_MS = 24 * 60 * 60 * 1000;
/** The Android channel the app creates on launch. */
export const ANDROID_CHANNEL = 'default';

export type ClaimedPush = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  url: string;
  attempts: number;
  tokens: string[];
  badge: number;
};

export type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data: { url: string; notificationId: string };
  sound: 'default';
  badge: number;
  channelId: string;
  priority: 'high';
};

export type ExpoTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message?: string; details?: { error?: string } };

export type ExpoReceipt = { status: 'ok' } | { status: 'error'; message?: string; details?: { error?: string } };

export type PushStatus = 'sent' | 'skipped' | 'failed' | 'pending';

/** Database access the sender needs; index.ts implements it with the service-role client. */
export type PushStore = {
  claim(max: number): Promise<ClaimedPush[]>;
  setStatus(ids: string[], status: PushStatus): Promise<void>;
  saveTickets(rows: { ticket_id: string; token: string; notification_id: string }[]): Promise<void>;
  dropTokens(tokens: string[]): Promise<void>;
  dueTickets(sentBefore: Date, max: number): Promise<{ ticket_id: string; token: string; created_at: string }[]>;
  deleteTickets(ids: string[]): Promise<void>;
};

/** POSTs JSON and returns the status and parsed body. Throws on a network failure. */
export type PostJson = (url: string, body: unknown) => Promise<{ status: number; body: unknown }>;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** One message per device. */
export function buildMessages(rows: ClaimedPush[]): { message: ExpoMessage; notificationId: string }[] {
  return rows.flatMap((row) =>
    row.tokens.map((token) => ({
      notificationId: row.id,
      message: {
        to: token,
        title: row.title,
        body: row.body,
        data: { url: row.url, notificationId: row.id },
        sound: 'default' as const,
        badge: row.badge,
        channelId: ANDROID_CHANNEL,
        priority: 'high' as const,
      },
    })),
  );
}

/** Errors worth another try later: the request never landed, or Expo asked us to slow down. */
const TRANSIENT = new Set(['MessageRateExceeded', 'request_failed']);

function ticketsFrom(body: unknown, count: number): ExpoTicket[] | null {
  const data = (body as { data?: unknown } | null)?.data;
  return Array.isArray(data) && data.length === count ? (data as ExpoTicket[]) : null;
}

export type SendSummary = { claimed: number; sent: number; skipped: number; failed: number; retrying: number; droppedTokens: number };

/** Claims pending notifications, sends them, and records the outcome of each. */
export async function sendPending(store: PushStore, post: PostJson, opts: { pushUrl?: string; batch?: number } = {}): Promise<SendSummary> {
  const rows = await store.claim(opts.batch ?? 500);
  const summary: SendSummary = { claimed: rows.length, sent: 0, skipped: 0, failed: 0, retrying: 0, droppedTokens: 0 };
  if (rows.length === 0) return summary;

  const noDevice = rows.filter((r) => r.tokens.length === 0).map((r) => r.id);
  if (noDevice.length) await store.setStatus(noDevice, 'skipped');
  summary.skipped = noDevice.length;

  // Per notification: did any device take it, and was any failure worth retrying?
  const ok = new Set<string>();
  const transient = new Set<string>();
  const tickets: { ticket_id: string; token: string; notification_id: string }[] = [];
  const deadTokens = new Set<string>();

  for (const batch of chunk(buildMessages(rows), MESSAGES_PER_REQUEST)) {
    let result: ExpoTicket[] | null = null;
    try {
      const res = await post(opts.pushUrl ?? EXPO_PUSH_URL, batch.map((b) => b.message));
      if (res.status >= 200 && res.status < 300) result = ticketsFrom(res.body, batch.length);
    } catch {
      result = null;
    }
    batch.forEach((b, i) => {
      const ticket: ExpoTicket = result?.[i] ?? { status: 'error', details: { error: 'request_failed' } };
      if (ticket.status === 'ok') {
        ok.add(b.notificationId);
        tickets.push({ ticket_id: ticket.id, token: b.message.to, notification_id: b.notificationId });
        return;
      }
      const code = ticket.details?.error ?? '';
      if (code === 'DeviceNotRegistered') deadTokens.add(b.message.to);
      if (TRANSIENT.has(code)) transient.add(b.notificationId);
    });
  }

  if (tickets.length) await store.saveTickets(tickets);
  if (deadTokens.size) await store.dropTokens([...deadTokens]);
  summary.droppedTokens = deadTokens.size;

  const sent: string[] = [];
  const retry: string[] = [];
  const failed: string[] = [];
  for (const row of rows) {
    if (row.tokens.length === 0) continue;
    if (ok.has(row.id)) sent.push(row.id);
    else if (transient.has(row.id) && row.attempts < MAX_ATTEMPTS) retry.push(row.id);
    else failed.push(row.id);
  }
  if (sent.length) await store.setStatus(sent, 'sent');
  if (retry.length) await store.setStatus(retry, 'pending');
  if (failed.length) await store.setStatus(failed, 'failed');
  Object.assign(summary, { sent: sent.length, retrying: retry.length, failed: failed.length });
  return summary;
}

export type ReceiptSummary = { checked: number; droppedTokens: number };

/**
 * Reads delivery receipts for tickets older than 15 minutes. A device Expo says is gone loses its token.
 * Tickets with an answer are deleted; ones without wait for the next run until they're a day old.
 */
export async function checkReceipts(
  store: PushStore,
  post: PostJson,
  opts: { receiptsUrl?: string; now?: Date } = {},
): Promise<ReceiptSummary> {
  const now = opts.now ?? new Date();
  const due = await store.dueTickets(new Date(now.getTime() - RECEIPT_DELAY_MS), RECEIPTS_PER_REQUEST);
  if (due.length === 0) return { checked: 0, droppedTokens: 0 };

  let receipts: Record<string, ExpoReceipt> = {};
  try {
    const res = await post(opts.receiptsUrl ?? EXPO_RECEIPTS_URL, { ids: due.map((t) => t.ticket_id) });
    const data = (res.body as { data?: unknown } | null)?.data;
    if (res.status >= 200 && res.status < 300 && data && typeof data === 'object') receipts = data as Record<string, ExpoReceipt>;
  } catch {
    return { checked: 0, droppedTokens: 0 };
  }

  const done: string[] = [];
  const dead = new Set<string>();
  for (const t of due) {
    const r = receipts[t.ticket_id];
    if (r) {
      done.push(t.ticket_id);
      if (r.status === 'error' && r.details?.error === 'DeviceNotRegistered') dead.add(t.token);
    } else if (now.getTime() - new Date(t.created_at).getTime() > RECEIPT_TTL_MS) {
      done.push(t.ticket_id);
    }
  }
  if (dead.size) await store.dropTokens([...dead]);
  if (done.length) await store.deleteTickets(done);
  return { checked: done.length, droppedTokens: dead.size };
}
