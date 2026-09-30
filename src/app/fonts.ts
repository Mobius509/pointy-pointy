import { DM_Sans } from "next/font/google";

// DM Sans — the UI font everywhere. Variable weight, so every Tailwind
// weight (font-medium … font-black) renders true. Self-hosted by Next at
// build time; no request to Google from the browser.
export const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});
