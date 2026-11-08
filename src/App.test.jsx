import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';

const DISCORD = 'https://discord.gg/E7xcUNAGFD';

// True when the var() whose name just ended at `from` carries a fallback: a
// comma at the call's own paren depth, before the closing paren. Nested vars
// like var(--a, var(--b, 1)) have to be walked by depth or the inner comma is
// mistaken for the outer one.
const hasFallback = (text, from) => {
  let depth = 1;
  for (let i = from; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return false;
    } else if (ch === ',' && depth === 1) return true;
  }
  return false;
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Hall Of Apes origin wall', () => {
  it('presents the identity and the BLG to HoA story', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: /Hall Of Apes/i })).toBeInTheDocument();
    expect(screen.getByText(/Dari BLG ke HoA/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Blasteran Gorilla Babi/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/JOSGC/i).length).toBeGreaterThan(0);
  });

  it('links players to the Hall Of Apes Discord from every call to action', () => {
    render(<App />);

    expect(screen.getByRole('link', { name: /Join Discord/i })).toHaveAttribute('href', DISCORD);
    expect(screen.getByRole('link', { name: /Join Kawanan/i })).toHaveAttribute('href', DISCORD);
  });

  it('keeps the wall landmark and chapter rail navigable', () => {
    render(<App />);

    expect(screen.getByRole('main', { name: /Hall Of Apes origin wall/i })).toBeInTheDocument();

    const rail = screen.getByRole('navigation', { name: /Chapter timeline/i });
    expect(rail).toBeInTheDocument();
    ['HOME', '2024', 'BLG', 'JOSGC', 'Beyond', 'HoA'].forEach((label) => {
      expect(within(rail).getByRole('link', { name: new RegExp(label, 'i') })).toHaveAttribute(
        'href',
        expect.stringMatching(/^#/),
      );
    });
  });

  it('shows every origin chapter with its carved mark', () => {
    render(<App />);

    const trail = screen.getByRole('region', { name: /Origin trail timeline/i });
    ['BLG Dibentuk', 'Gorilla, Babi, Segitiga', 'Kawanan Tumbuh', 'Lintas Genre', 'Nama Baru, Api Sama'].forEach(
      (title) => {
        expect(within(trail).getByRole('heading', { level: 2, name: new RegExp(title, 'i') })).toBeInTheDocument();
      },
    );

    // Old symbols survive as content, not emoji markup.
    expect(within(trail).getByRole('heading', { name: /Ace of Spades/i })).toBeInTheDocument();
    expect(screen.getByText(/smbdy/i)).toBeInTheDocument();
  });

  it('scrolls to a chapter when the rail is used and respects reduced motion', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(<App />);

    fireEvent.click(screen.getByRole('link', { name: /JOSGC/i }));

    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: 'start' }),
    );
  });

  it('renders new content bands without leaking placeholder copy', () => {
    render(<App />);

    expect(screen.getByRole('region', { name: /Facts about the kawanan/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Satu Kawanan, Banyak Medan/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Empat Aturan Dinding/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Masuk Kawanan/i })).toBeInTheDocument();
    expect(screen.queryByText(/lorem|ipsum|TODO/i)).not.toBeInTheDocument();
  });

  it('does not leave content invisible when IntersectionObserver is unavailable', () => {
    // jsdom has no IntersectionObserver, so the reveal layer must opt everything in.
    delete global.IntersectionObserver;
    render(<App />);

    expect(document.querySelectorAll('.reveal:not(.is-in)').length).toBe(0);
    expect(document.querySelectorAll('.chapter:not(.is-in)').length).toBe(0);
  });

  it('draws carved marks without non-scaling-stroke', () => {
    render(<App />);

    // pathLength="1" drives the carve reveal via stroke-dasharray. Chromium
    // applies that dash in device space when vector-effect is
    // non-scaling-stroke, so every scaled mark stopped mid-path.
    const paths = document.querySelectorAll('svg .carve');
    expect(paths.length).toBeGreaterThan(0);
    paths.forEach((path) => {
      expect(path.getAttribute('vector-effect')).toBeNull();
      // SVG attribute names are case sensitive: it is pathLength, not lowercase.
      expect(path.getAttribute('pathLength')).toBe('1');
    });
  });

  it('keeps pointer parallax vars inside the range CSS multiplies by rem', async () => {
    render(<App />);
    const world = document.querySelector('.world');

    // Rules consume these as calc(var(--px) * 1.6rem). Writing raw client
    // pixels here shifted the parallax layers about 27000px off screen.
    // jsdom lacks PointerEvent, so dispatch a MouseEvent under that name.
    await act(async () => {
      fireEvent(
        world,
        new MouseEvent('pointermove', { clientX: 820, clientY: 640, bubbles: true }),
      );
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    });

    ['--px', '--py'].forEach((name) => {
      const value = Number(world.style.getPropertyValue(name));
      expect(Number.isFinite(value)).toBe(true);
      expect(Math.abs(value)).toBeLessThanOrEqual(1);
    });
  });

  it('puts apes on the page as the subject, not as decoration that can vanish', () => {
    render(<App />);

    // The whole rework exists to make the kawanan the persistent subject, so
    // the layers that carry it are load bearing and must not be removed.
    expect(document.querySelectorAll('.roam__walker').length).toBeGreaterThanOrEqual(8);
    expect(document.querySelectorAll('.procession__walker').length).toBe(5);
    expect(document.querySelector('.roam')).not.toBeNull();

    // Every silhouette is joint data, so a pose regression silently drops limbs.
    // An ape is exactly 6 groups (near/far arm, near/far leg, trunk, skull) and
    // exactly 10 paths: one round-capped stroke per limb segment (8), the trunk
    // sweep, and the filled skull.
    const apes = document.querySelectorAll('.ape');
    expect(apes.length).toBeGreaterThan(0);
    apes.forEach((svg) => {
      expect(svg.querySelectorAll('g').length).toBe(6);
      expect(svg.querySelectorAll('path').length).toBe(10);
    });
  });

  it('keeps the procession announced and the roam layer silent', () => {
    render(<App />);

    // One ape is the picture worth announcing; the rest is atmosphere and would
    // otherwise be 20 unlabeled images read out to a screen reader.
    expect(screen.getByRole('img', { name: /Kawanan berjalan/i })).toBeInTheDocument();
    expect(document.querySelectorAll('.roam__walker .ape[aria-hidden="true"]').length).toBeGreaterThan(0);
    expect(document.querySelector('.roam').getAttribute('aria-hidden')).toBe('true');
  });

  it('gives every walker a rest position so reduced motion keeps the kawanan', () => {
    render(<App />);

    // Under prefers-reduced-motion the walk animation is switched off and each
    // walker is parked at --rest instead of its final keyframe offscreen at
    // 125vw, which used to make the subject disappear entirely.
    const walkers = [...document.querySelectorAll('.roam__walker')];
    expect(walkers.length).toBeGreaterThan(0);
    walkers.forEach((node) => {
      const rest = node.style.getPropertyValue('--rest');
      expect(rest).toMatch(/^\d+(\.\d+)?vw$/);
    });

    // Staggered, otherwise a reduced-motion load stacks the whole kawanan at
    // one x and looks like a single smeared blob.
    const restValues = new Set(walkers.map((n) => n.style.getPropertyValue('--rest')));
    expect(restValues.size).toBe(walkers.length);
  });
});

// The accent is the logo, so its value is a measurement, not a taste call, and
// it drifted once already: the token said #fcfcfc under a comment claiming that
// was the sample, when every opaque pixel of the mark is #ffffff. jsdom hands
// back empty strings for anything involving var(), so these read the stylesheet
// text instead of the DOM - see scripts/palette.mjs for the live-pixel check.
describe('palette integrity', () => {
  const readStyles = () => {
    // import.meta.url goes through Node's fileURLToPath rather than `new URL`:
    // the URL global under jsdom is jsdom's own, and fs rejects its instances.
    const dir = join(dirname(fileURLToPath(import.meta.url)), 'styles');
    const files = ['tokens.css', 'base.css', 'index.css', 'trail.css', 'world.css'];
    return Object.fromEntries(files.map((f) => [f, readFileSync(join(dir, f), 'utf8')]));
  };
  const allStyles = readStyles();
  const tokens = allStyles['tokens.css'];

  it('matches the accent to the measured logo white', () => {
    // Sampled with scripts/palette.mjs: 890,036 opaque pixels, one unique
    // colour, max channel delta 0. Any other value here is an approximation
    // that someone has had to defend after the fact.
    expect(tokens).toMatch(/--accent:\s*#ffffff;/);
  });

  it('keeps every white in the palette at the one logo white', () => {
    // #fcfcfc and rgba(252,252,252) survived in 60 places alongside a token
    // that claimed to be the logo. One source means the claim can be checked.
    // Comments are stripped first: prose about the old value is not a use of it.
    const drift = Object.entries(allStyles).flatMap(([file, text]) =>
      (text
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .match(/#fcfcfc|252,\s*252,\s*252/gi) ?? []).map((hit) => `${file}: ${hit}`),
    );
    expect(drift).toEqual([]);
  });

  it('never references a custom property it does not define', () => {
    // Deleting a token that looked unused took out --canopy, which was live in
    // world.css: a var() that resolves to nothing silently paints transparent.
    // An undefined name is only survivable with a fallback, so both halves of
    // `var(--name, fallback)` have to be looked at, not just the name.
    const defined = new Set();
    const calls = [];
    for (const [file, text] of Object.entries(allStyles)) {
      for (const m of text.matchAll(/^\s*(--[\w-]+):/gm)) defined.add(m[1]);
      for (const m of text.matchAll(/var\(\s*(--[\w-]+)/g)) {
        calls.push({ file, name: m[1], hasFallback: hasFallback(text, m.index + m[0].length) });
      }
    }
    const bare = calls.filter((c) => !defined.has(c.name) && !c.hasFallback);
    expect(bare.map((c) => `${c.file} ${c.name}`)).toEqual([]);
  });

  it('keeps declared palette tokens in use', () => {
    const palette = [...tokens.matchAll(/^\s*(--[\w-]+):\s*(#[0-9a-f]{3,8}|rgba?\()/gmi)].map((m) => m[1]);
    const others = Object.entries(allStyles).filter(([f]) => f !== 'tokens.css');
    const stale = palette.filter(
      (name) => !others.some(([, text]) => text.includes(`var(${name})`) || text.includes(`var(${name} `)),
    );
    expect(stale).toEqual([]);
  });

  it('drives every --visible-progress transform from a tracked element', () => {
    // --visible-progress is written onto the element a selector names in App.jsx.
    // A CSS rule that reads it on any other element resolves to the :root 0 and
    // the animation silently stops - exactly the trail-bead bug in a new costume,
    // and invisible to every other test here. Read App.jsx as text because the
    // selector list is a plain const, not a component boundary.
    const app = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'App.jsx'), 'utf8');
    const declared = app.match(/const PROGRESS_TARGETS = '([^']*)'/)?.[1] ?? '';
    const tracked = declared
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    expect(tracked.length).toBeGreaterThan(0);

    const users = Object.entries(allStyles).flatMap(([file, text]) =>
      (text.includes('--visible-progress') && file !== 'tokens.css' ? [file] : []),
    );
    expect(users.length).toBeGreaterThan(0);

    // Every tracked selector has to exist in the markup, or the hook writes to
    // nothing and the matching rule sits at 0 forever.
    render(<App />);
    const missing = tracked.filter((sel) => !document.querySelector(sel));
    expect(missing).toEqual([]);

    // And each file that reads the variable must be one of the tracked elements'
    // own rules. Pseudo-elements inherit the variable from their originating
    // element, so `::after` counts as that element reading it.
    const owners = new Set(tracked.map((sel) => sel.replace(/::?[a-z-]+$/, '')));
    const orphanRules = [];
    for (const [file, text] of Object.entries(allStyles)) {
      for (const m of text.matchAll(/([^{}]+)\{[^}]*var\(--visible-progress/g)) {
        orphanRules.push({
          file,
          selector: m[1].trim().replace(/\s+/g, ' ').replace(/::?[a-z-]+$/, ''),
        });
      }
    }
    const orphans = orphanRules.filter((r) => r.selector && ![...owners].some((o) => r.selector.includes(o)));
    expect(orphans.map((o) => `${o.file} ${o.selector}`)).toEqual([]);
  });
});
