#!/bin/bash
# Build HomeBoard here and publish it to the Pi's nginx root.
#
#   ./deploy/push-build.sh scott@192.168.5.110
#
# Requires that provision-pi.sh has already been run on the Pi.
set -euo pipefail

TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  echo "Usage: $0 user@pi-address" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "== Building =="
[ -d node_modules ] || npm ci
# CRA treats warnings as errors when CI is set; don't fail a deploy over a lint warning.
CI=false npm run build

echo "== Uploading to $TARGET =="
rsync -av --delete build/ "$TARGET:/tmp/homeboard-build/"
rsync -av deploy/calendar-broker/ deploy/nginx-homeboard.conf deploy/install-on-pi.sh deploy/homeboard-oauth-assist.py "$TARGET:/tmp/homeboard-broker/"
rsync -av deploy/oauth-keyboard/ "$TARGET:/tmp/homeboard-broker/oauth-keyboard/"

echo "== Publishing =="
# -t allocates a terminal so sudo on the Pi can prompt for a password.
ssh -t "$TARGET" 'sudo bash /tmp/homeboard-broker/install-on-pi.sh'

echo
echo "Done. Reload the kiosk with:"
echo "  ssh $TARGET 'sudo pkill -u homeboard chromium'"
