// The kid app's icons — the exported set (public/icons), plus a gear drawn
// to match. All take the current text color, so they follow the kid's
// palette. The iOS app has the same icons in its asset catalog.

type P = { className?: string };

export function GearIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M13.9 2.6a1.6 1.6 0 0 0-3.8 0l-.2.9a1.6 1.6 0 0 1-2.2 1l-.8-.4a1.6 1.6 0 0 0-2.7 2.7l.4.8a1.6 1.6 0 0 1-1 2.2l-.9.2a1.6 1.6 0 0 0 0 3.8l.9.2a1.6 1.6 0 0 1 1 2.2l-.4.8a1.6 1.6 0 0 0 2.7 2.7l.8-.4a1.6 1.6 0 0 1 2.2 1l.2.9a1.6 1.6 0 0 0 3.8 0l.2-.9a1.6 1.6 0 0 1 2.2-1l.8.4a1.6 1.6 0 0 0 2.7-2.7l-.4-.8a1.6 1.6 0 0 1 1-2.2l.9-.2a1.6 1.6 0 0 0 0-3.8l-.9-.2a1.6 1.6 0 0 1-1-2.2l.4-.8a1.6 1.6 0 0 0-2.7-2.7l-.8.4a1.6 1.6 0 0 1-2.2-1zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" />
    </svg>
  );
}

// The exported icon set (public/icons): drawn as a mask in the current text
// color, so they follow the kid's palette (.kid-icon in globals.css).
function MaskIcon({ src, className }: P & { src: string }) {
  return (
    <span aria-hidden className={`kid-icon inline-block ${className ?? ""}`} style={{ "--icon": `url(${src})` } as React.CSSProperties} />
  );
}

export const StatsIcon = ({ className }: P) => <MaskIcon src="/icons/Icon_ThumbsUp.svg" className={className} />;
export const ArcadeIcon = ({ className }: P) => <MaskIcon src="/icons/Icon_Game.svg" className={className} />;

// The big ✓ on the tab bar (drawn until there's an exported one).
export function CheckIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none">
      <rect x="3" y="3" width="18" height="18" rx="5" fill="currentColor" />
      <path d="M8 12.5l2.6 2.6L16.5 9" stroke="rgb(var(--kid-strong))" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export const ChevronIcon = ({ className }: P) => <MaskIcon src="/icons/Icon_ChunkyArrow.svg" className={className} />;
