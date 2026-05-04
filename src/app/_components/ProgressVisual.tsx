type Props = {
  goalName: string;
  current: number;
  target: number;
};

export function ProgressVisual({ goalName, current, target }: Props) {
  const safeTarget = Math.max(1, target);
  const pct = Math.min(100, Math.round((current / safeTarget) * 100));
  const remaining = Math.max(0, target - current);
  const reached = current >= target;

  return (
    <section className="card overflow-hidden relative">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500">
            Goal
          </div>
          <h2 className="text-2xl font-extrabold text-brand-700 leading-tight">
            {goalName}
          </h2>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black text-slate-900 tabular-nums">
            {current.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 tabular-nums">
            / {target.toLocaleString()} pts
          </div>
        </div>
      </div>

      <div className="mt-4 relative h-10 rounded-full bg-slate-100 ring-1 ring-slate-200 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
        <span
          className="absolute left-2 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-700"
          aria-hidden
        >
          🏠
        </span>
        <span
          className="absolute top-1/2 text-2xl drop-shadow-sm transition-[left] duration-700 ease-out"
          style={{
            left: `calc(${Math.min(96, Math.max(6, pct))}% - 14px)`,
            transform: "translateY(-50%)",
          }}
          aria-hidden
        >
          🐶
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="font-semibold text-brand-700">{pct}% there</span>
        {reached ? (
          <span className="font-bold text-emerald-600">
            🎉 You did it! Ask a parent to redeem!
          </span>
        ) : (
          <span className="text-slate-600 tabular-nums">
            {remaining.toLocaleString()} pts to go
          </span>
        )}
      </div>
    </section>
  );
}
