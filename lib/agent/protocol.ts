import type { ToolName } from "../tools";

export interface ToolCallMessage {
  kind: "tool_call";
  callId: string;
  tool: ToolName;
  args: unknown;
}

export interface ToolResultMessage {
  kind: "tool_result";
  callId: string;
  ok: true;
  result: unknown;
}

export interface ToolErrorMessage {
  kind: "tool_error";
  callId: string;
  ok: false;
  error: string;
  hint?: string;
}

export interface ActionEventMessage {
  kind: "event";
  type: "action" | "log" | "screenshot" | "browser_state";
  text?: string;
  dataUrl?: string;
  meta?: Record<string, unknown>;
  at: number;
}

export interface InitMessage {
  kind: "init";
  targetUrl: string;
  sections: Array<{ name: string; summary: string }>;
  roleNames: string[];
  sharedSecret?: string;
}

export interface LoginPayloadMessage {
  kind: "login_payload";
  callId: string;
  role: string;
  username: string;
  password: string;
}

export interface ShutdownMessage {
  kind: "shutdown";
}

export interface AckMessage {
  kind: "ack";
  what: "init" | "shutdown";
  ok: boolean;
  error?: string;
}

export type ClientToRuntime =
  | InitMessage
  | ToolCallMessage
  | LoginPayloadMessage
  | ShutdownMessage;

export type RuntimeToClient =
  | ToolResultMessage
  | ToolErrorMessage
  | ActionEventMessage
  | AckMessage;
