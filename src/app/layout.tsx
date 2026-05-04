import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pointy Points",
  description: "Earn points toward your big goal!",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fb923c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="px-4 sm:px-6 pt-5 sm:pt-6 pb-3 sm:pb-4 max-w-6xl mx-auto w-full">
            <Link href="/" className="inline-block group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/Logo_Full.svg"
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
      </body>
    </html>
  );
}
