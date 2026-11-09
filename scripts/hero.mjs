import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

for (const vp of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const rows = await page.evaluate((h) => {
    const sels = ['.hero__kicker', '.hero__title', '.hero__path', '.hero__actions', '.hero__blurb', '.scroll-hint', '.seam'];
    const out = sels.map((sel) => {
      const el = document.querySelector(sel);
      if (!el) return `${sel.padEnd(16)} MISSING`;
      const r = el.getBoundingClientRect();
      const flag = r.bottom > h ? `CLIPPED by ${Math.round(r.bottom - h)}px` : `ok (fits, ${Math.round(h - r.bottom)}px spare)`;
      return `${sel.padEnd(16)} top=${String(Math.round(r.top)).padStart(4)} bottom=${String(Math.round(r.bottom)).padStart(4)} ${flag}`;
    });
    out.push(`viewport height = ${h}`);
    return out;
  }, vp.height);

  console.log(`\n[${vp.name}]`);
  rows.forEach((r) => console.log('  ' + r));
  await ctx.close();
}
await browser.close();
