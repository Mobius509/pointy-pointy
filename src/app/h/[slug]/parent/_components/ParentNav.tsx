"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const TABS = [
  { label: "Review", path: "" },
  { label: "Tasks", path: "/tasks" },
  { label: "Activity", path: "/activity" },
  { label: "Goal", path: "/goal" },
  { label: "Settings", path: "/settings" },
];

// Centered pill nav for the parent admin. On sm+ the full row of tabs
// renders inline; on mobile it collapses to a hamburger button that
// opens a dropdown with the same tabs.
export function ParentNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/h/${slug}/parent`;

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close the dropdown after a tab is picked (route change).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Click-outside to dismiss the open dropdown on mobile.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const isActive = (href: string, path: string) =>
    path === ""
      ? pathname === href || pathname === `${base}/`
      : pathname === href || pathname.startsWith(`${href}/`);

  const activeTab = TABS.find((t) => isActive(`${base}${t.path}`, t.path));

  return (
    <>
      {/* Desktop: full pill nav. */}
      <nav className="hidden sm:inline-flex items-center gap-1 bg-white/70 backdrop-blur rounded-full px-2 py-1.5 text-sm">
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

      {/* Mobile: hamburger that opens a dropdown. */}
      <div ref={dropdownRef} className="relative sm:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Open menu"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 bg-white/70 backdrop-blur rounded-full pl-3 pr-2 py-1.5 text-sm font-semibold text-orange-800"
        >
          <span>{activeTab?.label ?? "Menu"}</span>
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            fill="none"
            className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path
              d="M4 6L8 10L12 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {open && (
          <nav
            role="menu"
            className="absolute left-1/2 -translate-x-1/2 mt-2 min-w-[180px] rounded-2xl bg-white shadow-lg ring-1 ring-[#F1D1BD] p-1 z-50"
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
                      ? "bg-[#FBE3CF] text-[#D45B00]"
                      : "text-orange-800 hover:bg-[#FFF7EE]"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </>
  );
}
