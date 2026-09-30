import SwiftUI

struct ChecklistView: View {
    let items: [ChecklistItem]

    var body: some View {
        if items.isEmpty {
            Text("No daily tasks yet — ask a parent to add some!")
                .font(.rounded(14).italic())
                .foregroundStyle(Theme.sand)
        } else {
            VStack(spacing: 0) {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                    if index > 0 { Divider().overlay(Theme.divider) }
                    ChecklistRow(item: item)
                }
            }
        }
    }
}

private struct ChecklistRow: View {
    let item: ChecklistItem
    @Environment(AppModel.self) private var model

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(item.name)
                    .font(.rounded(16, .semibold))
                    .foregroundStyle(Theme.rust)
                if let description = item.description, !description.isEmpty {
                    Text(description)
                        .font(.rounded(13))
                        .foregroundStyle(Theme.sand)
                }
                HStack(spacing: 6) {
                    Text("+\(item.points) pts")
                    if let label = item.frequencyLabel { Text("· \(label)") }
                }
                .font(.rounded(12, .semibold))
                .foregroundStyle(Theme.orange)
            }

            Spacer(minLength: 8)

            actions
        }
        .padding(.vertical, 12)
        .sensoryFeedback(.success, trigger: item.state == .pending)
    }

    @ViewBuilder private var actions: some View {
        switch item.state {
        case .open:
            Button("Done") { Task { await model.complete(item) } }
                .buttonStyle(OutlinePill())

        case .pending:
            Button { Task { await model.cancelPending(item) } } label: {
                StatusPill(text: "Pending", systemImage: "ellipsis",
                           background: Theme.pendingBackground,
                           foreground: Theme.pendingText,
                           dot: Theme.pendingDot)
            }
            .accessibilityHint("Tap to cancel")

        case .approved:
            HStack(spacing: 6) {
                Button("Recall") { Task { await model.recall(item) } }
                    .buttonStyle(OutlinePill())
                StatusPill(text: "Approved!", systemImage: "checkmark",
                           background: Theme.approvedBackground,
                           foreground: Theme.approvedText,
                           dot: Theme.approvedDot)
            }
        }
    }
}

private struct StatusPill: View {
    let text: String
    let systemImage: String
    let background: Color
    let foreground: Color
    let dot: Color

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: systemImage)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 20, height: 20)
                .background(dot, in: Circle())
            Text(text)
        }
        .font(.rounded(14, .semibold))
        .foregroundStyle(foreground)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(background, in: Capsule())
    }
}

struct OutlinePill: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.rounded(14, .semibold))
            .foregroundStyle(Theme.orange)
            .padding(.horizontal, 18)
            .padding(.vertical, 8)
            .background(configuration.isPressed ? Theme.cream : .white, in: Capsule())
            .overlay(Capsule().stroke(Theme.peach))
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
    }
}
