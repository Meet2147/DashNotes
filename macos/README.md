# DashNotes for macOS

A native SwiftUI shell around the deployed web app (`dashnotes.dashovia.com`).
All functionality — notes, AI, the handwriting studio, PDF/PNG export — is the
live web app itself, so every web deploy reaches the Mac app immediately with no
re-release. The shell adds what a browser tab can't:

- a real window, Dock presence, and the new DashNotes app icon
- login sessions that persist per app (default `WKWebsiteDataStore`)
- PDF / PNG exports saved natively into `~/Downloads` (with Safari-style
  "name (2).ext" de-duplication) and revealed in Finder when done
- external links opened in your default browser, keeping the app on DashNotes

## Build (on a Mac)

Requires macOS 13+ and Xcode (or Command Line Tools with a Swift toolchain).

```sh
cd macos
./build-app.sh
```

Output: `macos/build/DashNotes.app` → drag into `/Applications`.

First launch: **right-click → Open** (the app is ad-hoc signed, which is fine
for your own machine; distributing to others requires a Developer ID
certificate and notarization via `notarytool`).

## Pointing at a different deployment

Edit `appURL` at the top of `Sources/DashNotes/DashNotesApp.swift`.

## Icon

`AppIcon.iconset/` is generated from `../scripts/logo.svg` (the canonical
DashNotes mark — a fountain-pen nib on a neumorphic tile, shared with the web
favicon and PWA icons). `build-app.sh` compiles it to `.icns` with `iconutil`.
If you change the logo, re-render the iconset from the SVG rather than editing
PNGs by hand.
