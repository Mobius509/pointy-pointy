/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmojiRain } from "@/app/welcome/_components/EmojiRain";
import { getFirstHouseholdForCurrentUser } from "@/lib/v2/auth";

export const metadata = {
  title: "Pointy Points — A new way to reward kids",
};

// If the user is already signed in, send them straight to their household.
// Otherwise show the marketing landing with sign-in / sign-up CTAs.
export default async function V2LandingPage() {
  const household = await getFirstHouseholdForCurrentUser();
  if (household) {
    redirect(`/v2/h/${household.slug}/parent`);
  }

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #E6BA9D 0%, #FFF2E9 100%)",
      }}
    >
      <EmojiRain />

      <header className="relative z-20 w-full flex items-center justify-between px-[36px] py-5 text-sm">
        <Link href="/v2" className="flex items-center gap-3 group">
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
        <nav className="flex items-center gap-5 text-orange-800 font-semibold">
          <Link
            href="/v2/sign-in"
            className="underline underline-offset-4 hover:text-orange-900"
          >
            Sign In
          </Link>
          <Link
            href="/v2/sign-up"
            className="underline underline-offset-4 hover:text-orange-900"
          >
            Sign Up
          </Link>
        </nav>
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

      <div
        id="signin"
        className="fixed bottom-0 inset-x-0 z-30 flex justify-center"
      >
        <div
          className="w-full max-w-2xl bg-white/60 backdrop-blur-md pt-20 pb-[60px] px-6 sm:px-[100px]"
          style={{ borderTopLeftRadius: 58, borderTopRightRadius: 58 }}
        >
          <Link
            href="/v2/sign-in"
            className="block mx-auto w-[280px] rounded-full bg-cyan-200 hover:bg-cyan-300 active:scale-[0.99] transition text-cyan-950 font-bold py-3 text-base text-center"
          >
            Sign In
          </Link>
          <Link
            href="/v2/sign-up"
            className="mt-3 block mx-auto w-[280px] rounded-full bg-cyan-200 hover:bg-cyan-300 active:scale-[0.99] transition text-cyan-950 font-bold py-3 text-base text-center"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
