// Regenerate public/favicon.png and public/apple-touch-icon.png from the real
// logo. The tab icon used to be an abstract ape drawn before hoa_logo.png
// existed; the honest answer was to use the logo itself. The logo is a wide
// wordmark (procession + "Hall of the Apes"), so it cannot ship whole at 64px:
// the crop takes the walking procession on bars at the left edge, which reads
// at tab size without the wordmark, composited over --night so the transparent
// source pixels land on the page void instead of on browser chrome white.
//
// Deterministic by construction: no browser, no RNG, one decode path (the same
// manual PNG inflate + unfilter used by palette.mjs), one encode path. Running
// it twice must produce byte-identical files, and that check is the point of
// keeping it committed rather than regenerating icons by hand.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'hoa_logo.png');

// Crop: square, from the left edge, below the arc of the wordmark. Measured off
// the alpha channel: at y=100 the wordmark's lowest glyph pixels are still
// above the box and the lead walkers keep their full height (source is 1794x917).
const CROP_X = 0;
const CROP_Y = 100;
const CROP_SIZE = 817;

// --night from tokens.css, the page void the favicon should blend into.
const BG = [6, 8, 9];

const TARGETS = [
  ['public/favicon.png', 64],
  ['public/apple-touch-icon.png', 180],
];

function crc32(buf) {
  let t = crc32.table;
  if (!t) {
    t = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
  }
  let c = 0xffffffff;
  for (const b of buf) c = t[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function decodePng(file) {
  const buf = fs.readFileSync(file);
  let p = 8;
  let w = 0;
  let h = 0;
  let colorType = 0;
  let bitDepth = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    }
    p += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(`unsupported png: depth ${bitDepth} colortype ${colorType}`);
  }
  const bpp = colorType === 6 ? 4 : 3;
  const stride = w * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(h * stride);
  let off = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[off++];
    const line = raw.subarray(off, off + stride);
    off += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (f === 1) v = (v + a) & 255;
      else if (f === 2) v = (v + b) & 255;
      else if (f === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        v = (v + pr) & 255;
      }
      out[y * stride + x] = v;
    }
  }
  return { w, h, bpp, stride, px: out };
}

function encodePng(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const img = decodePng(SRC);
const alpha = (x, y) => (img.bpp === 4 ? img.px[y * img.stride + x * img.bpp + 3] : 255);

if (CROP_X + CROP_SIZE > img.w || CROP_Y + CROP_SIZE > img.h) {
  throw new Error(`crop ${CROP_SIZE}@${CROP_X},${CROP_Y} outside ${img.w}x${img.h}`);
}

let failed = false;
for (const [rel, size] of TARGETS) {
  const rgb = Buffer.alloc(size * size * 3);
  const scale = CROP_SIZE / size;
  let opaque = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const x0 = CROP_X + Math.floor(x * scale);
      const x1 = CROP_X + Math.min(CROP_SIZE, Math.floor((x + 1) * scale));
      const y0 = CROP_Y + Math.floor(y * scale);
      const y1 = CROP_Y + Math.min(CROP_SIZE, Math.floor((y + 1) * scale));
      let acc = 0;
      let cnt = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          acc += alpha(sx, sy);
          cnt++;
        }
      }
      const a = (cnt ? acc / cnt : 0) / 255;
      if (a > 0.5) opaque++;
      const i = (y * size + x) * 3;
      for (let ch = 0; ch < 3; ch++) {
        rgb[i + ch] = Math.round(255 * a + BG[ch] * (1 - a));
      }
    }
  }
  const file = path.join(root, rel);
  const next = encodePng(size, size, rgb);
  const prev = fs.existsSync(file) ? fs.readFileSync(file) : null;
  const idempotent = prev && prev.equals(next);
  if (!prev || !idempotent) fs.writeFileSync(file, next);
  const coverage = ((opaque / (size * size)) * 100).toFixed(1);
  console.log(
    `${rel}: ${size}px, ink coverage ${coverage}%, ` +
      (idempotent ? 'bytes already match' : prev ? 'rewritten (differs)' : 'created'),
  );
  // A favicon that shifts ink coverage by several points between runs is the
  // wrong crop arriving by accident. Band measured off this crop: 65.5% at 64px
  // (the bars are solid), 64.5% at 180px; 4 points of slack either side.
  const frac = opaque / (size * size);
  if (frac < 0.6 || frac > 0.7) {
    console.error(`${rel}: ink coverage ${(frac * 100).toFixed(1)}% outside 60-70%`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
