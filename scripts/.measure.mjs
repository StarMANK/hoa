import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
const data = await p.evaluate(() => {
  const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) }; };
  return {
    vh: window.innerHeight,
    kicker: box('.hero__kicker'),
    title: box('.hero__title'),
    path: box('.hero__path'),
    actions: box('.hero__actions'),
    blurb: box('.hero__blurb'),
    hint: box('.scroll-hint'),
    plate: (() => { const e = document.querySelector('.hero__plate'); const r = e.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) }; })(),
    rail: (() => { const e = document.querySelector('.rail'); const r = e.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) }; })(),
  };
});
console.log(JSON.stringify(data, null, 1));
await b.close();
