"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/lib/session";
import type { DemoSources } from "@/lib/sources";

interface Props {
  /** Source type key inside demos.sources jsonb (e.g. "googleSlides"). */
  sourceKey: keyof DemoSources;
  label: string;
  placeholder: string;
  helper?: string;
}

/**
 * URL-only source section. Used by Google Slides today; Apps reuses this for
 * its url field via the WebsitesSection variant (Apps gets its own roles).
 */
export function UrlSourceSection({
  sourceKey,
  label,
  placeholder,
  helper,
}: Props) {
  const sources = useSession((s) => s.sources);
  const setSources = useSession((s) => s.setSources);
  const state = useSession((s) => s.state);
  const locked =
    state === "running" || state === "paused" || state === "starting";

  const current = (sources[sourceKey] as { url?: string } | undefined)?.url ?? "";

  function onChange(url: string) {
    const next: DemoSources = {
      ...sources,
      [sourceKey]: { ...(sources[sourceKey] ?? {}), url },
    };
    setSources(next);
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`url-${sourceKey}`}>{label}</Label>
      <Input
        id={`url-${sourceKey}`}
        type="url"
        inputMode="url"
        placeholder={placeholder}
        value={current}
        onChange={(e) => onChange(e.target.value)}
        disabled={locked}
      />
      {helper && (
        <p className="text-xs text-muted-foreground">{helper}</p>
      )}
    </div>
  );
}
