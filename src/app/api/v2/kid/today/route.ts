import { NextResponse } from "next/server";
import { getKidTodayView } from "@/lib/v2/kid-ops";
import { getArcade, getKidStreaks } from "@/lib/v2/streaks";
import {
  jsonError,
  requireKidFromRequest,
  serializeTodayView,
} from "@/lib/v2/kid-api";

// Everything the kid home screen needs: profile, goal + progress,
// milestones, this period's checklist, pending "did something extra", and
// streaks + arcade (new fields — older app versions just ignore them).
export async function GET(req: Request) {
  const auth = await requireKidFromRequest(req);
  if ("response" in auth) return auth.response;

  const view = await getKidTodayView(auth.ctx);
  if (!view) return jsonError("Sign in first.", 401);

  const streaks = await getKidStreaks(auth.ctx);
  const arcade = await getArcade(auth.ctx, streaks);
  return NextResponse.json({
    ...serializeTodayView(view),
    streaks: streaks.map(({ streak, run, next }) => ({
      id: streak.id,
      name: streak.name,
      daysRequired: streak.days_required,
      bonusPoints: streak.bonus_points,
      taskIds: streak.taskIds,
      days: run.length,
      todayDone: run.todayDone,
      nextRewardAt: next.at,
      daysToGo: next.daysToGo,
    })),
    arcade,
  });
}
