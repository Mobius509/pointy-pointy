"use client";

import { useLayoutEffect } from "react";

// Puts the kid's palette (CSS variables) on the page root while the kid
// app is showing, for what's drawn outside the kid layout's box: dialogs
// and celebrations (portalled to <body>) and the canvas games (which read
// the --pp-* colors from the root). Put back on the way out.
export function KidThemeRoot({ vars }: { vars: Record<string, string> }) {
  const key = JSON.stringify(vars);
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    const entries = Object.entries(JSON.parse(key) as Record<string, string>);
    const before = entries.map(([k]) => [k, root.getPropertyValue(k)] as const);
    for (const [k, v] of entries) root.setProperty(k, v);
    return () => {
      for (const [k, v] of before) (v ? root.setProperty(k, v) : root.removeProperty(k));
    };
  }, [key]);
  return null;
}
