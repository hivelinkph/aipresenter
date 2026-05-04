import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hard cap on what we'll inline into the live system prompt. The prompt
// is re-sent on every reconnect, so keep it conservative.
const MAX_CHARS = 6000;

export async function GET(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const demoId = url.searchParams.get("demo_id");
  if (!demoId) {
    return NextResponse.json({ error: "demo_id required" }, { status: 400 });
  }

  // Service-role + explicit owner_id filter mirrors the KB process route:
  // we've verified the caller, then read across RLS to pull both demo-scoped
  // and user-wide chunks in deterministic order.
  const { data, error } = await supabaseAdmin
    .from("kb_chunks")
    .select("chunk_text, chunk_index, demo_id")
    .eq("owner_id", user.id)
    .or(`demo_id.eq.${demoId},demo_id.is.null`)
    .order("chunk_index", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Array<{ chunk_text: string }>;
  const collected: string[] = [];
  let used = 0;
  for (const row of rows) {
    const t = (row.chunk_text ?? "").trim();
    if (!t) continue;
    if (used + t.length > MAX_CHARS) {
      const remaining = MAX_CHARS - used;
      if (remaining > 200) collected.push(t.slice(0, remaining));
      break;
    }
    collected.push(t);
    used += t.length;
  }

  return NextResponse.json({
    chunks: collected,
    totalAvailable: rows.length,
    truncated: collected.length < rows.length,
  });
}
