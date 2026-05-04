"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Upload, Trash2, RefreshCw, FileText } from "lucide-react";
import { useSession } from "@/lib/session";

interface DocRow {
  id: string;
  demo_id: string | null;
  filename: string;
  mime: string;
  size_bytes: number;
  status: "pending" | "extracting" | "embedding" | "ready" | "failed";
  error: string | null;
  created_at: string;
}

const TERMINAL = new Set(["ready", "failed"]);
const POLL_MS = 2000;
const ACCEPT =
  "application/pdf," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
  "text/plain,text/markdown,.pdf,.docx,.txt,.md";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function statusVariant(
  status: DocRow["status"],
): "default" | "secondary" | "destructive" {
  if (status === "ready") return "default";
  if (status === "failed") return "destructive";
  return "secondary";
}

interface Props {
  demoId: string;
  onGroundToggleSaved?: () => void;
}

export function DemoKnowledgeBase({ demoId, onGroundToggleSaved }: Props) {
  const groundToKb = useSession((s) => s.groundToKb);
  const setGroundToKb = useSession((s) => s.setGroundToKb);

  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingToggle, setSavingToggle] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const res = await fetch(
        `/api/kb/documents?demo_id=${encodeURIComponent(demoId)}&scope=demo`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || res.statusText);
      }
      const { documents } = (await res.json()) as { documents: DocRow[] };
      setDocs(documents);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // demoId is stable for the lifetime of this page mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoId]);

  // Poll while any doc is non-terminal.
  useEffect(() => {
    const hasPending = docs.some((d) => !TERMINAL.has(d.status));
    if (!hasPending) return;
    const t = window.setInterval(() => {
      void load();
    }, POLL_MS);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("demo_id", demoId);
      const res = await fetch("/api/kb/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || res.statusText);
      }
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this document and all its chunks?")) return;
    setError(null);
    const res = await fetch(`/api/kb/documents/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setError(error || "Delete failed");
      return;
    }
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }

  async function onRetry(id: string) {
    setError(null);
    const res = await fetch(`/api/kb/documents/${id}`, { method: "POST" });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setError(error || "Retry failed");
      return;
    }
    await load();
  }

  async function onToggleGround(checked: boolean) {
    setGroundToKb(checked);
    setSavingToggle(true);
    setError(null);
    try {
      const res = await fetch(`/api/demos/${demoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ground_to_kb: checked }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || res.statusText);
      }
      onGroundToggleSaved?.();
    } catch (err) {
      setError((err as Error).message);
      // Roll back the optimistic update.
      setGroundToKb(!checked);
    } finally {
      setSavingToggle(false);
    }
  }

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 cursor-pointer select-none rounded-md border border-input bg-background p-3">
        <input
          type="checkbox"
          checked={groundToKb}
          onChange={(e) => onToggleGround(e.target.checked)}
          disabled={savingToggle}
          className="mt-0.5 h-4 w-4 accent-secondary cursor-pointer"
        />
        <span className="space-y-0.5">
          <span className="block text-sm font-medium leading-none">
            Ground responses to the knowledge base.
          </span>
          <span className="block text-xs text-muted-foreground">
            When enabled, the AI cites these documents during section discovery
            and live Q&amp;A. When off, behavior reverts to vanilla narration.
          </span>
        </span>
      </label>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-0.5">
          <Label className="text-xs text-muted-foreground">
            Documents for this demo
          </Label>
          <p className="text-xs text-muted-foreground">
            PDF · DOCX · .txt · .md — up to 25 MB each.
          </p>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          onChange={onUpload}
          className="hidden"
        />
        <Button
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          variant="outline"
        >
          <Upload className="h-4 w-4" />
          {uploading ? "Uploading…" : "Upload file"}
        </Button>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : docs.length === 0 ? (
        <div className="text-sm text-muted-foreground border rounded-md p-4">
          No documents yet — uploads here ground only this demo.
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div
              key={d.id}
              className="flex items-start gap-3 border rounded-md p-3"
            >
              <FileText className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="text-sm font-medium truncate" title={d.filename}>
                  {d.filename}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                  <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                  <span>{fmtBytes(d.size_bytes)}</span>
                </div>
                {d.status === "failed" && d.error && (
                  <div className="text-xs text-destructive break-words">
                    {d.error}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                {d.status === "failed" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onRetry(d.id)}
                    aria-label="Retry processing"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onDelete(d.id)}
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
