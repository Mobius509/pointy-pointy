type Props = {
  goalName: string;
  current: number;
  target: number;
};

const FILL_BG =
  // Diagonal stripe overlay sits on top of the warm gradient.
  "repeating-linear-gradient(45deg, rgba(255,255,255,0.22) 0 10px, rgba(255,255,255,0) 10px 20px), linear-gradient(to right, #fbbf24, #fb923c, #fb7185)";

export function ProgressVisual({ goalName, current, target }: Props) {
  const safeTarget = Math.max(1, target);
  const pct = Math.min(100, Math.round((current / safeTarget) * 100));
  const remaining = Math.max(0, target - current);
  const reached = current >= target;

  return (
    <section className="card !p-7 shadow-md shadow-slate-900/10">
      <div className="flex items-center gap-3">
        <span className="text-4xl sm:text-5xl" aria-hidden>
          🐶
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-rose-700 leading-none">
          {goalName}
        </h2>
      </div>

      <div
        className="mt-4 rounded-full p-px"
        style={{
          background: "linear-gradient(to bottom, #CDCDCD, #D6D6D6)",
        }}
      >
        <div
          className="relative h-12 sm:h-14 rounded-full overflow-hidden p-1"
          style={{
            background: "linear-gradient(to bottom, #F9F9F9, #EFEFEF)",
          }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%`, backgroundImage: FILL_BG }}
          />
          <span className="absolute inset-y-0 left-4 sm:left-5 flex items-center text-slate-900 font-extrabold text-xl sm:text-2xl tabular-nums z-10">
            {current.toLocaleString()}
          </span>
          <span className="absolute inset-y-0 right-4 sm:right-5 flex items-center text-slate-900 font-extrabold text-xl sm:text-2xl tabular-nums">
            {target.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="font-bold text-rose-600">{pct}% There!</span>
        {reached ? (
          <span className="font-bold text-emerald-600">
            🎉 You did it! Ask a parent to redeem!
          </span>
        ) : (
          <span className="font-semibold text-slate-900 tabular-nums">
            {remaining.toLocaleString()} points to go
          </span>
        )}
      </div>
    </section>
  );
}
