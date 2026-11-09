// Regression guard for the hero scroll cue.
//
// The procession walks behind the SCROLL label and the walkers move, so a single
// paused screenshot proves nothing: a placement clear of ink at one moment can be
// buried at another. This ghosts the cue's ink, samples the ground the words actually
// sit on across a full 9s walk cycle at several viewport heights, and fails if ape ink
// ever reappears under the label or the declared ink drops below WCAG AA there.
//
// It exists because brightening the tail apes to their authored alpha silently put a
// white silhouette under white glyphs and took the stroke to 1.38:1.
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
    return Array.from(ctx.getImageData(0, 0, c.width, c.height).data);
  }, url);
};

const srgb = (v) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = (r, g, b) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const ratio = (a, b) => {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
};

// Ink gone, layout untouched. Hiding the element instead would also hide whatever
// darkening it carries, so the "ground" measured would be ground the fix removed.
const GHOST = `
  .scroll-hint { color: transparent !important; text-shadow: none !important; }
  .scroll-hint * { color: transparent !important; fill: transparent !important; stroke: transparent !important; opacity: 0 !important; }
`;

const AA = 4.5;
const failures = [];

for (const height of [900, 800, 740]) {
  const page = await (await browser.newContext({ viewport: { width: 1440, height } })).newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // Read the ink before ghosting it, otherwise the probe measures its own
  // `color: transparent` and reports every placement as unreadable.
  const ink = await page.evaluate(() => getComputedStyle(document.querySelector('.scroll-hint')).color);
  const geo = await page.evaluate(() => {
    const el = document.querySelector('.scroll-hint');
    const r = el.getBoundingClientRect();
    return {
      box: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
      offViewport: Math.round(r.bottom - innerHeight),
      display: getComputedStyle(el).display,
    };
  });

  if (geo.display === 'none' || geo.box.w === 0) {
    failures.push(`${height}px: cue is not rendered`);
    continue;
  }
  if (geo.offViewport > 0) {
    failures.push(`${height}px: cue sits ${geo.offViewport}px below the viewport, invisible`);
    continue;
  }

  await page.addStyleTag({ content: GHOST });
  await page.waitForTimeout(200);

  const { box } = geo;
  let worst = 0;
  let worstApe = 0;
  for (let i = 0; i < 7; i += 1) {
    if (i) await page.waitForTimeout(1400); // ~9.8s, one full walk cycle
    const d = await decode(
      page,
      await page.screenshot({ clip: { x: box.x, y: box.y, width: box.w, height: box.h } }),
    );
    let max = 0;
    let bright = 0;
    for (let p = 0; p < d.length; p += 4) {
      const l = lum(d[p], d[p + 1], d[p + 2]);
      if (l > max) max = l;
      if (l > 0.2) bright += 1;
    }
    if (max > worst) {
      worst = max;
      worstApe = bright;
    }
  }

  const [ir, ig, ib, iaRaw] = (ink.match(/[\d.]+/g) ?? []).map(Number);
  const a = iaRaw === undefined ? 1 : iaRaw;
  const grey = (() => {
    let lo = 0;
    let hi = 255;
    for (let k = 0; k < 40; k += 1) {
      const mid = (lo + hi) / 2;
      if (lum(mid, mid, mid) < worst) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  })();
  const comp = (c) => a * c + (1 - a) * grey;
  const contrast = ratio(lum(comp(ir), comp(ig), comp(ib)), worst);
  const pct = ((worstApe / (box.w * box.h)) * 100).toFixed(1);

  console.log(
    `${height}px  cue x ${box.x}-${box.x + box.w} y ${box.y}-${box.y + box.h}  ` +
      `worst ground L ${worst.toFixed(4)}, ape ink under the words ${pct}%  =>  ${contrast.toFixed(2)}:1`,
  );
  if (contrast < AA) failures.push(`${height}px: only ${contrast.toFixed(2)}:1 against the procession`);
  if (worstApe > 0) failures.push(`${height}px: ape ink reaches under the cue (${pct}% of its box)`);

  await page.context().close();
}

await browser.close();

if (failures.length) {
  console.error('\nFAIL');
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log('\nthe scroll cue stays clear of the procession at every height');
