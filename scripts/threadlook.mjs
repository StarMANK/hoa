// Look at the thread at 4x. A 1px line at 24% alpha is invisible in a 1440px
// screenshot but obvious when the column around it is scaled up.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const outDir = process.env.OUT_DIR ?? join(process.env.JCODE_SCRATCH_DIR ?? '/tmp', 'thread-look');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'],
});

for (const vp of [
  { name: 'desktop', width: 1440, height: 900, x: 90, w: 200 },
  { name: 'mobile', width: 390, height: 844, x: 0, w: 120 },
]) {
  const page = await (
    await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 4,
    })
  ).newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);

  const range = await page.evaluate(() => {
    const r = document.querySelector('.trail').getBoundingClientRect();
    const vh = window.innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    const clamp = (v) => Math.min(max, Math.max(0, v));
    return { from: clamp(r.top + window.scrollY), to: clamp(r.top + window.scrollY + r.height - vh) };
  });

  for (const f of [0.25, 0.5, 0.75]) {
    const y = Math.round(range.from + (range.to - range.from) * f);
    await page.evaluate((t) => window.scrollTo({ top: t, behavior: 'instant' }), y);
    await page.waitForTimeout(900);
    const where = await page.evaluate(() => {
      const el = document.querySelector('.trail__thread');
      const cs = getComputedStyle(el, '::after');
      const m = new DOMMatrixReadOnly(cs.transform === 'none' ? '' : cs.transform);
      const r = el.getBoundingClientRect();
      const bead = Number(String(cs.backgroundSize).split(/\s+/)[1]?.replace('px', '')) || 0;
      return { beadY: Math.round(r.top + m.m42 + bead / 2) };
    });
    const name = `${vp.name}-${String(Math.round(f * 100)).padStart(3, '0')}`;
    await page.screenshot({ path: join(outDir, `${name}.png`), clip: { x: vp.x, y: 0, width: vp.w, height: vp.height } });
    console.log(`[${vp.name}] y=${y} bead centre at viewport y=${where.beadY} -> ${name}.png`);
  }

  await page.context().close();
}

await browser.close();
console.log(`\n${outDir}`);
