// Does the canopy veil erase the subject?
//
// world.css states the depth order as void > treeline > canopy far > roam (apes) >
// canopy near, and .canopy--near / .canopy--front really are z-index 1. Whether that
// puts foliage in front of an ape, though, depends on which ape: the hero procession
// lives inside .hero, which is position:relative z-index:2 and therefore a stacking
// context above the canopy, so a hero walker paints over the fronds. The roam walkers
// are direct children of .world at z-index 0, so the same foliage paints over them. The
// stylesheet comment describes one order; the cascade implements two.
//
// Front and back cannot be read off a pixel diff, which is what this script first tried
// and what made its numbers meaningless. Hiding the foliage changes a walker's pixels
// from behind too, because the walkers are translucent, so "the pixel moved when the
// leaves went away" was scored as occlusion at the hero and reported 96% coverage on
// apes that were standing in front of everything. Contrast is now only computed for ink
// the browser agrees is genuinely behind the leaves.
//
// Hit testing needs one probe-only adjustment, and it is the kind of trap that makes a
// green probe worse than none. .canopy is pointer-events: none, which is correct for a
// decorative layer and fatal for elementsFromPoint, because that API skips such
// elements entirely. Asked what is on top of an ape, it answered "hero, world, body" and
// never mentioned the canopy, so every ape looked unoccluded and every text box looked
// clear: both halves of the check passed on nothing at all. The probe re-enables pointer
// events on the canopy alone, which changes hit-testability without touching paint order,
// so the returned stack is the real stacking order.
//
// Two frames differ only in whether the apes are painted. Everything else, the canopy
// included, is identical between them, so the delta at any pixel is exactly what the ape
// contributes after the leaves in front of it. That makes the delta the number to gate:
// an ape washed out by foliage shows up as a small delta, which is the defect, and an ape
// standing in the open shows up as a large one.
//
// The previous version compared each ape against a "bare" frame with the foliage hidden
// too, so a pixel of an in-front ape that happened to overlap a leaf was scored as
// leaf-over-ground instead of ape-over-background. That is how a walker the screenshot
// shows clearly visible came out at 1.15:1: the number was measuring the leaf, not the
// ape. A single background frame removes that whole class of error.
//
// What is gated, per viewport and scroll depth:
//
//   1. foliage is never topmost over words. Scenery in front of a heading or a button
//      is a defect at any depth. Probed on a grid, not by pixel deltas: 82.5% of the
//      hero blurb's box shifts when the front fern is hidden, yet those glyphs belong
//      to .hero above the canopy, so the 82.5% was ground between letters.
//   2. an ape behind *translucent* foliage still reads at 3:1, WCAG 1.4.11's non-text
//      minimum. Occlusion is the intended look; washing out is not.
//   3. an ape behind an *opaque* silhouette is judged on how much of its body survives,
//      because demanding 3:1 through something you cannot see through is a category
//      error. What matters there is coverage: the lead walker has a quarter of its ink
//      behind the fern at the worst pose, which is framing, and an ape that is 98%
//      hidden is gone.
//   4. the subject survives the depth. At least one walker big enough to be the subject
//      has to clear the 3:1 floor on the part of it that is actually visible, so a page
//      that leaves only smudges in the undergrowth cannot pass.
//   5. a walker the page has itself faded out is not evidence about the canopy. .roam
//      opacity is gated on scroll progress and sits at 0 through the whole hero fold so
//      the procession can own the first screen, so the hero depths judge the procession
//      and the roam lanes are judged at a depth where they are actually on.
//
// Which rule applies depends on the thing standing in front, and on this page that turned
// out to be the interesting question. The depth design is distant foliage behind the apes
// (.canopy--far at z -5, .canopy--mid at z -4), then the apes (.roam at z 0), then opaque
// silhouette framing in front (.canopy--near and .canopy--front at z 1, colour #020302,
// band opacity 0.95 and 1). There is no translucent foliage in front of the apes at all.
// So the single "contrast through the veil" rule had nothing real to measure, and the
// number it produced for the lead walker, 1.09:1, was the ratio of black fronds to black
// ground at the spots where a black ape happened to stand behind them: arithmetically
// true, and about legibility, meaningless. An opaque object hides things. Only a
// translucent one veils them, and only veiling carries a contrast requirement.
//
// The two are separated per cell from the covering layer's own alpha, read off the page
// rather than hardcoded, so if a translucent foreground layer is ever added the contrast
// rule starts applying to it by itself rather than needing this script edited.
//
// Measured at the four depths, worst pinned pose: the desktop lead walker has 24% of its
// ink behind the fern, the mobile lead 17%, and every other walker in the open at 5:1 or
// better. No translucent foliage was found in front of any ape, so rule 2 currently has
// nothing to fail on, which is the correct outcome for this page and not a gap in the gate.
import { chromium } from 'playwright-core';
import { lum, ratio } from './lib/contrast.mjs';

const EXE =
  process.env.CHROME_PATH ??
  '/home/starmank/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const MIN_CONTRAST = 3; // WCAG 1.4.11, non-text contrast minimum
const MIN_INK = 200; // below this an ape is too small to judge occlusion on
const SUBJECT_PX = 60; // a walker this wide is big enough to carry the subject
// The foreground fronds are meant to eat the lower legs; they are not meant to eat the ape.
// At the corrected desktop lane the lead walker has 24% of its ink behind the fern at the
// worst pinned pose, which reads as framing in the screenshot. The ceiling sits well above
// that so a pass means "framed", and an ape that walks most of the way into the undergrowth
// fails.
const MAX_HIDDEN_PCT = 65;
const GRID = 6; // px per occlusion cell: fine enough to split a leaf edge across a body
// Below this effective alpha a walker is a smudge by the page's own design rather than a
// thing being occluded, so its frame is not evidence about the canopy. See the FAINT check.
const FAINT = 0.05;
// Pinned animation times, in ms. The walk cycles run 62-168s, so these sample several
// spread-out points of a full cycle rather than one arbitrary pose. Values are absolute,
// not derived from wall time, so two runs measure identical frames.
const FRAMES = [0, 4000, 9000, 15000, 22000];

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'],
});

const decode = async (page, buffer) => {
  const url = `data:image/png;base64,${buffer.toString('base64')}`;
  return page.evaluate(async (src) => {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = src;
    });
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    return { w: c.width, h: c.height, d: Array.from(ctx.getImageData(0, 0, c.width, c.height).data) };
  }, url);
};

const HIDE_FG = '.canopy--near, .canopy--front { visibility: hidden !important; }';
const HIDE_APES = '.procession, .roam__walker { visibility: hidden !important; }';
// Content *card fills*, not the section containers. .trail and .join are full-width
// sections that span the viewport, so excluding their bounding boxes marked every mid-page
// cell as content-owned and the apes standing in the open between cards were judged as
// nobody's business. These are the same four selectors bandtext.mjs measures through, so
// the two probes agree about who owns which pixel.
const BANDS = '.chapter__copy, .join__card, .rule, .marks li';

// A covering layer at or above this effective alpha hides rather than veils, so it is
// judged on coverage instead of contrast. .canopy--front and .canopy--near are authored at
// band opacity 1 and 0.95 of #020302; the far and mid layers sit at 0.5-0.85 and sit behind
// the apes anyway. 0.9 separates "you cannot see through it" from "it is a wash".
const OPAQUE = 0.9;

const TEXT =
  '.hero h1, .hero .lead, .hero .body-copy, .cta, .rail__item, .scroll-hint, ' +
  '.chapter__copy p, .chapter__title, .join h2, .join__card p, .rule p, .section-head h2';

const differs = (a, b, p) =>
  Math.abs(a.d[p] - b.d[p]) + Math.abs(a.d[p + 1] - b.d[p + 1]) + Math.abs(a.d[p + 2] - b.d[p + 2]) > 6;

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

const failures = [];
// Total across depths: a run where nothing at all was ever judged behind the veil means
// the occlusion half of this script proved nothing and must not pass silently.
let occludedJudgedTotal = 0;
let depthsProbed = 0;

for (const [label, vp, scrollFrac] of [
  ['desktop hero', { width: 1440, height: 900 }, 0],
  ['mobile hero', { width: 390, height: 844 }, 0],
  ['desktop mid-page', { width: 1440, height: 900 }, 0.4],
  // Mobile needs a depth where the roam layer is actually faded in. Through the hero fold
  // .roam__walker opacity is 0 by design (it ramps in past 4.5% of scroll progress, so the
  // procession can own the first screen), so a hero-only mobile probe measures no roam apes
  // at all and silently blesses whatever lane the mobile walkers were given. The mobile lead
  // walker's lane is the exact thing this file exists to keep honest.
  ['mobile mid-page', { width: 390, height: 844 }, 0.4],
]) {
  const page = await (await browser.newContext({ viewport: vp })).newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);
  // behavior:'instant': the site sets scroll-behavior: smooth, so a bare scrollTo is a
  // glide that may still be running when the first screenshot is taken. The walker lanes
  // are positioned against scroll progress, so a frame mid-glide is a different page.
  await page.evaluate((f) => scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * f, behavior: 'instant' }), scrollFrac);
  await page.waitForTimeout(1200);
  const settledY = await page.evaluate(() => Math.round(scrollY));
  console.log(`\n[${label}] scrolled to y${settledY}`);
  if (scrollFrac > 0 && settledY === 0) {
    failures.push(`${label}: asked for ${scrollFrac} of the page and ended at scrollY 0, so this measured the hero`);
  }
  await page.addStyleTag({ content: '*, *::before, *::after { animation-play-state: paused !important; }' });
  // Pausing is not the same as fixing. `animation-play-state: paused` stops the clock
  // where it happens to be when the style lands, so two runs of identical code measure the
  // apes at different points in their walk and different frames of their bob - which is what
  // happened when this script reported 3.18:1 on one run and 2.55:1 on the next for the same
  // build. Worse, a flake that occasionally fails is trusted less than a gate that reliably
  // passes, so the number stopped meaning anything.
  //
  // currentTime is therefore pinned. Any value is as good as another for the occlusion
  // geometry, but the value must be the same every run or the measurement is not
  // reproducible. The pose still matters for contrast, because a stride frame and a
  // carry frame are different silhouettes over different leaves, so the gate below
  // measures several pinned times and keeps the worst, exactly as bandtext.mjs steps a
  // full walk cycle and keeps the worst frame per text box.
  const pinTo = (ms) =>
    page.evaluate((t) => {
      for (const a of document.getAnimations()) {
        a.pause();
        const dur = a.effect?.getTiming?.().duration;
        const iter = a.effect?.getTiming?.().iterations;
        // One-shot reveals (logo-carve, char-rise, fill both) are finished, not rewound.
        // Pinning them to t=0 puts the hero logo and the heading at opacity 0, so the page
        // being measured is a page nobody ever sees, and the foliage-over-words check ends up
        // probing words that are not there. Only the looping ambient and walk animations are
        // worth sampling at a chosen phase.
        const oneShot = iter !== Infinity && Number.isFinite(iter);
        if (oneShot && Number.isFinite(dur) && dur > 0) {
          a.currentTime = dur;
          continue;
        }
        // Negative or huge values land outside a cycle; wrap so every animation is
        // genuinely inside its own timeline rather than clamped at an endpoint.
        a.currentTime = Number.isFinite(dur) && dur > 0 ? t % dur : t;
      }
    }, ms);
  await pinTo(FRAMES[0]);
  // Probe-only: make the painted foliage and the walkers hittable so elementsFromPoint
  // reports them. Both inherit pointer-events: none from their layer, and without this the
  // stack answers "hero, world, body" and the whole occlusion test runs on nothing.
  //
  // The selector matters more than it looks. .canopy is position:fixed with inset:0, so it
  // is a transparent box covering the entire viewport; making the container hittable, or
  // the <svg> band inside it, means the stack reports foliage over every pixel of every
  // ape and each one comes out "100% occluded" regardless of where it stands. Only the
  // <path> that actually paints the leaf silhouette has geometry worth asking about, so
  // that is the only thing given pointer-events. Hitting that down to one element per
  // canopy layer changed the mid-page reading from a uniform 100% to 0%, 6% and 27% for
  // three walkers, which matches where the fern line sits in the screenshot.
  await page.addStyleTag({
    content: '.canopy__band path, .ape { pointer-events: auto !important; }',
  });
  await page.waitForTimeout(300);

  // Which apes are on screen, and for each one a coarse mask saying whether the canopy
  // paints over it there. Front or back is decided per cell, not per ape, because a
  // walker straddling a leaf line is half behind it and that half is the interesting part.
  // The ape itself is looked for in the hit stack, so forcing pointer-events on it matters
  // for the same reason it does for the canopy.
  //
  // Each ape carries the DOM-order index it was tagged with. Walkers enter and leave the
  // viewport between frames, so "ape #4" is not a thing that survives a re-measure; keying
  // on the element rather than the position is what lets the worst frame be attributed back
  // to the walker that had it.
  // The opaque/veil threshold is authored in this file but used inside page.evaluate, which
  // has no access to Node scope. It travels with the other probe parameters.
  const measureFrame = ([sel, bandSel, step, opaqueFloor]) => {
    return page.evaluate(
      ([sel, bandSel, step, opaqueFloor]) => {
        // Anti-vacuous, and earned. This threshold was authored in Node scope, referenced
        // inside page.evaluate as if it were in scope there too, and quietly arrived as
        // undefined. `alpha >= undefined` is false for every cell, so *all* foreground
        // foliage was classified as a translucent wash and the gate demanded 3:1 through a
        // solid black leaf, producing meaningless 1.09:1 failures. A dropped probe parameter
        // must be an error, not a different measurement that still prints numbers.
        if (!(opaqueFloor > 0 && opaqueFloor <= 1)) {
          throw new Error(
            `opaque threshold never reached the page (${String(opaqueFloor)}); ` +
              'page.evaluate does not close over Node scope, pass it as an argument',
          );
        }
        const isCanopy = (el) => !!el?.closest?.('.canopy');
        const bands = [...document.querySelectorAll(bandSel)].map((el) => el.getBoundingClientRect());
        const out = [];
        // A counter that never resets, stashed on the page. Restarting from zero each
        // pass would let a newly-scrolled-in walker inherit the number of an off-screen
        // one, and then two different apes' frames get averaged together.
        window.__canopyNextId ??= 0;
        for (const el of document.querySelectorAll(sel)) {
          if (el.dataset.canopyIdx === undefined) el.dataset.canopyIdx = String(window.__canopyNextId++);
          const id = Number(el.dataset.canopyIdx);
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) continue;
          if (r.bottom < 0 || r.top > innerHeight) continue;
          // The walker's own effective alpha, multiplied up the ancestor chain. The roam
          // layer fades in with scroll progress and the procession carries a per-member fade,
          // so an ape can be near invisible for reasons that have nothing to do with the
          // canopy. Without this number a faint ape that loses its last few pixels to a leaf
          // reads as "the fern hid it", which blames the wrong thing.
          let apeAlpha = Number(getComputedStyle(el).opacity);
          for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
            apeAlpha *= Number(getComputedStyle(n).opacity);
          }
          const cols = Math.ceil(r.width / step);
          const rows = Math.ceil(r.height / step);
          // 0 unprobed, 1 open, 2 opaque foliage over, 3 content card, 4 translucent veil over
          const mask = new Uint8Array(cols * rows);
          let probed = 0;
          let over = 0;
          let opaque = 0;
          let veil = 0;
          let i = 0;
          for (let cy = 0; cy < rows; cy++) {
            const y = Math.round(r.top + cy * step + step / 2);
            for (let cx = 0; cx < cols; cx++, i++) {
              const x = Math.round(r.left + cx * step + step / 2);
              if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
              const stack = document.elementsFromPoint(x, y);
              const apeIdx = stack.indexOf(el);
              if (apeIdx < 0) continue;
              probed += 1;
              let canopyIdx = -1;
              for (let k = 0; k < apeIdx; k++) {
                if (isCanopy(stack[k])) { canopyIdx = k; break; }
              }
              if (canopyIdx >= 0) {
                // Effective alpha of what is covering this cell, multiplied down the layer
                // chain: the painted path, the band that holds it, the depth group. Reading
                // only the band's authored opacity would call a 0.8 group of a 1 band opaque.
                const covering = stack[canopyIdx];
                let alpha = 1;
                for (let n = covering; n && n !== document.body; n = n.parentElement) {
                  alpha *= Number(getComputedStyle(n).opacity);
                }
                mask[i] = alpha >= opaqueFloor ? 2 : 4;
                over += 1;
                if (mask[i] === 2) opaque += 1;
                else veil += 1;
              } else {
                const covered = bands.some((b) => x >= b.left && x < b.right && y >= b.top && y < b.bottom);
                mask[i] = covered ? 3 : 1;
              }
            }
          }
          out.push({
            id,
            apeAlpha: +apeAlpha.toFixed(3),
            x: Math.round(r.left),
            y: Math.round(r.top),
            width: Math.round(r.width),
            height: Math.round(r.height),
            step,
            cols,
            mask: Array.from(mask),
            probed,
            overPct: probed ? +((over / probed) * 100).toFixed(0) : 0,
            opaquePct: probed ? +((opaque / probed) * 100).toFixed(0) : 0,
            veilPct: probed ? +((veil / probed) * 100).toFixed(0) : 0,
          });
        }
        return out;
      },
      [sel, bandSel, step, opaqueFloor],
    );
  };

  // Two frames of the same pinned instant. Hiding the apes leaves the canopy and the
  // ground exactly as they were, so every differing pixel is the ape's own contribution as
  // actually composited, leaves and all, and the contrast of that against the same pixel
  // without the ape is the number a viewer experiences.
  const shoot = async () => {
    const painted = await decode(page, await page.screenshot());
    await page.addStyleTag({ content: HIDE_APES });
    await page.waitForTimeout(300);
    const noApes = await decode(page, await page.screenshot());
    await page.addStyleTag({ content: HIDE_APES.replace('hidden', 'visible') });
    await page.waitForTimeout(200);
    return { painted, noApes };
  };

  // Contrast and coverage per ape per frame. A pinned pose is one frame of a 62-168s walk,
  // so every frame is measured and the worst result per ape is kept: the pose that is hardest
  // to see is the one worth gating.
  const best = new Map(); // id -> accumulated worst/best across frames
  const note = (id, box, stats) => {
    const cur =
      best.get(id) ??
      { worstVeil: null, bestOpen: null, worstOpaquePct: 0, minVisibleShare: 1, samples: [] };
    cur.width = box.width;
    cur.height = box.height;
    cur.y = box.y;
    // The walker's own effective alpha, worst (lowest) across frames. Cheap to carry and it
    // is the first question any surprising contrast number raises: is this the canopy, or is
    // the page itself fading this ape out?
    cur.minApeAlpha = Math.min(cur.minApeAlpha ?? 1, box.apeAlpha);
    cur.worstVeil = stats.veil.length
      ? cur.worstVeil === null
        ? median(stats.veil)
        : Math.min(cur.worstVeil, median(stats.veil))
      : cur.worstVeil;
    cur.bestOpen = stats.open.length
      ? cur.bestOpen === null
        ? median(stats.open)
        : Math.max(cur.bestOpen, median(stats.open))
      : cur.bestOpen;
    cur.worstOpaquePct = Math.max(cur.worstOpaquePct, stats.opaquePct);
    cur.minVisibleShare = Math.min(cur.minVisibleShare, stats.visibleShare);
    cur.totalInk = (cur.totalInk ?? 0) + stats.totalInk;
    // The per-frame record behind the worst number, so a failure can be read rather than
    // guessed at: how much ink there was, what share was hidden, and how opaque the walker
    // itself was at that instant.
    if (stats.opaquePct >= (cur.worstOpaquePct ?? 0)) {
      cur.worstFrame = {
        ink: stats.totalInk,
        opaque: stats.opaqueInk,
        open: stats.openInk,
        veil: stats.veilInk,
        card: stats.cardInk,
        unprobed: stats.unprobedInk,
        apeAlpha: box.apeAlpha,
      };
    }
    best.set(id, cur);
  };

  let apeCount = 0;
  for (const t of FRAMES) {
    await pinTo(t);
    await page.waitForTimeout(150);
    const apes = await measureFrame([
      '.procession__walker .ape, .roam__walker .ape',
      BANDS,
      GRID,
      OPAQUE,
    ]);
    apeCount = Math.max(apeCount, apes.length);
    const { painted, noApes } = await shoot();
    for (const box of apes) {
      // A walker the page itself has faded out is not a canopy occlusion case. The roam layer
      // is gated on scroll progress (opacity 0 through the whole hero fold, ramping in over
      // the first 4.5% of the page) so the procession is the subject up top and the roam apes
      // take over below it. Judging the fern on an ape the page has already hidden measures
      // nothing and blames the wrong layer, so those frames are skipped; an ape that never
      // fades in at a depth simply contributes no judgement.
      if (box.apeAlpha < FAINT) continue;
      const x0 = Math.max(0, box.x);
      const y0 = Math.max(0, box.y);
      const x1 = Math.min(painted.w, box.x + box.width);
      const y1 = Math.min(painted.h, box.y + box.height);
      const veil = [];
      const open = [];
      let opaqueInk = 0;
      let visibleInk = 0;
      let cardInk = 0;
      let totalInk = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const p = (y * painted.w + x) * 4;
          if (!differs(painted, noApes, p)) continue;
          totalInk += 1;
          const cx = Math.floor((x - box.x) / box.step);
          const cy = Math.floor((y - box.y) / box.step);
          const cell = cx >= 0 && cx < box.cols ? box.mask[cy * box.cols + cx] : 0;
          const cr = ratio(lum(painted, p), lum(noApes, p));
          // cell 2 is opaque foliage: the ape is hidden there, so the contrast of that pixel
          // is meaningless and it is charged as coverage instead. cell 3 is a content card,
          // whose wash bandtext.mjs owns. cell 0 is an unprobed cell, and cell 1 is open.
          if (cell === 2) opaqueInk += 1;
          else if (cell === 4) veil.push(cr);
          else if (cell === 3) cardInk += 1;
          else if (cell === 1) open.push(cr);
        }
      }
      const ink = veil.length + open.length + opaqueInk + cardInk;
      if (ink >= MIN_INK) {
        note(box.id, box, {
          veil,
          open,
          totalInk: ink,
          opaqueInk,
          openInk: open.length,
          veilInk: veil.length,
          cardInk,
          unprobedInk: totalInk - ink,
          opaquePct: (opaqueInk / ink) * 100,
          // Everything the viewer can still see of the body: open, veiled, or over a card.
          visibleShare: (veil.length + open.length + cardInk) / ink,
        });
      }
    }
  }

  // How much of the foreground the canopy draws, measured by hiding it. Reported so a
  // depth where the veil is off screen is visible in the output rather than assumed.
  const { painted } = await shoot();
  await page.addStyleTag({ content: HIDE_FG });
  await page.waitForTimeout(300);
  const noFoliage = await decode(page, await page.screenshot());
  await page.addStyleTag({ content: HIDE_FG.replace('hidden', 'visible') });
  await page.waitForTimeout(200);

  console.log(`\n[${label}] ${apeCount} apes on screen, ${FRAMES.length} pinned frames`);

  let occludedJudged = 0;
  let worstVeil = null;
  let worstHiddenPct = null;
  let subjectBest = null;
  let subjectHiddenBest = null; // share of body left visible, for a subject carried by framing
  const judged = [...best.entries()].sort((a, b) => b[1].width - a[1].width);
  for (const [id, s] of judged) {
    const subject = s.width >= SUBJECT_PX;
    const hidden = s.worstOpaquePct >= 1;
    if (hidden) {
      occludedJudged += 1;
      console.log(
        `  ape ${id} ${s.width}x${s.height} at y${s.y}: silhouette foliage covers up to ` +
          `${s.worstOpaquePct.toFixed(0)}% of its ink at the worst pinned pose, leaving ` +
          `${(s.minVisibleShare * 100).toFixed(0)}% visible`,
      );
      const wf = s.worstFrame;
      if (wf) {
        console.log(
          `      worst frame: ${wf.ink} ink px = ${wf.opaque} hidden / ${wf.open} open / ` +
            `${wf.veil} veiled / ${wf.card} over card / ${wf.unprobed} unprobed, ` +
            `walker alpha ${wf.apeAlpha}`,
        );
      }
      if (s.worstOpaquePct > MAX_HIDDEN_PCT) {
        failures.push(
          `${label}: ape ${id} is ${s.worstOpaquePct.toFixed(0)}% hidden by the foreground ` +
            'silhouette at some point in its walk, it stops being framing and becomes disappearance',
        );
      }
      if (worstHiddenPct === null || s.worstOpaquePct > worstHiddenPct) worstHiddenPct = s.worstOpaquePct;
      if (subject && (subjectHiddenBest === null || s.minVisibleShare > subjectHiddenBest)) {
        subjectHiddenBest = s.minVisibleShare * 100;
      }
    }
    if (s.worstVeil !== null) {
      console.log(
        `  ape ${id} ${s.width}x${s.height} at y${s.y}: behind a translucent wash, ` +
          `worst-frame median contrast ${s.worstVeil.toFixed(2)}:1`,
      );
      if (s.worstVeil < MIN_CONTRAST) {
        failures.push(`${label}: ape ${id} reads only ${s.worstVeil.toFixed(2)}:1 through the foliage veil`);
      }
      if (worstVeil === null || s.worstVeil < worstVeil) worstVeil = s.worstVeil;
    }
    if (s.bestOpen !== null) {
      console.log(
        `  ape ${id} ${s.width}x${s.height} at y${s.y}: in front of the foliage, ` +
          `best-frame median contrast ${s.bestOpen.toFixed(2)}:1 (walker alpha ${s.minApeAlpha})`,
      );
      if (subject && (subjectBest === null || s.bestOpen > subjectBest)) subjectBest = s.bestOpen;
    }
    if (s.worstVeil !== null || s.bestOpen !== null || hidden) continue;
    if (subject) {
      failures.push(
        `${label}: the ${s.width}px walker is on screen but contributes no measurable ink, ` +
          'it is washed out rather than seen',
      );
    }
  }
  // A walker big enough to be the subject has to survive the depth in some form. That is
  // either readable ink at 3:1 (open, or left readable by a translucent wash) or, for a
  // walker framed by opaque fronds, enough of its body left unhidden that it still reads as
  // an ape standing there rather than a smudge.
  if (subjectBest === null) {
    if (subjectHiddenBest === null) {
      failures.push(
        `${label}: no walker ${SUBJECT_PX}px or wide was measurable, nothing can carry the subject`,
      );
    } else {
      console.log(
        `  best walker >=${SUBJECT_PX}px carries the subject by framing alone: ` +
          `${subjectHiddenBest.toFixed(0)}% of it stays visible at the worst pose ` +
          `(floor ${100 - MAX_HIDDEN_PCT}%)`,
      );
    }
  } else {
    console.log(`  best walker >=${SUBJECT_PX}px: ${subjectBest.toFixed(2)}:1 (floor ${MIN_CONTRAST}:1)`);
    if (subjectBest < MIN_CONTRAST) {
      failures.push(`${label}: the best large walker manages only ${subjectBest.toFixed(2)}:1`);
    }
  }
  if (worstVeil !== null) {
    console.log(`  worst ape behind a translucent wash: ${worstVeil.toFixed(2)}:1 (floor ${MIN_CONTRAST}:1)`);
  }
  if (worstHiddenPct !== null) {
    console.log(
      `  most hidden ape: ${worstHiddenPct.toFixed(0)}% of its ink covered by opaque foliage ` +
        `(ceiling ${MAX_HIDDEN_PCT}%)`,
    );
  } else {
    console.log('  no ape was behind the foliage at this depth');
  }
  occludedJudgedTotal += occludedJudged;

  // Is the foliage ever painted over words? Same hit-test as above, on text boxes.
  const overText = await page.evaluate((sel) => {
    const isCanopy = (el) => !!el?.closest?.('.canopy');
    const out = [];
    let boxes = 0;
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width < 6 || r.height < 6) continue;
      if (r.bottom < 0 || r.top > innerHeight) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
      let inFront = 0;
      let probed = 0;
      for (let y = r.top + 2; y < r.bottom - 1; y += 4) {
        for (let x = r.left + 2; x < r.right - 1; x += 4) {
          const top = document.elementFromPoint(Math.round(x), Math.round(y));
          if (!top) continue;
          probed += 1;
          if (isCanopy(top)) inFront += 1;
        }
      }
      if (!probed) continue;
      boxes += 1;
      if (inFront) {
        out.push({
          label: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 24) || el.className,
          pct: +((inFront / probed) * 100).toFixed(1),
        });
      }
    }
    return { offenders: out, boxes };
  }, TEXT);

  console.log(`  text boxes probed for foliage on top: ${overText.boxes}`);
  if (!overText.offenders.length) console.log('  canopy painted over text: nowhere');
  for (const t of overText.offenders) console.log(`  canopy painted over text: "${t.label}" at ${t.pct}% of sampled points`);
  if (overText.offenders.length) failures.push(`${label}: canopy paints over ${overText.offenders.length} text element(s)`);
  if (!overText.boxes) failures.push(`${label}: no text was on screen, the foliage-over-words check is vacuous`);

  // Anti-vacuous: the veil must actually be painting, or the occlusion half of every
  // measurement above passed by measuring nothing.
  let paintedPct = 0;
  for (let p = 0; p < painted.d.length; p += 4) if (differs(painted, noFoliage, p)) paintedPct += 1;
  paintedPct = (paintedPct / (painted.w * painted.h)) * 100;
  console.log(
    `  foreground foliage paints ${paintedPct.toFixed(1)}% of the viewport, ` +
      `${occludedJudged} ape(s) judged behind it`,
  );
  if (paintedPct < 1) {
    failures.push(`${label}: foreground draws only ${paintedPct.toFixed(1)}% of the viewport, the veil is not on screen`);
  }
  depthsProbed += 1;

  await page.context().close();
}

await browser.close();

if (!occludedJudgedTotal) {
  failures.push(
    `no ape anywhere on the page was found behind the canopy across ${depthsProbed} depths, ` +
      'the occlusion half of this check never fired',
  );
}

if (failures.length) {
  console.error('\nFAIL');
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`\nthe canopy frames the apes: ${MIN_CONTRAST}:1 or better through the veil, never over words`);
