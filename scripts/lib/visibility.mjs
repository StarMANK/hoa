// Effective opacity, evaluated inside the page. A walker's own opacity is only
// ever one factor: the roam layer, the .procession container and any ancestor
// animation multiply into it, and one ancestor at 0 erases everything below
// regardless of its own value. Reading getComputedStyle(node).opacity alone
// reported 8 visible apes on a phone where 3 were display:none and the rest sat
// at an effective 0.21, so the number was confidently wrong twice over.
//
// mask-image is the third factor and it is not in the opacity chain at all. The
// procession dissolves its ends with a horizontal gradient mask, which is why the
// tail apes looked black in the screenshot while every probe swore they sat at
// 0.88. So each ancestor's mask is evaluated at the point the element occupies
// and multiplied in too.
//
// Usage: pass this straight to page.evaluate, with the selector as its argument.
// Playwright serialises the function itself, so it must stay standalone: no
// closure over anything from node, and no helpers defined outside it.
export const effectiveOpacityProbe = (selector) => {
  const VISIBLE = 0.05;
  const vh = window.innerHeight;

  // --- gradient mask sampling -------------------------------------------
  // Masks are alpha, so only the colour's alpha matters. Splitting on commas at
  // the top level, because rgba() and stops carry commas of their own.
  const splitTop = (s) => {
    const out = [];
    let depth = 0;
    let cur = '';
    for (const ch of s) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) {
        out.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  };

  const alphaOf = (color) => {
    const c = color.trim().toLowerCase();
    if (c === 'transparent') return 0;
    let m = /^rgba?\(([^)]+)\)$/.exec(c);
    if (m) {
      const parts = m[1].split(/[\s,/]+/).filter(Boolean);
      return parts.length > 3 ? Number(parts[3]) : 1;
    }
    m = /^#([0-9a-f]{3,8})$/.exec(c);
    if (m) return m[1].length === 8 ? parseInt(m[1].slice(6), 16) / 255 : 1;
    return 1;
  };

  const toPx = (tok, base) => {
    const m = /^(-?[\d.]+)(%|px|rem|vw|vh)$/.exec(tok);
    if (!m) return null;
    const n = Number(m[1]);
    if (m[2] === '%') return (n / 100) * base;
    if (m[2] === 'rem') return n * 16;
    if (m[2] === 'vw') return (n / 100) * window.innerWidth;
    if (m[2] === 'vh') return (n / 100) * vh;
    return n;
  };

  // Axis of the gradient, as a fraction along which stops run. Only angles and
  // the four straight keywords resolve exactly; anything diagonal-keyworded or
  // non-gradient is reported as unhandled so a caller cannot mistake a guess for
  // a measurement.
  const maskAxis = (angle) => {
    const deg = { 'to top': 0, 'to right': 90, 'to bottom': 180, 'to left': 270 };
    let a = deg[angle];
    if (a === undefined) {
      const m = /^(-?[\d.]+)deg$/.exec(angle);
      if (!m) return null;
      a = Number(m[1]);
    }
    return ((a % 360) + 360) % 360;
  };

  const sampleMask = (image, box, px, py) => {
    const layers = [];
    let depth = 0;
    let cur = '';
    for (const ch of image) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) {
        layers.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    if (cur.trim()) layers.push(cur.trim());
    // Multiple mask layers composite, but this page uses one. Anything else is
    // left unhandled rather than silently multiplied wrong.
    if (layers.length !== 1 || !/^linear-gradient\(/.test(layers[0])) return { alpha: null };

    const inner = layers[0].slice('linear-gradient('.length, layers[0].lastIndexOf(')'));
    let parts = splitTop(inner);
    let deg = 90;
    if (parts.length > 1) {
      const axis = maskAxis(parts[0]);
      if (axis === null) return { alpha: null };
      deg = axis;
      parts = parts.slice(1);
    }

    const rad = (deg * Math.PI) / 180;
    const sx = Math.sin(rad);
    const sy = -Math.cos(rad);
    const len = Math.abs(box.w * sx) + Math.abs(box.h * sy);
    if (len <= 0) return { alpha: null };
    const frac = (px - box.x - box.w / 2) * sx + (py - box.y - box.h / 2) * sy;
    const alongPx = len / 2 + frac;

    const base = box.h * Math.abs(sy) + box.w * Math.abs(sx);
    const stops = [];
    let lastPos = 0;
    let hasAuto = false;
    parts.forEach((stop, i) => {
      const m = /^(.+?)\s+(-?[\d.]+(?:%|px|rem|vw|vh))$/.exec(stop.trim());
      const color = m ? m[1] : stop.trim();
      if (m) {
        const pos = toPx(m[2], base);
        if (pos === null) hasAuto = true;
        else {
          stops.push({ pos, a: alphaOf(color) });
          lastPos = pos;
        }
      } else {
        hasAuto = true;
        stops.push({ pos: null, a: alphaOf(color) });
      }
      if (!m && parts.length > 1) {
        // Implicit position: evenly spaced from the previous definite one.
        stops[stops.length - 1].autoAt = (i / (parts.length - 1)) * base;
      }
    });
    for (const s of stops) if (s.pos === null) s.pos = s.autoAt ?? lastPos;

    const at = (p) => {
      if (p <= stops[0].pos) return stops[0].a;
      const last = stops[stops.length - 1];
      if (p >= last.pos) return last.a;
      for (let i = 1; i < stops.length; i++) {
        if (p <= stops[i].pos) {
          const a = stops[i - 1];
          const b = stops[i];
          const t = b.pos === a.pos ? 0 : (p - a.pos) / (b.pos - a.pos);
          return a.a + t * (b.a - a.a);
        }
      }
      return last.a;
    };

    return { alpha: Math.max(0, Math.min(1, at(alongPx))), approximate: hasAuto };
  };

  const rows = [];
  for (const host of document.querySelectorAll(selector)) {
    const cs = getComputedStyle(host);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = host.getBoundingClientRect();
    let eff = 1;
    let culledBy = null;
    let maskedBy = null;
    let maskApprox = false;
    for (let p = host; p && p.nodeType === 1; p = p.parentElement) {
      const pcs = getComputedStyle(p);
      const o = Number(pcs.opacity);
      if (o === 0 && !culledBy) {
        culledBy =
          p.className && typeof p.className === 'string'
            ? p.className.split(' ')[0]
            : p.tagName.toLowerCase();
      }
      eff *= o;

      const img = pcs.maskImage ?? pcs.webkitMaskImage;
      if (img && img !== 'none') {
        const pb = p.getBoundingClientRect();
        // Sample at the element's centre; the mask only varies slowly and the
        // centre is the best single number for "can this ape be seen".
        const s = sampleMask(img, { x: pb.left, y: pb.top, w: pb.width, h: pb.height }, r.left + r.width / 2, r.top + r.height / 2);
        if (s.alpha === null) {
          maskApprox = true;
        } else {
          eff *= s.alpha;
          maskedBy =
            p.className && typeof p.className === 'string'
              ? p.className.split(' ')[0]
              : p.tagName.toLowerCase();
          if (s.approximate) maskApprox = true;
        }
      }
    }
    rows.push({
      kind: String(host.className).split(' ')[0],
      eff: +eff.toFixed(3),
      own: +cs.opacity,
      culledBy,
      maskedBy,
      approximate: maskApprox,
      w: Math.round(r.width),
      h: Math.round(r.height),
      y: Math.round(r.y),
      onScreen: r.bottom > 0 && r.top < vh && r.width > 0,
    });
  }
  const world = document.querySelector('.world');
  return {
    // --scroll-progress is what gates the roam layer, so any read of walker
    // visibility is meaningless without it.
    progress: world ? getComputedStyle(world).getPropertyValue('--scroll-progress').trim() : null,
    rows,
    visible: rows.filter((x) => x.onScreen && x.eff >= VISIBLE),
    // What is in the DOM but cannot be seen, and which ancestor erased it.
    culled: [...new Set(rows.filter((x) => x.eff < VISIBLE).map((x) => x.culledBy ?? `own ${x.own}`))],
  };
};
