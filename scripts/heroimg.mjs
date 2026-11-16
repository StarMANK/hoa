// Regenerate src/assets/hero-logo.png from the full-size hoa_logo.png. The
// hero plates render the wordmark at max ~311 CSS px wide (72% of a 432px
// plate at 1440px, the widest it ever gets), so 2x Retina asks for ~622px.
// Shipping the 1794px source costs 304 KB to paint a 311px mark; 672px is the
// smallest width that stays sharp at 2x on the widest plate.
//
// Same contract as favicon.mjs: deterministic by construction, no browser, no
// RNG, one decode path (the manual PNG inflate + unfilter used there), running
// it twice produces byte-identical output. Alpha is averaged premultiplied so
// thin white strokes keep their edges instead of fringing toward black.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'hoa_logo.png');
const OUT = path.join(root, 'src/assets/hero-logo.png');
const OUT_W = 672;

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

function encodePngRgba(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
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
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const img = decodePng(SRC);
const OUT_H = Math.round((img.h * OUT_W) / img.w);
const scale = img.w / OUT_W;
const out = Buffer.alloc(OUT_W * OUT_H * 4);

for (let y = 0; y < OUT_H; y++) {
  const y0 = Math.floor(y * scale);
  const y1 = Math.min(img.h, Math.floor((y + 1) * scale));
  for (let x = 0; x < OUT_W; x++) {
    const x0 = Math.floor(x * scale);
    const x1 = Math.min(img.w, Math.floor((x + 1) * scale));
    let aAcc = 0;
    let rAcc = 0;
    let gAcc = 0;
    let bAcc = 0;
    let cnt = 0;
    for (let sy = y0; sy < y1; sy++) {
      for (let sx = x0; sx < x1; sx++) {
        const i = sy * img.stride + sx * img.bpp;
        const a = img.bpp === 4 ? img.px[i + 3] : 255;
        aAcc += a;
        // Premultiply: a transparent black neighbour must not drag the average
        // of a visible pixel toward black.
        rAcc += img.px[i] * a;
        gAcc += img.px[i + 1] * a;
        bAcc += img.px[i + 2] * a;
        cnt++;
      }
    }
    const a = cnt ? aAcc / cnt : 0;
    const o = (y * OUT_W + x) * 4;
    out[o + 3] = Math.round(a);
    out[o] = a > 0 ? Math.round(rAcc / aAcc) : 0;
    out[o + 1] = a > 0 ? Math.round(gAcc / aAcc) : 0;
    out[o + 2] = a > 0 ? Math.round(bAcc / aAcc) : 0;
  }
}

const next = encodePngRgba(OUT_W, OUT_H, out);
const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT) : null;
const idempotent = prev && prev.equals(next);
if (!prev || !idempotent) fs.mkdirSync(path.dirname(OUT), { recursive: true }), fs.writeFileSync(OUT, next);
console.log(
  `${path.relative(root, OUT)}: ${OUT_W}x${OUT_H}, ${next.length} bytes from ${fs.statSync(SRC).size}, ` +
    (idempotent ? 'bytes already match' : prev ? 'rewritten (differs)' : 'created'),
);
