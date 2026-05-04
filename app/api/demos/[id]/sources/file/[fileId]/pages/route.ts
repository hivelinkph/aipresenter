import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { getServerSupabase, getUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "demo-sources";

interface Ctx {
  params: Promise<{ id: string; fileId: string }>;
}

type SourceFile = {
  id: string;
  filename: string;
  storagePath: string;
  mime: string;
};

/**
 * Extract per-page text from a PDF source file. Used by the live PDF runtime
 * to ground each page's narration. Streams as a single JSON response since
 * full text is small relative to the audio session.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: demoId, fileId } = await params;
  const supabase = await getServerSupabase();

  const { data: demo, error: demoErr } = await supabase
    .from("demos")
    .select("sources")
    .eq("id", demoId)
    .maybeSingle();
  if (demoErr) {
    return NextResponse.json({ error: demoErr.message }, { status: 500 });
  }
  if (!demo) {
    return NextResponse.json({ error: "Demo not found" }, { status: 403 });
  }

  // Find the file record across source-type buckets in demos.sources.
  const sources = (demo.sources ?? {}) as Record<
    string,
    { files?: SourceFile[] } | undefined
  >;
  let target: SourceFile | undefined;
  for (const bucket of Object.values(sources)) {
    if (!bucket?.files) continue;
    const found = bucket.files.find((f) => f.id === fileId);
    if (found) {
      target = found;
      break;
    }
  }
  if (!target) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  if (target.mime !== "application/pdf") {
    return NextResponse.json(
      { error: "Not a PDF file" },
      { status: 415 },
    );
  }

  const { data: blob, error: dlErr } = await supabase.storage
    .from(BUCKET)
    .download(target.storagePath);
  if (dlErr || !blob) {
    return NextResponse.json(
      { error: dlErr?.message ?? "Storage download failed" },
      { status: 500 },
    );
  }

  const buf = Buffer.from(await blob.arrayBuffer());
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    const result = await parser.getText();
    const pages = result.pages
      .sort((a, b) => a.num - b.num)
      .map((p) => p.text.trim());
    return NextResponse.json({
      filename: target.filename,
      pages,
      total: pages.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `PDF parse failed: ${(err as Error).message}` },
      { status: 500 },
    );
  } finally {
    await parser.destroy();
  }
}
