import SwiftUI

/// "Did something extra?" — kid describes it, a parent sets the points.
struct ProposalCard: View {
    let pending: [Proposal]

    @Environment(AppModel.self) private var model
    @State private var text = ""
    @FocusState private var focused: Bool

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                Text("Did something extra?")
                    .font(.rounded(18, .semibold))
                    .foregroundStyle(Theme.rust)

                HStack(spacing: 8) {
                    TextField("I helped with…", text: $text)
                        .focused($focused)
                        .submitLabel(.send)
                        .onSubmit(submit)
                        .padding(12)
                        .background(Theme.cream, in: RoundedRectangle(cornerRadius: 14))
                    Button("Send", action: submit)
                        .buttonStyle(OutlinePill())
                        .disabled(text.trimmingCharacters(in: .whitespaces).isEmpty)
                }

                ForEach(pending) { proposal in
                    HStack {
                        Text(proposal.name)
                            .font(.rounded(14))
                            .foregroundStyle(Theme.rust)
                        Spacer()
                        Text("Waiting for a parent")
                            .font(.rounded(12, .semibold))
                            .foregroundStyle(Theme.pendingText)
                        Button {
                            Task { await model.cancelProposal(proposal) }
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(Theme.sand)
                        }
                        .accessibilityLabel("Cancel \(proposal.name)")
                    }
                    .padding(10)
                    .background(Theme.pendingBackground.opacity(0.6), in: RoundedRectangle(cornerRadius: 12))
                }
            }
        }
    }

    private func submit() {
        let name = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        Task {
            if await model.submitProposal(name) {
                text = ""
                focused = false
            }
        }
    }
}
