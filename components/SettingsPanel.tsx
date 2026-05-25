"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSettings, VOICE_OPTIONS, PACING_OPTIONS, DEFAULT_PERSONA, type VoiceId, type PacingId } from "@/lib/settings";
import { useSession } from "@/lib/session";
import { GeminiLiveClient } from "@/lib/gemini/liveClient";
import { Settings2, Volume2, RotateCcw } from "lucide-react";

export function SettingsPanel() {
  const voice = useSettings((s) => s.voice);
  const setVoice = useSettings((s) => s.setVoice);
  const modelId = useSettings((s) => s.modelId);
  const setModelId = useSettings((s) => s.setModelId);
  const persona = useSettings((s) => s.persona);
  const setPersona = useSettings((s) => s.setPersona);
  const resetPersona = useSettings((s) => s.resetPersona);
  const pacing = useSession((s) => s.pacing);
  const setPacing = useSession((s) => s.setPacing);

  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  async function onTestVoice() {
    setTesting(true);
    setTestError(null);
    try {
      const res = await fetch("/api/gemini/session", { method: "POST" });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error || "Could not get a Gemini session");
      }
      const { token, model: defaultModel, authMode } = (await res.json()) as {
        token: string;
        model: string;
        authMode: "raw" | "ephemeral";
      };
      await playOneShot({
        token,
        authMode,
        model: modelId || defaultModel,
        voice,
        phrase: `Hi! This is the ${voice} voice. Ready to help narrate your demo.`,
      });
    } catch (err) {
      setTestError((err as Error).message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings2 className="h-4 w-4" /> Narrator settings
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide" : "Show"}
        </Button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="voice">Voice</Label>
            <div className="flex gap-2 items-center">
              <select
                id="voice"
                value={voice}
                onChange={(e) => setVoice(e.target.value as VoiceId)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {VOICE_OPTIONS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.id} — {v.blurb}
                  </option>
                ))}
              </select>
              <Button onClick={onTestVoice} disabled={testing} variant="outline" size="sm">
                <Volume2 className="h-4 w-4" />
                {testing ? "Playing…" : "Test voice"}
              </Button>
            </div>
            {testError && (
              <p className="text-xs text-destructive">⚠ {testError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Presentation pace</Label>
            <div className="grid gap-2">
              {PACING_OPTIONS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPacing(p.id as PacingId)}
                  className={`text-left rounded-md border p-3 transition-colors ${
                    pacing === p.id
                      ? "border-secondary bg-secondary/10"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">
                      {p.id === "slow" ? "🐢" : p.id === "moderate" ? "⚖️" : "⚡"}
                    </span>
                    <div className="font-medium text-sm">{p.label}</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 ml-7">
                    {p.blurb}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Controls AI speaking speed and generation consistency for this demo.
              Saved per-demo when you click Save.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Gemini Live model ID</Label>
            <Input
              id="model"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder="gemini-3.1-flash-live-preview"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              Default: <code>gemini-3.1-flash-live-preview</code>. Other options:{" "}
              <code>gemini-live-2.5-flash-preview</code>,{" "}
              <code>gemini-2.0-flash-live-001</code>.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="persona">Narrator system prompt</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetPersona}
                disabled={persona === DEFAULT_PERSONA}
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </Button>
            </div>
            <Textarea
              id="persona"
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              rows={5}
              placeholder="Describe how the AI should present…"
            />
            <p className="text-xs text-muted-foreground">
              This becomes the first block of the AI's system prompt. The demo outline,
              login role names, and safety rules are appended automatically.
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

async function playOneShot(opts: {
  token: string;
  authMode: "raw" | "ephemeral";
  model: string;
  voice: VoiceId;
  phrase: string;
}): Promise<void> {
  const outputCtx = new AudioContext({ sampleRate: 24_000 });
  let nextPlayTime = 0;
  const sources: AudioBufferSourceNode[] = [];

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      try {
        live.close();
      } catch {}
      setTimeout(() => {
        void outputCtx.close().catch(() => {});
      }, 500);
      if (err) reject(err);
      else resolve();
    };

    const live = new GeminiLiveClient(
      {
        token: opts.token,
        authMode: opts.authMode,
        model: opts.model,
        voiceName: opts.voice,
        systemInstruction: `You are testing the ${opts.voice} voice. Say exactly what the user asks, briefly and warmly.`,
      },
      {
        onOpen: () => live.sendClientText(`Say this, warmly: "${opts.phrase}"`),
        onAudio: (pcm) => {
          const samples = new Int16Array(pcm);
          const buffer = outputCtx.createBuffer(1, samples.length, 24_000);
          const channel = buffer.getChannelData(0);
          for (let i = 0; i < samples.length; i++) channel[i] = samples[i] / 0x8000;
          const src = outputCtx.createBufferSource();
          src.buffer = buffer;
          src.connect(outputCtx.destination);
          const now = outputCtx.currentTime;
          const startAt = Math.max(now, nextPlayTime);
          src.start(startAt);
          nextPlayTime = startAt + buffer.duration;
          sources.push(src);
        },
        onTurnComplete: () => {
          const waitMs = Math.max(300, (nextPlayTime - outputCtx.currentTime) * 1000 + 200);
          setTimeout(() => finish(), waitMs);
        },
        onClose: (code, reason) => {
          if (code !== 1000 && code !== 1005 && !settled) {
            finish(new Error(`Gemini Live closed (${code}${reason ? `: ${reason}` : ""})`));
          }
        },
        onError: (err) => finish(err),
      },
    );
    live.connect();
    setTimeout(() => finish(new Error("Voice test timed out")), 20_000);
  });
}
