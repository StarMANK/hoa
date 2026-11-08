// Does the trail line contribute a single visible pixel? Paint order is not the
// same as occlusion: elementFromPoint said the chapters sit above the thread
// everywhere, but a .chapter has a transparent background and paints nothing
// over it. The only honest check is a differential screenshot - capture the
// thread column, hide the thread, capture again, and compare the pixels.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const outDir = process.env.OUT_DIR ?? join(process.env.JCODE_SCRATCH_DIR ?? '/tmp', 'thread-diff');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'],
});

// Decode a PNG without dependencies: the clip is tiny, so ask the browser to
// decode it back to RGBA via a canvas.
async function pixelsOf(page, buffer) {
  const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
  return page.evaluate(async (url) => {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = url;
    });
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    return Array.from(ctx.getImageData(0, 0, c.width, c.height).data);
  }, dataUrl);
}

for (const vp of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  const page = await (
    await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
  ).newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);

  const range = await page.evaluate(() => {
    const r = document.querySelector('.trail').getBoundingClientRect();
    const vh = window.innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    const clamp = (v) => Math.min(max, Math.max(0, v));
    return { from: clamp(r.top + window.scrollY), to: clamp(r.top + window.scrollY + r.height - vh) };
  });

  const threadX = await page.evaluate(
    () => Math.round(document.querySelector('.trail__thread').getBoundingClientRect().left),
  );
  const clip = { x: Math.max(0, threadX - 6), y: 0, width: 14, height: vp.height };

  // Animate.css keeps swaying and apes keep drifting between the two captures,
  // which swamps a 1px line. Freeze the whole page before diffing; reduced
  // motion would change the design, so pause in place instead.
  await page.addStyleTag({
    content: '*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }',
  });

  console.log(`\n[${vp.name}] thread at x=${threadX}, sampling a 14px column, full viewport height`);
  let anyVisible = 0;
  let frames = 0;

  for (let i = 0; i <= 8; i++) {
    const y = Math.round(range.from + ((range.to - range.from) * i) / 8);
    await page.evaluate((t) => window.scrollTo({ top: t, behavior: 'instant' }), y);
    await page.waitForTimeout(700);

    const withThread = await pixelsOf(page, await page.screenshot({ clip }));
    await page.evaluate(() => {
      const t = document.querySelector('.trail__thread');
      t.dataset.wasDisplay = t.style.display;
      t.style.display = 'none';
    });
    await page.waitForTimeout(120);
    const withoutThread = await pixelsOf(page, await page.screenshot({ clip }));
    await page.evaluate(() => {
      const t = document.querySelector('.trail__thread');
      t.style.display = t.dataset.wasDisplay || '';
    });

    // Count pixels the thread changed by more than a rounding step, and report
    // the single largest change: a 1px line at 24% alpha over a dark ground is a
    // change of a few units per channel, which is real but faint.
    let changed = 0;
    let maxDelta = 0;
    let brightSum = 0;
    for (let p = 0; p < withThread.length; p += 4) {
      const d =
        Math.abs(withThread[p] - withoutThread[p]) +
        Math.abs(withThread[p + 1] - withoutThread[p + 1]) +
        Math.abs(withThread[p + 2] - withoutThread[p + 2]);
      if (d > 2) changed++;
      if (d > maxDelta) maxDelta = d;
      brightSum += d;
    }
    if (maxDelta > 2) anyVisible++;
    frames++;
    console.log(
      `  y=${String(y).padStart(5)}  pixels changed ${String(changed).padStart(4)} of ${withThread.length / 4}  ` +
        `max channel delta ${maxDelta}  mean ${((brightSum / (withThread.length / 4)) / 3).toFixed(2)}`,
    );

    if (i === 4) {
      const fs = await import('node:fs');
      fs.writeFileSync(join(outDir, `${vp.name}-with.png`), await page.screenshot({ clip }));
    }
  }

  console.log(`  the thread changes pixels in ${anyVisible}/${frames} frames`);
  await page.context().close();
}

await browser.close();
console.log(`\ncropped samples in ${outDir}`);
