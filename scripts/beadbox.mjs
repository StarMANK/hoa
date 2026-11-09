// What does the travelling light actually paint? Diff a window around the thread
// with the bead on and off and report the bounding box, width and height of every
// pixel it changed. Squinting at a 4x crop kept being wrong about whether the
// glow was bleeding into the chapter text.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const outDir = process.env.OUT_DIR ?? join(process.env.JCODE_SCRATCH_DIR ?? '/tmp', 'beadbox');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'],
});

const decode = async (page, buffer) => {
  const url = `data:image/png;base64,${buffer.toString('base64')}`;
  return page.evaluate(async (src) => {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = src;
    });
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    return { w: c.width, h: c.height, d: Array.from(ctx.getImageData(0, 0, c.width, c.height).data) };
  }, url);
};

for (const vp of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  const page = await (
    await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
  ).newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);
  await page.addStyleTag({
    content:
      '*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }\n' +
      // Toggle the travelling light without touching the line it rides on, so the
      // diff isolates the bead instead of the whole thread.
      '.bead-off.trail__thread::after { background: none !important; }',
  });
  // The roam apes are driven by requestAnimationFrame, not CSS animations, so
  // pausing animations does not stop them and they drifted between captures.
  await page.addStyleTag({ content: '.roam { display: none !important; }' });

  const threadX = await page.evaluate(
    () => document.querySelector('.trail__thread').getBoundingClientRect().left,
  );
  // A window wide enough to catch any bleed into whatever sits beside the thread.
  const x0 = Math.max(0, Math.round(threadX) - 120);
  const clip = { x: x0, y: 0, width: 240, height: vp.height };

  const range = await page.evaluate(() => {
    const r = document.querySelector('.trail').getBoundingClientRect();
    const vh = window.innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    const clamp = (v) => Math.min(max, Math.max(0, v));
    return { from: clamp(r.top + window.scrollY), to: clamp(r.top + window.scrollY + r.height - vh) };
  });

  console.log(`\n[${vp.name}] thread at x=${threadX.toFixed(1)}, diffing x=${x0}..${x0 + 240}`);

  for (const f of [0.3, 0.55]) {
    const y = Math.round(range.from + (range.to - range.from) * f);
    await page.evaluate((t) => window.scrollTo({ top: t, behavior: 'instant' }), y);
    await page.waitForTimeout(800);

    await page.evaluate(() => document.querySelector('.trail__thread').classList.add('bead-off'));
    await page.waitForTimeout(150);
    const off = await decode(page, await page.screenshot({ clip }));
    await page.evaluate(() => document.querySelector('.trail__thread').classList.remove('bead-off'));
    await page.waitForTimeout(250);
    const on = await decode(page, await page.screenshot({ clip }));

    let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1, n = 0, maxD = 0;
    // Split by strength so the wide soft halo is not mistaken for the core.
    let coreMinX = 1e9, coreMaxX = -1;
    for (let r = 0; r < off.h; r++) {
      for (let c = 0; c < off.w; c++) {
        const i = (r * off.w + c) * 4;
        const d =
          Math.abs(on.d[i] - off.d[i]) +
          Math.abs(on.d[i + 1] - off.d[i + 1]) +
          Math.abs(on.d[i + 2] - off.d[i + 2]);
        if (d <= 2) continue;
        n++;
        if (c < minX) minX = c;
        if (c > maxX) maxX = c;
        if (r < minY) minY = r;
        if (r > maxY) maxY = r;
        if (d > maxD) maxD = d;
        if (d > 30) {
          if (c < coreMinX) coreMinX = c;
          if (c > coreMaxX) coreMaxX = c;
        }
      }
    }
    console.log(
      `  y=${y}  ${n} px  box x ${minX}..${maxX} (w=${maxX - minX + 1}) y ${minY}..${maxY} (h=${maxY - minY + 1})  ` +
        `strong core x ${coreMinX}..${coreMaxX} (w=${coreMaxX - coreMinX + 1})  max delta ${maxD}`,
    );

    const fs = await import('node:fs');
    fs.writeFileSync(join(outDir, `${vp.name}-${String(Math.round(f * 100)).padStart(3, '0')}-on.png`), await page.screenshot({ clip }));
    fs.writeFileSync(join(outDir, `${vp.name}-${String(Math.round(f * 100)).padStart(3, '0')}-off.png`), await page.screenshot({ clip }));
  }

  await page.context().close();
}

await browser.close();
console.log(`\npairs in ${outDir}`);
