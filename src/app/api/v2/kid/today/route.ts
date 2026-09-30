import { NextResponse } from "next/server";
import { getKidTodayView } from "@/lib/v2/kid-ops";
import {
  jsonError,
  requireKidFromRequest,
  serializeTodayView,
} from "@/lib/v2/kid-api";

// Everything the kid home screen needs: profile, goal + progress,
// milestones, this period's checklist, and pending "did something extra".
export async function GET(req: Request) {
  const auth = await requireKidFromRequest(req);
  if ("response" in auth) return auth.response;

  const view = await getKidTodayView(auth.ctx);
  if (!view) return jsonError("Sign in first.", 401);

  return NextResponse.json(serializeTodayView(view));
}
