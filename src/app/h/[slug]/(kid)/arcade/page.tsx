import { redirect } from "next/navigation";
import { avatarSrc } from "@/lib/avatar";
import { getHighScores } from "@/lib/v2/high-scores";
import { Arcade } from "../../_components/Arcade";
import { loadKidPage } from "../../_lib/kid-page";

export const dynamic = "force-dynamic";

// The Arcade tab: tickets and the mini games (today's arcade, in the kid's
// colors). The iOS app shows this page in a web view for now.
export default async function KidArcadePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { household, home } = await loadKidPage(slug);
  if (!home) redirect(`/h/${slug}`);
  const highScores = await getHighScores(household.id);
  return (
    <div className="pt-2">
      <Arcade
        slug={slug}
        avatarSrc={avatarSrc(home.view.kid.avatar_emoji)}
        arcade={home.arcade}
        highScores={highScores}
        kidName={home.view.kid.name}
      />
    </div>
  );
}
