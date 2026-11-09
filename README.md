# Hall Of Apes

Landing page for [Hall Of Apes](https://discord.gg/E7xcUNAGFD) (formerly BLG,
Blasteran Gorilla Babi), a cross-genre gaming community. The page tells the
origin trail: how the kawanan started in Squad and milsim in 2024, the old
symbols, growing through the scene, branching past FPS, and the rename to HoA.
Same fire, new name.

React + Vite, no router, no state library. Everything is one scrolling page.

## Visual direction

The page is a jungle at night. There is no colour in the hue sense. The whole
scheme is measured off `hoa_logo.png` (see `scripts/palette.mjs`): the mark is
exactly one opaque colour, `#ffffff`, so the accent is that white and nothing
else. Depth is done with layers fading toward the page void, not with gradients
of hue:

- `--night` `#060809` is the void, `--canopy` `#070b09` the treeline.
- `--bone` `#f3f0e7` is the second voice for quieter copy.
- The single accent is pure logo white `#ffffff`, 20.1:1 on the void.

The apes are the subject, not decoration. Silhouette walkers roam the page
behind the content at every scroll position and must never vanish behind an
opaque band or a dissolve mask. That premise is a gate, not a vibe:
`npm run gate:apes` and `npm run gate:apescroll` fail if the apes stop being
visible pixels. `npm run gate:bandtext` holds the other side of the deal, text
legible while an ape crosses behind it.

The favicon is the logo itself: a square crop of the procession from
`hoa_logo.png` (`public/favicon.png`, `apple-touch-icon.png`).

## Running it

```sh
npm install
npm run dev      # vite dev server on :5173
npm test         # vitest, jsdom
npm run build    # -> dist/
npm run preview  # serve dist/
```

## Validation philosophy

No visual claim in this repo is accepted on code reasoning. If a comment,
report, or commit message says something is visible, legible, moving, or on
screen, there is a number behind it from a real browser: Playwright screenshots
diffed, pixels sampled, contrast computed from rendered luminance. Code that
looks correct has been wrong here repeatedly (a mask that erased the procession,
a light that painted nothing, "presence" that measured 0.16 effective alpha),
so the browser is the only allowed witness.

`npm test` covers structure and behaviour in jsdom. The real visual claims are
in `scripts/`: headless Chromium probes that measure the running dev server at
`http://localhost:5173/`. Start `npm run dev` first.

## Commands

```sh
npm run gates   # all 12 gating probes, each must exit 0
npm run shots   # deterministic screenshot pass -> shots/ (gitignored)
```

Individual gates:

| Command | What it proves, in one line |
| --- | --- |
| `gate:apes` | The ape silhouettes are valid as rendered pixels (shape, ink, no degenerate walkers). |
| `gate:apescroll` | A minimum number of apes is actually on screen through the whole page. |
| `gate:bandtext` | Text stays legible while apes cross behind content bands. |
| `gate:canopy` | The canopy veil adds depth without erasing the subject. |
| `gate:hue` | The page is achromatic, accent is exactly logo white, mobile included. |
| `gate:mask` | The procession's dissolve gradient matches predicted maths, column by column. |
| `gate:fold` | Enough apes are visible in the first viewport, before any scroll. |
| `gate:hint` | The hero scroll cue is legible. |
| `gate:proclegible` | Brighter apes never sit under legible text without being behind it. |
| `gate:procspeed` | Walkers actually travel across a full stride cycle (not a stalled transform). |
| `gate:travel` | Scroll-driven transforms move while the section is on screen. |
| `gate:a11y` | Reduced motion leaves nothing invisible; landmarks and labels hold. |

Everything else in `scripts/` is a measurement tool from the work, kept because
they are how a regression gets diagnosed rather than guessed: `audit.mjs`
(box overlap on mobile), `overlap.mjs`, `fold`-family (`abmobile.mjs`,
`mobilestack.mjs`), the trail-light family (`threadbead.mjs`, `threadpixels.mjs`,
`threadrows.mjs`, `threadvisible.mjs`, `threadlook.mjs`, `beadbox.mjs`),
`herolife.mjs`, `procmask.mjs`, `proccover.mjs`, `palette.mjs`, `probe.mjs`
(horizontal overflow), `apeshape.mjs` (the ape silhouettes authoring tool whose
paths get copied into `src/components/Apes.jsx`), and the screenshot tools
(`shoot.mjs`, `marks.mjs`, `sections.mjs`, `settle.mjs`, `trailshots.mjs`,
`hero.mjs`).

The probes that need Chromium take the binary from `CHROME_PATH`, defaulting to
the locally Playwright-installed Chromium. On systems whose Chromium needs extra
shared libraries, export `LD_LIBRARY_PATH` accordingly before `npm run gates`.

## Layout

```
index.html            head, fonts, favicon links
hoa_logo.png          the real logo, source of the palette and the favicon
public/               favicon.png, apple-touch-icon.png
src/
  main.jsx            mount
  App.jsx             page assembly, scroll progress, nav
  data/content.js     all copy and data (discord, chapters, symbols, ...)
  components/
    Apes.jsx          silhouette walkers + roam layer (authored paths)
    World.jsx         canopy, hero, seam marquee, kinetic type
    Sections.jsx      trail chapters, data band, genres, rules, join, footer
    Marks.jsx         old symbol art (gorilla, triangle, spade)
  styles/             tokens.css (measured palette), world.css, trail.css, base.css
scripts/              browser probes; npm run gates / gate:* / shots
```
