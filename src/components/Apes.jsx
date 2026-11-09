// The apes: the persistent subject of the page. The source reference was a photo
// of hunched bipeds marching in profile, largest to smallest, some carrying a
// spear. It was kept at dist/assets/ape-inspo.jpeg, which is gitignored, and a
// build deleted it - the pose data below is what survived. Keep any future copy
// under public/ so a build cannot eat it again.
//
// Each pose is joint data, not a traced path. Limbs are round-capped strokes,
// thick for the thigh/upper arm and thin for the shin/forearm, so the silhouette
// tapers instead of reading as sausages. The skull is one filled path placed by
// transform, so the head is authored once and rotated per pose. Every part shares
// currentColor, so the union reads as a single solid cut-out at any size.
//
// Coordinate space: viewBox 0 0 130 126, ground line at y=122, figure faces +x.

const SKULL =
  'M-12 6C-10-6 0-16 18-19 38-22 58-15 69-3 75 4 78 8 77 13 76 18 71 18 68 15 66 22 59 27 49 29 38 31 26 31 15 29 3 27-8 20-12 6Z';

export const POSES = {
  stride: {
    // Most upright marcher, at the head of the procession.
    spine: [[52, 78], [55, 56], [60, 36]],
    head: { x: 64, y: 26, s: 46, rot: 8 },
    legNear: { hip: [56, 80], knee: [72, 98], ankle: [74, 116], toe: [88, 120] },
    legFar: { hip: [48, 80], knee: [38, 100], ankle: [32, 114], toe: [20, 120] },
    armNear: { sh: [62, 40], elbow: [72, 58], wrist: [66, 74] },
    armFar: { sh: [56, 40], elbow: [48, 58], wrist: [52, 76] },
    trunkWidth: 30,
  },
  carry: {
    // Hunched marcher with a spear across the shoulder. Head sits high and
    // forward so the shaft reads behind it instead of swallowing it.
    spine: [[44, 84], [52, 62], [66, 46]],
    head: { x: 74, y: 34, s: 48, rot: 14 },
    spear: [[30, 20], [112, 62]],
    legNear: { hip: [50, 86], knee: [70, 102], ankle: [72, 116], toe: [86, 120] },
    legFar: { hip: [42, 86], knee: [32, 104], ankle: [28, 116], toe: [16, 120] },
    armNear: { sh: [68, 50], elbow: [86, 52], wrist: [100, 56] },
    armFar: { sh: [58, 52], elbow: [50, 68], wrist: [50, 84] },
    trunkWidth: 30,
  },
  hunch: {
    // Deep forward lean, arms hanging long past the shins. The far elbow sits
    // left of the trunk's lower-right edge: 2u further right and the trunk, the
    // far arm and the near thigh enclosed a 2x4u gap that read as a dark speck
    // inside a solid cut-out.
    spine: [[40, 88], [52, 68], [72, 54]],
    head: { x: 78, y: 50, s: 44, rot: 40 },
    legNear: { hip: [46, 90], knee: [62, 106], ankle: [66, 116], toe: [78, 121] },
    legFar: { hip: [38, 90], knee: [30, 106], ankle: [26, 116], toe: [14, 121] },
    armNear: { sh: [74, 56], elbow: [84, 78], wrist: [80, 98] },
    armFar: { sh: [66, 60], elbow: [62, 84], wrist: [60, 102] },
    trunkWidth: 30,
  },
  forage: {
    // Low scavenger at the tail of the line, digging with a stick. Only used
    // small, where its silhouette is still legible. Ankles are at the same
    // height as every other pose so the procession stands on one line: the
    // shin's round cap, not the toe, sets the figure's baseline.
    spine: [[36, 92], [50, 82], [68, 78]],
    head: { x: 74, y: 78, s: 40, rot: 58 },
    stick: [[92, 100], [118, 94]],
    legNear: { hip: [42, 94], knee: [56, 108], ankle: [60, 116], toe: [72, 121] },
    legFar: { hip: [34, 94], knee: [28, 108], ankle: [24, 116], toe: [12, 121] },
    armNear: { sh: [70, 80], elbow: [82, 92], wrist: [92, 100] },
    armFar: { sh: [62, 80], elbow: [62, 96], wrist: [58, 112] },
    trunkWidth: 24,
  },
};

export const POSE_NAMES = Object.keys(POSES);

function Seg({ a, b, w }) {
  return (
    <path
      d={`M${a[0]} ${a[1]} L${b[0]} ${b[1]}`}
      strokeWidth={w}
      strokeLinecap="round"
      stroke="currentColor"
      fill="none"
    />
  );
}

function Leg({ c, far }) {
  return (
    <g fill="currentColor">
      <Seg a={c.hip} b={c.knee} w={far ? 19 : 21} />
      <Seg a={c.knee} b={c.ankle} w={far ? 12 : 13.5} />
      <ellipse
        cx={(c.ankle[0] + c.toe[0]) / 2}
        cy={c.toe[1] - 3}
        rx={Math.abs(c.toe[0] - c.ankle[0]) / 2 + 4}
        ry={far ? 4 : 4.5}
      />
    </g>
  );
}

function Arm({ c, far }) {
  return (
    <g fill="currentColor">
      <Seg a={c.sh} b={c.elbow} w={far ? 13 : 15} />
      <Seg a={c.elbow} b={c.wrist} w={far ? 8.5 : 10} />
      <circle cx={c.wrist[0]} cy={c.wrist[1]} r={far ? 5 : 6} />
    </g>
  );
}

function Trunk({ spine, width }) {
  return (
    <g fill="currentColor">
      <path
        d={`M${spine.map((p) => `${p[0]} ${p[1]}`).join(' L')}`}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke="currentColor"
        fill="none"
      />
      <circle cx={spine[0][0]} cy={spine[0][1]} r={width / 2 - 1} />
      <circle cx={spine[2][0]} cy={spine[2][1]} r={width / 2 + 3} />
    </g>
  );
}

function Skull({ x, y, s, rot }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s / 100})`} fill="currentColor">
      <path d={SKULL} />
    </g>
  );
}

// A single ape. Decorative by nature: the procession is atmosphere, so it stays
// out of the accessibility tree unless a caller opts in with a title.
export function Ape({ pose = 'stride', className = '', title, ...rest }) {
  const p = POSES[pose] ?? POSES.stride;
  const id = title ? `ape-${pose}` : undefined;

  return (
    <svg
      className={`ape ${className}`.trim()}
      viewBox="0 0 130 126"
      role={title ? 'img' : undefined}
      aria-labelledby={id}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...rest}
    >
      {title ? <title id={id}>{title}</title> : null}
      {p.spear ? (
        <line
          x1={p.spear[0][0]}
          y1={p.spear[0][1]}
          x2={p.spear[1][0]}
          y2={p.spear[1][1]}
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      ) : null}
      {p.stick ? (
        <line
          x1={p.stick[0][0]}
          y1={p.stick[0][1]}
          x2={p.stick[1][0]}
          y2={p.stick[1][1]}
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      ) : null}

      {/* Far side first so the near limbs overlap it; one colour throughout. */}
      <Arm c={p.armFar} far />
      <Leg c={p.legFar} far />
      <Trunk spine={p.spine} width={p.trunkWidth} />
      <Skull {...p.head} />
      <Leg c={p.legNear} />
      <Arm c={p.armNear} />
    </svg>
  );
}

// Depth bands of apes crossing the viewport behind the content. Near apes are
// larger, darker against the night, and move faster; far apes barely crawl.
// Kept deterministic so a screenshot matches the last screenshot run.
const roamBands = [
  // depth, size (px), how many, cycle length (s), direction, base opacity
  // The bands used to land in the bottom 38% only, so the whole middle of the
  // viewport had no apes at all and the subject vanished mid-scroll. They are
  // spread from the canopy line down, opacity climbing with nearness. The floor is
  // set by measurement, not by taste: a walker crossing a content band sits under
  // that band's wash and its own white haze, and at 0.34 the far band arrived at
  // 1.03-2.09:1 against the ground it stands on. bandtext.mjs holds every band at
  // 3:1 or better, WCAG's non-text minimum.
  //
  // The lead walker sat at top: 90, which put it in the ground fern rather than in
  // front of it or above it. The fern band is 17vh of opaque near-black silhouette
  // (.canopy--front, opacity 1, colour #020302) and its mass covers 36-72% of every
  // row from y760 to the bottom of a 900px viewport. A 166px walker whose feet are at
  // y90 only shows 92px above the fold, and every one of those pixels was under the
  // fern, so the largest ape on the page measured 1.61:1 against the ground behind it
  // and the crop showed a smear where a body should be. It was the single worst ape
  // anywhere on the site and it was the one meant to carry the subject.
  //
  // top: 77 stands the same walker on the fern instead: fully on screen at 165 of its
  // 166px, 8274 ink pixels instead of 1113, 3.46:1, with its lower 2418 px still lost
  // behind the fronds - which is the depth cue the layer is for. Raising it further
  // measures no better (71% gives 3.29:1), so this is the line the fern is designed
  // against, not a taste call. canopydepth.mjs re-measures the same number per depth.
  { n: 3, size: 34, dur: 168, dir: 1, opacity: 0.62, top: 40, bob: 0.5 },
  { n: 2, size: 58, dur: 124, dir: -1, opacity: 0.64, top: 55, bob: 0.8 },
  { n: 2, size: 104, dur: 88, dir: 1, opacity: 0.76, top: 72, bob: 1 },
  { n: 1, size: 168, dur: 62, dir: -1, opacity: 0.9, top: 77, bob: 1.4 },
];

const bandPoses = ['stride', 'carry', 'hunch', 'forage', 'stride', 'hunch', 'carry', 'hunch', 'stride', 'forage'];

export function RoamLayer() {
  let index = 0;

  return (
    <div className="roam" aria-hidden="true">
      {roamBands.map((band, bandIndex) =>
        Array.from({ length: band.n }, (_, i) => {
          const pose = bandPoses[index % bandPoses.length];
          index += 1;
          // Spread members of the same band out along the cycle so they never
          // bunch up, and offset the vertical landing point slightly per ape.
          const spread = (i / band.n) * band.dur;
          return (
            <span
              key={`b${bandIndex}-${i}`}
              className={`roam__walker roam__walker--dir${band.dir > 0 ? 'r' : 'l'}`}
              style={{
                '--w': `${band.size}px`,
                '--top': `${band.top + i * 2.5}%`,
                '--dur-roam': `${band.dur}s`,
                '--delay-roam': `-${(spread + bandIndex * 7).toFixed(2)}s`,
                '--fade': band.opacity,
                '--bob': `${band.bob}px`,
                // Where a walker stands when its cross-screen walk is switched
                // off. Staggered so a reduced-motion load still shows a
                // kawanan spread across the viewport instead of a pile-up.
                '--rest': `${((bandIndex * 23 + i * 37) % 82) + 6}vw`,
              }}
            >
              <span className="roam__bob">
                <Ape pose={pose} />
              </span>
            </span>
          );
        }),
      )}
    </div>
  );
}

// The hero's own procession, largest to smallest, straight off the reference.
const procession = [
  { pose: 'stride', h: 200 },
  { pose: 'carry', h: 164 },
  { pose: 'hunch', h: 128 },
  { pose: 'stride', h: 96 },
  { pose: 'forage', h: 68 },
];

export function Procession({ title = 'Kawanan berjalan' }) {
  return (
    <div className="procession" role="img" aria-label={title}>
      {procession.map((member, i) => (
        <span
          key={`p-${i}`}
          className="procession__walker"
          style={{
            '--h': `${member.h}px`,
            '--bob': `${(member.h / 200).toFixed(2)}rem`,
            '--delay-proc': `-${(i * 0.42).toFixed(2)}s`,
            '--fade': (0.42 + (i / procession.length) * 0.58).toFixed(2),
          }}
        >
          <span className="procession__bob">
            <Ape pose={member.pose} />
          </span>
        </span>
      ))}
    </div>
  );
}
