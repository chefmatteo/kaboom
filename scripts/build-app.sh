#!/usr/bin/env bash
# Packages src/ into a runnable Kaboom.app.
#
# The bundle is built from the prebuilt Electron.app. Editing its contents
# invalidates the ad-hoc signature it ships with, and macOS on Apple Silicon
# refuses to launch a bundle whose signature does not verify ("...is damaged").
# So the last step re-signs the whole bundle; skipping it produces an app that
# looks fine locally but fails for anyone who downloads it.
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./package.json').version")
ELECTRON_APP="node_modules/electron/dist/Electron.app"
OUT="dist/Kaboom.app"

[ -d "$ELECTRON_APP" ] || { echo "Missing $ELECTRON_APP — run npm install"; exit 1; }

rm -rf "$OUT"
mkdir -p dist
cp -R "$ELECTRON_APP" "$OUT"

# Our app replaces Electron's default landing page.
rm -f "$OUT/Contents/Resources/default_app.asar"
rm -rf "$OUT/Contents/Resources/app"
mkdir -p "$OUT/Contents/Resources/app"
cp -R src package.json "$OUT/Contents/Resources/app/"

# Helper bundles keep their Electron names: the framework resolves child
# processes by that hardcoded product name, so renaming them breaks launching.
mv "$OUT/Contents/MacOS/Electron" "$OUT/Contents/MacOS/Kaboom"

PLIST="$OUT/Contents/Info.plist"
set_plist() { /usr/libexec/PlistBuddy -c "Set :$1 $2" "$PLIST" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :$1 string $2" "$PLIST"; }
set_plist CFBundleName Kaboom
set_plist CFBundleDisplayName Kaboom
set_plist CFBundleExecutable Kaboom
set_plist CFBundleIdentifier com.chefmatteo.kaboom
set_plist CFBundleShortVersionString "$VERSION"
set_plist CFBundleVersion "$VERSION"

xattr -cr "$OUT"
codesign --force --deep --sign - "$OUT"
codesign --verify --deep --strict "$OUT"

# Drag-to-Applications disk image.
STAGE=$(mktemp -d)
cp -R "$OUT" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
DMG="dist/Kaboom-$VERSION-macOS.dmg"
rm -f "$DMG"
hdiutil create -volname "Kaboom $VERSION" -srcfolder "$STAGE" -ov -format UDZO "$DMG" >/dev/null
rm -rf "$STAGE"

echo "Built $OUT and $DMG ($VERSION)"
