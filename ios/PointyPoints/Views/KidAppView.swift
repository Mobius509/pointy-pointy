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

/// The floating tab bar: Stats · the big ✓ (Tasks) · Arcade. A dark bar
/// with a hump in the middle that holds the big button — custom-drawn
/// (NavShape), the same shape and colors as the web's KidTabBar.
private struct TabBar: View {
    @Binding var tab: KidAppView.Tab

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
            .padding(.horizontal, 16)
            .frame(height: 46)
            .frame(maxHeight: .infinity, alignment: .bottom)
            // The big ✓ fills the hump.
            Button { tab = .tasks } label: {
                Image(systemName: "checkmark.square.fill")
                    .symbolRenderingMode(.palette)
                    .foregroundStyle(Theme.palette.strong, Theme.palette.cardSoft)
                    .font(.system(size: 28, weight: .semibold))
                    .frame(width: 59, height: 59)
                    .background(Theme.palette.strong, in: Circle())
            }
            .padding(.top, 3)
            .offset(x: 128.18 - 257 / 2) // centered on the hump's peak
            .accessibilityLabel("Tasks")
            .accessibilityAddTraits(tab == .tasks ? .isSelected : [])
        }
        .frame(width: 257, height: 67)
    }

    private func side(_ which: KidAppView.Tab, _ label: String, _ icon: String, iconFirst: Bool) -> some View {
        Button { tab = which } label: {
            HStack(spacing: 6) {
                if iconFirst { Image(icon).resizable().frame(width: 22, height: 22) }
                Text(label).font(.rounded(14, .bold))
                if !iconFirst { Image(icon).resizable().frame(width: 22, height: 22) }
            }
            .foregroundStyle(Theme.palette.strong)
            .opacity(tab == which ? 1 : 0.75)
        }
        .accessibilityAddTraits(tab == which ? .isSelected : [])
    }
}

/// The tab bar's outline: a 257 × 67 pill-ended bar with a hump in the
/// middle — the exported design (public/icons/UI_Navigation.svg), scaled to
/// the frame. Same path as the web.
struct NavShape: Shape {
    func path(in rect: CGRect) -> Path {
        let sx = rect.width / 257, sy = rect.height / 67
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: rect.minX + x * sx, y: rect.minY + y * sy) }
        var path = Path()
        path.move(to: p(129.193, 0))
        path.addCurve(to: p(148.387, 7.26144), control1: p(136.554, 0), control2: p(143.274, 2.74254))
        path.addCurve(to: p(171.638, 19.5977), control1: p(155.113, 13.2047), control2: p(162.663, 19.5977))
        path.addLine(to: p(233.142, 19.5977))
        path.addCurve(to: p(256.367, 42.8232), control1: p(245.969, 19.5978), control2: p(256.367, 29.9963))
        path.addCurve(to: p(233.142, 66.0498), control1: p(256.367, 55.6504), control2: p(245.969, 66.0497))
        path.addLine(to: p(23.2256, 66.0498))
        path.addCurve(to: p(0, 42.8232), control1: p(10.3985, 66.0497), control2: p(0, 55.6504))
        path.addCurve(to: p(23.2256, 19.5977), control1: p(0.00023, 29.9963), control2: p(10.3986, 19.5978))
        path.addLine(to: p(84.7292, 19.5977))
        path.addCurve(to: p(107.98, 7.26144), control1: p(93.7043, 19.5977), control2: p(101.254, 13.2047))
        path.addCurve(to: p(127.174, 0), control1: p(113.093, 2.74253), control2: p(119.813, 0))
        path.addLine(to: p(129.193, 0))
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
