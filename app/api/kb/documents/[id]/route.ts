import { NextResponse } from "next/server";
import { getServerSupabase, getUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

const BUCKET = "kb-uploads";

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const supabase = await getServerSupabase();
  const { data: doc, error: fetchErr } = await supabase
    .from("kb_documents")
    .select("id, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!doc) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Best-effort Storage cleanup. Storage RLS already restricts to owner.
  if (doc.storage_path) {
    await supabase.storage.from(BUCKET).remove([doc.storage_path]);
  }

  // kb_chunks are removed by the FK ON DELETE CASCADE.
  const { error: deleteErr } = await supabase
    .from("kb_documents")
    .delete()
    .eq("id", id);
  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * Re-trigger the processing pipeline for a document that failed or got
 * stuck. Useful after fixing a transient Gemini outage.
 */
export async function POST(req: Request, { params }: Ctx) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const origin = new URL(req.url).origin;
  const cookie = req.headers.get("cookie") ?? "";
  const res = await fetch(`${origin}/api/kb/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ documentId: id }),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: error || res.statusText },
      { status: res.status },
    );
  }
  return NextResponse.json({ ok: true });
}
