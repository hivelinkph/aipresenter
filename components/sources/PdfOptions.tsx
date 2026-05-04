"use client";
import { useSession } from "@/lib/session";
import type { DemoSources } from "@/lib/sources";

export function PdfOptions() {
  const sources = useSession((s) => s.sources);
  const setSources = useSession((s) => s.setSources);
  const state = useSession((s) => s.state);
  const locked =
    state === "running" || state === "paused" || state === "starting";

  const autoAdvance = !!sources.pdfs?.autoAdvance;

  function toggle(checked: boolean) {
    const next: DemoSources = {
      ...sources,
      pdfs: {
        ...(sources.pdfs ?? { files: [] }),
        autoAdvance: checked,
      },
    };
    setSources(next);
  }

  return (
    <label className="flex items-start gap-3 cursor-pointer select-none rounded-md border border-input bg-background p-3">
      <input
        type="checkbox"
        checked={autoAdvance}
        onChange={(e) => toggle(e.target.checked)}
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
  );
}
