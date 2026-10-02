"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArcadeIcon, CheckIcon, StatsIcon } from "./KidIcons";

// The kid app's floating tab bar: Stats (home) · Tasks (the big ✓) ·
// Arcade. Matches the iOS app's bar.
export function KidTabBar({ slug, disabled = false }: { slug: string; disabled?: boolean }) {
  const path = usePathname();
  const base = `/h/${slug}`;
  const on = (href: string) => (href === base ? path === base : path.startsWith(href));
  const side = (href: string, label: string, Icon: typeof StatsIcon) => {
    const active = on(href);
    const inner = (
      <>
        <Icon className="size-6 text-kid-strong" />
        <span className={`text-[13px] font-semibold ${active ? "text-kid-text-strong" : "text-kid-text"}`}>{label}</span>
      </>
    );
    const cls = `flex items-center gap-1.5 rounded-full px-3 py-2 transition ${active ? "bg-kid-card" : ""}`;
    return disabled ? (
      <span className={cls}>{inner}</span>
    ) : (
      <Link href={href} className={`${cls} active:scale-95`} aria-current={active ? "page" : undefined}>
        {inner}
      </Link>
    );
  };
  const tasks = `${base}/tasks`;
  const center = (
    <span
      className={`grid size-[62px] place-items-center rounded-full bg-kid-strong text-white shadow-md transition ${
        on(tasks) ? "ring-4 ring-kid-card" : ""
      }`}
    >
      <CheckIcon className="size-7 text-white/90 [&_path]:stroke-kid-strong" />
    </span>
  );
  return (
    <nav
      aria-label="Kid app"
      className="fixed inset-x-0 z-40 flex justify-center pointer-events-none"
      style={{ bottom: "max(16px, calc(env(safe-area-inset-bottom) + 8px))" }}
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-kid-card-soft/95 backdrop-blur pl-2 pr-2 py-1.5 shadow-[0_8px_24px_rgb(var(--kid-text)/0.15)] ring-1 ring-kid-card">
        {side(base, "Stats", StatsIcon)}
        {disabled ? (
          center
        ) : (
          <Link href={tasks} aria-label="Tasks" aria-current={on(tasks) ? "page" : undefined} className="-my-3 active:scale-95">
            {center}
          </Link>
        )}
        {side(`${base}/arcade`, "Arcade", ArcadeIcon)}
      </div>
    </nav>
  );
}
