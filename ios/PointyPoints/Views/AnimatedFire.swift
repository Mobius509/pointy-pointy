import ImageIO
import SwiftUI
import UIKit

/// The celebrate card's animated fire — the same looping animated WebP the
/// web uses (Resources/fire.webp, made from design/anims/fireemoji.mp4 with
/// the background taken out). A still fire when Reduce Motion is on.
struct AnimatedFire: UIViewRepresentable {
    func makeUIView(context: Context) -> UIImageView {
        let view = UIImageView()
        view.contentMode = .scaleAspectFit
        view.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        view.setContentCompressionResistancePriority(.defaultLow, for: .vertical)
        if UIAccessibility.isReduceMotionEnabled {
            view.image = UIImage(named: "Fire3D")
        } else {
            view.image = Self.animation ?? UIImage(named: "Fire3D")
        }
        return view
    }

    func updateUIView(_ view: UIImageView, context: Context) {}

    /// Decoded once and shared.
    private static let animation: UIImage? = {
        guard let url = Bundle.main.url(forResource: "fire", withExtension: "webp"),
              let source = CGImageSourceCreateWithURL(url as CFURL, nil)
        else { return nil }
        var frames: [UIImage] = []
        var duration = 0.0
        for i in 0..<CGImageSourceGetCount(source) {
            guard let cg = CGImageSourceCreateImageAtIndex(source, i, nil) else { continue }
            frames.append(UIImage(cgImage: cg))
            let props = CGImageSourceCopyPropertiesAtIndex(source, i, nil) as? [CFString: Any]
            let webp = props?[kCGImagePropertyWebPDictionary] as? [CFString: Any]
            duration += (webp?[kCGImagePropertyWebPUnclampedDelayTime] as? Double)
                ?? (webp?[kCGImagePropertyWebPDelayTime] as? Double) ?? 1.0 / 12
        }
        return frames.isEmpty ? nil : UIImage.animatedImage(with: frames, duration: duration)
    }()
}
