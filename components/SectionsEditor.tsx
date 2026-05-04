"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranscript } from "@/lib/transcript";
import { useSession } from "@/lib/session";
import { Trash2, Plus } from "lucide-react";

export function SectionsEditor() {
  const sections = useTranscript((s) => s.sections);
  const setSections = useTranscript((s) => s.setSections);
  const state = useSession((s) => s.state);
  const locked = state === "running" || state === "paused" || state === "starting";

  function update(
    index: number,
    patch: { name?: string; summary?: string; narration?: string },
  ) {
    setSections(
      sections.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  }

  function remove(index: number) {
    setSections(sections.filter((_, i) => i !== index));
  }

  function add() {
    setSections([...sections, { name: "New section", summary: "", narration: "" }]);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Demo sections</Label>
        <Button size="sm" variant="outline" onClick={add} disabled={locked}>
          <Plus className="h-3 w-3" /> Add section
        </Button>
      </div>
      {sections.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Enter a URL and click "Discover features" to populate this list, or add sections manually.
        </p>
      )}
      <div className="space-y-4">
        {sections.map((s, i) => (
          <div key={i} className="rounded-md border p-3 space-y-2">
            <div className="flex gap-2 items-start">
              <Input
                value={s.name}
                placeholder="Section name"
                className="max-w-[220px] font-medium"
                onChange={(e) => update(i, { name: e.target.value })}
                disabled={locked}
              />
              <Input
                value={s.summary}
                placeholder="One-line summary of this section"
                className="flex-1"
                onChange={(e) => update(i, { summary: e.target.value })}
                disabled={locked}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => remove(i)}
                disabled={locked}
                aria-label="Remove section"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Narration script (AI will read this)
              </Label>
              <Textarea
                value={s.narration ?? ""}
                placeholder="Write or edit what the AI should say for this section…"
                className="min-h-[90px] mt-1"
                onChange={(e) => update(i, { narration: e.target.value })}
                disabled={locked}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
