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

const CreateBody = z.object({
  // A freshly scaffolded demo has empty title/url — users fill them in on the
  // next page. Don't require min(1) here.
  title: z.string().max(200).default("Untitled demo"),
  target_url: z.string().default(""),
  language: z.enum(["English", "Tagalog", "Bisaya"]).default("English"),
  sections: z.array(SectionSchema).default([]),
  role_names: z.array(z.string().min(1)).default([]),
  ground_to_kb: z.boolean().default(true),
  pacing: z.enum(["slow", "moderate", "fast"]).default("moderate"),
  source_types: z
    .array(z.enum(SOURCE_TYPE_VALUES))
    .default(["websites"]),
  sources: z.record(z.string(), z.unknown()).default({}),
});

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("demos")
    .select(
      "id, title, target_url, language, sections, role_names, ground_to_kb, pacing, source_types, sources, created_at, updated_at",
    )
    .order("updated_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Best-effort: pull last-run timestamp per demo for the list.
  const ids = (data ?? []).map((d) => d.id);
  let lastRunByDemo: Record<string, string> = {};
  if (ids.length > 0) {
    const { data: runs } = await supabase
      .from("transcripts")
      .select("demo_id, created_at")
      .in("demo_id", ids)
      .order("created_at", { ascending: false });
    for (const r of runs ?? []) {
      if (r.demo_id && !lastRunByDemo[r.demo_id]) {
        lastRunByDemo[r.demo_id] = r.created_at;
      }
    }
  }

  return NextResponse.json({
    demos: (data ?? []).map((d) => ({
      ...d,
      last_run_at: lastRunByDemo[d.id] ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const json = await req.json().catch(() => ({}));
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("demos")
    .insert({
      owner_id: user.id,
      title: parsed.data.title,
      target_url: parsed.data.target_url,
      language: parsed.data.language,
      sections: parsed.data.sections,
      role_names: parsed.data.role_names,
      ground_to_kb: parsed.data.ground_to_kb,
      pacing: parsed.data.pacing,
      source_types: parsed.data.source_types,
      sources: parsed.data.sources,
    })
    .select(
      "id, title, target_url, language, sections, role_names, ground_to_kb, pacing, source_types, sources, created_at, updated_at",
    )
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ demo: data });
}
