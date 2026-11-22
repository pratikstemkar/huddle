#!/usr/bin/env bash
# Renders og.html to public/get/og.png at 1200x675 (16:9) with headless Chrome.
set -euo pipefail
cd "$(dirname "$0")"
out="$(cd ../../../public/get && pwd)/og.png"
google-chrome --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1200,675 --virtual-time-budget=5000 --allow-file-access-from-files \
  --screenshot="$out" "file://$PWD/og.html"
echo "wrote $out"
