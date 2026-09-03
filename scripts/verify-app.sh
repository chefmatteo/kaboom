#!/usr/bin/env bash
# Proves dist/Kaboom.app is installable for someone who downloads it.
#
# A locally built bundle almost always launches on the machine that built it,
# so that is not evidence of anything. What breaks for downloaders is the code
# signature: macOS on Apple Silicon reports an invalid signature as
# "...is damaged and can't be opened", which no amount of xattr clears. This
# re-creates the download path (zip, extract elsewhere, mark quarantined) and
# asserts the signature still verifies.
set -euo pipefail

cd "$(dirname "$0")/.."
APP="dist/Kaboom.app"
[ -d "$APP" ] || { echo "FAIL: $APP missing — run npm run build:app"; exit 1; }

# -P resolves /var and /tmp symlinks: ps reports physical paths, so an unresolved
# prefix here would never match the running process below.
TMP=$(cd "$(mktemp -d)" && pwd -P)
trap 'pkill -f "$TMP" 2>/dev/null || true; rm -rf "$TMP"' EXIT

echo "1/4 signature verifies as built"
codesign --verify --deep --strict "$APP"

echo "2/4 survives a round trip through a zip"
ditto -c -k --sequesterRsrc --keepParent "$APP" "$TMP/app.zip"
ditto -x -k "$TMP/app.zip" "$TMP/out"
codesign --verify --deep --strict "$TMP/out/Kaboom.app"

echo "3/4 signature still verifies once quarantined (no 'damaged' block)"
xattr -w com.apple.quarantine "0083;$(printf %x "$(date +%s)");Safari;" "$TMP/out/Kaboom.app"
codesign --verify --deep --strict "$TMP/out/Kaboom.app"

echo "4/4 launches and renders after quarantine is cleared"
xattr -cr "$TMP/out/Kaboom.app"
open -n "$TMP/out/Kaboom.app"
# Generous timeout: a previously quarantined bundle gets a Gatekeeper malware
# scan on first launch, which takes tens of seconds at this bundle size.
RENDERER="$TMP/out/Kaboom.app/Contents/Frameworks/Electron Helper (Renderer).app"
for _ in $(seq 1 90); do
  sleep 1
  # -ww stops ps truncating to terminal width; these paths run past 180 chars.
  # No grep -q here: it exits on the first match and closes the pipe, so ps dies
  # with SIGPIPE and pipefail reports the pipeline as failed despite the match.
  if ps -axww -o command | grep -F "$RENDERER" >/dev/null; then
    echo "PASS: renderer process started — bundle is installable"
    exit 0
  fi
done

echo "FAIL: renderer never started (window would be blank)"
echo "--- processes under $TMP ---"
ps -axww -o command | grep -F "$TMP" | grep -v grep || echo "(none)"
echo "--- any Kaboom processes ---"
ps -axww -o command | grep -F "Kaboom.app/Contents" | grep -v grep || echo "(none)"
exit 1
