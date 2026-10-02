// Kid app 1.0 (the single-page kid view before the 2.0 redesign), kept for
// side-by-side comparison via the dev version switch. Remove once 2.0 ships.
// Collapsible milestone list under the kid's goal bar. Uses native
// <details>/<summary> so it works without JS and is keyboard/screen-reader
// friendly. The next locked milestone is highlighted as "up next".

type Milestone = { id: string; name: string; points: number };

export function GoalMilestones({
  milestones,
  progress,
}: {
  milestones: Milestone[];
  progress: number;
}) {
  if (milestones.length === 0) return null;

  const unlockedCount = milestones.filter((m) => progress >= m.points).length;
  const nextId = milestones.find((m) => progress < m.points)?.id;

  return (
    <details className="group mt-4 rounded-2xl bg-pp-soft">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-pp-primary transition hover:bg-pp-tint [&::-webkit-details-marker]:hidden">
        <span>
          Milestones
          <span className="ml-2 font-medium text-pp-muted">
            {unlockedCount} of {milestones.length} unlocked
          </span>
        </span>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          fill="none"
          className="size-4 shrink-0 transition-transform group-open:rotate-180"
        >
          <path
            d="M5 8l5 5 5-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>

      <ul className="space-y-1 px-2 pb-2">
        {milestones.map((m) => {
          const unlocked = progress >= m.points;
          const isNext = m.id === nextId;
          return (
            <li
              key={m.id}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
                isNext ? "bg-white ring-1 ring-pp-line" : ""
              }`}
            >
              <span
                aria-hidden
                className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full ${
                  unlocked
                    ? "bg-brand-gradient text-white"
                    : "bg-white text-pp-muted ring-1 ring-pp-line"
                }`}
              >
                {unlocked ? (
                  <svg viewBox="0 0 20 20" fill="none" className="size-3.5">
                    <path
                      d="M5 10l3 3 7-7"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
                    <path d="M10 2.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 7.8l5-.7L10 2.5z" />
                  </svg>
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate ${
                    unlocked ? "font-semibold text-pp-primary" : "text-pp-primary-strong"
                  }`}
                >
                  {m.name}
                </span>
                <span className="block text-xs text-pp-muted tabular-nums">
                  {m.points.toLocaleString()} pts
                </span>
              </span>

              <span
                className={`shrink-0 text-xs font-semibold tabular-nums ${
                  unlocked ? "text-emerald-700" : isNext ? "text-pp-primary" : "text-pp-muted"
                }`}
              >
                {unlocked
                  ? "Unlocked!"
                  : `${(m.points - progress).toLocaleString()} to go`}
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
