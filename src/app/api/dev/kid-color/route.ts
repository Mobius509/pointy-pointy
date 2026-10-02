import { NextResponse } from "next/server";
import { KID_DEFAULT_COLOR_COOKIE, kidVersionSwitchAllowed } from "@/app/h/[slug]/_lib/kid-version";

// Dev/preview only: show every kid in the default palette (?default=1) or
// their own color (?default=0), then back to `to`.
export async function GET(req: Request) {
  if (!kidVersionSwitchAllowed()) return new NextResponse("Not found", { status: 404 });
  const url = new URL(req.url);
  const on = url.searchParams.get("default") === "1";
  const to = url.searchParams.get("to") ?? "/";
  const safe = /^\/h\/[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)?$/.test(to) ? to : "/";
  const res = NextResponse.redirect(new URL(safe, url.origin));
  if (on) res.cookies.set(KID_DEFAULT_COLOR_COOKIE, "1", { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  else res.cookies.delete(KID_DEFAULT_COLOR_COOKIE);
  return res;
}
