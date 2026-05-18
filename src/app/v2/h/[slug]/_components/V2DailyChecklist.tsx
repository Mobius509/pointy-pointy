"use client";

import { useState, useTransition } from "react";
import { celebrate } from "@/app/_components/Confetti";
import { frequencyLabel, type Frequency } from "@/lib/time";
import {
  cancelPendingTaskForTodayAction,
  completeTaskForTodayAction,
  recallApprovedTaskAction,
} from "../_actions/kid-completions";

type ItemState = "open" | "pending" | "approved";

type Item = {
  id: string;
  name: string;
  description: string | null;
  points: number;
  frequency: Frequency;
  state: ItemState;
};

export function V2DailyChecklist({
  slug,
  items,
}: {
  slug: string;
  items: Item[];
}) {
  const [state, setState] = useState<Record<string, ItemState>>(
    () => Object.fromEntries(items.map((i) => [i.id, i.state])),
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const submit = (item: Item) => {
    setError(null);
    setState((s) => ({ ...s, [item.id]: "pending" }));
    celebrate();
    startTransition(async () => {
      const res = await completeTaskForTodayAction(slug, item.id);
      if (!res.ok) {
        setState((s) => ({ ...s, [item.id]: "open" }));
        setError(res.error);
      }
    });
  };

  const cancelPending = (item: Item) => {
    setError(null);
    setState((s) => ({ ...s, [item.id]: "open" }));
    startTransition(async () => {
      const res = await cancelPendingTaskForTodayAction(slug, item.id);
      if (!res.ok) {
        setState((s) => ({ ...s, [item.id]: "pending" }));
        setError(res.error);
      }
    });
  };

  const recall = (item: Item) => {
    setError(null);
    setState((s) => ({ ...s, [item.id]: "open" }));
    startTransition(async () => {
      const res = await recallApprovedTaskAction(slug, item.id);
      if (!res.ok) {
        setState((s) => ({ ...s, [item.id]: "approved" }));
        setError(res.error);
      }
    });
  };

  if (items.length === 0) {
    return (
      <p className="text-sm text-[#C3A38A] italic">
        No daily tasks yet — ask a parent to add some!
      </p>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-xl bg-rose-50 ring-1 ring-rose-200 text-rose-800 px-3 py-2 text-sm">
          {error}
        </div>
      )}
      <ul className="divide-y divide-[#F9EBE3]">
        {items.map((item) => {
          const s = state[item.id];
          return (
            <li
              key={item.id}
              className="py-4 flex flex-wrap items-center gap-4"
            >
              {/* Left: frequency + points pills */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="inline-flex items-center justify-center rounded-full bg-[#FBE3CF] text-[#D45B00] text-[12px] font-semibold px-3 py-1">
                  {frequencyLabel(item.frequency)}
                </span>
                <span className="inline-flex items-center justify-center rounded-full bg-[#E0F2FE] text-[#0369A1] text-[12px] font-semibold px-3 py-1 tabular-nums">
                  +{item.points}
                </span>
              </div>

              {/* Middle: task name + description */}
              <div className="flex-1 min-w-0">
                <div
                  className="text-[#733405] font-semibold leading-tight"
                  style={{ fontSize: 18 }}
                >
                  {item.name}
                </div>
                {item.description && (
                  <div className="text-[#D45B00] text-[12px] mt-0.5 leading-tight">
                    {item.description}
                  </div>
                )}
              </div>

              {/* Right: state-aware action */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {s === "open" && (
                  <button
                    type="button"
                    onClick={() => submit(item)}
                    className="rounded-full bg-white border border-[#F1D1BD] text-[#D45B00] font-semibold px-6 py-2 text-[14px] transition hover:bg-[#FFF7EE] active:scale-[0.99]"
                  >
                    Done
                  </button>
                )}

                {s === "pending" && (
                  <button
                    type="button"
                    onClick={() => cancelPending(item)}
                    aria-label="Tap to cancel"
                    className="inline-flex items-center gap-2 rounded-full bg-[#FEF3C7] text-[#92400E] font-semibold px-4 py-2 text-[14px] transition hover:bg-[#FDE68A] active:scale-[0.99]"
                  >
                    <span
                      aria-hidden
                      className="inline-flex items-center justify-center size-5 rounded-full bg-[#F59E0B] text-white"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="size-3">
                        <circle cx="5" cy="10" r="1.5" />
                        <circle cx="10" cy="10" r="1.5" />
                        <circle cx="15" cy="10" r="1.5" />
                      </svg>
                    </span>
                    Pending
                  </button>
                )}

                {s === "approved" && (
                  <>
                    <button
                      type="button"
                      onClick={() => recall(item)}
                      className="rounded-full bg-white border border-[#F1D1BD] text-[#D45B00] font-semibold px-5 py-2 text-[14px] transition hover:bg-[#FFF7EE] active:scale-[0.99]"
                    >
                      Recall
                    </button>
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#D1FAE5] text-[#065F46] font-semibold px-4 py-2 text-[14px]">
                      <span
                        aria-hidden
                        className="inline-flex items-center justify-center size-5 rounded-full bg-[#10B981] text-white"
                      >
                        <svg viewBox="0 0 20 20" fill="none" className="size-3">
                          <path
                            d="M5 10l3 3 7-7"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      Approved!
                    </span>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
