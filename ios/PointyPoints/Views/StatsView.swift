import SwiftUI
import UIKit

/// The kid app's home (Stats): greeting with the avatar, "let's celebrate"
/// when approvals are waiting, this week's streak, and the goal ring.
/// Mirrors the web's KidStats (src/app/h/[slug]/_components/KidStats.tsx).
struct StatsView: View {
    @Environment(AppModel.self) private var model
    var openTasks: () -> Void

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
                GoalRingCard(today: today)
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
            .font(.rounded(33))
            .lineSpacing(-2)
            .foregroundStyle(Theme.palette.strong)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 28)
            .padding(.top, 72)
            .padding(.bottom, 28)
            .background(Theme.palette.card, in: RoundedRectangle(cornerRadius: 32, style: .continuous))
            .overlay(alignment: .topLeading) {
                AvatarImage(url: avatarURL, size: 150)
                    .offset(x: 20, y: -96)
            }
            .padding(.top, 88)
    }
}

private struct CelebrateCard: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 16) {
                AnimatedFire()
                    .frame(width: 58, height: 58)
                    .frame(width: 75, height: 75)
                    .background(Theme.palette.strongDeep, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                Text("Your points have been approved! Nice work. Let's celebrate!")
                    .font(.rounded(17))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Image("IconChunkyArrow")
                    .resizable()
                    .frame(width: 24, height: 24)
                    .foregroundStyle(.white)
            }
            .padding(14)
            .padding(.trailing, 6)
            .background(Theme.palette.strong, in: RoundedRectangle(cornerRadius: 32, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

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
        VStack(alignment: .leading, spacing: 16) {
            Text("This week's streak")
                .font(.rounded(17))
                .foregroundStyle(Theme.palette.strong)
            HStack(spacing: 16) {
                ForEach(week, id: \.day) { day in dot(day.state) }
            }
            .frame(maxWidth: .infinity)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(streak.name): \(week.filter { $0.state == .done }.count) days done this week")
            Button(action: openTasks) {
                Text(label)
                    .font(.rounded(15))
                    .foregroundStyle(Theme.palette.text)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(.white, in: Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 28)
        .padding(.vertical, 20)
        .background(Theme.palette.card, in: RoundedRectangle(cornerRadius: 32, style: .continuous))
    }

    @ViewBuilder private func dot(_ state: StreakDay.State) -> some View {
        switch state {
        case .done:
            Circle().fill(Theme.palette.text).overlay(Circle().inset(by: 1.5).stroke(.white, lineWidth: 3)).frame(width: 40, height: 40)
        case .today:
            Circle().fill(.white).overlay(Circle().inset(by: 1).stroke(Theme.palette.strong, lineWidth: 2)).frame(width: 40, height: 40)
        case .missed:
            Circle().fill(.white.opacity(0.5)).frame(width: 40, height: 40)
        case .upcoming:
            Circle().fill(.white).frame(width: 40, height: 40)
        }
    }
}

/// Their points, the ring filling toward the next milestone; then how far
/// toward the goal itself. With both a next milestone and a goal, the two
/// cards hand over as the kid scrolls (GoalModule), like the web.
private struct GoalRingCard: View {
    let today: TodayResponse

    var body: some View {
        let progress = today.progress
        let next = today.milestones.first { $0.points > progress }
        let prev = today.milestones.last { $0.points <= progress }?.points ?? 0
        let goalPct = today.goal.map { pct(Double(progress) / Double(max(1, $0.targetPoints))) } ?? 0

        if let next, let goal = today.goal {
            GoalModule(
                milestone: .init(
                    pct: pct(Double(progress - prev) / Double(max(1, next.points - prev))),
                    caption: "Towards your next milestone", points: progress, label: next.name),
                goal: .init(pct: goalPct, caption: "Towards \(goal.name)", points: progress, label: goal.name)
            )
        } else {
            let ring: (pct: Int, label: String, caption: String) =
                if let goal = today.goal { (goalPct, goal.name, "Towards \(goal.name)") } else { (0, "points", "") }
            VStack(spacing: 16) {
                Ring(pct: ring.pct, points: progress, label: ring.label)
                if !ring.caption.isEmpty { GoalRow(pct: ring.pct, caption: ring.caption) }
            }
            .padding(.horizontal, 20)
            .padding(.top, 28)
            .padding(.bottom, 24)
            .background(.white, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
            .padding(18)
            .background(Theme.palette.card, in: RoundedRectangle(cornerRadius: 36, style: .continuous))
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
            Text("\(pct)%").font(.rounded(34)).foregroundStyle(Theme.palette.textStrong)
            Spacer()
            Text(caption)
                .font(.rounded(13))
                .foregroundStyle(Theme.palette.textStrong)
                .multilineTextAlignment(.trailing)
        }
    }
}

/// The bottom of Stats: two cards — the next milestone and the big goal. One
/// is open (white, a big ring above its row) and the other is just its row.
/// Scrolling down hands over from the milestone to the goal; tapping the
/// closed one opens it. They always add up to the same height, so nothing
/// jumps. Same as the web's GoalModule.
private struct GoalModule: View {
    struct Card {
        let pct: Int
        let caption: String
        let points: Int
        let label: String
    }

    let milestone: Card
    let goal: Card
    @State private var p: Double = 0 // 0: milestone open … 1: goal open
    @State private var top: CGFloat = 0
    @State private var tappedAt: CGFloat? // where the module was when a card was tapped

    private static let ringArea: CGFloat = 300
    private static var screenHeight: CGFloat {
        (UIApplication.shared.connectedScenes.first as? UIWindowScene)?.screen.bounds.height ?? 874
    }

    var body: some View {
        let e = p * p * (3 - 2 * p) // smoothstep
        VStack(spacing: 14) {
            panel(milestone, openness: 1 - e, closed: Theme.palette.cardInner) { open(0) }
            panel(goal, openness: e, closed: Theme.palette.cardSoft) { open(1) }
        }
        .padding(18)
        .background(Theme.palette.card, in: RoundedRectangle(cornerRadius: 36, style: .continuous))
        .onGeometryChange(for: CGFloat.self) { $0.frame(in: .global).minY } action: { y in
            top = y
            if let tapped = tappedAt {
                if abs(y - tapped) < 40 { return } // a tap's choice holds until they scroll on
                tappedAt = nil
            }
            // The hand-over: as the module's top climbs from 75% of the
            // screen to 35%.
            let vh = Self.screenHeight
            p = max(0, min(1, (vh * 0.75 - y) / (vh * 0.4)))
        }
    }

    private func open(_ target: Double) {
        tappedAt = top
        withAnimation(.easeInOut(duration: 0.38)) { p = target }
    }

    private func panel(_ card: Card, openness o: Double, closed: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 0) {
                Ring(pct: card.pct, points: card.points, label: card.label)
                    .frame(width: 260)
                    .scaleEffect(0.35 + 0.65 * o, anchor: .top)
                    .padding(.top, 28)
                    .opacity(max(0, min(1, (o - 0.12) * 2.2)))
                    .frame(maxWidth: .infinity)
                    .frame(height: Self.ringArea * o, alignment: .top)
                    .clipped()
                GoalRow(pct: card.pct, caption: card.caption)
                    .padding(.horizontal, 24)
                    .frame(height: 84)
            }
            .background(
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .fill(closed)
                    .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).fill(.white.opacity(o)))
            )
            .contentShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(o > 0.5 ? .isSelected : [])
    }
}

/// A thick ring with rounded ends: the filled part, a little gap, then the
/// rest in a paler color (as on the web).
private struct Ring: View {
    let pct: Int
    let points: Int
    let label: String

    var body: some View {
        GeometryReader { geo in
            let size = min(geo.size.width, geo.size.height)
            let stroke = size * 0.1
            let gap = (pct > 0 && pct < 100) ? 0.035 : 0 // room for the round ends, as a fraction
            let filled = max(0, Double(pct) / 100 - gap / 2)
            ZStack {
                ZStack {
                    if filled + gap < 1 {
                        Circle()
                            .trim(from: filled + gap, to: 1 - gap)
                            .stroke(Theme.palette.track, style: StrokeStyle(lineWidth: stroke, lineCap: .round))
                    }
                    if filled > 0 {
                        Circle()
                            .trim(from: 0, to: filled)
                            .stroke(Theme.palette.strong, style: StrokeStyle(lineWidth: stroke, lineCap: .round))
                    }
                }
                .padding(stroke / 2)
                .rotationEffect(.degrees(-90)) // start at the top
                VStack(spacing: 4) {
                    Text(points.formatted())
                        .font(.rounded(64))
                        .foregroundStyle(Theme.palette.text)
                        .monospacedDigit()
                    Text(label)
                        .font(.rounded(12))
                        .foregroundStyle(Theme.palette.text)
                        .multilineTextAlignment(.center)
                }
            }
            .frame(width: size, height: size)
            .frame(maxWidth: .infinity)
        }
        .aspectRatio(1, contentMode: .fit)
        .frame(maxWidth: 280)
    }
}
