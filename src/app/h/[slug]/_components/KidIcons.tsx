// The kid app's icons. Placeholders drawn to match the mock until the
// exported icon set arrives; all use currentColor so they follow the kid's
// palette.

type P = { className?: string };

export function GearIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M13.9 2.6a1.6 1.6 0 0 0-3.8 0l-.2.9a1.6 1.6 0 0 1-2.2 1l-.8-.4a1.6 1.6 0 0 0-2.7 2.7l.4.8a1.6 1.6 0 0 1-1 2.2l-.9.2a1.6 1.6 0 0 0 0 3.8l.9.2a1.6 1.6 0 0 1 1 2.2l-.4.8a1.6 1.6 0 0 0 2.7 2.7l.8-.4a1.6 1.6 0 0 1 2.2 1l.2.9a1.6 1.6 0 0 0 3.8 0l.2-.9a1.6 1.6 0 0 1 2.2-1l.8.4a1.6 1.6 0 0 0 2.7-2.7l-.4-.8a1.6 1.6 0 0 1 1-2.2l.9-.2a1.6 1.6 0 0 0 0-3.8l-.9-.2a1.6 1.6 0 0 1-1-2.2l.4-.8a1.6 1.6 0 0 0-2.7-2.7l-.8.4a1.6 1.6 0 0 1-2.2-1zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" />
    </svg>
  );
}

export function StatsIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M11 2.05A10 10 0 1 0 21.95 13H11z" opacity="0.55" />
      <path d="M13 2.05V11h8.95A10 10 0 0 0 13 2.05z" />
    </svg>
  );
}

export function CheckIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none">
      <rect x="3" y="3" width="18" height="18" rx="5" fill="currentColor" />
      <path d="M8 12.5l2.6 2.6L16.5 9" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArcadeIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M7 6h10a5 5 0 0 1 0 10l-1.2-.1-1.6 1.6A2 2 0 0 1 12.8 18h-1.6a2 2 0 0 1-1.4-.6l-1.6-1.5L7 16A5 5 0 0 1 7 6zm0 3a.9.9 0 0 0-.9.9V10H5.9a.9.9 0 0 0 0 1.8h.2v.2a.9.9 0 0 0 1.8 0v-.2h.2a.9.9 0 0 0 0-1.8h-.2v-.1A.9.9 0 0 0 7 9zm8.5.6a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm2 2.4a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
    </svg>
  );
}

export function ChevronIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M9 6.5v11a1 1 0 0 0 1.6.8l7-5.5a1 1 0 0 0 0-1.6l-7-5.5A1 1 0 0 0 9 6.5z" />
    </svg>
  );
}
