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
    <section className="card">
      <h3 className="text-xl font-bold text-slate-800">
        Did something extra?
      </h3>
      <p className="text-sm text-slate-600 mt-1">
        Tell a parent what you did — they&apos;ll decide how many points it
        deserves.
      </p>

      <form onSubmit={onSubmit} className="mt-3 flex flex-wrap gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          placeholder="e.g. helped Mom carry groceries"
          className="input flex-1 min-w-[14rem]"
          disabled={pending}
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={pending || !name.trim()}
        >
          {pending ? "Sending…" : "Send to parents"}
        </button>
      </form>

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
          <h4 className="text-sm font-semibold text-slate-700 mb-2">
            Waiting on:
          </h4>
          <ul className="space-y-2">
            {pendingProposals.map((p) => (
              <li
                key={p.id}
                className="rounded-xl bg-amber-50 ring-1 ring-amber-200 px-3 py-2 flex items-center gap-2"
              >
                <span className="flex-1 min-w-0 truncate">
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
