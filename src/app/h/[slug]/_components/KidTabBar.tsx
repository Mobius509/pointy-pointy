"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArcadeIcon, CheckIcon, StatsIcon } from "./KidIcons";

// The kid app's floating tab bar: Stats (home) · Tasks (the big ✓) ·
// Arcade. A dark bar (kid.nav) with a hump in the middle that holds the big
// button — the exported shape (public/ui/UI_Navigation.svg, 358 × 103, its
// native size). The iOS app draws the same path (NavShape in
// KidAppView.swift).
const NAV_PATH =
  "M179.745 0C222.055 0 219.723 28.4916 262.925 30.2812H320.932C341.404 30.2812 358 46.5602 358 66.6411C358 86.7217 341.404 103 320.932 103H37.0676C16.596 103 0.000269934 86.7217 0 66.6411C0 46.5602 16.5959 30.2812 37.0676 30.2812H91.3469C139.927 28.4918 137.435 0.000189256 179.745 0Z";
const BAR_TOP = 30.28; // where the bar part starts (the hump is above it)
const PEAK_X = 179.745; // the hump's peak — the big button centers on it

// `disabled` (a parent's preview): shown at the end of the page rather than
// floating, and the tabs don't go anywhere.
export function KidTabBar({ slug, disabled = false }: { slug: string; disabled?: boolean }) {
  const path = usePathname();
  const base = `/h/${slug}`;
  const tasks = `${base}/tasks`;
  const arcade = `${base}/arcade`;
  const on = (href: string) => (href === base ? path === base : path.startsWith(href));

  // A side tab: icon and label in the strong color (#B36BFB in the default
  // palette), same as the big button.
  const side = (href: string, label: string, Icon: typeof StatsIcon, iconFirst: boolean) => {
    const active = on(href);
    const inner = (
      <>
        {iconFirst && <Icon className="size-[27px]" />}
        <span className="text-[17px] font-bold">{label}</span>
        {!iconFirst && <Icon className="size-[27px]" />}
      </>
    );
    const cls = "flex items-center gap-2 text-kid-strong transition";
    return disabled ? (
      <span className={cls}>{inner}</span>
    ) : (
      <Link href={href} className={`${cls} active:scale-95`} aria-current={active ? "page" : undefined}>
        {inner}
      </Link>
    );
  };

  const center = (
    <span className="grid size-[88px] place-items-center rounded-full bg-kid-strong text-white">
      <CheckIcon className="size-[40px]" />
    </span>
  );

  return (
    <nav
      aria-label="Kid app"
      className={disabled ? "mt-6 flex justify-center" : "pointer-events-none fixed inset-x-0 z-40 flex justify-center"}
      style={disabled ? undefined : { bottom: "max(14px, calc(env(safe-area-inset-bottom) + 6px))" }}
    >
      <div className="pointer-events-auto relative h-[103px] w-[358px] max-w-[calc(100vw-24px)]">
        <svg viewBox="0 0 358 103" preserveAspectRatio="none" className="absolute inset-0 size-full text-kid-nav drop-shadow-lg" aria-hidden>
          <path d={NAV_PATH} fill="currentColor" />
        </svg>
        {/* The bar: Stats on the left, Arcade on the right. */}
        <div style={{ top: BAR_TOP }} className="absolute inset-x-0 bottom-0 flex items-center justify-between px-[26px]">
          {side(base, "Stats", StatsIcon, true)}
          {side(arcade, "Arcade", ArcadeIcon, false)}
        </div>
        {/* The big ✓ fills the hump (centered on its peak). */}
        <div style={{ left: `${(PEAK_X / 358) * 100}%` }} className="absolute top-[5px] -translate-x-1/2">
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
