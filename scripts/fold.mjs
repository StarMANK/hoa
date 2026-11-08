// How many apes can a visitor actually see in the first viewport, before any
// scroll? The roam layer is gated behind --scroll-progress, so the number the
// DOM implies and the number a visitor gets are different questions. Opacity
// also has to be resolved down the ancestor chain - see lib/visibility.mjs,
// which is where that logic lives so every script measures it the same way.
import { chromium } from 'playwright-core';
import { effectiveOpacityProbe } from './lib/visibility.mjs';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const WALKERS = '.roam__walker, .procession__walker';

const tally = (s) => {
  const seen = s.visible;
  return {
    seen: seen.length,
    roam: seen.filter((r) => r.kind === 'roam__walker').length,
    proc: seen.filter((r) => r.kind === 'procession__walker').length,
    eff: seen.map((r) => r.eff),
    // What is in the DOM but cannot be seen, and which ancestor killed it.
    culled: s.culled,
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

  const atTop = await page.evaluate(effectiveOpacityProbe, WALKERS);
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 1.2, behavior: 'instant' }));
  await page.waitForTimeout(900);
  const scrolled = await page.evaluate(effectiveOpacityProbe, WALKERS);

  console.log(`\n[${vp.name}]`);
  console.log(`  at y=0     progress=${atTop.progress}  ${JSON.stringify(tally(atTop))}`);
  console.log(`  after 1.2vh progress=${scrolled.progress}  ${JSON.stringify(tally(scrolled))}`);

  await page.context().close();
}

await browser.close();
