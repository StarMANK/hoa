// Measures what is really colliding: boxes of hero copy vs every ape on screen,
// plus the computed mask/opacity the browser actually resolved for them.
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({});
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const report = await page.evaluate(() => {
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const hits = [];
  const copy = ['#home .hero__blurb', '#home .hero__actions .cta', '#home .lead', '#home .hero__title'];
  const apes = [...document.querySelectorAll('.procession__walker, .roam__walker')];
  for (const sel of copy) {
    const c = document.querySelector(sel);
    if (!c) continue;
    const cb = box(c);
    for (const a of apes) {
      const ab = box(a);
      const ox = Math.min(cb.x + cb.w, ab.x + ab.w) - Math.max(cb.x, ab.x);
      const oy = Math.min(cb.y + cb.h, ab.y + ab.h) - Math.max(cb.y, ab.y);
      if (ox > 0 && oy > 0) {
        const cs = getComputedStyle(a);
        hits.push({
          sel,
          copy: cb,
          ape: a.className,
          apeBox: ab,
          overlap: `${ox}x${oy}`,
          opacity: cs.opacity,
        });
      }
    }
  }
  const proc = document.querySelector('.procession');
  const procCs = proc ? getComputedStyle(proc) : null;
  return {
    hits,
    processionBox: proc ? box(proc) : null,
    mask: procCs ? procCs.maskImage || procCs.webkitMaskImage : null,
    scrollProgress: getComputedStyle(document.querySelector('.world')).getPropertyValue('--scroll-progress'),
  };
});

console.log(JSON.stringify(report, null, 2));
await browser.close();
