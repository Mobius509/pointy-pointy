import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Session-aware Supabase client for the v2 (multi-family) app. Reads/writes
// the auth cookie via Next's cookies() so Server Components, Route Handlers,
// and Server Actions all share one signed-in session per request.
//
// Targets the `v2` Postgres schema by default — auth.* methods are unaffected
// since they hit Supabase's GoTrue endpoint, not PostgREST.
export async function createV2ServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: object }[],
        ) {
          // In Server Components cookies() is read-only and this throws — that's
          // fine, the middleware/Route Handler refresh path will pick it up.
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            /* ignore: read-only context */
          }
        },
      },
      db: { schema: "v2" },
    },
  );
}
