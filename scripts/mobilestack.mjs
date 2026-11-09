// The phone hero hides .hero__blurb and .scroll-hint. Measured, that was not
// paranoia: the hero is 956px tall on an 844px viewport, so anything at its foot
// lands under the fixed rail (top 796) - the blurb by 48px, the hint by 10px.
// But hiding user copy to solve a layout collision is a big answer. These
// variants try to keep the copy by moving it instead.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const outDir = process.env.OUT_DIR ?? new URL('../shots-stack/', import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });

const variants = [
  { name: 'a-hidden', css: '' },
  {
    // Put the blurb above the buttons rather than below them.
    name: 'b-order',
    css: `
      .hero__blurb { display: block !important; order: -1; }
      .scroll-hint { display: none !important; }`,
  },
  {
    // Keep the reading order, tighten the hero's bottom room so the blurb
    // clears the rail, and drop the scroll hint (redundant on touch).
    name: 'c-tighten',
    css: `
      .hero__blurb { display: block !important; margin-bottom: 0; }
      .hero { padding-bottom: 0; }
      .scroll-hint { display: none !important; }`,
  },
  {
    // Everything back, including the hint, with the hero ending above the rail.
    name: 'd-all',
    css: `
      .hero__blurb { display: block !important; order: -1; margin-bottom: 0; }
      .scroll-hint { display: flex !important; bottom: 10rem; }`,
  },
];

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'],
});

for (const v of variants) {
  const page = await (
    await browser.newContext({ viewport: { width: 390, height: 844 } })
  ).newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  if (v.css) await page.addStyleTag({ content: v.css });
  await page.waitForTimeout(1400);

  const m = await page.evaluate(() => {
    const rail = document.querySelector('.rail').getBoundingClientRect();
    const box = (sel) => {
      const n = document.querySelector(sel);
      if (!n) return { sel, missing: true };
      const r = n.getBoundingClientRect();
      const cs = getComputedStyle(n);
      return {
        sel,
        display: cs.display,
        y: Math.round(r.y),
        b: Math.round(r.bottom),
        // Positive means it clears the fixed rail; negative means overlap.
        vsRail: Math.round(rail.top - r.bottom),
        inViewport: r.top < window.innerHeight && r.bottom > 0,
      };
    };
    return {
      railTop: Math.round(rail.top),
      blurb: box('.hero__blurb'),
      hint: box('.scroll-hint'),
      cta: box('.hero__actions'),
      heroH: Math.round(document.querySelector('.hero').getBoundingClientRect().height),
    };
  });

  const clash = [m.blurb, m.hint].filter((b) => !b.missing && b.display !== 'none' && b.vsRail < 0);
  console.log(
    `[${v.name}] railTop=${m.railTop} heroH=${m.heroH} clash=${clash.map((c) => `${c.sel}(${c.vsRail})`).join(' ') || 'none'}`,
  );
  console.log(
    `   blurb ${m.blurb.display} y=${m.blurb.y} b=${m.blurb.b} vsRail=${m.blurb.vsRail} visible=${m.blurb.inViewport}`,
  );
  console.log(`   hint  ${m.hint.display} y=${m.hint.y} vsRail=${m.hint.vsRail}`);

  await page.screenshot({ path: join(outDir, `mobile-hero-${v.name}.png`) });
  await page.context().close();
}

await browser.close();
console.log(`\nframes in ${outDir}`);
