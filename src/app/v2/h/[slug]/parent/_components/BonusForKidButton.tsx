"use client";

import { useEffect, useState, useTransition } from "react";
import type { KidProfile } from "@/lib/v2/data";
import { awardCustomBonusAction } from "../_actions/bonus";

// Per-kid version of the bonus modal — kid is fixed by prop, no selector.
export function BonusForKidButton({
  slug,
  kid,
}: {
  slug: string;
  kid: KidProfile;
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

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white border border-[#F1D1BD] text-[#D45B00] font-semibold px-5 py-2 text-sm shadow-sm shadow-[#D45B00]/10 transition hover:bg-[#FFF7EE] active:scale-[0.99]"
      >
        <span aria-hidden>⭐</span>
        Award Bonus
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-xl ring-1 ring-slate-200 p-6"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-xl font-extrabold text-slate-800">
                Award {kid.name} a bonus
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
              className="space-y-3"
            >
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="kid_profile_id" value={kid.id} />
              <div>
                <label className="label" htmlFor={`bonus-${kid.id}-name`}>
                  What was it?
                </label>
                <input
                  id={`bonus-${kid.id}-name`}
                  name="name"
                  required
                  autoFocus
                  className="input"
                  placeholder="Helped vacuum"
                />
              </div>
              <div>
                <label className="label" htmlFor={`bonus-${kid.id}-points`}>
                  Points
                </label>
                <input
                  id={`bonus-${kid.id}-points`}
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
                <label className="label" htmlFor={`bonus-${kid.id}-note`}>
                  Note (optional)
                </label>
                <input
                  id={`bonus-${kid.id}-note`}
                  name="note"
                  className="input"
                />
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
