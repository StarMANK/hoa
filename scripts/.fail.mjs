import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext()).newPage();
p.on('response', (r) => { if (r.status() >= 400) console.log(r.status(), r.url()); });
p.on('requestfailed', (r) => console.log('FAILED', r.url(), r.failure()?.errorText));
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
await b.close();
