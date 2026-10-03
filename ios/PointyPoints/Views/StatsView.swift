import SwiftUI
import UIKit

/// The kid app's home (Stats): greeting with the avatar, "let's celebrate"
/// when approvals are waiting, this week's streak, the goal ring and their
/// arcade tickets. Mirrors the web's KidStats
/// (src/app/h/[slug]/_components/KidStats.tsx).
struct StatsView: View {
    @Environment(AppModel.self) private var model
    var openTasks: () -> Void
    var openArcade: () -> Void
    @State private var pageEnd: CGFloat = 0 // where the content ends, on screen

    var body: some View {
        if let today = model.today {
            VStack(spacing: 10) {
                GreetingCard(
                    greeting: today.greeting ?? "Hello \(today.kid.name)! Let's get some stuff done today",
                    avatarURL: model.link?.resolve(today.kid.avatarUrl)
                )
                if !(today.pendingCelebration ?? []).isEmpty {
                    CelebrateCard { model.webPage = .celebrate }
                }
                if let streak = today.streaks?.first, let week = streak.week {
                    StreakWeekCard(streak: streak, week: week, items: today.items, openTasks: openTasks)
                }
                GoalRingCard(today: today, pageEnd: pageEnd)
                if let arcade = today.arcade {
                    TicketCard(arcade: arcade, artURL: (arcade.featured?.art ?? arcade.playing?.art).flatMap { model.link?.resolve($0) }, open: openArcade)
                        .padding(.top, 12)
                }
            }
            .background(alignment: .bottom) {
                Color.clear.frame(height: 0)
                    .onGeometryChange(for: CGFloat.self) { $0.frame(in: .global).maxY } action: { pageEnd = $0 }
            }
        } else {
            ProgressView().frame(maxWidth: .infinity).padding(.top, 120)
        }
    }
}

private struct GreetingCard: View {
    let greeting: String
    let avatarURL: URL?

    var body: some View {
        Text(greeting)
            .font(.rounded(27))
            .lineSpacing(-2.7)
            .foregroundStyle(Theme.palette.text)
            .frame(maxWidth: 240, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 24)
            .padding(.top, 89)
            .padding(.bottom, 24)
            .background(.white, in: RoundedRectangle(cornerRadius: 36, style: .continuous))
            .overlay(alignment: .topLeading) {
                AvatarImage(url: avatarURL, size: 190)
                    .offset(x: -13, y: -99)
            }
            .padding(.top, 32)
    }
}

private struct CelebrateCard: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 20) {
                AnimatedFire()
                    .frame(width: 60, height: 60)
                    .frame(width: 86, height: 101)
                    .background(Theme.palette.strongDeep, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                Text("Your points have been approved! Nice work. Let's celebrate!")
                    .font(.rounded(16))
                    .lineSpacing(3)
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: 175, alignment: .leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Image("IconChunkyArrow")
                    .resizable()
                    .frame(width: 32, height: 32)
                    .foregroundStyle(.white)
            }
            .padding(24)
            .padding(.trailing, -12)
            .background(Theme.palette.strong, in: RoundedRectangle(cornerRadius: 36, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

/// "This week's streak": a pill per day — ✓ done, ✗ missed, grey for a rest
/// day — and how many tasks are left today.
private struct StreakWeekCard: View {
    let streak: StreakInfo
    let week: [StreakDay]
    let items: [ChecklistItem]
    let openTasks: () -> Void

    private var label: String {
        let left = items.filter { $0.state == .open }.count
        if items.isEmpty { return "No tasks today" }
        if left == 0 { return "All done today! 🎉" }
        return "\(left) Task\(left == 1 ? "" : "s") To Do Today"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("This week's streak")
                .font(.rounded(18))
                .foregroundStyle(Theme.palette.text)
            HStack(spacing: 8) {
                ForEach(week, id: \.day) { pill($0) }
            }
            .padding(.top, 18)
            .padding(.bottom, 10)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(streak.name): \(week.filter { $0.state == .done }.count) days done this week")
            Button(action: openTasks) {
                Text(label)
                    .font(.rounded(16))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Theme.palette.strong, in: Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 24)
        .padding(.top, 28)
        .padding(.bottom, 24)
        .background(.white, in: RoundedRectangle(cornerRadius: 36, style: .continuous))
    }

    private func pill(_ day: StreakDay) -> some View {
        let rest = day.state == .rest
        return ZStack(alignment: rest ? .center : .bottom) {
            Capsule().fill(rest ? Color(hex: 0xF1F1F1) : Theme.palette.track)
            if day.state == .today {
                Capsule().strokeBorder(Theme.palette.strong.opacity(0.5), lineWidth: 2)
            }
            Text(letter(day.day))
                .font(.rounded(18))
                .foregroundStyle(rest ? Color(hex: 0xBDBDBD) : Theme.palette.text)
                .padding(.bottom, rest ? 0 : 10)
        }
        .overlay(alignment: .top) {
            switch day.state {
            case .done:
                Image("IconCheckmark").resizable().frame(width: 20, height: 20)
                    .foregroundStyle(Theme.palette.strong).padding(.top, 4)
            case .missed:
                Image("IconNope").resizable().frame(width: 20, height: 20).padding(.top, 4)
            default: EmptyView()
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: 70)
    }

    /// "m", "t", "w"… for a YYYY-MM-DD day.
    private func letter(_ day: String) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(identifier: "UTC")
        guard let date = f.date(from: day) else { return "" }
        f.dateFormat = "EEEEE"
        f.locale = Locale(identifier: "en_US")
        return f.string(from: date).lowercased()
    }
}

/// Their points, the ring filling toward the next milestone; then how far
/// toward the goal itself. With both a next milestone and a goal, the two
/// cards hand over as the kid scrolls (GoalModule), like the web.
private struct GoalRingCard: View {
    let today: TodayResponse
    let pageEnd: CGFloat

    var body: some View {
        let progress = today.progress
        let next = today.milestones.first { $0.points > progress }
        let prev = today.milestones.last { $0.points <= progress }?.points ?? 0
        let goalPct = today.goal.map { pct(Double(progress) / Double(max(1, $0.targetPoints))) } ?? 0

        if let next, let goal = today.goal {
            GoalModule(
                milestone: .init(
                    pct: pct(Double(progress - prev) / Double(max(1, next.points - prev))),
                    caption: "Towards your next milestone", points: progress, label: next.name, emoji: next.emoji),
                goal: .init(pct: goalPct, caption: "Towards \(goal.name)", points: progress, label: goal.name, emoji: goal.emoji),
                pageEnd: pageEnd
            )
        } else {
            let ring: (pct: Int, label: String, caption: String, emoji: String?) =
                if let goal = today.goal { (goalPct, goal.name, "Towards \(goal.name)", goal.emoji) } else { (0, "points", "", nil) }
            VStack(spacing: 0) {
                Ring(pct: ring.pct, points: progress, label: ring.label, emoji: ring.emoji)
                    .frame(width: 262)
                    .padding(.top, 46)
                if ring.caption.isEmpty {
                    Spacer().frame(height: 46)
                } else {
                    GoalRow(pct: ring.pct, caption: ring.caption).frame(height: GoalModule.rowOpen)
                }
            }
            .frame(maxWidth: .infinity)
            .background(.white, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
            .padding(24)
            .background(Theme.palette.panel, in: RoundedRectangle(cornerRadius: 36, style: .continuous))
        }
    }

    private func pct(_ x: Double) -> Int { max(0, min(100, Int((x * 100).rounded()))) }
}

/// "79%    Towards your next milestone"
private struct GoalRow: View {
    let pct: Int
    let caption: String

    var body: some View {
        HStack {
            Text("\(pct)%").font(.rounded(37)).foregroundStyle(Theme.palette.textStrong)
            Spacer()
            Text(caption)
                .font(.rounded(14))
                .foregroundStyle(Theme.palette.textStrong)
                .multilineTextAlignment(.trailing)
        }
        .padding(.horizontal, 19)
    }
}

/// The goal module: two cards — the next milestone and the big goal. One is
/// open (white, a big ring above its row) and the other is just its row.
/// Scrolling down hands over from the milestone to the goal; tapping the
/// closed one opens it. They always add up to the same height, so nothing
/// jumps. Same as the web's GoalModule.
///
/// The hand-over only starts once the whole module is in view (above the tab
/// bar), then runs over the next `handover` points of scrolling (or what's
/// left of the page, if that's less). A page too short to scroll it is
/// tap-only.
private struct GoalModule: View {
    struct Card {
        let pct: Int
        let caption: String
        let points: Int
        let label: String
        let emoji: String?
    }

    let milestone: Card
    let goal: Card
    let pageEnd: CGFloat // where the page's content ends, on screen
    @State private var p: Double = 0 // 0: milestone open … 1: goal open
    @State private var bottom: CGFloat = 0 // the module's bottom, on screen
    @State private var tappedAt: CGFloat? // where the module was when a card was tapped

    static let ringArea: CGFloat = 310
    static let rowOpen: CGFloat = 85
    static let rowClosed: CGFloat = 98
    private static let handover: CGFloat = 260 // points of scrolling the hand-over takes
    private static let tabBarZone: CGFloat = 110 // the bottom of the screen the tab bar covers
    private static let pagePadding: CGFloat = 110 // the room under the content (KidAppView.page)
    private static var screenHeight: CGFloat {
        (UIApplication.shared.connectedScenes.first as? UIWindowScene)?.screen.bounds.height ?? 874
    }

    var body: some View {
        let e = p * p * (3 - 2 * p) // smoothstep
        VStack(spacing: 2) {
            panel(milestone, openness: 1 - e) { open(0) }
            panel(goal, openness: e) { open(1) }
        }
        .padding(24)
        .background(Theme.palette.panel, in: RoundedRectangle(cornerRadius: 36, style: .continuous))
        .onGeometryChange(for: CGFloat.self) { $0.frame(in: .global).maxY } action: { y in
            bottom = y
            update()
        }
        .onChange(of: pageEnd) { update() }
    }

    private func update() {
        // How far past "all in view" the module has scrolled, and how much
        // scrolling the page has in all from there.
        let s = Self.screenHeight - Self.tabBarZone - bottom
        let left = max(0, pageEnd + Self.pagePadding - Self.screenHeight)
        let room = min(Self.handover, max(0, s) + left)
        guard room >= 40 else { return }
        if let tapped = tappedAt {
            if abs(bottom - tapped) < 40 { return } // a tap's choice holds until they scroll on
            tappedAt = nil
        }
        p = max(0, min(1, s / room))
    }

    private func drawOn(_ o: Double) -> Double {
        let d = max(0, min(1, (o - 0.3) / 0.7))
        return d * d * (3 - 2 * d)
    }

    private func open(_ target: Double) {
        tappedAt = bottom
        withAnimation(.easeInOut(duration: 0.38)) { p = target }
    }

    private func panel(_ card: Card, openness o: Double, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 0) {
                // The ring draws on (round from the bottom) as the card
                // opens, rather than growing.
                Ring(pct: card.pct, points: card.points, label: card.label, emoji: card.emoji, draw: drawOn(o))
                    .frame(width: 262)
                    .padding(.top, 46)
                    .opacity(max(0, min(1, (o - 0.12) * 2.2)))
                    .frame(maxWidth: .infinity)
                    .frame(height: Self.ringArea * o, alignment: .top)
                    .clipped()
                GoalRow(pct: card.pct, caption: card.caption)
                    .frame(height: Self.rowClosed + (Self.rowOpen - Self.rowClosed) * o)
            }
            .background(
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .fill(Theme.palette.panelSoft)
                    .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).fill(.white.opacity(o)))
            )
            .contentShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(o > 0.5 ? .isSelected : [])
    }
}

/// A thick ring with rounded ends, starting at the bottom: the dark part is
/// what they've earned, then a little gap, then the paler rest still to go
/// (as on the web). It draws on clockwise — the dark part sweeps round with
/// the milestone's (or goal's) emoji riding its front, then the pale part
/// follows — the first time it's mostly on screen. `draw` (0–1) holds it
/// part-drawn, for the goal module's hand-over.
private struct Ring: View {
    let pct: Int
    let points: Int
    let label: String
    var emoji: String? = nil
    var draw: Double = 1
    @State private var intro: Double = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geo in
            let size = min(geo.size.width, geo.size.height)
            ZStack {
                RingArcs(pct: pct, emoji: emoji, size: size, progress: intro * draw)
                VStack(spacing: 6) {
                    Text(points.formatted())
                        .font(.rounded(64))
                        .foregroundStyle(Theme.palette.text)
                        .monospacedDigit()
                    Text(label)
                        .font(.rounded(14))
                        .foregroundStyle(Theme.palette.text)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, 32)
            }
            .frame(width: size, height: size)
            .frame(maxWidth: .infinity)
        }
        .aspectRatio(1, contentMode: .fit)
        .frame(maxWidth: 280)
        // Draw on once it's mostly on screen (above the tab bar).
        .onGeometryChange(for: Bool.self) { proxy in
            let f = proxy.frame(in: .global)
            let screen = (UIApplication.shared.connectedScenes.first as? UIWindowScene)?.screen.bounds.height ?? 874
            return f.height > 0 && f.minY + f.height * 0.6 < screen - 110 && f.maxY - f.height * 0.6 > 0
        } action: { visible in
            guard visible, intro == 0 else { return }
            if reduceMotion { intro = 1 } else { withAnimation(.easeOut(duration: 1.2)) { intro = 1 } }
        }
    }
}

/// The ring's two arcs and the emoji, `progress` (0–1) of the way round —
/// animatable, so the emoji rides the front as it draws on.
private struct RingArcs: View, Animatable {
    let pct: Int
    let emoji: String?
    let size: CGFloat
    var progress: Double

    var animatableData: Double {
        get { progress }
        set { progress = newValue }
    }

    var body: some View {
        let stroke = size * 24 / 280
        let gap = (pct > 0 && pct < 100) ? 0.0343 : 0 // room for the round ends, as a fraction
        let filled = max(0, Double(pct) / 100 - gap / 2)
        let sweep = max(0, min(1, progress))
        let shownFilled = min(filled, sweep)
        let restTo = min(1 - gap, sweep)
        let r = (size - stroke) / 2
        let tip = Double.pi / 2 + 2 * Double.pi * shownFilled // clockwise from the bottom
        ZStack {
            ZStack {
                if restTo > filled + gap + 0.002 {
                    Circle()
                        .trim(from: filled + gap, to: restTo)
                        .stroke(Theme.palette.track, style: StrokeStyle(lineWidth: stroke, lineCap: .round))
                }
                if shownFilled > 0.002 {
                    Circle()
                        .trim(from: 0, to: shownFilled)
                        .stroke(Theme.palette.strong, style: StrokeStyle(lineWidth: stroke, lineCap: .round))
                }
            }
            .padding(stroke / 2)
            .rotationEffect(.degrees(90)) // start at the bottom
            if let emoji, !emoji.isEmpty, sweep > 0 {
                Text(emoji)
                    .font(.system(size: 38))
                    .position(x: size / 2 + r * cos(tip), y: size / 2 + r * sin(tip))
                    .accessibilityHidden(true)
            }
        }
        .frame(width: size, height: size)
    }
}

/// "Arcade Tickets": how many they have, and what the arcade is up to —
/// closed (no tickets), locked (no streak going), open, or the game they're
/// in the middle of. Tapping it opens the Arcade tab. The scalloped ticket
/// is the exported shape (TicketShape, public/ui/TicketShapeUI.svg).
private struct TicketCard: View {
    let arcade: ArcadeInfo
    let artURL: URL?
    let open: () -> Void

    var body: some View {
        Button(action: open) {
            VStack(alignment: .leading, spacing: 0) {
                Text("Arcade Tickets")
                    .font(.rounded(18))
                    .foregroundStyle(Theme.palette.text)
                    .frame(height: 24)
                line.padding(.top, 16)
                Text("\(arcade.tickets)")
                    .font(.rounded(68))
                    .monospacedDigit()
                    .foregroundStyle(Theme.palette.textStrong)
                    .frame(height: 117)
                line
                HStack(spacing: 12) {
                    Text("Arcade is currently")
                        .font(.rounded(18))
                        .foregroundStyle(Theme.palette.text)
                        .lineLimit(1)
                        .fixedSize()
                    Spacer(minLength: 0)
                    status
                        .font(.rounded(15))
                        .foregroundStyle(Theme.palette.text)
                        .lineLimit(1)
                        .padding(.horizontal, 16)
                        .frame(minWidth: 141)
                        .frame(height: 37)
                        .background(.white, in: Capsule())
                }
                .frame(height: 63)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 24)
            .padding(.top, 38)
            .frame(maxWidth: .infinity, alignment: .leading)
            .aspectRatio(370 / 282.4, contentMode: .fit)
            .background(Image("TicketShape").resizable().foregroundStyle(Theme.palette.panel))
        }
        .buttonStyle(.plain)
    }

    private var line: some View {
        Rectangle().fill(Theme.palette.strong.opacity(0.6)).frame(height: 1)
    }

    /// The game's 3D icon (the one being played, or a random one) and what
    /// the arcade is up to.
    private var status: some View {
        HStack(spacing: 6) {
            if let artURL {
                AsyncImage(url: artURL) { $0.resizable().scaledToFit() } placeholder: { Color.clear }
                    .frame(width: 34, height: 34)
                    .padding(.vertical, -8)
            } else if let icon = arcade.playing?.icon {
                Text(icon)
            }
            Text(label)
        }
    }

    private var label: String {
        if let playing = arcade.playing { return playing.name ?? playing.game }
        if arcade.tickets == 0 { return "Closed" }
        if arcade.mode == "locked" { return "Locked 🔒" }
        if arcade.mode == "pick" { return "Open · you pick!" }
        return "Open"
    }
}
