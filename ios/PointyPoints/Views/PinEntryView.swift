import SwiftUI

/// Big friendly number pad. PINs are 4–8 digits, so there's an explicit Go key.
struct PinEntryView: View {
    let kid: KidSummary

    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var pin = ""
    @State private var shakes = 0

    private let maxLength = 8
    private let keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "Go"]

    var body: some View {
        VStack(spacing: 24) {
            AvatarImage(url: model.link?.resolve(kid.avatarUrl), size: 110)
                .padding(.top, 32)

            Text("Hi \(kid.name)! Enter your PIN")
                .font(.rounded(22, .semibold))
                .foregroundStyle(Theme.orange)

            HStack(spacing: 14) {
                ForEach(0..<max(4, pin.count), id: \.self) { i in
                    Circle()
                        .fill(i < pin.count ? Theme.orange : Theme.peach)
                        .frame(width: 16, height: 16)
                }
            }
            .modifier(Shake(count: shakes))
            .accessibilityLabel("\(pin.count) digits entered")

            if let error = model.errorMessage {
                ErrorBanner(message: error).padding(.horizontal, 32)
            }

            LazyVGrid(columns: Array(repeating: GridItem(.fixed(84), spacing: 18), count: 3), spacing: 18) {
                ForEach(keys, id: \.self) { key in
                    Button { tap(key) } label: {
                        Text(key)
                            .font(.rounded(key == "Go" ? 22 : 30, .semibold))
                            .frame(width: 84, height: 84)
                            .background(key == "Go" ? Theme.orange : .white, in: Circle())
                            .foregroundStyle(key == "Go" ? .white : Theme.orange)
                    }
                    .disabled(model.isLoading || (key == "Go" && pin.count < 4))
                    .opacity(key == "Go" && pin.count < 4 ? 0.4 : 1)
                    .accessibilityLabel(key == "⌫" ? "Delete" : key)
                }
            }

            Spacer()
        }
        .frame(maxWidth: .infinity)
        .background(Theme.cream.ignoresSafeArea())
        .sensoryFeedback(.error, trigger: shakes)
        .onAppear { model.errorMessage = nil }
    }

    private func tap(_ key: String) {
        switch key {
        case "⌫":
            if !pin.isEmpty { pin.removeLast() }
        case "Go":
            submit()
        default:
            if pin.count < maxLength { pin.append(key) }
        }
    }

    private func submit() {
        let attempt = pin
        Task {
            if await model.signIn(kid: kid, pin: attempt) {
                dismiss()
            } else {
                pin = ""
                withAnimation(.default) { shakes += 1 }
            }
        }
    }
}

/// Horizontal wiggle for a wrong PIN.
private struct Shake: GeometryEffect {
    var count: Int
    var animatableData: CGFloat

    init(count: Int) {
        self.count = count
        animatableData = CGFloat(count)
    }

    func effectValue(size: CGSize) -> ProjectionTransform {
        ProjectionTransform(CGAffineTransform(translationX: 10 * sin(animatableData * .pi * 4), y: 0))
    }
}
