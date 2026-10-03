"use client";

import { usePathname } from "next/navigation";

// Dev/preview only (the server decides whether to show it — see
// kid-version.ts): flip between kid app 1.0 and 2.0, and between the kid's
// own color and the default palette (so colors match the designs).
export function KidDevBar({ slug, version, defaultColor }: { slug: string; version: 1 | 2; defaultColor: boolean }) {
  const path = usePathname() || `/h/${slug}`;
  const pill = "rounded-full bg-slate-900/80 px-3 py-1.5 text-[12px] font-semibold text-white shadow-md backdrop-blur hover:bg-slate-900";
  return (
    <div className="fixed right-3 bottom-32 z-[95] flex flex-col items-end gap-1.5" title="Dev only — not on the live site">
      <a className={pill} href={`/api/dev/kid-version?v=${version === 1 ? 2 : 1}&to=/h/${slug}`}>
        🛠 Kid app {version}.0 · switch to {version === 1 ? 2 : 1}.0
      </a>
      {version === 2 && (
        <a className={pill} href={`/api/dev/kid-color?default=${defaultColor ? 0 : 1}&to=${encodeURIComponent(path)}`}>
          🎨 {defaultColor ? "Default colors · use theirs" : "Their color · use default"}
        </a>
      )}
    </div>
  );
}
