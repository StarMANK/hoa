// Overflow probe: reports the elements that push the document wider than the
// viewport, with computed styles so the fix targets the real cause.
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

for (const width of [1440, 390]) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const report = await page.evaluate((vw) => {
    const offenders = [];
    document.querySelectorAll('body *').forEach((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      if (rect.right <= vw + 1 && rect.left >= -1) return;
      const style = getComputedStyle(node);
      offenders.push({
        sel: `${node.tagName.toLowerCase()}.${Array.from(node.classList).join('.')}`,
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        w: Math.round(rect.width),
        pos: style.position,
        ov: style.overflowX,
      });
    });
    return {
      docScroll: document.documentElement.scrollWidth,
      bodyScroll: document.body.scrollWidth,
      offenders: offenders.slice(0, 14),
    };
  }, width);

  console.log(`\n=== ${width}px: doc=${report.docScroll} body=${report.bodyScroll}`);
  report.offenders.forEach((o) => console.log(' ', o.sel, `l=${o.left} r=${o.right} w=${o.w} ${o.pos} ovx=${o.ov}`));
  await context.close();
}

await browser.close();
