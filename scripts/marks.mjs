import { chromium } from 'playwright-core';

const b = await chromium.launch({
  executablePath: '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const c = await b.newContext({ viewport: { width: 900, height: 500 }, deviceScaleFactor: 2 });
const p = await c.newPage();

// Render every carved mark large and in isolation so shape errors are obvious.
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);

const svg = await p.evaluate(() => {
  const marks = Array.from(document.querySelectorAll('.mark'));
  return marks.map((m) => m.outerHTML);
});


const sheet = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{background:#0b0b0c;margin:0;padding:24px;font:12px monospace;color:#c9f04a}
  .row{display:flex;gap:24px;flex-wrap:wrap}
  .cell{background:#141416;padding:16px;border:1px solid #333}
  .cell svg{width:220px;height:190px}
  svg{overflow:visible}
  .carve{fill:none;stroke:#e63b10;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}
</style></head><body><div class="row">
${svg.map((s, i) => `<div class="cell">${s}</div>`).join('\n')}
</div></body></html>`;

await p.setContent(sheet);
await p.waitForTimeout(400);
await p.screenshot({ path: 'shots/marks-sheet.png' });
console.log(`captured ${svg.length} marks`);
await b.close();
