import { WebSocketServer, type WebSocket } from "ws";
import type {
  ClientToRuntime,
  RuntimeToClient,
  ToolCallMessage,
} from "../lib/agent/protocol";
import {
  runTool,
  stashLoginCredentials,
  clearAllCredentials,
  type EmitEvent,
} from "./handlers";
import { closeExisting } from "./stagehandHost";
import { log } from "./logger";

export function startWsServer(port: number, sharedSecret: string | undefined) {
  const wss = new WebSocketServer({ port });
  log.info(`WS server listening on ws://localhost:${port}`);

  wss.on("connection", (ws, req) => {
    if (sharedSecret) {
      const header = req.headers["x-agent-secret"];
      if (header !== sharedSecret) {
        log.warn("rejected connection: missing/invalid shared secret");
        ws.close(4401, "unauthorized");
        return;
      }
    }

    log.info("client connected");
    clearAllCredentials();

    const send = (msg: RuntimeToClient) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
    };

    const emitEvent: EmitEvent = (evt) => {
      send({
        kind: "event",
        type: evt.type,
        text: evt.text,
        dataUrl: evt.dataUrl,
        meta: evt.meta,
        at: Date.now(),
      });
    };

    ws.on("message", async (data) => {
      let msg: ClientToRuntime;
      try {
        msg = JSON.parse(data.toString()) as ClientToRuntime;
      } catch {
        log.warn("bad JSON from client");
        return;
      }

      switch (msg.kind) {
        case "init":
          log.info("init received", {
            targetUrl: msg.targetUrl,
            sectionCount: msg.sections.length,
            roleNames: msg.roleNames,
          });
          send({ kind: "ack", what: "init", ok: true });
          break;

        case "login_payload":
          stashLoginCredentials(msg.callId, {
            username: msg.username,
            password: msg.password,
          });
          break;

        case "tool_call":
          await handleToolCall(msg, emitEvent, send);
          break;

        case "shutdown":
          await closeExisting();
          clearAllCredentials();
          send({ kind: "ack", what: "shutdown", ok: true });
          break;
      }
    });

    ws.on("close", async () => {
      log.info("client disconnected");
      clearAllCredentials();
    });
  });

  return wss;
}

async function handleToolCall(
  msg: ToolCallMessage,
  emit: EmitEvent,
  send: (m: RuntimeToClient) => void,
) {
  try {
    const result = await runTool(msg.tool, msg.args, msg.callId, emit);
    send({ kind: "tool_result", callId: msg.callId, ok: true, result });
  } catch (err) {
    const error = (err as Error).message;
    log.warn("tool_call failed", { tool: msg.tool, error });
    send({
      kind: "tool_error",
      callId: msg.callId,
      ok: false,
      error,
    });
  }
}

export async function stopWsServer(wss: WebSocketServer): Promise<void> {
  await new Promise<void>((resolve) => wss.close(() => resolve()));
  await closeExisting();
}
