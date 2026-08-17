# DashNotes for iPad (and iPhone)

A native shell around the deployed web app (`dashnotes.dashovia.com`), the same
pattern as `../macos`: every web deploy reaches the app immediately with no
re-release. What the shell adds on iPadOS:

- a home-screen app with persistent login sessions
- PDF / PNG exports through the **share sheet** (save to Files, AirDrop, print)
- the **camera** for photographing handwriting capture sheets
- external links opened in Safari, keeping the app on DashNotes

**Apple Pencil works in the handwriting draw pad with pressure** — the pad reads
pointer-event pressure, which is exactly what the Pencil delivers. An iPad with
a Pencil is the best capture device this product has.

## Run it — two ways

### A. On the iPad directly, no Mac developer account

The project is an App Playground (`DashNotes.swiftpm`), which the free
**Swift Playgrounds** app can run and keep on the home screen:

1. Copy the `DashNotes.swiftpm` folder to the iPad (AirDrop it, or put it in
   iCloud Drive).
2. Open it in **Swift Playgrounds** (App Store, free; version 4.1+).
3. Press Run. Playgrounds can also place it on the home screen.

### B. Through Xcode (Mac, for a proper install or the Simulator)

1. Open `ios/DashNotes.swiftpm` in Xcode (double-click, or File → Open).
2. Pick your iPad (or an iPad simulator) as the destination and Run.
3. To install on your own device: Xcode → Signing, select your personal team
   (a free Apple ID works; apps signed this way expire after 7 days unless you
   have a paid developer account).

## Configuration

- Deployment target: edit `appURL` at the top of `DashNotesApp.swift`.
- Bundle id: `com.dashovia.dashnotes.mobile` in `Package.swift` — change it if
  it collides with an id already registered to another team.
- Icon: a placeholder (pencil on purple) so the package stays
  Playgrounds-compatible. For a branded icon, open the project in Xcode and
  replace it with an asset generated from `../scripts/logo.svg`.
