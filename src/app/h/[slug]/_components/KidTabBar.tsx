"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArcadeIcon, CheckIcon, StatsIcon } from "./KidIcons";

// The kid app's floating tab bar: Stats (home) · Tasks (the big ✓) ·
// Arcade. A dark bar (kid.nav) with a hump in the middle that holds the big
// button — the exported shape (public/icons/UI_Navigation.svg, 257 × 67).
// The iOS app draws the same path (NavShape in KidAppView.swift).
const NAV_PATH =
  "M129.193 0C136.554 8.57418e-06 143.274 2.74254 148.387 7.26144C155.113 13.2047 162.663 19.5977 171.638 19.5977H233.142C245.969 19.5978 256.367 29.9963 256.367 42.8232C256.367 55.6504 245.969 66.0497 233.142 66.0498H23.2256C10.3985 66.0497 2.98953e-05 55.6504 0 42.8232C0.000230911 29.9963 10.3986 19.5978 23.2256 19.5977H84.7292C93.7043 19.5977 101.254 13.2047 107.98 7.26144C113.093 2.74253 119.813 4.63221e-08 127.174 0H129.193Z";

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
    <span className="grid size-[59px] place-items-center rounded-full bg-kid-strong text-kid-card-soft">
      <CheckIcon className="size-[30px]" />
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
        {/* The big ✓ fills the hump (centered on its peak, x 128.18). */}
        <div className="absolute left-[128.18px] top-[3px] -translate-x-1/2">
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
