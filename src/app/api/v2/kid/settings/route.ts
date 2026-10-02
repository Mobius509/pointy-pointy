import { NextResponse } from "next/server";
import { getKidReminderTime, setKidReminderTime } from "@/lib/v2/kid-ops";
import { getKidHue, setKidHue } from "@/lib/v2/kid-home";
import { jsonError, opResponse, requireKidFromRequest } from "@/lib/v2/kid-api";

// Kid settings. reminderTime is "HH:MM" (24h, household timezone) or null;
// hue is the kid's color (0–359, see src/lib/kid-palette.ts).
export async function GET(req: Request) {
  const auth = await requireKidFromRequest(req);
  if ("response" in auth) return auth.response;

  const [reminderTime, hue] = await Promise.all([getKidReminderTime(auth.ctx), getKidHue(auth.ctx.kidProfileId)]);
  return NextResponse.json({ reminderTime, hue });
}

// Only the fields sent are changed.
export async function PUT(req: Request) {
  const auth = await requireKidFromRequest(req);
  if ("response" in auth) return auth.response;

  const body = (await req.json().catch(() => null)) as { reminderTime?: unknown; hue?: unknown } | null;
  if (!body) return jsonError("Bad request.", 400);
  if ("hue" in body) {
    const hue = Number(body.hue);
    if (!Number.isFinite(hue)) return jsonError("Bad color.", 400);
    await setKidHue(auth.ctx, hue);
  }
  if ("reminderTime" in body) {
    const time = body.reminderTime == null ? null : String(body.reminderTime);
    return opResponse(await setKidReminderTime(auth.ctx, time));
  }
  return NextResponse.json({ ok: true });
}
