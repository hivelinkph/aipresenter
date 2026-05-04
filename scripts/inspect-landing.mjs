import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", ".inspect");
import("node:fs").then(({ mkdirSync }) => mkdirSync(outDir, { recursive: true }));

const URL = process.env.INSPECT_URL || "http://localhost:3000/";

async function shoot(viewport, label) {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  console.log(`[${label}] navigating to ${URL} at ${viewport.width}x${viewport.height}`);
  await page.goto(URL, { waitUntil: "networkidle", timeout: 60_000 });
  // Let any reveal animations settle.
  await page.waitForTimeout(1500);

  const aboveFold = path.join(outDir, `${label}-fold.png`);
  await page.screenshot({ path: aboveFold, fullPage: false });
  console.log(`[${label}] above-fold → ${aboveFold}`);

  const full = path.join(outDir, `${label}-full.png`);
  await page.screenshot({ path: full, fullPage: true });
  console.log(`[${label}] full-page → ${full}`);

  await page.waitForTimeout(800);
  await browser.close();
}

await shoot({ width: 1920, height: 1080 }, "desktop-1920");
await shoot({ width: 1440, height: 900 }, "desktop-1440");
console.log("done.");
