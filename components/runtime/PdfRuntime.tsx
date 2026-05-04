"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase/client";
import type { SourceFile } from "@/lib/sources";
import { PdfThumbnails } from "./PdfThumbnails";

// Pin the worker to the same pdfjs version react-pdf bundles. Loading from
// unpkg keeps things zero-config; for production we'd self-host this.
// Guarded so this never runs during a server-side import.
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

const BUCKET = "demo-sources";
const SIGNED_URL_TTL = 60 * 30; // 30 minutes

interface Props {
  /**
   * Sends [PAGE n/total]: <text> to the live session whenever the active
   * page changes. Provided by useDemoOrchestrator.
   */
  pushPdfPage: (pageIndex: number, total: number, pageText: string) => void;
}

export function PdfRuntime({ pushPdfPage }: Props) {
  const demoId = useSession((s) => s.demoId);
  const sources = useSession((s) => s.sources);
  const sessionState = useSession((s) => s.state);
  const activePdfFileId = useSession((s) => s.activePdfFileId);
  const setActivePdfFileId = useSession((s) => s.setActivePdfFileId);
  const currentPageIndex = useSession((s) => s.currentPageIndex);
  const setCurrentPageIndex = useSession((s) => s.setCurrentPageIndex);
  const totalPages = useSession((s) => s.totalPages);
  const setTotalPages = useSession((s) => s.setTotalPages);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pageTexts, setPageTexts] = useState<string[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastSentPageRef = useRef<number>(-1);

  const isLive = sessionState === "running" || sessionState === "paused";

  const files: SourceFile[] = useMemo(
    () => sources.pdfs?.files ?? [],
    [sources.pdfs?.files],
  );

  // Default the active file to the first uploaded one whenever the list
  // changes and the previous selection is gone.
  useEffect(() => {
    if (files.length === 0) {
      if (activePdfFileId !== null) setActivePdfFileId(null);
      return;
    }
    if (!activePdfFileId || !files.some((f) => f.id === activePdfFileId)) {
      setActivePdfFileId(files[0].id);
    }
  }, [files, activePdfFileId, setActivePdfFileId]);

  const activeFile = useMemo(
    () => files.find((f) => f.id === activePdfFileId) ?? null,
    [files, activePdfFileId],
  );

  // Resolve a signed URL each time the active file changes.
  useEffect(() => {
    setLoadError(null);
    setPdfUrl(null);
    setPageTexts(null);
    lastSentPageRef.current = -1;
    if (!activeFile) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(activeFile.storagePath, SIGNED_URL_TTL);
      if (cancelled) return;
      if (error || !data?.signedUrl) {
        setLoadError(error?.message ?? "Could not load PDF.");
        return;
      }
      setPdfUrl(data.signedUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeFile]);

  // Fetch per-page text once per file. Independent of the URL signing flow
  // so a slow signed-URL provision doesn't delay page-text availability.
  useEffect(() => {
    if (!activeFile || !demoId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/demos/${demoId}/sources/file/${activeFile.id}/pages`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({}));
          throw new Error(error || res.statusText);
        }
        const { pages } = (await res.json()) as { pages: string[] };
        if (cancelled) return;
        setPageTexts(pages);
        if (pages.length > 0) setTotalPages(pages.length);
      } catch (err) {
        if (!cancelled) setLoadError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeFile, demoId, setTotalPages]);

  // When live + on a new page + we have the text → push it to Gemini.
  useEffect(() => {
    if (!isLive) return;
    if (!pageTexts || pageTexts.length === 0) return;
    if (currentPageIndex < 0 || currentPageIndex >= pageTexts.length) return;
    if (lastSentPageRef.current === currentPageIndex) return;
    lastSentPageRef.current = currentPageIndex;
    pushPdfPage(currentPageIndex, pageTexts.length, pageTexts[currentPageIndex]);
  }, [isLive, pageTexts, currentPageIndex, pushPdfPage]);

  function onDocumentLoad({ numPages }: { numPages: number }) {
    setTotalPages(numPages);
    if (currentPageIndex >= numPages) setCurrentPageIndex(0);
  }

  const goPrev = useCallback(() => {
    if (currentPageIndex > 0) setCurrentPageIndex(currentPageIndex - 1);
  }, [currentPageIndex, setCurrentPageIndex]);

  const goNext = useCallback(() => {
    if (currentPageIndex < totalPages - 1)
      setCurrentPageIndex(currentPageIndex + 1);
  }, [currentPageIndex, totalPages, setCurrentPageIndex]);

  if (files.length === 0) {
    return (
      <div className="text-sm text-muted-foreground border rounded-md p-4">
        No PDFs uploaded yet. Add one in the PDFs section above.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {files.length > 1 && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Presenting:</span>
          <select
            value={activePdfFileId ?? ""}
            onChange={(e) => {
              setActivePdfFileId(e.target.value);
              setCurrentPageIndex(0);
            }}
            disabled={isLive}
            className="flex h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            {files.map((f) => (
              <option key={f.id} value={f.id}>
                {f.filename}
              </option>
            ))}
          </select>
        </div>
      )}

      {pdfUrl && totalPages > 0 && (
        <PdfThumbnails
          pdfUrl={pdfUrl}
          totalPages={totalPages}
          currentPageIndex={currentPageIndex}
          onJump={(i) => setCurrentPageIndex(i)}
        />
      )}

      <div className="rounded-md border bg-card flex justify-center overflow-auto max-h-[70vh]">
        {pdfUrl ? (
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoad}
            onLoadError={(err) => setLoadError(err.message)}
            loading={
              <div className="p-10 text-sm text-muted-foreground">
                Loading PDF…
              </div>
            }
            error={
              <div className="p-10 text-sm text-destructive">
                Failed to load PDF.
              </div>
            }
          >
            <Page
              pageNumber={currentPageIndex + 1}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              width={Math.min(900, typeof window !== "undefined" ? window.innerWidth - 80 : 900)}
            />
          </Document>
        ) : (
          <div className="p-10 text-sm text-muted-foreground">
            Resolving file…
          </div>
        )}
      </div>

      {loadError && (
        <div className="text-sm text-destructive">{loadError}</div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-muted-foreground font-mono">
          Page {totalPages > 0 ? currentPageIndex + 1 : 0} / {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goPrev}
            disabled={currentPageIndex <= 0}
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={goNext}
            disabled={totalPages === 0 || currentPageIndex >= totalPages - 1}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
