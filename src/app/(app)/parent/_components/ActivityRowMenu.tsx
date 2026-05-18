"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { deleteCompletionAction } from "../_actions/activity";

// Tiny "⋯" menu used on the Most-recent-activity rows. Right now it only
// offers Remove — the menu shape is there for future actions (edit points,
// re-assign, etc.).
export function ActivityRowMenu({
  id,
  label,
}: {
  id: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement | null>(null);

  // Close when clicking outside or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onRemove = () => {
    const ok = window.confirm(
      `Remove "${label}"? Points will be subtracted.`,
    );
    if (!ok) return;
    setOpen(false);
    start(async () => {
      const fd = new FormData();
      fd.set("id", id);
      await deleteCompletionAction(fd);
    });
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={pending}
        className="size-7 grid place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
      >
        ⋯
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-20 min-w-[10rem] rounded-xl bg-white ring-1 ring-slate-200 shadow-md p-1"
        >
          <button
            type="button"
            role="menuitem"
            onClick={onRemove}
            className="w-full text-left text-sm rounded-lg px-3 py-2 text-rose-600 hover:bg-rose-50"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
