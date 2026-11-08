// Where does each walker sit inside the procession's dissolve gradient? The mask
// stops are percentages of the container, so a walker's fate depends on where its
// own centre lands between them. Print each walker's centre as a fraction of the
// container next to the mask stops so the ramps can be placed deliberately
// instead of guessed at.
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

for (const vp of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  const page = await (await browser.newContext({ viewport: { width: vp.width, height: vp.height } })).newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const info = await page.evaluate(() => {
    const proc = document.querySelector('.procession');
    const pb = proc.getBoundingClientRect();
    const cs = getComputedStyle(proc);
    return {
      mask: cs.maskImage,
      container: { left: Math.round(pb.left), width: Math.round(pb.width), right: Math.round(pb.right) },
      viewport: window.innerWidth,
      walkers: [...document.querySelectorAll('.procession__walker')].map((el, i) => {
        const r = el.getBoundingClientRect();
        const centre = r.left + r.width / 2;
        return {
          i,
          own: Number(getComputedStyle(el).opacity),
          leftPct: +(((r.left - pb.left) / pb.width) * 100).toFixed(1),
          rightPct: +(((r.right - pb.left) / pb.width) * 100).toFixed(1),
          centrePct: +(((centre - pb.left) / pb.width) * 100).toFixed(1),
          px: Math.round(r.width),
          offRight: Math.round(centre - window.innerWidth),
        };
      }),
    };
  });

  console.log(`\n[${vp.name}] container x${info.container.left}..${info.container.right} (w=${info.container.width}) viewport=${info.viewport}`);
  console.log(`  mask: ${info.mask}`);
  info.walkers.forEach((w) => {
    console.log(
      `  #${w.i}  own ${w.own.toFixed(2)}  ${String(w.px).padStart(3)}px  spans ${String(w.leftPct).padStart(5)}%..${String(w.rightPct).padStart(5)}%  ` +
        `centre ${String(w.centrePct).padStart(5)}%${w.offRight > 0 ? `  (${w.offRight}px past the right edge)` : ''}`,
    );
  });

  await page.context().close();
}
await browser.close();
