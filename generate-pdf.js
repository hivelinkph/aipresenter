const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // Create a proper file URI for Windows
    const absolutePath = path.resolve(__dirname, 'presentation.html').replace(/\\/g, '/');
    const fileUrl = `file:///${absolutePath}`;

    console.log(`Loading ${fileUrl}...`);

    await page.goto(fileUrl, { waitUntil: 'networkidle' });

    // Wait to make sure fonts are loaded
    await page.evaluate(() => document.fonts.ready);

    const outPath = path.resolve(__dirname, 'Project_Portfolio_Presentation.pdf');
    await page.pdf({
        path: outPath,
        width: '1080px',
        height: '1527px',
        printBackground: true,
    });

    console.log(`PDF successfully generated at: ${outPath}`);

    await browser.close();
})();
