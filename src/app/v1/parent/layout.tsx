import Link from "next/link";
import { isParentUnlocked, isPinSet } from "@/lib/auth/pin";
import { lockAction } from "./_actions/auth";
import { PinSetup, PinUnlock } from "./_components/PinGate";

export const dynamic = "force-dynamic";

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pinSet = await isPinSet();
  const unlocked = await isParentUnlocked();

  if (!pinSet) return <PinSetup />;
  if (!unlocked) return <PinUnlock />;

  return (
    <div className="space-y-4 pt-2">
      <nav className="flex flex-wrap gap-2 text-sm">
        <NavLink href="/v1/parent">Overview</NavLink>
        <NavLink href="/v1/parent/tasks">Tasks</NavLink>
        <NavLink href="/v1/parent/bonus">Award bonus</NavLink>
        <NavLink href="/v1/parent/activity">Activity</NavLink>
        <NavLink href="/v1/parent/goal">Goal</NavLink>
        <NavLink href="/v1/parent/settings">Settings</NavLink>
        <form action={lockAction} className="ml-auto">
          <button className="btn-secondary" type="submit">
            🔒 Lock
          </button>
        </form>
      </nav>
      {children}
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
