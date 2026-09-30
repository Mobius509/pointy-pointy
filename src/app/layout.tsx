import type { Metadata, Viewport } from "next";
import { dmSans } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pointy Points",
  description: "Earn points toward your big goal!",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Browser chrome color — matches --pp-bg-top in globals.css (meta tags
  // can't read CSS variables).
  themeColor: "#DCD9FB",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
