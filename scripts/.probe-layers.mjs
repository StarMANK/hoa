import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await c.newPage();
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
const info = await p.evaluate(() => {
  const out = [];
  document.querySelectorAll('.world > *').forEach((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    out.push(`${el.className || el.tagName} rect=${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)} z=${cs.zIndex} pos=${cs.position}`);
  });
  document.querySelectorAll('.canopy__band, .frond-frame__svg').forEach((el) => {
    const r = el.getBoundingClientRect();
    out.push(`  BAND ${el.parentElement.className} ${el.className.baseVal ?? el.className} rect=${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  });
  return out;
});
console.log(info.join('\n'));
await b.close();
