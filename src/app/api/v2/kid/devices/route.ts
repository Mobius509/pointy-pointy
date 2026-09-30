import { NextResponse } from "next/server";
import { registerDevice, unregisterDevice } from "@/lib/v2/push";
import { jsonError, requireKidFromRequest } from "@/lib/v2/kid-api";

// iOS app registers its APNs device token for the signed-in kid.
// Body: { token: "<hex>", environment: "sandbox" | "production" }.
export async function POST(req: Request) {
  const auth = await requireKidFromRequest(req);
  if ("response" in auth) return auth.response;

  const body = (await req.json().catch(() => null)) as {
    token?: unknown;
    environment?: unknown;
  } | null;
  const token = String(body?.token ?? "");
  const env = body?.environment;
  if (!/^[0-9a-f]{64,200}$/i.test(token)) return jsonError("Bad device token.", 400);
  if (env !== "sandbox" && env !== "production") {
    return jsonError("Bad environment.", 400);
  }

  const res = await registerDevice(
    { role: "kid", householdId: auth.ctx.householdId, kidProfileId: auth.ctx.kidProfileId },
    { platform: "ios", token: token.toLowerCase(), apnsEnv: env },
    req.headers.get("user-agent"),
  );
  return res.ok ? NextResponse.json({ ok: true }) : jsonError(res.error, 400);
}

// Called on sign-out so the next kid on this phone doesn't get the last
// kid's notifications. Body: { token }.
export async function DELETE(req: Request) {
  const auth = await requireKidFromRequest(req);
  if ("response" in auth) return auth.response;

  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  await unregisterDevice(auth.ctx.householdId, String(body?.token ?? "").toLowerCase());
  return NextResponse.json({ ok: true });
}
