import SwiftUI
import UserNotifications

/// Kid settings sheet: notifications, daily reminder, sign out.
struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    notificationsCard
                    reminderCard

                    if let error = model.errorMessage {
                        ErrorBanner(message: error)
                    }

                    Button("Sign Out", role: .destructive) {
                        dismiss()
                        model.signOut()
                    }
                    .font(.rounded(16, .semibold))
                    .padding(.top, 8)
                }
                .padding(16)
            }
            .background(Theme.cream)
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .task {
            await model.refreshNotificationStatus()
            await model.loadSettings()
        }
    }

    private var notificationsCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 10) {
                Text("Notifications")
                    .font(.rounded(20, .medium))
                    .foregroundStyle(Theme.orange)
                Text("Find out when a parent approves your tasks or gives you a bonus.")
                    .font(.rounded(13))
                    .foregroundStyle(Theme.sand)

                switch model.notificationStatus {
                case .authorized, .provisional, .ephemeral:
                    Label("Notifications are on", systemImage: "checkmark.circle.fill")
                        .font(.rounded(15, .semibold))
                        .foregroundStyle(Theme.approvedText)
                case .denied:
                    Text("Notifications are turned off for Pointy Points.")
                        .font(.rounded(14))
                        .foregroundStyle(Theme.rust)
                    Button("Open iPhone Settings") {
                        if let url = URL(string: UIApplication.openNotificationSettingsURLString) {
                            openURL(url)
                        }
                    }
                    .buttonStyle(OutlinePill())
                default:
                    PrimaryButton(title: "Turn On Notifications", isLoading: model.isLoading) {
                        Task { await model.enableNotifications() }
                    }
                }
            }
        }
    }

    private var reminderCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 10) {
                Text("Daily Reminder")
                    .font(.rounded(20, .medium))
                    .foregroundStyle(Theme.orange)
                Text("Get a nudge to log your points if you still have tasks left.")
                    .font(.rounded(13))
                    .foregroundStyle(Theme.sand)

                Picker("Reminder time", selection: Binding(
                    get: { model.reminderTime ?? "" },
                    set: { value in Task { await model.setReminderTime(value.isEmpty ? nil : value) } }
                )) {
                    Text("Off").tag("")
                    ForEach(Self.times, id: \.value) { time in
                        Text(time.label).tag(time.value)
                    }
                }
                .pickerStyle(.menu)
                .tint(Theme.orange)

                if model.reminderTime != nil,
                   model.notificationStatus != .authorized && model.notificationStatus != .provisional {
                    Text("Turn on notifications above to get your reminder.")
                        .font(.rounded(12, .semibold))
                        .foregroundStyle(Theme.pendingText)
                }
            }
        }
    }

    /// 15-minute steps, 7:00 AM – 9:45 PM (the reminder job runs every 15 min).
    private static let times: [(value: String, label: String)] = (0..<60).map { i in
        let minutes = 7 * 60 + i * 15
        let h = minutes / 60, m = minutes % 60
        let label = "\(h % 12 == 0 ? 12 : h % 12):\(String(format: "%02d", m)) \(h < 12 ? "AM" : "PM")"
        return (String(format: "%02d:%02d", h, m), label)
    }
}
