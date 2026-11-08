// Does the hero blurb and scroll hint actually collide with anything on a
// phone? They were hidden to clear the fixed chapter rail, but that was an
// inference, not a request. Restore them and measure real overlap instead of
// arguing about it.
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'],
});

const page = await (
  await browser.newContext({ viewport: { width: 390, height: 844 } })
).newPage();
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const measure = () =>
  page.evaluate(() => {
    const box = (sel) => {
      const n = document.querySelector(sel);
      if (!n) return null;
      const r = n.getBoundingClientRect();
      return { sel, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), b: Math.round(r.bottom) };
    };
    const rail = box('.rail');
    const blurb = box('.hero__blurb');
    const hint = box('.scroll-hint');
    const cta = box('.hero__actions');
    const title = box('.hero__title');
    const overlaps = (a, b) =>
      a && b && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.b && a.y + (b.b - b.y) > b.y
        ? Math.round(Math.min(a.b, b.b) - Math.max(a.y, b.y))
        : 0;
    return {
      rail,
      blurb: { ...blurb, display: getComputedStyle(document.querySelector('.hero__blurb')).display },
      hint: { ...hint, display: getComputedStyle(document.querySelector('.scroll-hint')).display },
      cta,
      title,
      railTop: rail?.y,
      blurbBottomVsRailTop: rail && blurb ? Math.round(rail.y - blurb.b) : null,
      hintBottomVsRailTop: rail && hint ? Math.round(rail.y - hint.b) : null,
      ctaBottomVsRailTop: rail && cta ? Math.round(rail.y - cta.b) : null,
      heroHeight: Math.round(document.querySelector('.hero').getBoundingClientRect().height),
      vh: window.innerHeight,
    };
  });

console.log('as shipped:', JSON.stringify(await measure(), null, 2));

await page.addStyleTag({
  content: '.hero__blurb, .scroll-hint { display: revert !important; }',
});
await page.waitForTimeout(600);
const restored = await measure();
console.log('\nwith both restored:', JSON.stringify(restored, null, 2));
console.log(
  `\nblurb bottom -> rail top gap: ${restored.blurbBottomVsRailTop}px  hint gap: ${restored.hintBottomVsRailTop}px  cta gap: ${restored.ctaBottomVsRailTop}px`,
);
console.log(`negative gap = overlap. rail top = ${restored.railTop}, viewport = ${restored.vh}`);

await page.screenshot({ path: new URL(process.env.SHOT ?? '', `file://${process.env.JCODE_SCRATCH_DIR}/mobile-blurb.png`).pathname });
await browser.close();
