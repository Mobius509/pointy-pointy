import SwiftUI

/// Lightweight confetti burst, fired each time `trigger` changes.
struct ConfettiView: View {
    let trigger: Int

    @State private var pieces: [Piece] = []
    @State private var startDate = Date.distantPast

    private struct Piece {
        let x: Double       // start position, 0–1 of width
        let drift: Double   // horizontal travel
        let speed: Double   // fall speed multiplier
        let spin: Double
        let size: CGSize
        let color: Color
    }

    private static let colors: [Color] = [
        Theme.orange, Theme.rust, Theme.peach, Theme.approvedDot, Theme.pendingDot, .pink,
    ]
    private let duration = 2.2

    var body: some View {
        TimelineView(.animation(paused: pieces.isEmpty)) { timeline in
            Canvas { context, size in
                let t = timeline.date.timeIntervalSince(startDate)
                guard t < duration else { return }
                for piece in pieces {
                    let y = -20 + t * t * 260 * piece.speed + t * 120
                    let x = piece.x * size.width + sin(t * 3 + piece.spin) * 30 + piece.drift * t * 40
                    var ctx = context
                    ctx.opacity = max(0, 1 - t / duration)
                    ctx.translateBy(x: x, y: y)
                    ctx.rotate(by: .radians(t * piece.spin * 4))
                    ctx.fill(
                        Path(CGRect(origin: CGPoint(x: -piece.size.width / 2, y: -piece.size.height / 2), size: piece.size)),
                        with: .color(piece.color)
                    )
                }
            }
        }
        .allowsHitTesting(false)
        .ignoresSafeArea()
        .accessibilityHidden(true)
        .onChange(of: trigger) {
            startDate = Date()
            pieces = (0..<80).map { _ in
                Piece(
                    x: .random(in: 0...1),
                    drift: .random(in: -1...1),
                    speed: .random(in: 0.7...1.3),
                    spin: .random(in: -3...3),
                    size: CGSize(width: .random(in: 6...10), height: .random(in: 10...16)),
                    color: Self.colors.randomElement()!
                )
            }
            Task {
                try? await Task.sleep(for: .seconds(duration))
                pieces = []
            }
        }
    }
}
