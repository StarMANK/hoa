import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (event) => setReduced(event.matches);
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', handler);
      return () => query.removeEventListener('change', handler);
    }
    return undefined;
  }, []);

  return reduced;
}

export function useActiveSection(ids, { rootMargin = '-45% 0px -50% 0px' } = {}) {
  const [active, setActive] = useState(() => ids[0] ?? 'home');

  useEffect(() => {
    if (typeof IntersectionObserver !== 'function') return undefined;
    const nodes = ids
      .map((id) => document.getElementById(id))
      .filter((node) => Boolean(node));
    if (!nodes.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) setActive(visible[0].target.id);
      },
      { rootMargin, threshold: [0, 0.25, 0.55, 0.9] },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [ids, rootMargin]);

  return active;
}

// Pointer driven CSS variables written straight to the node so mouse moves
// never trigger React re-renders.
export function usePointerVars({ scale = 1, reduced = false } = {}) {
  const [node, setNode] = useState(null);
  const frame = useRef(0);

  const setVars = useCallback(
    (x, y) => {
      if (!node || reduced) return;
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        // --px/--py are unitless multipliers consumed as `calc(var(--px) * Xrem)`,
        // so they must stay in -0.5..0.5. Viewport-relative keeps parallax
        // identical at any scroll position.
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        const nx = x / Math.max(window.innerWidth, 1) - 0.5;
        const ny = y / Math.max(window.innerHeight, 1) - 0.5;
        node.style.setProperty('--px', (nx * scale).toFixed(3));
        node.style.setProperty('--py', (ny * scale).toFixed(3));
        node.style.setProperty('--gx', `${x}px`);
        node.style.setProperty('--gy', `${y}px`);
        node.style.setProperty('--tilt-x', `${(ny * -9).toFixed(2)}deg`);
        node.style.setProperty('--tilt-y', `${(nx * 11).toFixed(2)}deg`);
        node.style.setProperty('--mx', `${(nx * 26).toFixed(2)}px`);
        node.style.setProperty('--my', `${(ny * 20).toFixed(2)}px`);
      });
    },
    [node, reduced, scale],
  );

  useEffect(() => () => {
    if (frame.current) cancelAnimationFrame(frame.current);
  }, []);

  const bind = useMemo(
    () => ({
      onPointerMove: (event) =>
        setVars(Number(event.clientX), Number(event.clientY)),
      onPointerLeave: () => {
        if (!node) return;
        node.style.setProperty('--px', '0');
        node.style.setProperty('--py', '0');
        node.style.setProperty('--tilt-x', '0deg');
        node.style.setProperty('--tilt-y', '0deg');
        node.style.setProperty('--mx', '0px');
        node.style.setProperty('--my', '0px');
      },
    }),
    [node, setVars],
  );

  return { ref: setNode, bind };
}

// Scroll velocity exposed as CSS variables for the whole shell.
export function useScrollGlow(reduced = false) {
  const [node, setNode] = useState(null);

  useEffect(() => {
    if (!node || reduced || typeof window === 'undefined') return undefined;
    let last = window.scrollY;
    let raf = 0;
    let glow = 0;

    const tick = () => {
      const y = window.scrollY;
      const delta = y - last;
      last = y;
      glow = Math.max(0, Math.min(1, glow * 0.9 + Math.abs(delta) * 0.006));
      const progress = Math.min(
        1,
        y / Math.max(1, document.documentElement.scrollHeight - window.innerHeight),
      );
      node.style.setProperty('--scroll-glow', glow.toFixed(3));
      node.style.setProperty('--scroll-progress', progress.toFixed(4));
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [node, reduced]);

  return setNode;
}

// Whole-page progress is the wrong clock for anything inside a long section.
// The trail is about a seventh of the page, so a bead driven by --scroll-progress
// only ever covered a sliver of its travel while the trail was on screen and sat
// parked off the end for the rest of the time it was visible. This exposes 0..1
// for one element's own pass through the viewport, which is what its children are
// actually asking about.
//
// Normalised to 0..1 across the tracked element's visible life: 0 at the scroll
// position where it first appears, 1 where it finally leaves. That is the
// definition that makes motion land where it can be seen, and the two obvious
// alternatives both fail on real elements of this page:
//  - whole-page progress left the trail's light bead sweeping a tenth of the line
//    while the trail filled the screen, and a logo glint 7% of its own width.
//  - progress over the element's own full pass (entering from below to gone above)
//    is unreachable at both ends: the hero is already at the top on load, so it
//    can never use the first half of that scale, and the join band is the last
//    thing before the footer, so the page runs out of scroll while it is still on
//    screen and it can never use the second.
//
// Track the element that carries the transform, not its section. The hero's glint
// sits inside the hero but inset from it, so it leaves the viewport early and a
// hero-based clock only reached 0.53 of its range while the glint was visible.
export function useVisibleProgress(selector, { reduced = false } = {}) {
  const [node, setNode] = useState(null);

  useEffect(() => {
    if (!node || reduced || typeof window === 'undefined') return undefined;
    const targets = Array.from(node.querySelectorAll(selector));
    if (!targets.length) return undefined;

    let raf = 0;
    // Only write when the value actually moved, so a parked page does not
    // invalidate style on every frame.
    const lastValues = new Map();

    // How far an element with document-space top `top` has travelled through a
    // viewport of height `vh`: 0 as its top edge reaches the bottom of the
    // screen, 1 once its bottom edge has left through the top.
    const raw = (top, height, vh) => {
      const span = vh + height;
      return span > 0 ? Math.min(1, Math.max(0, (vh - top) / span)) : 0;
    };
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

    const tick = () => {
      const vh = window.innerHeight || 1;
      const scrollY = window.scrollY;
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
      for (const target of targets) {
        const rect = target.getBoundingClientRect();
        const docTop = rect.top + scrollY;
        // Scrolling does not change layout, so the scroll positions where the
        // element appears and disappears follow from where it is now.
        const appearAt = clamp(docTop - vh, 0, maxScroll);
        const leaveAt = clamp(docTop + rect.height, 0, maxScroll);
        const first = raw(docTop - appearAt, rect.height, vh);
        const last = raw(docTop - leaveAt, rect.height, vh);
        const span = last - first;
        // An element that cannot traverse at all gets 0 rather than a division by
        // nothing: it is static, and a value here would only invent motion.
        const progress =
          span > 0.001 ? clamp((raw(rect.top, rect.height, vh) - first) / span, 0, 1) : 0;
        const previous = lastValues.get(target);
        if (previous === undefined || Math.abs(previous - progress) > 0.001) {
          target.style.setProperty('--visible-progress', progress.toFixed(4));
          lastValues.set(target, progress);
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [node, selector, reduced]);

  return setNode;
}

// One observer powers the whole page: anything matching REVEAL_SELECTOR gets
// `is-in` when it scrolls into frame, which drives .reveal fades, the SVG
// carve-on strokes and the data bars. Keeps motion language consistent and
// avoids one observer per component.
const REVEAL_SELECTOR = '.reveal, .chapter, .genres, .glyph, [data-reveal]';

export function useRevealRoot({ threshold = 0.16, rootMargin = '0px 0px -6% 0px' } = {}) {
  const [node, setNode] = useState(null);

  useEffect(() => {
    if (!node) return undefined;

    const targets = Array.from(node.querySelectorAll(REVEAL_SELECTOR));
    const show = (entryTarget) => entryTarget.classList.add('is-in');

    if (typeof IntersectionObserver !== 'function') {
      targets.forEach(show);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          show(entry.target);
          observer.unobserve(entry.target);
        });
      },
      { threshold, rootMargin },
    );

    targets.forEach((target) => observer.observe(target));

    // Panels mounted later (none today, but cheap insurance) still get watched.
    const mutation =
      typeof MutationObserver === 'function'
        ? new MutationObserver((records) => {
            records.forEach((record) =>
              Array.from(record.addedNodes).forEach((child) => {
                if (!(child instanceof Element)) return;
                const found = child.matches(REVEAL_SELECTOR) ? [child] : Array.from(child.querySelectorAll(REVEAL_SELECTOR));
                found.forEach((target) => observer.observe(target));
              }),
            );
          })
        : null;
    mutation?.observe(node, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutation?.disconnect();
    };
  }, [node, threshold, rootMargin]);

  return setNode;
}

export function useCountUp(target, { duration = 1400, decimals = 0 } = {}) {
  const [node, setNode] = useState(null);
  const [value, setValue] = useState(() => (target > 1000 ? target : 0));

  useEffect(() => {
    if (
      !node ||
      typeof IntersectionObserver !== 'function' ||
      typeof node.animate !== 'function'
    ) {
      setValue(target);
      return undefined;
    }

    let raf = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const from = 0;
        const started = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - started) / duration);
          const eased = 1 - (1 - t) ** 3;
          const next = from + (target - from) * eased;
          setValue(Number(next.toFixed(decimals)));
          if (t < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [node, target, duration, decimals]);

  return { ref: setNode, value };
}
