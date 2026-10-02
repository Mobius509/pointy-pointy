"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArcadeIcon, CheckIcon, StatsIcon } from "./KidIcons";

// The kid app's floating tab bar: Stats (home) · Tasks (the big ✓) ·
// Arcade. A dark bar (kid.nav) with a hump in the middle that holds the big
// button — the exported shape (public/icons/UI_Navigation.svg, 257 × 67).
// The iOS app draws the same path (NavShape in KidAppView.swift).
const NAV_PATH =
  "M129.193 0C136.554 4.63221e-08 143.274 2.74226 148.387 7.26088C155.113 13.2039 162.663 19.5967 171.638 19.5967H233.142C245.969 19.5968 256.367 29.9953 256.367 42.8223C256.367 55.6494 245.969 66.0487 233.142 66.0488H23.2256C10.3984 66.0487 0 55.6494 0 42.8223C0.000230911 29.9953 10.3986 19.5968 23.2256 19.5967H84.7295C93.7044 19.5967 101.255 13.2039 107.98 7.26088C113.093 2.74226 119.813 4.63221e-08 127.174 0H129.193Z";

// `disabled` (a parent's preview): shown at the end of the page rather than
// floating, and the tabs don't go anywhere.
export function KidTabBar({ slug, disabled = false }: { slug: string; disabled?: boolean }) {
  const path = usePathname();
  const base = `/h/${slug}`;
  const tasks = `${base}/tasks`;
  const arcade = `${base}/arcade`;
  const on = (href: string) => (href === base ? path === base : path.startsWith(href));

  // A side tab: icon and label in the strong color — the one you're on at
  // full strength, the other a touch softer.
  const side = (href: string, label: string, Icon: typeof StatsIcon, iconFirst: boolean) => {
    const active = on(href);
    const inner = (
      <>
        {iconFirst && <Icon className="size-[22px]" />}
        <span className="text-[14px] font-bold">{label}</span>
        {!iconFirst && <Icon className="size-[22px]" />}
      </>
    );
    const cls = `flex items-center gap-1.5 text-kid-strong transition ${active ? "" : "opacity-75"}`;
    return disabled ? (
      <span className={cls}>{inner}</span>
    ) : (
      <Link href={href} className={`${cls} active:scale-95`} aria-current={active ? "page" : undefined}>
        {inner}
      </Link>
    );
  };

  const center = (
    <span className="grid size-[55px] place-items-center rounded-full bg-kid-strong text-kid-card-soft">
      <CheckIcon className="size-7" />
    </span>
  );

  return (
    <nav
      aria-label="Kid app"
      className={disabled ? "mt-6 flex justify-center" : "pointer-events-none fixed inset-x-0 z-40 flex justify-center"}
      style={disabled ? undefined : { bottom: "max(14px, calc(env(safe-area-inset-bottom) + 6px))" }}
    >
      <div className="pointer-events-auto relative h-[67px] w-[257px]">
        <svg viewBox="0 0 257 67" className="absolute inset-0 size-full text-kid-nav drop-shadow-lg" aria-hidden>
          <path d={NAV_PATH} fill="currentColor" />
        </svg>
        {/* The bar: Stats on the left, Arcade on the right. */}
        <div className="absolute inset-x-0 bottom-0 flex h-[46px] items-center justify-between px-4">
          {side(base, "Stats", StatsIcon, true)}
          {side(arcade, "Arcade", ArcadeIcon, false)}
        </div>
        {/* The big ✓ sits in the hump. */}
        <div className="absolute left-1/2 top-[5px] -translate-x-1/2">
          {disabled ? (
            center
          ) : (
            <Link
              href={tasks}
              aria-label="Tasks"
              aria-current={on(tasks) ? "page" : undefined}
              className="block transition active:scale-95"
            >
              {center}
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
