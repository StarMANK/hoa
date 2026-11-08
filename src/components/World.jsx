import { Fragment } from 'react';
import { marqueeWords, marqueeWordsAlt } from '../data/content.js';
import { RoamLayer } from './Apes.jsx';

// Deterministic noise: the canopy must not reshuffle on every render, or the
// world jitters and screenshots stop being comparable.
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A compound frond: a curved stem with leaflets on both sides shrinking toward
// the tip. Drawn as one filled path so it stays a flat silhouette.
function frond(x, y, len, angleDeg, seed, leaflets = 9) {
  const rand = prng(seed);
  const a = (angleDeg * Math.PI) / 180;
  const cx = x + Math.sin(a) * len * 0.5 + Math.cos(a) * len * 0.18;
  const cy = y + Math.cos(a) * len * 0.5 - Math.sin(a) * len * 0.18;
  const tx = x + Math.sin(a) * len;
  const ty = y + Math.cos(a) * len;
  const parts = [];

  for (let i = 0; i < leaflets; i += 1) {
    const t = 0.08 + (i / leaflets) * 0.9;
    // Point on the quadratic stem.
    const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * cx + t * t * tx;
    const py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * cy + t * t * ty;
    const size = len * (0.3 - (i / leaflets) * 0.22) * (0.75 + rand() * 0.5);
    for (const side of [-1, 1]) {
      const spread = a + side * (1.05 - (i / leaflets) * 0.5);
      const lx = px + Math.sin(spread) * size;
      const ly = py + Math.cos(spread) * size;
      const bx = px + Math.sin(spread + side * 0.55) * size * 0.45;
      const by = py + Math.cos(spread + side * 0.55) * size * 0.45;
      parts.push(`M${px} ${py}Q${bx} ${by} ${lx} ${ly}Q${px + Math.sin(spread - side * 0.4) * size * 0.3} ${py + Math.cos(spread - side * 0.4) * size * 0.3} ${px} ${py}Z`);
    }
  }

  // Stem last so it welds the leaflets into one mass.
  const stem = `M${x} ${y}Q${cx} ${cy} ${tx} ${ty}Q${cx - 3} ${cy + 3} ${x} ${y + 2}Z`;
  return `${parts.join(' ')} ${stem}`;
}

// A jagged crown line. One smooth curve per crown read as giant black petals, so
// the horizon is instead sampled as a polyline: a slow low-frequency profile for
// the mass of the trees, high-frequency jitter for twigs and broken tops, and
// occasional sharp spikes where a tree or palm punches above the line.
function crown(w, h, seed, points) {
  const rand = prng(seed);
  const phA = rand() * Math.PI * 2;
  const phB = rand() * Math.PI * 2;
  const spikes = new Map();
  const spikeCount = Math.max(3, Math.round(w / 260));
  for (let s = 0; s < spikeCount; s += 1) {
    spikes.set(Math.round(rand() * points), 0.22 + rand() * 0.3);
  }

  const pts = [];
  for (let i = 0; i <= points; i += 1) {
    const t = i / points;
    const slow =
      Math.sin(t * Math.PI * 2 * 1.7 + phA) * 0.16 +
      Math.sin(t * Math.PI * 2 * 3.3 + phB) * 0.09;
    const jitter = (rand() - 0.5) * 0.14;
    let rise = 0.34 + slow + jitter;
    // A spike lifts the two neighbours too, so it reads as a pointed top rather
    // than a lone tooth.
    for (const offset of [-1, 0, 1]) {
      const sp = spikes.get(i + offset);
      if (sp) rise += sp * (offset === 0 ? 1 : 0.45);
    }
    pts.push([t * w, h - Math.min(0.98, Math.max(0.08, rise)) * h]);
  }
  return pts;
}

// A treeline horizon: solid ground under a jagged crown, bare trunks poking
// through, and a rake of grass along the base line so nothing looks cut out.
function treeLine({ w, h, seed, points = 90, trunkCount, spikes = 6 }) {
  const rand = prng(seed);
  const pts = crown(w, h, seed, points);
  let d = `M0 ${h} L${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')} L${w} ${h} Z`;

  const trunks = Array.from({ length: trunkCount }, () => {
    const x = w * (0.05 + rand() * 0.9);
    const tw = 2.5 + rand() * 4;
    const top = h * (0.15 + rand() * 0.4);
    return `M${x - tw} ${h} L${x - tw * 0.5} ${top} Q${x} ${top - 5} ${x + tw * 0.5} ${top} L${x + tw} ${h} Z`;
  });

  const grass = Array.from({ length: spikes * 6 }, () => {
    const x = w * rand();
    const bh = h * (0.06 + rand() * 0.16);
    const bend = (rand() - 0.5) * 14;
    return `M${x.toFixed(1)} ${h}Q${(x + bend * 0.5).toFixed(1)} ${(h - bh * 0.6).toFixed(1)} ${(x + bend).toFixed(1)} ${(h - bh).toFixed(1)}Q${(x + bend * 0.3).toFixed(1)} ${(h - bh * 0.5).toFixed(1)} ${(x + 2.5).toFixed(1)} ${h}Z`;
  });

  return `${d} ${trunks.join(' ')} ${grass.join(' ')}`;
}

// Canopy overhead: the same jagged crown flipped, so the top mass hangs into
// frame with pointed frond tips, plus a few long fronds dropping out of it.
function topCanopy({ w, h, seed, points = 70, frondCount }) {
  const rand = prng(seed);
  const pts = crown(w, h, seed, points)
    .map(([x, y]) => `${x.toFixed(1)} ${(h - y).toFixed(1)}`)
    .reverse();
  const d = `M0 0 L${w} 0 L${pts.join(' L')} Z`;

  const fronds = Array.from({ length: frondCount }, (_, i) => {
    const x = w * ((i + 0.2 + rand() * 0.6) / frondCount);
    const len = h * (0.5 + rand() * 0.7);
    return frond(x, h * (0.08 + rand() * 0.2), len, (rand() - 0.5) * 90, seed + i * 17);
  });

  return `${d} ${fronds.join(' ')}`;
}

// Ground fern: a jagged mound with upright fronds and grass blades.
function groundFern({ w, h, seed, points = 90, frondCount }) {
  const rand = prng(seed);
  const pts = crown(w, h, seed + 5, points);
  let d = `M0 ${h} L${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')} L${w} ${h} Z`;

  const fronds = Array.from({ length: frondCount }, (_, i) => {
    const x = w * ((i + 0.15 + rand() * 0.7) / frondCount);
    const len = h * (0.7 + rand() * 0.75);
    return frond(x, h * (0.55 + rand() * 0.35), len, (rand() - 0.5) * 70, seed + i * 31);
  });

  const grass = Array.from({ length: 42 }, () => {
    const x = w * rand();
    const bh = h * (0.2 + rand() * 0.55);
    const bend = (rand() - 0.5) * 26;
    return `M${x} ${h}Q${x + bend * 0.5} ${h - bh * 0.6} ${x + bend} ${h - bh}Q${x + bend * 0.4} ${h - bh * 0.55} ${x + 3} ${h}Z`;
  });

  return `${d} ${fronds.join(' ')} ${grass.join(' ')}`;
}

// Depth bands, back to front. Heights are viewport-relative so the foliage
// frames the page instead of eating it, and contrast falls off with distance.
const layers = [
  { key: 'far-tree', cls: 'far', edge: 'bottom', z: -5, vh: 16, w: 1600, h: 220, kind: 'tree', seed: 11, points: 110, trunks: 5, spikes: 6, opacity: 0.55 },
  { key: 'mid-tree', cls: 'mid', edge: 'bottom', z: -4, vh: 23, w: 1300, h: 260, kind: 'tree', seed: 37, points: 80, trunks: 7, spikes: 5, opacity: 0.8 },
  { key: 'top-canopy', cls: 'mid', edge: 'top', z: -4, vh: 24, w: 1400, h: 300, kind: 'top', seed: 23, points: 90, fronds: 9, opacity: 0.85 },
  { key: 'near-canopy', cls: 'near', edge: 'top', z: 1, vh: 15, w: 1100, h: 240, kind: 'top', seed: 67, points: 60, fronds: 6, opacity: 1 },
  { key: 'front-fern', cls: 'front', edge: 'bottom', z: 1, vh: 17, w: 1100, h: 260, kind: 'fern', seed: 83, points: 100, fronds: 7, opacity: 1 },
];

function layerPath(l) {
  if (l.kind === 'tree') return treeLine({ w: l.w, h: l.h, seed: l.seed, points: l.points, trunkCount: l.trunks, spikes: l.spikes });
  if (l.kind === 'fern') return groundFern({ w: l.w, h: l.h, seed: l.seed, points: l.points, frondCount: l.fronds });
  return topCanopy({ w: l.w, h: l.h, seed: l.seed, points: l.points, frondCount: l.fronds });
}

function Band({ layer }) {
  return (
    <svg
      className={`canopy__band canopy__band--${layer.edge}`}
      style={{ height: `${layer.vh}vh`, opacity: layer.opacity }}
      viewBox={`0 0 ${layer.w} ${layer.h}`}
      preserveAspectRatio={layer.edge === 'bottom' ? 'xMidYMax slice' : 'xMidYMin slice'}
    >
      <path fill="currentColor" d={layerPath(layer)} />
    </svg>
  );
}

// The world is a jungle at night: foliage in depth bands, apes walking through
// it, fog and grain over the lot. Nothing here is a section.
export function WorldLayers() {
  const inWorld = layers.filter((l) => l.z < 2);

  return (
    <>
      <div className="world-sky" aria-hidden="true">
        <div className="world-stars" />
      </div>

      {['far', 'mid', 'near', 'front'].map((depth) => {
        const group = inWorld.filter((l) => l.cls === depth);
        if (!group.length) return null;
        return (
          <div className={`canopy canopy--${depth}`} key={depth} aria-hidden="true">
            {group.map((l) => (
              <Band key={l.key} layer={l} />
            ))}
          </div>
        );
      })}

      <RoamLayer />

      <div className="world-fog" aria-hidden="true" />
      <div className="world-grain" aria-hidden="true" />
      <div className="world-sweep" aria-hidden="true" />
    </>
  );
}

// One large frond hanging in from the top-left corner, above the content, so
// the page reads as being watched from behind the leaves. Kept to a single
// shape: anything more covered the copy.
export function ForegroundFronds() {
  return (
    <div className="frond-frame" aria-hidden="true">
      <svg viewBox="0 0 400 400" preserveAspectRatio="xMinYMin meet" className="frond-frame__svg">
        <path fill="currentColor" d={frond(40, -30, 300, 62, 97, 12)} />
      </svg>
    </div>
  );
}

export function ScrollMeter() {
  return (
    <div className="scroll-meter" aria-hidden="true">
      <div className="scroll-meter__fill" />
    </div>
  );
}

function MarqueeRow({ words, variant }) {
  const run = [...words, ...words, ...words, ...words];
  return (
    <div className={`seam__row seam__row--${variant}`} aria-hidden="true">
      {run.map((word, index) => (
        <span key={`${variant}-${word}-${index}`}>{word} /</span>
      ))}
    </div>
  );
}

export function Seam() {
  return (
    <div className="seam" aria-hidden="true">
      <MarqueeRow words={marqueeWords} variant="a" />
      <MarqueeRow words={marqueeWordsAlt} variant="b" />
    </div>
  );
}

// Kinetic type: letters rise out of their own baseline, second line arrives
// as a carved outline so the two lines never share an entry.
// Letters are split for animation, so the real words go on aria-label to keep
// the heading readable for assistive tech.
export function KineticTitle({ lines, className = '', ...rest }) {
  let counter = 0;
  return (
    <h1 className={`display hero__title ${className}`} aria-label={lines.join(' ')} {...rest}>
      {lines.map((line, lineIndex) => (
        <span
          className={`word${lineIndex === 1 ? ' word--outline' : ''}`}
          key={line}
          aria-hidden="true"
        >
          {line.split('').map((char, charIndex) => {
            counter += 1;
            if (char === ' ') {
              return (
                <span className="char" key={`${line}-${charIndex}`} style={{ '--i': counter }}>
                  {'\u00a0'}
                </span>
              );
            }
            return (
              <span className="char" key={`${line}-${charIndex}`} style={{ '--i': counter }}>
                {char}
              </span>
            );
          })}
        </span>
      ))}
    </h1>
  );
}

export function HollowWords({ text, hollowWords = [] }) {
  return (
    <>
      {text.split(' ').map((word, index) => (
        <Fragment key={`${word}-${index}`}>
          {hollowWords.includes(word) ? (
            <span className="word--hollow">{word}</span>
          ) : (
            word
          )}
          {index < text.split(' ').length - 1 ? ' ' : ''}
        </Fragment>
      ))}
    </>
  );
}
