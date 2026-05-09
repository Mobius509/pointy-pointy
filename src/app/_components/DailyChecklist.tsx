"use client";

import { useState, useTransition } from "react";
import { completeTaskForToday } from "@/app/_actions/completions";
import { humanizeDate } from "@/lib/time";
import { celebrate } from "./Confetti";

type ItemState = "open" | "pending" | "approved";

type Item = {
  id: string;
  name: string;
  description: string | null;
  points: number;
  state: ItemState;
  // ISO timestamp of when the kid submitted this completion (pending or
  // approved). Null when state is "open".
  submittedAt: string | null;
};

type Props = {
  items: Item[];
};

export function DailyChecklist({ items }: Props) {
  const [state, setState] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.state])),
  );
  // When a kid taps a task, the optimistic "submitted just now" timestamp
  // shows immediately — no need to wait for a refresh from the server.
  const [submittedAt, setSubmittedAt] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      items
        .filter((i) => i.submittedAt)
        .map((i) => [i.id, i.submittedAt as string]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const onCheck = (item: Item) => {
    const current = state[item.id];
    // Once submitted, the kid can't take it back — parent has to deny.
    if (current !== "open") return;

    setError(null);
    setState((s) => ({ ...s, [item.id]: "pending" }));
    setSubmittedAt((m) => ({ ...m, [item.id]: new Date().toISOString() }));
    celebrate();
    startTransition(async () => {
      const res = await completeTaskForToday(item.id);
      if (!res.ok) {
        setState((s) => ({ ...s, [item.id]: "open" }));
        setSubmittedAt((m) => {
          const { [item.id]: _, ...rest } = m;
          void _;
          return rest;
        });
        setError(res.error);
      }
    });
  };

  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500 italic">
        No daily tasks yet — ask a parent to add some!
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-xl bg-rose-50 ring-1 ring-rose-200 text-rose-800 px-3 py-2 text-sm">
          {error}
        </div>
      )}
      {items.map((item) => {
        const s = state[item.id];
        const isPending = s === "pending";
        const isApproved = s === "approved";
        const submitted = submittedAt[item.id];

        const containerClass = isApproved
          ? "bg-emerald-50 ring-emerald-200 text-slate-500"
          : isPending
            ? "bg-amber-50 ring-amber-200"
            : "bg-white ring-slate-200 hover:ring-brand-300 hover:shadow-sm active:scale-[0.99]";

        const iconClass = isApproved
          ? "bg-emerald-500 text-white animate-pop-in"
          : isPending
            ? "bg-amber-400 text-white animate-pop-in"
            : "bg-slate-100 text-slate-400";

        const icon = isApproved ? "✓" : isPending ? "⏳" : "○";

        const badgeClass = isApproved
          ? "bg-emerald-100 text-emerald-700"
          : isPending
            ? "bg-amber-100 text-amber-700"
            : "bg-brand-100 text-brand-700";

        const subtitle = isApproved
          ? submitted
            ? `Approved · submitted ${humanizeDate(submitted)}`
            : "Approved"
          : isPending
            ? submitted
              ? `Submitted ${humanizeDate(submitted)} · waiting for a parent`
              : "Waiting for a parent to confirm"
            : item.description;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onCheck(item)}
            disabled={isPending || isApproved}
            className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 ring-1 transition text-left ${containerClass}`}
          >
            <span
              className={`flex-shrink-0 size-9 rounded-full grid place-items-center text-xl transition ${iconClass}`}
              aria-hidden
            >
              {icon}
            </span>
            <span className="flex-1 min-w-0">
              <span
                className={`block font-semibold ${
                  isApproved ? "line-through" : ""
                }`}
              >
                {item.name}
              </span>
              {subtitle && (
                <span className="block text-xs text-slate-500">{subtitle}</span>
              )}
            </span>
            <span
              className={`flex-shrink-0 rounded-full px-3 py-1 text-sm font-bold tabular-nums ${badgeClass}`}
            >
              +{item.points}
            </span>
          </button>
        );
      })}
    </div>
  );
}
