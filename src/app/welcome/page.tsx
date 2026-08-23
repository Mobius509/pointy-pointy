/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFirstHouseholdForCurrentUser } from "@/lib/v2/auth";
import { EmojiRain } from "./_components/EmojiRain";
import { AuthModalControls } from "./_components/AuthModal";

export const metadata = {
  title: "Pointy Points — A new way to reward kids",
};

// Public marketing page + entry point for v2. Already-signed-in parents skip
// straight to their household admin.
export default async function WelcomePage() {
  const household = await getFirstHouseholdForCurrentUser();
  if (household) {
    redirect(`/h/${household.slug}/parent`);
  }

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{
        background: "#FFF2E9",
      }}
    >
      <EmojiRain />

      <header className="relative z-20 w-full flex items-center justify-between px-[36px] py-5 text-sm">
        <Link href="/welcome" className="flex items-center gap-3 group">
          <img
            src="/logos/logo_badge.svg"
            alt="Pointy Points"
            width={21}
            height={32}
            className="w-[21px] h-[32px]"
          />
          <span className="hidden sm:inline text-orange-800 font-semibold underline underline-offset-4 hover:text-orange-900">
            What is Pointy Points
          </span>
        </Link>
        {/* Right side of the header (Sign In / Sign Up) is rendered by the
            client AuthModalControls component below so taps open the modal. */}
      </header>

      <main className="relative z-20 flex-1 flex flex-col items-center justify-center px-6 pb-[300px] text-center">
        <img
          src="/logos/logo_badge.svg"
          alt=""
          aria-hidden
          width={45}
          height={68}
          className="w-[45px] h-[68px]"
        />
        <img
          src="/logos/Logo_Type.svg"
          alt="Pointy Points"
          className="mt-4 w-[200px] sm:w-[260px]"
        />
        <p className="mt-5 text-base sm:text-lg text-orange-900/80 font-medium">
          A new way to reward kids
        </p>
      </main>

      <AuthModalControls />
    </div>
  );
}
