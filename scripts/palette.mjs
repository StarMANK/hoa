// Validates the palette decisions with numbers instead of a comment in tokens.css:
//  1. Re-sample hoa_logo.png and report what the opaque pixels actually are.
//  2. Compare the sampled value to the --accent the page computes at runtime.
//  3. Contrast ratio for every accent text role, so "bone on night" is legible
//     rather than merely on-palette.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const png = readFileSync(new URL('../hoa_logo.png', import.meta.url));

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.goto('about:blank');

const sample = await page.evaluate(
  async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);

    const buckets = new Map();
    let opaque = 0;
    let semi = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a === 0) continue;
      if (a === 255) {
        opaque += 1;
        const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      } else {
        semi += 1;
      }
    }
    const top = [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    // Hue spread: an achromatic mark has r===g===b. Max channel delta across all
    // opaque pixels is the honest answer to "does the logo have a colour?".
    let maxDelta = 0;
    let satSum = 0;
    let sum = [0, 0, 0];
    for (const [key, n] of buckets) {
      const [r, g, b] = key.split(',').map(Number);
      maxDelta = Math.max(maxDelta, Math.max(r, g, b) - Math.min(r, g, b));
      satSum += (Math.max(r, g, b) - Math.min(r, g, b)) * n;
      sum = [sum[0] + r * n, sum[1] + g * n, sum[2] + b * n];
    }
    return {
      size: [c.width, c.height],
      opaquePixels: opaque,
      antialiasedPixels: semi,
      uniqueOpaqueColors: buckets.size,
      topColors: top.map(([k, n]) => ({ rgb: k, hex: rgbToHex(k), pct: +((n / opaque) * 100).toFixed(3) })),
      maxChannelDelta: maxDelta,
      meanSaturation: +(satSum / opaque).toFixed(3),
      weightedMean: rgbToHex(sum.map((v) => Math.round(v / opaque)).join(',')),
    };

    function rgbToHex(key) {
      const [r, g, b] = key.split(',').map(Number);
      return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    }
  },
  png.toString('base64'),
);

console.log('logo sample:', JSON.stringify(sample, null, 2));

// --- runtime accent roles -------------------------------------------------
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
const roles = await page.evaluate(() => {
  const names = ['accent', 'accent-dim', 'on-accent', 'night', 'night-2', 'night-3', 'canopy', 'bone', 'bone-2', 'rule'];
  // getPropertyValue on a custom property hands back the declaration text, so
  // --on-accent would read "var(--night)" and be unusable. Resolve each token
  // the way the browser does: paint it onto a probe over the real --night
  // background and read the used colour off the computed style. This reports
  // what is on screen, including alpha already composited against the page.
  const host = document.createElement('div');
  document.body.appendChild(host);
  const out = {};
  for (const name of names) {
    const probe = document.createElement('span');
    probe.textContent = 'x';
    probe.style.color = `var(--${name})`;
    host.appendChild(probe);
    out[`--${name}`] = getComputedStyle(probe).color;
  }
  host.remove();

  const lum = ([r, g, b]) => {
    const f = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const parse = (v) => {
    v = v.trim();
    if (v.startsWith('#')) {
      const h = v.slice(1);
      return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    }
    const m = v.match(/[\d.]+/g);
    if (!m) return null;
    return { rgb: m.slice(0, 3).map(Number), a: m.length > 3 ? Number(m[3]) : 1 };
  };
  // Alpha has to be composited against the actual backdrop before it can be
  // compared; multiplying channels by alpha measures against black instead.
  const over = (fg, bg) => ({
    rgb: fg.rgb.map((c, i) => Math.round(c * fg.a + bg.rgb[i] * (1 - fg.a))),
    a: 1,
  });
  const ratio = (a, b) => {
    const la = lum(a.rgb);
    const lb = lum(b.rgb);
    const [hi, lo] = la > lb ? [la, lb] : [lb, la];
    return +((hi + 0.05) / (lo + 0.05)).toFixed(2);
  };
  const night = parse(out['--night']);
  const accent = parse(out['--accent']);
  const on = (name) => over(parse(out[name]), night);
  return {
    vars: out,
    contrastOnNight: Object.fromEntries(
      names
        .filter((n) => n !== 'night')
        .map((n) => [`--${n}`, ratio(on(`--${n}`), night)]),
    ),
    // --on-accent is only ever read on top of --accent, so that is the pairing
    // worth stating rather than its contrast against the night.
    onAccentOnAccent: ratio(night, accent),
  };
});

console.log('accent roles:', JSON.stringify(roles, null, 2));

// --- where each accent role is actually used ------------------------------
const usage = await page.evaluate(() => {
  const counts = {};
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    const walk = (list) => {
      for (const rule of list) {
        if (rule.cssRules) walk(rule.cssRules);
        if (!rule.style) continue;
        for (const prop of ['color', 'background-color', 'border-color']) {
          const v = rule.style.getPropertyValue(prop);
          if (v && v.includes('var(')) {
            const m = v.match(/var\(\s*(--[\w-]+)/g);
            (m ?? []).forEach((x) => {
              const name = x.match(/--[\w-]+/)[0];
              if (/accent|bone|ember|acid/.test(name)) {
                const key = `${name} -> ${prop}`;
                counts[key] = (counts[key] ?? 0) + 1;
              }
            });
          }
        }
      }
    };
    walk(rules);
  }
  const stale = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    const walk = (list) => {
      for (const rule of list) {
        if (rule.cssRules) walk(rule.cssRules);
        if (rule.cssText && /ember|acid/i.test(rule.cssText)) stale.push(rule.cssText.slice(0, 120));
      }
    };
    walk(rules);
  }
  return { counts, stale };
});
console.log('accent usage:', JSON.stringify(usage, null, 2));

await browser.close();
