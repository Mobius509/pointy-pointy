import { NextResponse } from "next/server";
import { markCelebrated } from "@/lib/v2/kid-home";
import { jsonError, requireKidFromRequest } from "@/lib/v2/kid-api";

// The kid played the celebration for these approvals: don't offer it again
// on any device. Body: { ids: string[] }.
export async function POST(req: Request) {
  const auth = await requireKidFromRequest(req);
  if ("response" in auth) return auth.response;

  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x): x is string => typeof x === "string") : null;
  if (!ids) return jsonError("Bad request.", 400);
  await markCelebrated(auth.ctx, ids);
  return NextResponse.json({ ok: true });
}
