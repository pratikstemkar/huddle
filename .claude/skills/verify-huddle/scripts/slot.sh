#!/usr/bin/env bash
# Picks this checkout's verification slot so parallel worktrees never share a port or test data.
# Usage: eval "$(.claude/skills/verify-huddle/scripts/slot.sh)"   -> sets SLOT, CONFIG, PORT, PREFIX
# PREFIX is derived from the checkout path, so it is stable across runs of the same worktree.
# PORT starts at the slot the path hashes to and skips any slot whose port another checkout holds.
set -eu
ROOT="$(git rev-parse --show-toplevel)"
SLOTS=6
BASE_PORT=8090
HASH="$(printf '%s' "$ROOT" | sha1sum | cut -c1-6)"

owner_root() {
  local pid
  pid="$(ss -ltnp 2>/dev/null | grep -E ":$1\b" | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)"
  [ -n "$pid" ] || return 1
  git -C "$(readlink "/proc/$pid/cwd")" rev-parse --show-toplevel 2>/dev/null || echo "unknown:$pid"
}

start=$(( 16#$HASH % SLOTS ))
for i in $(seq 0 $((SLOTS - 1))); do
  slot=$(( (start + i) % SLOTS + 1 ))
  port=$(( BASE_PORT + slot ))
  if ! holder="$(owner_root "$port")" || [ "$holder" = "$ROOT" ]; then
    echo "SLOT=$slot CONFIG=web-verify-$slot PORT=$port PREFIX=verify-$HASH-"
    exit 0
  fi
done
echo "slot.sh: all $SLOTS verification ports ($((BASE_PORT + 1))-$((BASE_PORT + SLOTS))) are held by other checkouts" >&2
exit 1
