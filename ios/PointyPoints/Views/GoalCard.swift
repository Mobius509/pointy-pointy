import SwiftUI

/// Progress toward the kid's active goal, with milestone dots on the bar.
struct GoalCard: View {
    let goal: Goal
    let progress: Int
    let milestones: [Milestone]

    private var fraction: Double {
        min(1, Double(progress) / Double(max(1, goal.targetPoints)))
    }

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 12) {
                    Image(systemName: "pawprint.fill")
                        .font(.system(size: 26))
                        .foregroundStyle(Theme.orange)
                        .accessibilityHidden(true)
                    Text(goal.name)
                        .font(.rounded(16, .medium))
                        .foregroundStyle(Theme.rust)
                    Spacer()
                    Text(goal.targetPoints.formatted())
                        .font(.rounded(16, .medium))
                        .foregroundStyle(Theme.orange)
                        .monospacedDigit()
                }

                bar

                HStack {
                    Text("\(Int((fraction * 100).rounded()))% There")
                    Spacer()
                    Text("\(max(0, goal.targetPoints - progress).formatted()) points to go")
                }
                .font(.rounded(12, .semibold))
                .foregroundStyle(Theme.orange)
                .monospacedDigit()

                if !milestones.isEmpty {
                    milestoneList
                }
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var bar: some View {
        GeometryReader { geo in
            let inner = geo.size.width - 8
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.peach)

                Capsule()
                    .fill(Theme.orange)
                    .frame(width: max(48, inner * fraction), height: 24)
                    .overlay {
                        Text(progress.formatted())
                            .font(.rounded(12, .semibold))
                            .foregroundStyle(.white)
                            .monospacedDigit()
                    }
                    .padding(.leading, 4)
                    .animation(.easeOut(duration: 0.5), value: progress)

                ForEach(milestones) { m in
                    let unlocked = progress >= m.points
                    let x = 4 + inner * min(1, Double(m.points) / Double(max(1, goal.targetPoints)))
                    Circle()
                        .fill(unlocked ? .white : Theme.orange.opacity(0.4))
                        .overlay { if unlocked { Circle().stroke(Theme.orange, lineWidth: 2) } }
                        .frame(width: unlocked ? 10 : 6, height: unlocked ? 10 : 6)
                        .position(x: x, y: 16)
                }
            }
        }
        .frame(height: 32)
    }

    private var milestoneList: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(milestones) { m in
                let unlocked = progress >= m.points
                HStack {
                    Image(systemName: unlocked ? "star.fill" : "star")
                    Text(m.name)
                    Spacer()
                    Text("\(m.points.formatted()) pts").monospacedDigit()
                }
                .font(.rounded(13, unlocked ? .semibold : .medium))
                .foregroundStyle(unlocked ? Theme.orange : Theme.sand)
            }
        }
        .padding(.top, 4)
    }
}
