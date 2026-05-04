"use client";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";
import { useTranscript } from "@/lib/transcript";
import { Play, Pause, Square, RotateCcw, Repeat } from "lucide-react";

interface Props {
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onReset: () => void;
  onRerun: () => void;
}

export function DemoControls({
  onStart,
  onPause,
  onResume,
  onEnd,
  onReset,
  onRerun,
}: Props) {
  const state = useSession((s) => s.state);
  const targetUrl = useSession((s) => s.targetUrl);
  const sectionCount = useTranscript((s) => s.sections.length);
  const presentationMode = useSession((s) => s.presentationMode);
  const pdfFileCount = useSession((s) => s.sources.pdfs?.files?.length ?? 0);
  // PDF-mode demos run inline in the browser — they just need a PDF
  // uploaded. Website-mode still requires a URL + at least one section.
  const canStart =
    (state === "ready" || state === "idle") &&
    (presentationMode === "pdf"
      ? pdfFileCount > 0
      : sectionCount > 0 && targetUrl.trim().length > 0);
  const isRunning = state === "running";
  const isPaused = state === "paused";
  const isLive = isRunning || isPaused || state === "starting" || state === "ending";

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {!isLive && state !== "ended" && (
        <Button onClick={onStart} disabled={!canStart} size="lg">
          <Play className="h-4 w-4" /> START DEMO
        </Button>
      )}
      {isRunning && (
        <Button onClick={onPause} variant="outline" size="lg">
          <Pause className="h-4 w-4" /> Pause (I'll take this)
        </Button>
      )}
      {isPaused && (
        <Button onClick={onResume} size="lg">
          <Play className="h-4 w-4" /> Resume AI
        </Button>
      )}
      {isLive && (
        <Button onClick={onEnd} variant="destructive" size="lg">
          <Square className="h-4 w-4" /> END DEMO
        </Button>
      )}
      {state === "ended" && (
        <>
          <Button onClick={onRerun} size="lg">
            <Repeat className="h-4 w-4" /> Rerun Demo
          </Button>
          <Button onClick={onReset} variant="outline">
            <RotateCcw className="h-4 w-4" /> Clear session
          </Button>
        </>
      )}
    </div>
  );
}
