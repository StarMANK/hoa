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

// A treeline: solid ground with a crown line of overlapping arcs on top, plus a
// few bare trunks poking through. Reads as "jungle edge" at any scale.
function treeLine({ w, h, seed, crowns, trunkCount }) {
  const rand = prng(seed);
  const step = w / crowns;
  let d = `M0 ${h}`;
  for (let i = 0; i < crowns; i += 1) {
    const x0 = i * step;
    const x1 = x0 + step;
    const peak = h - (0.35 + rand() * 0.65) * h;
    d += ` Q${x0 + step * 0.25} ${peak} ${x0 + step * 0.55} ${peak + h * 0.06}`;
    d += ` Q${x1 - step * 0.18} ${h * (0.1 + rand() * 0.2)} ${x1} ${h - rand() * h * 0.18}`;
  }
  d += ` L${w} ${h} Z`;

  const trunks = Array.from({ length: trunkCount }, (_, i) => {
    const x = w * (0.06 + rand() * 0.88);
    const tw = 3 + rand() * 5;
    const top = h * (0.18 + rand() * 0.4);
    return `M${x - tw} ${h} L${x - tw * 0.6} ${top} Q${x} ${top - 6} ${x + tw * 0.6} ${top} L${x + tw} ${h} Z`;
  });

  return `${d} ${trunks.join(' ')}`;
}

// A hanging leaf: two mirrored curves meeting at a tip.
function leaf(x, y, len, girth, lean) {
  const tx = x + lean;
  const ty = y + len;
  return (
    `M${x} ${y}` +
    `C${x - girth} ${y + len * 0.3} ${x - girth * 0.7} ${y + len * 0.75} ${tx} ${ty}` +
    `C${x + girth * 0.9} ${y + len * 0.7} ${x + girth} ${y + len * 0.3} ${x} ${y}Z`
  );
}

// Canopy overhead: solid band across the top with fronds hanging into frame.
function canopyBand({ w, h, seed, fronds }) {
  const rand = prng(seed);
  let d = `M0 0 L${w} 0 L${w} ${h * (0.18 + rand() * 0.1)} Z`;
  const leaves = Array.from({ length: fronds }, (_, i) => {
    const x = (i / fronds) * w + rand() * (w / fronds) * 0.7;
    const len = h * (0.3 + rand() * 0.68);
    const girth = len * (0.14 + rand() * 0.16);
    const lean = (rand() - 0.5) * len * 0.7;
    return leaf(x, h * (0.02 + rand() * 0.16), len, girth, lean);
  });
  return `${d} ${leaves.join(' ')}`;
}

const layers = [
  // The far treeline is a wide low band; near foliage is a tall narrow band so
  // the same element type gives both horizon and framing.
  { name: 'far', kind: 'tree', w: 1600, h: 200, seed: 11, crowns: 26, trunks: 5, pos: 'bottom', opacity: 0.5 },
  { name: 'far', kind: 'canopy', w: 1600, h: 150, seed: 23, fronds: 22, pos: 'top', opacity: 0.45 },
  { name: 'mid', kind: 'tree', w: 1400, h: 300, seed: 37, crowns: 18, trunks: 8, pos: 'bottom', opacity: 0.78 },
  { name: 'mid', kind: 'canopy', w: 1400, h: 240, seed: 51, fronds: 16, pos: 'top', opacity: 0.8 },
  { name: 'near', kind: 'canopy', w: 1200, h: 340, seed: 67, fronds: 11, pos: 'top', opacity: 0.96 },
  { name: 'front', kind: 'canopy', w: 1100, h: 420, seed: 83, fronds: 8, pos: 'bottom', opacity: 1 },
];

// The world is a jungle at night: foliage in depth bands, apes walking through
// it, fog and grain over the lot. Nothing here is a section.
export function WorldLayers() {
  return (
    <>
      <div className="world-sky" aria-hidden="true">
        <div className="world-stars" />
      </div>

      {['far', 'mid'].map((depth) => (
        <div className={`canopy canopy--${depth}`} key={depth} aria-hidden="true">
          {layers
            .filter((l) => l.name === depth)
            .map((l) => (
              <svg
                key={`${l.name}-${l.kind}`}
                className={`canopy__band canopy__band--${l.pos}`}
                viewBox={`0 0 ${l.w} ${l.h}`}
                preserveAspectRatio={l.pos === 'bottom' ? 'xMidYMax slice' : 'xMidYMin slice'}
                style={{ opacity: l.opacity }}
              >
                <path
                  fill="currentColor"
                  d={
                    l.kind === 'tree'
                      ? treeLine({ w: l.w, h: l.h, seed: l.seed, crowns: l.crowns, trunkCount: l.trunks })
                      : canopyBand({ w: l.w, h: l.h, seed: l.seed, fronds: l.fronds })
                  }
                />
              </svg>
            ))}
        </div>
      ))}

      <RoamLayer />

      <div className="canopy canopy--near" aria-hidden="true">
        {layers
          .filter((l) => l.name === 'near')
          .map((l) => (
            <svg
              key={`${l.name}-${l.kind}`}
              className={`canopy__band canopy__band--${l.pos}`}
              viewBox={`0 0 ${l.w} ${l.h}`}
              preserveAspectRatio="xMidYMin slice"
            >
              <path fill="currentColor" d={canopyBand({ w: l.w, h: l.h, seed: l.seed, fronds: l.fronds })} />
            </svg>
          ))}
      </div>

      <div className="world-fog" aria-hidden="true" />
      <div className="world-grain" aria-hidden="true" />
      <div className="world-sweep" aria-hidden="true" />
    </>
  );
}

// Foreground fronds sit above the content so the page reads as being watched
// from behind the leaves. Only decorative, and only ever at the corners.
export function ForegroundFronds() {
  const l = layers.find((x) => x.name === 'front');
  return (
    <div className="canopy canopy--front" aria-hidden="true">
      <svg
        className="canopy__band canopy__band--bottom"
        viewBox={`0 0 ${l.w} ${l.h}`}
        preserveAspectRatio="xMidYMax slice"
      >
        <path fill="currentColor" d={canopyBand({ w: l.w, h: l.h, seed: l.seed, fronds: l.fronds })} />
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
