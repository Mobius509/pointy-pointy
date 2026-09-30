import Foundation

/// The household link a parent shares from the web app, e.g.
/// `https://pointypoints.app/h/abc123`. It tells the app both which server
/// to talk to and which household to open.
struct HouseholdLink: Equatable {
    let origin: URL
    let slug: String

    init?(_ string: String) {
        var text = string.trimmingCharacters(in: .whitespacesAndNewlines)
        if !text.contains("://") { text = "https://" + text }

        guard
            let components = URLComponents(string: text),
            let scheme = components.scheme,
            let host = components.host
        else { return nil }

        let parts = components.path.split(separator: "/").map(String.init)
        guard let h = parts.firstIndex(of: "h"), h + 1 < parts.count else { return nil }

        var originParts = URLComponents()
        originParts.scheme = scheme
        originParts.host = host
        originParts.port = components.port
        guard let origin = originParts.url else { return nil }

        self.origin = origin
        self.slug = parts[h + 1]
    }

    var absoluteString: String {
        origin.appending(path: "h/\(slug)").absoluteString
    }

    /// Resolves a server-relative path like "/avatars/dog1.png".
    func resolve(_ path: String) -> URL? {
        URL(string: path, relativeTo: origin)?.absoluteURL
    }
}
