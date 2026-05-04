import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase, getUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SectionSchema = z.object({
  name: z.string().min(1),
  summary: z.string().default(""),
  narration: z.string().optional(),
});

const SOURCE_TYPE_VALUES = [
  "pdfs",
  "pictures",
  "googleSlides",
  "powerPoint",
  "websites",
  "apps",
] as const;

const UpdateBody = z.object({
  title: z.string().min(1).max(200).optional(),
  target_url: z.string().optional(),
  language: z.enum(["English", "Tagalog", "Bisaya"]).optional(),
  sections: z.array(SectionSchema).optional(),
  role_names: z.array(z.string().min(1)).optional(),
  ground_to_kb: z.boolean().optional(),
  source_types: z.array(z.enum(SOURCE_TYPE_VALUES)).optional(),
  sources: z.record(z.string(), z.unknown()).optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Ctx) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("demos")
    .select(
      "id, title, target_url, language, sections, role_names, ground_to_kb, source_types, sources, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ demo: data });
}

export async function PUT(req: Request, { params }: Ctx) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = UpdateBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("demos")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(
      "id, title, target_url, language, sections, role_names, ground_to_kb, source_types, sources, created_at, updated_at",
    )
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ demo: data });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("demos").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
