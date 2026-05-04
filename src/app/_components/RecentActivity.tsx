import type { Completion } from "@/lib/data";

export function RecentActivity({ items }: { items: Completion[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500 italic">
        Nothing yet — your first task today will show up here!
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {items.map((c) => (
        <li
          key={c.id}
          className="flex items-center justify-between gap-3 py-2"
        >
          <span className="flex items-center gap-2 min-w-0">
            <span aria-hidden>
              {c.status === "pending" ? "⏳" : c.is_bonus ? "⭐" : "✅"}
            </span>
            <span className="truncate font-medium">{c.task_name_snapshot}</span>
            {c.note && (
              <span className="truncate text-xs text-slate-500">
                · {c.note}
              </span>
            )}
          </span>
          <span
            className={`flex-shrink-0 text-sm font-semibold tabular-nums ${
              c.status === "pending" ? "text-amber-700" : "text-brand-700"
            }`}
          >
            +{c.points_snapshot}
          </span>
        </li>
      ))}
    </ul>
  );
}
