import SwiftUI
import WebKit

/// DashNotes for iPadOS / iOS.
///
/// A native shell around the deployed web app — the same pattern as the macOS
/// app, with the iOS equivalents where the platforms differ: exports go through
/// the share sheet instead of ~/Downloads, external links open in Safari via
/// UIApplication, and `<input type="file">` gets the system photo/camera picker
/// for free, which is exactly what the handwriting sheet upload needs.
let appURL = URL(string: "https://dashnotes.dashovia.com")!

@main
struct DashNotesApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct ContentView: View {
    var body: some View {
        WebView(url: appURL)
            // Paint the app's paper white behind the safe areas so the status
            // bar region never shows a black band.
            .background(Color.white.ignoresSafeArea())
    }
}

struct WebView: UIViewRepresentable {
    let url: URL

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        // Default (persistent) data store: login sessions and handwriting
        // profiles survive relaunches, like any native app's state.
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        webView.isOpaque = true
        webView.backgroundColor = .white
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {

        // MARK: Navigation policy

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            // Anchor clicks carrying a `download` attribute (the PDF and PNG
            // exports) arrive with shouldPerformDownload set.
            if navigationAction.shouldPerformDownload {
                decisionHandler(.download)
                return
            }
            // Keep the app inside DashNotes; anything else goes to Safari.
            if navigationAction.targetFrame?.isMainFrame != false,
               let target = navigationAction.request.url,
               target.host != appURL.host,
               ["http", "https"].contains(target.scheme ?? "") {
                UIApplication.shared.open(target)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationResponse: WKNavigationResponse,
            decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void
        ) {
            // Server responses the view cannot render (attachments) become downloads.
            decisionHandler(navigationResponse.canShowMIMEType ? .allow : .download)
        }

        // Links with target="_blank" have no window here; open in-place when
        // they are ours, in Safari when they are not.
        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if let target = navigationAction.request.url {
                if target.host == appURL.host {
                    webView.load(URLRequest(url: target))
                } else {
                    UIApplication.shared.open(target)
                }
            }
            return nil
        }

        // MARK: Downloads -> share sheet

        func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
            download.delegate = self
        }

        func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
            download.delegate = self
        }

        private var lastDownloadDestination: URL?

        func download(
            _ download: WKDownload,
            decideDestinationUsing response: URLResponse,
            suggestedFilename: String,
            completionHandler: @escaping (URL?) -> Void
        ) {
            // A sandboxed app has no user-visible Downloads folder, so stage the
            // file in temp and hand it to the share sheet when it finishes —
            // from there it can go to Files, AirDrop, print, or another app.
            let staging = FileManager.default.temporaryDirectory
                .appendingPathComponent("Exports", isDirectory: true)
            try? FileManager.default.createDirectory(at: staging, withIntermediateDirectories: true)
            var destination = staging.appendingPathComponent(suggestedFilename)
            var counter = 2
            let base = destination.deletingPathExtension().lastPathComponent
            let ext = destination.pathExtension
            while FileManager.default.fileExists(atPath: destination.path) {
                let numbered = ext.isEmpty ? "\(base) (\(counter))" : "\(base) (\(counter)).\(ext)"
                destination = staging.appendingPathComponent(numbered)
                counter += 1
            }
            lastDownloadDestination = destination
            completionHandler(destination)
        }

        func downloadDidFinish(_ download: WKDownload) {
            guard let destination = lastDownloadDestination else { return }
            presentShareSheet(for: destination)
        }

        func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
            NSLog("DashNotes download failed: \(error.localizedDescription)")
        }

        private func presentShareSheet(for fileURL: URL) {
            DispatchQueue.main.async {
                let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
                let scene = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
                guard let root = scene?.keyWindow?.rootViewController else { return }

                let activity = UIActivityViewController(activityItems: [fileURL], applicationActivities: nil)
                // On iPad an action sheet must anchor to something or UIKit
                // refuses to present it; centre it with no arrow.
                if let popover = activity.popoverPresentationController {
                    popover.sourceView = root.view
                    popover.sourceRect = CGRect(
                        x: root.view.bounds.midX,
                        y: root.view.bounds.midY,
                        width: 1,
                        height: 1
                    )
                    popover.permittedArrowDirections = []
                }

                var presenter = root
                while let presented = presenter.presentedViewController {
                    presenter = presented
                }
                presenter.present(activity, animated: true)
            }
        }
    }
}
