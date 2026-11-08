// How many apes can a visitor actually see in the first viewport, before any
// scroll? Two things make this more than a querySelectorAll count: the roam
// layer is gated behind --scroll-progress, and a walker's own opacity is only
// one factor - the layer and, for the hero line, the .procession container
// multiply into it. So the only honest measurement is the effective opacity
// down the ancestor chain, multiplied, which is what this does.
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

// Anything under this is invisible against the night in practice.
const VISIBLE = 0.05;

// Runs in the page. Effective opacity is the product down the tree; one
// ancestor at 0 erases everything below it regardless of its own value.
const probe = () => {
    const vh = window.innerHeight;
    const rows = [];
    for (const host of document.querySelectorAll('.roam__walker, .procession__walker')) {
      const cs = getComputedStyle(host);
      if (cs.display === 'none') continue;
      const r = host.getBoundingClientRect();
      let eff = 1;
      let culledBy = null;
      for (let p = host; p && p.nodeType === 1; p = p.parentElement) {
        const o = Number(getComputedStyle(p).opacity);
        if (o === 0 && !culledBy) {
          culledBy = p.className ? String(p.className).split(' ')[0] : p.tagName.toLowerCase();
        }
        eff *= o;
      }
      rows.push({
        kind: host.classList.contains('procession__walker') ? 'proc' : 'roam',
        eff: +eff.toFixed(3),
        own: +cs.opacity,
        culledBy,
        y: Math.round(r.y),
        h: Math.round(r.height),
        w: Math.round(r.width),
        inFold: r.bottom > 0 && r.top < vh,
      });
    }
  return {
    progress: getComputedStyle(document.querySelector('.world')).getPropertyValue('--scroll-progress').trim(),
    rows,
  };
};

const tally = (s) => {
  const inFold = s.rows.filter((r) => r.inFold);
  const seen = inFold.filter((r) => r.eff >= VISIBLE);
  return {
    seen: seen.length,
    roam: seen.filter((r) => r.kind === 'roam').length,
    proc: seen.filter((r) => r.kind === 'proc').length,
    eff: seen.map((r) => r.eff),
    zero: inFold.length - seen.length,
    culledBy: [...new Set(inFold.filter((r) => r.eff < VISIBLE).map((r) => r.culledBy ?? `own ${r.own}`))],
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
  await page.waitForTimeout(1600);

  const atTop = await page.evaluate(probe);
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 1.2, behavior: 'instant' }));
  await page.waitForTimeout(900);
  const scrolled = await page.evaluate(probe);

  console.log(`\n[${vp.name}]`);
  console.log(`  at y=0    progress=${atTop.progress}  ${JSON.stringify(tally(atTop))}`);
  console.log(`  after1.2vh progress=${scrolled.progress}  ${JSON.stringify(tally(scrolled))}`);

  await page.context().close();
}

await browser.close();
