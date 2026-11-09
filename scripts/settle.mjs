import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const b = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const p = await c.newPage();
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);

const h = await p.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), Math.round(h * 0.5));
await p.waitForTimeout(4000);

// Report how much of each carved path is actually drawn.
console.log(
  await p.evaluate(() =>
    Array.from(document.querySelectorAll('.chapter'))
      .filter((ch) => ch.classList.contains('is-in'))
      .map((ch) => {
        const title = ch.querySelector('h2')?.textContent?.trim().slice(0, 24);
        const paths = Array.from(ch.querySelectorAll('.carve')).map((el) => {
          const len = el.getTotalLength();
          const cs = getComputedStyle(el);
          const dash = Number.parseFloat(cs.strokeDasharray) || 0;
          const offset = Number.parseFloat(cs.strokeDashoffset) || 0;
          return `dasharray=${dash.toFixed(2)} offset=${offset.toFixed(2)} drawn=${Math.round(((dash - offset) / dash) * 100)}% len=${Math.round(len)}`;
        });
        return `${title} -> ${paths.slice(0, 2).join(' | ')}`;
      })
      .join('\n'),
  ),
);

const box = await p.evaluate(() => {
  const mark = document.querySelectorAll('.chapter')[4]?.querySelector('.mark');
  if (!mark) return 'no mark';
  const r = mark.getBoundingClientRect();
  const svgBox = mark.viewBox.baseVal;
  return `svg box=${Math.round(r.width)}x${Math.round(r.height)} viewBox=${svgBox.width}x${svgBox.height} overflow=${getComputedStyle(mark).overflow}`;
});
console.log(box);

await p.screenshot({ path: 'shots/settle-chapter-04.png' });
await b.close();
