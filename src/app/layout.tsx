import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pointy Pointy",
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
            <Link href="/" className="inline-flex items-center gap-2 sm:gap-3 group">
              <span className="text-3xl sm:text-4xl group-hover:animate-wiggle">
                🐶
              </span>
              <span className="text-2xl sm:text-3xl font-bold text-brand-700 tracking-tight">
                Pointy Pointy
              </span>
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
