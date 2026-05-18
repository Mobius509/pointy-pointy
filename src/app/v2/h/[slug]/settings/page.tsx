/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { clearKidSession, getKidSession } from "@/lib/v2/auth";
import { getKidProfile } from "@/lib/v2/data";
import { kidSignOutAction } from "../_actions/kid-session";
import { KidSettingsPanel } from "./_components/KidSettingsPanel";

export const dynamic = "force-dynamic";

export default async function KidSettingsPage({
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
  if (!session || session.householdId !== household.id) {
    // Bounce back to the picker — kids must sign in before tweaking settings.
    return (
      <Shell slug={slug}>
        <div className="max-w-2xl mx-auto pt-6">
          <div className="bg-white rounded-[32px] p-6 text-center">
            <p className="text-[#733405]">
              You need to sign in before you can change settings.
            </p>
            <Link
              href={`/v2/h/${slug}`}
              className="inline-block mt-4 rounded-full bg-[#FBE3CF] text-[#D45B00] font-semibold px-5 py-2 text-sm"
            >
              Go sign in
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  const kid = await getKidProfile(session.kidProfileId);
  if (!kid) {
    await clearKidSession();
    notFound();
  }

  return (
    <Shell slug={slug}>
      <div className="max-w-2xl mx-auto pt-6">
        <h1
          className="text-[#D45B00] mb-5 leading-none"
          style={{ fontSize: 32, fontWeight: 500 }}
        >
          Settings
        </h1>

        <KidSettingsPanel
          slug={slug}
          kidName={kid.name}
          initialAvatar={kid.avatar_emoji}
        />
      </div>
    </Shell>
  );
}

function Shell({
  children,
  slug,
}: {
  children: React.ReactNode;
  slug: string;
}) {
  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{
        background: "linear-gradient(180deg, #E6BA9D 0%, #FFF2E9 100%)",
      }}
    >
      <header className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-6 sm:px-8 py-5">
        <Link href={`/v2/h/${slug}`} aria-label="Pointy Points home" className="group">
          <img
            src="/logos/logo_badge.svg"
            alt="Pointy Points"
            width={28}
            height={42}
            className="w-7 h-[42px] group-hover:animate-wiggle"
          />
        </Link>
        <span aria-hidden />
        <div className="justify-self-end flex items-center gap-5 text-sm">
          <Link
            href={`/v2/h/${slug}`}
            className="font-semibold text-[#D45B00] underline underline-offset-4 hover:opacity-80"
          >
            Back
          </Link>
          <form action={kidSignOutAction}>
            <input type="hidden" name="slug" value={slug} />
            <button
              type="submit"
              className="font-semibold text-[#D45B00] underline underline-offset-4 hover:opacity-80"
            >
              Sign Out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 px-4 sm:px-6 pb-10">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
