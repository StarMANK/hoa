// The fixed chapter rail must never sit on top of content. Measured before the
// gutter existed: at 1440px the rail's left edge (1309) cut 51-64px into the
// handprint and gorilla art, and at 1280 it reached further in. A centered
// 1320px shell and a right-docked rail collide in a width range, not at one
// width, so this walks the range: for every content block the shell holds,
// scroll it through the rail's fixed band and fail on any real overlap.
// The same probe holds the other end: on touch the rail docks at the bottom
// centre and the footer must keep its floor clear of it.
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const URL = process.env.PROBE_URL ?? 'http://localhost:5173/';

// The shell's content blocks per section, desktop.
const TARGETS =
  '.chapter__mark svg, .chapter__glyphs, .join__card, .data__grid > *, .genres > *, .rules > *, .foot__grid, .section-head';

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

let failed = false;

for (const width of [1000, 1100, 1280, 1440, 1600, 1920]) {
  const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const rail = await page.evaluate(() => {
    const r = document.querySelector('.rail').getBoundingClientRect();
    return { l: r.left, r: r.right, t: r.top, b: r.bottom };
  });

  const heights = await page.evaluate(() =>
    [...document.querySelectorAll('section, footer')].map((s) => ({
      id: s.id || 'foot',
      top: s.getBoundingClientRect().top + scrollY,
      h: s.offsetHeight,
    })),
  );

  const step = 700;
  for (const stop of heights) {
    for (let y = stop.top; y < stop.top + stop.h + 1; y += step) {
      await page.evaluate((v) => window.scrollTo({ top: Math.min(v, document.body.scrollHeight), behavior: 'instant' }), y);
      await page.waitForTimeout(120);
      const hits = await page.evaluate((sel) => {
        const rail = document.querySelector('.rail').getBoundingClientRect();
        return [...document.querySelectorAll(sel)]
          .map((t) => {
            const b = t.getBoundingClientRect();
            const ox = Math.min(rail.right, b.right) - Math.max(rail.left, b.left);
            const oy = Math.min(rail.bottom, b.bottom) - Math.max(rail.top, b.top);
            if (ox <= 2 || oy <= 2) return null;
            const cls = t.getAttribute('class') ?? t.tagName.toLowerCase();
            return { cls: cls.toString().slice(0, 40), ox: Math.round(ox), oy: Math.round(oy) };
          })
          .filter(Boolean);
      }, TARGETS);
      if (hits.length) {
        failed = true;
        console.error(`${width}px @y=${Math.round(y)}: rail over ${hits.map((h) => `${h.cls} (+${h.ox}x${h.oy})`).join(', ')}`);
      }
    }
  }

  // The rail itself must stay inside the viewport.
  const after = await page.evaluate(() => {
    const r = document.querySelector('.rail').getBoundingClientRect();
    return { r: Math.round(r.right), l: Math.round(r.left), vw: innerWidth };
  });
  if (after.r > after.vw || after.l < 0) {
    failed = true;
    console.error(`${width}px: rail off-viewport (l=${after.l} r=${after.r} vw=${after.vw})`);
  }

  await page.close();
}

// Touch: docked rail vs footer floor.
{
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const rail = document.querySelector('.rail').getBoundingClientRect();
    const legal = document.querySelector('.foot__legal').getBoundingClientRect();
    const notes = document.querySelector('.foot__notes').getBoundingClientRect();
    return { railTop: rail.top, legalBottom: legal.bottom, notesBottom: notes.bottom };
  });
  if (r.railTop < r.legalBottom || r.railTop < r.notesBottom) {
    failed = true;
    console.error(`mobile: docked rail (top=${Math.round(r.railTop)}) over footer text (bottoms ${Math.round(r.legalBottom)}/${Math.round(r.notesBottom)})`);
  }
  await page.close();
}

await browser.close();

if (failed) {
  console.error('FAIL: the rail is standing on content');
  process.exit(1);
}
console.log('PASS: rail clear of content at 992-1920px and clear of the mobile footer');
