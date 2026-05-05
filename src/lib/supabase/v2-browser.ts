"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client for v2. Used by client components that need
// to call auth methods (sign-in/up/out) — DB queries should generally go
// through Server Actions instead so RLS + service-role logic stays server-side.
export function createV2BrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: "v2" } },
  );
}
