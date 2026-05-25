import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen for console events
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`PAGE ERROR: ${msg.text()} at ${msg.location().url}`);
    } else {
      console.log(`PAGE LOG: ${msg.text()}`);
    }
  });

  page.on('response', response => {
    if (response.status() >= 400) {
      console.error(`NETWORK ERROR: ${response.status()} ${response.url()}`);
    }
  });
  
  // Listen for WebSocket errors
  page.on('websocket', ws => {
    console.log(`WebSocket opened: ${ws.url()}`);
    ws.on('framereceived', frame => console.log(`WS receive: ${frame.payload}`));
    ws.on('framesent', frame => console.log(`WS send: ${frame.payload}`));
    ws.on('socketerror', err => console.error(`WS error: ${err}`));
    ws.on('close', () => console.log(`WebSocket closed: ${ws.url()}`));
  });

  // Listen for unhandled exceptions inside the page
  page.on('pageerror', error => {
      console.error(`PAGE EXCEPTION: ${error.message}`);
  });

  try {
    console.log("Navigating to login...");
    await page.goto('https://aipresenter.vercel.app/login');
    
    console.log("Filling credentials...");
    await page.fill('input[type="email"]', 'hivelinkph@gmail.com');
    await page.fill('input[type="password"]', 'Artline#123');
    
    console.log("Submitting login...");
    await page.click('button[type="submit"]');

    console.log("Waiting for dashboard...");
    await page.waitForURL('**/dashboard');
    
    console.log("Clicking the first demo...");
    await page.click('a[href^="/dashboard/demos/"]');

    console.log("Waiting for demo page...");
    await page.waitForURL('**/dashboard/demos/*');
    
    console.log("Clicking START DEMO...");
    await page.click('button:has-text("START DEMO")');

    console.log("Waiting 15s to observe WebSocket connection...");
    await page.waitForTimeout(15000);

  } catch (e) {
      console.error("Error during script execution:", e)
  }

  await browser.close();
})();
