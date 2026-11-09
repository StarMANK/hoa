// Verification harness: capture key frames of the wall so the design can be
// judged by eye instead of by "the code ran". Frames are deterministic:
// scrolling is stepped and animations are given settle time.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const url = process.env.TARGET_URL ?? 'http://localhost:5173/';
// join() at the write site rather than concatenating: an OUT_DIR supplied
// without a trailing slash used to mkdir the folder and then write the frames
// one level up beside it, because `${outDir}${name}` is just string glue.
const outDir = process.env.OUT_DIR ?? new URL('../shots/', import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });

const shots = [
  { name: '01-hero', y: 0 },
  { name: '02-seam', y: 0.06 },
  { name: '03-chapter-01', y: 0.14 },
  { name: '04-chapter-02', y: 0.26 },
  { name: '05-chapter-03', y: 0.38 },
  { name: '06-chapter-04', y: 0.5 },
  { name: '07-chapter-05', y: 0.6 },
  { name: '08-data', y: 0.68 },
  { name: '09-genres', y: 0.76 },
  { name: '10-rules', y: 0.84 },
  { name: '11-join', y: 0.92 },
  { name: '12-footer', y: 1 },
];

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'],
});

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const problems = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);

  const height = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );

  for (const shot of shots) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), Math.round(height * shot.y));
    await page.waitForTimeout(950);
    await page.screenshot({ path: join(outDir, `${viewport.name}-${shot.name}.png`) });
  }

  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollW: doc.scrollWidth, clientW: doc.clientWidth };
  });

  const hidden = await page.evaluate(() => {
    const reveal = Array.from(document.querySelectorAll('.reveal'));
    const notIn = reveal.filter((node) => !node.classList.contains('is-in'));
    return {
      revealTotal: reveal.length,
      revealHidden: notIn.length,
      hiddenText: notIn.slice(0, 4).map((node) => node.textContent.trim().slice(0, 48)),
    };
  });

  console.log(`\n[${viewport.name}] scrollHeight=${height} ${JSON.stringify(overflow)}`);
  if (overflow.scrollW > overflow.clientW + 1) {
    console.log(`  !! horizontal overflow: ${overflow.scrollW} > ${overflow.clientW}`);
  }
  console.log(`  reveals: ${hidden.revealTotal - hidden.revealHidden}/${hidden.revealTotal} shown`, hidden.hiddenText);
  if (problems.length) console.log('  !! problems:', [...new Set(problems)].slice(0, 8));

  await context.close();
}

await browser.close();
console.log(`\nsaved frames to ${outDir}`);
