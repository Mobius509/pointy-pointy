import SwiftUI

/// The signed-in kid app: top bar (family name, settings, initials menu),
/// the Stats · Tasks · Arcade tabs, and the floating tab bar — the same as
/// the web kid app (src/app/h/[slug]/(kid)/, KidChrome + KidTabBar).
struct KidAppView: View {
    enum Tab { case stats, tasks, arcade }

    @Environment(AppModel.self) private var model
    @Environment(\.scenePhase) private var scenePhase
    @State private var tab: Tab = .stats
    @State private var showSettings = false

    var body: some View {
        @Bindable var model = model
        ZStack(alignment: .bottom) {
            Color.white.ignoresSafeArea()

            switch tab {
            case .stats: page { StatsView(openTasks: { tab = .tasks }) }
            case .tasks: page { TasksView() }
            case .arcade: ArcadeTab(topBar: topBar)
            }

            TabBar(tab: $tab)
                .padding(.bottom, 8)
        }
        // Content scrolls under a soft white strip behind the clock.
        .overlay(alignment: .top) {
            GeometryReader { geo in
                Color.white.opacity(0.92)
                    .frame(height: geo.safeAreaInsets.top)
                    .offset(y: -geo.safeAreaInsets.top)
            }
            .allowsHitTesting(false)
        }
        .overlay { ConfettiView(trigger: model.celebrationCount) }
        .sheet(isPresented: $showSettings) { SettingsView() }
        .fullScreenCover(item: $model.webPage) { page in
            if let request = model.webRequest(page) {
                WebPlayView(request: request) {
                    model.webPage = nil
                    Task { await model.refresh() }
                }
                .ignoresSafeArea()
                .background(Theme.palette.card.ignoresSafeArea())
            }
        }
        .task {
            await model.refresh()
            await model.syncDeviceRegistration()
        }
        .onChange(of: scenePhase) { _, phase in
            // The checklist resets at local midnight — reload when reopened.
            if phase == .active { Task { await model.refresh() } }
        }
    }

    /// A scrolling tab page under the top bar, clear of the tab bar.
    private func page<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        ScrollView {
            VStack(spacing: 10) {
                topBar
                if let error = model.errorMessage { ErrorBanner(message: error) }
                content()
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 110)
            .frame(maxWidth: 440)
            .frame(maxWidth: .infinity)
        }
        .refreshable { await model.refresh() }
    }

    private var topBar: some View {
        HStack {
            Text(model.today?.householdName ?? model.household?.household.name ?? "")
                .font(.rounded(13))
                .foregroundStyle(Theme.palette.strong)
                .lineLimit(1)
            Spacer()
            Button { showSettings = true } label: {
                Image(systemName: "gearshape.fill")
                    .font(.system(size: 18))
                    .frame(width: 40, height: 40)
                    .background(Theme.palette.card, in: Circle())
            }
            .foregroundStyle(Theme.palette.strong)
            .accessibilityLabel("Settings")
            Menu {
                Button("Settings", systemImage: "gearshape") { showSettings = true }
                Button("Sign out", systemImage: "rectangle.portrait.and.arrow.right", role: .destructive) {
                    model.signOut()
                }
            } label: {
                Text(model.today?.initials.flatMap { $0.isEmpty ? nil : $0 } ?? "🙂")
                    .font(.rounded(17))
                    .frame(width: 40, height: 40)
                    .background(Theme.palette.card, in: Circle())
                    .foregroundStyle(Theme.palette.strong)
            }
        }
        .padding(.horizontal, 12)
        .padding(.top, 4)
    }
}

/// The Arcade tab: the web arcade (tickets and mini games) in a web view,
/// for now.
private struct ArcadeTab<TopBar: View>: View {
    @Environment(AppModel.self) private var model
    let topBar: TopBar

    var body: some View {
        VStack(spacing: 0) {
            topBar.frame(maxWidth: 440)
            if let request = model.webRequest(.arcade) {
                WebPlayView(request: request)
                    .padding(.bottom, 90)
            }
        }
    }
}

/// The floating tab bar: Stats · the big ✓ (Tasks) · Arcade.
private struct TabBar: View {
    @Binding var tab: KidAppView.Tab

    var body: some View {
        HStack(spacing: 12) {
            side(.stats, "Stats", "chart.pie.fill")
            Button { tab = .tasks } label: {
                Image(systemName: "checkmark.square.fill")
                    .font(.system(size: 26, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 62, height: 62)
                    .background(Theme.palette.strong, in: Circle())
                    .overlay(Circle().stroke(Theme.palette.card, lineWidth: tab == .tasks ? 4 : 0))
                    .shadow(color: Theme.palette.text.opacity(0.25), radius: 6, y: 3)
            }
            .padding(.vertical, -12)
            .accessibilityLabel("Tasks")
            side(.arcade, "Arcade", "gamecontroller.fill")
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Theme.palette.cardSoft.opacity(0.95), in: Capsule())
        .overlay(Capsule().stroke(Theme.palette.card, lineWidth: 1))
        .shadow(color: Theme.palette.text.opacity(0.15), radius: 12, y: 8)
    }

    private func side(_ which: KidAppView.Tab, _ label: String, _ icon: String) -> some View {
        Button { tab = which } label: {
            HStack(spacing: 6) {
                Image(systemName: icon).foregroundStyle(Theme.palette.strong)
                Text(label)
                    .font(.rounded(13, .semibold))
                    .foregroundStyle(tab == which ? Theme.palette.textStrong : Theme.palette.text)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(tab == which ? Theme.palette.card : .clear, in: Capsule())
        }
        .accessibilityAddTraits(tab == which ? .isSelected : [])
    }
}

/// The Tasks tab: today's checklist and "did something extra?".
struct TasksView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Today's tasks")
                .font(.rounded(28))
                .foregroundStyle(Theme.palette.strong)
                .padding(.horizontal, 12)
            if let today = model.today {
                VStack { ChecklistView(items: today.items) }
                    .padding(16)
                    .background(.white, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
                    .padding(12)
                    .background(Theme.palette.card, in: RoundedRectangle(cornerRadius: 32, style: .continuous))
                ProposalCard(pending: today.pendingProposals)
            } else {
                ProgressView().frame(maxWidth: .infinity).padding(.top, 80)
            }
        }
    }
}
