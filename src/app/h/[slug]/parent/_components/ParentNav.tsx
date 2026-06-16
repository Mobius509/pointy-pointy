"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/app/sign-in/_actions";

const TABS = [
  { label: "Review", path: "" },
  { label: "Tasks", path: "/tasks" },
  { label: "Activity", path: "/activity" },
  { label: "Goal", path: "/goal" },
  { label: "Settings", path: "/settings" },
];

// Two variants, both rendered out of this single component so the active
// pathname matching stays in one place. The layout decides which to mount.
//
//   variant="desktop" → centered pill nav (≥ sm)
//   variant="mobile"  → classic 3-line hamburger on the left that opens a
//                       dropdown panel with the tabs + Sign Out.
export function ParentNav({
  slug,
  variant,
}: {
  slug: string;
  variant: "mobile" | "desktop";
}) {
  const pathname = usePathname();
  const base = `/h/${slug}/parent`;

  const isActive = (href: string, path: string) =>
    path === ""
      ? pathname === href || pathname === `${base}/`
      : pathname === href || pathname.startsWith(`${href}/`);

  if (variant === "desktop") {
    return (
      <nav className="inline-flex items-center gap-1 bg-white/70 backdrop-blur rounded-full px-2 py-1.5 text-sm">
        {TABS.map((t) => {
          const href = `${base}${t.path}`;
          const active = isActive(href, t.path);
          return (
            <Link
              key={t.label}
              href={href}
              className={`px-4 sm:px-6 py-2 rounded-full font-semibold transition ${
                active
                  ? "text-orange-700 underline underline-offset-4"
                  : "text-orange-800/70 hover:text-orange-900 hover:bg-white/40"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return <MobileHamburger base={base} isActive={isActive} />;
}

// Mobile-only client component. Keeps its open/closed state and handles
// route-change + click-outside dismissal. The Sign Out item posts the
// server action via a form so we don't need extra plumbing.
function MobileHamburger({
  base,
  isActive,
}: {
  base: string;
  isActive: (href: string, path: string) => boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Close on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Click-outside dismiss.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Escape to dismiss.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center size-10 rounded-full text-[#F2662A] hover:bg-white/40 transition"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          className="size-6"
        >
          {open ? (
            <>
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </>
          ) : (
            <>
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <nav
          role="menu"
          className="absolute left-0 mt-2 min-w-[200px] rounded-2xl bg-white shadow-lg ring-1 ring-[#F1D1BD] p-1 z-50"
        >
          {TABS.map((t) => {
            const href = `${base}${t.path}`;
            const active = isActive(href, t.path);
            return (
              <Link
                key={t.label}
                href={href}
                role="menuitem"
                className={`block px-4 py-2 rounded-xl text-sm font-semibold ${
                  active
                    ? "bg-[#FBE3CF] text-[#F2662A]"
                    : "text-[#F2662A] hover:bg-[#FFF7EE]"
                }`}
              >
                {t.label}
              </Link>
            );
          })}

          <div className="my-1 border-t border-[#F9EBE3]" />

          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="w-full text-left px-4 py-2 rounded-xl text-sm font-semibold text-[#F2662A] hover:bg-[#FFF7EE]"
            >
              Sign Out
            </button>
          </form>
        </nav>
      )}
    </div>
  );
}
