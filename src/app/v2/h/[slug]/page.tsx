/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { getKidSession } from "@/lib/v2/auth";
import { getKidProfile, getKidProfiles } from "@/lib/v2/data";
import { KidPicker } from "./_components/KidPicker";
import { kidSignOutAction } from "./_actions/kid-session";

export const dynamic = "force-dynamic";

// Kid view entry point. Three states:
// 1. No household with this slug → 404.
// 2. No kid_session cookie (or cookie is for a different household) → kid picker + PIN.
// 3. Valid kid_session for this household → kid checklist (Day 5).
export default async function KidViewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: household, error } = await supabaseV2Admin
    .from("households")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!household) notFound();

  const session = await getKidSession();
  const sessionMatchesHousehold =
    session && session.householdId === household.id;

  if (!sessionMatchesHousehold) {
    const kids = await getKidProfiles(household.id);
    return (
      <Shell householdName={household.name as string}>
        <div className="max-w-2xl mx-auto">
          {kids.length === 0 ? (
            <div className="card text-center">
              <p className="text-slate-700">
                A parent hasn&apos;t set up any kids yet. Ask them to log in
                and add you!
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-orange-700 text-center mb-4">
                Who&apos;s here?
              </h1>
              <KidPicker slug={household.slug as string} kids={kids} />
            </>
          )}
        </div>
      </Shell>
    );
  }

  const kid = await getKidProfile(session.kidProfileId);
  if (!kid) {
    // Stale cookie — wipe and re-render.
    await (async () => {
      const { clearKidSession } = await import("@/lib/v2/auth");
      await clearKidSession();
    })();
    notFound();
  }

  return (
    <Shell householdName={household.name as string}>
      <div className="max-w-2xl mx-auto">
        <div className="card text-center">
          <span className="text-5xl" aria-hidden>
            {kid.avatar_emoji}
          </span>
          <h1 className="text-2xl font-extrabold text-orange-700 mt-2">
            Hi, {kid.name}!
          </h1>
          <p className="text-sm text-slate-600 mt-2">
            Your daily checklist will appear here next. (Coming soon.)
          </p>
          <form
            action={kidSignOutAction}
            className="mt-4 inline-block"
          >
            <input type="hidden" name="slug" value={household.slug as string} />
            <button type="submit" className="btn-secondary">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </Shell>
  );
}

function Shell({
  children,
  householdName,
}: {
  children: React.ReactNode;
  householdName: string;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-amber-50 via-orange-50 to-rose-50">
      <header className="px-4 sm:px-6 pt-5 sm:pt-6 pb-3 sm:pb-4 max-w-6xl mx-auto w-full flex items-center justify-between">
        <Link href="/v2" className="inline-block group">
          <img
            src="/logos/Logo_Full.svg"
            alt="Pointy Points"
            className="h-10 sm:h-12 w-auto group-hover:animate-wiggle"
          />
        </Link>
        <span className="text-sm font-semibold text-slate-700">
          {householdName}
        </span>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 pb-24 pt-2">
        {children}
      </main>
    </div>
  );
}
