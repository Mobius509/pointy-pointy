"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { kidSignOutAction } from "../_actions/kid-session";

// The kid's initials in the top bar; tapping opens a small menu. (What
// goes in it beyond settings and signing out is still to be decided.)
export function InitialsMenu({ slug, initials, disabled = false }: { slug: string; initials: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid size-10 place-items-center rounded-full bg-kid-card text-[17px] font-medium text-kid-strong transition active:scale-95"
      >
        {initials || "🙂"}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-44 overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-kid-card animate-celebrate-pop-in"
        >
          <Link
            role="menuitem"
            href={`/h/${slug}/settings`}
            className="block px-4 py-3 text-[15px] font-medium text-kid-text hover:bg-kid-card-soft"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          <form action={kidSignOutAction}>
            <input type="hidden" name="slug" value={slug} />
            <button
              role="menuitem"
              type="submit"
              className="block w-full px-4 py-3 text-left text-[15px] font-medium text-kid-text hover:bg-kid-card-soft"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
