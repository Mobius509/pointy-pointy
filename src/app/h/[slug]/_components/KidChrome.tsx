import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { figtree } from "@/app/fonts";
import { kidThemeVars } from "@/lib/kid-palette";
import { KidThemeRoot } from "./KidThemeRoot";
import { InitialsMenu } from "./InitialsMenu";
import { KidTabBar } from "./KidTabBar";
import { GearIcon } from "./KidIcons";

// The kid app's frame: their color (the palette as CSS variables — see
// src/lib/kid-palette.ts), the Figtree font, the top bar (family name,
// settings, initials menu) and the floating tab bar. A phone-width column
// on every screen size, like the iOS app. `embedded`: inside the iOS app's
// web view, which draws its own bars. `preview`: a parent's "Kid view"
// (look, don't touch).
export function KidChrome({
  slug,
  hue,
  householdName,
  initials,
  embedded = false,
  preview = false,
  children,
}: {
  slug: string;
  hue: number;
  householdName: string;
  initials: string;
  embedded?: boolean;
  preview?: boolean;
  children: ReactNode;
}) {
  const vars = kidThemeVars(hue);
  const style = vars as CSSProperties;
  return (
    <div data-kid-chrome style={style} className={`${figtree.variable} font-kid min-h-screen bg-white text-kid-text`}>
      {/* Dialogs, celebrations and games draw outside this box: give the
          page root the same colors while the kid app is open (not in a
          parent's preview — that would recolor the parent pages). */}
      {!preview && <KidThemeRoot vars={vars} />}
      <div className={`mx-auto w-full max-w-[440px] px-3 ${embedded ? "pt-3 pb-6" : "pt-4 pb-32"}`}>
        {!embedded && (
          <header className="flex items-center justify-between gap-3 px-3 pb-2">
            <span className="text-[13px] font-medium text-kid-strong truncate">{householdName}</span>
            <div className="flex items-center gap-2 shrink-0">
              {preview ? (
                <span className="grid size-10 place-items-center rounded-full bg-kid-card text-kid-strong">
                  <GearIcon className="size-5" />
                </span>
              ) : (
                <Link
                  href={`/h/${slug}/settings`}
                  aria-label="Settings"
                  className="grid size-10 place-items-center rounded-full bg-kid-card text-kid-strong transition active:scale-95"
                >
                  <GearIcon className="size-5" />
                </Link>
              )}
              <InitialsMenu slug={slug} initials={initials} disabled={preview} />
            </div>
          </header>
        )}
        {children}
      </div>
      {!embedded && <KidTabBar slug={slug} disabled={preview} />}
    </div>
  );
}
