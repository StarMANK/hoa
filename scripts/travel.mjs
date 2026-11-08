// Which scroll-driven transforms actually move while anyone can see them?
// --scroll-progress is whole-page progress, so anything inside a long section
// only ever covers the fraction of its travel that falls inside its own slice of
// the page. The trail's light bead was the first symptom: on screen for 28 of 28
// frames, and parked - it swept none of the line the way the page was built.
//
// For every element that reads a progress variable, this resolves the transform
// the browser is really applying and reports how far it travels between the
// element's first and last visible frame, plus how much of the driving variable's
// 0..1 range it gets while visible. The second number is the one that catches the
// bug: it says the clock was running while nobody could see it move.
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

// Each entry is one transform, the variable driving it, and the minimum it has to
// earn on both measures. The section-scoped ones must sweep most of their clock;
// .world-sweep is deliberately fixed to the whole page because it is a page-wide
// sheen, so it only needs its own slice proportionally.
const TARGETS = [
  { sel: '.trail__thread', pseudo: '::after', varName: '--visible-progress', minVar: 0.6, minBox: 0.6 },
  { sel: '.join__bg', pseudo: '::after', varName: '--visible-progress', minVar: 0.6, minBox: 0.1 },
  { sel: '.hero__plate', pseudo: '::after', varName: '--visible-progress', minVar: 0.6, minBox: 0.4 },
  { sel: '.world-sweep', pseudo: null, varName: '--scroll-progress', minVar: 0.6, minBox: 0.4 },
];

// getComputedStyle on a pseudo resolves its own box, which is not the parent's:
// .join__bg::after is inset -30%, so it is 1.6x wider than the band. Percentages
// in a transform resolve against that box, so the denominator has to match it.
const probe = (target) => {
  const el = document.querySelector(target.sel);
  if (!el) return null;
  const cs = getComputedStyle(el, target.pseudo ?? null);
  const m = new DOMMatrixReadOnly(cs.transform === 'none' ? '' : cs.transform);
  const own = target.pseudo ? cs : getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    exists: true,
    x: m.m41,
    y: m.m42,
    w: parseFloat(own.width) || 0,
    h: parseFloat(own.height) || 0,
    onScreen: r.bottom > 0 && r.top < window.innerHeight,
    varValue: Number(getComputedStyle(el).getPropertyValue(target.varName).trim()) || 0,
  };
};

let failures = 0;

for (const vp of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  const page = await (
    await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
  ).newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);
  // Each target is sampled densely over its own visible scroll range rather than
  // on one shared grid: the mobile logo plate is on screen for 277px of an 8338px
  // page, which a 60-frame sweep crosses in two steps, and two steps cannot say
  // how far anything travelled.
  //
  // The range is found by watching, not by geometry. Deriving it from the element
  // rect is wrong for anything position:fixed, whose rect does not move with the
  // page, and .world-sweep is fixed and visible for the whole page.
  const total = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  const COARSE = 80;
  console.log(`\n[${vp.name}]  scrollable=${total}px`);
  for (const t of TARGETS) {
    const key = t.sel + (t.pseudo ?? '');

    let first = Infinity;
    let last = -Infinity;
    for (let i = 0; i <= COARSE; i++) {
      const y = Math.round((total * i) / COARSE);
      await page.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), y);
      await page.waitForTimeout(30);
      const r = await page.evaluate(probe, t);
      if (r && r.exists && r.onScreen) {
        first = Math.min(first, y);
        last = Math.max(last, y);
      }
    }
    if (!Number.isFinite(first)) {
      console.log(`  ${key.padEnd(24)} never on screen  FAIL`);
      failures++;
      continue;
    }

    const STEPS = 40;
    const seen = [];
    for (let i = 0; i <= STEPS; i++) {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), Math.round(first + ((last - first) * i) / STEPS));
      await page.waitForTimeout(45);
      const r = await page.evaluate(probe, t);
      if (r && r.exists && r.onScreen) seen.push(r);
    }
    if (!seen.length) {
      console.log(`  ${key.padEnd(24)} never on screen  FAIL`);
      failures++;
      continue;
    }

    const xTravel = Math.max(...seen.map((r) => r.x)) - Math.min(...seen.map((r) => r.x));
    const yTravel = Math.max(...seen.map((r) => r.y)) - Math.min(...seen.map((r) => r.y));
    // translateX percentages resolve against width, translateY against height.
    const frac = Math.max(
      seen[0].w > 0 ? xTravel / seen[0].w : 0,
      seen[0].h > 0 ? yTravel / seen[0].h : 0,
    );
    const varRange = Math.max(...seen.map((r) => r.varValue)) - Math.min(...seen.map((r) => r.varValue));
    const ok = frac >= t.minBox && varRange >= t.minVar;
    if (!ok) failures++;
    const why = [];
    if (frac < t.minBox) why.push(`box ${frac.toFixed(3)} < ${t.minBox}`);
    if (varRange < t.minVar) why.push(`clock ${varRange.toFixed(3)} < ${t.minVar}`);
    console.log(
      `  ${key.padEnd(24)} travel ${xTravel.toFixed(0)}x${yTravel.toFixed(0)}px ` +
        `(${frac.toFixed(3)} of its box)  clock swept ${varRange.toFixed(3)} of 1  ` +
        `over ${first}..${last}px of scroll, ${seen.length} samples  ${ok ? 'ok' : `FAIL ${why.join(', ')}`}`,
    );
  }

  await page.context().close();
}

await browser.close();
console.log(`\n${failures === 0 ? 'every scroll-driven transform moves while visible' : `${failures} targets do not`}`);

if (failures > 0) process.exit(1);
