import "server-only";
import { cookies } from "next/headers";

// Dev-only switches, on the local dev server and Vercel preview deploys —
// never on the live site:
// - the kid app 1.0 (the old single page) vs 2.0 (Stats / Tasks / Arcade),
//   for comparing them side by side;
// - "default colors": every kid shows in the default palette (the mock's
//   lavender), whatever color they picked — so colors match the designs.
export const KID_VERSION_COOKIE = "pp_kid_version";
export const KID_DEFAULT_COLOR_COOKIE = "pp_kid_default_color";

export function kidVersionSwitchAllowed(): boolean {
  return process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview";
}

export async function getKidVersion(): Promise<1 | 2> {
  if (!kidVersionSwitchAllowed()) return 2;
  return (await cookies()).get(KID_VERSION_COOKIE)?.value === "1" ? 1 : 2;
}

export async function wantsDefaultKidColor(): Promise<boolean> {
  if (!kidVersionSwitchAllowed()) return false;
  return (await cookies()).get(KID_DEFAULT_COLOR_COOKIE)?.value === "1";
}
