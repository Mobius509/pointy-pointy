import type { Metadata, Viewport } from "next";
import { gotham } from "./fonts";
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
    <html lang="en" className={gotham.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
