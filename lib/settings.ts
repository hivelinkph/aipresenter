"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export const VOICE_OPTIONS = [
  { id: "Puck", blurb: "Warm, upbeat, conversational" },
  { id: "Charon", blurb: "Deep, calm, authoritative" },
  { id: "Kore", blurb: "Clear, bright, neutral female" },
  { id: "Aoede", blurb: "Musical, softer mid-range" },
  { id: "Zephyr", blurb: "Light, airy, quick" },
  { id: "Fenrir", blurb: "Rougher, energetic male" },
] as const;

export type VoiceId = (typeof VOICE_OPTIONS)[number]["id"];

export const DEFAULT_PERSONA =
  "You are an AI sales engineer giving a live demo. Speak in a natural, conversational tone. " +
  "Keep each utterance short so the human presenter and the audience can interrupt.";

const DEFAULT_MODEL =
  process.env.NEXT_PUBLIC_DEFAULT_LIVE_MODEL ?? "gemini-3.1-flash-live-preview";

interface SettingsStore {
  voice: VoiceId;
  modelId: string;
  persona: string;
  setVoice: (v: VoiceId) => void;
  setModelId: (m: string) => void;
  setPersona: (p: string) => void;
  resetPersona: () => void;
  hydrate: (s: {
    voice?: string | null;
    model_id?: string | null;
    persona?: string | null;
  }) => void;
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      voice: "Puck",
      modelId: DEFAULT_MODEL,
      persona: DEFAULT_PERSONA,
      setVoice: (voice) => set({ voice }),
      setModelId: (modelId) => set({ modelId }),
      setPersona: (persona) => set({ persona }),
      resetPersona: () => set({ persona: DEFAULT_PERSONA }),
      hydrate: (s) =>
        set((prev) => ({
          voice:
            (VOICE_OPTIONS.find((v) => v.id === s.voice)?.id as VoiceId) ??
            prev.voice,
          modelId: s.model_id ?? prev.modelId,
          persona: s.persona ?? prev.persona,
        })),
    }),
    {
      name: "presenter-settings",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
