import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

/**
 * Server-side Supabase client for use inside route handlers and server
 * components. Reads/writes the auth cookie via Next.js' cookies() store.
 */
export async function getServerSupabase() {
  const store = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            store.set(name, value, options);
          }
        } catch {
          // setAll throws in pure server components — safe to ignore there;
          // the middleware refreshes the session for the next request.
        }
      },
    },
  });
}

/**
 * Edge / middleware variant: takes the NextRequest+NextResponse pair so we
 * can mutate cookies on the response object directly.
 */
export function getMiddlewareSupabase(req: NextRequest, res: NextResponse) {
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          req.cookies.set(name, value);
          res.cookies.set(name, value, options);
        }
      },
    },
  });
}

/**
 * Convenience: returns the authenticated user or null. Use at the top of
 * every protected route handler.
 */
export async function getUser() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
