#!/usr/bin/env node
// Verification helper: reads and cleans local Supabase state as a seeded dev user, through RLS like the app does.
// Usage (from the repo root):
//   node .claude/skills/verify-huddle/scripts/db.mjs trips <email> [--out <file>]
//   node .claude/skills/verify-huddle/scripts/db.mjs cleanup <email> <PREFIX from slot.sh>
// The cleanup prefix is per-checkout, so parallel worktrees sharing one local Supabase never delete each other's rows.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const { EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_ANON_KEY: key, EXPO_PUBLIC_DEV_PASSWORD } = process.env;
const password = EXPO_PUBLIC_DEV_PASSWORD ?? 'trip-dev-password';
const [cmd, email, arg] = process.argv.slice(2);

if (!url || !key) fail('EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY missing. Run with: node --env-file=.env.local ...');
if (!/^(127\.0\.0\.1|localhost)$/.test(new URL(url).hostname)) fail(`Refusing to touch non-local Supabase at ${url}`);
if (!email?.endsWith('@dev.test')) fail('Pass a seeded dev user email, e.g. aarav@dev.test');

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError) fail(`Sign-in as ${email} failed: ${authError.message}`);

if (cmd === 'trips') {
  const { data, error } = await supabase
    .from('trips')
    .select('id, name, color, status, invite_code, created_by, created_at, trip_members(user_id, role)')
    .order('created_at', { ascending: false });
  if (error) fail(error.message);
  const json = JSON.stringify({ as: email, at: new Date().toISOString(), trips: data }, null, 2);
  const outIdx = process.argv.indexOf('--out');
  if (outIdx > 0) {
    const file = process.argv[outIdx + 1];
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, json + '\n');
  }
  console.log(json);
} else if (cmd === 'cleanup') {
  if (!/^verify-[0-9a-f]{6}-$/.test(arg ?? '')) fail('Pass this checkout\'s PREFIX from slot.sh, e.g. "verify-1a2b3c-"');
  const { data, error } = await supabase.from('trips').delete().like('name', `${arg}%`).select('id, name');
  if (error) fail(error.message);
  console.log(`Deleted ${data.length} trip(s) named ${arg}*`, data.map((t) => t.name));
} else {
  fail(`Unknown command "${cmd}". Use: trips | cleanup`);
}

function fail(msg) {
  console.error(`db.mjs: ${msg}`);
  process.exit(1);
}
