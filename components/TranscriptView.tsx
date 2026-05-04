"use client";
import { useEffect, useRef } from "react";
import { useTranscript, type TranscriptLane } from "@/lib/transcript";
import { cn } from "@/lib/utils";

const LANE_STYLE: Record<TranscriptLane, string> = {
  ai: "text-sky-700 bg-sky-50 border-l-sky-500",
  human: "text-emerald-700 bg-emerald-50 border-l-emerald-500",
  browser: "text-violet-700 bg-violet-50 border-l-violet-500",
  system: "text-slate-500 bg-slate-50 border-l-slate-400",
  presenter_note: "text-amber-800 bg-amber-50 border-l-amber-500",
};

const LANE_LABEL: Record<TranscriptLane, string> = {
  ai: "AI",
  human: "Human",
  browser: "Browser",
  system: "System",
  presenter_note: "Note",
};

export function TranscriptView() {
  const entries = useTranscript((s) => s.entries);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        Transcript will appear here once the demo starts.
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2 max-h-[400px] overflow-y-auto">
      {entries.map((e) => (
        <div
          key={e.id}
          className={cn("border-l-4 px-3 py-2 rounded-sm text-sm", LANE_STYLE[e.lane])}
        >
          <div className="text-[10px] uppercase tracking-wide font-semibold opacity-70">
            {LANE_LABEL[e.lane]}
            {e.section ? ` · ${e.section}` : ""}
          </div>
          <div>{e.text}</div>
          {e.screenshotDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={e.screenshotDataUrl}
              alt="screenshot"
              className="mt-2 max-w-sm rounded border"
            />
          )}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
