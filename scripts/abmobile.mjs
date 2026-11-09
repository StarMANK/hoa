// A/B the mobile hero composition. The fold on a phone shows two apes at
// ~0.21 opacity: the procession container is set to 0.5, the walkers multiply
// that down, and the head of the line sits inside the mask's own fade zone.
// Candidate overrides are captured side by side so the choice can be made from
// pixels rather than from reasoning about cascade.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const outDir = process.env.OUT_DIR ?? new URL('../shots-ab/', import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });

const variants = [
  { name: 'a-current', css: '' },
  {
    // Lift the line out from behind the CTAs into the clear band between the
    // buttons (bottom 691) and the fixed rail (top 796), and stop dimming the
    // subject: 0.5 container * 0.42 walker left the lead ape at 0.21.
    name: 'f-band',
    css: `
      .procession {
        bottom: calc(3.4rem + env(safe-area-inset-bottom, 0px));
        mask-image: linear-gradient(90deg, #000 0%, #000 82%, transparent 100%);
        -webkit-mask-image: linear-gradient(90deg, #000 0%, #000 82%, transparent 100%);
      }
      .procession__walker:nth-child(n + 3) { display: block; }`,
  },
  {
    // Keep the current overlap but drop the container dim so the apes match
    // their desktop brightness.
    name: 'g-nodim',
    css: `
      .procession {
        mask-image: linear-gradient(90deg, #000 0%, #000 82%, transparent 100%);
        -webkit-mask-image: linear-gradient(90deg, #000 0%, #000 82%, transparent 100%);
      }
      .procession__walker:nth-child(n + 3) { display: block; }`,
  },
  {
    name: 'h-nodim-small',
    css: `
      .procession {
        bottom: calc(3.4rem + env(safe-area-inset-bottom, 0px));
        mask-image: linear-gradient(90deg, #000 0%, #000 82%, transparent 100%);
        -webkit-mask-image: linear-gradient(90deg, #000 0%, #000 82%, transparent 100%);
      }
      .procession__walker:nth-child(n + 3) { display: block; }
      .procession__walker { width: calc(var(--h, 160px) * 0.46); height: calc(var(--h, 160px) * 0.44); }`,
  },
];

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'],
});

for (const v of variants) {
  const page = await (
    await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  ).newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  if (v.css) await page.addStyleTag({ content: v.css });
  await page.waitForTimeout(1700);

  const seen = await page.evaluate(() => {
    const vh = window.innerHeight;
    const rows = [];
    for (const host of document.querySelectorAll('.procession__walker')) {
      const r = host.getBoundingClientRect();
      let eff = 1;
      let p = host;
      while (p && p.nodeType === 1) {
        eff *= Number(getComputedStyle(p).opacity);
        p = p.parentElement;
      }
      rows.push({
        eff: +eff.toFixed(2),
        x: Math.round(r.x),
        y: Math.round(r.y),
        h: Math.round(r.height),
        onScreen: r.width > 0 && r.bottom > 0 && r.top < vh,
      });
    }
    const cta = document.querySelector('.hero__actions a');
    const rc = cta ? cta.getBoundingClientRect() : null;
    const rail = document.querySelector('.rail');
    const rr = rail ? rail.getBoundingClientRect() : null;
    return {
      rows,
      visible: rows.filter((r) => r.onScreen && r.eff >= 0.05).length,
      cta: rc ? { y: Math.round(rc.y), bottom: Math.round(rc.bottom) } : null,
      rail: rr ? { y: Math.round(rr.y) } : null,
    };
  });

  console.log(`[${v.name}] visible=${seen.visible} railY=${seen.rail?.y} cta=${JSON.stringify(seen.cta)}`);
  for (const r of seen.rows) console.log(`   eff=${r.eff} x=${r.x} y=${r.y} h=${r.h} onScreen=${r.onScreen}`);

  await page.screenshot({ path: join(outDir, `mobile-hero-${v.name}.png`) });
  await page.context().close();
}

await browser.close();
console.log(`\nframes in ${outDir}`);
