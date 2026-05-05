import Link from "next/link";
import { requireHouseholdAccess } from "@/lib/v2/auth";
import { getKidProfiles } from "@/lib/v2/data";

export const dynamic = "force-dynamic";

export default async function ParentOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const household = await requireHouseholdAccess(slug);
  const kids = await getKidProfiles(household.id);

  return (
    <div className="space-y-4">
      <section className="card">
        <h2 className="text-lg font-bold text-slate-800">
          Welcome, {household.name}
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          {kids.length === 0
            ? "Get started by adding your first kid."
            : `${kids.length} ${kids.length === 1 ? "kid" : "kids"} set up. Tasks, goals, and bonuses live under the tabs above.`}
        </p>

        {kids.length === 0 && (
          <Link
            href={`/v2/h/${household.slug}/parent/kids`}
            className="btn-primary mt-3 inline-flex"
          >
            Add a kid
          </Link>
        )}
      </section>

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
                <span className="font-semibold">{k.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
