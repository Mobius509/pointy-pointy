import { NextResponse, type NextRequest } from "next/server";
import { createV2ServerClient } from "@/lib/supabase/v2-server";

// Supabase redirects here after email confirmation / magic link / OAuth.
// We exchange the `code` query param for a session and forward to `next`
// (or /v2 if none).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/v2";

  if (code) {
    const supabase = await createV2ServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
