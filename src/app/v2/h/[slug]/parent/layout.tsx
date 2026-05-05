/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { requireHouseholdAccess } from "@/lib/v2/auth";
import { signOutAction } from "@/app/v2/sign-in/_actions";

export const dynamic = "force-dynamic";

export default async function ParentAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const household = await requireHouseholdAccess(slug);
  const base = `/v2/h/${household.slug}/parent`;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-amber-50 via-orange-50 to-rose-50 text-slate-900 antialiased">
      <header className="px-4 sm:px-6 pt-5 sm:pt-6 pb-3 sm:pb-4 max-w-6xl mx-auto w-full flex items-center justify-between gap-3">
        <Link
          href={`/v2/h/${household.slug}`}
          className="inline-block group"
          aria-label="Kid view"
        >
          <img
            src="/logos/Logo_Full.svg"
            alt="Pointy Points"
            className="h-10 sm:h-12 w-auto group-hover:animate-wiggle"
          />
        </Link>
        <div className="text-sm text-slate-600">
          <span className="font-semibold text-slate-800">{household.name}</span>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 pb-24">
        <nav className="flex flex-wrap gap-2 text-sm pt-2 mb-4">
          <NavLink href={base}>Overview</NavLink>
          <NavLink href={`${base}/tasks`}>Tasks</NavLink>
          <NavLink href={`${base}/kids`}>Kids</NavLink>
          <NavLink href={`${base}/bonus`}>Award bonus</NavLink>
          <NavLink href={`${base}/activity`}>Activity</NavLink>
          <NavLink href={`${base}/goal`}>Goal</NavLink>
          <NavLink href={`${base}/settings`}>Settings</NavLink>
          <form action={signOutAction} className="ml-auto">
            <button className="btn-secondary" type="submit">
              Sign out
            </button>
          </form>
        </nav>
        {children}
      </main>

      <footer className="text-center text-xs text-slate-400 pb-4">
        Made with 💛 for the family
      </footer>
    </div>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50"
    >
      {children}
    </Link>
  );
}
