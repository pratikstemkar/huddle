#!/usr/bin/env bash
# Read-only: is this checkout's Huddle stack worth driving? Usage: .claude/skills/verify-huddle/scripts/doctor.sh
set -u
cd "$(git rev-parse --show-toplevel)"
ROOT="$(pwd)"
eval "$(.claude/skills/verify-huddle/scripts/slot.sh)" || exit 1
echo "info  checkout $ROOT -> launch config $CONFIG, port $PORT, test-data prefix $PREFIX"
ok=0

check() { if eval "$2" >/dev/null 2>&1; then echo "ok    $1"; else echo "FAIL  $1${3:+ -> $3}"; ok=1; fi; }

check "node_modules installed in this checkout" "test -x node_modules/.bin/expo" "run: bun install"
check ".env.local present with dev auth on" "grep -q '^EXPO_PUBLIC_DEV_AUTH=true' .env.local" "copy .env.local from the main checkout (worktrees don't get git-ignored files)"
check "Supabase API answers on :54321" "curl -sf -o /dev/null -m 3 http://127.0.0.1:54321/auth/v1/health -H \"apikey: \$(grep ^EXPO_PUBLIC_SUPABASE_ANON_KEY= .env.local | cut -d= -f2-)\"" "run: bun run db:start"
check "seeded dev user aarav@dev.test can sign in and read trips" "node --env-file=.env.local .claude/skills/verify-huddle/scripts/db.mjs trips aarav@dev.test" "seed missing; ask before running: bun run db:reset"
check "Expo web from THIS checkout serves on :$PORT" "curl -sf -o /dev/null -m 5 http://localhost:$PORT" "start it with preview_start {name: \"$CONFIG\"}"
exit $ok
