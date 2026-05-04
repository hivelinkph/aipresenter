import { create } from "zustand";
import { newId } from "./utils";

export type TranscriptLane =
  | "ai"
  | "human"
  | "browser"
  | "system"
  | "presenter_note";

export interface TranscriptEntry {
  id: string;
  lane: TranscriptLane;
  text: string;
  at: number;
  section?: string;
  screenshotDataUrl?: string;
  qa?: { question: string; answerLane: "ai" | "human" };
}

export interface Section {
  name: string;
  summary: string;
  /** Pre-drafted narration the AI should speak when reaching this section. */
  narration?: string;
}

interface TranscriptStore {
  entries: TranscriptEntry[];
  sections: Section[];
  currentSection: string | null;

  append: (entry: Omit<TranscriptEntry, "id" | "at"> & { at?: number }) => TranscriptEntry;
  clear: () => void;
  setSections: (sections: Section[]) => void;
  setCurrentSection: (name: string | null) => void;
  attachScreenshot: (entryId: string, dataUrl: string) => void;
  serialize: () => TranscriptSnapshot;
}

export interface TranscriptSnapshot {
  targetUrl: string;
  sections: Section[];
  entries: TranscriptEntry[];
  startedAt: number | null;
  endedAt: number | null;
  durationMs: number;
}

export const useTranscript = create<TranscriptStore>((set, get) => ({
  entries: [],
  sections: [],
  currentSection: null,

  append: (entry) => {
    const full: TranscriptEntry = {
      id: newId(),
      at: entry.at ?? Date.now(),
      ...entry,
    };
    set((prev) => ({ entries: [...prev.entries, full] }));
    return full;
  },

  clear: () => set({ entries: [], currentSection: null }),

  setSections: (sections) => set({ sections }),
  setCurrentSection: (currentSection) => set({ currentSection }),

  attachScreenshot: (entryId, dataUrl) =>
    set((prev) => ({
      entries: prev.entries.map((e) =>
        e.id === entryId ? { ...e, screenshotDataUrl: dataUrl } : e,
      ),
    })),

  serialize: () => {
    const entries = get().entries;
    const firstAt = entries.length > 0 ? entries[0].at : null;
    const lastAt = entries.length > 0 ? entries[entries.length - 1].at : null;
    return {
      targetUrl: "",
      sections: get().sections,
      entries,
      startedAt: firstAt,
      endedAt: lastAt,
      durationMs: firstAt && lastAt ? lastAt - firstAt : 0,
    };
  },
}));
