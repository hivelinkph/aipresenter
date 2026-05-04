import { NextResponse } from "next/server";
import { getServerSupabase, getUser } from "@/lib/supabase/server";
import { isSupportedMime, resolveMime } from "@/lib/kb/extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_MB = Number(process.env.KB_MAX_UPLOAD_MB ?? "25");
const MAX_BYTES = MAX_MB * 1024 * 1024;
const BUCKET = "kb-uploads";

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const file = form.get("file");
  const demoIdRaw = form.get("demo_id");
  const demoId =
    typeof demoIdRaw === "string" && demoIdRaw.length > 0 ? demoIdRaw : null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!demoId) {
    return NextResponse.json(
      { error: "Missing demo_id — KB documents are scoped per-demo." },
      { status: 400 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File exceeds ${MAX_MB} MB limit` },
      { status: 413 },
    );
  }

  const resolvedMime = resolveMime(file.type || "", file.name || "");
  if (!isSupportedMime(resolvedMime)) {
    return NextResponse.json(
      {
        error:
          "Unsupported file type. Allowed: PDF, DOCX, plain text (.txt/.md).",
      },
      { status: 415 },
    );
  }

  const supabase = await getServerSupabase();

  // Confirm the demo belongs to the caller before writing anything. RLS
  // already enforces this, but failing fast with a 403 here avoids
  // orphaned Storage objects on bad client input.
  const { data: ownsDemo } = await supabase
    .from("demos")
    .select("id")
    .eq("id", demoId)
    .maybeSingle();
  if (!ownsDemo) {
    return NextResponse.json(
      { error: "Demo not found or not yours" },
      { status: 403 },
    );
  }

  // Insert the row first so we have a stable id for the storage path.
  const { data: docRow, error: insertErr } = await supabase
    .from("kb_documents")
    .insert({
      owner_id: user.id,
      demo_id: demoId,
      filename: file.name,
      mime: resolvedMime,
      size_bytes: file.size,
      storage_path: "", // updated after upload
      status: "pending",
    })
    .select("id")
    .single();
  if (insertErr || !docRow) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Insert failed" },
      { status: 500 },
    );
  }

  const objectPath = `${user.id}/${docRow.id}/${sanitizeFilename(file.name)}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, buf, {
      contentType: resolvedMime,
      upsert: false,
    });
  if (uploadErr) {
    // Best-effort cleanup of the orphan row.
    await supabase.from("kb_documents").delete().eq("id", docRow.id);
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { error: pathUpdateErr } = await supabase
    .from("kb_documents")
    .update({ storage_path: objectPath })
    .eq("id", docRow.id);
  if (pathUpdateErr) {
    return NextResponse.json(
      { error: pathUpdateErr.message },
      { status: 500 },
    );
  }

  // Kick off the processing pipeline. Forward the auth cookie so the
  // process route's RLS context matches this user.
  fireProcessing(req, docRow.id);

  return NextResponse.json({
    document: { id: docRow.id, filename: file.name, status: "pending" },
  });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

function fireProcessing(req: Request, documentId: string) {
  // Build absolute URL from the incoming request so we hit the same origin
  // (works in dev + Vercel without hard-coding the host).
  const origin = new URL(req.url).origin;
  const cookie = req.headers.get("cookie") ?? "";
  // Best-effort fire-and-forget; we don't await.
  void fetch(`${origin}/api/kb/process`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie,
    },
    body: JSON.stringify({ documentId }),
    keepalive: true,
  }).catch(() => {
    // Swallow — the row is already pending; the user can re-trigger via UI.
  });
}
