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

export const PACING_OPTIONS = [
  {
    id: "slow",
    label: "Slow & Deliberate",
    blurb: "Detailed explanations, longer pauses between points",
    temperature: 0.25,
    promptHint:
      "Speak at a slow, deliberate pace. Pause for 2-3 seconds between key points. " +
      "Use longer, more detailed explanations. Let each idea settle before moving on. " +
      "Never rush through content.",
  },
  {
    id: "moderate",
    label: "Moderate & Steady",
    blurb: "Balanced pace, natural pauses — recommended",
    temperature: 0.4,
    promptHint:
      "Speak at a moderate, steady pace — like a polished conference presenter. " +
      "Pause briefly (1-2 seconds) between sentences and slightly longer between sections. " +
      "Keep explanations concise but not rushed.",
  },
  {
    id: "fast",
    label: "Fast & Energetic",
    blurb: "Brisk delivery, quick transitions for short demos",
    temperature: 0.55,
    promptHint:
      "Speak at a brisk, energetic pace. Keep sentences short and punchy. " +
      "Transition quickly between points — minimal pauses. " +
      "Prioritize key highlights over detailed explanations.",
  },
] as const;

export type PacingId = (typeof PACING_OPTIONS)[number]["id"];

export type VoiceId = (typeof VOICE_OPTIONS)[number]["id"];

export function getPacingConfig(id: PacingId) {
  return PACING_OPTIONS.find((p) => p.id === id) ?? PACING_OPTIONS[1];
}

export const DEFAULT_PERSONA =
  "You are an AI sales engineer giving a live demo. Speak in a natural, conversational tone. " +
  "Keep each utterance short so the human presenter and the audience can interrupt.";

const DEFAULT_MODEL =
  process.env.NEXT_PUBLIC_DEFAULT_LIVE_MODEL ?? "gemini-3.1-flash-live-preview";

interface SettingsStore {
  presenterName: string;
  voice: VoiceId;
  modelId: string;
  persona: string;
  pacing: PacingId;
  captureSystemAudio: boolean;
  setPresenterName: (n: string) => void;
  setVoice: (v: VoiceId) => void;
  setModelId: (m: string) => void;
  setPersona: (p: string) => void;
  setPacing: (p: PacingId) => void;
  setCaptureSystemAudio: (b: boolean) => void;
  resetPersona: () => void;
  hydrate: (s: {
    presenter_name?: string | null;
    voice?: string | null;
    model_id?: string | null;
    persona?: string | null;
    pacing?: string | null;
    capture_system_audio?: boolean | null;
  }) => void;
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      presenterName: "",
      voice: "Puck",
      modelId: DEFAULT_MODEL,
      persona: DEFAULT_PERSONA,
      pacing: "moderate" as PacingId,
      captureSystemAudio: false,
      setPresenterName: (presenterName) => set({ presenterName }),
      setVoice: (voice) => set({ voice }),
      setModelId: (modelId) => set({ modelId }),
      setPersona: (persona) => set({ persona }),
      setPacing: (pacing) => set({ pacing }),
      setCaptureSystemAudio: (captureSystemAudio) => set({ captureSystemAudio }),
      resetPersona: () => set({ persona: DEFAULT_PERSONA }),
      hydrate: (s) =>
        set((prev) => ({
          presenterName: s.presenter_name ?? prev.presenterName,
          voice:
            (VOICE_OPTIONS.find((v) => v.id === s.voice)?.id as VoiceId) ??
            prev.voice,
          modelId: s.model_id ?? prev.modelId,
          persona: s.persona ?? prev.persona,
          pacing:
            (PACING_OPTIONS.find((p) => p.id === s.pacing)?.id as PacingId) ??
            prev.pacing,
          captureSystemAudio: s.capture_system_audio ?? prev.captureSystemAudio,
        })),
    }),
    {
      name: "presenter-settings",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
