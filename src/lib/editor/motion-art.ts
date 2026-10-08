// «موشن جرافيكس» — the art the engine draws itself (no generator): a background for every beat (the palette's colour
// shifted a little each time, a soft glow, the palette's own texture) and the beat's decoration (a band behind the
// title, a ring behind the big number, a rail beside the points, quote marks, rings for the outro…), as SVG the
// server turns into PNG files of the project. Pure: the shapes are placed from the engine's measured layout, so they
// sit around the words, never on them. Deterministic: the same beat draws the same picture.

import type { Beat } from "./motion-build";
import type { Palette } from "./motion-build";

// ───────────── colours ─────────────

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c: number[]) => `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
/** `b` mixed into `a` by `k` (0 = a, 1 = b). */
export const mix = (a: string, b: string, k: number) => hex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * k));
const isDark = (h: string) => rgb(h).reduce((s, v) => s + v, 0) / 3 < 128;

/** The background of beat `i`: the palette's own, and three gentle shifts of it, never the same twice in a row. */
export function beatBackground(pal: Palette, i: number) {
  const dark = isDark(pal.bg);
  const variants = [pal.bg, mix(pal.bg, pal.second, 0.14), mix(pal.bg, pal.accent, 0.12), mix(pal.bg, dark ? "#ffffff" : "#000000", 0.07)];
  return variants[i % variants.length];
}

/** The transition into beat `i`'s background (a few kinds, cycled; the hook arrives with a hard cut). */
const TRANSITIONS = ["wipe", "slideLeft", "iris", "wipeDiagTR", "pushUp", "diamond", "clock", "uncoverLeft"];
export const beatTransition = (i: number) => ({ kind: TRANSITIONS[i % TRANSITIONS.length], ms: 420 });

// ───────────── drawing helpers (fractions of the frame → pixels) ─────────────

const seeded = (seed: number) => {
  let s = (seed * 9301 + 49297) % 233280;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
};

export interface ArtPiece {
  /** which picture (a key the commands refer to) */
  key: string;
  svg: string;
  /** pixel size of the picture (the frame, scaled) */
  w: number;
  h: number;
}

/** Where a beat's words sit (fractions of the frame), from the engine's layout: what the decoration is drawn around. */
export interface Anchors {
  /** the headline's centre y and height */
  head?: { y: number; h: number; w: number };
  value?: { y: number; h: number; w: number };
  items?: { y: number; h: number }[];
  quote?: { y: number; h: number; w: number };
  pill?: { y: number; h: number };
  /** the whole block of words: top and bottom */
  top: number;
  bottom: number;
}

const svgOpen = (w: number, h: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;

/** The texture of a palette, as a pattern over the frame (very faint). */
function texture(id: string, pal: Palette, w: number, h: number, seed: number): string {
  const ink = isDark(pal.bg) ? "#ffffff" : "#000000";
  const r = seeded(seed);
  switch (id) {
    case "night": {
      // a faint field of stars
      let s = "";
      for (let i = 0; i < 70; i++) s += `<circle cx="${(r() * w).toFixed(0)}" cy="${(r() * h).toFixed(0)}" r="${(0.6 + r() * 1.6).toFixed(1)}" fill="${ink}" opacity="${(0.08 + r() * 0.2).toFixed(2)}"/>`;
      return s;
    }
    case "paper":
      return `<defs><pattern id="tx" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.7" fill="${ink}" opacity="0.07"/></pattern></defs><rect width="${w}" height="${h}" fill="url(#tx)"/>`;
    case "riso":
      return `<defs><pattern id="tx" width="${Math.round(w / 36)}" height="${Math.round(w / 36)}" patternUnits="userSpaceOnUse"><circle cx="${(w / 72).toFixed(1)}" cy="${(w / 72).toFixed(1)}" r="${(w / 160).toFixed(1)}" fill="${pal.second}" opacity="0.1"/></pattern></defs><rect width="${w}" height="${h}" fill="url(#tx)"/>`;
    case "studio":
      return `<defs><pattern id="tx" width="${Math.round(w / 24)}" height="${Math.round(w / 24)}" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><rect width="1.5" height="${Math.round(w / 24)}" fill="${ink}" opacity="0.05"/></pattern></defs><rect width="${w}" height="${h}" fill="url(#tx)"/>`;
    default: {
      // majlis: an eight-point star lattice
      const u = Math.round(w / 7);
      const c = u / 2;
      const o = u * 0.36;
      const star = `M${c} ${c - o} L${c + o * 0.38} ${c - o * 0.38} L${c + o} ${c} L${c + o * 0.38} ${c + o * 0.38} L${c} ${c + o} L${c - o * 0.38} ${c + o * 0.38} L${c - o} ${c} L${c - o * 0.38} ${c - o * 0.38} Z`;
      return `<defs><pattern id="tx" width="${u}" height="${u}" patternUnits="userSpaceOnUse"><path d="${star}" fill="none" stroke="${pal.accent}" stroke-width="1.2" opacity="0.1"/></pattern></defs><rect width="${w}" height="${h}" fill="url(#tx)"/>`;
    }
  }
}

/** The background picture of beat `i`: its colour, a soft glow in one corner (moves beat to beat), the texture. */
export function backgroundSvg(pal: Palette, i: number, w: number, h: number): string {
  const bg = beatBackground(pal, i);
  const glow = [pal.accent, pal.second][i % 2];
  const spots = [
    [0.82, 0.18],
    [0.2, 0.8],
    [0.78, 0.78],
    [0.22, 0.22],
    [0.5, 0.1],
    [0.5, 0.92],
  ];
  const [gx, gy] = spots[i % spots.length];
  const R = Math.max(w, h) * 0.55;
  return `${svgOpen(w, h)}<rect width="${w}" height="${h}" fill="${bg}"/><defs><radialGradient id="g" cx="${(gx * w).toFixed(0)}" cy="${(gy * h).toFixed(0)}" r="${R.toFixed(0)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${glow}" stop-opacity="0.26"/><stop offset="0.55" stop-color="${glow}" stop-opacity="0.06"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/>${texture(pal.id, pal, w, h, i + 1)}</svg>`;
}

/** Quote marks drawn as shapes (no font needed): two drops. `open` points down-left (« opening), else up-right. */
function marks(x: number, y: number, s: number, color: string, opacity: number, flip: boolean) {
  const drop = (dx: number) => `<path d="M${dx} 0 a${s * 0.5} ${s * 0.5} 0 1 0 ${s} 0 a${s * 0.5} ${s * 0.5} 0 1 0 ${-s} 0 M${dx + s} 0 q0 ${s * 1.1} ${-s * 0.9} ${s * 1.5}" fill="${color}" stroke="${color}" stroke-width="${(s * 0.22).toFixed(1)}" stroke-linecap="round"/>`;
  return `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)})${flip ? " rotate(180)" : ""}" opacity="${opacity}">${drop(0)}${drop(s * 1.6)}</g>`;
}

/**
 * The decoration of one beat, drawn around its words: each kind its own shapes, in the palette's accents, faint
 * enough never to fight the text, never under a line of it (the band behind the title is the one exception, at a
 * tint the text stays readable on).
 */
export function decorationSvg(b: Beat, i: number, pal: Palette, a: Anchors, w: number, h: number): string {
  const r = seeded(i * 7 + 3);
  const X = (f: number) => (f * w).toFixed(1);
  const Y = (f: number) => (f * h).toFixed(1);
  const u = Math.min(w, h);
  const parts: string[] = [];
  const corner = (cx: number, cy: number, dirX: number, dirY: number) =>
    `<path d="M${X(cx)} ${Y(cy + dirY * 0.04)} L${X(cx)} ${Y(cy)} L${X(cx + dirX * 0.04)} ${Y(cy)}" fill="none" stroke="${pal.second}" stroke-width="${(u * 0.006).toFixed(1)}" stroke-linecap="round" opacity="0.7"/>`;
  const dots = (cx: number, cy: number, n: number, col: string) => {
    let s = "";
    for (let k = 0; k < n; k++) s += `<circle cx="${X(cx + (r() - 0.5) * 0.12)}" cy="${Y(cy + (r() - 0.5) * 0.08)}" r="${(u * (0.004 + r() * 0.006)).toFixed(1)}" fill="${col}" opacity="${(0.5 + r() * 0.4).toFixed(2)}"/>`;
    return s;
  };
  switch (b.kind) {
    case "title": {
      // a band behind the headline, tilted a little, and corner marks
      if (a.head) {
        const bh = a.head.h * 1.25;
        parts.push(`<g transform="rotate(-4 ${X(0.5)} ${Y(a.head.y)})"><rect x="${X(-0.1)}" y="${Y(a.head.y - bh / 2)}" width="${X(1.2)}" height="${Y(bh)}" fill="${pal.accent}" opacity="0.16"/></g>`);
      }
      parts.push(corner(0.06, 0.08, 1, 1), corner(0.94, 0.92, -1, -1), dots(0.14, 0.86, 7, pal.second));
      break;
    }
    case "statement": {
      // a brush line under the words and one small disc up and right
      if (a.head) {
        const y = a.head.y + a.head.h / 2 + 0.025;
        const half = Math.min(0.42, a.head.w / 2 + 0.03);
        parts.push(`<path d="M${X(0.5 + half)} ${Y(y)} Q${X(0.5)} ${Y(y + 0.012)} ${X(0.5 - half)} ${Y(y + 0.004)}" fill="none" stroke="${pal.accent}" stroke-width="${(u * 0.012).toFixed(1)}" stroke-linecap="round" opacity="0.9"/>`);
      }
      parts.push(`<circle cx="${X(0.86)}" cy="${Y(0.14)}" r="${(u * 0.035).toFixed(1)}" fill="${pal.second}" opacity="0.3"/>`);
      break;
    }
    case "stat": {
      // a soft disc behind the number, and two light arcs with ticks around it (never a stroke through the digits)
      if (a.value) {
        const R0 = Math.max(a.value.h * 0.62 * h, a.value.w * 0.56 * w);
        const cx = w / 2;
        const cy = a.value.y * h;
        parts.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${R0.toFixed(1)}" fill="${pal.second}" opacity="0.12"/>`);
        const R = R0 * 1.22;
        const arc = (from: number, to: number) => {
          const p1 = [cx + Math.cos(from) * R, cy + Math.sin(from) * R];
          const p2 = [cx + Math.cos(to) * R, cy + Math.sin(to) * R];
          return `<path d="M${p1[0].toFixed(1)} ${p1[1].toFixed(1)} A${R.toFixed(1)} ${R.toFixed(1)} 0 0 1 ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}" fill="none" stroke="${pal.accent}" stroke-width="${(u * 0.008).toFixed(1)}" stroke-linecap="round" opacity="0.6"/>`;
        };
        parts.push(arc(Math.PI * 1.1, Math.PI * 1.55), arc(Math.PI * 0.1, Math.PI * 0.55));
        for (const ang of [Math.PI * 1.15, Math.PI * 1.32, Math.PI * 1.5, Math.PI * 0.15, Math.PI * 0.32, Math.PI * 0.5]) {
          const r1 = R * 1.08;
          const r2 = R * 1.16;
          parts.push(`<line x1="${(cx + Math.cos(ang) * r1).toFixed(1)}" y1="${(cy + Math.sin(ang) * r1).toFixed(1)}" x2="${(cx + Math.cos(ang) * r2).toFixed(1)}" y2="${(cy + Math.sin(ang) * r2).toFixed(1)}" stroke="${pal.accent}" stroke-width="${(u * 0.005).toFixed(1)}" stroke-linecap="round" opacity="0.6"/>`);
        }
      }
      break;
    }
    case "points":
    case "steps": {
      // a rail on the right beside the list, and a faint big disc behind the left
      const items = a.items ?? [];
      if (items.length) {
        const top = items[0].y - items[0].h / 2;
        const bot = items[items.length - 1].y + items[items.length - 1].h / 2;
        parts.push(`<rect x="${X(0.935)}" y="${Y(top)}" width="${(u * 0.009).toFixed(1)}" height="${Y(bot - top)}" rx="${(u * 0.005).toFixed(1)}" fill="${pal.accent}" opacity="0.85"/>`);
        for (const it of items) parts.push(`<circle cx="${X(0.935 + 0.0045)}" cy="${Y(it.y)}" r="${(u * 0.011).toFixed(1)}" fill="${pal.accent}"/>`);
      }
      parts.push(`<circle cx="${X(0.12)}" cy="${Y(0.82)}" r="${(u * 0.16).toFixed(1)}" fill="${pal.second}" opacity="0.1"/>`);
      break;
    }
    case "compare": {
      // the divider between the two sides, and a soft disc behind each title
      parts.push(`<line x1="${X(0.5)}" y1="${Y(a.top + 0.02)}" x2="${X(0.5)}" y2="${Y(a.bottom)}" stroke="${pal.second}" stroke-width="${(u * 0.004).toFixed(1)}" stroke-dasharray="${(u * 0.02).toFixed(0)} ${(u * 0.014).toFixed(0)}" opacity="0.6"/>`);
      parts.push(`<circle cx="${X(0.73)}" cy="${Y(0.5)}" r="${(u * 0.2).toFixed(1)}" fill="${pal.accent}" opacity="0.08"/>`, `<circle cx="${X(0.27)}" cy="${Y(0.5)}" r="${(u * 0.2).toFixed(1)}" fill="${pal.second}" opacity="0.08"/>`);
      break;
    }
    case "quote": {
      // big quote marks above-right and below-left of the words
      const s = u * 0.045;
      if (a.quote) {
        parts.push(marks(w * 0.5 + (a.quote.w / 2) * w - s * 2.6, (a.quote.y - a.quote.h / 2) * h - s * 2.2, s, pal.accent, 0.8, false));
        parts.push(marks(w * 0.5 - (a.quote.w / 2) * w + s * 2.6, (a.quote.y + a.quote.h / 2) * h + s * 2.2, s, pal.accent, 0.8, true));
      }
      parts.push(`<rect x="${X(0.08)}" y="${Y(a.top - 0.03)}" width="${(u * 0.006).toFixed(1)}" height="${Y(a.bottom - a.top + 0.06)}" rx="2" fill="${pal.second}" opacity="0.5"/>`);
      break;
    }
    case "outro": {
      // rings around the centre, and corner marks
      const cy = a.pill ? (a.top + a.bottom) / 2 : 0.45;
      for (const [k, op] of [
        [0.3, 0.35],
        [0.4, 0.2],
        [0.5, 0.1],
      ])
        parts.push(`<circle cx="${X(0.5)}" cy="${Y(cy)}" r="${(u * k).toFixed(1)}" fill="none" stroke="${pal.accent}" stroke-width="${(u * 0.006).toFixed(1)}" opacity="${op}"/>`);
      parts.push(corner(0.06, 0.08, 1, 1), corner(0.94, 0.08, -1, 1), corner(0.06, 0.92, 1, -1), corner(0.94, 0.92, -1, -1));
      break;
    }
  }
  return `${svgOpen(w, h)}${parts.join("")}</svg>`;
}

/** The pictures of a whole piece: a background and a decoration for every beat (keys "bg-N" and "art-N"). */
export function pieceArt(beats: Beat[], pal: Palette, anchors: Anchors[], W: number, H: number): ArtPiece[] {
  // drawn at a size that stays crisp on a phone and light to make (the player scales it to the frame)
  const k = Math.min(1, 1080 / Math.max(W, H));
  const w = Math.round(W * k);
  const h = Math.round(H * k);
  const out: ArtPiece[] = [];
  beats.forEach((b, i) => {
    out.push({ key: `bg-${i}`, svg: backgroundSvg(pal, i, w, h), w, h });
    out.push({ key: `art-${i}`, svg: decorationSvg(b, i, pal, anchors[i] ?? { top: 0.2, bottom: 0.8 }, w, h), w, h });
  });
  return out;
}
