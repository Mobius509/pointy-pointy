import Foundation

enum APIError: LocalizedError {
    /// Token missing, expired, or rejected — the kid needs to sign in again.
    case unauthorized
    case server(String)
    case unreachable

    var errorDescription: String? {
        switch self {
        case .unauthorized: "Please sign in again."
        case .server(let message): message
        case .unreachable: "Couldn't reach Pointy Points. Check your connection and try again."
        }
    }
}

/// Thin async wrapper around the web app's kid API.
struct APIClient {
    let origin: URL
    var token: String?

    private static let decoder = JSONDecoder()
    private static let encoder = JSONEncoder()

    func household(slug: String) async throws -> HouseholdResponse {
        try await send("GET", "api/v2/kid/households/\(slug)")
    }

    func signIn(slug: String, kidProfileId: String, pin: String) async throws -> SessionResponse {
        try await send("POST", "api/v2/kid/session", body: [
            "slug": slug, "kidProfileId": kidProfileId, "pin": pin,
        ])
    }

    func today() async throws -> TodayResponse {
        try await send("GET", "api/v2/kid/today")
    }

    /// action: "complete", "cancel", or "recall".
    func task(_ taskId: String, action: String) async throws {
        let _: OkResponse = try await send("POST", "api/v2/kid/tasks/\(taskId)/\(action)")
    }

    func submitProposal(name: String) async throws {
        let _: OkResponse = try await send("POST", "api/v2/kid/proposals", body: ["name": name])
    }

    func cancelProposal(id: String) async throws {
        let _: OkResponse = try await send("DELETE", "api/v2/kid/proposals/\(id)")
    }

    func registerDevice(token: String, environment: String) async throws {
        let _: OkResponse = try await send("POST", "api/v2/kid/devices", body: [
            "token": token, "environment": environment,
        ])
    }

    func unregisterDevice(token: String) async throws {
        let _: OkResponse = try await send("DELETE", "api/v2/kid/devices", body: ["token": token])
    }

    func settings() async throws -> KidSettings {
        try await send("GET", "api/v2/kid/settings")
    }

    /// "HH:MM" in the household's timezone, or nil to turn the reminder off.
    func setReminderTime(_ time: String?) async throws {
        let _: OkResponse = try await send("PUT", "api/v2/kid/settings", body: ["reminderTime": time])
    }

    // MARK: - Plumbing

    private struct OkResponse: Decodable {}
    private struct ErrorResponse: Decodable { let error: String }

    private func send<T: Decodable>(
        _ method: String,
        _ path: String,
        body: [String: String?]? = nil
    ) async throws -> T {
        var request = URLRequest(url: origin.appending(path: path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try Self.encoder.encode(body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw APIError.unreachable
        }

        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let message = (try? Self.decoder.decode(ErrorResponse.self, from: data))?.error
            if status == 401, path != "api/v2/kid/session" { throw APIError.unauthorized }
            throw APIError.server(message ?? "Something went wrong (\(status)).")
        }
        return try Self.decoder.decode(T.self, from: data)
    }
}
