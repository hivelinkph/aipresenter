import type {
  ClientToRuntime,
  RuntimeToClient,
  ActionEventMessage,
  ToolResultMessage,
  ToolErrorMessage,
} from "./protocol";
import type { ToolName } from "../tools";

export interface AgentClientCallbacks {
  onOpen?: () => void;
  onClose?: (code: number, reason: string) => void;
  onError?: (err: Error) => void;
  onEvent?: (evt: ActionEventMessage) => void;
  onAck?: (what: "init" | "shutdown", ok: boolean, error?: string) => void;
}

export class AgentClient {
  private ws: WebSocket | null = null;
  private pending = new Map<
    string,
    {
      resolve: (msg: ToolResultMessage) => void;
      reject: (msg: ToolErrorMessage) => void;
    }
  >();

  constructor(
    private url: string,
    private cb: AgentClientCallbacks,
  ) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.onopen = () => {
        this.cb.onOpen?.();
        resolve();
      };
      ws.onerror = () => {
        const err = new Error(`Agent WS connection failed (${this.url})`);
        this.cb.onError?.(err);
        reject(err);
      };
      ws.onclose = (e) => {
        this.cb.onClose?.(e.code, e.reason);
        for (const { reject } of this.pending.values()) {
          reject({
            kind: "tool_error",
            callId: "",
            ok: false,
            error: "agent WS closed",
          });
        }
        this.pending.clear();
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(String(e.data)) as RuntimeToClient;
          this.handle(msg);
        } catch (err) {
          this.cb.onError?.(err as Error);
        }
      };
    });
  }

  send(msg: ClientToRuntime): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Agent WS is not open");
    }
    this.ws.send(JSON.stringify(msg));
  }

  callTool(
    callId: string,
    tool: ToolName,
    args: unknown,
  ): Promise<ToolResultMessage> {
    return new Promise((resolve, reject) => {
      this.pending.set(callId, { resolve, reject });
      this.send({ kind: "tool_call", callId, tool, args });
    });
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }

  private handle(msg: RuntimeToClient): void {
    switch (msg.kind) {
      case "event":
        this.cb.onEvent?.(msg);
        break;
      case "ack":
        this.cb.onAck?.(msg.what, msg.ok, msg.error);
        break;
      case "tool_result": {
        const entry = this.pending.get(msg.callId);
        if (entry) {
          this.pending.delete(msg.callId);
          entry.resolve(msg);
        }
        break;
      }
      case "tool_error": {
        const entry = this.pending.get(msg.callId);
        if (entry) {
          this.pending.delete(msg.callId);
          entry.reject(msg);
        }
        break;
      }
    }
  }
}
