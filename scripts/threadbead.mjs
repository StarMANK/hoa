// The trail's travelling light is a 22vh bead on an absolutely positioned
// thread, offset by --scroll-progress * 320vh. That is whole-page progress
// driving a trail-local element, so the bead can very easily be parked above or
// below the thread for the entire time the trail is on screen - in which case
// the line is inert exactly when anyone can look at it. Measure the two ranges
// against each other.
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

// Bead geometry comes from the pseudo-element's resolved transform matrix, not
// from re-deriving the calc, so the measurement tracks what the browser draws.
const probe = () => {
  const trail = document.querySelector('.trail');
  const thread = document.querySelector('.trail__thread');
  const after = getComputedStyle(document.querySelector('.trail__thread'), '::after');
  const m = new DOMMatrixReadOnly(after.transform === 'none' ? '' : after.transform);
  const tr = trail.getBoundingClientRect();
  const th = thread.getBoundingClientRect();
  const vh = window.innerHeight;
  // The bead is painted as a 100% 22vh background inside a full-height strip, so
  // its height comes from the resolved background-size, not from the element's
  // own height (which is now the whole thread).
  const beadH = Number(String(after.backgroundSize).split(/\s+/)[1]?.replace('px', '')) || 0;
  return {
    progress: Number(
      getComputedStyle(document.querySelector('.world')).getPropertyValue('--scroll-progress').trim() || 0,
    ),
    trailOnScreen: tr.bottom > 0 && tr.top < vh,
    trailTop: Math.round(tr.top),
    trailBottom: Math.round(tr.bottom),
    threadH: Math.round(th.height),
    beadH: Math.round(beadH),
    beadTranslate: Math.round(m.m42),
    // Where the bead is drawn, in viewport coordinates.
    beadTop: Math.round(th.top + m.m42),
    beadBottom: Math.round(th.top + m.m42 + beadH),
    // Where the bead sits along the thread, as a fraction of its length: bead
    // centre at 0 is the top, 1 is the bottom. A bead with any height cannot put
    // its centre exactly on an end, so the honest ideal range is
    // halfBead..1-halfBead. This is the number that says whether the light ever
    // reaches the chapters at either end of the line.
    alongThread: th.height > 0 ? +((m.m42 + beadH / 2) / th.height).toFixed(4) : null,
    halfBead: th.height > 0 ? +(beadH / 2 / th.height).toFixed(4) : null,
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
  await page.waitForTimeout(1200);

  const total = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  let framesWithTrail = 0;
  let framesWithBeadOnThread = 0;
  const along = [];
  const notes = [];
  let threadH = 0;
  let halfBead = 0;

  for (let i = 0; i <= 40; i++) {
    await page.evaluate((t) => window.scrollTo({ top: t, behavior: 'instant' }), Math.round((total * i) / 40));
    await page.waitForTimeout(120);
    const s = await page.evaluate(probe);
    if (!s.trailOnScreen) continue;
    framesWithTrail++;
    // Bead counts if any of it is inside the viewport while the trail is shown.
    const inView = s.beadBottom > 0 && s.beadTop < vp.height;
    if (inView) framesWithBeadOnThread++;
    else notes.push(`scrollY=${Math.round((total * i) / 40)} bead@${s.beadTop}..${s.beadBottom} trail=${s.trailTop}..${s.trailBottom}`);
    along.push(s.alongThread);
    threadH = s.threadH;
    halfBead = s.halfBead;
  }

  const lo = Math.min(...along);
  const hi = Math.max(...along);
  console.log(`\n[${vp.name}] frames with trail visible=${framesWithTrail}  bead on screen in those=${framesWithBeadOnThread}`);
  console.log(`  thread=${threadH}px  bead centre range along it: ${lo.toFixed(3)}..${hi.toFixed(3)}`);
  console.log(
    `  a centre can only ever reach ${(halfBead ?? 0).toFixed(3)}..${(1 - (halfBead ?? 0)).toFixed(3)} for a bead ` +
      `${(threadH ? 2 * halfBead * 100 : 0).toFixed(0)}% of the thread's length`,
  );
  console.log(`  light sweeps ${((hi - lo) * 100).toFixed(0)}% of the thread while the trail is on screen`);
  const steps = along.slice(1).map((v, i) => v - along[i]).filter((d) => Math.abs(d) > 0.0005);
  const backwards = steps.filter((d) => d < 0).length;
  console.log(`  monotonic while scrolling down: ${backwards === 0 ? 'yes' : `${backwards} backwards steps of ${steps.length}`}`);
  for (const n of notes.slice(0, 4)) console.log(`  bead off-screen: ${n}`);
  if (notes.length > 4) console.log(`  ...and ${notes.length - 4} more`);

  await page.context().close();
}

await browser.close();
