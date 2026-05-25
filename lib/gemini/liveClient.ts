import { buildGeminiFunctionDeclarations } from "./toolSchema";

/**
 * Thin wrapper around the Gemini Live WebSocket. We do NOT use Vercel AI SDK
 * here because its streaming abstractions don't yet target bidirectional audio.
 *
 * Protocol reference: Gemini API Live docs. Field names used here match the
 * public schema as of implementation; if Google renames them, update all four
 * methods (sendSetup, sendClientAudio, sendClientText, sendToolResponse) and
 * the handleMessage switch.
 */

export interface LiveCallbacks {
  onOpen?: () => void;
  onAudio?: (pcm16: ArrayBuffer) => void;
  onText?: (text: string, role: "model" | "user") => void;
  onToolCall?: (
    calls: Array<{ id: string; name: string; args: unknown }>,
  ) => void;
  onInterrupted?: () => void;
  onTurnComplete?: () => void;
  onSessionResumption?: (handle: string) => void;
  onError?: (err: Error) => void;
  onClose?: (code: number, reason: string) => void;
}

export interface LiveSessionConfig {
  token: string;
  model: string;
  systemInstruction: string;
  voiceName?: string;
  /** Generation temperature (0.0–1.0). Lower = more deterministic pacing. */
  temperature?: number;
  /** "raw" = API key (passed via ?key=); "ephemeral" = short-lived token (?access_token=). */
  authMode?: "raw" | "ephemeral";
  /** Resumption handle from a previous session's sessionResumptionUpdate. */
  resumptionHandle?: string;
  /** Filters which tools are exposed to the model. Defaults to "website". */
  presentationMode?: "website" | "pdf";
}

const ENDPOINT =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private closed = false;
  private setupComplete = false;
  private pendingOutgoing: unknown[] = [];

  constructor(
    private config: LiveSessionConfig,
    private cb: LiveCallbacks,
  ) {}

  connect(): void {
    const param = this.config.authMode === "ephemeral" ? "access_token" : "key";
    const url = `${ENDPOINT}?${param}=${encodeURIComponent(this.config.token)}`;
    this.ws = new WebSocket(url);
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = () => {
      this.sendSetupRaw();
      // onOpen fires only after server sends setupComplete — until then content
      // messages are queued in pendingOutgoing.
    };

    this.ws.onmessage = async (e) => {
      const raw =
        typeof e.data === "string"
          ? e.data
          : e.data instanceof ArrayBuffer
          ? new TextDecoder().decode(e.data)
          : await (e.data as Blob).text();
      try {
        const msg = JSON.parse(raw);
        this.handleMessage(msg);
      } catch (err) {
        this.cb.onError?.(err as Error);
      }
    };

    this.ws.onerror = (ev) => {
      console.error("[live] ws error", ev);
      this.cb.onError?.(new Error("Gemini Live WS error"));
    };
    this.ws.onclose = (e) => {
      console.warn("[live] ws close", e.code, e.reason);
      this.closed = true;
      this.cb.onClose?.(e.code, e.reason);
    };
  }

  private sendSetupRaw(): void {
    const setup: Record<string, unknown> = {
      setup: {
        model: `models/${this.config.model}`,
        generation_config: {
          response_modalities: ["AUDIO"],
          ...(this.config.temperature != null
            ? { temperature: this.config.temperature }
            : {}),
          ...(this.config.voiceName
            ? {
                speech_config: {
                  voice_config: {
                    prebuilt_voice_config: { voice_name: this.config.voiceName },
                  },
                },
              }
            : {}),
        },
        input_audio_transcription: {},
        output_audio_transcription: {},
        system_instruction: {
          parts: [{ text: this.config.systemInstruction }],
        },
        session_resumption: this.config.resumptionHandle
          ? { handle: this.config.resumptionHandle }
          : {},
        realtime_input_config: {
          // Keep server-side VAD ON so the model still detects when the audience
          // finishes a question and takes a turn to answer. But do NOT let
          // detected activity interrupt the model mid-narration — that was the
          // echo-loop / cuts-and-garble cause.
          activity_handling: "NO_INTERRUPTION",
        },
        tools: [
          {
            function_declarations: buildGeminiFunctionDeclarations(
              this.config.presentationMode ?? "website",
            ),
          },
        ],
      },
    };
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log("[live] sending setup", setup);
      this.ws.send(JSON.stringify(setup));
    }
  }

  /** Stream a PCM16 @ 16 kHz mono chunk to Gemini. */
  sendClientAudio(pcm16: ArrayBuffer): void {
    if (!this.ws || this.closed) return;
    const b64 = arrayBufferToBase64(pcm16);
    this.raw({
      realtime_input: {
        audio: { mime_type: "audio/pcm;rate=16000", data: b64 },
      },
    });
  }

  sendClientText(text: string, endOfTurn = true): void {
    this.raw({
      client_content: {
        turns: [{ role: "user", parts: [{ text }] }],
        turn_complete: endOfTurn,
      },
    });
  }

  sendToolResponse(callId: string, name: string, response: unknown): void {
    console.log("[live] sending tool_response", { callId, name, response });
    // Use camelCase here to match the format the server sends in tool_call
    // and the known-working AssistedLiving reference.
    this.raw({
      toolResponse: {
        functionResponses: [
          {
            id: callId,
            name,
            response: { content: response },
          },
        ],
      },
    });
  }

  /**
   * Request the model to stop speaking without taking further action.
   * Used for the PAUSE button (human takeover).
   */
  signalPause(): void {
    this.raw({
      client_content: {
        turns: [
          {
            role: "user",
            parts: [
              {
                text:
                  "[SYSTEM: the human presenter is taking over this question. Stop speaking and wait for a resume signal.]",
              },
            ],
          },
        ],
        turn_complete: true,
      },
    });
  }

  signalResume(currentSection: string | null): void {
    this.raw({
      client_content: {
        turns: [
          {
            role: "user",
            parts: [
              {
                text:
                  `[SYSTEM: the human presenter has handed control back. ` +
                  `Continue the demo${currentSection ? ` from section "${currentSection}"` : ""}.]`,
              },
            ],
          },
        ],
        turn_complete: true,
      },
    });
  }

  close(): void {
    this.closed = true;
    this.ws?.close();
    this.ws = null;
  }

  private raw(obj: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (!this.setupComplete) {
      this.pendingOutgoing.push(obj);
      return;
    }
    this.ws.send(JSON.stringify(obj));
  }

  private handleMessage(msg: any): void {
    console.log("[live] recv", Object.keys(msg));
    if (msg.setupComplete || msg.setup_complete) {
      this.setupComplete = true;
      for (const queued of this.pendingOutgoing) {
        this.ws?.send(JSON.stringify(queued));
      }
      this.pendingOutgoing = [];
      this.cb.onOpen?.();
      return;
    }

    const sc = msg.serverContent ?? msg.server_content;
    if (sc) {
      const modelTurn = sc.modelTurn ?? sc.model_turn;
      if (modelTurn?.parts) {
        for (const part of modelTurn.parts as any[]) {
          const inline = part.inlineData ?? part.inline_data;
          if (inline?.data && typeof inline.data === "string") {
            this.cb.onAudio?.(base64ToArrayBuffer(inline.data));
          }
          if (typeof part.text === "string") this.cb.onText?.(part.text, "model");
        }
      }
      if (sc.interrupted) this.cb.onInterrupted?.();
      if (sc.turnComplete ?? sc.turn_complete) this.cb.onTurnComplete?.();
      const inputT = sc.inputTranscription ?? sc.input_transcription;
      if (inputT?.text) this.cb.onText?.(inputT.text, "user");
      const outputT = sc.outputTranscription ?? sc.output_transcription;
      if (outputT?.text) this.cb.onText?.(outputT.text, "model");
    }

    const toolCall = msg.toolCall ?? msg.tool_call;
    if (toolCall) {
      const calls = (toolCall.functionCalls ?? toolCall.function_calls) as Array<{
        id: string;
        name: string;
        args: unknown;
      }>;
      if (calls) this.cb.onToolCall?.(calls);
    }

    const sru = msg.sessionResumptionUpdate ?? msg.session_resumption_update;
    if (sru) {
      const handle = (sru.newHandle ?? sru.new_handle) as string | undefined;
      if (handle && typeof handle === "string") {
        this.cb.onSessionResumption?.(handle);
      }
    }
  }
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
