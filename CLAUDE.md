# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository purpose

This repo now contains **two independent things** that happen to share a directory:

1. **Presenter** — a Next.js web app at the repo root (`app/`, `components/`, `lib/`, `runtime/`) that drives live AI-narrated website demos (Gemini Live + Stagehand). See "Presenter app" below.
2. **Skills catalog** — self-contained Claude Skills under `Skills/`, packaged into `.skill` zips via the tooling in `Skills/skill-creator/scripts/`. See "Skills" below.

The two are unrelated in code; don't import from `Skills/` into the Next.js app, and don't drag Next.js/React patterns into skills.

Top-level layout:
- `app/`, `components/`, `lib/`, `runtime/`, `scripts/`, `public/` — Presenter Next.js app.
- `Skills/` — one directory per skill (see "Skills" below).
- `Assets/` — shared `Icons/`, `Photos/`, `Videos/` for skills to reference.

## Presenter app

Split-runtime Next.js app. The Gemini Live session runs directly from the browser; Stagehand runs in a separate **local** Node process that exposes a WebSocket server. The two are tied together by tool calls the client proxies from Gemini to the runtime.

**Three tiers:**
- Browser UI — `app/page.tsx` + `components/*`, owns mic/audio, React state for credentials (never persisted). Orchestration lives in `lib/useDemoOrchestrator.ts`.
- Next.js server — stateless API routes only (`app/api/gemini/session`, `app/api/discover-sections`, `app/api/pdf`). Deployable to Vercel; no WebSocket state.
- Local runtime — `runtime/agent.ts` entrypoint starts a `ws://localhost:7777` server via `runtime/wsServer.ts`, driving a headful Chromium through `@browserbasehq/stagehand`. Must run on the presenter's laptop, not on Vercel.

**Commands (npm — pnpm isn't installed):**
```bash
npm install                 # first-time deps (also installs playwright browsers as a postinstall if configured)
npx playwright install chromium  # one-time: Chromium for Stagehand
npm run dev                 # Next.js on :3000
npm run dev:agent           # local Stagehand runtime on :7777 (separate terminal)
npm run dev:all             # both, via concurrently
npm run typecheck           # tsc --noEmit
npm run build               # production build of the Next.js app
```

Both processes must be up for a demo. `dev:agent` fails closed if `GEMINI_API_KEY` is missing (Stagehand's planner calls Gemini).

**Environment (see `.env.example`):**
- `GEMINI_API_KEY` — server-side only. Never shipped to the client.
- `GEMINI_LIVE_MODEL` — the bidirectional audio model ID. Confirm the current public ID (the user's "Gemini 3.1 Flash Live" — verify against Google's Live API docs).
- `GEMINI_TEXT_MODEL` — used by `/api/discover-sections` via Vercel AI SDK for one-shot section discovery.
- `AGENT_WS_PORT`, `NEXT_PUBLIC_AGENT_WS_URL` — how the browser reaches the local runtime.
- `AGENT_SHARED_SECRET` — optional; only needed for tunneled setups where the UI isn't on the same machine.
- `ALLOW_RAW_KEY=1` — local-only escape hatch when the ephemeral-token endpoint is unavailable; **never set in production**.

**Tool surface (single source of truth: `lib/tools.ts`):** `navigate`, `act`, `extract`, `observe`, `login_as`, `advance_section`, `pause_for_human`, `take_screenshot`, `wait_for`, `list_roles`, `end_demo`, `probe_site`. Each has a zod schema used both to validate runtime calls and to generate Gemini function declarations via `lib/gemini/toolSchema.ts`. Tools marked `runsOn: "client"` must never reach the runtime — they are handled in `useDemoOrchestrator.runClientTool`.

**Credentials rule (load-bearing, do not violate):** credentials never enter Gemini's context. `login_as` accepts only a role name; the client resolves the name → creds locally and sends them to the runtime over a separate `login_payload` message, keyed by the same `callId`. The runtime fills password fields via a direct Playwright `locator.fill()` — Stagehand's LLM never sees the password. Any change that weakens this separation is a regression. `redactCredentials` in `lib/credentials.ts` is a defensive second layer over transcript text.

**Interruption model:** Gemini Live's native VAD handles barge-in; the client drains the WebAudio queue on `onInterrupted`. The PAUSE button is a separate explicit handoff: it mutes the mic input to Gemini, signals pause to Gemini, and updates the state machine. RESUME reverses all three.

**What runs where:** `@browserbasehq/stagehand`, `playwright`, and `ws` are incompatible with Vercel serverless — they live only in `runtime/` and never in `app/api/*`. `@react-pdf/renderer` is fine on Node runtime; set `runtime = "nodejs"` in any PDF route.

**Key files:**
- `lib/tools.ts` — zod schemas + registry
- `lib/useDemoOrchestrator.ts` — the main client-side orchestration loop
- `lib/gemini/liveClient.ts` — Gemini Live WS protocol
- `lib/gemini/audioIO.ts` — AudioWorklet-based mic capture + playback queue
- `runtime/agent.ts` / `runtime/wsServer.ts` / `runtime/handlers.ts` — Stagehand runtime
- `lib/pdf/summary.tsx` — @react-pdf/renderer document for the demo summary

## Skills

### Skills tooling (all lives in `Skills/skill-creator/scripts/`)

These scripts are the authoritative tooling for the whole repo — use them from any skill, not just skill-creator.

```bash
# Scaffold a new skill directory with SKILL.md template + example scripts/references/assets/
python Skills/skill-creator/scripts/init_skill.py <skill-name> --path Skills

# Validate a single skill's frontmatter and structure
python Skills/skill-creator/scripts/quick_validate.py <path/to/skill-folder>

# Validate + zip a skill into a distributable <name>.skill file
python Skills/skill-creator/scripts/package_skill.py <path/to/skill-folder> [output-directory]
```

`package_skill.py` imports `quick_validate.py` and refuses to package an invalid skill — fix validation errors first, then repackage. There is no repo-wide "validate all" script; validate each skill individually.

When a skill bundles its own scripts (e.g. `brand-extractor/scripts/scrape_brand_data.py`), run them directly per that skill's SKILL file — each skill documents its own entry points.

### Skill anatomy

Every skill is a directory under `Skills/` with:

- **A SKILL markdown file** (required). Naming is inconsistent across this repo — expect `SKILL.md`, `SKILL_<Name>.md`, or `sk_<Name>.md`. New skills should use `SKILL.md` (the scaffolder emits this). When locating a skill's entry point, glob for `SKILL*.md` or `sk_*.md` rather than assuming a single name.
- **YAML frontmatter** with only these allowed keys: `name`, `description`, `license`, `allowed-tools`, `metadata`. Any other top-level key fails validation.
- **Optional bundled resources**, by convention:
  - `scripts/` — executables (Python/Bash) the skill invokes deterministically.
  - `references/` — markdown loaded into Claude's context *on demand* (schemas, API docs, deep guides).
  - `assets/` — files used in output, not loaded into context (templates, fonts, images).
  - Skills occasionally use other folders (`rules/`, `themes/`, `examples/`) — follow the SKILL file's own instructions.

### Skills architectural conventions (load-bearing — read before editing skills)

These come from `Skills/skill-creator/SKILL_skillcreator.md`. They shape how skills are written and why:

1. **Progressive disclosure.** Three loading tiers: (a) `name` + `description` are always in context, (b) SKILL body loads only when the skill triggers, (c) `references/` and `scripts/` load only when Claude decides to. Keep the SKILL body under ~500 lines and push detail into `references/`.
2. **The `description` field is the sole trigger.** All "when to use this skill" information belongs in `description`, not in the body — the body is invisible until after triggering. Descriptions should name concrete trigger phrases, file types, or scenarios.
3. **Degrees of freedom match task fragility.** Prose instructions for judgment-heavy work; parameterized scripts for fragile or repetitive work; rigid scripts for operations that must run exactly one way. Choose deliberately when adding new content to a skill.
4. **No auxiliary docs inside skills.** Do not add `README.md`, `INSTALLATION.md`, `CHANGELOG.md`, or similar to a skill directory — the validator/packager treats skills as agent-facing only. Repo-level docs (like this file) are fine.
5. **Imperative voice in SKILL bodies.** "Extract the text…" not "This skill extracts text…". The reader is another Claude instance executing the skill.
6. **Test bundled scripts by running them.** Scripts are contracts; a broken script silently corrupts every future use of the skill.

### Working on skills

- **New skill:** run `init_skill.py`, then fill in frontmatter and body, then delete the example `scripts/`/`references/`/`assets/` files that aren't used.
- **Editing an existing skill:** read its SKILL file first — each skill has its own structure (workflow-based, task-based, reference-style, etc.) and the SKILL body defines the contract for its bundled resources.
- **Before finishing changes:** run `quick_validate.py` on the skill. Before handing off a release, run `package_skill.py` and confirm the `.skill` file is produced.
