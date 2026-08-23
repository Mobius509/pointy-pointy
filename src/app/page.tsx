/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmojiRain } from "@/app/welcome/_components/EmojiRain";
import { getFirstHouseholdForCurrentUser } from "@/lib/v2/auth";

export const metadata = {
  title: "Pointy Points — Reward system for kids",
};

const PURPLE = "#4730D9"; // primary indigo for buttons + text accents
const BLUE = "#3BAAF7"; // bright blue, right side of title gradient
const TITLE_GRADIENT = `linear-gradient(90deg, ${PURPLE} 0%, ${BLUE} 100%)`;
const BG_GRADIENT = "linear-gradient(180deg, #DCD9FB 0%, #F1F0FE 100%)";

// Marketing landing. Already-signed-in parents skip straight to their
// household admin; everyone else sees the title, the role-specific
// sign-in CTAs, and the floating emoji rain. EmojiRain wraps the page
// content so its back layer (z-0) and front layer (z-20) sandwich the
// white card (z-10) for depth — some emojis in front, some behind.
export default async function HomeLandingPage() {
  const household = await getFirstHouseholdForCurrentUser();
  if (household) {
    redirect(`/h/${household.slug}/parent`);
  }

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: BG_GRADIENT }}
    >
      <EmojiRain>
        {/* Desktop-only header — logo top-left, 'What is Pointy Points'
            top-right. On mobile the logo lives inside the card and there's
            no external header. z-30 keeps it above the front emoji layer. */}
        <header className="relative z-30 hidden sm:flex items-center justify-between px-6 sm:px-9 py-5 text-sm">
          <Link href="/" aria-label="Pointy Points home" className="group">
            <img
              src="/logos/logo_badge.svg"
              alt="Pointy Points"
              width={36}
              height={54}
              className="w-9 h-[54px] group-hover:animate-wiggle"
            />
          </Link>
          <Link
            href="#about"
            className="font-semibold underline underline-offset-4"
            style={{ color: PURPLE }}
          >
            What is Pointy Points
          </Link>
        </header>

        <main className="relative z-10 flex-1 flex flex-col items-center justify-center gap-4 sm:gap-0 px-4 sm:px-6 py-6 sm:py-12">
          <div className="w-full max-w-md min-h-[80vh] bg-white/55 backdrop-blur-md rounded-[32px] p-6 sm:p-10 text-center shadow-sm flex flex-col">
            {/* Top content — logo + title + subtitle. */}
            <div>
              <img
                src="/logos/logo_badge.svg"
                alt=""
                aria-hidden
                width={48}
                height={72}
                className="mx-auto w-12 h-[72px]"
              />

              {/* Title width is tuned to 276px (mobile) / 314px (desktop)
                  per the spec — font-size and fit-content hold the
                  wordmark to that footprint regardless of viewport. */}
              <h1
                className="mt-6 mx-auto font-black tracking-tight leading-[0.92] text-[76px] sm:text-[88px]"
                style={{
                  backgroundImage: TITLE_GRADIENT,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  width: "fit-content",
                }}
              >
                POINTY
                <br />
                POINTS
              </h1>

              <p
                className="mt-4 font-semibold text-base sm:text-lg"
                style={{ color: PURPLE }}
              >
                Reward system for kids
              </p>
            </div>

            {/* Buttons pinned to the bottom of the card on desktop, at
                the spec'd 324×64. mt-auto pushes them to the bottom of
                the 80vh card. Hidden on mobile (rendered outside). */}
            <div className="hidden sm:flex flex-col items-center gap-3 mt-auto">
              <Link
                href="/sign-in"
                className="inline-flex items-center justify-center rounded-2xl text-white font-semibold text-base transition hover:opacity-90 active:scale-[0.99]"
                style={{ width: 324, height: 64, background: PURPLE }}
              >
                Sign In (Parents)
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex items-center justify-center rounded-2xl text-white font-semibold text-base transition hover:opacity-90 active:scale-[0.99]"
                style={{ width: 324, height: 64, background: PURPLE }}
              >
                Sign In (Kids)
              </Link>
              <Link
                href="/sign-up"
                className="mt-1 font-semibold text-slate-900 underline-offset-4 hover:underline"
              >
                Sign Up
              </Link>
            </div>
          </div>

          {/* Buttons outside the card on mobile, at the spec'd 381×78.
              Capped to viewport width so they never overflow. */}
          <div className="flex sm:hidden flex-col items-center gap-3 w-full">
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center rounded-2xl text-white font-semibold text-base transition hover:opacity-90 active:scale-[0.99]"
              style={{
                width: 381,
                maxWidth: "100%",
                height: 78,
                background: PURPLE,
              }}
            >
              Sign In (Parents)
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center rounded-2xl text-white font-semibold text-base transition hover:opacity-90 active:scale-[0.99]"
              style={{
                width: 381,
                maxWidth: "100%",
                height: 78,
                background: PURPLE,
              }}
            >
              Sign In (Kids)
            </Link>
            <Link
              href="/sign-up"
              className="mt-1 font-semibold text-slate-900 underline-offset-4 hover:underline"
            >
              Sign Up
            </Link>
          </div>
        </main>
      </EmojiRain>
    </div>
  );
}
