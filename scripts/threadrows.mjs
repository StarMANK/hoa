// How much of the trail line actually reaches the screen? Diff only the thread's
// own pixels, one per row, and report the occluded runs. Paint-order queries were
// useless here (elementFromPoint reports stacking order, not whether anything
// was painted), so this hides the thread and compares the exact same rows.
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

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
    content: '*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }',
  });

  const threadX = await page.evaluate(
    () => document.querySelector('.trail__thread').getBoundingClientRect().left,
  );
  // Sub-pixel left: round to the device pixels the line actually covers.
  const col = Math.round(threadX);
  const clip = { x: col, y: 0, width: 1, height: vp.height };

  const range = await page.evaluate(() => {
    const r = document.querySelector('.trail').getBoundingClientRect();
    const vh = window.innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    const clamp = (v) => Math.min(max, Math.max(0, v));
    return { from: clamp(r.top + window.scrollY), to: clamp(r.top + window.scrollY + r.height - vh) };
  });

  console.log(`\n[${vp.name}] thread at x=${threadX.toFixed(1)}, diffing that single column, ${vp.height} rows`);

  for (const f of [0.3, 0.6]) {
    const y = Math.round(range.from + (range.to - range.from) * f);
    await page.evaluate((t) => window.scrollTo({ top: t, behavior: 'instant' }), y);
    await page.waitForTimeout(800);

    const a = await decode(page, await page.screenshot({ clip }));
    await page.evaluate(() => (document.querySelector('.trail__thread').style.display = 'none'));
    await page.waitForTimeout(150);
    const b = await decode(page, await page.screenshot({ clip }));
    await page.evaluate(() => (document.querySelector('.trail__thread').style.display = ''));

    const rows = [];
    for (let r = 0; r < a.h; r++) {
      const i = r * 4;
      rows.push(
        Math.abs(a.d[i] - b.d[i]) + Math.abs(a.d[i + 1] - b.d[i + 1]) + Math.abs(a.d[i + 2] - b.d[i + 2]),
      );
    }
    // The bead is far brighter than the line, so report the two tiers apart.
    const line = rows.filter((d) => d > 2 && d <= 120);
    const bead = rows.filter((d) => d > 120);
    const gone = rows.filter((d) => d <= 2).length;

    let runs = [];
    let start = null;
    for (let r = 0; r < rows.length; r++) {
      if (rows[r] > 2 && start === null) start = r;
      if (rows[r] <= 2 && start !== null) {
        runs.push([start, r - 1]);
        start = null;
      }
    }
    if (start !== null) runs.push([start, rows.length - 1]);
    const gaps = [];
    for (let i = 1; i < runs.length; i++) gaps.push([runs[i - 1][1] + 1, runs[i][0] - 1]);
    const worst = gaps.sort((p, q) => q[1] - q[0] - (p[1] - p[0])).slice(0, 3);

    console.log(
      `  y=${y}  rows painted ${line.length + bead.length}/${rows.length} ` +
        `(line ${line.length}, bead ${bead.length})  occluded ${gone}  segments ${runs.length}`,
    );
    console.log(
      `    brightest row delta ${Math.max(...rows)}  visible segments: ` +
        runs.filter((r) => r[1] - r[0] > 20).map((r) => `${r[0]}-${r[1]}`).join(', ') || '    (none over 20px)',
    );
    if (worst.length) console.log(`    darkest gaps: ${worst.map((g) => `${g[0]}-${g[1]} (${g[1] - g[0] + 1}px)`).join(', ')}`);
  }

  await page.context().close();
}

await browser.close();
