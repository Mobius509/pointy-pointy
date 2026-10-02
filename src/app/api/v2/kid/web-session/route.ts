import { NextResponse } from "next/server";
import { setKidSession } from "@/lib/v2/auth";
import { requireKidFromRequest } from "@/lib/v2/kid-api";
import { EMBED_COOKIE } from "@/app/h/[slug]/_lib/kid-page";

// For the iOS app's web views (celebrations and the arcade run the web
// versions for now — see GROUND_RULES.md): swaps the app's bearer token for
// the web kid session cookie, then goes to `to` — a kid page path such as
// /h/<slug>/arcade?embed=1. The web view loads this with the token in the
// Authorization header.
export async function GET(req: Request) {
  const auth = await requireKidFromRequest(req);
  if ("response" in auth) return auth.response;

  const url = new URL(req.url);
  const to = url.searchParams.get("to") ?? "";
  // Only our own kid pages — never an outside address.
  const safe = /^\/h\/[A-Za-z0-9_-]+(\/[A-Za-z0-9/_-]*)?(\?[A-Za-z0-9=&_-]*)?$/.test(to) ? to : "/";
  await setKidSession({ householdId: auth.ctx.householdId, kidProfileId: auth.ctx.kidProfileId });
  const res = NextResponse.redirect(new URL(safe, url.origin));
  // The app draws its own bars: hide the web's in this web view.
  res.cookies.set(EMBED_COOKIE, "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  return res;
}
