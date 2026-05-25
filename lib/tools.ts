import { z } from "zod";

export const toolSchemas = {
  navigate: z.object({
    url: z.string().url(),
  }),
  act: z.object({
    intent: z.string().min(1),
    targetHint: z.string().optional(),
  }),
  extract: z.object({
    instruction: z.string().min(1),
  }),
  observe: z.object({
    instruction: z.string().min(1),
  }),
  login_as: z.object({
    role: z.string().min(1),
  }),
  advance_section: z.object({
    name: z.string().min(1),
  }),
  pause_for_human: z.object({
    reason: z.string().default(""),
  }),
  take_screenshot: z.object({
    caption: z.string().optional(),
  }),
  wait_for: z.object({
    description: z.string().min(1),
    timeoutMs: z.number().int().positive().max(60_000).default(10_000),
  }),
  list_roles: z.object({}),
  end_demo: z.object({
    summary: z.string().optional(),
  }),
  probe_site: z.object({
    url: z.string().url(),
  }),
  next_page: z.object({}),
  goto_page: z.object({
    pageNumber: z.number().int().positive(),
  }),
  register_audience_member: z.object({
    name: z.string().min(1),
    tempId: z.string().min(1),
  }),
  start_presentation: z.object({}),
} as const;

export type ToolName = keyof typeof toolSchemas;
export type ToolArgs<T extends ToolName> = z.infer<(typeof toolSchemas)[T]>;

export interface ToolDescriptor {
  name: ToolName;
  description: string;
  runsOn: "runtime" | "client";
  sensitive: boolean;
  /**
   * Which presentation mode(s) this tool is available in. Used to filter
   * the tool list sent to Gemini so the AI can't call (say) navigate while
   * presenting a PDF. Defaults to "website".
   */
  modes: ReadonlyArray<"website" | "pdf">;
}

export const toolRegistry: Record<ToolName, ToolDescriptor> = {
  navigate: {
    name: "navigate",
    description: "Open a URL in the visible browser.",
    runsOn: "runtime",
    sensitive: false,
    modes: ["website"],
  },
  act: {
    name: "act",
    description:
      "Perform a natural-language action on the current page (click, type, select). Uses Stagehand's page.act().",
    runsOn: "runtime",
    sensitive: false,
    modes: ["website"],
  },
  extract: {
    name: "extract",
    description:
      "Extract structured information from the current page using natural language. Returns JSON.",
    runsOn: "runtime",
    sensitive: false,
    modes: ["website"],
  },
  observe: {
    name: "observe",
    description:
      "List candidate actions or elements on the current page without executing anything.",
    runsOn: "runtime",
    sensitive: false,
    modes: ["website"],
  },
  login_as: {
    name: "login_as",
    description:
      "Log in as a role. Accepts only the role NAME. Credentials are resolved client-side and never appear in the model context.",
    runsOn: "runtime",
    sensitive: true,
    modes: ["website"],
  },
  advance_section: {
    name: "advance_section",
    description:
      "Mark a section boundary in the demo transcript and move on to narrating the named section.",
    runsOn: "client",
    sensitive: false,
    modes: ["website"],
  },
  pause_for_human: {
    name: "pause_for_human",
    description:
      "Pause the AI presentation because a human appears to be taking over or the user needs time.",
    runsOn: "client",
    sensitive: false,
    modes: ["website", "pdf"],
  },
  take_screenshot: {
    name: "take_screenshot",
    description:
      "Capture a screenshot of the current page and attach it to the transcript (used in the summary PDF).",
    runsOn: "runtime",
    sensitive: false,
    modes: ["website"],
  },
  wait_for: {
    name: "wait_for",
    description:
      "Wait until the given condition is visible on the page or until timeoutMs elapses.",
    runsOn: "runtime",
    sensitive: false,
    modes: ["website"],
  },
  list_roles: {
    name: "list_roles",
    description:
      "Return the list of role NAMES available for login_as. Never returns credentials.",
    runsOn: "client",
    sensitive: false,
    modes: ["website"],
  },
  end_demo: {
    name: "end_demo",
    description:
      "End the current demo from the AI's side with a short wrap-up summary.",
    runsOn: "client",
    sensitive: false,
    modes: ["website", "pdf"],
  },
  probe_site: {
    name: "probe_site",
    description:
      "Quickly render a URL in the local browser and return title, nav links, and headings. Used by section discovery for JS-heavy sites.",
    runsOn: "runtime",
    sensitive: false,
    modes: ["website"],
  },
  next_page: {
    name: "next_page",
    description:
      "Advance the PDF viewer to the next page. Call this when you've finished narrating the current page and the human has enabled auto-advance.",
    runsOn: "client",
    sensitive: false,
    modes: ["pdf"],
  },
  goto_page: {
    name: "goto_page",
    description:
      "Jump the PDF viewer to a specific 1-indexed page number. Use when the audience asks to revisit an earlier page or you want to reference a later one.",
    runsOn: "client",
    sensitive: false,
    modes: ["pdf"],
  },
  register_audience_member: {
    name: "register_audience_member",
    description:
      "Save the name of an audience member to the database so you can remember them. Pass the tempId you see in your system prompt and the name they just told you.",
    runsOn: "client",
    sensitive: false,
    modes: ["pdf"],
  },
  start_presentation: {
    name: "start_presentation",
    description:
      "Transition from the webcam greeting phase to the actual PDF presentation when you feel the introductions are complete.",
    runsOn: "client",
    sensitive: false,
    modes: ["pdf"],
  },
};

export function parseToolArgs<T extends ToolName>(
  name: T,
  rawArgs: unknown,
): ToolArgs<T> {
  const schema = toolSchemas[name];
  return schema.parse(rawArgs) as ToolArgs<T>;
}
