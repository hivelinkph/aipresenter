"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  Mic,
  MicOff,
  Pause,
  Play,
} from "lucide-react";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase/client";
import type { PdfSourceBucket, SourceFile } from "@/lib/sources";
import { PdfThumbnails } from "./PdfThumbnails";

// Pin the worker to the same pdfjs version react-pdf bundles.
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

const BUCKET = "demo-sources";
const SIGNED_URL_TTL = 60 * 30;

interface Props {
  pushPdfPage: (
    pageIndex: number,
    total: number,
    pageText: string,
    narration?: string,
    isLastPage?: boolean,
    qaTransition?: string,
  ) => void;
  micMuted?: boolean;
  toggleMic?: () => void;
  pause?: () => void;
  resume?: () => void;
  setLiveAutoAdvance?: (enabled: boolean) => void;
  endDemo?: () => void;
}

export function PdfRuntime({ pushPdfPage, micMuted = false, toggleMic, pause, resume, setLiveAutoAdvance, endDemo }: Props) {
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
  const [showModal, setShowModal] = useState(false);
  const lastSentPageRef = useRef<number>(-1);

  const isLive = sessionState === "running" || sessionState === "paused";

  const pdfBucket = (sources.pdfs ?? { files: [] }) as PdfSourceBucket;
  const pageNarrations = pdfBucket.pageNarrations ?? [];
  const qaTransition = pdfBucket.qaTransition ?? "";
  const presenterName = pdfBucket.presenterName ?? "";
  const autoAdvance = !!pdfBucket.autoAdvance;

  // Resolve {presenterName} placeholder in Q&A transition
  const resolvedQaTransition = qaTransition.replace(
    /\{presenterName\}/g,
    presenterName || "the presenter",
  );

  const files: SourceFile[] = useMemo(
    () => pdfBucket.files ?? [],
    [pdfBucket.files],
  );

  // Default the active file
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

  // Resolve a signed URL
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

  // Fetch per-page text
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

  // When live + on a new page → push to Gemini
  useEffect(() => {
    if (!isLive) return;
    if (!pageTexts || pageTexts.length === 0) return;
    if (currentPageIndex < 0 || currentPageIndex >= pageTexts.length) return;
    if (lastSentPageRef.current === currentPageIndex) return;
    lastSentPageRef.current = currentPageIndex;
    const narration = pageNarrations[currentPageIndex] ?? "";
    const isLastPage = currentPageIndex === pageTexts.length - 1;
    pushPdfPage(
      currentPageIndex,
      pageTexts.length,
      pageTexts[currentPageIndex],
      narration || undefined,
      isLastPage,
      resolvedQaTransition || undefined,
    );
  }, [isLive, pageTexts, currentPageIndex, pageNarrations, resolvedQaTransition, pushPdfPage]);

  // Auto-open modal when demo starts, close when it ends
  useEffect(() => {
    if (sessionState === "running" && !showModal) {
      setShowModal(true);
    }
    if (sessionState === "ended" || sessionState === "idle") {
      setShowModal(false);
    }
  }, [sessionState]);

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

  // The PDF document component — shared between inline and modal
  const pdfDoc = (sizing: { width?: number; height?: number }) =>
    pdfUrl ? (
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
          {...sizing}
        />
      </Document>
    ) : (
      <div className="p-10 text-sm text-muted-foreground">
        Resolving file…
      </div>
    );

  return (
    <>
      {/* Inline preview (visible when modal is closed) */}
      <div className={`space-y-3 ${showModal ? "hidden" : ""}`}>
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
          {pdfDoc({
            width: Math.min(
              900,
              typeof window !== "undefined" ? window.innerWidth - 80 : 900,
            ),
          })}
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
              onClick={() => setShowModal(true)}
            >
              <Maximize className="h-4 w-4" /> Present
            </Button>
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

      {/* Full-screen modal overlay */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ backgroundColor: "#000" }}
        >
          {/* PDF fills the viewport — height-constrained so nothing clips */}
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            {pdfDoc({
              height:
                typeof window !== "undefined"
                  ? window.innerHeight - 56
                  : 800,
            })}
          </div>

          {/* Bottom control bar — edge to edge */}
          <div
            className="flex items-center justify-between px-4 shrink-0"
            style={{
              height: 56,
              background: "linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.6))",
            }}
          >
            <div className="text-sm font-mono text-gray-300">
              Page {totalPages > 0 ? currentPageIndex + 1 : 0} / {totalPages}
            </div>

            <div className="flex items-center gap-2">
              {setLiveAutoAdvance && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLiveAutoAdvance(!autoAdvance)}
                  className={autoAdvance ? "text-green-400 hover:bg-green-400/10" : "text-yellow-400 hover:bg-yellow-400/10"}
                >
                  {autoAdvance ? "Automatic Page" : "Manual Page"}
                </Button>
              )}
              {toggleMic && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleMic}
                  className={micMuted
                    ? "bg-red-600/80 text-white hover:bg-red-500 border border-red-500"
                    : "text-white hover:bg-white/10"
                  }
                  title={micMuted ? "Unmute microphone" : "Mute microphone"}
                >
                  {micMuted ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                  {micMuted ? "Muted" : "Mic"}
                </Button>
              )}
              {(pause || resume) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={sessionState === "paused" ? resume : pause}
                  className="text-white hover:bg-white/10"
                  title={sessionState === "paused" ? "Resume AI narration" : "Pause AI narration"}
                >
                  {sessionState === "paused" ? (
                    <>
                      <Play className="h-4 w-4 mr-1" /> Resume
                    </>
                  ) : (
                    <>
                      <Pause className="h-4 w-4 mr-1" /> Pause
                    </>
                  )}
                </Button>
              )}
              <div className="w-px h-6 bg-gray-600 mx-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={goPrev}
                disabled={currentPageIndex <= 0}
                className="text-white hover:bg-white/10 disabled:text-gray-600"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button
                size="sm"
                onClick={goNext}
                disabled={
                  totalPages === 0 || currentPageIndex >= totalPages - 1
                }
                className="bg-white/20 text-white hover:bg-white/30 disabled:bg-white/5 disabled:text-gray-600"
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="w-px h-6 bg-gray-600 mx-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white hover:bg-white/10"
              >
                <Minimize className="h-4 w-4" /> Minimize
              </Button>
              {endDemo && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={endDemo}
                  className="ml-2"
                >
                  End Demo
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
