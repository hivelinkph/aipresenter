import { NextResponse } from "next/server";
import { getServerSupabase, getUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "demo-sources";

interface Ctx {
  params: Promise<{ id: string; fileId: string }>;
}

type SourceFileRecord = {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  storagePath: string;
  createdAt: string;
};

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: demoId, fileId } = await params;

  const supabase = await getServerSupabase();
  const { data: demo, error: demoErr } = await supabase
    .from("demos")
    .select("id, sources")
    .eq("id", demoId)
    .maybeSingle();
  if (demoErr) {
    return NextResponse.json({ error: demoErr.message }, { status: 500 });
  }
  if (!demo) {
    return NextResponse.json(
      { error: "Demo not found or not yours" },
      { status: 403 },
    );
  }

  // Find the file across all source-type buckets, capture its storage path,
  // and remove it from the jsonb.
  const sources = (demo.sources ?? {}) as Record<
    string,
    { files?: SourceFileRecord[] } | undefined
  >;
  let storagePath: string | null = null;
  const next: typeof sources = {};
  for (const [type, bucket] of Object.entries(sources)) {
    if (!bucket || !Array.isArray(bucket.files)) {
      next[type] = bucket;
      continue;
    }
    const filtered: SourceFileRecord[] = [];
    for (const f of bucket.files) {
      if (f.id === fileId) {
        storagePath = f.storagePath;
      } else {
        filtered.push(f);
      }
    }
    next[type] = { ...bucket, files: filtered };
  }

  if (!storagePath) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Remove from Storage (best-effort) then update the row.
  await supabase.storage.from(BUCKET).remove([storagePath]);
  const { error: updErr } = await supabase
    .from("demos")
    .update({ sources: next, updated_at: new Date().toISOString() })
    .eq("id", demoId);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
