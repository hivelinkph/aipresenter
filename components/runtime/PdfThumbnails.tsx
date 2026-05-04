"use client";
import { useEffect, useRef } from "react";
import { Document, Page } from "react-pdf";
import { cn } from "@/lib/utils";

interface Props {
  pdfUrl: string;
  totalPages: number;
  currentPageIndex: number;
  onJump: (index: number) => void;
  /** Width of each thumbnail in pixels. */
  width?: number;
}

/**
 * Horizontal strip of page thumbnails. One <Document> instance is reused
 * across thumbnails (react-pdf caches the parsed document per url) and each
 * <Page> is rendered at low resolution. Click any thumbnail to jump.
 *
 * The active page is auto-scrolled into view whenever currentPageIndex
 * changes.
 */
export function PdfThumbnails({
  pdfUrl,
  totalPages,
  currentPageIndex,
  onJump,
  width = 96,
}: Props) {
  const stripRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const node = activeRef.current;
    if (!node) return;
    node.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [currentPageIndex]);

  if (totalPages <= 0) return null;

  return (
    <div
      ref={stripRef}
      className="flex items-stretch gap-2 overflow-x-auto py-2 px-1 border rounded-md bg-card/50"
    >
      <Document file={pdfUrl} loading={null} error={null}>
        {Array.from({ length: totalPages }).map((_, i) => {
          const active = i === currentPageIndex;
          return (
            <button
              key={i}
              ref={active ? activeRef : null}
              type="button"
              onClick={() => onJump(i)}
              className={cn(
                "shrink-0 rounded-md border bg-background overflow-hidden transition-all relative group",
                active
                  ? "border-secondary ring-2 ring-secondary/40"
                  : "border-border hover:border-secondary/60",
              )}
              aria-label={`Jump to page ${i + 1}`}
              aria-current={active ? "page" : undefined}
            >
              <Page
                pageNumber={i + 1}
                width={width}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                loading={
                  <div
                    style={{ width, height: width * 1.3 }}
                    className="bg-muted animate-pulse"
                  />
                }
              />
              <span
                className={cn(
                  "absolute bottom-0 left-0 right-0 text-[0.6rem] font-mono text-center py-0.5",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-background/85 text-muted-foreground group-hover:text-foreground",
                )}
              >
                {i + 1}
              </span>
            </button>
          );
        })}
      </Document>
    </div>
  );
}
