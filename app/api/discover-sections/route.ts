import { NextResponse } from "next/server";
import { z } from "zod";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { getServerSupabase, getUser } from "@/lib/supabase/server";
import { embedOne } from "@/lib/kb/embed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BodySchema = z.object({
  url: z.string().url(),
  language: z.enum(["English", "Tagalog", "Bisaya"]).default("English"),
  demoId: z.string().uuid().optional(),
  kbScope: z.enum(["demo", "user", "both"]).default("both"),
});

const KB_TOP_K = 8;

const SectionsSchema = z.object({
  sections: z
    .array(
      z.object({
        name: z.string().min(1),
        summary: z.string().min(1),
        narration: z.string().min(1),
      }),
    )
    .min(1)
    .max(12),
});

async function fetchPageSnapshot(
  url: string,
): Promise<{ title: string; headings: string[]; navLinks: string[]; bodySample: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Presenter/0.1 (Section Discovery)" },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  const html = await res.text();

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch?.[1]?.trim() ?? url;

  const headings: string[] = [];
  for (const match of html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)) {
    const text = stripTags(match[1]).trim();
    if (text && text.length < 120) headings.push(text);
    if (headings.length >= 40) break;
  }

  const navLinks: string[] = [];
  const navMatch = html.match(/<nav[\s\S]*?<\/nav>/i);
  const source = navMatch?.[0] ?? html;
  for (const match of source.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = stripTags(match[1]).trim();
    if (text && text.length < 60) navLinks.push(text);
    if (navLinks.length >= 30) break;
  }

  const bodySample = stripTags(html).replace(/\s+/g, " ").slice(0, 2000);

  return { title, headings, navLinks, bodySample };
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const { url, language, demoId, kbScope } = parsed.data;

  let snapshot;
  try {
    snapshot = await fetchPageSnapshot(url);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Could not fetch URL: ${(err as Error).message}`,
        hint: "If this is a JS-heavy SPA, the local runtime's probe_site tool should be used instead.",
      },
      { status: 502 },
    );
  }

  // Best-effort KB grounding: fetch top-K chunks similar to the page snapshot.
  // If the user has no KB or the embedding/RPC fails, we silently fall back to
  // the snapshot-only prompt — discover must keep working with no KB.
  let kbChunks: Array<{ chunk_text: string; similarity: number }> = [];
  try {
    // Honor the per-demo "Ground responses to the knowledge base" toggle.
    let kbEnabled = true;
    if (demoId) {
      const supa = await getServerSupabase();
      const { data: demo } = await supa
        .from("demos")
        .select("ground_to_kb")
        .eq("id", demoId)
        .maybeSingle();
      kbEnabled = demo?.ground_to_kb !== false;
    }
    if (!kbEnabled) {
      throw new Error("kb-disabled-for-demo");
    }

    const groundingQuery = [
      snapshot.title,
      snapshot.headings.slice(0, 10).join(" "),
      snapshot.bodySample.slice(0, 500),
    ]
      .join("\n")
      .trim();
    if (groundingQuery.length > 0) {
      const embedding = await embedOne(groundingQuery, {
        taskType: "RETRIEVAL_QUERY",
      });
      const supabase = await getServerSupabase();
      // kbScope "demo" → only this demo's chunks (and the RPC's user-wide chunks).
      // "user" → only user-wide chunks (pass null demoId).
      // "both" (default) → demo-scoped + user-wide.
      const rpcDemoId =
        kbScope === "user" ? null : demoId ?? null;
      const { data, error } = await supabase.rpc("match_kb_chunks", {
        query_embedding: `[${embedding.join(",")}]`,
        match_count: KB_TOP_K,
        p_demo_id: rpcDemoId,
      });
      if (!error && Array.isArray(data)) {
        kbChunks = data as typeof kbChunks;
      }
    }
  } catch {
    // Swallow — grounding is opportunistic.
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured on the server" },
      { status: 500 },
    );
  }

  const modelId = process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";
  const google = createGoogleGenerativeAI({ apiKey });
  const model = google(modelId);

  const kbBlock =
    kbChunks.length > 0
      ? [
          `KNOWLEDGE BASE CONTEXT (the user uploaded these reference materials —`,
          `use these facts when drafting narration; weave them in naturally and`,
          `never quote chunk numbers or IDs aloud):`,
          ...kbChunks.map((c, i) => `[chunk ${i + 1}] ${c.chunk_text}`),
          ``,
        ].join("\n")
      : null;

  const promptLines: (string | null)[] = [
    `You are planning and SCRIPTING a live demo of the website at ${url}.`,
    `Propose 4 to 8 demo sections in the order a sales engineer should walk the audience through them.`,
    `Do not invent pages that aren't evident from the snapshot.`,
    ``,
    `Write the entire output (name, summary, narration) in ${language}. Keep proper nouns,`,
    `brand names, URLs, and on-screen English UI labels in their original form. The narration`,
    `will be read aloud verbatim by the AI presenter, so it must sound natural in ${language}.`,
    ``,
    `For each section provide:`,
    `- name: 2–5 words.`,
    `- summary: one sentence describing what this section is and what you'll demonstrate.`,
    `- narration: 3–6 sentences of ACTUAL spoken narration for the AI presenter to read`,
    `  aloud when they reach this section. Conversational tone, first person plural`,
    `  (the ${language} equivalent of "we'll"), specific to what the audience will see on`,
    `  screen. No filler openers like "now let's" / its ${language} equivalent.`,
    ``,
    kbBlock,
    `PAGE TITLE: ${snapshot.title}`,
    `NAV LINKS: ${snapshot.navLinks.slice(0, 30).join(" | ") || "(none detected)"}`,
    `HEADINGS: ${snapshot.headings.slice(0, 30).join(" | ") || "(none detected)"}`,
    ``,
    `BODY SAMPLE (first 2000 chars, tags stripped):`,
    snapshot.bodySample,
  ];
  const prompt = promptLines.filter((line): line is string => line !== null).join("\n");

  try {
    const { object } = await generateObject({
      model,
      schema: SectionsSchema,
      prompt,
      providerOptions: {
        google: {
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
          ],
        },
      },
    });
    return NextResponse.json(object);
  } catch (err) {
    return NextResponse.json(
      { error: `Gemini call failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }
}
