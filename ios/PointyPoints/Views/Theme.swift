import SwiftUI

/// Brand colors from the web app's Tailwind classes.
enum Theme {
    static let orange = Color(hex: 0xF2662A)
    static let rust = Color(hex: 0xB64B11)
    static let cream = Color(hex: 0xFFF2E9)
    static let peach = Color(hex: 0xF1D1BD)
    static let sand = Color(hex: 0xC3A38A)
    static let divider = Color(hex: 0xF9EBE3)

    static let pendingBackground = Color(hex: 0xFEF3C7)
    static let pendingText = Color(hex: 0x92400E)
    static let pendingDot = Color(hex: 0xF59E0B)
    static let approvedBackground = Color(hex: 0xD1FAE5)
    static let approvedText = Color(hex: 0x065F46)
    static let approvedDot = Color(hex: 0x10B981)
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

extension Font {
    static func rounded(_ size: CGFloat, _ weight: Font.Weight = .medium) -> Font {
        .system(size: size, weight: weight, design: .rounded)
    }
}

/// White rounded card used for every section, like the web view.
struct Card<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.white, in: RoundedRectangle(cornerRadius: 32, style: .continuous))
            .shadow(color: .black.opacity(0.04), radius: 4, y: 1)
    }
}

/// Server-hosted avatar image with a soft placeholder.
struct AvatarImage: View {
    let url: URL?
    var size: CGFloat = 96

    var body: some View {
        AsyncImage(url: url) { image in
            image.resizable().scaledToFit()
        } placeholder: {
            Circle().fill(Theme.peach.opacity(0.5))
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}
