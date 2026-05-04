"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/lib/session";
import { useTranscript } from "@/lib/transcript";

const LANGUAGES = ["English", "Tagalog", "Bisaya"] as const;

export function UrlBar() {
  const targetUrl = useSession((s) => s.targetUrl);
  const setTargetUrl = useSession((s) => s.setTargetUrl);
  const language = useSession((s) => s.language);
  const setLanguage = useSession((s) => s.setLanguage);
  const demoId = useSession((s) => s.demoId);
  const state = useSession((s) => s.state);
  const setState = useSession((s) => s.setState);
  const setError = useSession((s) => s.setError);
  const setSections = useTranscript((s) => s.setSections);
  const [busy, setBusy] = useState(false);

  const isLive = state === "running" || state === "paused" || state === "starting";
  const inputDisabled = isLive || busy;
  const buttonDisabled = inputDisabled || !targetUrl.trim();

  async function onDiscover() {
    const url = targetUrl.trim();
    if (!url) return;
    setBusy(true);
    setError(null);
    setState("discovering");
    try {
      const res = await fetch("/api/discover-sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          language,
          // demoId enables KB grounding (top-K chunks scoped to this demo +
          // user-wide). Backend silently no-ops if the user has no KB.
          ...(demoId ? { demoId } : {}),
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error);
      }
      const { sections } = (await res.json()) as {
        sections: Array<{ name: string; summary: string; narration?: string }>;
      };
      setSections(sections);
      setState("ready");
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="url">Website to demo</Label>
        <div className="flex gap-2">
          <Input
            id="url"
            type="text"
            inputMode="url"
            placeholder="https://example.com"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            disabled={inputDisabled}
          />
          <Button onClick={onDiscover} disabled={buttonDisabled}>
            {busy ? "Drafting script…" : "Discover features"}
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="language">Demo language</Label>
        <select
          id="language"
          value={language}
          onChange={(e) => setLanguage(e.target.value as typeof LANGUAGES[number])}
          disabled={inputDisabled}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
