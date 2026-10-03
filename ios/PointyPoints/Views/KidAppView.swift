import SwiftUI

/// The signed-in kid app: top bar (settings, initials menu),
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
            Theme.palette.page.ignoresSafeArea()

            switch tab {
            case .stats: page { StatsView(openTasks: { tab = .tasks }, openArcade: { tab = .arcade }) }
            case .tasks: page { TasksView() }
            case .arcade: ArcadeTab(topBar: topBar)
            }

            TabBar(tab: $tab)
                .padding(.bottom, 8)
        }
        // Content scrolls under a blurred strip behind the clock that fades
        // out at its bottom edge.
        .overlay(alignment: .top) {
            GeometryReader { geo in
                Rectangle()
                    .fill(.ultraThinMaterial)
                    .overlay(Theme.palette.page.opacity(0.35))
                    .mask(
                        LinearGradient(
                            stops: [.init(color: .black, location: 0), .init(color: .black, location: 0.55), .init(color: .clear, location: 1)],
                            startPoint: .top, endPoint: .bottom
                        )
                    )
                    .frame(height: geo.safeAreaInsets.top + 28)
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
                .background(Theme.palette.page.ignoresSafeArea())
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
            .padding(.horizontal, 16)
            .padding(.bottom, 145)
            .frame(maxWidth: 440)
            .frame(maxWidth: .infinity)
        }
        .refreshable { await model.refresh() }
    }

    private var topBar: some View {
        HStack {
            Spacer()
            Button { showSettings = true } label: {
                Image(systemName: "gearshape.fill")
                    .font(.system(size: 18))
                    .frame(width: 40, height: 40)
                    .background(Theme.palette.chip, in: Circle())
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
                    .kidFont(17)
                    .frame(width: 40, height: 40)
                    .background(Theme.palette.chip, in: Circle())
                    .foregroundStyle(Theme.palette.strong)
            }
        }
        .padding(.top, 4)
        .zIndex(1) // over the avatar, which reaches up beside it
        .accessibilityLabel(model.today?.householdName ?? model.household?.household.name ?? "")
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
                    .padding(.bottom, 125)
            }
        }
    }
}

/// The floating tab bar: Stats · the big ✓ (Tasks) · Arcade. A dark bar
/// with a hump in the middle that holds the big button — custom-drawn
/// (NavShape), the same shape, size and colors as the web's KidTabBar.
private struct TabBar: View {
    @Binding var tab: KidAppView.Tab

    static let width: CGFloat = 358, height: CGFloat = 103
    private static let barTop: CGFloat = 30.28 // where the bar part starts (the hump is above it)
    private static let peakX: CGFloat = 179.745 // the hump's peak — the big button centers on it

    var body: some View {
        ZStack(alignment: .top) {
            NavShape()
                .fill(Theme.palette.nav)
                .shadow(color: .black.opacity(0.25), radius: 10, y: 6)
            // The bar: Stats on the left, Arcade on the right.
            HStack {
                side(.stats, "Stats", "IconThumbsUp", iconFirst: true)
                Spacer()
                side(.arcade, "Arcade", "IconGame", iconFirst: false)
            }
            .padding(.horizontal, 26)
            .frame(height: Self.height - Self.barTop)
            .padding(.top, Self.barTop)
            // The big ✓ fills the hump.
            Button { tab = .tasks } label: {
                Image(systemName: "checkmark.square.fill")
                    .symbolRenderingMode(.palette)
                    .foregroundStyle(Theme.palette.strong, .white)
                    .font(.system(size: 38, weight: .semibold))
                    .frame(width: 88, height: 88)
                    .background(Theme.palette.strong, in: Circle())
            }
            .padding(.top, 5)
            .offset(x: Self.peakX - Self.width / 2) // centered on the hump's peak
            .accessibilityLabel("Tasks")
            .accessibilityAddTraits(tab == .tasks ? .isSelected : [])
        }
        .frame(width: Self.width, height: Self.height)
    }

    private func side(_ which: KidAppView.Tab, _ label: String, _ icon: String, iconFirst: Bool) -> some View {
        Button { tab = which } label: {
            HStack(spacing: 8) {
                if iconFirst { Image(icon).resizable().frame(width: 27, height: 27) }
                Text(label).kidFont(17, .bold)
                if !iconFirst { Image(icon).resizable().frame(width: 27, height: 27) }
            }
            .foregroundStyle(Theme.palette.strong)
        }
        .accessibilityAddTraits(tab == which ? .isSelected : [])
    }
}

/// The tab bar's outline: a pill-ended bar with a hump in the middle — the
/// exported design (public/ui/UI_Navigation.svg, 358 × 103), scaled to the
/// frame. Same path as the web.
struct NavShape: Shape {
    func path(in rect: CGRect) -> Path {
        let sx = rect.width / 358, sy = rect.height / 103
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: rect.minX + x * sx, y: rect.minY + y * sy) }
        var path = Path()
        path.move(to: p(179.745, 0))
        path.addCurve(to: p(262.925, 30.2812), control1: p(222.055, 0), control2: p(219.723, 28.4916))
        path.addLine(to: p(320.932, 30.2812))
        path.addCurve(to: p(358, 66.6411), control1: p(341.404, 30.2812), control2: p(358, 46.5602))
        path.addCurve(to: p(320.932, 103), control1: p(358, 86.7217), control2: p(341.404, 103))
        path.addLine(to: p(37.0676, 103))
        path.addCurve(to: p(0, 66.6411), control1: p(16.596, 103), control2: p(0.00027, 86.7217))
        path.addCurve(to: p(37.0676, 30.2812), control1: p(0, 46.5602), control2: p(16.5959, 30.2812))
        path.addLine(to: p(91.3469, 30.2812))
        path.addCurve(to: p(179.745, 0), control1: p(139.927, 28.4918), control2: p(137.435, 0.00019))
        path.closeSubpath()
        return path
    }
}

/// The Tasks tab: today's checklist and "did something extra?".
struct TasksView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Today's tasks")
                .kidFont(28)
                .foregroundStyle(Theme.palette.text)
                .padding(.horizontal, 12)
            if let today = model.today {
                VStack { ChecklistView(items: today.items) }
                    .padding(16)
                    .background(.white, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
                    .padding(12)
                    .background(.white, in: RoundedRectangle(cornerRadius: 32, style: .continuous))
                ProposalCard(pending: today.pendingProposals)
            } else {
                ProgressView().frame(maxWidth: .infinity).padding(.top, 80)
            }
        }
    }
}
