// The kid app's goal ring (Stats page). Shared by the server-rendered cards
// and the scroll-opening goal card; mirrors Ring in the iOS StatsView.

// A thick ring with rounded ends, starting at the bottom: the filled part,
// a little gap, then the rest in a paler color. The milestone's (or goal's)
// emoji rides on the tip of the filled part.
export function Ring({
  pct,
  points,
  label,
  emoji = null,
}: {
  pct: number;
  points: number;
  label: string;
  emoji?: string | null;
}) {
  const size = 280; // viewBox units; the ring scales to its box
  const stroke = 24;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = pct > 0 && pct < 100 ? stroke * 1.2 : 0; // room for the round ends
  const filled = Math.max(0, (c * pct) / 100 - gap / 2);
  const rest = Math.max(0, c - filled - gap * 2);
  // Where the tip is: clockwise from the bottom (in % of the box).
  const tip = Math.PI / 2 + (2 * Math.PI * filled) / c;
  const at = (v: number) => `${((size / 2 + r * v) / size) * 100}%`;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[280px]">
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full rotate-90" aria-hidden>
        {rest > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgb(var(--kid-track))"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${rest} ${c}`}
            strokeDashoffset={-(filled + gap)}
          />
        )}
        {filled > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgb(var(--kid-strong))"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${c}`}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-content-center px-8 text-center">
        <span className="text-[64px] font-medium leading-none text-kid-text tabular-nums">{points.toLocaleString()}</span>
        <span className="mt-1.5 text-[14px] font-medium text-kid-text">{label}</span>
      </div>
      {emoji && (
        <span
          aria-hidden
          className="absolute -translate-x-1/2 -translate-y-1/2 text-[38px] leading-none"
          style={{ left: at(Math.cos(tip)), top: at(Math.sin(tip)) }}
        >
          {emoji}
        </span>
      )}
    </div>
  );
}
