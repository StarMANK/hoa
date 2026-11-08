// Can you read the page while the apes cross behind it?
//
// The content bands (.trail, .join, .section--dark) sit at z-index 2 over the roam
// layer at z-index 0 and paint rgba(3, 4, 5, 0.74) across it. That translucent wash
// was already a retreat: the comment in trail.css records that "an opaque ground
// here made the apes disappear for the longest stretch of the page". Measured, 0.74
// still erases them. Sampling a walker in mid-band with the apes toggled off gives a
// max per-channel delta of 29-48 out of 255 on a silhouette painted #ffffff at
// authored opacity 0.46-0.78, i.e. about 0.16 effective alpha. The ape arrives at
// 1.28-1.30:1 against its own background, which is not a subject, it is a smudge, and
// the branch is supposed to be the one where the apes never vanish.
//
// So the wash comes down, but how far is a measurement, not a taste call, because the
// wash has a second job: it is the only thing standing between a bone-white
// silhouette and bone-white text. Dropping it blindly trades one defect for another.
// Two numbers decide it, per alpha:
//
//   - ape contrast, the walk in front minus the walk hidden, same pixels, so the
//     result is what the animation actually contributes;
//   - text contrast, worst case over a full walk cycle, so an ape crossing behind a
//     paragraph is caught at the moment it crosses rather than averaged away.
//
// Both are measured as percentiles of luminance inside a box rather than min/max:
// the darkest pixel of a glyph and the brightest pixel of a background. Extremes pick
// up antialiasing and grain, and a single stray bright pixel used to be enough to
// make a clean page look legible.
//
// Pass --alpha=0.3 to explore alternatives; with no flag the script measures the
// stylesheet as authored, which is what CI runs.
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const MIN_APE_CONTRAST = 3; // WCAG 1.4.11 non-text minimum, the floor canopydepth uses
const MIN_PRESENT_CONTRAST = 1.5; // a shape must register at a glance, not just exist
const SUBJECT_PX = 60; // a walker this wide is big enough to carry the subject
const MIN_INK = 150; // an ape smaller than this cannot be judged on contrast
const MIN_TEXT_CONTRAST = 4.5; // WCAG 1.4.3 AA for body copy
const FRAMES = 6; // steps around the walk cycle, so a crossing is caught

const override = process.argv.find((a) => a.startsWith('--alpha='))?.split('=')[1];

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

const differs = (a, b, p) =>
  Math.abs(a.d[p] - b.d[p]) + Math.abs(a.d[p + 1] - b.d[p + 1]) + Math.abs(a.d[p + 2] - b.d[p + 2]) > 6;

const lum = (a, p) => (0.2126 * a.d[p] + 0.7152 * a.d[p + 1] + 0.0722 * a.d[p + 2]) / 255;

const ratio = (x, y) => (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);

const percentile = (xs, q) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

const median = (xs) => percentile(xs, 0.5);

const failures = [];

// Scroll by target element rather than by a fraction of the page: a fixed fraction
// measured the join band with not one line of copy on screen, so its text half passed
// by measuring nothing. Centring a known element guarantees both subjects are present.
for (const [label, vp, target] of [
  ['desktop trail band', { width: 1440, height: 900 }, '.trail .chapter__copy p'],
  ['desktop join band', { width: 1440, height: 900 }, '.join__card p'],
  ['mobile trail band', { width: 390, height: 844 }, '.trail .chapter__copy p'],
]) {
  const page = await (await browser.newContext({ viewport: vp })).newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);
  // scrollIntoView has to be instant: the site sets scroll-behavior: smooth, so the
  // default eased version had not moved when the position was read, and the probe
  // logged "scrolled to y0" while actually measuring wherever the page was left.
  const found = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    return true;
  }, target);
  if (!found) {
    failures.push(`${label}: no element matches ${target}, cannot position the probe`);
    await page.context().close();
    continue;
  }
  await page.waitForTimeout(1500);
  const scrolled = await page.evaluate(() => ({
    y: Math.round(scrollY),
    max: Math.round(document.documentElement.scrollHeight - innerHeight),
  }));
  console.log(`\n[${label}] scrolled to y${scrolled.y} of ${scrolled.max}`);

  if (override) {
    await page.addStyleTag({
      content: `.trail, .join, .section--dark { background: rgba(3, 4, 5, ${override}) !important; }`,
    });
    await page.waitForTimeout(300);
  }
  // Freeze the walk so frames differ only by the injected delay offset, and keep the
  // far canopy out of the way: it is measured by canopydepth, and here it would
  // attribute foliage contrast to the band wash.
  await page.addStyleTag({ content: '*, *::before, *::after { animation-play-state: paused !important; }' });
  await page.waitForTimeout(300);

  const boxes = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('.roam__walker svg.ape')) {
      const r = el.getBoundingClientRect();
      if (r.width < 4) continue;
      if (r.top < 2 || r.bottom > innerHeight - 2) continue; // need the whole silhouette
      out.push({ x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
    }
    return out;
  });

  const cards = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('.chapter__copy, .join__card, .rule, .marks li')) {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      if (r.bottom < 0 || r.top > innerHeight) continue;
      out.push({ name: el.className.split(' ')[0], x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
    }
    return out;
  });

  const texts = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('.trail p, .trail h2, .trail h3, .trail li, .trail .trail__label, .join p, .join h2, .section--dark p, .section--dark h2')) {
      const r = el.getBoundingClientRect();
      if (r.width < 24 || r.height < 10) continue;
      if (r.top < 2 || r.bottom > innerHeight - 2) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
      out.push({
        label: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 22) || el.className,
        x: Math.round(r.left),
        y: Math.round(r.top),
        w: Math.round(r.width),
        h: Math.round(r.height),
      });
    }
    return out;
  });

  console.log(
    `\n[${label}] panel ${override ? `override ${override}` : 'as authored'}: ` +
      `${boxes.length} apes fully on screen, ${texts.length} text boxes`,
  );

  // Ape contribution: same pixels, apes shown then hidden.
  const withApes = await decode(page, await page.screenshot());
  await page.addStyleTag({ content: '.roam, .procession { visibility: hidden !important; }' });
  await page.waitForTimeout(300);
  const withoutApes = await decode(page, await page.screenshot());
  await page.addStyleTag({ content: '.roam, .procession { visibility: visible !important; }' });
  await page.waitForTimeout(300);

  let judgedApes = 0;
  let subjectCov = null; // best contrast among walkers big enough to be the subject
  for (const [i, box] of boxes.entries()) {
    const open = []; // the ape's ink with nothing else painted over it
    let onCard = 0;
    for (let yy = box.y; yy < box.y + box.h; yy += 1) {
      for (let xx = box.x; xx < box.x + box.w; xx += 1) {
        const p = (yy * withApes.w + xx) * 4;
        if (!differs(withApes, withoutApes, p)) continue;
        if (cards.some((c) => xx >= c.x && xx < c.x + c.w && yy >= c.y && yy < c.y + c.h)) {
          onCard += 1;
          continue;
        }
        open.push(ratio(lum(withApes, p), lum(withoutApes, p)));
      }
    }
    const total = open.length + onCard;
    if (total < MIN_INK) continue;
    judgedApes += 1;
    const coverPct = ((onCard / total) * 100).toFixed(0);
    // Presence is measured on ink in the open only. Ink behind a content card is
    // occluded by design, the roam layer is meant to pass behind the bands, and the
    // only way to lift contrast there is to make the card more transparent, which
    // costs the copy that sits on it. An ape that asked for 1.5:1 while standing
    // entirely behind a card also sat exactly on the threshold and flipped pass/fail
    // between runs, which is what a gate must not do.
    if (open.length >= MIN_INK) {
      const med = median(open);
      console.log(
        `  ape #${i} ${box.w}x${box.h} at y${box.y}: ${open.length} ink px in the open, ${coverPct}% behind a card, ` +
          `median contrast ${med.toFixed(2)}:1`,
      );
      if (med < MIN_PRESENT_CONTRAST) {
        failures.push(`${label}: ape #${i} (${box.w}px) reads only ${med.toFixed(2)}:1 in the open, it is not visible`);
      }
      if (box.w >= SUBJECT_PX && (subjectCov === null || med > subjectCov)) subjectCov = med;
    } else {
      console.log(
        `  ape #${i} ${box.w}x${box.h} at y${box.y}: ${open.length} ink px in the open, ${coverPct}% behind a card, not judged`,
      );
    }
  }
  if (!judgedApes) {
    failures.push(`${label}: no ape was fully on screen, the ape check is vacuous`);
  }
  if (subjectCov === null) {
    failures.push(`${label}: no walker was ${SUBJECT_PX}px or wider, nothing on screen can carry the subject`);
  } else if (subjectCov < MIN_APE_CONTRAST) {
    failures.push(
      `${label}: the best large walker manages only ${subjectCov.toFixed(2)}:1, below the ${MIN_APE_CONTRAST}:1 the subject needs`,
    );
  } else {
    console.log(`  best walker >=${SUBJECT_PX}px: ${subjectCov.toFixed(2)}:1 (floor ${MIN_APE_CONTRAST}:1)`);
  }

  // Text: worst case over the cycle, so a silhouette passing behind a paragraph is
  // caught at its worst frame rather than averaged out.
  const worstText = new Map();
  const offsets = Array.from({ length: FRAMES }, (_, k) => -((k * 12) / FRAMES));
  for (const [f, off] of offsets.entries()) {
    await page.addStyleTag({
      content: `:root { --t: ${off}s; } .roam__walker, .roam__bob { animation-delay: ${off}s !important; }`,
    });
    await page.waitForTimeout(260);
    const frame = await decode(page, await page.screenshot());
    for (const t of texts) {
      const lums = [];
      for (let y = t.y; y < t.y + t.h; y += 1) {
        for (let x = t.x; x < t.x + t.w; x += 1) {
          const p = (y * frame.w + x) * 4;
          lums.push(lum(frame, p));
        }
      }
      // Darkest 2% is the glyph ink, brightest 2% is whatever the background is
      // doing, which is exactly the thing an ape can make too bright.
      const ink = percentile(lums, 0.02);
      const ground = percentile(lums, 0.98);
      const cr = ratio(ink, ground);
      const prev = worstText.get(t.label);
      if (prev === undefined || cr < prev.cr) worstText.set(t.label, { cr, frame: f });
    }
  }

  const sorted = [...worstText.entries()].sort((a, b) => a[1].cr - b[1].cr);
  if (!sorted.length) {
    failures.push(`${label}: no text was on screen, the copy check is vacuous`);
  }
  for (const [label_, v] of sorted.slice(0, 6)) {
    console.log(`  text "${label_}": worst ${v.cr.toFixed(2)}:1 on frame ${v.frame + 1}/${FRAMES}`);
  }
  const worst = sorted[0];
  if (worst && worst[1].cr < MIN_TEXT_CONTRAST) {
    failures.push(`${label}: text "${worst[0]}" falls to ${worst[1].cr.toFixed(2)}:1 with an ape behind it`);
  }

  await page.context().close();
}

await browser.close();

if (failures.length) {
  console.error('\nFAIL');
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`\napes stay above ${MIN_APE_CONTRAST}:1 through the bands and copy above ${MIN_TEXT_CONTRAST}:1`);
