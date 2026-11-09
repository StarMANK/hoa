// Audit the two things asserted in the last report but never measured:
//  1. "the mobile hero clears the rail"  -> actual box overlap on 390px.
//  2. "apes are the persistent subject"  -> what opacity are they really at
//     once you are mid-page, on desktop and phone? A subject you cannot see is
//     still decoration.
import { chromium } from 'playwright-core';
import { effectiveOpacityProbe } from './lib/visibility.mjs';

const WALKERS = '.roam__walker, .procession__walker';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

for (const vp of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const overlap = async () =>
    page.evaluate(() => {
      const box = (el) => {
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      };
      const rail = document.querySelector('.rail');
      const heroCopy = [
        '.hero__actions .cta',
        '.hero__blurb',
        '.lead',
        '.hero__title',
      ];
      const out = [];
      if (rail) {
        const rb = box(rail);
        for (const sel of heroCopy) {
          document.querySelectorAll(sel).forEach((n) => {
            const cb = box(n);
            if (cb.w === 0) return;
            const ox = Math.min(cb.x + cb.w, rb.x + rb.w) - Math.max(cb.x, rb.x);
            const oy = Math.min(cb.y + cb.h, rb.y + rb.h) - Math.max(cb.y, rb.y);
            if (ox > 0 && oy > 0) out.push({ with: sel, overlap: `${ox}x${oy}` });
          });
        }
      }
      const proc = [...document.querySelectorAll('.procession__walker')].filter(
        (n) => getComputedStyle(n).display !== 'none',
      );
      return {
        railBox: rail ? box(rail) : null,
        collisions: out,
        processionWalkers: proc.length,
        processionOpacity: proc.length ? getComputedStyle(document.querySelector('.procession')).opacity : null,
      };
    });

  // Mid-page: park on the trail, then read what the apes resolved to.
  // behavior:'instant' - html sets scroll-behavior: smooth, so a bare scrollTo glides and
  // the 900ms wait can land mid-flight, which reports a --scroll-progress from somewhere
  // between the hero and the trail rather than from the trail.
  await page.evaluate(() => scrollTo({ top: document.body.scrollHeight * 0.3, behavior: 'instant' }));
  await page.waitForTimeout(900);

  const at = async () => {
    const s = await page.evaluate(effectiveOpacityProbe, WALKERS);
    return {
      progress: s.progress,
      // Own opacity alone counted display:none walkers and ignored the roam
      // layer gating them, so it reported 8 apes where 5 were visible.
      roamOpacities: s.rows.filter((r) => r.kind === 'roam__walker').map((r) => r.eff),
      visibleCount: s.visible.length,
      culled: s.culled,
    };
  };

  console.log(`[${vp.name}] fold:`, JSON.stringify(await overlap()));
  console.log(`[${vp.name}] trail@30%:`, JSON.stringify(await at()));
  await ctx.close();
}

await browser.close();
