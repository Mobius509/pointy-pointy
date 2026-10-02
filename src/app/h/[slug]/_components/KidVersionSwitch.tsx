import { kidVersionSwitchAllowed } from "../_lib/kid-version";

// Dev/preview only: a little pill to flip between kid app 1.0 and 2.0.
export function KidVersionSwitch({ slug, version }: { slug: string; version: 1 | 2 }) {
  if (!kidVersionSwitchAllowed()) return null;
  const other = version === 1 ? 2 : 1;
  return (
    <a
      href={`/api/dev/kid-version?v=${other}&to=/h/${slug}`}
      className="fixed right-3 bottom-24 z-[95] rounded-full bg-slate-900/80 px-3 py-1.5 text-[12px] font-semibold text-white shadow-md backdrop-blur hover:bg-slate-900"
      title="Dev only — not on the live site"
    >
      🛠 Kid app {version}.0 · switch to {other}.0
    </a>
  );
}
