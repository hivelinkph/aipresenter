/**
 * Browser-side audio I/O for Gemini Live.
 *
 * Capture: getUserMedia -> AudioWorklet -> 16 kHz mono PCM16 chunks.
 * Playback: 24 kHz PCM16 chunks from Gemini -> WebAudio queue with drain-on-interrupt.
 *
 * Both input and output rates are the Gemini Live defaults; do not change without
 * updating the Live session config.
 */

const WORKLET_CODE = /* js */ `
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._targetLen = 1600; // 100 ms at 16 kHz
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const ch = input[0];
    this._buffer.push(...ch);
    while (this._buffer.length >= this._targetLen) {
      const chunk = this._buffer.splice(0, this._targetLen);
      const pcm16 = new Int16Array(chunk.length);
      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    }
    return true;
  }
}
registerProcessor("capture-processor", CaptureProcessor);
`;

export interface AudioIOOptions {
  inputDeviceId?: string;
  outputDeviceId?: string;
  onInputLevel?: (level: number) => void;
  onInputChunk: (pcm16: ArrayBuffer) => void;
}

export class AudioIO {
  private ctx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private analyserTimer: number | null = null;

  private outputCtx: AudioContext | null = null;
  private scheduledSources: AudioBufferSourceNode[] = [];
  private nextPlayTime = 0;
  private inputMuted = false;

  constructor(private opts: AudioIOOptions) {}

  async start(): Promise<void> {
    this.ctx = new AudioContext({ sampleRate: 16_000 });
    this.outputCtx = new AudioContext({ sampleRate: 24_000 });

    const workletBlob = new Blob([WORKLET_CODE], { type: "application/javascript" });
    const workletUrl = URL.createObjectURL(workletBlob);
    await this.ctx.audioWorklet.addModule(workletUrl);
    URL.revokeObjectURL(workletUrl);

    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: this.opts.inputDeviceId ? { exact: this.opts.inputDeviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    this.source = this.ctx.createMediaStreamSource(this.micStream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.source.connect(this.analyser);

    this.workletNode = new AudioWorkletNode(this.ctx, "capture-processor");
    this.workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      if (this.inputMuted) return;
      this.opts.onInputChunk(e.data);
    };
    this.source.connect(this.workletNode);

    if (this.opts.onInputLevel && this.analyser) {
      const bins = new Uint8Array(this.analyser.frequencyBinCount);
      const tick = () => {
        if (!this.analyser) return;
        this.analyser.getByteTimeDomainData(bins);
        let sum = 0;
        for (let i = 0; i < bins.length; i++) {
          const v = (bins[i] - 128) / 128;
          sum += v * v;
        }
        this.opts.onInputLevel?.(Math.sqrt(sum / bins.length));
        this.analyserTimer = window.setTimeout(tick, 100);
      };
      tick();
    }
  }

  setInputMuted(muted: boolean): void {
    this.inputMuted = muted;
  }

  /** Enqueue a PCM16 @ 24 kHz chunk from Gemini for playback. */
  enqueueOutput(pcm16: ArrayBuffer): void {
    if (!this.outputCtx) return;
    const samples = new Int16Array(pcm16);
    const buffer = this.outputCtx.createBuffer(1, samples.length, 24_000);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) channel[i] = samples[i] / 0x8000;

    const src = this.outputCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.outputCtx.destination);

    const now = this.outputCtx.currentTime;
    const startAt = Math.max(now, this.nextPlayTime);
    src.start(startAt);
    this.nextPlayTime = startAt + buffer.duration;
    this.scheduledSources.push(src);
    src.onended = () => {
      const i = this.scheduledSources.indexOf(src);
      if (i >= 0) this.scheduledSources.splice(i, 1);
    };
  }

  /** Immediately cancel any queued/playing AI audio (barge-in). */
  drainOutput(): void {
    for (const src of this.scheduledSources) {
      try {
        src.stop();
      } catch {}
    }
    this.scheduledSources = [];
    this.nextPlayTime = this.outputCtx?.currentTime ?? 0;
  }

  async stop(): Promise<void> {
    this.drainOutput();
    if (this.analyserTimer !== null) {
      clearTimeout(this.analyserTimer);
      this.analyserTimer = null;
    }
    this.workletNode?.disconnect();
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.micStream?.getTracks().forEach((t) => t.stop());
    await this.ctx?.close();
    await this.outputCtx?.close();
    this.ctx = null;
    this.outputCtx = null;
    this.micStream = null;
    this.workletNode = null;
    this.source = null;
    this.analyser = null;
  }
}
