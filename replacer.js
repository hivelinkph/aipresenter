const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, 'presentation.html');
let html = fs.readFileSync(filePath, 'utf8');

// The replacement HTML for the small logo
const imgTag = '<img src="hivelink_logo.jpg" class="hivelink-logo-small" alt="Hivelink I.T. Solutions" style="position: absolute; top: 80px; left: 140px; height: 60px; z-index: 20; background: white; padding: 10px 20px; border-radius: 12px; box-shadow: 0 5px 15px rgba(0,0,0,0.1);" />';

// Specifically catch the varied ones first
html = html.replace(/<div class="hivelink-logo-small">[\s\S]*?<div class="bottom-row" style="color: white;">I\.T\. SOLUTIONS<\/div>\s*<\/div>/g, imgTag);

// Catch the common ones
html = html.replace(/<div class="hivelink-logo-small">[\s\S]*?<div class="bottom-row">I\.T\. SOLUTIONS<\/div>\s*<\/div>/g, imgTag);

fs.writeFileSync(filePath, html, 'utf8');
console.log('Logos replaced.');
