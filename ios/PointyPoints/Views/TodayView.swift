import SwiftUI

/// The kid home screen: avatar + name, goal progress, checklist, and
/// "did something extra?".
struct TodayView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.scenePhase) private var scenePhase
    @State private var showSettings = false

    var body: some View {
        NavigationStack {
            ScrollView {
                if let today = model.today {
                    content(today)
                } else if let error = model.errorMessage {
                    ErrorBanner(message: error).padding(24)
                } else {
                    ProgressView().padding(.top, 120)
                }
            }
            .background(Theme.cream)
            .refreshable { await model.refresh() }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showSettings = true } label: {
                        Image(systemName: "gearshape.fill")
                    }
                    .accessibilityLabel("Settings")
                }
            }
            .sheet(isPresented: $showSettings) { SettingsView() }
            .toolbarBackground(Theme.cream, for: .navigationBar)
        }
        .overlay { ConfettiView(trigger: model.celebrationCount) }
        .task {
            await model.refresh()
            await model.syncDeviceRegistration()
        }
        .onChange(of: scenePhase) { _, phase in
            // The checklist resets at local midnight — reload when reopened.
            if phase == .active { Task { await model.refresh() } }
        }
    }

    private func content(_ today: TodayResponse) -> some View {
        VStack(spacing: 20) {
            VStack(spacing: 4) {
                AvatarImage(url: model.link?.resolve(today.kid.avatarUrl), size: 140)
                Text(today.kid.name)
                    .font(.rounded(26, .bold))
                    .foregroundStyle(Theme.orange)
            }

            if let error = model.errorMessage {
                ErrorBanner(message: error)
            }

            if let goal = today.goal {
                GoalCard(goal: goal, progress: today.progress, milestones: today.milestones)
            }

            Card { ChecklistView(items: today.items) }

            ProposalCard(pending: today.pendingProposals)
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 32)
        .frame(maxWidth: 700)
        .frame(maxWidth: .infinity)
    }
}
