import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mints an ephemeral auth token for the browser to open a Gemini Live WebSocket
 * without embedding GEMINI_API_KEY in the client. The Gemini Live "auth tokens"
 * endpoint returns a short-lived token; if it's unavailable in the caller's
 * region/plan, we fall back to returning the raw key (LOCAL-ONLY — guarded by
 * ALLOW_RAW_KEY=1). Never enable the fallback in a deployed environment.
 */
export async function POST() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_LIVE_MODEL ?? "gemini-3.1-flash-live-preview";

  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured on the server" },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1alpha/auth-tokens?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uses: 1,
          expireTime: new Date(Date.now() + 5 * 60_000).toISOString(),
        }),
      },
    );

    if (res.ok) {
      const data = (await res.json()) as { name?: string; token?: string };
      const token = data.token ?? data.name ?? null;
      if (token) {
        return NextResponse.json({ token, model, authMode: "ephemeral" });
      }
    }
  } catch {
    // fall through to local fallback
  }

  if (process.env.ALLOW_RAW_KEY === "1") {
    return NextResponse.json({ token: apiKey, model, authMode: "raw" });
  }

  return NextResponse.json(
    {
      error:
        "Could not mint ephemeral Gemini Live token. Set ALLOW_RAW_KEY=1 for local development only.",
    },
    { status: 502 },
  );
}
