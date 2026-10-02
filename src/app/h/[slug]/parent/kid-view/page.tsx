import Link from "next/link";
import { requireHouseholdAccess } from "@/lib/v2/auth";
import { getKidProfiles } from "@/lib/v2/data";
import { getHighScores } from "@/lib/v2/high-scores";
import { getKidHome } from "@/lib/v2/kid-home";
import { avatarSrc } from "@/lib/avatar";
import { Arcade } from "../../_components/Arcade";
import { KidChrome } from "../../_components/KidChrome";
import { KidStats } from "../../_components/KidStats";
import { V2DailyChecklist } from "../../_components/V2DailyChecklist";
import { V2KidProposal } from "../../_components/V2KidProposal";

export const dynamic = "force-dynamic";

// "Kid view": what a kid sees on their own page, for parents — to check
// how things look, or show someone how it works. Look, don't touch: the
// kid's buttons are switched off, celebrations and tickets are left for
// the kid, and games played here don't set high scores.
export default async function KidViewPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ kid?: string }>;
}) {
  const { slug } = await params;
  const { kid: kidParam } = await searchParams;
  const household = await requireHouseholdAccess(slug);
  const kids = await getKidProfiles(household.id);
  const kid = kids.find((k) => k.id === kidParam) ?? kids[0];

  if (!kid) {
    return (
      <p className="text-pp-primary text-center py-10">
        Add a kid in Settings to see their view.
      </p>
    );
  }

  const ctx = { householdId: household.id, kidProfileId: kid.id, timezone: household.timezone };
  const [home, highScores] = await Promise.all([getKidHome(ctx), getHighScores(household.id)]);

  return (
    <div>
      <div className="rounded-2xl bg-pp-primary text-white px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="font-semibold">👀 This is what {kid.name} sees</p>
        <p className="text-[13px] text-white/80 flex-1 min-w-[12rem]">
          Just looking — their buttons are switched off here.
        </p>
        {kids.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {kids.map((k) => (
              <Link
                key={k.id}
                href={`/h/${slug}/parent/kid-view?kid=${k.id}`}
                className={`rounded-full px-3 py-1 text-[13px] font-semibold ${
                  k.id === kid.id ? "bg-white text-pp-primary" : "bg-white/20 text-white hover:bg-white/30"
                }`}
              >
                {k.name}
              </Link>
            ))}
          </div>
        )}
        <Link href={`/h/${slug}/parent`} className="rounded-full bg-white text-pp-primary px-4 py-1.5 text-[13px] font-semibold">
          Back to parent view
        </Link>
      </div>

      {home ? (
        // Their home (Stats), then what's on their Tasks and Arcade tabs.
        <div className="mt-4 overflow-hidden rounded-[32px]">
          <KidChrome slug={slug} hue={home.hue} householdName={home.householdName} initials={home.initials} preview>
            <KidStats slug={slug} home={home} preview />
            <h2 className="mt-8 px-3 text-[22px] font-medium text-kid-strong">Tasks</h2>
            <section className="mt-2 rounded-[32px] bg-kid-card p-3">
              <div className="rounded-[26px] bg-white p-4">
                <V2DailyChecklist slug={slug} items={home.view.items} readOnly />
              </div>
            </section>
            <div className="mt-2.5">
              <V2KidProposal slug={slug} pendingProposals={home.view.pendingProposals} readOnly />
            </div>
            <div className="mt-6">
              <Arcade
                slug={slug}
                avatarSrc={avatarSrc(home.view.kid.avatar_emoji)}
                arcade={home.arcade}
                highScores={highScores}
                preview
                kidName={kid.name}
              />
            </div>
          </KidChrome>
        </div>
      ) : (
        <p className="text-pp-muted text-center py-10">Couldn&apos;t load {kid.name}&apos;s view.</p>
      )}
    </div>
  );
}
