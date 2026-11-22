// Drains pending notifications to Expo's push service and checks delivery receipts.
// Called by the database (pg_net after each insert, pg_cron every five minutes) with Vault's
// push_function_secret in `x-push-secret`, which push_secret_ok() checks. JWT checks are off for this
// function in supabase/config.toml.
//
// Secrets: EXPO_ACCESS_TOKEN (when enhanced push security is on),
// EXPO_PUSH_URL / EXPO_RECEIPTS_URL (tests only, to point at a fake Expo).

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { checkReceipts, sendPending, type PostJson, type PushStore } from './push.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const must = <T,>({ data, error }: { data: T; error: { message: string } | null }) => {
  if (error) throw new Error(error.message);
  return data;
};

const store: PushStore = {
  async claim(max) {
    return must(await db.rpc('claim_pushes', { max_rows: max })) ?? [];
  },
  async setStatus(ids, status) {
    must(await db.from('notifications').update({ push_status: status }).in('id', ids));
  },
  async saveTickets(rows) {
    must(await db.from('push_tickets').upsert(rows));
  },
  async dropTokens(tokens) {
    must(await db.from('push_tokens').delete().in('token', tokens));
  },
  async dueTickets(sentBefore, max) {
    return (
      must(
        await db
          .from('push_tickets')
          .select('ticket_id, token, created_at')
          .lt('created_at', sentBefore.toISOString())
          .order('created_at')
          .limit(max),
      ) ?? []
    );
  },
  async deleteTickets(ids) {
    must(await db.from('push_tickets').delete().in('ticket_id', ids));
  },
};

const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
const post: PostJson = async (url, body) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'accept-encoding': 'gzip, deflate',
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }
  return { status: res.status, body: parsed };
};

Deno.serve(async (req) => {
  const { data: allowed, error } = await db.rpc('push_secret_ok', { candidate: req.headers.get('x-push-secret') ?? '' });
  if (error) {
    console.error('send-push: secret check failed', error.message);
    return new Response('Secret check failed', { status: 500 });
  }
  if (allowed !== true) return new Response('Unauthorized', { status: 401 });
  try {
    const sent = await sendPending(store, post, { pushUrl: Deno.env.get('EXPO_PUSH_URL') ?? undefined });
    const receipts = await checkReceipts(store, post, { receiptsUrl: Deno.env.get('EXPO_RECEIPTS_URL') ?? undefined });
    return Response.json({ sent, receipts });
  } catch (e) {
    console.error('send-push failed', e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
