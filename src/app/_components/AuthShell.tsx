/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

// Shared chrome for marketing + auth pages: peach gradient, badge logo
// in the header, and a centered card slot for the form/landing content.
export function AuthShell({
  children,
  showSignInLink = true,
  showSignUpLink = true,
}: {
  children: React.ReactNode;
  showSignInLink?: boolean;
  showSignUpLink?: boolean;
}) {
  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{
        background: "#FFF2E9",
      }}
    >
      <header className="w-full flex items-center justify-between px-[36px] py-5 text-sm">
        <Link href="/" className="flex items-center gap-3 group">
          <img
            src="/logos/logo_badge.svg"
            alt="Pointy Points"
            width={21}
            height={32}
            className="w-[21px] h-[32px]"
          />
          <span className="hidden sm:inline text-orange-800 font-semibold underline underline-offset-4 hover:text-orange-900">
            Pointy Points
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-orange-800 font-semibold">
          {showSignInLink && (
            <Link
              href="/sign-in"
              className="underline underline-offset-4 hover:text-orange-900"
            >
              Sign In
            </Link>
          )}
          {showSignUpLink && (
            <Link
              href="/sign-up"
              className="underline underline-offset-4 hover:text-orange-900"
            >
              Sign Up
            </Link>
          )}
        </nav>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        {children}
      </main>
    </div>
  );
}
