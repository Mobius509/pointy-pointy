import { NextResponse } from "next/server";
import { signInKid } from "@/lib/v2/kid-ops";
import { issueKidToken } from "@/lib/v2/kid-token";
import { jsonError } from "@/lib/v2/kid-api";

// Kid PIN sign-in for native clients. Body: { slug, kidProfileId, pin }.
// Returns a signed bearer token for the other /api/v2/kid/* routes.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    slug?: unknown;
    kidProfileId?: unknown;
    pin?: unknown;
  } | null;

  const res = await signInKid(
    String(body?.slug ?? ""),
    String(body?.kidProfileId ?? ""),
    String(body?.pin ?? ""),
  );
  if (!res.ok) return jsonError(res.error, 401);

  return NextResponse.json(
    issueKidToken({
      householdId: res.householdId,
      kidProfileId: res.kidProfileId,
    }),
  );
}
