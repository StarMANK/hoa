import { useCallback, useEffect, useMemo, useState } from 'react';
import logoUrl from '../hoa_logo.png';
import {
  brand,
  chapters,
  discordUrl,
  footer,
  hero,
  join,
} from './data/content.js';
import { useActiveSection, usePointerVars, useReducedMotion, useRevealRoot, useScrollGlow } from './hooks/useMotion.js';
import { EmberField, ScrollMeter, Seam, WallLayers } from './components/World.jsx';
import { DataBand, Footer, Genres, Hero, Join, Rail, Rules, Trail } from './components/Sections.jsx';

const navItems = [{ id: 'home', nav: 'HOME' }, ...chapters.map((c) => ({ id: c.id, nav: c.nav }))];

export default function App() {
  const reduced = useReducedMotion();
  const [active, setActive] = useState('home');
  const sectionIds = useMemo(() => navItems.map((item) => item.id), []);

  const revealRef = useRevealRoot();
  const scrollRef = useScrollGlow(reduced);
  const { ref: pointerRef, bind } = usePointerVars({ reduced });

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    if (window.location.hash) {
      window.history.replaceState(null, null, window.location.pathname);
    }
    const timer = setTimeout(() => {
      if (!navigator.userAgent.includes('jsdom')) window.scrollTo(0, 0);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const observed = useActiveSection(sectionIds);

  useEffect(() => {
    if (observed) setActive(observed);
  }, [observed]);

  const setRefs = useCallback(
    (node) => {
      revealRef(node);
      scrollRef(node);
      pointerRef(node);
    },
    [revealRef, scrollRef, pointerRef],
  );

  function handleNavClick(event, id) {
    event.preventDefault();
    setActive(id);
    document.getElementById(id)?.scrollIntoView({
      behavior: reduced ? 'auto' : 'smooth',
      block: 'start',
    });
  }

  return (
    <main
      className="world"
      ref={setRefs}
      aria-label="Hall Of Apes origin wall"
      onPointerMove={bind.onPointerMove}
      onPointerLeave={bind.onPointerLeave}
    >
      <a className="sr-only" href="#trail">
        Lewati ke origin trail
      </a>

      <WallLayers />
      <EmberField />
      <div className="cursor-flare" aria-hidden="true" />
      <ScrollMeter />

      <Rail items={navItems} active={active} onNavigate={handleNavClick} />

      <Hero discord={discordUrl} hero={hero} brand={brand} logoUrl={logoUrl} />
      <Seam />
      <Trail sections={chapters} />
      <DataBand />
      <Genres />
      <Rules />
      <Join join={join} discord={discordUrl} />
      <Footer footer={footer} />

      <p className="sr-only">
        Hall Of Apes dulunya BLG, {brand.predecessorLong}. Simbol lama: gorilla,
        babi, segitiga, dan ace of spades. Markas di Discord.
      </p>
    </main>
  );
}
