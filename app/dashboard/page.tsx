"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus, Trash2, ExternalLink } from "lucide-react";

interface DemoRow {
  id: string;
  title: string;
  target_url: string;
  language: string;
  sections: Array<{ name: string; summary: string; narration?: string }>;
  role_names: string[];
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function DashboardHome() {
  const router = useRouter();
  const [demos, setDemos] = useState<DemoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/demos", { cache: "no-store" });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || res.statusText);
      }
      const { demos } = (await res.json()) as { demos: DemoRow[] };
      setDemos(demos);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function newDemo() {
    setCreating(true);
    try {
      const res = await fetch("/api/demos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Untitled demo",
          target_url: "",
          language: "English",
          sections: [],
          role_names: [],
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || res.statusText);
      }
      const { demo } = (await res.json()) as { demo: DemoRow };
      router.push(`/dashboard/demos/${demo.id}`);
    } catch (err) {
      setError((err as Error).message);
      setCreating(false);
    }
  }

  async function deleteDemo(id: string) {
    if (!confirm("Delete this demo and all its transcripts?")) return;
    const res = await fetch(`/api/demos/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setError(error || "Delete failed");
      return;
    }
    setDemos((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Demos</h1>
          <p className="text-sm text-muted-foreground">
            Saved demo configurations. Click one to run it, or create a new one.
          </p>
        </div>
        <Button onClick={newDemo} disabled={creating} size="lg">
          <Plus className="h-4 w-4" />{" "}
          {creating ? "Creating…" : "New demo"}
        </Button>
      </header>

      {error && (
        <div className="text-sm text-destructive">{error}</div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : demos.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No demos yet</CardTitle>
            <CardDescription>
              Click "New demo" to scaffold one. You'll add a target URL, demo
              sections, and any login roles on the next page.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {demos.map((d) => (
            <Card key={d.id} className="hover:bg-muted/40 transition-colors">
              <CardContent className="p-4 flex items-start gap-4">
                <Link
                  href={`/dashboard/demos/${d.id}`}
                  className="flex-1 min-w-0 space-y-1"
                >
                  <div className="font-semibold truncate">{d.title}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                    {d.target_url ? (
                      <>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">{d.target_url}</span>
                      </>
                    ) : (
                      <span className="italic">No target URL set</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {d.sections.length} section
                    {d.sections.length === 1 ? "" : "s"} · {d.language} · last
                    run {fmtDate(d.last_run_at)}
                  </div>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteDemo(d.id)}
                  aria-label="Delete demo"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
