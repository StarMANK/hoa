// Skeleton-driven ape silhouettes. Reference: dist/assets/ape-inspo.jpeg - a
// procession of hunched bipeds, largest to smallest, some carrying a spear.
//
// Limbs are round-capped strokes, thick for the thigh/upper arm and thin for the
// shin/forearm, so the silhouette tapers instead of reading as sausages. The head
// is one filled skull path (dome -> brow -> muzzle -> jaw) placed with a
// transform so it only has to be tuned once. Everything shares one colour, so the
// union reads as a single solid cut-out.
//
// viewBox 0 0 130 130, ground at y=124, figure faces +x. DEBUG=1 adds joint dots.
import { chromium } from 'playwright-core';

const S = 'currentColor';
const DEBUG = process.env.DEBUG === '1';

// Ape skull in a 100-unit box facing +x, origin at the nape attachment.
const SKULL =
  'M-12 6C-10-6 0-16 18-19 38-22 58-15 69-3 75 4 78 8 77 13 76 18 71 18 68 15 66 22 59 27 49 29 38 31 26 31 15 29 3 27-8 20-12 6Z';

const skull = (x, y, s, rot) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s / 100})"><path d="${SKULL}"/></g>`;

const poses = {
  stride: {
    // Most upright marcher, at the head of the procession.
    spine: [[52, 78], [55, 56], [60, 36]],
    head: { x: 64, cy: 30, y: 26, s: 46, rot: 8 },
    legNear: { hip: [56, 80], knee: [72, 98], ankle: [74, 116], toe: [88, 120] },
    legFar: { hip: [48, 80], knee: [38, 100], ankle: [32, 114], toe: [20, 120] },
    armNear: { sh: [62, 40], elbow: [72, 58], wrist: [66, 74] },
    armFar: { sh: [56, 40], elbow: [48, 58], wrist: [52, 76] },
    trunkWidth: 30,
  },
  carry: {
    // Hunched marcher with a spear laid across the shoulder.
    spine: [[44, 84], [52, 62], [66, 46]],
    head: { x: 70, cy: 40, y: 38, s: 46, rot: 22 },
    spear: [[34, 10], [114, 56]],
    legNear: { hip: [50, 86], knee: [70, 102], ankle: [72, 116], toe: [86, 120] },
    legFar: { hip: [42, 86], knee: [32, 104], ankle: [28, 116], toe: [16, 120] },
    armNear: { sh: [68, 48], elbow: [84, 46], wrist: [98, 46] },
    armFar: { sh: [58, 52], elbow: [50, 68], wrist: [50, 84] },
    trunkWidth: 30,
  },
  hunch: {
    // Deep forward lean, arms hanging long past the shins.
    spine: [[40, 88], [52, 68], [72, 54]],
    head: { x: 78, cy: 50, y: 50, s: 44, rot: 40 },
    legNear: { hip: [46, 90], knee: [62, 106], ankle: [66, 118], toe: [78, 121] },
    legFar: { hip: [38, 90], knee: [30, 106], ankle: [26, 118], toe: [14, 121] },
    armNear: { sh: [74, 56], elbow: [84, 78], wrist: [80, 98] },
    armFar: { sh: [66, 60], elbow: [66, 84], wrist: [60, 102] },
    trunkWidth: 30,
  },
  forage: {
    // Low scavenger at the tail of the line, digging with a stick.
    spine: [[36, 92], [50, 80], [70, 74]],
    head: { x: 76, cy: 74, y: 74, s: 40, rot: 62 },
    stick: [[94, 98], [118, 92]],
    legNear: { hip: [42, 94], knee: [56, 108], ankle: [60, 118], toe: [72, 122] },
    legFar: { hip: [34, 94], knee: [28, 108], ankle: [24, 118], toe: [12, 122] },
    armNear: { sh: [72, 76], elbow: [84, 90], wrist: [94, 98] },
    armFar: { sh: [62, 78], elbow: [62, 96], wrist: [58, 112] },
    trunkWidth: 26,
  },
};

function seg(a, b, w) {
  return `<path d="M${a[0]} ${a[1]} L${b[0]} ${b[1]}" stroke-width="${w}" stroke-linecap="round" stroke="${S}"/>`;
}

function leg(c, far = false) {
  const thigh = far ? 19 : 21;
  const shin = far ? 12 : 13.5;
  return (
    seg(c.hip, c.knee, thigh) +
    seg(c.knee, c.ankle, shin) +
    `<ellipse cx="${(c.ankle[0] + c.toe[0]) / 2}" cy="${c.toe[1] - 3}" rx="${Math.abs(c.toe[0] - c.ankle[0]) / 2 + 4}" ry="${far ? 4 : 4.5}"/>`
  );
}

function arm(c, far = false) {
  const upper = far ? 13 : 15;
  const fore = far ? 8.5 : 10;
  return (
    seg(c.sh, c.elbow, upper) +
    seg(c.elbow, c.wrist, fore) +
    `<circle cx="${c.wrist[0]}" cy="${c.wrist[1]}" r="${far ? 5 : 6}"/>`
  );
}

function ape(p) {
  const parts = [];
  if (p.spear)
    parts.push(
      `<line x1="${p.spear[0][0]}" y1="${p.spear[0][1]}" x2="${p.spear[1][0]}" y2="${p.spear[1][1]}" stroke="${S}" stroke-width="3.5" stroke-linecap="round"/>`,
    );
  if (p.stick)
    parts.push(
      `<line x1="${p.stick[0][0]}" y1="${p.stick[0][1]}" x2="${p.stick[1][0]}" y2="${p.stick[1][1]}" stroke="${S}" stroke-width="3.5" stroke-linecap="round"/>`,
    );

  const trunk =
    `<path d="M${p.spine.map((q) => `${q[0]} ${q[1]}`).join(' L')}" stroke-width="${p.trunkWidth}" stroke-linecap="round" stroke-linejoin="round" stroke="${S}"/>` +
    `<circle cx="${p.spine[0][0]}" cy="${p.spine[0][1]}" r="${p.trunkWidth / 2 - 1}"/>` +
    `<circle cx="${p.spine[2][0]}" cy="${p.spine[2][1]}" r="${p.trunkWidth / 2 + 3}"/>`;

  // One colour everywhere: far limbs are drawn first so near limbs overlap them.
  parts.push(
    `<g fill="${S}">` +
      arm(p.armFar, true) +
      leg(p.legFar, true) +
      trunk +
      skull(p.head.x, p.head.cy, p.head.s, p.head.rot) +
      leg(p.legNear) +
      arm(p.armNear) +
      `</g>`,
  );

  if (DEBUG) {
    const pts = [
      ...p.spine,
      [p.head.x, p.head.cy],
      ...Object.values(p.legNear).filter(Array.isArray),
      ...Object.values(p.legFar).filter(Array.isArray),
      ...Object.values(p.armNear).filter(Array.isArray),
      ...Object.values(p.armFar).filter(Array.isArray),
    ];
    parts.push(
      `<g fill="none" stroke="#ff2d55" stroke-width="1">` +
        pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.5"/>`).join('') +
        `</g>`,
    );
  }
  return parts.join('');
}

const sizes = [{ s: 120 }, { s: 240 }, { s: 360 }];

const rows = Object.entries(poses)
  .map(
    ([name, pose]) => `<div class="row">
  ${sizes
    .map(
      ({ s }) => `<div class="cell" style="width:${Math.round(s * 1.05)}px;height:${s}px">
    <svg viewBox="0 0 130 126" width="${Math.round(s * 1.03)}" height="${s}" style="position:absolute;bottom:1px;left:0">${ape(pose)}</svg>
  </div>`,
    )
    .join('\n')}
  <span class="tag">${name}</span>
</div>`,
  )
  .join('\n');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#0b0d0c}
  .row{display:flex;align-items:flex-end;gap:30px;padding:24px 40px 32px;position:relative;border-bottom:1px solid #1a1d1b}
  .cell{position:relative}
  .cell::after{content:'';position:absolute;left:-10px;right:-10px;bottom:0;border-top:1px dashed #3a413d}
  svg{display:block;color:#fcfcfc;overflow:visible}
  .tag{position:absolute;top:8px;left:40px;font:600 13px ui-monospace,monospace;color:#6f7a74;letter-spacing:.1em}
</style></head><body>${rows}</body></html>`;

const b = await chromium.launch({
  executablePath: '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const c = await b.newContext({ viewport: { width: 1500, height: 1560 }, deviceScaleFactor: 2 });
const p = await c.newPage();
await p.setContent(html);
await p.waitForTimeout(300);
await p.screenshot({ path: DEBUG ? 'shots/ape-skel.png' : 'shots/ape-shape.png' });
console.log('saved', DEBUG ? 'shots/ape-skel.png' : 'shots/ape-shape.png');
await b.close();
