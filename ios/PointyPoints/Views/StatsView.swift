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
                Text("🔥")
                    .font(.system(size: 42))
                    .frame(width: 75, height: 75)
                    .background(Theme.palette.strongDeep, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                Text("Your points have been approved! Nice work. Let's celebrate!")
                    .font(.rounded(17))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "play.fill").foregroundStyle(.white)
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
/// toward the goal itself.
private struct GoalRingCard: View {
    let today: TodayResponse

    var body: some View {
        let progress = today.progress
        let next = today.milestones.first { $0.points > progress }
        let prev = today.milestones.last { $0.points <= progress }?.points ?? 0
        let goalPct = today.goal.map { pct(Double(progress) / Double(max(1, $0.targetPoints))) } ?? 0
        let ring: (pct: Int, label: String, caption: String) =
            if let next {
                (pct(Double(progress - prev) / Double(max(1, next.points - prev))), next.name, "Towards your next milestone")
            } else if let goal = today.goal {
                (goalPct, goal.name, "Towards \(goal.name)")
            } else {
                (0, "points", "")
            }

        VStack(spacing: 18) {
            VStack(spacing: 16) {
                Ring(pct: ring.pct, points: progress, label: ring.label)
                if !ring.caption.isEmpty {
                    HStack(alignment: .bottom) {
                        Text("\(ring.pct)%").font(.rounded(34)).foregroundStyle(Theme.palette.textStrong)
                        Spacer()
                        Text(ring.caption)
                            .font(.rounded(13))
                            .foregroundStyle(Theme.palette.textStrong)
                            .multilineTextAlignment(.trailing)
                            .padding(.bottom, 4)
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 28)
            .padding(.bottom, 24)
            .background(Theme.palette.cardInner, in: RoundedRectangle(cornerRadius: 28, style: .continuous))

            if let goal = today.goal, next != nil {
                GoalOpenCard(goalName: goal.name, goalPct: goalPct, progress: progress, target: goal.targetPoints)
            }
        }
        .padding(18)
        .background(Theme.palette.card, in: RoundedRectangle(cornerRadius: 36, style: .continuous))
    }

    private func pct(_ x: Double) -> Int { max(0, min(100, Int((x * 100).rounded()))) }
}

/// The goal card at the bottom of Stats: "86% Towards Get a dog" — and as
/// the kid scrolls down to it, it opens up like an accordion into a big ring
/// for the goal itself. Same as the web's GoalOpenCard.
private struct GoalOpenCard: View {
    let goalName: String
    let goalPct: Int
    let progress: Int
    let target: Int
    @State private var open: Double = 0 // 0 closed … 1 open

    private static let closed: CGFloat = 84
    private static let opened: CGFloat = 430
    private static var screenHeight: CGFloat {
        (UIApplication.shared.connectedScenes.first as? UIWindowScene)?.screen.bounds.height ?? 874
    }

    var body: some View {
        let e = open * open * (3 - 2 * open) // smoothstep
        ZStack(alignment: .top) {
            HStack {
                Text("\(goalPct)%").font(.rounded(34)).foregroundStyle(Theme.palette.textStrong)
                Spacer()
                Text("Towards \(goalName)")
                    .font(.rounded(13))
                    .foregroundStyle(Theme.palette.textStrong)
                    .multilineTextAlignment(.trailing)
            }
            .padding(.horizontal, 24)
            .frame(height: Self.closed)
            .opacity(1 - e * 1.6)
            .accessibilityHidden(e > 0.6)

            VStack(spacing: 12) {
                Text("The big goal: \(goalName)")
                    .font(.rounded(17))
                    .foregroundStyle(Theme.palette.strong)
                    .multilineTextAlignment(.center)
                Ring(pct: goalPct, points: progress, label: "of \(target.formatted()) points")
            }
            .padding(.horizontal, 20)
            .padding(.top, 28)
            .opacity(max(0, e * 1.4 - 0.4))
            .scaleEffect(0.85 + 0.15 * e, anchor: .top)
            .accessibilityHidden(e < 0.4)
        }
        .frame(maxWidth: .infinity)
        .frame(height: Self.closed + (Self.opened - Self.closed) * e, alignment: .top)
        .clipped()
        .background(Theme.palette.cardSoft, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        // The open height is kept free underneath from the start, so the
        // page can always scroll far enough for the card to open all the way.
        .frame(height: Self.opened, alignment: .top)
        .onGeometryChange(for: CGFloat.self) { $0.frame(in: .global).minY } action: { top in
            // Opens as its top climbs from the bottom of the screen to 45% up.
            let vh = Self.screenHeight
            open = max(0, min(1, (vh * 0.95 - top) / (vh * 0.5)))
        }
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
