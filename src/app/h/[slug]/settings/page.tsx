/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { getKidSession } from "@/lib/v2/auth";
import { getKidProfile } from "@/lib/v2/data";
import { getKidReminderTime } from "@/lib/v2/kid-ops";
import { getKidInitials } from "@/lib/v2/high-scores";
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
    .select("id, name, slug, timezone")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!household) notFound();

  // A session for a kid that's since been removed counts as signed out
  // (pages can't clear cookies; signing in again replaces it).
  const session = await getKidSession();
  const kid =
    session && session.householdId === household.id ? await getKidProfile(session.kidProfileId) : null;
  if (!kid) {
    return (
      <ModalShell slug={slug}>
        <p className="text-pp-primary">
          You need to sign in before you can change settings.
        </p>
        <Link
          href={`/h/${slug}`}
          className="inline-block mt-4 rounded-full bg-pp-tint text-pp-primary font-semibold px-5 py-2 text-sm"
        >
          Go sign in
        </Link>
      </ModalShell>
    );
  }

  const reminderTime = await getKidReminderTime({
    householdId: household.id as string,
    kidProfileId: kid.id,
    timezone: household.timezone as string,
  });

  return (
    <ModalShell slug={slug}>
      <KidSettingsPanel
        slug={slug}
        initialAvatar={kid.avatar_emoji}
        initialReminderTime={reminderTime}
        initialInitials={(await getKidInitials(household.id as string))[kid.id] ?? ""}
      />
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
      className="relative min-h-screen flex items-start justify-center px-4 py-10 sm:py-16 bg-page"
    >
      <div className="relative w-full max-w-2xl">
        <Link
          href={`/h/${slug}`}
          aria-label="Close settings"
          className="absolute top-5 right-5 z-10 inline-flex items-center justify-center size-9 rounded-full text-pp-primary hover:bg-pp-soft transition"
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
