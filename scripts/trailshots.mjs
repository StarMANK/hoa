// The trail's light has to be judgeable by eye, not just by a transform matrix.
// Captures a strip of frames at evenly spaced scroll positions inside the trail
// so the bead's position can be compared across them side by side.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const outDir = process.env.OUT_DIR ?? new URL('../shots/trail/', import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });

const STEPS = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1];

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'],
});

for (const vp of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  const page = await (await browser.newContext({ viewport: { width: vp.width, height: vp.height } })).newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);

  // Park inside the trail rather than across the page: a fraction of total scroll
  // would spend most frames on other sections.
  const range = await page.evaluate(() => {
    const r = document.querySelector('.trail').getBoundingClientRect();
    const vh = window.innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    const clamp = (v) => Math.min(max, Math.max(0, v));
    return { from: clamp(r.top + window.scrollY), to: clamp(r.top + window.scrollY + r.height - vh) };
  });

  for (const f of STEPS) {
    const y = Math.round(range.from + (range.to - range.from) * f);
    await page.evaluate((t) => window.scrollTo({ top: t, behavior: 'instant' }), y);
    await page.waitForTimeout(900);
    const where = await page.evaluate(() => {
      const el = document.querySelector('.trail__thread');
      const cs = getComputedStyle(el, '::after');
      const m = new DOMMatrixReadOnly(cs.transform === 'none' ? '' : cs.transform);
      const th = el.getBoundingClientRect();
      const bead = Number(String(cs.backgroundSize).split(/\s+/)[1]?.replace('px', '')) || 0;
      return {
        prog: getComputedStyle(el).getPropertyValue('--visible-progress').trim(),
        along: ((m.m42 + bead / 2) / th.height).toFixed(3),
      };
    });
    const file = join(outDir, `${vp.name}-${String(Math.round(f * 100)).padStart(3, '0')}.png`);
    await page.screenshot({ path: file });
    console.log(`[${vp.name}] y=${String(y).padStart(5)}  progress=${where.prog}  bead along thread=${where.along}`);
  }

  await page.context().close();
}

await browser.close();
console.log(`\nframes in ${outDir}`);
