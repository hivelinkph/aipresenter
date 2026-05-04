import { parseToolArgs, type ToolName } from "../lib/tools";
import { getOrCreate } from "./stagehandHost";
import { log } from "./logger";

type ActionEvent = {
  type: "action" | "log" | "screenshot" | "browser_state";
  text?: string;
  dataUrl?: string;
  meta?: Record<string, unknown>;
};

export type EmitEvent = (evt: ActionEvent) => void;

const credentialsByCallId = new Map<string, { username: string; password: string }>();

export function stashLoginCredentials(
  callId: string,
  creds: { username: string; password: string },
): void {
  credentialsByCallId.set(callId, creds);
}

export function clearAllCredentials(): void {
  credentialsByCallId.clear();
}

export async function runTool(
  name: ToolName,
  rawArgs: unknown,
  callId: string,
  emit: EmitEvent,
): Promise<unknown> {
  switch (name) {
    case "navigate":
      return handleNavigate(parseToolArgs("navigate", rawArgs), emit);
    case "act":
      return handleAct(parseToolArgs("act", rawArgs), emit);
    case "extract":
      return handleExtract(parseToolArgs("extract", rawArgs), emit);
    case "observe":
      return handleObserve(parseToolArgs("observe", rawArgs), emit);
    case "login_as":
      return handleLoginAs(parseToolArgs("login_as", rawArgs), callId, emit);
    case "take_screenshot":
      return handleScreenshot(parseToolArgs("take_screenshot", rawArgs), emit);
    case "wait_for":
      return handleWaitFor(parseToolArgs("wait_for", rawArgs), emit);
    case "probe_site":
      return handleProbeSite(parseToolArgs("probe_site", rawArgs), emit);
    case "advance_section":
    case "pause_for_human":
    case "list_roles":
    case "end_demo":
      // Client-side tools should never be dispatched to the runtime.
      throw new Error(`Tool ${name} is client-side and must not be called on the runtime`);
    default: {
      const exhaustive: never = name;
      throw new Error(`Unknown tool ${exhaustive}`);
    }
  }
}

async function handleNavigate(
  args: { url: string },
  emit: EmitEvent,
): Promise<{ ok: true; url: string }> {
  const { stagehand } = await getOrCreate();
  await stagehand.page.goto(args.url);
  emit({ type: "action", text: `Navigated to ${args.url}` });
  return { ok: true, url: args.url };
}

async function handleAct(
  args: { intent: string; targetHint?: string },
  emit: EmitEvent,
): Promise<{ ok: boolean; intent: string; message?: string }> {
  const { stagehand } = await getOrCreate();
  const instruction = args.targetHint
    ? `${args.intent} (hint: ${args.targetHint})`
    : args.intent;
  try {
    await stagehand.page.act(instruction);
    emit({ type: "action", text: instruction });
    return { ok: true, intent: instruction };
  } catch (err) {
    const message = (err as Error).message;
    emit({ type: "log", text: `act failed: ${message}` });
    return { ok: false, intent: instruction, message };
  }
}

async function handleExtract(
  args: { instruction: string; schema?: Record<string, unknown> },
  emit: EmitEvent,
): Promise<unknown> {
  const { stagehand } = await getOrCreate();
  const result = await stagehand.page.extract({
    instruction: args.instruction,
    schema: (args.schema ?? {}) as any,
  } as any);
  emit({ type: "action", text: `Extracted: ${args.instruction}` });
  return result;
}

async function handleObserve(
  args: { instruction: string },
  emit: EmitEvent,
): Promise<unknown> {
  const { stagehand } = await getOrCreate();
  const observations = await stagehand.page.observe({ instruction: args.instruction } as any);
  emit({ type: "log", text: `Observed ${Array.isArray(observations) ? observations.length : 0} candidates` });
  return observations;
}

async function handleLoginAs(
  args: { role: string },
  callId: string,
  emit: EmitEvent,
): Promise<{ ok: boolean; role: string; message?: string }> {
  const creds = credentialsByCallId.get(callId);
  if (!creds) {
    return {
      ok: false,
      role: args.role,
      message: `No credentials provided for role ${args.role}. Client must send login_payload before tool_call.`,
    };
  }
  const { stagehand } = await getOrCreate();
  emit({ type: "action", text: `Logging in as "${args.role}"` });

  try {
    await stagehand.page.act(`type "${escapeForInstruction(creds.username)}" into the username or email field`);
    // Fill password via direct locator to avoid the LLM ever seeing the password value.
    const passwordLocator = stagehand.page.locator(
      'input[type="password"], input[autocomplete="current-password"]',
    );
    await passwordLocator.first().fill(creds.password);
    await stagehand.page.act("submit the login form");
    credentialsByCallId.delete(callId);
    emit({ type: "action", text: `Login submitted for role "${args.role}"` });
    return { ok: true, role: args.role };
  } catch (err) {
    credentialsByCallId.delete(callId);
    const message = (err as Error).message;
    log.warn("login_as failed", { role: args.role, message });
    return { ok: false, role: args.role, message };
  }
}

async function handleScreenshot(
  args: { caption?: string },
  emit: EmitEvent,
): Promise<{ ok: true; caption: string }> {
  const { stagehand } = await getOrCreate();
  // Page.captureScreenshot intermittently fails with
  //   "Protocol error (Page.captureScreenshot): Unable to capture screenshot"
  // when the renderer is mid-paint or font loading is stalling. Retry once
  // after letting the DOM settle.
  let buf: Buffer | undefined;
  let lastErr: Error | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      buf = await stagehand.page.screenshot({
        type: "png",
        fullPage: false,
        timeout: 10_000,
      });
      lastErr = undefined;
      break;
    } catch (err) {
      lastErr = err as Error;
      log.warn("screenshot attempt failed, retrying", {
        attempt: attempt + 1,
        err: lastErr.message,
      });
      await stagehand.page
        .waitForLoadState("domcontentloaded", { timeout: 5_000 })
        .catch(() => {});
    }
  }
  if (!buf) throw lastErr ?? new Error("screenshot failed");
  const dataUrl = `data:image/png;base64,${Buffer.from(buf).toString("base64")}`;
  emit({
    type: "screenshot",
    text: args.caption ?? "Screenshot",
    dataUrl,
  });
  return { ok: true, caption: args.caption ?? "" };
}

async function handleWaitFor(
  args: { description: string; timeoutMs: number },
  emit: EmitEvent,
): Promise<{ ok: boolean; message?: string }> {
  const { stagehand } = await getOrCreate();
  try {
    await stagehand.page.waitForLoadState("networkidle", { timeout: args.timeoutMs });
    emit({ type: "log", text: `Waited for: ${args.description}` });
    return { ok: true };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

async function handleProbeSite(
  args: { url: string },
  emit: EmitEvent,
): Promise<{
  title: string;
  navLinks: string[];
  headings: string[];
}> {
  const { stagehand } = await getOrCreate();
  await stagehand.page.goto(args.url);
  await stagehand.page.waitForLoadState("domcontentloaded", { timeout: 15_000 });

  const result = await stagehand.page.evaluate(() => {
    const take = (selector: string) =>
      Array.from(document.querySelectorAll(selector))
        .map((el) => (el.textContent ?? "").trim())
        .filter((t) => t && t.length < 80)
        .slice(0, 30);
    return {
      title: document.title,
      navLinks: take("nav a"),
      headings: take("h1, h2, h3"),
    };
  });

  emit({ type: "log", text: `Probed ${args.url}` });
  return result;
}

function escapeForInstruction(s: string): string {
  return s.replace(/"/g, '\\"');
}
