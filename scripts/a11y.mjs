// Accessibility + reduced-motion verification. Checks the things a screenshot
// cannot prove: that nothing is left invisible when motion is reduced, that no
// animation keeps running, and that keyboard focus reaches the real controls.
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const url = process.env.TARGET_URL ?? 'http://localhost:5173/';

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

// --- reduced motion -------------------------------------------------------
async function ambientMotion(page, ms) {
  // Measure real displacement instead of trusting playState: an animation that
  // is parked in its delay phase still reports as "running".
  const read = () =>
    // .ember and .wall-glyph are gone from the jungle-night world: the ambient
    // movers are now the apes themselves, so they are what must be still under
    // reduce and moving otherwise.
    Array.from(
      document.querySelectorAll(
        '.roam__walker, .procession__walker, .seam__row--a, .hero__kicker .dot',
      ),
    ).map((node) => {
        const r = node.getBoundingClientRect();
        return [r.x, r.y, getComputedStyle(node).opacity];
      },
    );
  const a = await page.evaluate(read);
  await page.waitForTimeout(ms);
  const b = await page.evaluate(read);
  return a.filter((_, i) => Math.abs(a[i][0] - b[i][0]) > 1 || Math.abs(a[i][1] - b[i][1]) > 1 || a[i][2] !== b[i][2]).length;
}

const rm = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
});
const rmPage = await rm.newPage();
await rmPage.goto(url, { waitUntil: 'networkidle' });
await rmPage.waitForTimeout(1500);
await rmPage.screenshot({ path: 'shots/rm-00-hero.png' });

const rmMoving = await ambientMotion(rmPage, 1800);

const rmReport = await rmPage.evaluate(() => {
  const cs = getComputedStyle(document.documentElement);
  // Everything that must be readable without motion.
  const probes = ['.hero__kicker', '.hero__title .word', '.hero__actions .cta', '.hero__blurb', '.chapter__copy', '.chapter__body', '.stat__label', '.join__card', '.join__meta', '.rule__num', '.genre__name'];
  const unreadable = [];
  for (const sel of probes) {
    document.querySelectorAll(sel).forEach((node) => {
      const s = getComputedStyle(node);
      const opacity = Number(s.opacity);
      const hidden = opacity < 0.9 || s.visibility === 'hidden' || s.display === 'none';
      if (hidden) unreadable.push({ sel, opacity: s.opacity, visibility: s.visibility });
    });
  }

  return {
    prefersReduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    revealHidden: document.querySelectorAll('.reveal:not(.is-in)').length,
    revealOpacityBelow: Array.from(document.querySelectorAll('.reveal')).filter((n) => Number(getComputedStyle(n).opacity) < 0.9).length,
    unreadable,
    // The apes are the subject: a reduced-motion load must still show them, not
    // a page of empty foliage. Anything on screen with real opacity counts.
    apesVisible: Array.from(document.querySelectorAll('.roam__walker, .procession__walker')).filter((n) => {
      const s = getComputedStyle(n);
      const r = n.getBoundingClientRect();
      const onScreen = r.bottom > 0 && r.top < innerHeight && r.width > 0;
      return onScreen && Number(s.opacity) > 0.05 && s.display !== 'none';
    }).length,
    emberCount: document.querySelectorAll('.ember').length,
    scrollGlow: cs.getPropertyValue('--scroll-glow').trim(),
  };
});
console.log('reduced-motion:', JSON.stringify(rmReport, null, 2));
console.log(`reduced-motion ambient elements actually moving: ${rmMoving}`);
await rm.close();

// --- sanity: motion mode must move ambient elements ----------------------
const normal = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
const normalPage = await normal.newPage();
await normalPage.goto(url, { waitUntil: 'networkidle' });
await normalPage.waitForTimeout(1500);
const normalMoving = await ambientMotion(normalPage, 1800);
console.log(`no-preference ambient elements moving (must be > 0): ${normalMoving}`);
await normal.close();

if (rmMoving > 0) console.log('  !! motion still running under reduced-motion');
if (rmReport.revealOpacityBelow > 0) console.log(`  !! ${rmReport.revealOpacityBelow} reveals still faded out`);
if (rmReport.unreadable.length) console.log('  !! unreadable under reduced motion:', rmReport.unreadable.slice(0, 5));

// --- keyboard -------------------------------------------------------------
const kb = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const kbPage = await kb.newPage();
await kbPage.goto(url, { waitUntil: 'networkidle' });
await kbPage.waitForTimeout(1200);

const stops = [];
let noRing = 0;
for (let i = 0; i < 14; i += 1) {
  await kbPage.keyboard.press('Tab');
  const info = await kbPage.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const s = getComputedStyle(el);
    const ring =
      s.outlineStyle !== 'none' && Number.parseFloat(s.outlineWidth) > 0 && s.outlineColor !== 'rgba(0, 0, 0, 0)';
    return {
      tag: el.tagName.toLowerCase(),
      label: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 32),
      href: el.getAttribute('href') ?? '',
      ring,
    };
  });
  if (!info) continue;
  if (!info.ring) noRing += 1;
  stops.push(`${info.tag}[${info.label}${info.href ? ` -> ${info.href}` : ''}]${info.ring ? '' : ' NO-FOCUS-RING'}`);
}

console.log('\nkeyboard focus order:');
stops.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)}. ${s}`));
console.log(`focus stops without a visible ring: ${noRing}`);

// Enter must reach the Discord invite.
await kbPage.evaluate(() => document.querySelector('.hero__actions a')?.focus());
const focusedHref = await kbPage.evaluate(() => document.activeElement?.getAttribute('href'));
console.log('hero primary CTA href when focused:', focusedHref);

await kb.close();
await browser.close();
