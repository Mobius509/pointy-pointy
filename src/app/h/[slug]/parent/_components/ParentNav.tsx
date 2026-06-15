"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Overview", path: "" },
  { label: "Tasks", path: "/tasks" },
  { label: "Activity", path: "/activity" },
  { label: "Goal", path: "/goal" },
  { label: "Settings", path: "/settings" },
];

// Centered pill nav for the parent admin — orange links inside a white
// translucent capsule. Active tab is underlined.
export function ParentNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/h/${slug}/parent`;

  return (
    <nav className="inline-flex items-center gap-1 bg-white/70 backdrop-blur rounded-full px-2 py-1.5 text-sm">
      {TABS.map((t) => {
        const href = `${base}${t.path}`;
        const isActive =
          t.path === ""
            ? pathname === href || pathname === `${base}/`
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={t.label}
            href={href}
            className={`px-4 sm:px-6 py-2 rounded-full font-semibold transition ${
              isActive
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
