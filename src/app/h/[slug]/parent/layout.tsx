/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { requireHouseholdAccess } from "@/lib/v2/auth";
import { signOutAction } from "@/app/sign-in/_actions";
import { ParentNav } from "./_components/ParentNav";

export const dynamic = "force-dynamic";

export default async function ParentAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireHouseholdAccess(slug);

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{
        background: "linear-gradient(180deg, #E6BA9D 0%, #FFF2E9 100%)",
      }}
    >
      {/* Mobile (<sm): logo left, hamburger right (menu contains Sign Out).
          Desktop (sm+): logo left, pill nav center, Sign Out right. */}
      <header className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-6 sm:px-8 py-5">
        {/* LEFT slot — logo on every breakpoint. */}
        <Link href="/" aria-label="Pointy Points home" className="group">
          <img
            src="/logos/logo_badge.svg"
            alt="Pointy Points"
            width={28}
            height={42}
            className="w-7 h-[42px] group-hover:animate-wiggle"
          />
        </Link>

        {/* CENTER slot — pill nav on desktop only. */}
        <div className="justify-self-center hidden sm:block">
          <ParentNav slug={slug} variant="desktop" />
        </div>

        {/* RIGHT slot — hamburger on mobile, Sign Out on desktop. */}
        <div className="justify-self-end">
          <div className="sm:hidden">
            <ParentNav slug={slug} variant="mobile" />
          </div>
          <form action={signOutAction} className="hidden sm:block">
            <button
              type="submit"
              className="text-sm font-semibold text-orange-800 underline underline-offset-4 hover:text-orange-900"
            >
              Sign Out
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 pb-10">
        <div
          className="mx-auto w-full max-w-5xl bg-white/60 backdrop-blur-md p-6 sm:p-10"
          style={{ borderRadius: 32 }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
