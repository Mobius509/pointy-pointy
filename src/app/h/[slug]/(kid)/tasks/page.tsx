import { redirect } from "next/navigation";
import { V2DailyChecklist } from "../../_components/V2DailyChecklist";
import { V2KidProposal } from "../../_components/V2KidProposal";
import { loadKidPage } from "../../_lib/kid-page";

export const dynamic = "force-dynamic";

// The Tasks tab (the big ✓): today's checklist and "did something extra?".
// Today's pieces in the kid's colors; a full redesign is coming.
export default async function KidTasksPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { home } = await loadKidPage(slug);
  if (!home) redirect(`/h/${slug}`);
  return (
    <div className="space-y-2.5 pt-2">
      <h1 className="px-3 text-[28px] font-medium text-kid-text">Today&apos;s tasks</h1>
      <section className="rounded-[32px] bg-white p-3 sm:p-4">
        <div className="rounded-[26px] bg-white p-4">
          <V2DailyChecklist slug={slug} items={home.view.items} />
        </div>
      </section>
      <V2KidProposal slug={slug} pendingProposals={home.view.pendingProposals} />
    </div>
  );
}
