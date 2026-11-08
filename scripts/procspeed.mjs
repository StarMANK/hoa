// Whether the hero apes read as alive depends on their speed across a whole
// stride, not at one instant. proc-trudge is a 9s ease-in-out cycle: every walker
// is momentarily still at each turnaround, and --delay-proc staggers the phases,
// so a single 1.2s sample mislabels whichever ape happened to be turning around.
// Track every walker for a full 9s cycle and report its peak speed.
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const CYCLE_MS = 9600;

for (const vp of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  const page = await (
    await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
  ).newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const stats = await page.evaluate(
    async (cycle) => {
      const els = [...document.querySelectorAll('.procession__walker')];
      const effOpacity = (el) => {
        let v = 1;
        let n = el;
        while (n && n !== document.documentElement) {
          const cs = getComputedStyle(n);
          if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
          v *= Number(cs.opacity);
          n = n.parentElement;
        }
        return v;
      };
      const prev = els.map((el) => el.getBoundingClientRect().left);
      const eff = els.map(effOpacity);
      const peak = els.map(() => 0);
      const total = els.map(() => 0);
      const still = els.map(() => 0);
      let samples = 0;

      await new Promise((done) => {
        let last = performance.now();
        const step = (now) => {
          const dt = (now - last) / 1000;
          last = now;
          samples++;
          els.forEach((el, i) => {
            const x = el.getBoundingClientRect().left;
            const v = Math.abs(x - prev[i]) / Math.max(dt, 1e-3);
            peak[i] = Math.max(peak[i], v);
            total[i] += Math.abs(x - prev[i]);
            if (v < 0.5) still[i]++;
            prev[i] = x;
          });
          if (now - start >= cycle) done();
          else requestAnimationFrame(step);
        };
        const start = performance.now();
        requestAnimationFrame(step);
      });

      return els.map((el, i) => ({
        eff: Math.round(eff[i] * 100) / 100,
        width: Math.round(el.getBoundingClientRect().width),
        peakPxPerSec: Math.round(peak[i] * 10) / 10,
        rangePx: Math.round(total[i] / 2),
        stillPct: Math.round((still[i] / samples) * 100),
      }));
    },
    CYCLE_MS,
  );

  console.log(`\n[${vp.name}] hero procession over ${(CYCLE_MS / 1000).toFixed(1)}s`);
  stats.forEach((s, i) => {
    // A sprite is ~100px wide, so anything under ~2px/s is indistinguishable from
    // a still over the second it takes to glance at it.
    const verdict = s.peakPxPerSec < 2 ? 'FROZEN' : s.peakPxPerSec < 5 ? 'sluggish' : 'alive';
    console.log(
      `  #${i}  ${String(s.width).padStart(3)}px wide  eff ${s.eff.toFixed(2)}  ` +
        `peak ${String(s.peakPxPerSec).padStart(5)}px/s  sweeps ${String(s.rangePx).padStart(3)}px  ` +
        `still ${String(s.stillPct).padStart(2)}% of the cycle  ${verdict}`,
    );
  });

  await page.context().close();
}

await browser.close();
