import { chromium } from 'playwright-core';

const EXE = '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await c.newPage();
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await p.waitForTimeout(1600);

// Scroll through so every reveal settles before measuring.
const h = await p.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
for (const f of [0.2, 0.4, 0.6, 0.8, 1]) {
  await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), Math.round(h * f));
  await p.waitForTimeout(500);
}
await p.evaluate(() => window.scrollTo(0, 0));
await p.waitForTimeout(700);

console.log(
  await p.evaluate(() => {
    const rows = [];
    document.querySelectorAll('.world > section, .world > footer, .trail, .seam').forEach((el) => {
      const r = el.getBoundingClientRect();
      const y = r.top + window.scrollY;
      const cs = getComputedStyle(el);
      // Content bottom vs section bottom = dead space at the tail.
      let contentBottom = y;
      el.querySelectorAll(':scope > *').forEach((k) => {
        const kr = k.getBoundingClientRect();
        if (kr.height > 4) contentBottom = Math.max(contentBottom, kr.bottom + window.scrollY);
      });
      const dead = Math.round(y + r.height - contentBottom);
      rows.push(
        `${(el.id || el.className).padEnd(22)} h=${String(Math.round(r.height)).padStart(5)}  pad=${cs.paddingBlock.padEnd(20)} tail-dead=${dead > 40 ? `${dead} !!` : dead}`,
      );
    });
    rows.push(`total scrollHeight = ${document.documentElement.scrollHeight}`);
    return rows.join('\n');
  }),
);
await b.close();
