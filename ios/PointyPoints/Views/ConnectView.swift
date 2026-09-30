import SwiftUI

/// First launch: paste the family link a parent copied from the web app.
struct ConnectView: View {
    @Environment(AppModel.self) private var model
    @State private var linkText = ""

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Text("Pointy Points")
                .font(.rounded(36, .bold))
                .foregroundStyle(Theme.orange)

            Card {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Paste your family link")
                        .font(.rounded(18, .semibold))
                        .foregroundStyle(Theme.rust)
                    Text("Ask a parent to copy it from the Kids section of their Pointy Points account.")
                        .font(.rounded(14))
                        .foregroundStyle(Theme.sand)

                    TextField("https://…/h/…", text: $linkText)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                        .submitLabel(.go)
                        .onSubmit(connect)
                        .padding(12)
                        .background(Theme.cream, in: RoundedRectangle(cornerRadius: 14))

                    if let error = model.errorMessage {
                        ErrorBanner(message: error)
                    }

                    PrimaryButton(title: "Continue", isLoading: model.isLoading, action: connect)
                        .disabled(linkText.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }

            Spacer()
            Spacer()
        }
        .padding(24)
        .frame(maxWidth: 520)
    }

    private func connect() {
        Task { await model.connect(to: linkText) }
    }
}

struct PrimaryButton: View {
    let title: String
    var isLoading = false
    let action: () -> Void

    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        Button(action: action) {
            ZStack {
                Text(title).opacity(isLoading ? 0 : 1)
                if isLoading { ProgressView().tint(.white) }
            }
            .font(.rounded(17, .semibold))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Theme.orange, in: Capsule())
            .foregroundStyle(.white)
            .opacity(isEnabled || isLoading ? 1 : 0.4)
        }
        .disabled(isLoading)
    }
}

struct ErrorBanner: View {
    let message: String

    var body: some View {
        Text(message)
            .font(.rounded(14))
            .foregroundStyle(Color(hex: 0x9F1239))
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(hex: 0xFFF1F2), in: RoundedRectangle(cornerRadius: 12))
    }
}
