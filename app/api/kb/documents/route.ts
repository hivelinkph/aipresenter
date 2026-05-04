import { NextResponse } from "next/server";
import { getServerSupabase, getUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const demoIdRaw = url.searchParams.get("demo_id");
  const scope = url.searchParams.get("scope"); // "demo" | "user" | "both" (default both)

  const supabase = await getServerSupabase();
  let q = supabase
    .from("kb_documents")
    .select(
      "id, demo_id, filename, mime, size_bytes, status, error, created_at",
    )
    .order("created_at", { ascending: false });

  if (demoIdRaw && scope === "demo") {
    q = q.eq("demo_id", demoIdRaw);
  } else if (scope === "user") {
    q = q.is("demo_id", null);
  } else if (demoIdRaw) {
    // both: this demo + user-wide
    q = q.or(`demo_id.eq.${demoIdRaw},demo_id.is.null`);
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ documents: data ?? [] });
}
