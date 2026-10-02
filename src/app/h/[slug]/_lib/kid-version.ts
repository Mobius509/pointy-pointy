import "server-only";
import { cookies } from "next/headers";

// Dev-only switch between the kid app 1.0 (the old single page) and 2.0
// (Stats / Tasks / Arcade) for comparing them side by side. Only on the
// local dev server and Vercel preview deploys — never on the live site.
export const KID_VERSION_COOKIE = "pp_kid_version";

export function kidVersionSwitchAllowed(): boolean {
  return process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview";
}

export async function getKidVersion(): Promise<1 | 2> {
  if (!kidVersionSwitchAllowed()) return 2;
  return (await cookies()).get(KID_VERSION_COOKIE)?.value === "1" ? 1 : 2;
}
