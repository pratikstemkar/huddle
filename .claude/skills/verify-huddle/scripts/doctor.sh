#!/usr/bin/env bash
# Read-only: is the local Huddle stack worth driving? Usage: .claude/skills/verify-huddle/scripts/doctor.sh [web-port]
set -u
cd "$(git rev-parse --show-toplevel)"
PORT="${1:-8091}"
ok=0

check() { if eval "$2" >/dev/null 2>&1; then echo "ok    $1"; else echo "FAIL  $1${3:+ -> $3}"; ok=1; fi; }

check ".env.local present with dev auth on" "grep -q '^EXPO_PUBLIC_DEV_AUTH=true' .env.local" "copy .env.example to .env.local and set EXPO_PUBLIC_DEV_AUTH=true"
check "Supabase API answers on :54321" "curl -sf -o /dev/null -m 3 http://127.0.0.1:54321/auth/v1/health -H \"apikey: \$(grep ^EXPO_PUBLIC_SUPABASE_ANON_KEY= .env.local | cut -d= -f2-)\"" "run: npm run db:start"
check "seeded dev user aarav@dev.test can sign in and read trips" "node --env-file=.env.local .claude/skills/verify-huddle/scripts/db.mjs trips aarav@dev.test" "seed missing; ask before running: npm run db:reset"
check "Expo web serves on :$PORT" "curl -sf -o /dev/null -m 5 http://localhost:$PORT" "start it with preview_start {name: \"web-verify\"}"

owner=$(ss -ltnp 2>/dev/null | grep -E ":$PORT\b" | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
if [ -n "$owner" ]; then echo "info  :$PORT owned by pid $owner: $(ps -o args= -p "$owner" | cut -c1-100)"; fi
exit $ok
