import { NextResponse } from "next/server";
import { getServerSupabase, getUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getDocumentProxy } from "unpdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "demo-sources";

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/demos/:id/generate-narration
 *
 * Extracts text from the active PDF, sends all pages to the Gemini text
 * model, and returns an array of narration scripts (one per page).
 */
export async function POST(req: Request, { params }: Ctx) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: demoId } = await params;

  // Fetch demo to get the PDF file info + language
  const supabase = await getServerSupabase();
  const { data: demo, error: demoErr } = await supabase
    .from("demos")
    .select("language, sources")
    .eq("id", demoId)
    .maybeSingle();

  if (demoErr || !demo) {
    return NextResponse.json(
      { error: demoErr?.message ?? "Demo not found" },
      { status: 404 },
    );
  }

  const sources = (demo.sources ?? {}) as Record<string, unknown>;
  const pdfs = sources.pdfs as
    | { files?: Array<{ id: string; filename: string; storagePath: string }> }
    | undefined;
  const files = pdfs?.files ?? [];
  if (files.length === 0) {
    return NextResponse.json(
      { error: "No PDF files uploaded to this demo" },
      { status: 400 },
    );
  }

  // Use the first (primary) PDF file
  const file = files[0];

  // Optional: allow caller to specify a fileId
  const body = await req.json().catch(() => ({}));
  const targetFile =
    files.find((f) => f.id === body.fileId) ?? file;

  // Download PDF via admin client (handles RLS)
  const { data: blob, error: dlErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .download(targetFile.storagePath);

  if (dlErr || !blob) {
    return NextResponse.json(
      { error: dlErr?.message ?? "Could not download PDF" },
      { status: 500 },
    );
  }

  const buf = Buffer.from(await blob.arrayBuffer());

  // Extract per-page text
  let pageTexts: string[];
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const numPages = pdf.numPages;
    pageTexts = [];
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .filter((item) => "str" in item && typeof item.str === "string")
        .map((item) => (item as { str: string }).str)
        .join(" ")
        .trim();
      pageTexts.push(text);
    }
  } catch (err) {
    return NextResponse.json(
      { error: `PDF parse failed: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  // Build prompt for Gemini text model
  const language = demo.language || "English";
  const hasText = pageTexts.some((t) => t.length > 20);
  const pagesBlock = pageTexts
    .map(
      (text, i) =>
        `--- PAGE ${i + 1} ---\n${text || "(image-only page — no extractable text)"}`,
    )
    .join("\n\n");

  const prompt = [
    `You are a professional presentation script writer.`,
    hasText
      ? `Given the text content of a ${pageTexts.length}-page PDF presentation,`
      : `Given a ${pageTexts.length}-page PDF presentation (most pages are image-only with no extractable text),`,
    `generate a polished narration script for each page that a live AI presenter`,
    `will read verbatim to an audience.`,
    ``,
    `Rules:`,
    `- Write in ${language}`,
    `- Each page narration should be 2-4 paragraphs, conversational but professional`,
    hasText
      ? `- Reference specific data, figures, and key points from the page text`
      : `- For image-only pages, write a brief general introduction/transition (1-2 sentences) that the presenter can later customize with specific details`,
    `- Include natural transitions between concepts on the same page`,
    `- Do NOT include page numbers or headers like "Page 1:" in the narration text`,
    `- Do NOT include stage directions or speaker notes in brackets`,
    `- Write as if you're speaking directly to an audience`,
    ``,
    `Return your response as a JSON array of strings, where index 0 is page 1's narration,`,
    `index 1 is page 2's narration, etc. Return ONLY the JSON array, no other text.`,
    ``,
    `PDF content:`,
    pagesBlock,
  ].join("\n");

  // Call Gemini text model with retry + fallback
  const apiKey = process.env.GEMINI_API_KEY;
  const primaryModel = process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";
  const fallbackModels = [
    primaryModel,
    "gemini-2.0-flash",
    "gemini-1.5-flash",
  ];
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 500 },
    );
  }

  let lastError = "";
  for (const model of fallbackModels) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 8192,
              responseMimeType: "application/json",
            },
          }),
        },
      );

      if (res.status === 503 || res.status === 429) {
        lastError = `${model}: ${res.status} — model overloaded, trying next…`;
        console.warn(`[generate-narration] ${lastError}`);
        continue; // try fallback
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        lastError = `${model}: ${res.status} ${errText.slice(0, 200)}`;
        continue; // try fallback
      }

      const data = await res.json();
      const rawText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";

      // Parse the JSON array from the response
      let narrations: string[];
      try {
        // Strip markdown code fences if present
        const cleaned = rawText
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();
        narrations = JSON.parse(cleaned);
        if (!Array.isArray(narrations)) {
          throw new Error("Response is not an array");
        }
        narrations = narrations.map((n) =>
          typeof n === "string" ? n : String(n ?? ""),
        );
        while (narrations.length < pageTexts.length) {
          narrations.push("");
        }
      } catch {
        narrations = pageTexts.map(() => "");
        narrations[0] = rawText;
      }

      return NextResponse.json({
        narrations,
        totalPages: pageTexts.length,
        filename: targetFile.filename,
        model, // inform the client which model was used
      });
    } catch (err) {
      lastError = `${model}: ${(err as Error).message}`;
      continue;
    }
  }

  return NextResponse.json(
    { error: `All models failed. Last error: ${lastError}` },
    { status: 502 },
  );
}
