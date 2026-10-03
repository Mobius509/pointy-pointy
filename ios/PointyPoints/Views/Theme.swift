import Observation
import SwiftUI
import UIKit

// MARK: - The kid's palette

/// The kid app's pastel palette, in the kid's own hue. A Swift copy of the
/// web app's src/lib/kid-palette.ts — same numbers, same math, so both apps
/// show exactly the same colors. Change them together (GROUND_RULES.md
/// rule 1).
///
/// Colors are defined in OKLCH (lightness, chroma, hue) so every hue looks
/// equally light; the tone never changes, only the hue the kid picks.
struct KidPalette: Equatable {
    static let baseHue: Double = 304 // the mock's lavender
    static let defaultHue = 304

    /// Each color as it is in the mock — OKLCH lightness, chroma and hue,
    /// sampled exactly (kid-palette.ts KID_TOKENS). A kid's color turns every
    /// hue by the same amount.
    private static let tokens: [String: (l: Double, c: Double, h: Double)] = [
        "page": (0.9161, 0.0484, 323.83), // #F4D9F6 the page behind the cards
        "chip": (0.8734, 0.049, 323.85), // #E6CBE8 round buttons on the page
        "panel": (0.8259, 0.0932, 305.11), // #D4B7F7 goal module, arcade ticket
        "panelSoft": (0.8951, 0.0531, 306.08), // #E5D4F9 a closed card in the goal module
        "track": (0.9312, 0.0386, 307.23), // #EFE2FD ring track, streak day pills
        "strong": (0.6316, 0.2067, 288.92), // #8A6BFC celebrate card, ring, buttons, nav
        "strongDeep": (0.5827, 0.2268, 285.56), // #7658F8 tiles on a strong card
        "text": (0.4871, 0.1933, 302.81), // #7736B7 headings and body text
        "textStrong": (0.4448, 0.2206, 298.94), // #6919B9 big numbers
        "nav": (0.199, 0.0976, 300.0), // #1E033A the dark tab bar
    ]

    let hue: Int
    let page, chip, panel, panelSoft, track, strong, strongDeep, text, textStrong, nav: Color

    init(hue: Int) {
        let h = ((hue % 360) + 360) % 360
        self.hue = h
        func make(_ name: String) -> Color {
            let t = Self.tokens[name]!
            return Self.oklch(t.l, t.c, t.h + Double(h - Self.defaultHue))
        }
        page = make("page")
        chip = make("chip")
        panel = make("panel")
        panelSoft = make("panelSoft")
        track = make("track")
        strong = make("strong")
        strongDeep = make("strongDeep")
        text = make("text")
        textStrong = make("textStrong")
        nav = make("nav")
    }


    // OKLCH → sRGB. A color screens can't show gets its chroma reduced until
    // it fits (keeping lightness and hue) — as on the web.
    static func oklch(_ l: Double, _ c: Double, _ hDeg: Double) -> Color {
        var rgb = linear(l, c, hDeg)
        if !inGamut(rgb) {
            var lo = 0.0, hi = c
            for _ in 0..<24 {
                let mid = (lo + hi) / 2
                if inGamut(linear(l, mid, hDeg)) { lo = mid } else { hi = mid }
            }
            rgb = linear(l, lo, hDeg)
        }
        // Rounded to 8 bits like the web's hex colors.
        let (r, g, b) = (byte(rgb.0), byte(rgb.1), byte(rgb.2))
        return Color(.sRGB, red: r / 255, green: g / 255, blue: b / 255)
    }

    private static func linear(_ L: Double, _ C: Double, _ hDeg: Double) -> (Double, Double, Double) {
        let h = hDeg * .pi / 180
        let a = C * cos(h), b = C * sin(h)
        let l_ = pow(L + 0.3963377774 * a + 0.2158037573 * b, 3)
        let m_ = pow(L - 0.1055613458 * a - 0.0638541728 * b, 3)
        let s_ = pow(L - 0.0894841775 * a - 1.291485548 * b, 3)
        return (
            4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
            -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
            -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_
        )
    }

    private static func inGamut(_ v: (Double, Double, Double)) -> Bool {
        [v.0, v.1, v.2].allSatisfy { $0 >= -0.0001 && $0 <= 1.0001 }
    }

    private static func byte(_ v: Double) -> Double {
        let x = min(1, max(0, v))
        let s = x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055
        return (s * 255).rounded()
    }
}

/// The palette in use — the signed-in kid's color. Views read it through
/// `Theme`, so they redraw when it changes (e.g. sliding the color picker).
@MainActor
@Observable
final class ThemeStore {
    static let shared = ThemeStore()
    var palette = KidPalette(hue: KidPalette.defaultHue)
}

/// App colors. The brand colors follow the kid's palette; the pending /
/// approved status colors stay fixed.
@MainActor
enum Theme {
    static var palette: KidPalette { ThemeStore.shared.palette }

    // Older names, now from the palette.
    static var orange: Color { palette.strong } // headings, buttons
    static var rust: Color { palette.textStrong } // strong text
    static var cream: Color { palette.track } // near-white fills
    static var peach: Color { palette.panelSoft } // soft fills
    static var sand: Color { palette.text.opacity(0.75) } // secondary text
    static var divider: Color { palette.panelSoft }

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

// MARK: - Font

extension Font {
    /// The kid app's font: Figtree (bundled — same as the web), or the
    /// system's rounded font if it isn't there.
    static func rounded(_ size: CGFloat, _ weight: Font.Weight = .medium) -> Font {
        if figtreeAvailable {
            return .custom("Figtree", size: size).weight(weight)
        }
        return .system(size: size, weight: weight, design: .rounded)
    }

    private static let figtreeAvailable = UIFont(name: "Figtree", size: 12) != nil
        || UIFont.fontNames(forFamilyName: "Figtree").isEmpty == false
}

// MARK: - Shared pieces

/// Rounded card used for every section, like the web view: white, on the
/// palette's page color.
struct Card<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.white, in: RoundedRectangle(cornerRadius: 32, style: .continuous))
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
