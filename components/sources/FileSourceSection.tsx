"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Trash2, FileText } from "lucide-react";
import { useSession } from "@/lib/session";
import type { DemoSources, SourceFile } from "@/lib/sources";
import { FILE_SOURCE_RULES } from "@/lib/sources";

type FileSourceKey = "pdfs" | "pictures" | "powerPoint";

interface Props {
  sourceKey: FileSourceKey;
  label: string;
  helper?: string;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function FileSourceSection({ sourceKey, label, helper }: Props) {
  const demoId = useSession((s) => s.demoId);
  const sources = useSession((s) => s.sources);
  const setSources = useSession((s) => s.setSources);
  const state = useSession((s) => s.state);
  const locked =
    state === "running" || state === "paused" || state === "starting";
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rule = FILE_SOURCE_RULES[sourceKey];
  const files: SourceFile[] =
    (sources[sourceKey] as { files?: SourceFile[] } | undefined)?.files ?? [];

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !demoId) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("source_type", sourceKey);
      const res = await fetch(`/api/demos/${demoId}/sources/upload`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || res.statusText);
      }
      const { file: rec } = (await res.json()) as { file: SourceFile };
      const bucket = (sources[sourceKey] as { files?: SourceFile[] }) ?? {};
      const next: DemoSources = {
        ...sources,
        [sourceKey]: { ...bucket, files: [...(bucket.files ?? []), rec] },
      };
      setSources(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(fileId: string) {
    if (!demoId) return;
    if (!confirm("Remove this file from the demo?")) return;
    setError(null);
    const res = await fetch(
      `/api/demos/${demoId}/sources/file/${fileId}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setError(error || "Delete failed");
      return;
    }
    const bucket = (sources[sourceKey] as { files?: SourceFile[] }) ?? {};
    const next: DemoSources = {
      ...sources,
      [sourceKey]: {
        ...bucket,
        files: (bucket.files ?? []).filter((f) => f.id !== fileId),
      },
    };
    setSources(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-0.5">
          <Label>{label}</Label>
          {helper && (
            <p className="text-xs text-muted-foreground">{helper}</p>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={rule.accept}
          onChange={onPick}
          className="hidden"
        />
        <Button
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={busy || locked || !demoId}
        >
          <Upload className="h-4 w-4" />
          {busy ? "Uploading…" : "Upload file"}
        </Button>
      </div>
      {error && <div className="text-sm text-destructive">{error}</div>}
      {files.length === 0 ? (
        <div className="text-xs text-muted-foreground border rounded-md p-3">
          No files yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 border rounded-md p-3"
            >
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate" title={f.filename}>
                  {f.filename}
                </div>
                <div className="text-xs text-muted-foreground">
                  {fmtBytes(f.sizeBytes)}
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onDelete(f.id)}
                disabled={locked}
                aria-label="Remove file"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
