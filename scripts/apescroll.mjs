// How many apes are actually on screen through the length of the page. Ape
// presence is the premise of the whole rework, so the claim needs a number at
// every depth, not a screenshot of one. The roam layer is opacity-gated on
// --scroll-progress, which means a screenshot taken before scrolling proves
// nothing about the rest of the page and a DOM count overstates what is seen.
// See lib/visibility.mjs for why opacity has to be resolved down the tree.
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

const failures = [];

for (const vp of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  const page = await (
    await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
  ).newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);

  const total = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  console.log(`\n[${vp.name}]  scrollable=${total}px`);
  console.log('   scrollY   progress  seen  roam  proc  effective opacities        culled by');

  const seenAt = [];
  // "On screen" is not the same as "able to be seen": an ape at 0.02 effective
  // opacity is in the DOM, in the screenshots, and invisible to a person.
  let faintest = 1;
  let faintestAt = 0;
  for (const y of [0, 0.1, 0.2, 0.3, 0.45, 0.6, 0.75, 0.9, 1]) {
    const px = Math.round(total * y);
    await page.evaluate((t) => window.scrollTo({ top: t, behavior: 'instant' }), px);
    await page.waitForTimeout(700);
    const s = await page.evaluate(effectiveOpacityProbe, WALKERS);
    const v = s.visible;
    seenAt.push(v.length);
    for (const r of v) {
      if (r.eff < faintest) {
        faintest = r.eff;
        faintestAt = px;
      }
    }
    console.log(
      `  ${String(px).padStart(6)}   ${(s.progress || '-').padEnd(7)}  ` +
        `${String(v.length).padStart(4)}  ` +
        `${String(v.filter((r) => r.kind === 'roam__walker').length).padStart(4)}  ` +
        `${String(v.filter((r) => r.kind === 'procession__walker').length).padStart(4)}  ` +
        `[${v.map((r) => r.eff.toFixed(2)).join(' ')}]`.padEnd(27) +
        ` ${(s.culled.join(',') || '-').slice(0, 40)}`,
    );
  }
  const empty = seenAt.filter((n) => n === 0).length;
  console.log(`  depths with no apes on screen: ${empty}/${seenAt.length}  ${JSON.stringify(seenAt)}`);
  // The whole premise of the rework is that the ape is the persistent subject. A
  // single empty depth means some scroll position shows a page of scenery only.
  if (empty > 0) failures.push(`${vp.name}: ${empty} of ${seenAt.length} scroll depths render no apes`);
  // Anything under 0.05 on a #030405 void is within a few code values of the
  // background, i.e. painted but not visible. 0.05 keeps a margin under the
  // dimmest ape the design actually asks for (0.21 on mobile mid-scroll).
  if (faintest < 0.05) {
    failures.push(`${vp.name}: faintest ape on screen is ${faintest.toFixed(3)} at scrollY ${faintestAt}, effectively invisible`);
  } else {
    console.log(`  faintest ape anywhere on the scroll: ${faintest.toFixed(2)} at scrollY ${faintestAt}`);
  }

  await page.context().close();
}

await browser.close();

if (failures.length) {
  console.error('\nFAIL');
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
