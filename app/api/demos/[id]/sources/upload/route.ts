import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getServerSupabase, getUser } from "@/lib/supabase/server";
import { FILE_SOURCE_RULES } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "demo-sources";

interface Ctx {
  params: Promise<{ id: string }>;
}

type FileSource = "pdfs" | "pictures" | "powerPoint";
type SourceFileRecord = {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  storagePath: string;
  createdAt: string;
};

export async function POST(req: Request, { params }: Ctx) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: demoId } = await params;

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
  const sourceTypeRaw = form.get("source_type");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (
    typeof sourceTypeRaw !== "string" ||
    !(sourceTypeRaw in FILE_SOURCE_RULES)
  ) {
    return NextResponse.json(
      { error: "Invalid or missing source_type" },
      { status: 400 },
    );
  }
  const sourceType = sourceTypeRaw as FileSource;
  const rule = FILE_SOURCE_RULES[sourceType];
  if (file.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > rule.maxMB * 1024 * 1024) {
    return NextResponse.json(
      { error: `File exceeds ${rule.maxMB} MB limit` },
      { status: 413 },
    );
  }
  if (file.type && !rule.mimes.includes(file.type)) {
    // Be lenient: some browsers send empty/wrong mime. Only reject clearly
    // mismatched explicit values.
    if (file.type !== "application/octet-stream") {
      return NextResponse.json(
        { error: `Unsupported file type for ${sourceType}: ${file.type}` },
        { status: 415 },
      );
    }
  }
  const mime = rule.mimes.includes(file.type) ? file.type : rule.mimes[0];

  const supabase = await getServerSupabase();
  // Verify demo ownership.
  const { data: demoRow, error: demoErr } = await supabase
    .from("demos")
    .select("id, sources")
    .eq("id", demoId)
    .maybeSingle();
  if (demoErr) {
    return NextResponse.json({ error: demoErr.message }, { status: 500 });
  }
  if (!demoRow) {
    return NextResponse.json(
      { error: "Demo not found or not yours" },
      { status: 403 },
    );
  }

  const fileId = randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
  const storagePath = `${user.id}/${demoId}/${sourceType}/${fileId}-${safeName}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buf, { contentType: mime, upsert: false });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const record: SourceFileRecord = {
    id: fileId,
    filename: file.name,
    mime,
    sizeBytes: file.size,
    storagePath,
    createdAt: new Date().toISOString(),
  };

  // Append the new file to demos.sources[sourceType].files[].
  const sources = (demoRow.sources ?? {}) as Record<
    string,
    { files?: SourceFileRecord[] } | undefined
  >;
  const bucket = sources[sourceType] ?? { files: [] };
  const files = [...(bucket.files ?? []), record];
  const nextSources = { ...sources, [sourceType]: { ...bucket, files } };

  const { error: updErr } = await supabase
    .from("demos")
    .update({ sources: nextSources, updated_at: new Date().toISOString() })
    .eq("id", demoId);
  if (updErr) {
    // Best-effort cleanup of the orphan storage object.
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ file: record });
}
