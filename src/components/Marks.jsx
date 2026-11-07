// Hand drawn looking primitives. Every stroke uses pathLength="1" so CSS can
// animate a uniform "carve" reveal regardless of real path length.
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  vectorEffect: 'non-scaling-stroke',
};

function Carve({ d, extra = {} }) {
  return <path {...stroke} pathLength="1" className="carve" d={d} {...extra} />;
}

function Handprint() {
  return (
    <svg className="mark" viewBox="0 0 120 140" aria-hidden="true">
      <Carve d="M38 132c-9-6-14-18-13-31 1-11 4-18 6-26 2-9 3-16 3-25" />
      <Carve d="M82 132c9-6 14-18 13-31-1-11-4-18-6-26-2-9-3-16-3-25" />
      <Carve d="M32 58c-2-12-3-24 2-30 4-5 9-3 10 4l4 26" />
      <Carve d="M52 30c-1-11 0-22 5-25 5-3 9 1 9 9v22" />
      <Carve d="M70 32c0-11 2-20 7-21 5-1 8 3 7 11l-3 22" />
      <Carve d="M86 44c2-9 5-16 10-16 5 0 7 5 5 12l-6 16" />
      <Carve d="M38 78c8-4 34-4 44 0" />
      <circle className="mark-dot" cx="46" cy="96" r="3.4" />
      <circle className="mark-dot" cx="70" cy="98" r="3" />
    </svg>
  );
}

function Glyphs() {
  return (
    <svg className="mark" viewBox="0 0 160 140" aria-hidden="true">
      <Carve d="M30 52c0-16 11-27 26-27s26 11 26 27c0 8-2 14-5 19-4 7-11 12-21 12s-17-5-21-12c-3-5-5-11-5-19Z" />
      <Carve d="M36 46h40" />
      <Carve d="M44 68c4 4 16 4 20 0" />
      <Carve d="M48 74c0 5 8 5 8 0" />
      <Carve d="M112 108c-9 0-14-6-14-12 0-8 8-14 14-22 6 8 14 14 14 22 0 6-5 12-14 12Z" />
      <Carve d="M112 96v12" />
      <Carve d="M104 112c3 4 5 6 8 6s5-2 8-6" />
      <Carve d="M22 122l14-22 14 22Z" />
      <Carve d="M29 116l7-11 7 11" />
      <Carve d="M124 34l10 18-20 0Z" />
    </svg>
  );
}

function Trail() {
  return (
    <svg className="mark" viewBox="0 0 160 140" aria-hidden="true">
      <Carve d="M28 118c-7-4-9-13-6-21 3-7 9-11 14-9 5 2 6 9 3 17-2 6-6 11-11 13Z" />
      <Carve d="M30 82c-4-2-5-8-3-13s7-7 10-5 4 6 2 11-5 9-9 7Z" />
      <Carve d="M56 92c-4-2-5-8-3-13s7-7 10-5 4 6 2 11-5 9-9 7Z" />
      <Carve d="M84 66c-7-4-9-13-6-21 3-7 9-11 14-9 5 2 6 9 3 17-2 6-6 11-11 13Z" />
      <Carve d="M112 44c-4-2-5-8-3-13s7-7 10-5 4 6 2 11-5 9-9 7Z" />
      <Carve d="M14 128c22-6 44-16 62-30s32-32 44-52" />
    </svg>
  );
}

function Bones() {
  return (
    <svg className="mark" viewBox="0 0 160 140" aria-hidden="true">
      <Carve d="M30 74c0-8 6-14 14-14h64c8 0 14 6 14 14s-6 14-14 14H44c-8 0-14-6-14-14Z" />
      <Carve d="M24 56c8-6 16-2 16 6M24 92c8 6 16 2 16-6M140 56c-8-6-16-2-16 6M140 92c-8 6-16 2-16-6" />
      <Carve d="M62 118c0-10 8-18 18-18s18 8 18 18" />
      <Carve d="M68 128c-3-6-2-10 2-12M96 128c3-6 2-10-2-12" />
      <Carve d="M74 112c3 4 13 4 16 0" />
    </svg>
  );
}

function ApeMark() {
  return (
    <svg className="mark" viewBox="0 0 140 140" aria-hidden="true">
      <Carve d="M26 62c0-22 18-38 44-38s44 16 44 38c0 14-6 26-16 34-8 6-18 10-28 10s-20-4-28-10c-10-8-16-20-16-34Z" />
      <Carve d="M22 54c-8-4-14-2-16 4-2 8 4 14 14 14" />
      <Carve d="M118 54c8-4 14-2 16 4 2 8-4 14-14 14" />
      <Carve d="M38 58c10-6 22-6 28 0M102 58c-10-6-22-6-28 0" />
      <Carve d="M50 84c8 6 32 6 40 0" />
      <Carve d="M56 96c0 6 10 6 14 0M84 96c0 6-10 6-14 0" />
      <circle className="mark-dot" cx="52" cy="68" r="4" />
      <circle className="mark-dot" cx="88" cy="68" r="4" />
    </svg>
  );
}

function ApeGlyph() {
  return (
    <svg className="glyph" viewBox="0 0 64 64" aria-hidden="true">
      <Carve d="M12 30c0-11 9-19 20-19s20 8 20 19c0 7-3 13-8 17-4 3-8 5-12 5s-8-2-12-5c-5-4-8-10-8-17Z" />
      <Carve d="M10 26c-4-2-7-1-8 2-1 4 2 7 7 7M54 26c4-2 7-1 8 2 1 4-2 7-7 7" />
      <Carve d="M20 28c5-3 11-3 14 0M44 28c-5-3-11-3-14 0" />
      <Carve d="M24 42c4 3 12 3 16 0" />
    </svg>
  );
}

function TriangleGlyph() {
  return (
    <svg className="glyph" viewBox="0 0 64 64" aria-hidden="true">
      <Carve d="M32 10l24 42H8Z" />
      <Carve d="M32 24l12 21H20Z" />
      <Carve d="M26 56l6-11 6 11" />
    </svg>
  );
}

function SpadeGlyph() {
  return (
    <svg className="glyph" viewBox="0 0 64 64" aria-hidden="true">
      <Carve d="M32 8c8 10 20 17 20 27 0 8-6 14-13 14-4 0-7-2-7-2s-3 2-7 2c-7 0-13-6-13-14C12 25 24 18 32 8Z" />
      <Carve d="M25 49c-1 4-3 6-6 7 4 1 8 1 13-1 5 2 9 2 13 1-3-1-5-3-6-7" />
    </svg>
  );
}

function FlameGlyph() {
  return (
    <svg className="glyph" viewBox="0 0 64 64" aria-hidden="true">
      <Carve d="M32 6c2 10-6 14-10 21-5 8-2 20 10 20s15-12 10-20c-3-5-8-8-10-21Z" />
      <Carve d="M32 30c1 5-3 7-3 11 0 4 2 6 3 6s3-2 3-6c0-4-4-6-3-11Z" />
      <Carve d="M18 52c8 6 20 6 28 0" />
    </svg>
  );
}

const marks = {
  handprint: Handprint,
  glyphs: Glyphs,
  trail: Trail,
  bones: Bones,
  ape: ApeMark,
};

const glyphMarks = {
  ape: ApeGlyph,
  triangle: TriangleGlyph,
  spade: SpadeGlyph,
  flame: FlameGlyph,
};

export function PrimitiveArt({ type }) {
  const Mark = marks[type] ?? Handprint;
  return <Mark />;
}

export function Glyph({ name }) {
  const Mark = glyphMarks[name] ?? FlameGlyph;
  return <Mark />;
}

export function DiscordGlyph() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M19.3 5.6A16.6 16.6 0 0 0 15.2 4.3l-.4.9a15 15 0 0 0-5.6 0l-.4-.9A16.6 16.6 0 0 0 4.7 5.6C2 9.6 1.3 13.5 1.6 17.3a16.7 16.7 0 0 0 5 2.5l1.1-1.7-.01-.01c-.6-.2-1.2-.5-1.7-.8l.4-.3a11.9 11.9 0 0 0 10.2 0l.4.3c-.5.3-1.1.6-1.7.8l1.1 1.7a16.6 16.6 0 0 0 5-2.5c.4-4.4-.7-8.3-3-11.7ZM8.6 14.9c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm6.8 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z"
      />
    </svg>
  );
}

export function ArrowGlyph() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        {...stroke}
        strokeWidth={2}
        pathLength="1"
        d="M12 4v15M6 13l6 6 6-6"
      />
    </svg>
  );
}
