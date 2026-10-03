import { NextResponse } from "next/server";
import { getKidHome } from "@/lib/v2/kid-home";
import { jsonError, requireKidFromRequest, serializeTodayView } from "@/lib/v2/kid-api";
import { arcadeGameArt, arcadeGameIcon, arcadeGameName } from "@/lib/games";

// Everything the kid app shows: profile, goal + progress, milestones, this
// period's checklist, pending "did something extra", streaks (with this
// week's days) + arcade, and the home page's greeting, color, family name,
// initials and approvals waiting to be celebrated. Same data as the web
// kid pages (getKidHome). Older app versions ignore fields they don't know.
export async function GET(req: Request) {
  const auth = await requireKidFromRequest(req);
  if ("response" in auth) return auth.response;

  const home = await getKidHome(auth.ctx);
  if (!home) return jsonError("Sign in first.", 401);

  return NextResponse.json({
    ...serializeTodayView(home.view),
    streaks: home.streaks.map(({ streak, run, next, week, broken }) => ({
      id: streak.id,
      name: streak.name,
      daysRequired: streak.days_required,
      bonusPoints: streak.bonus_points,
      taskIds: streak.taskIds,
      skipWeekends: streak.skip_weekends,
      days: run.length,
      todayDone: run.todayDone,
      nextRewardAt: next.at,
      daysToGo: next.daysToGo,
      week,
      broken,
    })),
    arcade: {
      ...home.arcade,
      // The game they're in the middle of, with its name, emoji and 3D art
      // (for the ticket card's "Arcade is currently").
      playing: home.arcade.playing && {
        ...home.arcade.playing,
        name: arcadeGameName(home.arcade.playing.game),
        icon: arcadeGameIcon(home.arcade.playing.game),
        art: arcadeGameArt(home.arcade.playing.game),
      },
    },
    householdName: home.householdName,
    initials: home.initials,
    hue: home.hue,
    greeting: home.greeting,
    pendingCelebration: home.pendingCelebration,
  });
}
