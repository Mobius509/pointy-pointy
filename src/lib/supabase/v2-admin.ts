import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client for v2. Bypasses RLS — use only after the caller has
// been authenticated, or for operations that legitimately need elevated
// privileges (sign-up flow creating a household + member, kid PIN verification).

type V2Client = ReturnType<typeof build>;

let _client: V2Client | null = null;

function build() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "v2" },
  });
}

export const supabaseV2Admin: V2Client = new Proxy({} as V2Client, {
  get(_target, prop, receiver) {
    if (!_client) _client = build();
    return Reflect.get(_client, prop, receiver);
  },
});
