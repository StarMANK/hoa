// Does the canopy veil erase the subject?
//
// world.css states the depth order as void > treeline > canopy far > roam (apes) >
// canopy near, and .canopy--near / .canopy--front really are z-index 1. Whether that
// puts foliage in front of an ape, though, depends on which ape: the hero procession
// lives inside .hero, which is position:relative z-index:2 and therefore a stacking
// context above the canopy, so a hero walker paints over the fronds. The roam walkers
// are direct children of .world at z-index 0, so the same foliage paints over them. The
// stylesheet comment describes one order; the cascade implements two.
//
// Front and back cannot be read off a pixel diff, which is what this script first tried
// and what made its numbers meaningless. Hiding the foliage changes a walker's pixels
// from behind too, because the walkers are translucent, so "the pixel moved when the
// leaves went away" was scored as occlusion at the hero and reported 96% coverage on
// apes that were standing in front of everything. Contrast is now only computed for ink
// the browser agrees is genuinely behind the leaves.
//
// Hit testing needs one probe-only adjustment, and it is the kind of trap that makes a
// green probe worse than none. .canopy is pointer-events: none, which is correct for a
// decorative layer and fatal for elementsFromPoint, because that API skips such
// elements entirely. Asked what is on top of an ape, it answered "hero, world, body" and
// never mentioned the canopy, so every ape looked unoccluded and every text box looked
// clear: both halves of the check passed on nothing at all. The probe re-enables pointer
// events on the canopy alone, which changes hit-testability without touching paint order,
// so the returned stack is the real stacking order.
//
// Two frames differ only in whether the apes are painted. Everything else, the canopy
// included, is identical between them, so the delta at any pixel is exactly what the ape
// contributes after the leaves in front of it. That makes the delta the number to gate:
// an ape washed out by foliage shows up as a small delta, which is the defect, and an ape
// standing in the open shows up as a large one.
//
// The previous version compared each ape against a "bare" frame with the foliage hidden
// too, so a pixel of an in-front ape that happened to overlap a leaf was scored as
// leaf-over-ground instead of ape-over-background. That is how a walker the screenshot
// shows clearly visible came out at 1.15:1: the number was measuring the leaf, not the
// ape. A single background frame removes that whole class of error.
//
// What is gated, per viewport and scroll depth:
//
//   1. foliage is never topmost over words. Scenery in front of a heading or a button
//      is a defect at any depth. Probed on a grid, not by pixel deltas: 82.5% of the
//      hero blurb's box shifts when the front fern is hidden, yet those glyphs belong
//      to .hero above the canopy, so the 82.5% was ground between letters.
//   2. an ape that is genuinely behind the veil still reads at 3:1, WCAG 1.4.11's
//      non-text minimum. Occlusion is the intended look; erasure is not.
//   3. the subject survives the depth. At least one walker big enough to be the
//      subject has to clear the same floor on screen, occluded or not, so a page that
//      leaves only smudges in the undergrowth cannot pass.
import { chromium } from 'playwright-core';
import { lum, ratio } from './lib/contrast.mjs';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const MIN_CONTRAST = 3; // WCAG 1.4.11, non-text contrast minimum
const MIN_INK = 200; // below this an ape is too small to judge occlusion on
const SUBJECT_PX = 60; // a walker this wide is big enough to carry the subject
const GRID = 6; // px per occlusion cell: fine enough to split a leaf edge across a body

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
// Content bands sit above the roam layer and wash over apes too. That occlusion is real
// but it belongs to bandtext.mjs, so those pixels are excluded here rather than charged
// to the canopy.
const BANDS = '.trail, .join, .section--dark, .marks, .rule';

const TEXT =
  '.hero h1, .hero .lead, .hero .body-copy, .cta, .rail__item, .scroll-hint, ' +
  '.chapter__copy p, .chapter__title, .join h2, .join__card p, .rule p, .section-head h2';

const differs = (a, b, p) =>
  Math.abs(a.d[p] - b.d[p]) + Math.abs(a.d[p + 1] - b.d[p + 1]) + Math.abs(a.d[p + 2] - b.d[p + 2]) > 6;

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

const failures = [];
// Total across depths: a run where nothing at all was ever judged behind the veil means
// the occlusion half of this script proved nothing and must not pass silently.
let occludedInkTotal = 0;
let depthsProbed = 0;

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
  // Probe-only: make the decorative canopy and the walkers hittable so elementsFromPoint
  // reports them. Both inherit pointer-events: none from their layer, and without this the
  // stack answers "hero, world, body" and the whole occlusion test runs on nothing.
  await page.addStyleTag({
    content: '.canopy, .canopy *, .ape { pointer-events: auto !important; }',
  });
  await page.waitForTimeout(300);

  // Which apes are on screen, and for each one a coarse mask saying whether the canopy
  // paints over it there. Front or back is decided per cell, not per ape, because a
  // walker straddling a leaf line is half behind it and that half is the interesting part.
  // The ape itself is looked for in the hit stack, so forcing pointer-events on it matters
  // for the same reason it does for the canopy.
  const apes = await page.evaluate(
    ([sel, bandSel, step]) => {
      const isCanopy = (el) => !!el?.closest?.('.canopy');
      const bands = [...document.querySelectorAll(bandSel)].map((el) => el.getBoundingClientRect());
      const out = [];
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        if (r.bottom < 0 || r.top > innerHeight) continue;
        const cols = Math.ceil(r.width / step);
        const rows = Math.ceil(r.height / step);
        const mask = new Uint8Array(cols * rows); // 0 unprobed, 1 open, 2 canopy over, 3 band over
        let probed = 0;
        let over = 0;
        let i = 0;
        for (let cy = 0; cy < rows; cy++) {
          const y = Math.round(r.top + cy * step + step / 2);
          for (let cx = 0; cx < cols; cx++, i++) {
            const x = Math.round(r.left + cx * step + step / 2);
            if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
            const stack = document.elementsFromPoint(x, y);
            const apeIdx = stack.indexOf(el);
            if (apeIdx < 0) continue;
            probed += 1;
            let canopyIdx = -1;
            for (let k = 0; k < apeIdx; k++) {
              if (isCanopy(stack[k])) { canopyIdx = k; break; }
            }
            if (canopyIdx >= 0) {
              mask[i] = 2;
              over += 1;
            } else {
              const covered = bands.some((b) => x >= b.left && x < b.right && y >= b.top && y < b.bottom);
              mask[i] = covered ? 3 : 1;
            }
          }
        }
        out.push({
          x: Math.round(r.left),
          y: Math.round(r.top),
          width: Math.round(r.width),
          height: Math.round(r.height),
          step,
          cols,
          mask: Array.from(mask),
          probed,
          overPct: probed ? +((over / probed) * 100).toFixed(0) : 0,
        });
      }
      return out;
    },
    ['.procession__walker .ape, .roam__walker .ape', BANDS, GRID],
  );

  // Two frames. Hiding the apes leaves the canopy and the ground exactly as they were, so
  // every differing pixel is the ape's own contribution as actually composited, leaves and
  // all, and the contrast of that against the same pixel without the ape is the number a
  // viewer experiences.
  const painted = await decode(page, await page.screenshot());
  await page.addStyleTag({ content: HIDE_APES });
  await page.waitForTimeout(300);
  const noApes = await decode(page, await page.screenshot());
  await page.addStyleTag({ content: HIDE_APES.replace('hidden', 'visible') });
  await page.waitForTimeout(200);

  // How much of the foreground the canopy draws, measured by hiding it. Reported so a
  // depth where the veil is off screen is visible in the output rather than assumed.
  await page.addStyleTag({ content: HIDE_FG });
  await page.waitForTimeout(300);
  const noFoliage = await decode(page, await page.screenshot());
  await page.addStyleTag({ content: HIDE_FG.replace('hidden', 'visible') });
  await page.waitForTimeout(200);

  console.log(`\n[${label}] ${apes.length} apes on screen`);

  let occludedJudged = 0;
  let occludedInk = 0;
  let worst = null;
  let subjectBest = null;
  for (const [i, box] of apes.entries()) {
    const x0 = Math.max(0, box.x);
    const y0 = Math.max(0, box.y);
    const x1 = Math.min(painted.w, box.x + box.width);
    const y1 = Math.min(painted.h, box.y + box.height);
    const behind = [];
    const open = [];
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const p = (y * painted.w + x) * 4;
        // Is this the ape's own ink, as composited?
        if (!differs(painted, noApes, p)) continue;
        const cx = Math.floor((x - box.x) / box.step);
        const cy = Math.floor((y - box.y) / box.step);
        const cell = cx >= 0 && cx < box.cols ? box.mask[cy * box.cols + cx] : 0;
        // cell 3 is a content band, judged by bandtext.mjs; 0 is unprobed ground.
        if (cell === 2) behind.push(ratio(lum(painted, p), lum(noApes, p)));
        else if (cell === 1) open.push(ratio(lum(painted, p), lum(noApes, p)));
      }
    }
    const ink = behind.length + open.length;
    if (ink < MIN_INK) continue;
    const subject = box.width >= SUBJECT_PX;
    if (behind.length >= MIN_INK) {
      occludedJudged += 1;
      occludedInk += behind.length;
      const med = median(behind);
      console.log(
        `  ape #${i} ${box.width}x${box.height} at y${box.y}: ${behind.length} ink px behind foliage ` +
          `(${box.overPct}% of its box), median contrast ${med.toFixed(2)}:1`,
      );
      if (med < MIN_CONTRAST) {
        failures.push(`${label}: ape #${i} reads only ${med.toFixed(2)}:1 through the foliage veil`);
      }
      if (worst === null || med < worst) worst = med;
      if (subject && (subjectBest === null || med > subjectBest)) subjectBest = med;
    }
    if (open.length >= MIN_INK) {
      const med = median(open);
      console.log(
        `  ape #${i} ${box.width}x${box.height} at y${box.y}: in front of the foliage, ${open.length} ink px, ` +
          `median contrast ${med.toFixed(2)}:1`,
      );
      if (subject && (subjectBest === null || med > subjectBest)) subjectBest = med;
    }
    if (behind.length >= MIN_INK || open.length >= MIN_INK) continue;
    if (subject) {
      failures.push(
        `${label}: the ${box.width}px walker is on screen but contributes only ${ink} measurable ink px, ` +
          'it is washed out rather than seen',
      );
    }
  }

  if (subjectBest === null) {
    failures.push(`${label}: no walker ${SUBJECT_PX}px or wide was measurable, nothing can carry the subject`);
  } else {
    console.log(`  best walker >=${SUBJECT_PX}px: ${subjectBest.toFixed(2)}:1 (floor ${MIN_CONTRAST}:1)`);
    if (subjectBest < MIN_CONTRAST) {
      failures.push(`${label}: the best large walker manages only ${subjectBest.toFixed(2)}:1`);
    }
  }
  if (worst !== null) console.log(`  worst occluded ape: ${worst.toFixed(2)}:1 (floor ${MIN_CONTRAST}:1)`);
  else console.log(`  no ape was behind the foliage at this depth`);
  occludedInkTotal += occludedInk;

  // Is the foliage ever painted over words? Same hit-test as above, on text boxes.
  const overText = await page.evaluate((sel) => {
    const isCanopy = (el) => !!el?.closest?.('.canopy');
    const out = [];
    let boxes = 0;
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
      if (!probed) continue;
      boxes += 1;
      if (inFront) {
        out.push({
          label: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 24) || el.className,
          pct: +((inFront / probed) * 100).toFixed(1),
        });
      }
    }
    return { offenders: out, boxes };
  }, TEXT);

  console.log(`  text boxes probed for foliage on top: ${overText.boxes}`);
  if (!overText.offenders.length) console.log('  canopy painted over text: nowhere');
  for (const t of overText.offenders) console.log(`  canopy painted over text: "${t.label}" at ${t.pct}% of sampled points`);
  if (overText.offenders.length) failures.push(`${label}: canopy paints over ${overText.offenders.length} text element(s)`);
  if (!overText.boxes) failures.push(`${label}: no text was on screen, the foliage-over-words check is vacuous`);

  // Anti-vacuous: the veil must actually be painting, or the occlusion half of every
  // measurement above passed by measuring nothing.
  let paintedPct = 0;
  for (let p = 0; p < painted.d.length; p += 4) if (differs(painted, noFoliage, p)) paintedPct += 1;
  paintedPct = (paintedPct / (painted.w * painted.h)) * 100;
  console.log(
    `  foreground foliage paints ${paintedPct.toFixed(1)}% of the viewport, ` +
      `${occludedJudged} ape(s) judged behind it`,
  );
  if (paintedPct < 1) {
    failures.push(`${label}: foreground draws only ${paintedPct.toFixed(1)}% of the viewport, the veil is not on screen`);
  }
  depthsProbed += 1;

  await page.context().close();
}

await browser.close();

if (!occludedInkTotal) {
  failures.push(
    `no ape anywhere on the page was found behind the canopy across ${depthsProbed} depths, ` +
      'the occlusion half of this check never fired',
  );
}

if (failures.length) {
  console.error('\nFAIL');
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`\nthe canopy frames the apes: ${MIN_CONTRAST}:1 or better through the veil, never over words`);
