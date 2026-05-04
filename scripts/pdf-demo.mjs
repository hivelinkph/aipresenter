/**
 * Headed end-to-end smoke for the PDF demo flow.
 *
 *   $env:LOGIN_PASSWORD = "..."     # PowerShell
 *   $env:LOGIN_EMAIL    = "..."     # optional, defaults to hivelinkph@gmail.com
 *   node scripts/pdf-demo.mjs
 *
 * Steps:
 *   1. /login as the supplied user
 *   2. Click "New demo" on /dashboard
 *   3. On the runner page: tick PDFs, untick Websites
 *   4. Upload scripts/mock.pdf into the PDF source
 *   5. Save demo
 *   6. Click START DEMO and observe for ~30s, sampling status + transcript
 *   7. Click END DEMO if visible, then close
 *
 * Notes:
 *   - Stagehand runtime on :7777 is NOT required — PDF mode runs in-browser.
 *   - Mic permission is granted with --use-fake-device-for-media-stream so
 *     Gemini Live actually opens (silent mic, no real audio).
 */
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3000";
const PDF_PATH = path.resolve(__dirname, "mock.pdf");

const email = process.env.LOGIN_EMAIL ?? "hivelinkph@gmail.com";
const password = process.env.LOGIN_PASSWORD;
if (!password) {
  console.error(
    "LOGIN_PASSWORD env var is required. Run with:\n" +
      '  $env:LOGIN_PASSWORD = "..."; node scripts/pdf-demo.mjs',
  );
  process.exit(1);
}

const stamp = Date.now();
const consoleEvents = [];
const pageErrors = [];
const failedRequests = [];
const httpFailures = [];

function summarize() {
  const out = {
    consoleEvents: consoleEvents.slice(-200),
    pageErrors,
    failedRequests,
    httpFailures: httpFailures.slice(-100),
  };
  console.log("\n========== TEST RESULT ==========");
  console.log(JSON.stringify(out, null, 2));
}

const browser = await chromium.launch({
  headless: false,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
  ],
});

const context = await browser.newContext({
  viewport: { width: 1400, height: 900 },
});
await context.grantPermissions(["microphone"], { origin: BASE });

const page = await context.newPage();

page.on("console", (msg) => {
  const t = msg.type();
  if (t === "error" || t === "warning") {
    consoleEvents.push({
      type: t,
      text: msg.text(),
      location: msg.location(),
    });
  }
});
page.on("pageerror", (err) => {
  pageErrors.push({ message: err.message, stack: err.stack });
});
page.on("requestfailed", (req) => {
  failedRequests.push({
    url: req.url(),
    method: req.method(),
    failure: req.failure()?.errorText,
  });
});
page.on("response", async (res) => {
  if (res.status() >= 400) {
    let body = "";
    try {
      body = (await res.text()).slice(0, 500);
    } catch {}
    httpFailures.push({
      url: res.url(),
      status: res.status(),
      method: res.request().method(),
      body,
    });
  }
});

async function step(name, fn) {
  console.log(`\n→ ${name}`);
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.log(`  ✗ ${name}: ${err.message}`);
    throw err;
  }
}

try {
  await step("Visit /login", async () => {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    // Wait for React's onSubmit to be wired before submitting.
    await page.waitForFunction(
      () => {
        const form = document.querySelector("form");
        if (!form) return false;
        const fiber = Object.keys(form).find((k) =>
          k.startsWith("__reactProps$"),
        );
        return Boolean(fiber && form[fiber]?.onSubmit);
      },
      { timeout: 15000 },
    );
  });

  await step("Fill login form", async () => {
    await page.fill("#email", email);
    await page.fill("#password", password);
  });

  await step("Submit login → wait for /dashboard", async () => {
    await Promise.all([
      page.waitForURL(/\/dashboard(\?|$|\/)/, { timeout: 60000 }),
      page.click('button[type="submit"]'),
    ]);
  });

  await step("Click 'New demo'", async () => {
    await Promise.all([
      page.waitForURL(/\/dashboard\/demos\/[0-9a-f-]+/, { timeout: 120000 }),
      page.getByRole("button", { name: /new demo/i }).click(),
    ]);
  });

  await step("Wait for runner page to settle", async () => {
    // The "Demo sources" card with the SourceTypeSelector is always present.
    await page.getByText("Demo sources", { exact: false }).first().waitFor({
      timeout: 60000,
    });
  });

  await step("Tick PDFs source", async () => {
    const pdfsBox = page.getByRole("checkbox", { name: "PDFs" });
    await pdfsBox.waitFor({ timeout: 15000 });
    if (!(await pdfsBox.isChecked())) {
      await pdfsBox.check();
    }
  });

  await step("Untick Websites source", async () => {
    const webBox = page.getByRole("checkbox", { name: "Websites" });
    if (await webBox.isChecked().catch(() => false)) {
      await webBox.uncheck();
    }
  });

  await step("Wait for PDFs section + its file input", async () => {
    // The PDFs FileSourceSection has the heading "PDF documents".
    await page
      .getByText("PDF documents", { exact: false })
      .first()
      .waitFor({ timeout: 15000 });
  });

  await step("Upload mock.pdf into PDFs source", async () => {
    // FileSourceSection uses a hidden <input type=file accept="application/pdf">.
    // Scope the locator to the PDFs card so we don't pick up the KB uploader.
    const pdfsCard = page
      .locator("div", { has: page.getByText("PDF documents") })
      .first();
    const fileInput = pdfsCard
      .locator('input[type="file"][accept*="pdf"]')
      .first();
    await fileInput.setInputFiles(PDF_PATH);
  });

  await step("Wait for upload to finish (mock.pdf row appears)", async () => {
    await page
      .locator('text=mock.pdf')
      .first()
      .waitFor({ timeout: 30000 });
  });

  await step("Save demo", async () => {
    await page.getByRole("button", { name: /save demo/i }).click();
    // The button flips to "Saved" briefly when the PUT succeeds.
    await page
      .getByRole("button", { name: /saved/i })
      .waitFor({ timeout: 15000 })
      .catch(() => {});
  });

  await step("Click START DEMO", async () => {
    const btn = page.getByRole("button", { name: /start demo/i });
    for (let i = 0; i < 40; i++) {
      if (await btn.isEnabled().catch(() => false)) break;
      await page.waitForTimeout(250);
    }
    if (!(await btn.isEnabled())) {
      throw new Error(
        "START DEMO never became enabled — check canStart gating",
      );
    }
    await btn.click();
  });

  await step("Observe demo for 30s, sampling every 5s", async () => {
    const samples = [];
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(5000);
      const statusBarText = await page
        .locator("header")
        .first()
        .innerText()
        .catch(() => "(no header text)");
      const transcript = await page
        .locator('div.space-y-2.p-2.overflow-y-auto')
        .first()
        .innerText()
        .catch(() => "");
      samples.push({
        t: `${(i + 1) * 5}s`,
        statusBar: statusBarText.replace(/\s+/g, " ").slice(0, 400),
        transcriptPreview: transcript.replace(/\s+/g, " ").slice(0, 400),
      });
      const shotPath = path.resolve(
        __dirname,
        `pdf-demo-${stamp}-t${(i + 1) * 5}s.png`,
      );
      await page.screenshot({ path: shotPath, fullPage: true }).catch(() => {});
    }
    console.log("    Demo run samples:");
    for (const s of samples) {
      console.log(`      [${s.t}] header="${s.statusBar}"`);
      if (s.transcriptPreview) {
        console.log(`            transcript: "${s.transcriptPreview}"`);
      }
    }
  });

  await step("Click END DEMO if visible", async () => {
    const endBtn = page.getByRole("button", { name: /end demo/i });
    if (await endBtn.isVisible().catch(() => false)) {
      await endBtn.click();
      await page.waitForTimeout(3000);
    }
  });
} catch (err) {
  console.log("\n!! FAILED:", err.message);
  try {
    const shot = path.resolve(__dirname, `pdf-demo-failure-${stamp}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    console.log("Screenshot:", shot);
  } catch {}
} finally {
  summarize();
  await browser.close();
}
