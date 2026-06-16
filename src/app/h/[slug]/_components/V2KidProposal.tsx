"use client";

import { useState, useTransition } from "react";
import type { V2Completion } from "@/lib/v2/data";
import {
  cancelKidProposalAction,
  submitKidProposalAction,
} from "../_actions/kid-completions";

export function V2KidProposal({
  slug,
  pendingProposals,
}: {
  slug: string;
  pendingProposals: V2Completion[];
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submittedJustNow, setSubmittedJustNow] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setSubmittedJustNow(trimmed);
    setName("");
    startTransition(async () => {
      const res = await submitKidProposalAction(slug, trimmed);
      if (!res.ok) {
        setError(res.error);
        setSubmittedJustNow(null);
      }
    });
  };

  const onCancel = (id: string) => {
    setError(null);
    startTransition(async () => {
      const res = await cancelKidProposalAction(slug, id);
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <section className="bg-white rounded-[32px] p-5 sm:p-8 shadow-sm">
      <div className="grid gap-6 md:grid-cols-[1fr_2fr] items-start">
        <div>
          <h3
            className="text-[#F2662A] leading-tight"
            style={{ fontSize: 18, fontWeight: 700 }}
          >
            Did something extra?
          </h3>
          <p className="mt-2 text-[#F2662A] text-[12px] font-semibold leading-snug">
            Tell a parent what you did — they&apos;ll decide how many points
            it deserves.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="relative rounded-2xl bg-[#FAF4F0] ring-1 ring-[#F1D1BD] min-h-[110px] p-4"
        >
          <textarea
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="What was it?"
            disabled={pending}
            className="w-full min-h-[80px] bg-transparent border-0 resize-none focus:outline-none text-[14px] text-[#F2662A] placeholder:text-[#C3A38A] pr-32"
          />
          <button
            type="submit"
            disabled={pending || !name.trim()}
            className="absolute bottom-3 right-3 rounded-full bg-white border border-[#F1D1BD] text-[#F2662A] font-semibold px-4 py-2 text-[14px] transition hover:bg-[#FFF7EE] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
          >
            {pending ? "Sending…" : "Send to Parents"}
          </button>
        </form>
      </div>

      {error && (
        <p className="mt-2 text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}
      {submittedJustNow && !error && (
        <p className="mt-2 text-sm text-emerald-700">
          ⏳ Sent &quot;{submittedJustNow}&quot; for parent to review.
        </p>
      )}

      {pendingProposals.length > 0 && (
        <div className="mt-4">
          <h4 className="text-[12px] font-semibold text-[#C3A38A] uppercase tracking-wide">
            Waiting on:
          </h4>
          <ul className="mt-2 space-y-2">
            {pendingProposals.map((p) => (
              <li
                key={p.id}
                className="rounded-xl bg-[#FEF3C7] ring-1 ring-amber-200 px-3 py-2 flex items-center gap-2"
              >
                <span className="flex-1 min-w-0 truncate text-[#92400E] text-[14px] font-medium">
                  ⏳ {p.task_name_snapshot}
                </span>
                <button
                  type="button"
                  onClick={() => onCancel(p.id)}
                  className="text-xs font-semibold text-rose-600 hover:underline"
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
