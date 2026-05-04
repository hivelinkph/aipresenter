import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase, getUser } from "@/lib/supabase/server";
import { embedOne } from "@/lib/kb/embed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  query: z.string().min(1).max(2000),
  demoId: z.string().uuid().optional(),
  k: z.number().int().min(1).max(20).default(6),
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
  const { query, demoId, k } = parsed.data;

  let embedding: number[];
  try {
    embedding = await embedOne(query, { taskType: "RETRIEVAL_QUERY" });
  } catch (err) {
    return NextResponse.json(
      { error: `Embed failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc("match_kb_chunks", {
    query_embedding: `[${embedding.join(",")}]`,
    match_count: k,
    p_demo_id: demoId ?? null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const chunks = (data ?? []).map(
    (row: { chunk_text: string; similarity: number }) => ({
      text: row.chunk_text,
      similarity: row.similarity,
    }),
  );
  return NextResponse.json({ chunks });
}
