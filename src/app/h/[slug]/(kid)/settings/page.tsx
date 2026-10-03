/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { getKidReminderTime } from "@/lib/v2/kid-ops";
import { loadKidPage } from "../../_lib/kid-page";
import { ColorSlider } from "./_components/ColorSlider";
import { KidSettingsPanel } from "./_components/KidSettingsPanel";

export const dynamic = "force-dynamic";

// The kid's settings: their color, avatar, high-score initials, reminders.
// Inside the kid app's frame (bars, colors); signed out, a plain prompt to
// sign in.
export default async function KidSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { home, ctx } = await loadKidPage(slug);
  if (!home || !ctx) {
    return (
      <ModalShell slug={slug}>
        <div className="bg-white rounded-[32px] p-6">
          <p className="text-pp-primary">
            You need to sign in before you can change settings.
          </p>
          <Link
            href={`/h/${slug}`}
            className="inline-block mt-4 rounded-full bg-pp-tint text-pp-primary font-semibold px-5 py-2 text-sm"
          >
            Go sign in
          </Link>
        </div>
      </ModalShell>
    );
  }

  return (
    <div className="space-y-2.5 pt-2">
      <h1 className="px-3 text-[28px] font-medium text-kid-text">Settings</h1>
      <ColorSlider slug={slug} initialHue={home.hue} />
      <KidSettingsPanel
        slug={slug}
        initialAvatar={home.view.kid.avatar_emoji}
        initialReminderTime={await getKidReminderTime(ctx)}
        initialInitials={home.initials}
      />
    </div>
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
