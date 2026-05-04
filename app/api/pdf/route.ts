import { NextResponse } from "next/server";
import React from "react";
import { z } from "zod";
import { renderToStream } from "@react-pdf/renderer";
import { SummaryDocument } from "@/lib/pdf/summary";
import { getUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  targetUrl: z.string().url(),
  snapshot: z.object({
    targetUrl: z.string(),
    sections: z.array(z.object({ name: z.string(), summary: z.string() })),
    entries: z.array(
      z.object({
        id: z.string(),
        lane: z.enum(["ai", "human", "browser", "system", "presenter_note"]),
        text: z.string(),
        at: z.number(),
        section: z.string().optional(),
        screenshotDataUrl: z.string().optional(),
        qa: z
          .object({ question: z.string(), answerLane: z.enum(["ai", "human"]) })
          .optional(),
      }),
    ),
    startedAt: z.number().nullable(),
    endedAt: z.number().nullable(),
    durationMs: z.number(),
  }),
});

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { targetUrl, snapshot } = parsed.data;

  const element = React.createElement(SummaryDocument, {
    snapshot: { ...snapshot, targetUrl },
    targetUrl,
  });
  // renderToStream's type expects DocumentProps, but SummaryDocument returns a
  // <Document> internally — the runtime call is correct, the types just disagree.
  const stream = await renderToStream(element as unknown as Parameters<typeof renderToStream>[0]);

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="demo-summary-${Date.now()}.pdf"`,
    },
  });
}
