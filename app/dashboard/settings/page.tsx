"use client";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useSettings,
  VOICE_OPTIONS,
  DEFAULT_PERSONA,
  type VoiceId,
} from "@/lib/settings";

export default function SettingsPage() {
  const voice = useSettings((s) => s.voice);
  const modelId = useSettings((s) => s.modelId);
  const persona = useSettings((s) => s.persona);
  const setVoice = useSettings((s) => s.setVoice);
  const setModelId = useSettings((s) => s.setModelId);
  const setPersona = useSettings((s) => s.setPersona);
  const resetPersona = useSettings((s) => s.resetPersona);
  const hydrate = useSettings((s) => s.hydrate);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (!res.ok) throw new Error(res.statusText);
        const { settings } = (await res.json()) as {
          settings: {
            voice: string | null;
            model_id: string | null;
            persona: string | null;
          } | null;
        };
        if (cancelled) return;
        if (settings) hydrate(settings);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  async function save() {
    setSaving("saving");
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice,
          model_id: modelId,
          persona,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || res.statusText);
      }
      setSaving("saved");
      setTimeout(() => setSaving("idle"), 1500);
    } catch (err) {
      setError((err as Error).message);
      setSaving("idle");
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          These preferences apply to all of your demos. Changes save to your
          account.
        </p>
      </header>

      {error && <div className="text-sm text-destructive">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Voice</CardTitle>
          <CardDescription>
            Which Gemini Live voice the AI presenter uses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-2">
            {VOICE_OPTIONS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVoice(v.id as VoiceId)}
                className={`text-left rounded-md border p-3 transition-colors ${
                  voice === v.id
                    ? "border-secondary bg-secondary/10"
                    : "border-border hover:bg-muted"
                }`}
              >
                <div className="font-medium">{v.id}</div>
                <div className="text-xs text-muted-foreground">{v.blurb}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Model</CardTitle>
          <CardDescription>
            The Gemini Live model ID. Defaults to{" "}
            <code className="text-xs">gemini-3.1-flash-live-preview</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="model">Model ID</Label>
          <Input
            id="model"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder="gemini-3.1-flash-live-preview"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Narrator persona</CardTitle>
          <CardDescription>
            Prepended to every demo's system prompt. Sets the AI's tone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            className="min-h-[120px]"
          />
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetPersona}
              disabled={persona === DEFAULT_PERSONA}
            >
              Reset to default
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={loading || saving === "saving"} size="lg">
          {saving === "saving"
            ? "Saving…"
            : saving === "saved"
            ? "Saved"
            : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
