import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv, isDevAuthBypassEnabled } from "@/lib/env";

export async function updateSession(request: NextRequest) {
  if (isDevAuthBypassEnabled()) {
    if (request.nextUrl.pathname === "/sign-in") return NextResponse.redirect(new URL("/app", request.url));
    return NextResponse.next({ request });
  }
  let response = NextResponse.next({ request });
  const env = getPublicEnv();
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });
  const { data: { user } } = await supabase.auth.getUser();
  const protectedRoute = request.nextUrl.pathname.startsWith("/app");
  if (!user && protectedRoute) return NextResponse.redirect(new URL("/sign-in?reason=auth", request.url));
  if (user && request.nextUrl.pathname === "/sign-in") return NextResponse.redirect(new URL("/app", request.url));
  return response;
}
