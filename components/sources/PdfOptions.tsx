"use client";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DemoSources, PdfSourceBucket } from "@/lib/sources";
import { Sparkles, Loader2 } from "lucide-react";

const DEFAULT_QA_TRANSITION =
  "We have completed the presentation. We now proceed to the question and answer part. Do you have any questions for me and {presenterName}?";

export function PdfOptions() {
  const demoId = useSession((s) => s.demoId);
  const sources = useSession((s) => s.sources);
  const setSources = useSession((s) => s.setSources);
  const state = useSession((s) => s.state);
  const locked =
    state === "running" || state === "paused" || state === "starting";

  const pdfBucket = (sources.pdfs ?? { files: [] }) as PdfSourceBucket;
  const autoAdvance = !!pdfBucket.autoAdvance;
  const pageNarrations = pdfBucket.pageNarrations ?? [];
  const presenterName = pdfBucket.presenterName ?? "";
  const qaTransition = pdfBucket.qaTransition ?? DEFAULT_QA_TRANSITION;

  // Detect page count from the first uploaded PDF
  const [detectedPages, setDetectedPages] = useState<number>(0);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const files = pdfBucket.files ?? [];
  const activeFileId = files[0]?.id;

  // Fetch page count when a PDF is available
  useEffect(() => {
    if (!activeFileId || !demoId) {
      setDetectedPages(0);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/demos/${demoId}/sources/file/${activeFileId}/pages`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const { total } = (await res.json()) as { total: number };
        if (!cancelled) setDetectedPages(total);
      } catch {
        // non-critical
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeFileId, demoId]);

  const pageCount = Math.max(detectedPages, pageNarrations.length);

  function updatePdfBucket(patch: Partial<PdfSourceBucket>) {
    const next: DemoSources = {
      ...sources,
      pdfs: { ...pdfBucket, ...patch },
    };
    setSources(next);
  }

  function toggleAutoAdvance(checked: boolean) {
    updatePdfBucket({ autoAdvance: checked });
  }

  function setNarration(pageIndex: number, text: string) {
    const arr = [...pageNarrations];
    while (arr.length <= pageIndex) arr.push("");
    arr[pageIndex] = text;
    updatePdfBucket({ pageNarrations: arr });
  }

  const generateNarrations = useCallback(async () => {
    if (!demoId || !activeFileId) return;
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch(`/api/demos/${demoId}/generate-narration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: activeFileId }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error);
      }
      const { narrations } = (await res.json()) as { narrations: string[] };
      updatePdfBucket({ pageNarrations: narrations });
    } catch (err) {
      setGenError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }, [demoId, activeFileId]);

  return (
    <div className="space-y-5">
      {/* Auto-advance toggle */}
      <label className="flex items-start gap-3 cursor-pointer select-none rounded-md border border-input bg-background p-3">
        <input
          type="checkbox"
          checked={autoAdvance}
          onChange={(e) => toggleAutoAdvance(e.target.checked)}
          disabled={locked}
          className="mt-0.5 h-4 w-4 accent-secondary cursor-pointer"
        />
        <span className="space-y-0.5">
          <span className="block text-sm font-medium leading-none">
            AI auto-advances pages
          </span>
          <span className="block text-xs text-muted-foreground">
            When on, the AI calls <code className="text-[0.7rem]">next_page</code>{" "}
            after it finishes narrating each page. When off, the human presenter
            advances manually with the Next button.
          </span>
        </span>
      </label>

      {/* Presenter Name & Q&A Transition */}
      <div className="rounded-md border border-input bg-background p-4 space-y-4">
        <h4 className="text-sm font-medium">Q&A Transition</h4>

        <div className="space-y-2">
          <Label htmlFor="presenterName">Human Presenter Name</Label>
          <Input
            id="presenterName"
            value={presenterName}
            onChange={(e) => updatePdfBucket({ presenterName: e.target.value })}
            placeholder="e.g. Jose, Dr. Santos"
            disabled={locked}
          />
          <p className="text-xs text-muted-foreground">
            Used in the Q&A transition after the presentation ends.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="qaTransition">Q&A Transition Script</Label>
          <Textarea
            id="qaTransition"
            value={qaTransition}
            onChange={(e) => updatePdfBucket({ qaTransition: e.target.value })}
            rows={3}
            disabled={locked}
            placeholder={DEFAULT_QA_TRANSITION}
          />
          <p className="text-xs text-muted-foreground">
            The AI reads this verbatim after narrating the last page.
            Use <code className="text-[0.7rem]">{"{presenterName}"}</code> as a
            placeholder for the presenter&apos;s name.
          </p>
        </div>
      </div>

      {/* Per-page narration editor */}
      {pageCount > 0 && (
        <div className="rounded-md border border-input bg-background p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">
              Page Narrations ({pageCount} pages)
            </h4>
            <Button
              variant="secondary"
              size="sm"
              onClick={generateNarrations}
              disabled={locked || generating || !activeFileId}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Narration
                </>
              )}
            </Button>
          </div>

          {genError && (
            <p className="text-xs text-destructive">⚠ {genError}</p>
          )}

          <p className="text-xs text-muted-foreground">
            Write the script the AI will read <strong>verbatim</strong> for each
            page. Leave a page blank to let the AI freestyle from the page text.
          </p>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {Array.from({ length: pageCount }, (_, i) => (
              <div key={i} className="space-y-1">
                <Label
                  htmlFor={`narration-${i}`}
                  className="text-xs font-mono text-muted-foreground"
                >
                  Page {i + 1}
                </Label>
                <Textarea
                  id={`narration-${i}`}
                  value={pageNarrations[i] ?? ""}
                  onChange={(e) => setNarration(i, e.target.value)}
                  rows={4}
                  disabled={locked}
                  placeholder={`Narration script for page ${i + 1}… (leave blank for AI freestyle)`}
                  className="text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {files.length > 0 && pageCount === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Detecting page count from the uploaded PDF…
        </p>
      )}
    </div>
  );
}
