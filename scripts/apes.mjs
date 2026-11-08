// Validate the ape silhouettes as rendered pixels, not as source data.
//
// The pose data is joints and strokes, so the things that can silently go wrong
// are invisible in review: a limb poking outside the viewBox and getting clipped,
// a hole where the union of limbs and skull fails to close, one pose being
// another pose nudged a few units, or the feet of the four poses not sharing a
// ground line so a procession looks like it is standing on steps.
import { chromium } from 'playwright-core';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

// The hero procession walks stride, carry, hunch, stride, forage, so it already
// contains one of every pose in a known order.
const result = await page.evaluate(async () => {
  const SCALE = 6;
  const nodes = [...document.querySelectorAll('.procession__walker .ape')];
  const poseNames = ['stride', 'carry', 'hunch', 'stride', 'forage'];

  const rasterize = async (node) => {
    const clone = node.cloneNode(true);
    clone.removeAttribute('class');
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', 130 * SCALE);
    clone.setAttribute('height', 126 * SCALE);
    const url = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(clone.outerHTML)))}`;
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 130 * SCALE;
    c.height = 126 * SCALE;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, c.width, c.height);
  };

  const mask = (data) => {
    const m = new Uint8Array(data.width * data.height);
    for (let i = 3; i < data.data.length; i += 4) m[i >> 2] = data.data[i] > 10 ? 1 : 0;
    return m;
  };

  const outline = (m) => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let area = 0;
    for (let y = 0; y < 126 * SCALE; y += 1) {
      for (let x = 0; x < 130 * SCALE; x += 1) {
        if (!m[y * 130 * SCALE + x]) continue;
        area += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    return {
      box: [minX / SCALE, minY / SCALE, (maxX + 1) / SCALE, (maxY + 1) / SCALE].map((v) => +v.toFixed(2)),
      area,
      touching: [minX <= 0, minY <= 0, maxX >= 130 * SCALE - 1, maxY >= 126 * SCALE - 1],
    };
  };

  // Flood fill the empty space from the border; any empty pixel the fill never
  // reaches is a hole sealed inside what should be one solid cut-out.
  const holes = (m) => {
    const W = 130 * SCALE;
    const H = 126 * SCALE;
    const seen = new Uint8Array(W * H);
    const stack = [];
    for (let x = 0; x < W; x += 1) stack.push(x, (H - 1) * W + x);
    for (let y = 0; y < H; y += 1) stack.push(y * W, y * W + W - 1);
    while (stack.length) {
      const i = stack.pop();
      if (seen[i] || m[i]) continue;
      seen[i] = 1;
      const x = i % W;
      if (x > 0) stack.push(i - 1);
      if (x < W - 1) stack.push(i + 1);
      if (i >= W) stack.push(i - W);
      if (i < W * (H - 1)) stack.push(i + W);
    }
    let trapped = 0;
    let hx0 = Infinity;
    let hy0 = Infinity;
    let hx1 = -Infinity;
    let hy1 = -Infinity;
    for (let i = 0; i < m.length; i += 1) {
      if (m[i] || seen[i]) continue;
      trapped += 1;
      const x = i % W;
      const y = (i - x) / W;
      hx0 = Math.min(hx0, x);
      hy0 = Math.min(hy0, y);
      hx1 = Math.max(hx1, x);
      hy1 = Math.max(hy1, y);
    }
    return trapped
      ? {
          px: trapped,
          box: [hx0 / SCALE, hy0 / SCALE, (hx1 + 1) / SCALE, (hy1 + 1) / SCALE].map((v) => +v.toFixed(1)),
        }
      : { px: 0, box: null };
  };

  const masks = [];
  const perPose = {};
  for (let i = 0; i < nodes.length; i += 1) {
    const name = poseNames[i];
    if (perPose[name]) continue;
    const id = await rasterize(nodes[i]);
    const m = mask(id);
    const o = outline(m);
    // Lowest opaque row, in viewBox units: all poses must share one ground line
    // or a procession looks like it is standing on steps.
    perPose[name] = {
      box: o.box,
      fillRatio: +(o.area / (130 * SCALE * 126 * SCALE)).toFixed(3),
      clippedAtEdge: o.touching.some(Boolean),
      holesPx: holes(m),
      baseline: +o.box[3].toFixed(2),
    };
    masks.push({ name, m });
  }

  const distinct = [];
  for (let i = 0; i < masks.length; i += 1) {
    for (let j = i + 1; j < masks.length; j += 1) {
      const a = masks[i];
      const b = masks[j];
      if (a.name === b.name) continue;
      let diff = 0;
      let union = 0;
      for (let k = 0; k < a.m.length; k += 1) {
        if (a.m[k] || b.m[k]) union += 1;
        if (a.m[k] !== b.m[k]) diff += 1;
      }
      distinct.push({
        pair: `${a.name} vs ${b.name}`,
        differentOfUnion: +((diff / union) * 100).toFixed(1),
      });
    }
  }

  return { perPose, distinct, count: nodes.length };
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
