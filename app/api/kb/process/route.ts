import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase, getUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { extractText } from "@/lib/kb/extract";
import { chunk } from "@/lib/kb/chunk";
import { embedBatch } from "@/lib/kb/embed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  documentId: z.string().uuid(),
});

const BUCKET = "kb-uploads";
const CHUNK_TOKENS = Number(process.env.KB_CHUNK_TOKENS ?? "500");
const CHUNK_OVERLAP = Number(process.env.KB_CHUNK_OVERLAP ?? "50");

export async function POST(req: Request) {
  // The route is internal but still uses the caller's auth cookie so we
  // can confirm they own the document before granting service-role power
  // to insert rows under their owner_id.
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { documentId } = parsed.data;

  const supabase = await getServerSupabase();

  const { data: doc, error: docErr } = await supabase
    .from("kb_documents")
    .select("id, owner_id, demo_id, filename, mime, storage_path, status")
    .eq("id", documentId)
    .maybeSingle();
  if (docErr) {
    return NextResponse.json({ error: docErr.message }, { status: 500 });
  }
  if (!doc) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (doc.owner_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (doc.status === "ready" || doc.status === "embedding") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    // ---- 1. Download
    await markStatus(documentId, "extracting");
    const { data: blob, error: dlErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .download(doc.storage_path);
    if (dlErr || !blob) {
      throw new Error(`Storage download failed: ${dlErr?.message ?? "no blob"}`);
    }
    const buf = Buffer.from(await blob.arrayBuffer());

    // ---- 2. Extract
    const text = await extractText(buf, doc.mime, doc.filename);
    if (!text || text.length < 10) {
      throw new Error(
        `Extracted text is empty or too short (${text?.length ?? 0} chars)`,
      );
    }

    // ---- 3. Chunk
    const chunks = chunk(text, {
      size: CHUNK_TOKENS,
      overlap: CHUNK_OVERLAP,
    });
    if (chunks.length === 0) {
      throw new Error("Chunker produced no chunks");
    }

    // ---- 4. Embed
    await markStatus(documentId, "embedding");
    const vectors = await embedBatch(
      chunks.map((c) => c.text),
      { taskType: "RETRIEVAL_DOCUMENT" },
    );
    if (vectors.length !== chunks.length) {
      throw new Error(
        `Embedding count mismatch: got ${vectors.length}, expected ${chunks.length}`,
      );
    }

    // ---- 5. Insert chunks (service-role bypasses RLS; owner_id is taken
    // from the verified document, not the request payload).
    const rows = chunks.map((c, i) => ({
      document_id: documentId,
      owner_id: doc.owner_id,
      demo_id: doc.demo_id,
      chunk_index: i,
      chunk_text: c.text,
      token_count: c.tokenCount,
      embedding: vectors[i] as unknown as string,
    }));
    // pgvector via Supabase JS expects a string like "[0.1,0.2,...]".
    for (const r of rows) {
      const arr = r.embedding as unknown as number[];
      r.embedding = `[${arr.join(",")}]`;
    }

    // Insert in batches of 50 to stay well below row-size limits.
    const BATCH = 50;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      const { error: insertErr } = await supabaseAdmin
        .from("kb_chunks")
        .insert(slice);
      if (insertErr) {
        throw new Error(
          `kb_chunks insert failed at offset ${i}: ${insertErr.message}`,
        );
      }
    }

    await markStatus(documentId, "ready");
    return NextResponse.json({ ok: true, chunks: chunks.length });
  } catch (err) {
    const msg = (err as Error).message;
    await markStatus(documentId, "failed", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function markStatus(
  documentId: string,
  status: "pending" | "extracting" | "embedding" | "ready" | "failed",
  errorMsg?: string,
): Promise<void> {
  await supabaseAdmin
    .from("kb_documents")
    .update({
      status,
      error: status === "failed" ? errorMsg ?? null : null,
    })
    .eq("id", documentId);
}
