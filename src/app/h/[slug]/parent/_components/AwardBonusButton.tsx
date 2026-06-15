"use client";

import { useEffect, useState, useTransition } from "react";
import type { KidProfile } from "@/lib/v2/data";
import { awardCustomBonusAction } from "../_actions/bonus";

// Overview-page button that opens a small modal with the same bonus form
// that used to live at /parent/bonus. Keeps the action server-side.
export function AwardBonusButton({
  slug,
  kids,
}: {
  slug: string;
  kids: KidProfile[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (kids.length === 0) {
    return (
      <p className="text-sm text-slate-500 italic">
        Add a kid first (Settings) to award bonuses.
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="btn-primary"
      >
        ⭐ Award bonus
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-xl ring-1 ring-slate-200 p-6 max-h-[92vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-xl font-extrabold text-slate-800">
                Award a bonus
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="size-8 rounded-full grid place-items-center text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-slate-600">
              For one-off things they did that aren&apos;t on the daily list.
            </p>

            <form
              action={(fd) =>
                start(async () => {
                  setError(null);
                  try {
                    await awardCustomBonusAction(fd);
                    setOpen(false);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                })
              }
              className="mt-4 space-y-3"
            >
              <input type="hidden" name="slug" value={slug} />
              <div>
                <label className="label" htmlFor="ab-kid">
                  Kid
                </label>
                <select
                  id="ab-kid"
                  name="kid_profile_id"
                  required
                  defaultValue={kids[0].id}
                  className="input"
                >
                  {kids.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="ab-name">
                  What was it?
                </label>
                <input
                  id="ab-name"
                  name="name"
                  required
                  className="input"
                  placeholder="Helped vacuum"
                  autoFocus
                />
              </div>
              <div>
                <label className="label" htmlFor="ab-points">
                  Points
                </label>
                <input
                  id="ab-points"
                  name="points"
                  type="number"
                  min={0}
                  max={1000}
                  defaultValue={5}
                  required
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="ab-note">
                  Note (optional)
                </label>
                <input id="ab-note" name="note" className="input" />
              </div>
              {error && (
                <p className="text-sm text-rose-700" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                className="btn-cyan w-full"
                disabled={pending}
              >
                {pending ? "Awarding…" : "Award"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
