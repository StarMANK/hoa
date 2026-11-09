// The trail line is described as "the one persistent subject that threads every
// chapter". Check whether anything can see it: sample down the thread inside the
// viewport and ask the browser what is painted at each point. The thread has no
// z-index while .trail__inner has z-index 1, so every chapter - and the near
// opaque panel inside it - paints above it.
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const probe = () => {
  const thread = document.querySelector('.trail__thread');
  const trail = document.querySelector('.trail');
  const tr = trail.getBoundingClientRect();
  if (tr.bottom <= 0 || tr.top >= window.innerHeight) return null;

  const cs = getComputedStyle(thread, '::after');
  const m = new DOMMatrixReadOnly(cs.transform === 'none' ? '' : cs.transform);
  const th = thread.getBoundingClientRect();
  const bead = Number(String(cs.backgroundSize).split(/\s+/)[1]?.replace('px', '')) || 0;
  const beadTop = th.top + m.m42;
  const beadBottom = beadTop + bead;
  const x = th.left + 1;

  const top = Math.max(0, tr.top);
  const bottom = Math.min(window.innerHeight, tr.bottom);
  let clear = 0;
  let covered = 0;
  const blockers = new Map();
  const SAMPLE = 6;
  for (let y = top; y < bottom; y += SAMPLE) {
    const el = document.elementFromPoint(x, y);
    if (!el) continue;
    const onThread = el === thread || thread.contains(el);
    if (onThread) clear += SAMPLE;
    else {
      covered += SAMPLE;
      const key = el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : el.tagName.toLowerCase();
      blockers.set(key, (blockers.get(key) ?? 0) + SAMPLE);
    }
  }

  // Is the bead's own centre reachable by the eye?
  const beadMid = Math.round((beadTop + beadBottom) / 2);
  const beadVisible = beadMid >= 0 && beadMid <= window.innerHeight;
  const beadTopEl = beadVisible ? document.elementFromPoint(x, beadMid) : null;
  const beadSeen = beadTopEl ? beadTopEl === thread || thread.contains(beadTopEl) : false;

  return {
    threadX: Math.round(x),
    threadH: Math.round(th.height),
    sampled: Math.round(bottom - top),
    clear,
    covered,
    clearPct: Math.round((clear / Math.max(1, bottom - top)) * 100),
    blockers: [...blockers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4),
    beadOnScreen: beadVisible,
    beadVisibleNotCovered: beadSeen,
    beadCoveredBy: !beadSeen && beadTopEl ? (typeof beadTopEl.className === 'string' ? beadTopEl.className.split(' ')[0] : beadTopEl.tagName) : null,
  };
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

  const range = await page.evaluate(() => {
    const r = document.querySelector('.trail').getBoundingClientRect();
    const vh = window.innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    const clamp = (v) => Math.min(max, Math.max(0, v));
    return { from: clamp(r.top + window.scrollY), to: clamp(r.top + window.scrollY + r.height - vh) };
  });

  console.log(`\n[${vp.name}]`);
  let beadsSeen = 0;
  let frames = 0;
  for (let i = 0; i <= 8; i++) {
    const y = Math.round(range.from + ((range.to - range.from) * i) / 8);
    await page.evaluate((t) => window.scrollTo({ top: t, behavior: 'instant' }), y);
    await page.waitForTimeout(400);
    const s = await page.evaluate(probe);
    if (!s) continue;
    frames++;
    if (s.beadVisibleNotCovered) beadsSeen++;
    console.log(
      `  y=${String(y).padStart(5)} x=${s.threadX} thread visible ${String(s.clearPct).padStart(3)}% of the viewport ` +
        `(${s.covered}px covered by ${JSON.stringify(s.blockers)})  ` +
        `bead=${s.beadOnScreen ? (s.beadVisibleNotCovered ? 'seen' : `covered by .${s.beadCoveredBy}`) : 'off-screen'}`,
    );
  }
  console.log(`  bead actually visible in ${beadsSeen}/${frames} frames`);

  await page.context().close();
}

await browser.close();
