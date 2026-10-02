import SwiftUI
import WebKit

/// A kid page from the web app, signed in as the kid — for the celebrations
/// and the arcade's mini games, which run the web versions for now (an
/// agreed deviation, GROUND_RULES.md; native versions come later). The page
/// hides the web's own bars, and calls `onClose` when it's done
/// (`webkit.messageHandlers.pointy.postMessage({ type: "close" })`).
struct WebPlayView: UIViewRepresentable {
    let request: URLRequest
    var onClose: () -> Void = {}

    func makeCoordinator() -> Coordinator { Coordinator(onClose: onClose) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.userContentController.add(context.coordinator, name: "pointy")
        let view = WKWebView(frame: .zero, configuration: config)
        view.isOpaque = false
        view.backgroundColor = .clear
        view.scrollView.backgroundColor = .clear
        view.scrollView.contentInsetAdjustmentBehavior = .never
        #if DEBUG
        view.isInspectable = true
        #endif
        view.load(request)
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {
        context.coordinator.onClose = onClose
    }

    static func dismantleUIView(_ view: WKWebView, coordinator: Coordinator) {
        view.configuration.userContentController.removeScriptMessageHandler(forName: "pointy")
    }

    final class Coordinator: NSObject, WKScriptMessageHandler {
        var onClose: () -> Void
        init(onClose: @escaping () -> Void) { self.onClose = onClose }

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any], body["type"] as? String == "close" else { return }
            onClose()
        }
    }
}
