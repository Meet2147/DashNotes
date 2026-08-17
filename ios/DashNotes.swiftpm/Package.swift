// swift-tools-version: 5.8

// DashNotes for iPad (and iPhone) — an App Playground package.
//
// This format was chosen deliberately: it opens and runs in Xcode like any app
// project, AND it runs directly on an iPad in the Swift Playgrounds app with no
// Mac and no paid developer account — copy the DashNotes.swiftpm folder to the
// iPad (AirDrop / iCloud Drive) and open it in Playgrounds.
//
// Like the macOS app, this is a native shell around the deployed web app, so
// every web release reaches it with no re-build. What the shell adds on iPadOS:
// a home-screen app, persistent sessions, exports via the share sheet, and the
// camera for photographing handwriting sheets. Apple Pencil pressure flows into
// the handwriting draw pad natively (it arrives as pointer-event pressure).

import PackageDescription
import AppleProductTypes

let package = Package(
    name: "DashNotes",
    platforms: [
        .iOS("16.0")
    ],
    products: [
        .iOSApplication(
            name: "DashNotes",
            targets: ["AppModule"],
            bundleIdentifier: "com.dashovia.dashnotes.mobile",
            displayVersion: "1.0",
            bundleVersion: "1",
            appIcon: .placeholder(icon: .pencil),
            accentColor: .presetColor(.purple),
            supportedDeviceFamilies: [
                .pad,
                .phone
            ],
            supportedInterfaceOrientations: [
                .portrait,
                .landscapeRight,
                .landscapeLeft,
                .portraitUpsideDown(.when(deviceFamilies: [.pad]))
            ],
            capabilities: [
                .camera(purposeString: "Photograph your handwriting capture sheet to import your handwriting.")
            ]
        )
    ],
    targets: [
        .executableTarget(
            name: "AppModule",
            path: "."
        )
    ]
)
