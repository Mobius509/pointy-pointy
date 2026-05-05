import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session cookie on every /v2/* request, and
// redirects unauthenticated requests for /v2/h/<slug>/parent to /v2/sign-in.
//
// Marketing/auth pages (/v2, /v2/sign-in, /v2/sign-up) and the kid view
// (/v2/h/<slug>) are intentionally NOT auth-gated here — the parent gate
// is the only enforced redirect. The kid view does its own PIN check.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options?: object }[],
      ) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Triggers auth-cookie refresh as a side effect.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const parentMatch = path.match(/^\/v2\/h\/[^/]+\/parent/);
  if (parentMatch && !user) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/v2/sign-in";
    signIn.searchParams.set("next", path);
    return NextResponse.redirect(signIn);
  }

  return response;
}

// Only run on /v2/* paths so the existing app's routes are completely
// untouched by this middleware.
export const config = {
  matcher: ["/v2/:path*"],
};
