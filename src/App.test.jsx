import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';

const DISCORD = 'https://discord.gg/E7xcUNAGFD';

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
