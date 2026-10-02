import { NextResponse } from "next/server";
import { KID_VERSION_COOKIE, kidVersionSwitchAllowed } from "@/app/h/[slug]/_lib/kid-version";

// Dev/preview only: pick the kid app version (?v=1 or 2), then back to `to`.
export async function GET(req: Request) {
  if (!kidVersionSwitchAllowed()) return new NextResponse("Not found", { status: 404 });
  const url = new URL(req.url);
  const v = url.searchParams.get("v") === "1" ? "1" : "2";
  const to = url.searchParams.get("to") ?? "/";
  const safe = /^\/h\/[A-Za-z0-9_-]+$/.test(to) ? to : "/";
  const res = NextResponse.redirect(new URL(safe, url.origin));
  res.cookies.set(KID_VERSION_COOKIE, v, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
