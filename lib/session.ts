import { create } from "zustand";
import type { DemoSources, SourceType } from "./sources";

export type SessionState =
  | "idle"
  | "discovering"
  | "ready"
  | "starting"
  | "running"
  | "paused"
  | "ending"
  | "ended";

export type DemoLanguage = "English" | "Tagalog" | "Bisaya";

/**
 * Live runtime mode. `website` drives a real browser via Stagehand;
 * `pdf` runs a PDF viewer in the browser and streams page text to Gemini.
 */
export type PresentationMode = "website" | "pdf";

interface ConnectionStatus {
  gemini: "disconnected" | "connecting" | "connected" | "error";
  agent: "disconnected" | "connecting" | "connected" | "error";
  browser: "idle" | "launching" | "ready" | "error";
}

interface SessionStore {
  state: SessionState;
  userId: string | null;
  demoId: string | null;
  demoTitle: string;
  targetUrl: string;
  language: DemoLanguage;
  groundToKb: boolean;
  sourceTypes: SourceType[];
  sources: DemoSources;
  presentationMode: PresentationMode;
  /** PDF runtime — id of the file in sources.pdfs.files[] currently presenting. */
  activePdfFileId: string | null;
  /** PDF runtime — zero-indexed page being shown. */
  currentPageIndex: number;
  /** PDF runtime — total page count of the active file. 0 until known. */
  totalPages: number;
  currentSection: string | null;
  startedAt: number | null;
  endedAt: number | null;
  connections: ConnectionStatus;
  lastError: string | null;

  setState: (s: SessionState) => void;
  setUserId: (id: string | null) => void;
  setDemoTitle: (title: string) => void;
  setTargetUrl: (url: string) => void;
  setLanguage: (lang: DemoLanguage) => void;
  setGroundToKb: (v: boolean) => void;
  setSourceTypes: (types: SourceType[]) => void;
  setSources: (sources: DemoSources) => void;
  toggleSourceType: (t: SourceType, on: boolean) => void;
  setPresentationMode: (m: PresentationMode) => void;
  setActivePdfFileId: (id: string | null) => void;
  setCurrentPageIndex: (i: number) => void;
  setTotalPages: (n: number) => void;
  setCurrentSection: (name: string | null) => void;
  setConnection: <K extends keyof ConnectionStatus>(
    key: K,
    value: ConnectionStatus[K],
  ) => void;
  setError: (err: string | null) => void;
  begin: () => void;
  finish: () => void;
  reset: () => void;
  /** Hydrate the store from a saved demo row. Resets ephemeral state. */
  hydrateFromDemo: (demo: {
    id: string;
    title: string;
    target_url: string;
    language: DemoLanguage;
    ground_to_kb: boolean;
    source_types: SourceType[];
    sources: DemoSources;
  }) => void;
}

const initialConnections: ConnectionStatus = {
  gemini: "disconnected",
  agent: "disconnected",
  browser: "idle",
};

export const useSession = create<SessionStore>((set) => ({
  state: "idle",
  userId: null,
  demoId: null,
  demoTitle: "",
  targetUrl: "",
  language: "English",
  groundToKb: true,
  sourceTypes: ["websites"],
  sources: {},
  presentationMode: "website",
  activePdfFileId: null,
  currentPageIndex: 0,
  totalPages: 0,
  currentSection: null,
  startedAt: null,
  endedAt: null,
  connections: { ...initialConnections },
  lastError: null,

  setState: (state) => set({ state }),
  setUserId: (userId) => set({ userId }),
  setDemoTitle: (demoTitle) => set({ demoTitle }),
  setTargetUrl: (targetUrl) => set({ targetUrl }),
  setLanguage: (language) => set({ language }),
  setGroundToKb: (groundToKb) => set({ groundToKb }),
  setSourceTypes: (sourceTypes) => set({ sourceTypes }),
  setSources: (sources) => set({ sources }),
  setPresentationMode: (presentationMode) => set({ presentationMode }),
  setActivePdfFileId: (activePdfFileId) => set({ activePdfFileId }),
  setCurrentPageIndex: (currentPageIndex) => set({ currentPageIndex }),
  setTotalPages: (totalPages) => set({ totalPages }),
  toggleSourceType: (t, on) =>
    set((prev) => {
      const set = new Set(prev.sourceTypes);
      if (on) set.add(t);
      else set.delete(t);
      return { sourceTypes: Array.from(set) };
    }),
  setCurrentSection: (currentSection) => set({ currentSection }),
  setConnection: (key, value) =>
    set((prev) => ({ connections: { ...prev.connections, [key]: value } })),
  setError: (lastError) => set({ lastError }),
  begin: () =>
    set({
      state: "running",
      startedAt: Date.now(),
      endedAt: null,
      lastError: null,
    }),
  finish: () => set({ state: "ended", endedAt: Date.now() }),
  reset: () =>
    set({
      state: "idle",
      currentSection: null,
      startedAt: null,
      endedAt: null,
      connections: { ...initialConnections },
      lastError: null,
    }),
  hydrateFromDemo: (demo) =>
    set({
      demoId: demo.id,
      demoTitle: demo.title,
      targetUrl: demo.target_url,
      language: demo.language,
      groundToKb: demo.ground_to_kb,
      sourceTypes:
        demo.source_types && demo.source_types.length > 0
          ? demo.source_types
          : ["websites"],
      sources: demo.sources ?? {},
      // Reset run-time state so a freshly-loaded demo starts clean.
      state: "idle",
      currentSection: null,
      startedAt: null,
      endedAt: null,
      connections: { ...initialConnections },
      lastError: null,
    }),
}));
