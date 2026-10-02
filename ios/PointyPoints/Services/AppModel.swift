import Foundation
import Observation
import UserNotifications

/// App-wide state: which household we're pointed at, who's signed in, and
/// today's checklist. Views call the async actions; UI updates optimistically
/// and rolls back if the server says no (same as the web kid view).
@MainActor
@Observable
final class AppModel {
    enum Screen { case connect, pickKid, today }

    private(set) var link: HouseholdLink?
    private(set) var household: HouseholdResponse?
    private(set) var today: TodayResponse?
    private var token: String?

    var errorMessage: String?
    var isLoading = false
    /// Bumped whenever a task is marked done, to fire confetti.
    private(set) var celebrationCount = 0

    /// A web page to show full screen (the celebration — the web version
    /// for now), e.g. after tapping an "approved!" notification.
    var webPage: WebPage?

    /// Dev (debug builds): show the default palette instead of the kid's own
    /// color, so colors match the designs. Same as the web's dev switch.
    var devDefaultColors = UserDefaults.standard.bool(forKey: "devDefaultColors") {
        didSet {
            UserDefaults.standard.set(devDefaultColors, forKey: "devDefaultColors")
            applyPalette()
        }
    }

    private(set) var notificationStatus: UNAuthorizationStatus = .notDetermined
    /// "HH:MM" (24h, household timezone) or nil when the reminder is off.
    private(set) var reminderTime: String?

    private static let linkKey = "householdLink"
    private static let tokenAccount = "kidToken"

    init() {
        if let saved = UserDefaults.standard.string(forKey: Self.linkKey) {
            link = HouseholdLink(saved)
        }
        token = KeychainStore.string(for: Self.tokenAccount)
        PushManager.shared.onNotification = { [weak self] in
            Task { await self?.refresh() }
        }
        // Tapping an "approved!" notification opens the celebration.
        PushManager.shared.onOpen = { [weak self] url in
            guard let self, url.hasSuffix("/celebrate") else { return }
            self.webPage = .celebrate
        }
    }

    var screen: Screen {
        if link == nil { return .connect }
        if token == nil { return .pickKid }
        return .today
    }

    private var api: APIClient? {
        link.map { APIClient(origin: $0.origin, token: token) }
    }

    // MARK: - Household

    /// Validates a pasted household link by loading its kid list.
    func connect(to text: String) async {
        guard let parsed = HouseholdLink(text) else {
            errorMessage = "That doesn't look like a Pointy Points family link. It should end in /h/…"
            return
        }
        await run {
            let response = try await APIClient(origin: parsed.origin).household(slug: parsed.slug)
            self.link = parsed
            self.household = response
            UserDefaults.standard.set(parsed.absoluteString, forKey: Self.linkKey)
        }
    }

    func loadHousehold() async {
        guard let link, let api else { return }
        await run { self.household = try await api.household(slug: link.slug) }
    }

    func forgetHousehold() {
        signOut()
        link = nil
        household = nil
        UserDefaults.standard.removeObject(forKey: Self.linkKey)
    }

    // MARK: - Session

    /// Returns true on success so the PIN pad can shake on failure.
    func signIn(kid: KidSummary, pin: String) async -> Bool {
        guard let link, let api else { return false }
        var succeeded = false
        await run {
            let session = try await api.signIn(slug: link.slug, kidProfileId: kid.id, pin: pin)
            self.setToken(session.token)
            succeeded = true
        }
        if succeeded {
            await refresh()
            await syncDeviceRegistration()
        }
        return succeeded
    }

    func signOut() {
        // Detach this phone from the kid first so the next kid to sign in
        // doesn't get their notifications. Best effort.
        if let api, let deviceToken = PushManager.shared.deviceToken {
            Task { try? await api.unregisterDevice(token: deviceToken) }
        }
        setToken(nil)
        today = nil
        reminderTime = nil
        webPage = nil
        ThemeStore.shared.palette = KidPalette(hue: KidPalette.defaultHue)
    }

    private func setToken(_ value: String?) {
        token = value
        KeychainStore.set(value, for: Self.tokenAccount)
    }

    // MARK: - Today

    func refresh() async {
        guard let api, token != nil else { return }
        await run {
            self.today = try await api.today()
            self.applyPalette()
        }
    }

    // MARK: - Color

    /// The kid's color (or the default one, with the dev switch on).
    private func applyPalette() {
        let hue = devDefaultColors ? KidPalette.defaultHue : (today?.hue ?? KidPalette.defaultHue)
        ThemeStore.shared.palette = KidPalette(hue: hue)
    }

    /// Recolors the app while the kid slides the color picker (not saved).
    func previewHue(_ hue: Int) {
        ThemeStore.shared.palette = KidPalette(hue: hue)
    }

    /// Saves the kid's color; puts the old one back if that fails.
    func saveHue(_ hue: Int) async {
        guard let api else { return }
        let saved = today?.hue ?? KidPalette.defaultHue
        previewHue(hue)
        let ok = await run { try await api.setHue(hue) }
        if ok { await refresh() } else { previewHue(saved) }
    }

    // MARK: - Web pages (celebrations, arcade)

    enum WebPage: String, Identifiable {
        case celebrate, arcade
        var id: String { rawValue }
    }

    /// The signed-in web view request for a kid page.
    func webRequest(_ page: WebPage) -> URLRequest? {
        guard let link, let api, token != nil else { return nil }
        return api.webSessionRequest(to: "/h/\(link.slug)/\(page.rawValue)")
    }

    func complete(_ item: ChecklistItem) async {
        celebrationCount += 1
        await updateTask(item, to: .pending, action: "complete")
    }

    func cancelPending(_ item: ChecklistItem) async {
        await updateTask(item, to: .open, action: "cancel")
    }

    func recall(_ item: ChecklistItem) async {
        await updateTask(item, to: .open, action: "recall")
    }

    private func updateTask(_ item: ChecklistItem, to newState: ItemState, action: String) async {
        guard let api, let index = today?.items.firstIndex(where: { $0.id == item.id }) else { return }
        let previous = today?.items[index].state ?? item.state
        today?.items[index].state = newState

        let ok = await run { try await api.task(item.id, action: action) }
        if !ok {
            today?.items[index].state = previous
        } else if action == "recall" {
            // Recalling removes approved points, so reload the progress bar.
            await refresh()
        }
    }

    func submitProposal(_ name: String) async -> Bool {
        guard let api else { return false }
        let ok = await run { try await api.submitProposal(name: name) }
        if ok { await refresh() }
        return ok
    }

    func cancelProposal(_ proposal: Proposal) async {
        guard let api else { return }
        let before = today?.pendingProposals
        today?.pendingProposals.removeAll { $0.id == proposal.id }
        let ok = await run { try await api.cancelProposal(id: proposal.id) }
        if !ok, let before { today?.pendingProposals = before }
    }

    // MARK: - Notifications & settings

    func refreshNotificationStatus() async {
        notificationStatus = await PushManager.shared.authorizationStatus()
    }

    /// Asks for permission (first time) and registers this phone for the kid.
    func enableNotifications() async {
        _ = await PushManager.shared.requestAuthorization()
        await refreshNotificationStatus()
        await syncDeviceRegistration()
    }

    /// If notifications are allowed, (re)sends this phone's APNs token so the
    /// server knows which kid it belongs to. Cheap to call on every launch.
    func syncDeviceRegistration() async {
        await refreshNotificationStatus()
        guard notificationStatus == .authorized || notificationStatus == .provisional,
              token != nil,
              let deviceToken = await PushManager.shared.requestToken(),
              let api
        else { return }
        await run {
            try await api.registerDevice(token: deviceToken, environment: PushManager.environment)
        }
    }

    func loadSettings() async {
        guard let api, token != nil else { return }
        await run { self.reminderTime = try await api.settings().reminderTime }
    }

    func setReminderTime(_ time: String?) async {
        guard let api else { return }
        let previous = reminderTime
        reminderTime = time
        let ok = await run { try await api.setReminderTime(time) }
        if !ok { reminderTime = previous }
    }

    // MARK: - Helpers

    /// Runs a request, surfacing errors in `errorMessage` and signing out on 401.
    @discardableResult
    private func run(_ work: () async throws -> Void) async -> Bool {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            try await work()
            return true
        } catch APIError.unauthorized {
            signOut()
            errorMessage = APIError.unauthorized.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }
        return false
    }
}
