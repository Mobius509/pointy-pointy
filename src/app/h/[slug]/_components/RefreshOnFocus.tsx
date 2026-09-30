"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-fetches the page when the app comes back to the foreground, so
// approvals that happened while it sat in the background get celebrated
// (home-screen apps resume without reloading).
export function RefreshOnFocus() {
  const router = useRouter();
  useEffect(() => {
    let last = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - last < 10_000) return;
      last = Date.now();
      router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);
  return null;
}
