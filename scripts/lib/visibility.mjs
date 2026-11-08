// Effective opacity, evaluated inside the page. A walker's own opacity is only
// ever one factor: the roam layer, the .procession container and any ancestor
// animation multiply into it, and one ancestor at 0 erases everything below
// regardless of its own value. Reading getComputedStyle(node).opacity alone
// reported 8 visible apes on a phone where 3 were display:none and the rest sat
// at an effective 0.21, so the number was confidently wrong twice over.
//
// Usage: pass this straight to page.evaluate, with the selector as its argument.
// Playwright serialises the function itself, so it must stay standalone: no
// closure over anything from node, and no helpers defined outside it.
export const effectiveOpacityProbe = (selector) => {
  const VISIBLE = 0.05;
  const vh = window.innerHeight;
  const rows = [];
  for (const host of document.querySelectorAll(selector)) {
    const cs = getComputedStyle(host);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = host.getBoundingClientRect();
    let eff = 1;
    let culledBy = null;
    for (let p = host; p && p.nodeType === 1; p = p.parentElement) {
      const o = Number(getComputedStyle(p).opacity);
      if (o === 0 && !culledBy) {
        culledBy =
          p.className && typeof p.className === 'string'
            ? p.className.split(' ')[0]
            : p.tagName.toLowerCase();
      }
      eff *= o;
    }
    rows.push({
      kind: String(host.className).split(' ')[0],
      eff: +eff.toFixed(3),
      own: +cs.opacity,
      culledBy,
      w: Math.round(r.width),
      h: Math.round(r.height),
      y: Math.round(r.y),
      onScreen: r.bottom > 0 && r.top < vh && r.width > 0,
    });
  }
  const world = document.querySelector('.world');
  return {
    // --scroll-progress is what gates the roam layer, so any read of walker
    // visibility is meaningless without it.
    progress: world ? getComputedStyle(world).getPropertyValue('--scroll-progress').trim() : null,
    rows,
    visible: rows.filter((x) => x.onScreen && x.eff >= VISIBLE),
    // What is in the DOM but cannot be seen, and which ancestor erased it.
    culled: [...new Set(rows.filter((x) => x.eff < VISIBLE).map((x) => x.culledBy ?? `own ${x.own}`))],
  };
};
