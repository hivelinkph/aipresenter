"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/lib/session";
import type { DemoSources } from "@/lib/sources";

/**
 * Apps source — a web app driven by the same Stagehand runtime as Websites,
 * but tracked separately so the user can pair "this is the marketing site"
 * with "this is the actual app being demoed".
 *
 * Roles are stored as names; passwords are NEVER persisted (filled in at
 * runtime through the in-memory credentials store).
 */
export function AppsSourceSection() {
  const sources = useSession((s) => s.sources);
  const setSources = useSession((s) => s.setSources);
  const state = useSession((s) => s.state);
  const locked =
    state === "running" || state === "paused" || state === "starting";

  const apps = sources.apps ?? {};
  const url = apps.url ?? "";
  const roleNames = apps.roleNames ?? [];

  function patch(next: Partial<{ url: string; roleNames: string[] }>) {
    const merged: DemoSources = {
      ...sources,
      apps: { ...apps, ...next },
    };
    setSources(merged);
  }

  function setRolesText(text: string) {
    const list = text
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    patch({ roleNames: list });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="apps-url">App URL</Label>
        <Input
          id="apps-url"
          type="url"
          inputMode="url"
          placeholder="https://app.example.com"
          value={url}
          onChange={(e) => patch({ url: e.target.value })}
          disabled={locked}
        />
        <p className="text-xs text-muted-foreground">
          The AI will navigate to this URL and walk through the app&apos;s
          functionality, just like the Websites flow.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="apps-roles">Login roles</Label>
        <Input
          id="apps-roles"
          placeholder="admin, manager, viewer"
          value={roleNames.join(", ")}
          onChange={(e) => setRolesText(e.target.value)}
          disabled={locked}
        />
        <p className="text-xs text-muted-foreground">
          Comma-separated role names. Passwords aren&apos;t stored here —
          you&apos;ll enter them at the start of each demo.
        </p>
      </div>
    </div>
  );
}
