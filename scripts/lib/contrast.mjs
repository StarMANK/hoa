// Contrast ratio, WCAG 2.1 definition, in one place.
//
// Two probes in this repo were reporting the same ape at 9.13:1 and 2.23:1 and both were
// internally consistent, which is the worst kind of wrong. They used different luminance
// functions: one linearised the sRGB channel (the standard gamma expansion WCAG calls for),
// the other treated the 0-255 value as if it were linear light. On near-black pixels that
// assumption is off by a factor of 20, so the naive version collapses every ratio toward 1
// for dark ink and inflates it for anything brighter, which happens to flatter a dark page.
// A dark-themed site is precisely where the mistake hides, and it is the exact place it
// matters, because the difference between 2.9:1 and 3.0:1 is the WCAG pass line.
//
// Both scripts now import from here. Do not "simplify" srgb back to c/255.

// Linearise one 0-255 sRGB channel.
const srgb = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

// Relative luminance of an RGBA byte array at pixel offset p (index into a getImageData
// buffer, i.e. already multiplied by 4).
export const lum = (a, p) =>
  0.2126 * srgb(a.d[p]) + 0.7152 * srgb(a.d[p + 1]) + 0.0722 * srgb(a.d[p + 2]);

export const lumRgb = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);

// WCAG contrast ratio between two relative luminances. Range 1-21.
export const ratio = (x, y) => (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);

// Contrast ratio between two decoded frames at one pixel offset: what a viewer sees where
// the top layer changes. Assumes the frames differ only in the layer being measured, so
// the composite difference is that layer's own contribution.
export const pixelRatio = (top, bottom, p) => ratio(lum(top, p), lum(bottom, p));
