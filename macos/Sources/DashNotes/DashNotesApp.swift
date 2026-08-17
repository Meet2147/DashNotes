import SwiftUI
import WebKit

/// DashNotes for macOS.
///
/// A native SwiftUI shell around the deployed web app. Every feature — notes,
/// AI, the handwriting studio, PDF export — is the same code that runs at
/// dashnotes.dashovia.com, so web fixes reach the Mac app with no re-release.
/// The shell contributes what a browser tab cannot: a Dock icon, a real window,
/// native downloads into ~/Downloads, and sessions that persist per app.
let appURL = URL(string: "https://dashnotes.dashovia.com")!

@main
struct DashNotesApp: App {
    var body: some Scene {
        WindowGroup("DashNotes") {
            ContentView()
        }
        .defaultSize(width: 1280, height: 840)
        .commands {
            // The web app has no meaningful "New Window"; keep the menu tidy.
            CommandGroup(replacing: .newItem) {}
        }
    }
}

struct ContentView: View {
    var body: some View {
        WebView(url: appURL)
            .frame(minWidth: 980, minHeight: 640)
            .ignoresSafeArea()
    }
}

struct WebView: NSViewRepresentable {
    let url: URL

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        // Default (persistent) data store: the login session and handwriting
        // profiles survive quitting the app, like any native app's state.
        configuration.websiteDataStore = .default()
        configuration.preferences.isFraudulentWebsiteWarningEnabled = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.allowsMagnification = true
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}

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
            // Keep the app inside DashNotes; anything else goes to the browser.
            if let target = navigationAction.request.url,
               target.host != appURL.host,
               ["http", "https"].contains(target.scheme ?? "") {
                NSWorkspace.shared.open(target)
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

        // Links with target="_blank" have no window here; open them externally.
        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if let target = navigationAction.request.url {
                NSWorkspace.shared.open(target)
            }
            return nil
        }

        // MARK: Downloads -> ~/Downloads

        func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
            download.delegate = self
        }

        func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
            download.delegate = self
        }

        func download(
            _ download: WKDownload,
            decideDestinationUsing response: URLResponse,
            suggestedFilename: String,
            completionHandler: @escaping (URL?) -> Void
        ) {
            let downloads = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask)[0]
            var destination = downloads.appendingPathComponent(suggestedFilename)
            // Never overwrite: mirror Safari's "name (2).ext" behaviour.
            var counter = 2
            let base = destination.deletingPathExtension().lastPathComponent
            let ext = destination.pathExtension
            while FileManager.default.fileExists(atPath: destination.path) {
                let numbered = ext.isEmpty ? "\(base) (\(counter))" : "\(base) (\(counter)).\(ext)"
                destination = downloads.appendingPathComponent(numbered)
                counter += 1
            }
            self.lastDownloadDestination = destination
            completionHandler(destination)
        }

        private var lastDownloadDestination: URL?

        func downloadDidFinish(_ download: WKDownload) {
            // Show the finished file the way Safari does.
            if let destination = lastDownloadDestination {
                NSWorkspace.shared.activateFileViewerSelecting([destination])
            }
        }

        func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
            NSLog("DashNotes download failed: \(error.localizedDescription)")
        }
    }
}
