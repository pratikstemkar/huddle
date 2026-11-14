/**
 * A stand-in for `@/lib/supabase` so tests never reach a real database.
 *
 * - `from(table)` returns a chainable query that records every call and resolves to the next result
 *   queued for that table with `queueResult(table, ...)` (or `{ data: null, error: null }`).
 * - `rpc(name, args)` resolves to the next result queued for `rpc:<name>`.
 * - `storage.from(bucket).upload | remove | createSignedUrls` record calls in `storageCalls` and resolve to
 *   the next result queued for `storage:<method>`.
 * - `channel(name)` records `.on(...)` handlers and the `.subscribe(...)` callback so tests can fire them.
 */

type Result = { data?: unknown; error?: { message: string; code?: string } | null };

export type QueryCall = { table: string; ops: [method: string, args: unknown[]][] };

export type FakeChannel = {
  name: string;
  handlers: { filter: Record<string, unknown>; cb: (payload: { old: Record<string, unknown> }) => void }[];
  status?: (status: string) => void;
  on: jest.Mock;
  subscribe: jest.Mock;
};

const queues = new Map<string, Result[]>();
export const queries: QueryCall[] = [];
export const rpcCalls: { name: string; args: unknown }[] = [];
export const channels: FakeChannel[] = [];
export const storageCalls: { bucket: string; method: string; args: unknown[] }[] = [];

function next(key: string) {
  const r = queues.get(key)?.shift();
  return { data: null, error: null, ...r };
}

/** Queues results for a table (or `rpc:<name>`); each awaited query takes the next one. */
export function queueResult(key: string, ...results: Result[]) {
  queues.set(key, [...(queues.get(key) ?? []), ...results]);
}

/** The recorded calls for every query on `table`, in order. */
export function queriesFor(table: string) {
  return queries.filter((q) => q.table === table);
}

function query(table: string) {
  const call: QueryCall = { table, ops: [] };
  queries.push(call);
  const chain: object = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === 'then') {
          const result = next(table);
          return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
        }
        return (...args: unknown[]) => {
          call.ops.push([String(prop), args]);
          return chain;
        };
      },
    },
  );
  return chain;
}

function channel(name: string) {
  const ch: FakeChannel = {
    name,
    handlers: [],
    on: jest.fn((_type: string, filter: Record<string, unknown>, cb: FakeChannel['handlers'][number]['cb']) => {
      ch.handlers.push({ filter, cb });
      return ch;
    }),
    subscribe: jest.fn((cb: (status: string) => void) => {
      ch.status = cb;
      return ch;
    }),
  };
  channels.push(ch);
  return ch;
}

function bucket(name: string) {
  const call = (method: string) =>
    jest.fn((...args: unknown[]) => {
      storageCalls.push({ bucket: name, method, args });
      return Promise.resolve(next(`storage:${method}`));
    });
  return { upload: call('upload'), remove: call('remove'), createSignedUrls: call('createSignedUrls') };
}

/** The recorded storage calls for one method (`upload`, `remove`, `createSignedUrls`), in order. */
export function storageCallsFor(method: string) {
  return storageCalls.filter((c) => c.method === method);
}

const unsubscribe = jest.fn();

export const supabase = {
  from: jest.fn(query),
  rpc: jest.fn((name: string, args: unknown) => {
    rpcCalls.push({ name, args });
    return Promise.resolve(next(`rpc:${name}`));
  }),
  channel: jest.fn(channel),
  removeChannel: jest.fn(),
  storage: { from: jest.fn(bucket) },
  auth: {
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(),
    signInWithOAuth: jest.fn(),
    signInWithIdToken: jest.fn(),
    signInWithPassword: jest.fn(),
    signOut: jest.fn(),
    updateUser: jest.fn(),
    exchangeCodeForSession: jest.fn(),
    startAutoRefresh: jest.fn(),
    stopAutoRefresh: jest.fn(),
  },
};

export const unsubscribeAuth = unsubscribe;

/** Clears queued results and recorded calls, and restores the default auth behaviour. Runs before every test. */
export function resetSupabaseMock() {
  queues.clear();
  queries.length = 0;
  rpcCalls.length = 0;
  channels.length = 0;
  storageCalls.length = 0;
  supabase.storage.from.mockClear();
  unsubscribe.mockReset();
  supabase.from.mockClear();
  supabase.rpc.mockClear();
  supabase.channel.mockClear();
  supabase.removeChannel.mockReset();
  for (const fn of Object.values(supabase.auth)) fn.mockReset();
  supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  supabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } });
  supabase.auth.signInWithOAuth.mockResolvedValue({ error: null });
  supabase.auth.signInWithIdToken.mockResolvedValue({ error: null });
  supabase.auth.signInWithPassword.mockResolvedValue({ error: null });
  supabase.auth.signOut.mockResolvedValue({ error: null });
  supabase.auth.updateUser.mockResolvedValue({ error: null });
  supabase.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
}
