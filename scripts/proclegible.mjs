// Making the apes brighter does not just add pixels, it can put them on top of
// things that were legible when the apes were invisible. Check every text-bearing
// element in the hero against every walker box, and report the ones that actually
// intersect, because the head of the line used to sit at 0.17 alpha where a
// collision could not be seen.
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

const failures = [];

for (const vp of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  const page = await (await browser.newContext({ viewport: vp })).newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const hits = await page.evaluate(() => {
    const walkers = [...document.querySelectorAll('.procession__walker')].map((el, i) => {
      const r = el.getBoundingClientRect();
      return { i, l: r.left, t: r.top, r: r.right, b: r.bottom };
    });
    const text = [...document.querySelectorAll('.hero, .rail, .scroll-hint')]
      .flatMap((root) => [...root.querySelectorAll('p, a, span, h1, h2, h3, li')])
      .filter((el) => (el.textContent ?? '').trim().length > 0 && el.children.length === 0);

    const seen = new Set();
    const out = [];
    for (const el of text) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      for (const w of walkers) {
        const ox = Math.min(r.right, w.r) - Math.max(r.left, w.l);
        const oy = Math.min(r.bottom, w.b) - Math.max(r.top, w.t);
        if (ox <= 0 || oy <= 0) continue;
        const cs = getComputedStyle(el);
        const label = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 28);
        const key = `${label}|${w.i}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          label,
          walker: w.i,
          ox: Math.round(ox),
          oy: Math.round(oy),
          area: Math.round(ox * oy),
          textArea: Math.round(r.width * r.height),
          color: cs.color,
          zText: cs.zIndex,
          above: (() => {
            // Which of the two paints last? Compare resolved z-order by hit test.
            const cx = Math.max(r.left, w.l) + Math.min(ox, 8) / 2;
            const cy = Math.max(r.top, w.t) + Math.min(oy, 8) / 2;
            const top = document.elementFromPoint(cx, cy);
            if (!top) return 'unknown';
            const el2 = document.querySelector('.procession');
            return top === el || (el2 && el2.contains(top)) ? 'ape on top' : 'text on top';
          })(),
        });
      }
    }
    return out.sort((a, b) => b.area - a.area);
  });

  console.log(`\n[${vp.name}] text overlapping procession apes`);
  if (!hits.length) console.log('  none');
  hits.forEach((h) =>
    console.log(
      `  "${h.label}" x ape #${h.walker}  overlap ${h.ox}x${h.oy}px = ${h.area} of ${h.textArea} ` +
        `(${Math.round((h.area / h.textArea) * 100)}% of the text box)  ${h.above}`,
    ),
  );
  // An ape painted over glyphs always wins, so that is a defect outright. Text on
  // top can still be unreadable when the ape is bright: the SCROLL cue cleared
  // 16.91:1 with nothing behind it and fell to 1.38:1 once a 0.77-alpha silhouette
  // moved in, while only 19% of its box was covered. So any coverage at all is
  // reported as a failure rather than waved through below some invented tolerance.
  for (const h of hits) {
    const pct = Math.round((h.area / h.textArea) * 100);
    failures.push(
      `${vp.name}: "${h.label}" sits on ape #${h.walker} (${pct}% of its box, ${h.above})`,
    );
  }

  await page.context().close();
}
await browser.close();

if (failures.length) {
  console.error('\nFAIL');
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log('\nno procession ape touches any hero text');
