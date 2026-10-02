import { redirect } from "next/navigation";
import { avatarSrc } from "@/lib/avatar";
import { avatarShift } from "@/lib/kid-palette";
import { getHighScores } from "@/lib/v2/high-scores";
import { CelebratePlayer } from "../../_components/CelebratePlayer";
import { loadKidPage } from "../../_lib/kid-page";

export const dynamic = "force-dynamic";

// Plays the celebration for approvals the kid hasn't celebrated yet — where
// the "points approved" notification and the home page's celebrate card go
// (web, and the iOS app's web view). Then back home.
export default async function KidCelebratePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { household, home } = await loadKidPage(slug);
  if (!home) redirect(`/h/${slug}`);
  const { view } = home;
  return (
    <CelebratePlayer
      slug={slug}
      avatarSrc={avatarSrc(view.kid.avatar_emoji)}
      avatarShift={avatarShift(home.hue)}
      approvals={home.pendingCelebration}
      progress={view.progress}
      milestones={view.milestones.map((m) => ({ name: m.name, points: m.points }))}
      goal={view.goal ? { name: view.goal.name, targetPoints: view.goal.target_points } : null}
      highScores={await getHighScores(household.id)}
    />
  );
}
