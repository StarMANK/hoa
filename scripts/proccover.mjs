// The mask was justified by "the tail walks off behind the logo plate". Check
// whether the plate can occlude the procession at all: do their boxes overlap?
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

for (const vp of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  const page = await (await browser.newContext({ viewport: vp })).newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const g = await page.evaluate(() => {
    const box = (s) => {
      const e = document.querySelector(s);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) };
    };
    const proc = document.querySelector('.procession');
    const pr = proc.getBoundingClientRect();
    return {
      plate: box('.hero__plate'),
      procession: box('.procession'),
      actions: box('.hero__actions'),
      rail: box('.rail'),
      viewport: { w: window.innerWidth, h: window.innerHeight },
      walkers: [...document.querySelectorAll('.procession__walker')].map((el) => {
        const r = el.getBoundingClientRect();
        return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) };
      }),
    };
  });

  const overlapY = (a, b) => a && b && a.top < b.bottom && b.top < a.bottom;
  const overlapX = (a, b) => a && b && a.left < b.right && b.left < a.right;
  console.log(`\n[${vp.name}] viewport ${g.viewport.w}x${g.viewport.h}`);
  console.log(`  plate      ${JSON.stringify(g.plate)}`);
  console.log(`  procession ${JSON.stringify(g.procession)}`);
  console.log(`  actions    ${JSON.stringify(g.actions)}`);
  console.log(`  rail       ${JSON.stringify(g.rail)}`);
  console.log(
    `  plate overlaps procession box? ${overlapX(g.procession, g.plate) && overlapY(g.procession, g.plate) ? 'YES' : 'no'}` +
      `  (vertical overlap: ${g.plate && g.procession ? Math.min(g.plate.bottom, g.procession.bottom) - Math.max(g.plate.top, g.procession.top) : '?'}px)`,
  );
  console.log(
    `  actions overlap procession? ${overlapX(g.procession, g.actions) && overlapY(g.procession, g.actions) ? 'YES' : 'no'}` +
      `  rail overlap? ${overlapX(g.procession, g.rail) && overlapY(g.procession, g.rail) ? 'YES' : 'no'}`,
  );
  g.walkers.forEach((w, i) =>
    console.log(`  walker #${i} x ${w.l}..${w.r} y ${w.t}..${w.b}  ${w.r > g.viewport.w ? 'OVERFLOWS right edge' : 'inside viewport'}`),
  );

  await page.context().close();
}
await browser.close();
