import { NextResponse, type NextRequest } from "next/server";
import { getMiddlewareSupabase } from "@/lib/supabase/server";

const PUBLIC_PATHS = ["/", "/login", "/signup", "/auth/callback"];

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PATHS.some(
    (p) => p !== "/" && (pathname === p || pathname.startsWith(`${p}/`)),
  );
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = getMiddlewareSupabase(req, res);

  // Refresh the session cookie on every request — required for @supabase/ssr.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = req.nextUrl;

  // Logged-in users on /login or /signup → bounce to dashboard.
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Anonymous users on protected routes:
  //  - API routes → return JSON 401 so clients don't get HTML back.
  //  - Pages       → redirect to /login.
  if (!user && !isPublic(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  // Match every route except Next.js internals + common static asset extensions.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|map)).*)",
  ],
};
