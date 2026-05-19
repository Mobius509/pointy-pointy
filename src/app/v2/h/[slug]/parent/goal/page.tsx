/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { requireHouseholdAccess } from "@/lib/v2/auth";
import {
  getActiveGoalForKid,
  getAllGoalsForKid,
  getKidGoalProgress,
  getKidProfiles,
  getMilestonesForGoal,
} from "@/lib/v2/data";
import { avatarSrc } from "@/lib/avatar";
import {
  redeemGoalAction,
  startNewGoalAction,
  updateGoalAction,
} from "../_actions/goal";
import { MilestonesManager } from "../_components/MilestonesManager";
import { PageTitle, SectionPill, SectionTitle } from "../_components/ui";

export const dynamic = "force-dynamic";

export default async function ParentGoalPage({
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

  if (kids.length === 0) {
    return (
      <div className="space-y-6 text-[14px]">
        <PageTitle>Goal</PageTitle>
        <section className="card-warm">
          <SectionTitle>Goals</SectionTitle>
          <p className="text-[#C3A38A] mt-2">
            Add at least one kid first in Settings.
          </p>
        </section>
      </div>
    );
  }

  const selectedKid = kids.find((k) => k.id === kidParam) ?? kids[0];
  const active = await getActiveGoalForKid(household.id, selectedKid.id);
  const all = await getAllGoalsForKid(household.id, selectedKid.id);
  const progress = active
    ? await getKidGoalProgress(household.id, selectedKid.id, active)
    : 0;
  const milestones = active
    ? await getMilestonesForGoal(household.id, active.id)
    : [];

  return (
    <div className="space-y-6 text-[14px]">
      <PageTitle>Goal</PageTitle>

      <KidPicker
        slug={slug}
        kids={kids}
        selectedId={selectedKid.id}
        basePath="/parent/goal"
      />

      {active ? (
        <section className="card-warm">
          <SectionPill>
            <span className="inline-flex items-center gap-1.5">
              Active goal ·
              <img
                src={avatarSrc(selectedKid.avatar_emoji)}
                alt=""
                aria-hidden
                className="w-4 h-4 object-contain"
              />
              {selectedKid.name}
            </span>
          </SectionPill>
          <form
            action={updateGoalAction}
            className="mt-4 grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end"
          >
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={active.id} />
            <div>
              <label className="label-warm">Name</label>
              <input
                name="name"
                defaultValue={active.name}
                required
                className="input-warm"
              />
            </div>
            <div>
              <label className="label-warm">Target points</label>
              <input
                name="target_points"
                type="number"
                min={1}
                max={1_000_000}
                defaultValue={active.target_points}
                required
                className="input-warm"
              />
            </div>
            <button type="submit" className="btn-warm-secondary">
              Save
            </button>
          </form>
          <div className="mt-4 text-[#C3A38A]">
            Progress so far:{" "}
            <span className="font-semibold text-[#D45B00] tabular-nums">
              {progress.toLocaleString()} /{" "}
              {active.target_points.toLocaleString()}
            </span>
          </div>
          <form action={redeemGoalAction} className="mt-4">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={active.id} />
            <button type="submit" className="btn-warm-danger">
              Mark redeemed (archive)
            </button>
          </form>
        </section>
      ) : null}

      {active && (
        <MilestonesManager
          slug={slug}
          goal={active}
          progress={progress}
          milestones={milestones}
        />
      )}

      {!active && (
        <section className="card-warm">
          <SectionTitle>No active goal</SectionTitle>
          <p className="text-[#C3A38A] mt-2">
            Start a new one for {selectedKid.name} below.
          </p>
        </section>
      )}

      <section className="card-warm">
        <SectionPill>Start a new goal for {selectedKid.name}</SectionPill>
        <p className="text-[#C3A38A] mt-2">
          Closes any active goal and starts fresh. Past completions stay in
          the activity log.
        </p>
        <form
          action={startNewGoalAction}
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end"
        >
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="kid_profile_id" value={selectedKid.id} />
          <div>
            <label className="label-warm">Name</label>
            <input
              name="name"
              required
              className="input-warm"
              placeholder="Trip to the trampoline park"
            />
          </div>
          <div>
            <label className="label-warm">Target points</label>
            <input
              name="target_points"
              type="number"
              min={1}
              max={1_000_000}
              defaultValue={1000}
              required
              className="input-warm"
            />
          </div>
          <button type="submit" className="btn-warm-primary">
            Start goal
          </button>
        </form>
      </section>

      <section className="card-warm">
        <SectionPill>History · {selectedKid.name}</SectionPill>
        {all.length === 0 ? (
          <p className="mt-4 text-slate-500 italic">No goals yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {all.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span className="min-w-0">
                  <span className="font-medium text-slate-800">{g.name}</span>
                  <span className="block text-xs text-[#C3A38A]">
                    Started {new Date(g.started_at).toLocaleDateString()}
                    {g.redeemed_at &&
                      ` · Redeemed ${new Date(g.redeemed_at).toLocaleDateString()}`}
                  </span>
                </span>
                <span className="font-semibold text-[#D45B00] tabular-nums">
                  {g.target_points.toLocaleString()} pts
                  {!g.redeemed_at && (
                    <span className="ml-2 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs">
                      active
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function KidPicker({
  slug,
  kids,
  selectedId,
  basePath,
}: {
  slug: string;
  kids: Awaited<ReturnType<typeof getKidProfiles>>;
  selectedId: string;
  basePath: string;
}) {
  if (kids.length <= 1) return null;
  return (
    <section className="card-warm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-[#C3A38A]">Viewing:</span>
        {kids.map((k) => (
          <Link
            key={k.id}
            href={`/v2/h/${slug}${basePath}?kid=${k.id}`}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ring-1 transition ${
              k.id === selectedId
                ? "bg-[#FBE3CF] text-[#D45B00] ring-[#F1D1BD] font-semibold"
                : "bg-white text-[#C3A38A] ring-[#F1D1BD] hover:bg-[#FFF7EE]"
            }`}
          >
            <img
              src={avatarSrc(k.avatar_emoji)}
              alt=""
              aria-hidden
              className="w-4 h-4 object-contain"
            />
            {k.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
