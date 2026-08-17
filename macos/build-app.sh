#!/bin/sh
# Builds DashNotes.app. Run ON A MAC with Xcode (or the Command Line Tools + a
# Swift toolchain) installed:
#
#   cd macos && ./build-app.sh
#
# Output: macos/build/DashNotes.app — drag it into /Applications.
#
# The binary is ad-hoc signed, which is required on Apple Silicon and enough to
# run on your own machine (right-click -> Open the first time). Distributing to
# other people needs a Developer ID certificate and notarization.
set -e
cd "$(dirname "$0")"

echo "==> Compiling (release)…"
swift build -c release

APP=build/DashNotes.app
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

cp ".build/release/DashNotes" "$APP/Contents/MacOS/DashNotes"
cp Info.plist "$APP/Contents/Info.plist"

echo "==> Building icon…"
iconutil -c icns AppIcon.iconset -o "$APP/Contents/Resources/AppIcon.icns"

echo "==> Signing (ad-hoc)…"
codesign --force --sign - "$APP"

echo ""
echo "Done: macos/$APP"
echo "First launch: right-click the app -> Open (it is ad-hoc signed)."
