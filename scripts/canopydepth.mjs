// Does the canopy veil erase the subject?
//
// world.css states the depth order as void > treeline > canopy far > roam (apes) >
// canopy near, and .canopy--near / .canopy--front really are z-index 1 while the
// procession is 0 and the roam layer is -1. Foliage is deliberately painted in front
// of the subject: an ape walks behind a frond. Measured, that is not a small detail.
// On desktop the foreground band (y756-900 plus a strip along the top) darkens every
// pixel it touches by a mean delta of 18-33, and the near procession apes stand in it
// almost completely: 96-100% of their ink has foliage in front of it. So the veil is
// not decoration brushing past the subject, it is the last thing painted over the
// subject. Nothing measured whether the apes survive it.
//
// Two ways this can go wrong, and two metrics for them:
//
//   1. the veil erases the subject. Occlusion itself is the intended look, so the
//      gate is not coverage (a first cut of this script failed three viewports at
//      40% coverage, which is meaningless: an ape standing in undergrowth is supposed
//      to be occluded, and near-total occlusion by a dim veil can be perfectly
//      legible). The gate is contrast between what the ape draws behind the leaves
//      and the same leaves over bare ground. Floor is 3:1, the WCAG 1.4.11 non-text
//      contrast minimum, which exists for exactly this kind of meaningful graphic.
//   2. the veil covers words. Scenery in front of a heading or a button is a defect
//      at any depth, because it is the text the visitor came to read.
//
// Boxes and bounding geometry mislead on both counts, so both metrics work on paint
// or on the browser's own hit-testing:
//
//   - Counting changed pixels inside an element box asked the wrong question for
//     text. 82.5% of the hero blurb's box shifts when the front fern is hidden, yet
//     elementFromPoint shows those glyphs belong to `.hero`, which is
//     position:relative z-index:2 and therefore a stacking context above the canopy's
//     z-index 1. The 82.5% was ground between letters. Hence the grid of
//     elementFromPoint probes instead of pixel deltas for text.
//   - A box is the wrong shape for an ape too: a walker's box is mostly empty space
//     around a crouched silhouette, so foliage behind the box counts as coverage.
//     Ape ink is therefore found by toggling the ape layers and diffing.
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const MIN_CONTRAST = 3; // WCAG 1.4.11, non-text contrast minimum
const MIN_INK = 200; // below this an ape is too small to judge occlusion on

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

const HIDE_FG = '.canopy--near, .canopy--front { visibility: hidden !important; }';
const HIDE_APES = '.procession, .roam__walker { visibility: hidden !important; }';
const TEXT = '.hero h1, .hero .lead, .hero .body-copy, .cta, .rail__item, .scroll-hint';

const differs = (a, b, p) =>
  Math.abs(a.d[p] - b.d[p]) + Math.abs(a.d[p + 1] - b.d[p + 1]) + Math.abs(a.d[p + 2] - b.d[p + 2]) > 6;

const lum = (a, p) => (0.2126 * a.d[p] + 0.7152 * a.d[p + 1] + 0.0722 * a.d[p + 2]) / 255;

const ratio = (x, y) => (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

const failures = [];

for (const [label, vp, scrollFrac] of [
  ['desktop hero', { width: 1440, height: 900 }, 0],
  ['mobile hero', { width: 390, height: 844 }, 0],
  ['desktop mid-page', { width: 1440, height: 900 }, 0.4],
]) {
  const page = await (await browser.newContext({ viewport: vp })).newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);
  await page.evaluate((f) => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * f), scrollFrac);
  await page.waitForTimeout(1200);
  await page.addStyleTag({ content: '*, *::before, *::after { animation-play-state: paused !important; }' });
  await page.waitForTimeout(300);

  const apes = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('.procession__walker .ape, .roam__walker .ape')) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      if (r.bottom < 0 || r.top > innerHeight) continue;
      out.push({ x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) });
    }
    return out;
  });

  // Four frames that differ only in what is painted:
  //   painted     everything
  //   noFoliage    apes, ground, no foreground leaves
  //   bare         ground only
  //   through      foreground leaves over ground, no apes
  const painted = await decode(page, await page.screenshot());
  await page.addStyleTag({ content: HIDE_FG });
  await page.waitForTimeout(300);
  const noFoliage = await decode(page, await page.screenshot());
  await page.addStyleTag({ content: HIDE_APES });
  await page.waitForTimeout(300);
  const bare = await decode(page, await page.screenshot());
  await page.addStyleTag({ content: HIDE_FG.replace('hidden', 'visible') });
  await page.waitForTimeout(300);
  const through = await decode(page, await page.screenshot());

  console.log(`\n[${label}] ${apes.length} apes on screen`);

  let judged = 0;
  let worstRatio = null;
  let worstIndex = -1;
  for (const [i, box] of apes.entries()) {
    const x0 = Math.max(0, box.x);
    const y0 = Math.max(0, box.y);
    const x1 = Math.min(painted.w, box.x + box.width);
    const y1 = Math.min(painted.h, box.y + box.height);
    let ink = 0;
    const behind = []; // ape drawn, foliage in front of it
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const p = (y * painted.w + x) * 4;
        // Is this ape ink? Compare foliage-off with apes also off, so nothing in
        // front of the ape can contribute to the difference.
        if (!differs(noFoliage, bare, p)) continue;
        ink += 1;
        // Is foliage in front of it? Hiding the foliage has to change the pixel;
        // if the ape were in front of the leaves, hiding them would change nothing.
        if (!differs(painted, noFoliage, p)) continue;
        behind.push(ratio(lum(painted, p), lum(through, p)));
      }
    }
    if (ink < MIN_INK || behind.length < MIN_INK) {
      if (ink >= MIN_INK) {
        console.log(`  ape #${i} ${box.width}x${box.height} at y${box.y}: ${ink} ink px, none behind foliage`);
      }
      continue;
    }
    judged += 1;
    const med = median(behind);
    const clearContrasts = [];
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const p = (y * painted.w + x) * 4;
        if (!differs(noFoliage, bare, p)) continue;
        if (differs(painted, noFoliage, p)) continue; // behind foliage: already counted
        clearContrasts.push(ratio(lum(noFoliage, p), lum(bare, p)));
      }
    }
    const medClear = median(clearContrasts);
    console.log(
      `  ape #${i} ${box.width}x${box.height} at y${box.y}: ${ink} ink px, ${behind.length} behind foliage ` +
        `(${((behind.length / ink) * 100).toFixed(0)}%), median CR through veil ${med.toFixed(2)}` +
        `${medClear ? `, unobstructed ${medClear.toFixed(2)}` : ''}`,
    );
    if (worstRatio === null || med < worstRatio) {
      worstRatio = med;
      worstIndex = i;
    }
    if (med < MIN_CONTRAST) {
      failures.push(`${label}: ape #${i} reads only ${med.toFixed(2)}:1 through the foliage veil`);
    }
  }
  console.log(
    worstRatio === null
      ? `  no ape was large enough behind the veil to judge (${MIN_INK} ink px required)`
      : `  worst judged ape: #${worstIndex} at ${worstRatio.toFixed(2)}:1 (floor ${MIN_CONTRAST}:1)`,
  );

  // Is the foliage ever painted over words? Ask the browser what is on top rather
  // than trusting pixel deltas, so no stacking context can fool it.
  const overText = await page.evaluate((sel) => {
    const isCanopy = (el) => el?.closest?.('.canopy');
    const out = [];
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width < 6 || r.height < 6) continue;
      if (r.bottom < 0 || r.top > innerHeight) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
      let inFront = 0;
      let probed = 0;
      for (let y = r.top + 2; y < r.bottom - 1; y += 4) {
        for (let x = r.left + 2; x < r.right - 1; x += 4) {
          const top = document.elementFromPoint(Math.round(x), Math.round(y));
          if (!top) continue;
          probed += 1;
          if (isCanopy(top)) inFront += 1;
        }
      }
      if (probed && inFront) {
        out.push({
          label: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 24) || el.className,
          pct: +((inFront / probed) * 100).toFixed(1),
        });
      }
    }
    return out;
  }, TEXT);

  if (!overText.length) console.log('  canopy painted over text: nowhere');
  for (const t of overText) console.log(`  canopy painted over text: "${t.label}" at ${t.pct}% of sampled points`);
  if (overText.length) failures.push(`${label}: canopy paints over ${overText.length} text element(s)`);

  // Anti-vacuous: the veil must actually be painting, and apes must be standing in
  // it, or every measurement above passed by measuring nothing.
  let paintedPct = 0;
  for (let p = 0; p < painted.d.length; p += 4) if (differs(painted, noFoliage, p)) paintedPct += 1;
  paintedPct = (paintedPct / (painted.w * painted.h)) * 100;
  console.log(`  foreground foliage paints ${paintedPct.toFixed(1)}% of the viewport, ${judged} ape(s) judged`);
  if (paintedPct < 1) {
    failures.push(`${label}: foreground draws only ${paintedPct.toFixed(1)}% of the viewport, the veil is not on screen`);
  }
  if (!judged) failures.push(`${label}: no ape was behind the veil, occlusion check is vacuous`);

  await page.context().close();
}

await browser.close();

if (failures.length) {
  console.error('\nFAIL');
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`\nthe canopy frames the apes: ${MIN_CONTRAST}:1 or better through the veil, never over words`);
