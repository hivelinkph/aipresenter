import { Stagehand } from "@browserbasehq/stagehand";
import { log } from "./logger";

export interface StagehandSession {
  stagehand: Stagehand;
  close: () => Promise<void>;
}

let current: StagehandSession | null = null;
let pending: Promise<StagehandSession> | null = null;

function isAlive(session: StagehandSession): boolean {
  // Stagehand exposes the underlying Playwright Page/Browser.
  // If the previous demo (or a manual close) tore them down, page.goto
  // throws "Target page, context or browser has been closed" — guard
  // against that by detecting closed state up front.
  try {
    const page = session.stagehand.page;
    const ctx = page?.context?.();
    const browser = ctx?.browser?.();
    if (!page || page.isClosed?.()) return false;
    if (browser && browser.isConnected?.() === false) return false;
    return true;
  } catch {
    return false;
  }
}

export async function getOrCreate(): Promise<StagehandSession> {
  if (current) {
    if (isAlive(current)) return current;
    log.warn("cached Stagehand session is dead, re-initializing");
    try {
      await current.close();
    } catch {}
    current = null;
  }

  // Coalesce concurrent callers onto a single in-flight init. Without this,
  // two tool calls that both arrive while `current` is null each call
  // `new Stagehand().init()` and launch separate browsers — one of which
  // gets orphaned when the second `current = ...` overwrites the first.
  if (pending) return pending;

  pending = (async () => {
    try {
      const stagehand = new Stagehand({
        env: "LOCAL",
        headless: false,
        verbose: 1,
        domSettleTimeoutMs: 15_000,
        modelName: process.env.STAGEHAND_MODEL ?? "google/gemini-2.5-flash",
        modelClientOptions: {
          apiKey: process.env.GEMINI_API_KEY,
        },
      } as any);

      await stagehand.init();
      log.info("Stagehand initialized");

      current = {
        stagehand,
        close: async () => {
          try {
            await stagehand.close();
          } catch (err) {
            log.warn("stagehand.close() threw", { err: String(err) });
          }
          current = null;
        },
      };
      return current;
    } finally {
      pending = null;
    }
  })();
  return pending;
}

export function getExisting(): StagehandSession | null {
  return current;
}

export async function closeExisting(): Promise<void> {
  if (current) await current.close();
}
