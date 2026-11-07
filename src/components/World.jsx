import { Fragment } from 'react';
import { marqueeWords, marqueeWordsAlt } from '../data/content.js';
import { Glyph } from './Marks.jsx';

const emberEmbers = Array.from({ length: 14 }, (_, index) => index);

// The single continuous world the whole page sits on. Nothing here is a
// section: it is one wall with a cave cut into it, and it never sits still.
export function WallLayers() {
  return (
    <>
      <div className="wall-surface" aria-hidden="true" />
      <div className="wall-grid" aria-hidden="true" />
      <div className="wall-glyphs" aria-hidden="true">
        <div className="wall-glyph wall-glyph--hero" style={{ '--depth': '2.2rem' }}>
          <Glyph name="ape" />
        </div>
        <div className="wall-glyph wall-glyph--mid" style={{ '--depth': '-1.6rem' }}>
          <Glyph name="spade" />
        </div>
      </div>
      <div className="wall-sweep" aria-hidden="true" />
      <div className="wall-grain" aria-hidden="true" />
    </>
  );
}

export function EmberField() {
  return (
    <div className="ember-field" aria-hidden="true">
      {emberEmbers.map((index) => (
        <span
          key={index}
          className="ember"
          style={{
            left: `${6 + ((index * 37) % 88)}%`,
            width: `${5 + (index % 4) * 3}px`,
            height: `${5 + (index % 4) * 3}px`,
            '--delay': `${(index * 0.9) % 11}s`,
            '--dur-ember': `${7 + (index % 5) * 1.6}s`,
            '--drift': `${(index % 2 === 0 ? 1 : -1) * (2 + (index % 3))}rem`,
          }}
        />
      ))}
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
