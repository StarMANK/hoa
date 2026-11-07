import path from 'node:path';
import { chromium } from 'playwright-core';

const root = path.resolve(process.cwd());
const exe = '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const browser = await chromium.launch({
  executablePath: exe,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1200);

const before = await page.evaluate(() => {
  const el = document.querySelector('.wall-grid');
  return { px: getComputedStyle(document.querySelector('.world')).getPropertyValue('--px'), t: getComputedStyle(el).transform };
});

await page.mouse.move(1200, 700);
await page.waitForTimeout(400);

const after = await page.evaluate(() => {
  const cs = getComputedStyle(document.querySelector('.world'));
  const el = document.querySelector('.wall-grid');
  const rect = el.getBoundingClientRect();
  return {
    px: cs.getPropertyValue('--px'),
    py: cs.getPropertyValue('--py'),
    tilt: cs.getPropertyValue('--tilt-x'),
    t: getComputedStyle(el).transform,
    layerRect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width) },
    doc: document.documentElement.scrollWidth,
  };
});

console.log('before pointer:', JSON.stringify(before));
console.log('after pointer :', JSON.stringify(after));
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
