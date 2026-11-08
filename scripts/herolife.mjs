// The hero has to carry the premise: apes that are visibly alive, not apes that
// are merely present. At y=0 the roam layer is gated off by --scroll-progress, so
// the procession is the only subject. Sample each walker's screen position over a
// second and report how far it actually moved - an ape sitting still at 0.88
// opacity is a JPEG, not the persistent subject this page is built on.
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const snapshot = () =>
  ['.roam__walker', '.procession__walker'].flatMap((sel) =>
    [...document.querySelectorAll(sel)].map((el, i) => {
      const r = el.getBoundingClientRect();
      let eff = 1;
      let node = el;
      let culledBy = null;
      while (node && node !== document.documentElement) {
        const cs = getComputedStyle(node);
        if (cs.display === 'none' || cs.visibility === 'hidden') {
          culledBy = node.className || node.tagName;
          eff = 0;
          break;
        }
        eff *= Number(cs.opacity);
        node = node.parentElement;
      }
      return {
        sel,
        i,
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        w: r.width,
        eff: Math.round(eff * 100) / 100,
        culledBy,
      };
    }),
  );

for (const vp of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  const page = await (
    await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
  ).newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const before = await page.evaluate(snapshot);
  await page.waitForTimeout(1200);
  const after = await page.evaluate(snapshot);

  console.log(`\n[${vp.name}] y=0`);
  const seen = new Map();
  before.forEach((b, k) => {
    const a = after[k];
    const key = b.sel;
    if (b.eff <= 0.01) {
      seen.set(`${key} culled`, (seen.get(`${key} culled`) ?? 0) + 1);
      return;
    }
    const move = Math.hypot(a.x - b.x, a.y - b.y);
    const drift = Math.round(move * 10) / 10;
    // A leg cycle also changes apparent width when a sprite mirrors or scales.
    const dw = Math.round(Math.abs(a.w - b.w) * 10) / 10;
    console.log(
      `  ${key} #${b.i}  eff ${b.eff.toFixed(2)}  moved ${String(drift).padStart(5)}px in 1.2s` +
        `${dw > 0.2 ? `  width delta ${dw}px` : ''}  ${drift < 0.3 ? 'STILL' : 'alive'}`,
    );
    const rec = seen.get(key) ?? { n: 0, still: 0, minMove: Infinity };
    rec.n++;
    if (drift < 0.3) rec.still++;
    rec.minMove = Math.min(rec.minMove, drift);
    seen.set(key, rec);
  });
  for (const [k, v] of seen) {
    if (String(k).endsWith('culled')) {
      console.log(`  ${k}: ${v}`);
      continue;
    }
    console.log(`  => ${k}: ${v.n} visible, ${v.still} motionless, least motion ${v.minMove}px/1.2s`);
  }

  await page.context().close();
}

await browser.close();
