import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3000";
const PDF_PATH = path.resolve(__dirname, "mock.pdf");

const stamp = Date.now();
const email = `test+${stamp}@example.com`;
const password = "P@ssword123!";
const displayName = `Test User ${stamp}`;

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
  await step("Visit /signup", async () => {
    await page.goto(`${BASE}/signup`, { waitUntil: "domcontentloaded" });
    // Belt-and-suspenders: ensure the React form onSubmit is bound before
    // we click submit. Without this, a fast click submits the form via the
    // browser's default GET handler and the page just reloads /signup.
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

  await step("Fill signup form", async () => {
    await page.fill("#displayName", displayName);
    await page.fill("#email", email);
    await page.fill("#password", password);
  });

  await step("Submit signup → wait for /dashboard", async () => {
    await Promise.all([
      page.waitForURL(/\/dashboard(\?|$|\/)/, { timeout: 60000 }),
      page.click('button[type="submit"]'),
    ]);
  });

  await step("Click 'New demo'", async () => {
    await Promise.all([
      // First compile of /dashboard/demos/[id] in Next dev can take 60s+.
      page.waitForURL(/\/dashboard\/demos\/[0-9a-f-]+/, { timeout: 120000 }),
      page.getByRole("button", { name: /new demo/i }).click(),
    ]);
  });

  await step("Wait for demo page to load", async () => {
    // First-compile of the demo page + GET /api/demos/[id] can be slow.
    await page.waitForSelector('input#url', { timeout: 60000 });
  });

  await step("Set target URL", async () => {
    await page.fill("#url", "https://example.com");
  });

  await step("Add a manual section", async () => {
    await page.getByRole("button", { name: /add section/i }).click();
    // The new section title input shows up
    await page.waitForSelector('input[placeholder="Section name"]', {
      timeout: 5000,
    });
  });

  await step("Upload mock PDF to KB", async () => {
    // Hidden file input inside the DemoKnowledgeBase component.
    // Match by accept= containing application/pdf to avoid grabbing
    // file inputs in the Sources section (none enabled by default).
    const input = page.locator('input[type="file"][accept*="application/pdf"]');
    await input.setInputFiles(PDF_PATH);
  });

  await step("Wait for KB upload to register", async () => {
    // The component re-fetches the list after upload; "mock.pdf" should appear.
    await page.waitForSelector('text=mock.pdf', { timeout: 30000 });
  });

  await step("Wait for KB processing terminal status (ready or failed)", async () => {
    // Polls until the badge text is "ready" or "failed". The component
    // already polls /api/kb/documents every 2s.
    const t0 = Date.now();
    let status = "";
    let docError = "";
    while (Date.now() - t0 < 60000) {
      status = await page.locator('[class*="badge"], div:has(> span):has-text("mock.pdf")').first().innerText().catch(() => "");
      // Cleaner: read the badge directly.
      const badgeText = await page
        .locator('text=mock.pdf')
        .locator("xpath=ancestor::div[contains(@class,'border')][1]")
        .locator('text=/^(pending|extracting|embedding|ready|failed)$/')
        .first()
        .innerText()
        .catch(() => "");
      if (badgeText === "ready" || badgeText === "failed") {
        status = badgeText;
        if (badgeText === "failed") {
          docError = await page
            .locator('text=mock.pdf')
            .locator("xpath=ancestor::div[contains(@class,'border')][1]")
            .locator('.text-destructive')
            .innerText()
            .catch(() => "(no error text rendered)");
        }
        break;
      }
      await page.waitForTimeout(1000);
    }
    console.log(`    KB doc status: "${status}"`);
    if (docError) console.log(`    KB doc error: ${docError}`);
  });

  await step("Save demo", async () => {
    await page.getByRole("button", { name: /save demo/i }).click();
    await page.waitForTimeout(1500);
  });

  await step("Click START DEMO", async () => {
    const btn = page.getByRole("button", { name: /start demo/i });
    for (let i = 0; i < 20; i++) {
      if (await btn.isEnabled().catch(() => false)) break;
      await page.waitForTimeout(250);
    }
    await btn.click();
  });

  await step("Observe demo running for 30s, sampling every 5s", async () => {
    const samples = [];
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(5000);
      // StatusBar text — captures state pill + connection badges + lastError.
      const statusBarText = await page
        .locator("header")
        .first()
        .innerText()
        .catch(() => "(no header text)");
      // Transcript section text — target the TranscriptView's scroll
      // container directly via its tailwind class signature.
      const transcript = await page
        .locator('div.space-y-2.p-2.overflow-y-auto')
        .first()
        .innerText()
        .catch(() => "");
      samples.push({
        t: `${(i + 1) * 5}s`,
        statusBar: statusBarText.replace(/\s+/g, " ").slice(0, 400),
        transcriptPreview: transcript.replace(/\s+/g, " ").slice(0, 300),
      });
      const shotPath = path.resolve(
        __dirname,
        `demo-run-${stamp}-t${(i + 1) * 5}s.png`,
      );
      await page
        .screenshot({ path: shotPath, fullPage: true })
        .catch(() => {});
    }
    console.log("    Demo run samples:");
    for (const s of samples) {
      console.log(`      [${s.t}] state="${s.statusBar}"`);
      if (s.transcriptPreview) {
        console.log(`            transcript: "${s.transcriptPreview}"`);
      }
    }
  });

  await step("Click END DEMO if visible, otherwise skip", async () => {
    const endBtn = page.getByRole("button", { name: /end demo/i });
    if (await endBtn.isVisible().catch(() => false)) {
      await endBtn.click();
      await page.waitForTimeout(2000);
    }
  });
} catch (err) {
  console.log("\n!! FAILED:", err.message);
  // Take a screenshot for context.
  try {
    const shot = path.resolve(__dirname, `failure-${stamp}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    console.log("Screenshot:", shot);
  } catch {}
} finally {
  summarize();
  await browser.close();
}
