import Link from "next/link";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-amber-50 via-orange-50 to-rose-50 text-slate-900 antialiased">
      <header className="px-4 sm:px-6 pt-5 sm:pt-6 pb-3 sm:pb-4 max-w-6xl mx-auto w-full">
        <Link href="/v1" className="inline-block group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/Logo_Full.svg"
            alt="Pointy Points"
            className="h-10 sm:h-12 w-auto group-hover:animate-wiggle"
          />
        </Link>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 pb-24">
        {children}
      </main>
      <footer className="text-center text-xs text-slate-400 pb-4">
        Made with 💛 for the family
      </footer>
    </div>
  );
}
