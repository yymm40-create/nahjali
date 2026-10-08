// «موشن جرافيكس» — the art the engine draws itself (no generator): a background for every beat and the beat's
// decoration around its words, as SVG the server turns into PNG files of the project. Each named skill («مهارات
// الموشن») has its own art language (`theme`): the same words in «الريل السريع» get a bold diagonal block and thick
// underlines, in «الهايلايتر الصحفي» a yellow highlighter stroke on ruled paper, in «الفخامة» a fine double frame, in
// «الروحاني» an arch and a star lattice, in «المرح» blobs and confetti… Pure: the shapes are placed from the engine's
// measured layout, so they sit around the words, never on them. Deterministic: the same beat draws the same picture.

import type { Beat } from "./motion-build";
import type { Palette } from "./motion-build";
import type { MotionLook, MotionTheme } from "./motion-styles";

// ───────────── colours ─────────────

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c: number[]) => `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
/** `b` mixed into `a` by `k` (0 = a, 1 = b). */
export const mix = (a: string, b: string, k: number) => hex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * k));
const isDark = (h: string) => rgb(h).reduce((s, v) => s + v, 0) / 3 < 128;

/** The background colour of beat `i`: the palette's, shifted a little each beat (never the same twice in a row). */
export function beatBackground(pal: Palette, i: number) {
  const dark = isDark(pal.bg);
  const variants = [pal.bg, mix(pal.bg, pal.second, 0.14), mix(pal.bg, pal.accent, 0.12), mix(pal.bg, dark ? "#ffffff" : "#000000", 0.07)];
  return variants[i % variants.length];
}

/** The transition into beat `i`'s background (a few kinds, cycled; the hook arrives with a hard cut). */
const TRANSITIONS = ["wipe", "slideLeft", "iris", "wipeDiagTR", "pushUp", "diamond", "clock", "uncoverLeft"];
export const beatTransition = (i: number, kinds: string[] = TRANSITIONS) => (kinds.length ? { kind: kinds[i % kinds.length], ms: 420 } : null);

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
  /** the headline's centre (x, y), height and width */
  head?: { x?: number; y: number; h: number; w: number };
  value?: { x?: number; y: number; h: number; w: number };
  items?: { y: number; h: number }[];
  quote?: { x?: number; y: number; h: number; w: number };
  pill?: { y: number; h: number };
  /** the whole block of words: top and bottom */
  top: number;
  bottom: number;
}

const svgOpen = (w: number, h: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
const f1 = (n: number) => n.toFixed(1);

/** The texture of a palette, as a pattern over the frame (very faint): the look of a palette when the skill has no texture of its own. */
function paletteTexture(id: string, pal: Palette, w: number, h: number, seed: number): string {
  const ink = isDark(pal.bg) ? "#ffffff" : "#000000";
  const r = seeded(seed);
  switch (id) {
    case "night": {
      let s = "";
      for (let i = 0; i < 70; i++) s += `<circle cx="${(r() * w).toFixed(0)}" cy="${(r() * h).toFixed(0)}" r="${(0.6 + r() * 1.6).toFixed(1)}" fill="${ink}" opacity="${(0.08 + r() * 0.2).toFixed(2)}"/>`;
      return s;
    }
    case "paper":
      return `<defs><pattern id="tx" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.7" fill="${ink}" opacity="0.07"/></pattern></defs><rect width="${w}" height="${h}" fill="url(#tx)"/>`;
    case "riso":
      return `<defs><pattern id="tx" width="${Math.round(w / 36)}" height="${Math.round(w / 36)}" patternUnits="userSpaceOnUse"><circle cx="${f1(w / 72)}" cy="${f1(w / 72)}" r="${f1(w / 160)}" fill="${pal.second}" opacity="0.1"/></pattern></defs><rect width="${w}" height="${h}" fill="url(#tx)"/>`;
    case "studio":
      return `<defs><pattern id="tx" width="${Math.round(w / 24)}" height="${Math.round(w / 24)}" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><rect width="1.5" height="${Math.round(w / 24)}" fill="${ink}" opacity="0.05"/></pattern></defs><rect width="${w}" height="${h}" fill="url(#tx)"/>`;
    default:
      return lattice(pal, w, 0.1);
  }
}

/** An eight-point star lattice (majlis, arabesque). */
function lattice(pal: Palette, w: number, opacity: number, size = 7) {
  const u = Math.round(w / size);
  const c = u / 2;
  const o = u * 0.36;
  const star = `M${c} ${c - o} L${c + o * 0.38} ${c - o * 0.38} L${c + o} ${c} L${c + o * 0.38} ${c + o * 0.38} L${c} ${c + o} L${c - o * 0.38} ${c + o * 0.38} L${c - o} ${c} L${c - o * 0.38} ${c - o * 0.38} Z`;
  return `<defs><pattern id="tx" width="${u}" height="${u}" patternUnits="userSpaceOnUse"><path d="${star}" fill="none" stroke="${pal.accent}" stroke-width="1.2" opacity="${opacity}"/></pattern></defs><rect width="100%" height="100%" fill="url(#tx)"/>`;
}

const glowAt = (gx: number, gy: number, R: number, color: string, k = 1) =>
  `<defs><radialGradient id="g" cx="${gx.toFixed(0)}" cy="${gy.toFixed(0)}" r="${R.toFixed(0)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${color}" stop-opacity="${(0.26 * k).toFixed(2)}"/><stop offset="0.55" stop-color="${color}" stop-opacity="${(0.06 * k).toFixed(2)}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>`;

/** A starburst (the badge of an ad), centred at (cx, cy). */
function burst(cx: number, cy: number, R: number, color: string, opacity: number, points = 14) {
  const pts: string[] = [];
  for (let k = 0; k < points * 2; k++) {
    const ang = (Math.PI * 2 * k) / (points * 2) - Math.PI / 2;
    const r = k % 2 ? R * 0.78 : R;
    pts.push(`${f1(cx + Math.cos(ang) * r)},${f1(cy + Math.sin(ang) * r)}`);
  }
  return `<polygon points="${pts.join(" ")}" fill="${color}" opacity="${opacity}"/>`;
}

/** A pointed arch (the mihrab shape) around a centre, as an outline. */
function arch(cx: number, top: number, bottom: number, halfW: number, color: string, width: number, opacity: number) {
  const l = cx - halfW;
  const r = cx + halfW;
  const peak = top;
  const shoulder = top + (bottom - top) * 0.32;
  return `<path d="M${f1(l)} ${f1(bottom)} L${f1(l)} ${f1(shoulder)} Q${f1(l)} ${f1(peak + (shoulder - peak) * 0.45)} ${f1(cx)} ${f1(peak)} Q${f1(r)} ${f1(peak + (shoulder - peak) * 0.45)} ${f1(r)} ${f1(shoulder)} L${f1(r)} ${f1(bottom)}" fill="none" stroke="${color}" stroke-width="${f1(width)}" stroke-linecap="round" opacity="${opacity}"/>`;
}

/** The background picture of beat `i` in a theme: its colour, then the theme's own treatment. */
export function backgroundSvg(pal: Palette, i: number, w: number, h: number, theme: MotionTheme = "glow"): string {
  const bg = beatBackground(pal, i);
  const ink = isDark(bg) ? "#ffffff" : "#000000";
  const u = Math.min(w, h);
  const r = seeded(i * 11 + 5);
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
  const parts: string[] = [`<rect width="${w}" height="${h}" fill="${bg}"/>`];
  switch (theme) {
    case "glow":
      // a soft glow that moves beat to beat, and the palette's own texture
      parts.push(glowAt(gx * w, gy * h, Math.max(w, h) * 0.55, glow), paletteTexture(pal.id, pal, w, h, i + 1));
      break;
    case "paper": {
      // ruled paper: faint lines, a column rule on the right, the dateline bar top-right
      parts.push(paletteTexture("paper", pal, w, h, i + 1));
      for (let y = h * 0.1; y < h * 0.9; y += u * 0.06) parts.push(`<line x1="${f1(w * 0.08)}" y1="${f1(y)}" x2="${f1(w * 0.92)}" y2="${f1(y)}" stroke="${ink}" stroke-width="1" opacity="0.07"/>`);
      parts.push(`<rect x="${f1(w * 0.935)}" y="${f1(h * 0.08)}" width="${f1(u * 0.004)}" height="${f1(h * 0.84)}" fill="${pal.accent}" opacity="0.6"/>`);
      parts.push(`<rect x="${f1(w * 0.6)}" y="${f1(h * 0.05)}" width="${f1(w * 0.32)}" height="${f1(u * 0.012)}" fill="${pal.accent}"/>`);
      break;
    }
    case "bold": {
      // a big diagonal block in one corner (alternating), thick stripes along one edge, grain
      const left = i % 2 === 0;
      const pts = left ? `0,${f1(h * 0.62)} ${f1(w * 0.5)},${h} 0,${h}` : `${w},${f1(h * 0.08)} ${w},${f1(h * 0.5)} ${f1(w * 0.52)},0 ${f1(w * 0.9)},0`;
      parts.push(`<polygon points="${pts}" fill="${pal.second}" opacity="0.22"/>`);
      for (let k = 0; k < 5; k++) parts.push(`<rect x="${f1(left ? w - u * 0.03 : 0)}" y="${f1(h * (0.1 + k * 0.05))}" width="${f1(u * 0.03)}" height="${f1(u * 0.018)}" fill="${pal.accent}" opacity="0.9"/>`);
      let g = "";
      for (let k = 0; k < 120; k++) g += `<circle cx="${(r() * w).toFixed(0)}" cy="${(r() * h).toFixed(0)}" r="1" fill="${ink}" opacity="${(0.05 + r() * 0.12).toFixed(2)}"/>`;
      parts.push(g);
      break;
    }
    case "flat":
      // flat and hard: one thin bar along the bottom edge
      parts.push(`<rect x="0" y="${f1(h - u * 0.012)}" width="${w}" height="${f1(u * 0.012)}" fill="${pal.accent}"/>`);
      break;
    case "chart": {
      // a faint grid, and bars rising from a baseline at the bottom
      for (let k = 1; k < 8; k++) {
        parts.push(`<line x1="0" y1="${f1((h * k) / 8)}" x2="${w}" y2="${f1((h * k) / 8)}" stroke="${ink}" stroke-width="1" opacity="0.06"/>`);
        parts.push(`<line x1="${f1((w * k) / 8)}" y1="0" x2="${f1((w * k) / 8)}" y2="${h}" stroke="${ink}" stroke-width="1" opacity="0.06"/>`);
      }
      const base = h * 0.96;
      for (let k = 0; k < 9; k++) {
        const bh = h * (0.03 + ((k * 7 + i * 3) % 6) * 0.012);
        parts.push(`<rect x="${f1(w * (0.06 + k * 0.1))}" y="${f1(base - bh)}" width="${f1(w * 0.055)}" height="${f1(bh)}" rx="${f1(u * 0.004)}" fill="${k % 3 === 0 ? pal.accent : pal.second}" opacity="0.35"/>`);
      }
      parts.push(`<line x1="0" y1="${f1(base)}" x2="${w}" y2="${f1(base)}" stroke="${pal.second}" stroke-width="${f1(u * 0.004)}" opacity="0.5"/>`);
      break;
    }
    case "rail":
      // a soft vertical band on the right where the rail runs, and the palette's dots
      parts.push(`<rect x="${f1(w * 0.86)}" y="0" width="${f1(w * 0.14)}" height="${h}" fill="${pal.accent}" opacity="0.08"/>`, paletteTexture("riso", pal, w, h, i + 1));
      break;
    case "split":
      // the two sides tinted differently, a seam in the middle
      parts.push(`<rect x="${f1(w / 2)}" y="0" width="${f1(w / 2)}" height="${h}" fill="${pal.accent}" opacity="0.07"/>`, `<rect x="0" y="0" width="${f1(w / 2)}" height="${h}" fill="${pal.second}" opacity="0.07"/>`);
      parts.push(`<line x1="${f1(w / 2)}" y1="0" x2="${f1(w / 2)}" y2="${h}" stroke="${ink}" stroke-width="1" opacity="0.12"/>`);
      break;
    case "frame": {
      // a fine double frame inset, small diamonds at its corners
      const m = u * 0.045;
      const d = u * 0.012;
      parts.push(`<rect x="${f1(m)}" y="${f1(m)}" width="${f1(w - 2 * m)}" height="${f1(h - 2 * m)}" fill="none" stroke="${pal.accent}" stroke-width="${f1(u * 0.003)}" opacity="0.8"/>`);
      parts.push(`<rect x="${f1(m + d)}" y="${f1(m + d)}" width="${f1(w - 2 * (m + d))}" height="${f1(h - 2 * (m + d))}" fill="none" stroke="${pal.accent}" stroke-width="1" opacity="0.5"/>`);
      for (const [cx, cy] of [[m, m], [w - m, m], [m, h - m], [w - m, h - m]]) parts.push(`<rect x="${f1(cx - d)}" y="${f1(cy - d)}" width="${f1(2 * d)}" height="${f1(2 * d)}" transform="rotate(45 ${f1(cx)} ${f1(cy)})" fill="${bg}" stroke="${pal.accent}" stroke-width="${f1(u * 0.003)}"/>`);
      break;
    }
    case "arabesque":
      // the star lattice, denser, with a soft light from above
      parts.push(lattice(pal, w, 0.14, 9), glowAt(w / 2, 0, Math.max(w, h) * 0.7, pal.accent, 0.8));
      break;
    case "confetti": {
      // three big soft blobs and a shower of small tilted confetti
      const blobs = [
        [0.15, 0.2, 0.22, pal.accent],
        [0.85, 0.75, 0.26, pal.second],
        [0.8, 0.12, 0.12, pal.pill],
      ] as const;
      for (const [bx, by, br, col] of blobs) parts.push(`<ellipse cx="${f1(bx * w)}" cy="${f1(by * h)}" rx="${f1(br * u)}" ry="${f1(br * u * 0.82)}" fill="${col}" opacity="0.18"/>`);
      let c = "";
      for (let k = 0; k < 36; k++) {
        const cx = r() * w;
        const cy = r() * h;
        const col = [pal.accent, pal.second, pal.pill][k % 3];
        c += `<rect x="${f1(cx)}" y="${f1(cy)}" width="${f1(u * 0.014)}" height="${f1(u * 0.026)}" rx="2" transform="rotate(${(r() * 360).toFixed(0)} ${f1(cx)} ${f1(cy)})" fill="${col}" opacity="${(0.35 + r() * 0.4).toFixed(2)}"/>`;
      }
      parts.push(c);
      break;
    }
    case "badge": {
      // thick diagonal bars in two corners, stripes texture
      const t = u * 0.07;
      parts.push(`<polygon points="0,0 ${f1(w * 0.42)},0 0,${f1(h * 0.22)}" fill="${pal.accent}" opacity="0.9"/>`);
      parts.push(`<polygon points="${f1(t)},0 ${f1(w * 0.42 + t * 1.6)},0 0,${f1(h * 0.22 + t * 1.6)} 0,${f1(h * 0.22 + t * 0.8)}" fill="${pal.second}" opacity="0.5"/>`);
      parts.push(`<polygon points="${w},${h} ${f1(w * 0.58)},${h} ${w},${f1(h * 0.78)}" fill="${pal.second}" opacity="0.9"/>`);
      parts.push(paletteTexture("studio", pal, w, h, i + 1));
      break;
    }
    case "none":
      // plain, with one hairline near the top
      parts.push(`<line x1="${f1(w * 0.08)}" y1="${f1(h * 0.07)}" x2="${f1(w * 0.92)}" y2="${f1(h * 0.07)}" stroke="${ink}" stroke-width="1" opacity="0.18"/>`);
      break;
    case "grid": {
      // a fine grid, scanlines, corner brackets, a row of hex dots
      const g = u * 0.05;
      parts.push(`<defs><pattern id="gr" width="${f1(g)}" height="${f1(g)}" patternUnits="userSpaceOnUse"><path d="M${f1(g)} 0 L0 0 0 ${f1(g)}" fill="none" stroke="${ink}" stroke-width="1" opacity="0.08"/></pattern><pattern id="sc" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="${ink}" opacity="0.04"/></pattern></defs><rect width="${w}" height="${h}" fill="url(#gr)"/><rect width="${w}" height="${h}" fill="url(#sc)"/>`);
      const b = u * 0.05;
      const m = u * 0.035;
      const sw = f1(u * 0.005);
      parts.push(`<path d="M${f1(m)} ${f1(m + b)} L${f1(m)} ${f1(m)} L${f1(m + b)} ${f1(m)}" fill="none" stroke="${pal.accent}" stroke-width="${sw}"/>`, `<path d="M${f1(w - m)} ${f1(h - m - b)} L${f1(w - m)} ${f1(h - m)} L${f1(w - m - b)} ${f1(h - m)}" fill="none" stroke="${pal.accent}" stroke-width="${sw}"/>`);
      for (let k = 0; k < 6; k++) parts.push(`<circle cx="${f1(w * 0.08 + k * u * 0.025)}" cy="${f1(h - m)}" r="${f1(u * 0.005)}" fill="${k < 1 + (i % 5) ? pal.accent : ink}" opacity="${k < 1 + (i % 5) ? 1 : 0.25}"/>`);
      break;
    }
    case "film": {
      // letterbox bars and a vignette
      const bar = h * 0.09;
      parts.push(`<defs><radialGradient id="v" cx="${f1(w / 2)}" cy="${f1(h / 2)}" r="${f1(Math.max(w, h) * 0.75)}" gradientUnits="userSpaceOnUse"><stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#v)"/>`);
      parts.push(`<rect x="0" y="0" width="${w}" height="${f1(bar)}" fill="#000"/>`, `<rect x="0" y="${f1(h - bar)}" width="${w}" height="${f1(bar)}" fill="#000"/>`);
      break;
    }
  }
  return `${svgOpen(w, h)}${parts.join("")}</svg>`;
}

/** Quote marks drawn as shapes (no font needed): two drops. `flip` turns them for the closing side. */
function marks(x: number, y: number, s: number, color: string, opacity: number, flip: boolean) {
  const drop = (dx: number) => `<path d="M${dx} 0 a${s * 0.5} ${s * 0.5} 0 1 0 ${s} 0 a${s * 0.5} ${s * 0.5} 0 1 0 ${-s} 0 M${dx + s} 0 q0 ${s * 1.1} ${-s * 0.9} ${s * 1.5}" fill="${color}" stroke="${color}" stroke-width="${(s * 0.22).toFixed(1)}" stroke-linecap="round"/>`;
  return `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)})${flip ? " rotate(180)" : ""}" opacity="${opacity}">${drop(0)}${drop(s * 1.6)}</g>`;
}

/** What each theme draws around the words: the shape behind a title, around a number, beside a list, around a quote, at the end. */
const STYLE: Record<MotionTheme, { band: "tilt" | "highlight" | "underline" | "rules" | "wave" | "arch" | "brackets" | "none"; ring: "arcs" | "bars" | "square" | "burst" | "box" | "star" | "double" | "blob" | "disc"; rail: "line" | "numbers" | "squares" | "brackets" | "none"; quote: "marks" | "highlight" | "rules" | "arch" | "none"; outro: "rings" | "burst" | "frame" | "blobs" | "brackets" | "rule" | "none"; corners: boolean }> = {
  glow: { band: "tilt", ring: "arcs", rail: "line", quote: "marks", outro: "rings", corners: true },
  paper: { band: "highlight", ring: "box", rail: "squares", quote: "highlight", outro: "rule", corners: false },
  bold: { band: "underline", ring: "square", rail: "line", quote: "marks", outro: "burst", corners: false },
  flat: { band: "none", ring: "disc", rail: "none", quote: "none", outro: "none", corners: false },
  chart: { band: "rules", ring: "bars", rail: "line", quote: "marks", outro: "rings", corners: false },
  rail: { band: "none", ring: "disc", rail: "numbers", quote: "rules", outro: "rings", corners: false },
  split: { band: "none", ring: "disc", rail: "line", quote: "marks", outro: "rings", corners: false },
  frame: { band: "rules", ring: "double", rail: "line", quote: "rules", outro: "frame", corners: false },
  arabesque: { band: "arch", ring: "star", rail: "line", quote: "arch", outro: "frame", corners: false },
  confetti: { band: "wave", ring: "blob", rail: "line", quote: "marks", outro: "blobs", corners: false },
  badge: { band: "underline", ring: "burst", rail: "line", quote: "marks", outro: "burst", corners: false },
  none: { band: "none", ring: "disc", rail: "none", quote: "none", outro: "none", corners: false },
  grid: { band: "brackets", ring: "box", rail: "brackets", quote: "rules", outro: "brackets", corners: false },
  film: { band: "none", ring: "disc", rail: "none", quote: "none", outro: "rule", corners: false },
};

/**
 * The decoration of one beat, drawn around its words in the theme's language: in the palette's accents, faint
 * enough never to fight the text, never under a line of it (the band behind the title is the one exception, at a
 * tint the text stays readable on).
 */
export function decorationSvg(b: Beat, i: number, pal: Palette, a: Anchors, w: number, h: number, theme: MotionTheme = "glow"): string {
  const T = STYLE[theme];
  const r = seeded(i * 7 + 3);
  const X = (f: number) => (f * w).toFixed(1);
  const Y = (f: number) => (f * h).toFixed(1);
  const u = Math.min(w, h);
  const parts: string[] = [];
  const corner = (cx: number, cy: number, dirX: number, dirY: number) =>
    `<path d="M${X(cx)} ${Y(cy + dirY * 0.04)} L${X(cx)} ${Y(cy)} L${X(cx + dirX * 0.04)} ${Y(cy)}" fill="none" stroke="${pal.second}" stroke-width="${f1(u * 0.006)}" stroke-linecap="round" opacity="0.7"/>`;
  const dots = (cx: number, cy: number, n: number, col: string) => {
    let s = "";
    for (let k = 0; k < n; k++) s += `<circle cx="${X(cx + (r() - 0.5) * 0.12)}" cy="${Y(cy + (r() - 0.5) * 0.08)}" r="${f1(u * (0.004 + r() * 0.006))}" fill="${col}" opacity="${(0.5 + r() * 0.4).toFixed(2)}"/>`;
    return s;
  };
  const brackets = (cx: number, cy: number, bw: number, bh: number) => {
    const l = (cx - bw / 2) * w, t = (cy - bh / 2) * h, rt = (cx + bw / 2) * w, bt = (cy + bh / 2) * h;
    const s = u * 0.03;
    const sw = f1(u * 0.005);
    return `<path d="M${f1(l)} ${f1(t + s)} L${f1(l)} ${f1(t)} L${f1(l + s)} ${f1(t)} M${f1(rt - s)} ${f1(t)} L${f1(rt)} ${f1(t)} L${f1(rt)} ${f1(t + s)} M${f1(l)} ${f1(bt - s)} L${f1(l)} ${f1(bt)} L${f1(l + s)} ${f1(bt)} M${f1(rt - s)} ${f1(bt)} L${f1(rt)} ${f1(bt)} L${f1(rt)} ${f1(bt - s)}" fill="none" stroke="${pal.accent}" stroke-width="${sw}"/>`;
  };
  /** the band behind / under a headline */
  const band = (hd: NonNullable<Anchors["head"]>) => {
    const cx = hd.x ?? 0.5;
    const half = Math.min(0.45, hd.w / 2 + 0.03);
    const under = hd.y + hd.h / 2 + 0.018;
    switch (T.band) {
      case "tilt":
        parts.push(`<g transform="rotate(-4 ${X(cx)} ${Y(hd.y)})"><rect x="${X(-0.1)}" y="${Y(hd.y - (hd.h * 1.25) / 2)}" width="${X(1.2)}" height="${Y(hd.h * 1.25)}" fill="${pal.accent}" opacity="0.16"/></g>`);
        break;
      case "highlight":
        // the highlighter stroke: the pill colour behind the words, a little tilted, like a marker
        parts.push(`<g transform="rotate(-1.5 ${X(cx)} ${Y(hd.y)})"><rect x="${X(cx - half - 0.01)}" y="${Y(hd.y - hd.h * 0.36)}" width="${X(2 * half + 0.02)}" height="${Y(hd.h * 0.78)}" rx="${f1(u * 0.006)}" fill="${pal.pill}" opacity="0.45"/></g>`);
        break;
      case "underline":
        parts.push(`<rect x="${X(cx - half)}" y="${Y(under)}" width="${X(2 * half)}" height="${f1(u * 0.022)}" fill="${pal.accent}"/>`);
        parts.push(`<rect x="${X(cx - half)}" y="${Y(under + 0.03)}" width="${X(half)}" height="${f1(u * 0.01)}" fill="${pal.second}"/>`);
        break;
      case "rules":
        parts.push(`<line x1="${X(cx - half)}" y1="${Y(hd.y - hd.h / 2 - 0.018)}" x2="${X(cx + half)}" y2="${Y(hd.y - hd.h / 2 - 0.018)}" stroke="${pal.accent}" stroke-width="${f1(u * 0.003)}" opacity="0.9"/>`);
        parts.push(`<line x1="${X(cx - half)}" y1="${Y(under)}" x2="${X(cx + half)}" y2="${Y(under)}" stroke="${pal.accent}" stroke-width="${f1(u * 0.003)}" opacity="0.9"/>`);
        parts.push(`<rect x="${X(cx - 0.008)}" y="${Y(under + 0.012)}" width="${f1(u * 0.016)}" height="${f1(u * 0.016)}" transform="rotate(45 ${X(cx)} ${Y(under + 0.012 + (u * 0.008) / h)})" fill="${pal.accent}"/>`);
        break;
      case "wave": {
        const y0 = under + 0.01;
        let d = `M${X(cx - half)} ${Y(y0)}`;
        for (let k = 0; k < 8; k++) d += ` q${f1(((2 * half) / 16) * w)} ${f1(-u * 0.012)} ${f1(((2 * half) / 8) * w)} 0`;
        parts.push(`<path d="${d}" fill="none" stroke="${pal.second}" stroke-width="${f1(u * 0.012)}" stroke-linecap="round" opacity="0.9"/>`);
        break;
      }
      case "arch":
        parts.push(arch(cx * w, (hd.y - hd.h * 1.3) * h, (a.bottom + 0.06) * h, Math.min(0.46, half + 0.1) * w, pal.accent, u * 0.004, 0.7));
        break;
      case "brackets":
        parts.push(brackets(cx, hd.y, Math.min(0.9, hd.w + 0.1), hd.h * 1.4));
        break;
      case "none":
        break;
    }
  };
  /** around the big number */
  const ring = (v: NonNullable<Anchors["value"]>) => {
    const cx = (v.x ?? 0.5) * w;
    const cy = v.y * h;
    const R0 = Math.max(v.h * 0.62 * h, v.w * 0.56 * w);
    switch (T.ring) {
      case "arcs": {
        parts.push(`<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(R0)}" fill="${pal.second}" opacity="0.12"/>`);
        const R = R0 * 1.22;
        const arc = (from: number, to: number) => `<path d="M${f1(cx + Math.cos(from) * R)} ${f1(cy + Math.sin(from) * R)} A${f1(R)} ${f1(R)} 0 0 1 ${f1(cx + Math.cos(to) * R)} ${f1(cy + Math.sin(to) * R)}" fill="none" stroke="${pal.accent}" stroke-width="${f1(u * 0.008)}" stroke-linecap="round" opacity="0.6"/>`;
        parts.push(arc(Math.PI * 1.1, Math.PI * 1.55), arc(Math.PI * 0.1, Math.PI * 0.55));
        for (const ang of [Math.PI * 1.15, Math.PI * 1.32, Math.PI * 1.5, Math.PI * 0.15, Math.PI * 0.32, Math.PI * 0.5]) parts.push(`<line x1="${f1(cx + Math.cos(ang) * R * 1.08)}" y1="${f1(cy + Math.sin(ang) * R * 1.08)}" x2="${f1(cx + Math.cos(ang) * R * 1.16)}" y2="${f1(cy + Math.sin(ang) * R * 1.16)}" stroke="${pal.accent}" stroke-width="${f1(u * 0.005)}" stroke-linecap="round" opacity="0.6"/>`);
        break;
      }
      case "bars": {
        // three bars rising behind the number, the tallest in the accent
        const bw = R0 * 0.42;
        for (const [k, hh] of [0.55, 0.85, 1.15].entries()) parts.push(`<rect x="${f1(cx - R0 * 0.8 + k * bw * 1.3)}" y="${f1(cy + R0 * 0.7 - R0 * hh)}" width="${f1(bw)}" height="${f1(R0 * hh)}" rx="${f1(u * 0.006)}" fill="${k === 2 ? pal.accent : pal.second}" opacity="0.2"/>`);
        parts.push(`<line x1="${f1(cx - R0)}" y1="${f1(cy + R0 * 0.72)}" x2="${f1(cx + R0)}" y2="${f1(cy + R0 * 0.72)}" stroke="${pal.accent}" stroke-width="${f1(u * 0.005)}" opacity="0.8"/>`);
        break;
      }
      case "square":
        parts.push(`<rect x="${f1(cx - R0)}" y="${f1(cy - R0)}" width="${f1(2 * R0)}" height="${f1(2 * R0)}" transform="rotate(8 ${f1(cx)} ${f1(cy)})" fill="${pal.accent}" opacity="0.18"/>`);
        parts.push(`<rect x="${f1(cx - R0 * 1.1)}" y="${f1(cy - R0 * 0.9)}" width="${f1(2 * R0)}" height="${f1(2 * R0)}" transform="rotate(-6 ${f1(cx)} ${f1(cy)})" fill="none" stroke="${pal.second}" stroke-width="${f1(u * 0.008)}" opacity="0.6"/>`);
        break;
      case "burst":
        parts.push(burst(cx, cy, R0 * 1.3, pal.accent, 0.2, 16));
        break;
      case "box":
        parts.push(brackets(cx / w, cy / h, (2 * R0 * 1.15) / w, (2 * R0 * 0.95) / h));
        break;
      case "star": {
        const pts: string[] = [];
        for (let k = 0; k < 16; k++) {
          const ang = (Math.PI * 2 * k) / 16;
          const rr = k % 2 ? R0 * 1.0 : R0 * 1.3;
          pts.push(`${f1(cx + Math.cos(ang) * rr)},${f1(cy + Math.sin(ang) * rr)}`);
        }
        parts.push(`<polygon points="${pts.join(" ")}" fill="none" stroke="${pal.accent}" stroke-width="${f1(u * 0.004)}" opacity="0.6"/>`);
        break;
      }
      case "double":
        parts.push(`<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(R0 * 1.15)}" fill="none" stroke="${pal.accent}" stroke-width="${f1(u * 0.003)}" opacity="0.9"/>`, `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(R0 * 1.25)}" fill="none" stroke="${pal.accent}" stroke-width="1" opacity="0.5"/>`);
        break;
      case "blob":
        parts.push(`<ellipse cx="${f1(cx + R0 * 0.1)}" cy="${f1(cy)}" rx="${f1(R0 * 1.25)}" ry="${f1(R0 * 1.05)}" transform="rotate(-12 ${f1(cx)} ${f1(cy)})" fill="${pal.second}" opacity="0.22"/>`);
        break;
      case "disc":
        parts.push(`<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(R0 * 1.1)}" fill="${pal.second}" opacity="0.12"/>`);
        break;
    }
  };
  switch (b.kind) {
    case "title":
      if (a.head) band(a.head);
      if (T.corners) parts.push(corner(0.06, 0.08, 1, 1), corner(0.94, 0.92, -1, -1), dots(0.14, 0.86, 7, pal.second));
      break;
    case "statement": {
      if (a.head) {
        const cx = a.head.x ?? 0.5;
        const y = a.head.y + a.head.h / 2 + 0.025;
        const half = Math.min(0.42, a.head.w / 2 + 0.03);
        if (T.band === "highlight") band(a.head);
        else if (T.band === "arch" || T.band === "brackets" || T.band === "rules") band(a.head);
        else if (T.band !== "none") parts.push(`<path d="M${X(cx + half)} ${Y(y)} Q${X(cx)} ${Y(y + 0.012)} ${X(cx - half)} ${Y(y + 0.004)}" fill="none" stroke="${pal.accent}" stroke-width="${f1(u * 0.012)}" stroke-linecap="round" opacity="0.9"/>`);
      }
      if (T.corners) parts.push(`<circle cx="${X(0.86)}" cy="${Y(0.14)}" r="${f1(u * 0.035)}" fill="${pal.second}" opacity="0.3"/>`);
      break;
    }
    case "stat":
      if (a.value) ring(a.value);
      break;
    case "points":
    case "steps": {
      const items = a.items ?? [];
      if (items.length && T.rail !== "none") {
        const top = items[0].y - items[0].h / 2;
        const bot = items[items.length - 1].y + items[items.length - 1].h / 2;
        if (T.rail === "line") {
          parts.push(`<rect x="${X(0.935)}" y="${Y(top)}" width="${f1(u * 0.009)}" height="${Y(bot - top)}" rx="${f1(u * 0.005)}" fill="${pal.accent}" opacity="0.85"/>`);
          for (const it of items) parts.push(`<circle cx="${X(0.935 + 0.0045)}" cy="${Y(it.y)}" r="${f1(u * 0.011)}" fill="${pal.accent}"/>`);
        } else if (T.rail === "numbers") {
          // numbered discs joined by a dotted connector
          parts.push(`<line x1="${X(0.94)}" y1="${Y(top)}" x2="${X(0.94)}" y2="${Y(bot)}" stroke="${pal.second}" stroke-width="${f1(u * 0.004)}" stroke-dasharray="${f1(u * 0.008)} ${f1(u * 0.01)}" opacity="0.7"/>`);
          for (const it of items) parts.push(`<circle cx="${X(0.94)}" cy="${Y(it.y)}" r="${f1(u * 0.02)}" fill="${pal.accent}"/>`, `<circle cx="${X(0.94)}" cy="${Y(it.y)}" r="${f1(u * 0.011)}" fill="${pal.bg}"/>`);
        } else if (T.rail === "squares") {
          for (const it of items) parts.push(`<rect x="${X(0.93)}" y="${Y(it.y - 0.01)}" width="${f1(u * 0.018)}" height="${f1(u * 0.018)}" fill="${pal.accent}"/>`);
        } else if (T.rail === "brackets") {
          for (const it of items) parts.push(`<path d="M${X(0.95)} ${Y(it.y - it.h / 2)} L${X(0.935)} ${Y(it.y - it.h / 2)} L${X(0.935)} ${Y(it.y + it.h / 2)} L${X(0.95)} ${Y(it.y + it.h / 2)}" fill="none" stroke="${pal.accent}" stroke-width="${f1(u * 0.004)}"/>`);
        }
      }
      if (T.corners) parts.push(`<circle cx="${X(0.12)}" cy="${Y(0.82)}" r="${f1(u * 0.16)}" fill="${pal.second}" opacity="0.1"/>`);
      break;
    }
    case "compare":
      parts.push(`<line x1="${X(0.5)}" y1="${Y(a.top + 0.02)}" x2="${X(0.5)}" y2="${Y(a.bottom)}" stroke="${pal.second}" stroke-width="${f1(u * 0.004)}" stroke-dasharray="${(u * 0.02).toFixed(0)} ${(u * 0.014).toFixed(0)}" opacity="0.6"/>`);
      if (T.corners || theme === "split") parts.push(`<circle cx="${X(0.73)}" cy="${Y(0.5)}" r="${f1(u * 0.2)}" fill="${pal.accent}" opacity="0.08"/>`, `<circle cx="${X(0.27)}" cy="${Y(0.5)}" r="${f1(u * 0.2)}" fill="${pal.second}" opacity="0.08"/>`);
      if (theme === "split") parts.push(`<circle cx="${X(0.5)}" cy="${Y((a.top + a.bottom) / 2)}" r="${f1(u * 0.03)}" fill="${pal.pill}"/>`);
      break;
    case "quote": {
      const q = a.quote;
      const s = u * 0.045;
      if (q && T.quote === "marks") {
        const cx = (q.x ?? 0.5) * w;
        parts.push(marks(cx + (q.w / 2) * w - s * 2.6, (q.y - q.h / 2) * h - s * 2.2, s, pal.accent, 0.8, false));
        parts.push(marks(cx - (q.w / 2) * w + s * 2.6, (q.y + q.h / 2) * h + s * 2.2, s, pal.accent, 0.8, true));
        parts.push(`<rect x="${X(0.08)}" y="${Y(a.top - 0.03)}" width="${f1(u * 0.006)}" height="${Y(a.bottom - a.top + 0.06)}" rx="2" fill="${pal.second}" opacity="0.5"/>`);
      } else if (q && T.quote === "highlight") {
        parts.push(`<rect x="${X((q.x ?? 0.5) - q.w / 2 - 0.02)}" y="${Y(q.y - q.h / 2 - 0.01)}" width="${X(q.w + 0.04)}" height="${Y(q.h + 0.02)}" rx="${f1(u * 0.008)}" fill="${pal.pill}" opacity="0.35"/>`);
      } else if (q && T.quote === "rules") {
        parts.push(`<line x1="${X(0.2)}" y1="${Y(a.top - 0.03)}" x2="${X(0.8)}" y2="${Y(a.top - 0.03)}" stroke="${pal.accent}" stroke-width="${f1(u * 0.003)}" opacity="0.9"/>`, `<line x1="${X(0.2)}" y1="${Y(a.bottom + 0.03)}" x2="${X(0.8)}" y2="${Y(a.bottom + 0.03)}" stroke="${pal.accent}" stroke-width="${f1(u * 0.003)}" opacity="0.9"/>`);
      } else if (q && T.quote === "arch") {
        parts.push(arch((q.x ?? 0.5) * w, (a.top - 0.1) * h, (a.bottom + 0.06) * h, Math.min(0.46, q.w / 2 + 0.08) * w, pal.accent, u * 0.004, 0.7));
      }
      break;
    }
    case "outro": {
      const cy = a.pill ? (a.top + a.bottom) / 2 : 0.45;
      switch (T.outro) {
        case "rings":
          for (const [k, op] of [[0.3, 0.35], [0.4, 0.2], [0.5, 0.1]]) parts.push(`<circle cx="${X(0.5)}" cy="${Y(cy)}" r="${f1(u * k)}" fill="none" stroke="${pal.accent}" stroke-width="${f1(u * 0.006)}" opacity="${op}"/>`);
          if (T.corners) parts.push(corner(0.06, 0.08, 1, 1), corner(0.94, 0.08, -1, 1), corner(0.06, 0.92, 1, -1), corner(0.94, 0.92, -1, -1));
          break;
        case "burst":
          parts.push(burst(w * 0.5, cy * h, u * 0.42, pal.accent, 0.14, 18), burst(w * 0.5, cy * h, u * 0.3, pal.second, 0.12, 12));
          break;
        case "frame":
          parts.push(`<rect x="${X(0.1)}" y="${Y(a.top - 0.06)}" width="${X(0.8)}" height="${Y(a.bottom - a.top + 0.12)}" fill="none" stroke="${pal.accent}" stroke-width="${f1(u * 0.003)}" opacity="0.9"/>`);
          break;
        case "blobs":
          parts.push(`<ellipse cx="${X(0.5)}" cy="${Y(cy)}" rx="${f1(u * 0.42)}" ry="${f1(u * 0.3)}" transform="rotate(-8 ${X(0.5)} ${Y(cy)})" fill="${pal.second}" opacity="0.16"/>`);
          break;
        case "brackets":
          parts.push(brackets(0.5, cy, 0.84, Math.max(0.3, a.bottom - a.top + 0.16)));
          break;
        case "rule":
          parts.push(`<line x1="${X(0.3)}" y1="${Y(a.bottom + 0.04)}" x2="${X(0.7)}" y2="${Y(a.bottom + 0.04)}" stroke="${pal.accent}" stroke-width="${f1(u * 0.003)}" opacity="0.8"/>`);
          break;
        case "none":
          break;
      }
      break;
    }
  }
  return `${svgOpen(w, h)}${parts.join("")}</svg>`;
}

/** Every picture of a piece (a background and a decoration per beat), drawn at a size that stays crisp and light. */
export function pieceArt(beats: Beat[], pal: Palette, anchors: Anchors[], W: number, H: number, look?: Pick<MotionLook, "background" | "decor" | "theme">): ArtPiece[] {
  // drawn at a size that stays crisp on a phone and light to make (the player scales it to the frame)
  const k = Math.min(1, 1080 / Math.max(W, H));
  const w = Math.round(W * k);
  const h = Math.round(H * k);
  const theme = look?.theme ?? "glow";
  const out: ArtPiece[] = [];
  beats.forEach((b, i) => {
    // «steady»: one background for the whole piece (the same colour every beat)
    out.push({ key: `bg-${i}`, svg: backgroundSvg(pal, look?.background === "steady" ? 0 : i, w, h, theme), w, h });
    if (look?.decor !== false) out.push({ key: `art-${i}`, svg: decorationSvg(b, i, pal, anchors[i] ?? { top: 0.2, bottom: 0.8 }, w, h, theme), w, h });
  });
  return out;
}
