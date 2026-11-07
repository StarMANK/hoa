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
    (x, y, px, py) => {
      if (!node || reduced) return;
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const rect = node.getBoundingClientRect();
        const nx = (x - rect.left) / Math.max(rect.width, 1) - 0.5;
        const ny = (y - rect.top) / Math.max(rect.height, 1) - 0.5;
        node.style.setProperty('--px', `${(px * scale).toFixed(3)}`);
        node.style.setProperty('--py', `${(py * scale).toFixed(3)}`);
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
        setVars(event.clientX, event.clientY, event.clientX, event.clientY),
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
    let dir = 0;

    const tick = () => {
      const y = window.scrollY;
      const delta = y - last;
      last = y;
      glow = Math.max(0, Math.min(1, glow * 0.9 + Math.abs(delta) * 0.006));
      if (Math.abs(delta) > 0.5) dir = delta > 0 ? 1 : -1;
      const progress = Math.min(
        1,
        y / Math.max(1, document.documentElement.scrollHeight - window.innerHeight),
      );
      node.style.setProperty('--scroll-glow', glow.toFixed(3));
      node.style.setProperty('--scroll-dir', String(dir));
      node.style.setProperty('--scroll-progress', progress.toFixed(4));
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [node, reduced]);

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

export function useScrambleText(text, { active = true, speed = 34 } = {}) {
  const [output, setOutput] = useState(() => text);
  const pool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#*/\\<>*';

  useEffect(() => {
    if (!active || typeof window === 'undefined' || typeof setInterval !== 'function') {
      setOutput(text);
      return undefined;
    }

    let frame = 0;
    const timer = setInterval(() => {
      frame += 1;
      const progress = frame / 2;
      setOutput(
        text
          .split('')
          .map((char, index) => {
            if (char === ' ') return ' ';
            if (index < progress) return char;
            return pool[Math.floor(Math.random() * pool.length)];
          })
          .join(''),
      );
      if (progress >= text.length) clearInterval(timer);
    }, speed);

    return () => clearInterval(timer);
  }, [text, active, speed]);

  return output;
}
