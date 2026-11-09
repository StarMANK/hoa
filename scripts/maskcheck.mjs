// Validate the mask maths against the pixels, column by column. Comparing one
// predicted number against one measured number was unreliable: a 206px walker
// straddles a real slope of the dissolve gradient, so whichever pixel was
// brightest in the box and wherever the probe chose to sample were different x
// values, and a walker whose sprite ink happens to sit outside the sample window
// measured 0.000 for reasons that had nothing to do with the mask.
//
// So: for every column of every walker, ask the browser what the mask should
// multiply there, then unmix the composite to find what it did multiply. The ape
// is pure #fff, so a pixel of alpha a over ground g lands at a*255 + (1-a)*g and
// a = (on - off) / (255 - off). Columns the sprite leaves blank are skipped.
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
    return { w: c.width, h: c.height, d: Array.from(ctx.getImageData(0, 0, c.width, c.height).data) };
  }, url);
};

// Predicted alpha per column: the walker's own opacity chain, then every ancestor
// mask evaluated at that column. Mirrors scripts/lib/visibility.mjs but resolves
// horizontally instead of at a single centre point.
const perColumn = () => {
  const proc = document.querySelector('.procession');
  const pb = proc.getBoundingClientRect();
  const img = getComputedStyle(proc).maskImage;
  // mask: none is an answer, not a parse failure - the mobile rule drops the
  // dissolve entirely and the check still has to run there.
  let maskAt = () => 1;
  if (img !== 'none') {
    const m = /linear-gradient\(90deg,\s*(.+)\)$/.exec(img);
    if (!m) return { error: `unhandled mask: ${img}` };
    // Split on top-level commas only. "Split on a comma unless a ) follows" was
    // wrong: every top-level comma here is followed by a rgb(...) somewhere later,
    // so the whole gradient came back as one part and every stop parsed as NaN.
    const parts = [];
    let depth = 0;
    let cur = '';
    for (const ch of m[1]) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) {
        parts.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    if (cur.trim()) parts.push(cur.trim());
    const stops = parts.map((s, i) => {
      const mm = /^(.+?)\s+([\d.]+)%$/.exec(s);
      const color = mm ? mm[1] : s;
      const pos = mm ? Number(mm[2]) : (i / (parts.length - 1)) * 100;
      let a = 1;
      if (/transparent/.test(color)) a = 0;
      else {
        const rgba = color.match(/[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)/);
        if (rgba) a = Number(rgba[1]);
      }
      return { pos, a };
    });
    maskAt = (x) => {
      const pct = ((x - pb.left) / pb.width) * 100;
      if (pct <= stops[0].pos) return stops[0].a;
      const last = stops[stops.length - 1];
      if (pct >= last.pos) return last.a;
      for (let i = 1; i < stops.length; i++) {
        if (pct <= stops[i].pos) {
          const a = stops[i - 1];
          const b = stops[i];
          const t = (pct - a.pos) / (b.pos - a.pos);
          return a.a + t * (b.a - a.a);
        }
      }
      return last.a;
    };
  }

  return {
    walkers: [...document.querySelectorAll('.procession__walker')].map((el) => {
      const r = el.getBoundingClientRect();
      let own = Number(getComputedStyle(el).opacity);
      for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
        own *= Number(getComputedStyle(p).opacity);
      }
      const cols = [];
      for (let x = Math.round(r.left); x < Math.round(r.right); x++) {
        cols.push({ x, want: own * maskAt(x) });
      }
      return { x0: Math.round(r.left), x1: Math.round(r.right), own, cols };
    }),
  };
};

const failures = [];

for (const vp of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  const page = await (
    await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
  ).newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  await page.addStyleTag({ content: '*, *::before, *::after { animation-play-state: paused !important; }' });

  const pred = await page.evaluate(perColumn);
  if (pred.error) {
    console.log(`[${vp.name}] ${pred.error}`);
    failures.push(`${vp.name}: could not predict the mask (${pred.error}), so nothing was verified`);
    continue;
  }

  // Anything painted in front of the procession breaks the unmixing below. The
  // formula alpha = (on - off) / (255 - off) assumes the only thing that changes
  // between the two shots is the ape; a translucent button over an ape is constant
  // in both shots yet sits in front of the pixel being read, so the ground `off`
  // is button-over-background rather than background and the recovered alpha comes
  // out too high. Measured: on mobile, walker #0 read 0.500 against an authored
  // 0.420 purely because .hero__actions overlaps it. Hiding the CTA moved the error
  // from 0.080 to 0.007. So foreground overlap is removed for both shots, and the
  // removal is reported rather than left as a silent change to the scene.
  const occluders = await page.evaluate(() => {
    const progEl = document.querySelector('.procession');
    const prog = progEl.getBoundingClientRect();
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      // An ancestor of the procession cannot occlude it: hiding `.hero` hides the
      // apes with it. Only elements outside the procession's own subtree are
      // candidates, which also rules out the walkers' own svg parts.
      if (progEl.contains(el) || el.contains(progEl)) continue;
      const cls = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
      if (!cls.length) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
      const z = Number(cs.zIndex);
      if (!(Number.isFinite(z) && z > 0)) continue; // behind the procession, cannot occlude
      const ox = Math.min(prog.right, r.right) - Math.max(prog.left, r.left);
      const oy = Math.min(prog.bottom, r.bottom) - Math.max(prog.top, r.top);
      if (ox <= 0 || oy <= 0) continue;
      out.push(cls[0]);
    }
    // A parent and its child can both qualify; hiding the outermost is enough and
    // hides less of the scene overall.
    const set = new Set(out);
    return [...set].filter((c) => ![...set].some((other) => other !== c && document.querySelector(`.${other} .${c}`)));
  });

  const hideCss = occluders.map((c) => `.${c} { visibility: hidden !important; }`).join('\n');
  if (occluders.length) {
    await page.addStyleTag({ content: hideCss });
    await page.waitForTimeout(150);
  }

  await page.evaluate(() => document.querySelector('.procession').classList.add('off'));
  await page.addStyleTag({ content: '.procession.off { display: none !important; }' });
  await page.waitForTimeout(200);
  const off = await decode(page, await page.screenshot());
  await page.evaluate(() => document.querySelector('.procession').classList.remove('off'));
  await page.waitForTimeout(400);
  const on = await decode(page, await page.screenshot());

  console.log(`\n[${vp.name}] mask prediction vs pixels`);
  if (occluders.length) console.log(`  hidden while measuring (painted above the line): ${occluders.join(', ')}`);
  // One matched pair per walker rather than one number per column: take the
  // brightest pixel the ape contributes anywhere in its box and read the
  // prediction back at that same x. Comparing every column instead under-reads
  // badly, because an antialiased arm one pixel wide cannot reach the element's
  // full alpha no matter what the mask does.
  let worst = 0;
  pred.walkers.forEach((w, i) => {
    let got = -1;
    let atX = null;
    for (let x = Math.max(0, w.x0); x < Math.min(off.w, w.x1); x++) {
      for (let y = 0; y < off.h; y++) {
        const idx = (y * off.w + x) * 4;
        for (let c = 0; c < 3; c++) {
          const g = off.d[idx + c];
          if (g > 250) continue;
          const a = (on.d[idx + c] - g) / (255 - g);
          if (a > got) {
            got = a;
            atX = x;
          }
        }
      }
    }
    if (atX === null) {
      console.log(`  #${i}  own ${w.own.toFixed(2)}  no ink found`);
      failures.push(`${vp.name}: walker #${i} painted no ink at all`);
      return;
    }
    const want = w.cols.find((cl) => cl.x === atX)?.want ?? NaN;
    const err = Math.abs(got - want);
    if (err > worst) worst = err;
    if (err >= 0.05) failures.push(`${vp.name}: walker #${i} predicted ${want.toFixed(3)} but painted ${got.toFixed(3)}`);
    const pct = (((atX - 0) / 1380) * 100).toFixed(1);
    console.log(
      `  #${i}  own ${w.own.toFixed(2)}  brightest ink at x=${atX} (~${pct}% across)  ` +
        `predicted ${want.toFixed(3)}  painted ${got.toFixed(3)}  err ${err.toFixed(3)}  ${err < 0.05 ? 'ok' : 'MISMATCH'}`,
    );
  });
  console.log(`  worst error across ${pred.walkers.length} walkers: ${worst.toFixed(3)}`);

  await page.context().close();
}

await browser.close();

if (failures.length) {
  console.error('\nFAIL');
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log('\npainted alpha matches the mask everywhere it was measured');
