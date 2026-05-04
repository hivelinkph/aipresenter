import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase, getUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SnapshotSchema = z.object({
  targetUrl: z.string(),
  sections: z.array(
    z.object({
      name: z.string(),
      summary: z.string(),
      narration: z.string().optional(),
    }),
  ),
  entries: z.array(
    z.object({
      id: z.string(),
      lane: z.enum(["ai", "human", "browser", "system", "presenter_note"]),
      text: z.string(),
      at: z.number(),
      section: z.string().optional(),
      screenshotDataUrl: z.string().optional(),
      qa: z
        .object({
          question: z.string(),
          answerLane: z.enum(["ai", "human"]),
        })
        .optional(),
    }),
  ),
  startedAt: z.number().nullable(),
  endedAt: z.number().nullable(),
  durationMs: z.number(),
});

const Body = z.object({
  demoId: z.string().uuid().nullable(),
  targetUrl: z.string(),
  snapshot: SnapshotSchema,
});

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("transcripts")
    .insert({
      owner_id: user.id,
      demo_id: parsed.data.demoId,
      target_url: parsed.data.targetUrl,
      snapshot: parsed.data.snapshot,
      duration_ms: parsed.data.snapshot.durationMs,
    })
    .select("id, created_at")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ transcript: data });
}
