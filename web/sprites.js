// Sprite atlas loading, hero recoloring from the player's Squeek palette.

export const TILE = 16;
const FUR = ["#E8B07A", "#C98A54", "#8A5A34"]; // light, mid, dark placeholders in hero frames

const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

export async function loadAtlas(base = "./assets/sprites") {
  const [img, json] = await Promise.all([
    new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = `${base}.png`; }),
    fetch(`${base}.json`).then((r) => r.json()),
  ]);
  return { img, frames: json.frames };
}

/** Returns a canvas holding a recolored copy of the given frames (hero only). */
export function recolor(atlas, names, ramp) {
  const out = {};
  const from = FUR.map(hexToRgb);
  for (const name of names) {
    const f = atlas.frames[name]?.frame;
    if (!f) continue;
    const c = document.createElement("canvas");
    c.width = f.w; c.height = f.h;
    const g = c.getContext("2d");
    g.drawImage(atlas.img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    if (ramp) {
      const data = g.getImageData(0, 0, f.w, f.h);
      const d = data.data;
      for (let p = 0; p < d.length; p += 4) {
        for (let k = 0; k < 3; k++) {
          if (d[p] === from[k][0] && d[p + 1] === from[k][1] && d[p + 2] === from[k][2]) {
            [d[p], d[p + 1], d[p + 2]] = ramp[k];
            break;
          }
        }
      }
      g.putImageData(data, 0, 0);
    }
    out[name] = c;
  }
  return out;
}

/**
 * Builds a 3-step fur ramp from a Squeek's onchain SVG. The SVG is only read as text to find
 * its `color="#rrggbb"` groups; it is never injected into the page.
 */
export function rampFromSvg(svgText) {
  const counts = new Map();
  for (const m of svgText.matchAll(/color="(#[0-9A-Fa-f]{6})"/g)) {
    const hex = m[1].toUpperCase();
    const [r, g, b] = hexToRgb(hex);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum < 40) continue; // skip near-black background tones
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  if (!counts.size) return null;
  const main = hexToRgb([...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  return [mix(main, [255, 255, 255], 0.3), main, mix(main, [0, 0, 0], 0.45)];
}

export function drawFrame(g, atlas, name, x, y, { flip = false, alpha = 1, src = null } = {}) {
  const f = atlas.frames[name]?.frame;
  if (!f && !src) return;
  g.save();
  g.globalAlpha = alpha;
  if (flip) {
    g.translate(Math.round(x) + (f?.w ?? src.width), Math.round(y));
    g.scale(-1, 1);
    if (src) g.drawImage(src, 0, 0); else g.drawImage(atlas.img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  } else if (src) {
    g.drawImage(src, Math.round(x), Math.round(y));
  } else {
    g.drawImage(atlas.img, f.x, f.y, f.w, f.h, Math.round(x), Math.round(y), f.w, f.h);
  }
  g.restore();
}
