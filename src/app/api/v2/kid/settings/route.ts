import { NextResponse } from "next/server";
import { getKidReminderTime, setKidReminderTime } from "@/lib/v2/kid-ops";
import { opResponse, requireKidFromRequest } from "@/lib/v2/kid-api";

// Kid settings. reminderTime is "HH:MM" (24h, household timezone) or null.
export async function GET(req: Request) {
  const auth = await requireKidFromRequest(req);
  if ("response" in auth) return auth.response;

  return NextResponse.json({ reminderTime: await getKidReminderTime(auth.ctx) });
}

export async function PUT(req: Request) {
  const auth = await requireKidFromRequest(req);
  if ("response" in auth) return auth.response;

  const body = (await req.json().catch(() => null)) as { reminderTime?: unknown } | null;
  const time = body?.reminderTime == null ? null : String(body.reminderTime);
  return opResponse(await setKidReminderTime(auth.ctx, time));
}
