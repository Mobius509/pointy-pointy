import Link from "next/link";
import { requireHouseholdAccess } from "@/lib/v2/auth";
import { getKidProfiles } from "@/lib/v2/data";
import { getKidTodayView } from "@/lib/v2/kid-ops";
import { getHighScores } from "@/lib/v2/high-scores";
import { getArcade, getKidStreaks } from "@/lib/v2/streaks";
import { KidHome } from "../../_components/KidHome";

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
  const [view, highScores, streaks, arcade] = await Promise.all([
    getKidTodayView(ctx),
    getHighScores(household.id),
    getKidStreaks(ctx),
    getArcade(ctx),
  ]);

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

      {view ? (
        <KidHome slug={slug} view={view} streaks={streaks} arcade={arcade} highScores={highScores} preview />
      ) : (
        <p className="text-pp-muted text-center py-10">Couldn&apos;t load {kid.name}&apos;s view.</p>
      )}
    </div>
  );
}
