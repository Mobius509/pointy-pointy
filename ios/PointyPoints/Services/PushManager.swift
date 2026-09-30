import UIKit
import UserNotifications

/// Bridges UIKit's push callbacks into async Swift. The app delegate forwards
/// the APNs device token here; `AppModel` asks for it via `requestToken()`.
@MainActor
final class PushManager: NSObject {
    static let shared = PushManager()

    /// Which APNs server issued our token. Debug builds (Xcode) get sandbox
    /// tokens; TestFlight/App Store builds get production ones.
    #if DEBUG
    static let environment = "sandbox"
    #else
    static let environment = "production"
    #endif

    private(set) var deviceToken: String?
    private var waiters: [CheckedContinuation<String?, Never>] = []

    /// Called when a notification arrives while the app is open, so the
    /// checklist can refresh (e.g. "approved!").
    var onNotification: (() -> Void)?

    func authorizationStatus() async -> UNAuthorizationStatus {
        await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
    }

    /// Shows the system permission prompt (first time only).
    func requestAuthorization() async -> Bool {
        (try? await UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .sound, .badge])) ?? false
    }

    /// Registers with APNs and waits for the device token (nil on failure).
    func requestToken() async -> String? {
        if let deviceToken { return deviceToken }
        return await withCheckedContinuation { continuation in
            waiters.append(continuation)
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    fileprivate func didRegister(_ token: Data) {
        let hex = token.map { String(format: "%02x", $0) }.joined()
        deviceToken = hex
        resume(with: hex)
    }

    fileprivate func didFail(_ error: Error) {
        print("[push] APNs registration failed: \(error.localizedDescription)")
        resume(with: nil)
    }

    private func resume(with token: String?) {
        let pending = waiters
        waiters = []
        pending.forEach { $0.resume(returning: token) }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { @MainActor in PushManager.shared.didRegister(deviceToken) }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        Task { @MainActor in PushManager.shared.didFail(error) }
    }

    // Show banners even while the app is open, and refresh the checklist.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        await MainActor.run { PushManager.shared.onNotification?() }
        return [.banner, .sound, .list]
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        await MainActor.run { PushManager.shared.onNotification?() }
    }
}
