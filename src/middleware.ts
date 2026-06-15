import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session cookie on /h/* requests, and redirects
// unauthenticated requests for /h/<slug>/parent to /sign-in.
//
// Marketing/auth pages (/, /sign-in, /sign-up) and the kid view (/h/<slug>)
// are intentionally NOT auth-gated here — the parent gate is the only
// enforced redirect. The kid view does its own PIN check.
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
  const parentMatch = path.match(/^\/h\/[^/]+\/parent/);
  if (parentMatch && !user) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/sign-in";
    signIn.searchParams.set("next", path);
    return NextResponse.redirect(signIn);
  }

  return response;
}

// Only run on /h/* so we don't burn server cycles refreshing cookies on
// marketing/auth pages or static asset requests.
export const config = {
  matcher: ["/h/:path*"],
};
