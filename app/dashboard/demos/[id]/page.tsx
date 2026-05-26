"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UrlBar } from "@/components/UrlBar";
import { SectionsEditor } from "@/components/SectionsEditor";
import { CredentialsTable } from "@/components/CredentialsTable";
import { DemoKnowledgeBase } from "@/components/DemoKnowledgeBase";
import { DemoControls } from "@/components/DemoControls";
import { DurationTimer } from "@/components/DurationTimer";
import { TranscriptView } from "@/components/TranscriptView";
import { AudioMeter } from "@/components/AudioMeter";
import { StatusBar } from "@/components/StatusBar";
import { SettingsPanel } from "@/components/SettingsPanel";
import { useDemoOrchestrator } from "@/lib/useDemoOrchestrator";
import { useSession, type DemoLanguage } from "@/lib/session";
import { useTranscript } from "@/lib/transcript";
import { useCredentials } from "@/lib/credentials";
import {
  SOURCE_LABELS,
  SOURCE_ORDER,
  type DemoSources,
  type SourceType,
} from "@/lib/sources";
import { SourceTypeSelector } from "@/components/sources/SourceTypeSelector";
import { UrlSourceSection } from "@/components/sources/UrlSourceSection";
import { FileSourceSection } from "@/components/sources/FileSourceSection";
import { AppsSourceSection } from "@/components/sources/AppsSourceSection";
import { PdfOptions } from "@/components/sources/PdfOptions";
import dynamic from "next/dynamic";

// react-pdf touches pdfjs/window at module load. Bypass SSR entirely so
// nothing in this tree runs on the server.
const PdfRuntime = dynamic(
  () => import("@/components/runtime/PdfRuntime").then((m) => m.PdfRuntime),
  {
    ssr: false,
    loading: () => (
      <div className="text-sm text-muted-foreground border rounded-md p-4">
        Loading PDF viewer…
      </div>
    ),
  },
);

const WebcamRuntime = dynamic(
  () => import("@/components/runtime/WebcamRuntime").then((m) => m.WebcamRuntime),
  { ssr: false }
);
import { ArrowLeft, Save } from "lucide-react";

interface DemoRow {
  id: string;
  title: string;
  target_url: string;
  language: DemoLanguage;
  ground_to_kb: boolean;
  pacing: "slow" | "moderate" | "fast";
  source_types: SourceType[];
  sources: DemoSources;
  sections: Array<{ name: string; summary: string; narration?: string }>;
  role_names: string[];
}

export default function DemoRunner() {
  const params = useParams<{ id: string }>();
  const demoId = params.id;
  const router = useRouter();
  const {
    start,
    pause,
    resume,
    endDemo,
    reset,
    rerun,
    pushPdfPage,
    micLevel,
    micMuted,
    toggleMic,
    setLiveAutoAdvance,
    sendFrame,
    sendContext,
  } = useDemoOrchestrator();

  const presentationPhase = useSession((s) => s.presentationPhase);
  const hydrateFromDemo = useSession((s) => s.hydrateFromDemo);
  const stateDemoTitle = useSession((s) => s.demoTitle);
  const setDemoTitle = useSession((s) => s.setDemoTitle);
  const setSections = useTranscript((s) => s.setSections);
  const hydrateNames = useCredentials((s) => s.hydrateNames);
  const sourceTypes = useSession((s) => s.sourceTypes);
  const presentationMode = useSession((s) => s.presentationMode);
  const setPresentationMode = useSession((s) => s.setPresentationMode);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const lastSavedRef = useRef<string>("");

  // Derive the live runtime mode from the enabled sources. Websites/Apps
  // win when both are enabled (Stagehand can drive a browser; the user can
  // still toggle later). Otherwise PDFs takes us into the in-browser viewer.
  useEffect(() => {
    const hasBrowser =
      sourceTypes.includes("websites") || sourceTypes.includes("apps");
    const hasPdf = sourceTypes.includes("pdfs");
    const next = hasBrowser ? "website" : hasPdf ? "pdf" : "website";
    if (next !== presentationMode) setPresentationMode(next);
  }, [sourceTypes, presentationMode, setPresentationMode]);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/demos/${demoId}`, { cache: "no-store" });
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({}));
          throw new Error(error || res.statusText);
        }
        const { demo } = (await res.json()) as { demo: DemoRow };
        if (cancelled) return;
        hydrateFromDemo({
          id: demo.id,
          title: demo.title,
          target_url: demo.target_url,
          language: demo.language,
          ground_to_kb: demo.ground_to_kb ?? true,
          pacing: demo.pacing ?? "moderate",
          source_types:
            demo.source_types && demo.source_types.length > 0
              ? demo.source_types
              : ["websites"],
          sources: demo.sources ?? {},
        });
        setSections(demo.sections);
        hydrateNames(demo.role_names);
        lastSavedRef.current = serializeForSave({
          title: demo.title,
          target_url: demo.target_url,
          language: demo.language,
          sections: demo.sections,
          role_names: demo.role_names,
        });
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demoId, hydrateFromDemo, setSections, hydrateNames]);

  async function save() {
    setSaving("saving");
    setError(null);
    const session = useSession.getState();
    const sections = useTranscript.getState().sections;
    const roleNames = useCredentials.getState().listNames();
    const body = {
      title: session.demoTitle || "Untitled demo",
      target_url: session.targetUrl,
      language: session.language,
      sections,
      role_names: roleNames,
      pacing: session.pacing,
      source_types: session.sourceTypes,
      sources: session.sources,
    };
    try {
      const res = await fetch(`/api/demos/${demoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || res.statusText);
      }
      lastSavedRef.current = serializeForSave(body);
      setSaving("saved");
      setTimeout(() => setSaving("idle"), 1500);
    } catch (err) {
      setError((err as Error).message);
      setSaving("idle");
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Loading demo…</div>
    );
  }
  if (error && !stateDemoTitle) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" /> Back to demos
        </Link>
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="space-y-3">
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" /> Back to demos
        </Link>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Input
            value={stateDemoTitle}
            onChange={(e) => setDemoTitle(e.target.value)}
            placeholder="Demo title"
            className="text-2xl font-semibold tracking-tight max-w-xl h-auto py-2"
          />
          <Button
            onClick={save}
            disabled={saving === "saving"}
            variant="outline"
          >
            <Save className="h-4 w-4" />
            {saving === "saving"
              ? "Saving…"
              : saving === "saved"
              ? "Saved"
              : "Save demo"}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Configure the demo, then click START DEMO. The AI narrates live and
          drives the browser; the audience can ask questions any time.
        </p>
        <StatusBar />
        {error && <div className="text-sm text-destructive">{error}</div>}
      </header>

      <SettingsPanel />

      <Card>
        <CardHeader>
          <CardTitle>1 · Demo sources</CardTitle>
          <p className="text-sm text-muted-foreground pt-2">
            Pick what this demo presents. Checked items show their fields
            below.
          </p>
        </CardHeader>
        <CardContent>
          <SourceTypeSelector />
        </CardContent>
      </Card>

      <SourceSections demoId={demoId} />

      <Card>
        <CardHeader>
          <CardTitle>3 · Knowledge base</CardTitle>
        </CardHeader>
        <CardContent>
          <DemoKnowledgeBase demoId={demoId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4 · Demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RuntimeNotice />
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <DemoControls
              onStart={start}
              onPause={pause}
              onResume={resume}
              onEnd={endDemo}
              onReset={reset}
              onRerun={rerun}
            />
            <div className="flex items-center gap-4">
              <DurationTimer />
              <AudioMeter level={micLevel} muted={micMuted} />
            </div>
          </div>
          {presentationMode === "pdf" && (
            (presentationPhase === "greeting" || presentationPhase === "qa") ? (
              <WebcamRuntime sendFrame={sendFrame} sendContext={sendContext} />
            ) : (
              <PdfRuntime 
                pushPdfPage={pushPdfPage} 
                micMuted={micMuted} 
                toggleMic={toggleMic} 
                pause={pause} 
                resume={resume}
                setLiveAutoAdvance={setLiveAutoAdvance} 
                endDemo={endDemo}
              />
            )
          )}
          <div className="border rounded-md">
            <TranscriptView />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

/**
 * Renders one card per enabled source type, in canonical order. Each
 * section is only visible while its checkbox is on.
 */
function SourceSections({ demoId }: { demoId: string }) {
  const sourceTypes = useSession((s) => s.sourceTypes);
  const enabled = new Set(sourceTypes);
  if (enabled.size === 0) return null;

  return (
    <>
      {SOURCE_ORDER.filter((t) => enabled.has(t)).map((type, i) => (
        <Card key={type}>
          <CardHeader>
            <CardTitle>
              <span className="font-mono text-xs text-muted-foreground mr-3">
                2.{i + 1}
              </span>
              {SOURCE_LABELS[type]}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {type === "websites" && <WebsitesBlock />}
            {type === "apps" && <AppsSourceSection />}
            {type === "googleSlides" && (
              <UrlSourceSection
                sourceKey="googleSlides"
                label="Google Slides URL"
                placeholder="https://docs.google.com/presentation/d/…"
                helper="Use the share link. Make sure 'Anyone with the link can view' is set."
              />
            )}
            {type === "pdfs" && (
              <div className="space-y-4">
                <FileSourceSection
                  sourceKey="pdfs"
                  label="PDF documents"
                  helper="Up to 50 MB per file. AI narrates page-by-page in the demo."
                />
                <PdfOptions />
              </div>
            )}
            {type === "pictures" && (
              <FileSourceSection
                sourceKey="pictures"
                label="Pictures"
                helper="PNG, JPG, WebP, GIF. Up to 25 MB each."
              />
            )}
            {type === "powerPoint" && (
              <FileSourceSection
                sourceKey="powerPoint"
                label="PowerPoint files (.pptx)"
                helper="Up to 100 MB per file."
              />
            )}
          </CardContent>
        </Card>
      ))}
    </>
  );
}

/**
 * The classic Websites flow: URL + auto-discovered sections + login roles.
 * Wired to Stagehand-driven Gemini Live runtime.
 */
function WebsitesBlock() {
  return (
    <div className="space-y-6">
      <UrlBar />
      <SectionsEditor />
      <div className="space-y-2 pt-4 border-t">
        <div className="text-sm font-medium">Login roles</div>
        <CredentialsTable />
        <p className="text-xs text-muted-foreground">
          Role names persist with this demo. Passwords stay in memory only —
          re-enter them every session.
        </p>
      </div>
    </div>
  );
}

/**
 * Banner explaining what the live runtime can drive today.
 *
 * Live runtimes:
 *   - Websites / Apps → Stagehand-driven browser
 *   - PDFs            → in-browser PDF viewer with page-by-page narration
 *
 * Still deferred: Pictures · Google Slides · PowerPoint.
 */
function RuntimeNotice() {
  const sourceTypes = useSession((s) => s.sourceTypes);
  const presentationMode = useSession((s) => s.presentationMode);
  const hasBrowser =
    sourceTypes.includes("websites") || sourceTypes.includes("apps");
  const hasPdf = sourceTypes.includes("pdfs");
  const hasAnyLive = hasBrowser || hasPdf;
  const deferred = sourceTypes.filter(
    (t) => t === "pictures" || t === "googleSlides" || t === "powerPoint",
  );

  if (!hasAnyLive && deferred.length === 0) {
    // Nothing checked at all.
    return (
      <div className="rounded-md border border-secondary/40 bg-secondary/5 p-3 text-xs text-muted-foreground">
        <strong className="text-foreground">Pick a source:</strong> tick at
        least one box in <em>Demo sources</em> above to enable a live demo.
      </div>
    );
  }

  if (!hasAnyLive) {
    return (
      <div className="rounded-md border border-secondary/40 bg-secondary/5 p-3 text-xs text-muted-foreground">
        <strong className="text-foreground">Live runtime:</strong> Websites,
        Apps, and PDFs run live today. Other source types are saved with the
        demo and will activate when their runtimes ship.
      </div>
    );
  }

  const activeLabel =
    presentationMode === "pdf"
      ? "PDFs"
      : sourceTypes.includes("websites")
      ? "Websites"
      : "Apps";

  return (
    <div className="rounded-md border border-secondary/40 bg-secondary/5 p-3 text-xs text-muted-foreground">
      <strong className="text-foreground">Live runtime:</strong>{" "}
      {activeLabel}.
      {hasBrowser && hasPdf && (
        <>
          {" "}
          (Both Websites/Apps and PDFs are checked — Websites/Apps takes
          priority. Uncheck them to drive PDFs instead.)
        </>
      )}
      {deferred.length > 0 && (
        <>
          {" "}
          Configurations for{" "}
          {deferred.map((t) => SOURCE_LABELS[t]).join(", ")} are saved for the
          upcoming runtime.
        </>
      )}
    </div>
  );
}

function serializeForSave(d: {
  title: string;
  target_url: string;
  language: string;
  sections: unknown;
  role_names: string[];
}): string {
  return JSON.stringify(d);
}
