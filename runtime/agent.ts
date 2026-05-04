import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { startWsServer, stopWsServer } from "./wsServer";
import { log } from "./logger";

// Next.js reads .env.local; we match that so a single file powers both processes.
loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const port = Number(process.env.AGENT_WS_PORT ?? 7777);
const sharedSecret = process.env.AGENT_SHARED_SECRET || undefined;

if (!process.env.GEMINI_API_KEY) {
  log.warn("GEMINI_API_KEY is not set — Stagehand's own model calls will fail");
}

const wss = startWsServer(port, sharedSecret);

const shutdown = async (signal: string) => {
  log.info(`received ${signal}, shutting down`);
  await stopWsServer(wss);
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
