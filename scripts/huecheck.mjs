// Is the page actually achromatic?
//
// scripts/palette.mjs checks the tokens: it reads custom properties off computed
// style and compares them to the logo. That proves the palette file is clean but says
// nothing about what gets painted, and the two can diverge. Gradients, blend modes,
// filters, drop shadows and hardcoded rgba() in a band fill all produce colour no
// token declares. This renders the page and asks the pixels instead.
//
// The claim under test is the one in tokens.css: "Colour on this page comes from
// depth, never from a hue." The ember palette that used to own this page is exactly a
// hue, so it should light this up.
//
// Measuring hue on a night palette needs care. The background is #060809 and the
// foliage is #070b09, so a pixel like #141718 has a 4/8 channel disagreement, which
// is 50% "saturation" by ratio yet is 4 code values of dither and completely
// invisible. Ratio-based chroma therefore flags 31% of the page as hued and says
// nothing. Absolute channel spread is what the eye gets: 4 code values for the night
// ramp, 190 for the old ember accent. That is the threshold this probe uses.
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'],
});

const decode = async (page, buffer) => {
  const url = `data:image/png;base64,${buffer.toString('base64')}`;
  return page.evaluate(async (src) => {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = src;
    });
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    return Array.from(ctx.getImageData(0, 0, c.width, c.height).data);
  }, url);
};

// Code values apart, not a ratio. The night ramp measures 4-6; the ember accent this
// page used to ship measures 190 at full strength and still ~40 once antialiased to a
// fifth of its coverage, so 40 separates "dither" from "there is a colour here".
const HUED = 40;

// A real orange block rather than a CSS selector that might not match: if the probe
// cannot see a 200x200 patch of #e8622a sitting in the middle of the viewport, then a
// quiet regression to the ember palette would be invisible to it too.
const EMBER = `
  .ember-control { position: fixed; left: 40px; top: 40px; width: 200px; height: 200px; background: #e8622a; z-index: 99999; }
`;

const failures = [];

for (const [label, scrollFrac, control] of [
  ['hero', 0, false],
  ['mid-page', 0.4, false],
  ['join band', 0.95, false],
  ['ember control', 0, true],
]) {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.evaluate((f) => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * f), scrollFrac);
  await page.waitForTimeout(900);
  if (control) await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<div class="ember-control"></div>'));
  await page.addStyleTag({ content: EMBER });
  await page.addStyleTag({ content: '*, *::before, *::after { animation-play-state: paused !important; }' });
  await page.waitForTimeout(250);

  const d = await decode(page, await page.screenshot());
  const buckets = new Map();
  let worst = null;
  let hued = 0;
  let total = 0;
  const spreadHist = new Array(256).fill(0);
  for (let p = 0; p < d.length; p += 4) {
    const [r, g, b] = [d[p], d[p + 1], d[p + 2]];
    total += 1;
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    // Record the whole distribution so the threshold is a measurement, not a guess.
    for (let k = 0; k < spreadHist.length; k += 1) {
      if (spread > k) spreadHist[k] += 1;
      else break;
    }
    if (spread > HUED) {
      const key = `${r},${g},${b}`;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
      hued += 1;
      if (!worst || spread > worst.spread) worst = { r, g, b, spread };
    }
  }

  // spreadHist[k] counts pixels with spread > k, so the q'th percentile is the
  // largest k still holding more than (1-q) of the pixels.
  const pcts = [0.5, 0.9, 0.99, 0.999, 1].map((q) => {
    let k = 0;
    while (k < 255 && spreadHist[k] > total * (1 - q)) k += 1;
    return `p${String(q * 100).replace(/\.0$/, '')}=${k}`;
  });
  console.log(`    spread percentiles: ${pcts.join(' ')}`);
  const frac = hued / total;
  const top = [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  console.log(
    `[${label}] hued pixels ${hued} of ${total} (${(frac * 100).toFixed(3)}%)` +
      (worst ? `, widest spread ${worst.spread} at rgb(${worst.r},${worst.g},${worst.b})` : ''),
  );
  for (const [rgb, n] of top) {
    const [r, g, b] = rgb.split(',').map(Number);
    const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    console.log(`    ${hex}  ${n} px  spread ${Math.max(r, g, b) - Math.min(r, g, b)}`);
  }

  if (control) {
    if (hued < 20000) {
      failures.push(`ember control: painted a 200x200 orange block (${200 * 200} px) and found only ${hued}`);
    }
  } else if (hued > 0) {
    failures.push(`${label}: ${hued} pixels exceed a ${HUED}-code-value channel spread`);
  }

  await page.context().close();
}

await browser.close();

if (failures.length) {
  console.error('\nFAIL');
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log('\nno hue anywhere on the page: every painted pixel is on the night ramp');
