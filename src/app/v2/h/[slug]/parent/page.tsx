import Link from "next/link";
import { requireHouseholdAccess } from "@/lib/v2/auth";
import {
  getHouseholdPendingCompletions,
  getKidProfiles,
} from "@/lib/v2/data";
import { AwardBonusButton } from "./_components/AwardBonusButton";
import { PendingApprovals } from "./_components/PendingApprovals";

export const dynamic = "force-dynamic";

export default async function ParentOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const household = await requireHouseholdAccess(slug);
  const kids = await getKidProfiles(household.id);
  const pending = await getHouseholdPendingCompletions(household.id);

  return (
    <div className="space-y-4">
      <section className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              Welcome, {household.name}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {kids.length === 0
                ? "Get started by adding your first kid in Settings."
                : `${kids.length} ${kids.length === 1 ? "kid" : "kids"} set up. Manage tasks and goals in the tabs above.`}
            </p>
          </div>
          {kids.length === 0 ? (
            <Link
              href={`/v2/h/${household.slug}/parent/settings`}
              className="btn-primary"
            >
              Add a kid
            </Link>
          ) : (
            <AwardBonusButton slug={slug} kids={kids} />
          )}
        </div>
      </section>

      {kids.length > 0 && (
        <PendingApprovals slug={slug} items={pending} kids={kids} />
      )}

      {kids.length > 0 && (
        <section className="card">
          <h3 className="text-lg font-bold text-slate-800 mb-3">Your kids</h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {kids.map((k) => (
              <li
                key={k.id}
                className="flex items-center gap-3 rounded-xl bg-white ring-1 ring-slate-200 p-3"
              >
                <span className="text-3xl" aria-hidden>
                  {k.avatar_emoji}
                </span>
                <span className="font-semibold flex-1">{k.name}</span>
                <Link
                  href={`/v2/h/${household.slug}/parent/goal?kid=${k.id}`}
                  className="text-xs font-semibold text-brand-700 hover:underline"
                >
                  Goal →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
