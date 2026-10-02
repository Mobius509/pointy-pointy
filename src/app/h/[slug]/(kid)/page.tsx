/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { getKidProfiles } from "@/lib/v2/data";
import { KidPicker } from "../_components/KidPicker";
import { KidStats } from "../_components/KidStats";
import { kidSignOutAction } from "../_actions/kid-session";
import { loadKidPage } from "../_lib/kid-page";

export const dynamic = "force-dynamic";


// The kid app's home (Stats) — or, signed out, "Who's here?" and a PIN.
export default async function KidViewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { household, home } = await loadKidPage(slug);

  if (home) return <KidStats slug={slug} home={home} />;

  // Not signed in — show kid picker + PIN.
  const kids = await getKidProfiles(household.id);
  return (
    <Shell slug={slug}>
      <div className="max-w-2xl mx-auto pt-6">
        {kids.length === 0 ? (
          <div className="bg-white rounded-[32px] p-6 text-center">
            <p className="text-pp-primary">
              A parent hasn&apos;t set up any kids yet. Ask them to log in
              and add you!
            </p>
          </div>
        ) : (
          <>
            {kids.length > 1 && (
              <h1 className="text-[32px] font-medium text-pp-primary text-center mb-4">
                Who&apos;s here?
              </h1>
            )}
            <KidPicker slug={household.slug} kids={kids} />
          </>
        )}
      </div>
    </Shell>
  );
}

// The signed-out page's plain frame (the signed-in app has its own — see
// KidChrome).
function Shell({
  children,
  slug,
}: {
  children: React.ReactNode;
  slug: string;
}) {
  return (
    <div
      className="relative min-h-screen flex flex-col bg-page"
    >
      <header className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-6 sm:px-8 py-5">
        <Link href="/" aria-label="Pointy Points home" className="group">
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
            href={`/h/${slug}/settings`}
            className="inline-flex items-center gap-1.5 font-semibold text-pp-primary hover:opacity-80"
          >
            <span className="underline underline-offset-4">Settings</span>
            <img
              src="/icons/Gear.svg"
              alt=""
              aria-hidden
              width={18}
              height={18}
              className="w-[18px] h-[18px]"
            />
          </Link>
          <form action={kidSignOutAction}>
            <input type="hidden" name="slug" value={slug} />
            <button
              type="submit"
              className="font-semibold text-pp-primary underline underline-offset-4 hover:opacity-80"
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
