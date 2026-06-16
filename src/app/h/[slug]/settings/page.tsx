/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { clearKidSession, getKidSession } from "@/lib/v2/auth";
import { getKidProfile } from "@/lib/v2/data";
import { KidSettingsPanel } from "./_components/KidSettingsPanel";

export const dynamic = "force-dynamic";

// Settings is shown as a modal-style panel — no header chrome (logo,
// back, sign-out are intentionally absent) and an X in the top-right
// returns to the kid view.
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
    return (
      <ModalShell slug={slug}>
        <p className="text-[#F2662A]">
          You need to sign in before you can change settings.
        </p>
        <Link
          href={`/h/${slug}`}
          className="inline-block mt-4 rounded-full bg-[#FBE3CF] text-[#F2662A] font-semibold px-5 py-2 text-sm"
        >
          Go sign in
        </Link>
      </ModalShell>
    );
  }

  const kid = await getKidProfile(session.kidProfileId);
  if (!kid) {
    await clearKidSession();
    notFound();
  }

  return (
    <ModalShell slug={slug}>
      <KidSettingsPanel slug={slug} initialAvatar={kid.avatar_emoji} />
    </ModalShell>
  );
}

// Outer overlay: faded gradient background, white card centered. The X
// link returns to the kid view, matching a real modal's close affordance.
function ModalShell({
  children,
  slug,
}: {
  children: React.ReactNode;
  slug: string;
}) {
  return (
    <div
      className="relative min-h-screen flex items-start justify-center px-4 py-10 sm:py-16"
      style={{
        background: "linear-gradient(180deg, #E6BA9D 0%, #FFF2E9 100%)",
      }}
    >
      <div className="relative w-full max-w-2xl">
        <Link
          href={`/h/${slug}`}
          aria-label="Close settings"
          className="absolute top-5 right-5 z-10 inline-flex items-center justify-center size-9 rounded-full text-[#F2662A] hover:bg-[#FAF4F0] transition"
        >
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            fill="none"
            className="size-5"
          >
            <path
              d="M5 5l10 10M15 5L5 15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </Link>
        {children}
      </div>
    </div>
  );
}
