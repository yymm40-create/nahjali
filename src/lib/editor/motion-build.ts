// «موشن جرافيكس» — the layout engine. حيدرة writes the piece as a storyboard (beats: a title, points, a big number,
// a quote, steps, a comparison, a statement, an outro — the words and the palette); this file turns it into the
// editor's own commands with the sizes, places, timing, colours and entrances worked out by measure, so nothing ever
// sits on anything else, every line fits the frame, and the look stays the same piece to piece. «lintMotion» checks
// any timeline's texts the same way (overlaps, lines too long, out of the safe area, weak contrast, too many fonts).
// Pure: shared by the server (حيدرة) and the tests.

import type { Command } from "./commands";
import { allTracks, clipEnd, type Timeline } from "./model";
import { beatTransition, pieceArt, readShapes, type Anchors, type DrawShape } from "./motion-art";
import { iconById, iconOf } from "./motion-icons";
import { lookOf, moodOf, readLook, SCENE_IDS, type MotionLook, type MotionMood, type SceneId } from "./motion-styles";
import { TR_BY_ID } from "./transitions";

// ───────────── palettes (from the motion skill: five named looks, every pair checked for contrast) ─────────────

export interface Palette {
  id: string;
  ar: string;
  bg: string;
  text: string;
  accent: string;
  second: string;
  /** a box behind a keyword or a pill (the highlighter) */
  pill: string;
  pillText: string;
}

export const PALETTES: Palette[] = [
  { id: "night", ar: "ليل علمي", bg: "#1b1f4b", text: "#f7f7ff", accent: "#ff7b7b", second: "#4ecdc4", pill: "#ffe66d", pillText: "#1b1f4b" },
  { id: "paper", ar: "ورق صحفي", bg: "#f4efe6", text: "#1a1a1a", accent: "#c8102e", second: "#2557b8", pill: "#ffe800", pillText: "#1a1a1a" },
  { id: "riso", ar: "ريزو مرح", bg: "#fbefd9", text: "#22304a", accent: "#b8232b", second: "#0d6b66", pill: "#22304a", pillText: "#fbefd9" },
  { id: "studio", ar: "استوديو", bg: "#0e1b3d", text: "#ffffff", accent: "#4de1c1", second: "#ffd43b", pill: "#ff7a59", pillText: "#0e1b3d" },
  { id: "majlis", ar: "مجلس", bg: "#1f2a44", text: "#fffdf7", accent: "#d4af37", second: "#3fb5a8", pill: "#d4af37", pillText: "#1f2a44" },
  { id: "mono", ar: "أسود وأبيض وأحمر", bg: "#111111", text: "#ffffff", accent: "#ff3b30", second: "#9e9e9e", pill: "#ffffff", pillText: "#111111" },
  { id: "cyan", ar: "مخطط أزرق", bg: "#0f3d7a", text: "#eaf3ff", accent: "#ffd166", second: "#7fd1ff", pill: "#ffd166", pillText: "#0f3d7a" },
  { id: "candy", ar: "حلويات", bg: "#fff0f6", text: "#3d1f33", accent: "#c2185b", second: "#00695c", pill: "#ffd43b", pillText: "#3d1f33" },
  { id: "forest", ar: "غابة", bg: "#13291f", text: "#f2efe2", accent: "#9bc53d", second: "#e6a817", pill: "#9bc53d", pillText: "#13291f" },
  { id: "sunset", ar: "غروب", bg: "#2b1055", text: "#fff1d6", accent: "#ff9e00", second: "#ff2e88", pill: "#ff9e00", pillText: "#2b1055" },
  { id: "term", ar: "شاشة طرفية", bg: "#07120b", text: "#c9ffd8", accent: "#39ff88", second: "#1f8f52", pill: "#39ff88", pillText: "#07120b" },
  { id: "cream", ar: "قشدي ترابي", bg: "#f3e9d2", text: "#2f2a1f", accent: "#8f4513", second: "#4a5043", pill: "#2f2a1f", pillText: "#f3e9d2" },
  { id: "ink", ar: "حبر على أبيض", bg: "#fbfbf8", text: "#14213d", accent: "#d90429", second: "#4361ee", pill: "#14213d", pillText: "#fbfbf8" },
  { id: "neonpal", ar: "نيون ليلي", bg: "#0b0620", text: "#e0fbff", accent: "#ff2bd6", second: "#00f5ff", pill: "#00f5ff", pillText: "#0b0620" },
  { id: "gold", ar: "ذهب على أسود", bg: "#0a0a0a", text: "#f7f3e8", accent: "#d4af37", second: "#8c7853", pill: "#d4af37", pillText: "#0a0a0a" },
];
export const paletteOf = (id: unknown) => PALETTES.find((p) => p.id === id || p.ar === id) ?? PALETTES[0];

const HEX = /^#[0-9a-f]{6}$/i;
const rgbOf = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hexOf = (c: number[]) => `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
/** `c` pushed towards white or black (whichever reads on `bg`) until it reaches the contrast asked. */
function readable(c: string, bg: string, need: number) {
  if (contrast(c, bg) >= need) return c;
  const to = contrast("#ffffff", bg) >= contrast("#111111", bg) ? [255, 255, 255] : [17, 17, 17];
  const from = rgbOf(c);
  for (let k = 0.1; k <= 1.0001; k += 0.1) {
    const m = hexOf(from.map((v, i) => v + (to[i] - v) * k));
    if (contrast(m, bg) >= need) return m;
  }
  return hexOf(to);
}

/**
 * «على هويتك» (majed-video: the colours come from the person's identity only): a palette from the brand's own colours —
 * the background as given, the text and accents kept where they read and nudged lighter/darker where they don't
 * (text ≥ 7, accents ≥ 4.5, like the named palettes).
 */
export function brandPalette(c: { bg?: string; text?: string; accent?: string; second?: string } | null | undefined): Palette | null {
  if (!c || !HEX.test(c.bg ?? "")) return null;
  let bg = c.bg!.toLowerCase();
  // the brand's background is kept as given — except a mid-tone one that neither white nor black reaches 4.5 on: that is moved, as little as it takes
  const best = contrast("#ffffff", bg) >= contrast("#111111", bg) ? "#ffffff" : "#111111";
  for (let k = 0.02; k <= 1.0001 && contrast(best, bg) < 4.6; k += 0.02) bg = hexOf(rgbOf(c.bg!).map((v, i) => v + ((best === "#ffffff" ? 0 : 255) - v) * k));
  const text = readable(HEX.test(c.text ?? "") ? c.text! : contrast("#ffffff", bg) >= contrast("#111111", bg) ? "#ffffff" : "#111111", bg, 7);
  const accent = readable(HEX.test(c.accent ?? "") ? c.accent! : text, bg, 4.5);
  const second = readable(HEX.test(c.second ?? "") ? c.second! : hexOf(rgbOf(text).map((v, i) => v * 0.75 + rgbOf(bg)[i] * 0.25)), bg, 4.5);
  // the highlight pill: the accent, with the text colour that reads best on it; when none reaches 4.5 the pill itself is lightened/darkened
  const onPill = contrast(bg, accent) >= contrast(text, accent) ? bg : text;
  const dark = contrast("#111111", onPill) < contrast("#ffffff", onPill);
  let pill = accent;
  let pillText = onPill;
  for (let k = 0; k <= 1.0001 && contrast(pillText, pill) < 4.5; k += 0.1) {
    pill = hexOf(rgbOf(accent).map((v, i) => v + ((dark ? 255 : 0) - v) * k));
    // the text on the pill: the extreme that reads on it
    pillText = contrast("#111111", pill) >= contrast("#ffffff", pill) ? "#111111" : "#ffffff";
    if (contrast(pillText, pill) >= 4.5) break;
  }
  return { id: "brand", ar: "ألوان هويتك", bg, text, accent, second, pill, pillText };
}

/** Eastern Arabic (٠–٩) and Persian digits as Western ones (majed-video: Western digits always, unless asked). */
export const westernDigits = (t: string) => t.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/** WCAG contrast ratio of two #rrggbb colours. */
export function contrast(a: string, b: string) {
  const lum = (h: string) => {
    const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [x, y] = [lum(a.slice(0, 7)), lum(b.slice(0, 7))].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

// ───────────── measuring text (calibrated on Cairo, Tajawal, Almarai, Changa, Readex, Noto Kufi, Amiri) ─────────────

/** Fonts the engine uses, with how wide they run compared with the sans faces. */
const FONT_WIDTH: Record<string, number> = { cairo: 1, tajawal: 1, almarai: 1, changa: 1.02, readex: 1.04, kufi: 1.12, "noto-kufi-arabic": 1.12, "reem-kufi": 1.1, amiri: 0.82, naskh: 0.85, "el-messiri": 1.0, alexandria: 1.08, lalezar: 0.95 };
const WIDE = /[مشسصضطظغع]/u;
const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/u;
const MARKS = /[ً-ٰٟۖ-ۭ]/u;

/** A line's width in ems (a little more than the real glyphs, so a measured fit always fits). */
export function emWidth(text: string, font = "cairo", weight = 900) {
  let w = 0;
  for (const ch of text) {
    if (MARKS.test(ch) || /[\u200C-\u200F\u2066-\u2069]/u.test(ch)) continue;
    if (ch === " ") w += 0.3;
    else if (ch === "ـ") w += 0.46;
    else if (WIDE.test(ch)) w += 0.95;
    else if (ARABIC.test(ch)) w += 0.68;
    else if (/[0-9٠-٩]/u.test(ch)) w += 0.7;
    else if (/[A-Z@%×]/.test(ch)) w += 0.85;
    else w += 0.66;
  }
  // a short word is wider for its letters (its joins and end forms): a little more, so it never runs out
  return (w + 0.15) * (FONT_WIDTH[font] ?? 1.06) * (weight >= 900 ? 1.06 : 1);
}

/** At most this many words on one line (a line longer than that is read in pieces). */
export const MAX_LINE_WORDS = 6;

/** Words into lines that fit `maxEm` and hold at most MAX_LINE_WORDS (a word too long for a line stays alone on it). */
export function wrapEm(text: string, maxEm: number, font: string, weight: number) {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && (emWidth(next, font, weight) > maxEm || line.split(" ").length >= MAX_LINE_WORDS)) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
  }
  return lines;
}

const LINE = 1.35;

// ───────────── the storyboard ─────────────

export type BeatKind = "title" | "points" | "stat" | "quote" | "steps" | "compare" | "statement" | "outro" | "kinetic";
export interface Beat {
  kind: BeatKind;
  title?: string;
  text?: string;
  items?: string[];
  value?: string;
  label?: string;
  by?: string;
  left?: { title?: string; text?: string };
  right?: { title?: string; text?: string };
  handle?: string;
  /** «kinetic»: 2–6 words, each its own line, entering one after another; `hot` = the word in the highlight pill */
  words?: string[];
  hot?: number;
  /** how long it stays (seconds); default: from its words */
  seconds?: number;
  /** a picture the engine draws above the words: an icon id from the library, or "auto" (picked from the beat's words) */
  icon?: string;
  /** the feeling of this beat (over the piece's) and the scene drawn behind it */
  mood?: MotionMood;
  scene?: SceneId;
  /** shapes حيدرة draws himself behind the words (the engine keeps them off the text) */
  shapes?: DrawShape[];
  /** what the voice says over this beat: the beat stays as long as the saying takes */
  say?: string;
}
export interface Storyboard {
  palette?: string;
  /** headline font and body font (font ids); default Cairo / Tajawal */
  head?: string;
  body?: string;
  /** where the piece starts (ms) */
  at?: number;
  /** the brand's own colours (instead of a named palette) */
  colors?: { bg?: string; text?: string; accent?: string; second?: string };
  /** "arabic" keeps ٠١٢ (only when the person asks); default: Western digits */
  digits?: "western" | "arabic";
  /** a named motion skill («مهارات الموشن», motion-styles.ts): its pace, entrances, transitions, sounds… */
  style?: string;
  /** what the person asked to change in the look (wins over the skill) */
  look?: Partial<MotionLook>;
  /** the whole piece fits this long (ms): the beats share it by how long each takes to say (the voice sets the timing) */
  fitMs?: number;
  beats: Beat[];
}

// ───────────── the voice sets the timing ─────────────

/** How long an Arabic narration takes to say: about 2.4 words a second, and 0.4 s of air at every clause. */
export function narrationMs(text: string) {
  const words = text.replace(/[،,.;؛:!؟?…«»"()\-—]/g, " ").split(/\s+/).filter(Boolean).length;
  const clauses = (text.match(/[،,.;؛:!؟?…]/g) ?? []).length;
  return Math.round((words / 2.4) * 1000 + clauses * 400);
}

/** A time moved by a retime map (pairs of [old, new], increasing; before the first and after the last it only shifts). */
export function mapTime(map: [number, number][], t: number) {
  if (!map.length) return t;
  if (t <= map[0][0]) return t + (map[0][1] - map[0][0]);
  for (let i = 1; i < map.length; i++) {
    const [a0, b0] = map[i - 1];
    const [a1, b1] = map[i];
    if (t <= a1) return a1 === a0 ? b1 : Math.round(b0 + ((t - a0) * (b1 - b0)) / (a1 - a0));
  }
  const last = map[map.length - 1];
  return t + (last[1] - last[0]);
}

/** Where a piece's beats sit and how long each takes to say, so the page can stretch it to the real recording. */
export interface Fit {
  from: number;
  marks: number[];
  weights: number[];
}
/** The map that moves the beats' boundaries so the piece ends at `newEnd` and each beat keeps its share of the voice. */
export function retimeMap(fit: Fit, newEnd: number): [number, number][] {
  const sum = fit.weights.reduce((a, b) => a + b, 0) || 1;
  const total = Math.max(1200 * fit.weights.length, newEnd - fit.from);
  let cum = 0;
  return fit.marks.map((m, i) => {
    const at = Math.round(fit.from + (total * cum) / sum);
    cum += fit.weights[i] ?? 0;
    return [m, at] as [number, number];
  });
}


/** A storyboard from حيدرة's JSON (anything malformed dropped, at most 24 beats). */
export function readStoryboard(raw: unknown): Storyboard | null {
  let o: unknown = raw;
  if (typeof raw === "string") {
    try {
      o = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!o || typeof o !== "object") return null;
  const s = o as Record<string, unknown>;
  const kinds: BeatKind[] = ["title", "points", "stat", "quote", "steps", "compare", "statement", "outro", "kinetic"];
  const arabic = s.digits === "arabic";
  const digits = (t: string) => (arabic ? t : westernDigits(t));
  const clean = (v: unknown, max = 160) => (typeof v === "string" ? digits(v.replace(/\s+/g, " ").trim()).slice(0, max) : "");
  const beats = (Array.isArray(s.beats) ? s.beats : [])
    .filter((b): b is Record<string, unknown> => !!b && typeof b === "object" && kinds.includes((b as { kind?: BeatKind }).kind as BeatKind))
    .slice(0, 24)
    .map((b): Beat => {
      const side = (v: unknown) => (v && typeof v === "object" ? { title: clean((v as Record<string, unknown>).title, 40), text: clean((v as Record<string, unknown>).text, 90) } : undefined);
      return {
        kind: b.kind as BeatKind,
        title: clean(b.title, 70),
        text: b.kind === "kinetic" ? "" : clean(b.text, 170),
        items: (Array.isArray(b.items) ? b.items : []).map((x) => clean(x, 60)).filter(Boolean).slice(0, 5),
        value: clean(b.value, 14),
        label: clean(b.label, 60),
        by: clean(b.by, 50),
        left: side(b.left),
        right: side(b.right),
        handle: clean(b.handle, 40),
        ...(b.kind === "kinetic" ? { words: (Array.isArray(b.words) ? b.words : String(b.text ?? "").split(/\s+/)).map((x) => clean(x, 24)).filter(Boolean).slice(0, 6), hot: Number.isInteger(b.hot) ? Number(b.hot) : undefined } : {}),
        seconds: Number.isFinite(Number(b.seconds)) && Number(b.seconds) > 0 ? Math.min(12, Math.max(1.5, Number(b.seconds))) : undefined,
        ...(typeof b.icon === "string" && (b.icon === "auto" || iconById(b.icon)) ? { icon: b.icon } : {}),
        ...(moodOf(b.mood) ? { mood: moodOf(b.mood)!.id } : {}),
        ...(SCENE_IDS.includes(b.scene as SceneId) ? { scene: b.scene as SceneId } : {}),
        ...(readShapes(b.shapes).length ? { shapes: readShapes(b.shapes) } : {}),
        ...(clean(b.say, 400) ? { say: clean(b.say, 400) } : {}),
      };
    })
    .filter((b) => (b.kind === "kinetic" ? (b.words?.length ?? 0) > 0 : b.title || b.text || b.items?.length || b.value || b.left || b.right));
  if (!beats.length) return null;
  const col = s.colors && typeof s.colors === "object" ? (s.colors as Record<string, unknown>) : null;
  // the look the person asked for, with the feeling and the scene written at the top level of the storyboard too
  const lk: Partial<MotionLook> = { ...(s.look && typeof s.look === "object" ? readLook(s.look, new Set(TR_BY_ID.keys())) : {}), ...(moodOf(s.mood) ? { mood: moodOf(s.mood)!.id } : {}), ...(SCENE_IDS.includes(s.scene as SceneId) ? { scene: s.scene as SceneId } : {}) };
  const look = (s.look && typeof s.look === "object") || Object.keys(lk).length ? lk : null;
  const colors = col ? Object.fromEntries(["bg", "text", "accent", "second"].filter((k) => typeof col[k] === "string" && HEX.test(col[k] as string)).map((k) => [k, col[k] as string])) : undefined;
  return {
    palette: clean(s.palette, 20), head: clean(s.head, 30) || undefined, body: clean(s.body, 30) || undefined, at: Number.isFinite(Number(s.at)) ? Math.max(0, Math.round(Number(s.at))) : 0,
    ...(colors?.bg ? { colors } : {}), ...(arabic ? { digits: "arabic" as const } : {}),
    ...(typeof s.style === "string" && s.style.trim() ? { style: s.style.trim().slice(0, 40) } : {}),
    ...(look ? { look } : {}),
    ...(Number.isFinite(Number(s.fitMs)) && Number(s.fitMs) >= 2000 ? { fitMs: Math.min(600_000, Math.round(Number(s.fitMs))) } : {}),
    beats,
  };
}

// ───────────── layout ─────────────

type Role = "head" | "sub" | "cap" | "value" | "item" | "bar" | "pill" | "quote";
/** One text on screen, as placed: its words (with its line breaks), size (fraction of the height), place and time. */
export interface Placed {
  beat: number;
  role: Role;
  body: string;
  lines: string[];
  size: number;
  weight: 400 | 700 | 900;
  font: string;
  color: string;
  box: string | null;
  align: "center" | "right" | "left";
  x: number;
  y: number;
  /** block size as fractions of the frame */
  w: number;
  h: number;
  start: number;
  end: number;
  anim: { in: string; out: string; inMs: number; outMs: number };
}

interface Frame {
  W: number;
  H: number;
  /** safe margins, fractions */
  side: number;
  top: number;
  bottom: number;
}
const frameOf = (W: number, H: number): Frame => ({ W, H, side: 0.08, top: H > W ? 0.1 : 0.09, bottom: H > W ? 0.16 : 0.1 });

/** The base sizes (fraction of the height) for a frame: tied to its shorter side, so 9:16 and 16:9 both read well. */
function sizes(f: Frame) {
  const k = Math.min(f.W, f.H) / f.H;
  return { head: 0.14 * k, sub: 0.085 * k, cap: 0.066 * k, value: 0.3 * k, item: 0.08 * k, bar: 0.09 * k, pill: 0.075 * k, quote: 0.1 * k };
}
/** The smallest each role may get (fraction of the height) before the beat is split instead: readable on a phone. */
const FLOOR: Record<Role, number> = { head: 0.04, sub: 0.03, cap: 0.026, value: 0.06, item: 0.03, bar: 0.02, pill: 0.028, quote: 0.034 };

/** How long a beat stays: its words read twice at the Arabic pace, between 2.5 and 8 s (or as asked). */
export function beatMs(b: Beat, pace: MotionLook["pace"] = "normal") {
  if (b.seconds) return Math.round(b.seconds * 1000);
  // a beat the voice speaks stays as long as the saying takes (and a breath), whatever the pace
  if (b.say) return Math.min(14_000, Math.max(1600, narrationMs(b.say) + 350));
  const words = [b.title, b.text, b.value, b.label, b.by, b.handle, ...(b.items ?? []), ...(b.kind === "kinetic" ? (b.words ?? []) : []), b.left?.title, b.left?.text, b.right?.title, b.right?.text].join(" ").split(/\s+/).filter(Boolean).length;
  const read = words * 0.42 + 1.4;
  // a fast piece moves on sooner (never under 1.8 s), a calm one lets each beat breathe
  return Math.round((pace === "fast" ? Math.min(6, Math.max(1.8, read * 0.78)) : pace === "calm" ? Math.min(9, Math.max(3.2, read * 1.2)) : Math.min(8, Math.max(2.5, read))) * 1000);
}

interface Spec {
  role: Role;
  body: string;
  color: string;
  box?: string | null;
  weight: 400 | 700 | 900;
  font: string;
  /** the column: the whole width, or the right/left half (a comparison) */
  col?: "full" | "right" | "left";
  /** list items line up on the right side (RTL) */
  list?: boolean;
  /** max lines before it is made smaller */
  maxLines: number;
  delay: number;
  anim: { in: string; out: string; inMs: number; outMs: number };
}

/**
 * Lays one beat out: every text measured, wrapped to its column, made smaller (all together) until the stack fits
 * the safe area and each text keeps to its line limit, then stacked top to bottom with gaps and centred in the frame.
 */
function layBeat(specs: Spec[], f: Frame, base: ReturnType<typeof sizes>, floorK = 1) {
  const availH = 1 - f.top - f.bottom;
  const colW = (c: Spec["col"]) => (c === "right" || c === "left" ? 0.4 : 1 - 2 * f.side);
  let scale = 1;
  for (let round = 0; round < 30; round++) {
    // past a role's floor the beat holds too much: it is split into two beats instead (see splitBeat)
    if (specs.some((s) => base[s.role] * scale < FLOOR[s.role] * floorK)) return null;
    const blocks = specs.map((s) => {
      // the big number fits its own width first, so a long number never drags the other texts below their floor
      const own = s.role === "value" ? Math.min(1, (0.98 * colW(s.col) * f.W) / ((emWidth(s.body, s.font, s.weight) + 0.15) * base.value * f.H)) : 1;
      const size = base[s.role] * scale * own;
      // ems that fit the column: column width (px) / font size (px)
      const maxEm = (colW(s.col) * f.W) / (size * f.H);
      const lines = s.role === "bar" ? [s.body] : wrapEm(s.body, maxEm, s.font, s.weight);
      const wEm = Math.max(...lines.map((l) => emWidth(l, s.font, s.weight)), 0);
      const pad = s.box ? 0.6 : 0;
      return { s, size, lines, w: ((wEm + pad) * size * f.H) / f.W, h: lines.length * LINE * size };
    });
    // a single word wider than its column (a long number) counts as not fitting, like too many lines
    const tooMany = blocks.some((b) => b.lines.length > b.s.maxLines || b.w > colW(b.s.col) + 0.001);
    // the comparison's two columns stand side by side: the taller of the two counts once
    const full = blocks.filter((b) => (b.s.col ?? "full") === "full");
    const sideH = (c: "right" | "left") => blocks.filter((b) => b.s.col === c).reduce((n, b) => n + b.h, 0) + Math.max(0, blocks.filter((b) => b.s.col === c).length - 1) * 0.02;
    const gaps = Math.max(0, full.length - 1) * 0.035 * scale + (blocks.some((b) => b.s.col === "right" || b.s.col === "left") ? 0.04 : 0);
    const total = full.reduce((n, b) => n + b.h, 0) + Math.max(sideH("right"), sideH("left")) + gaps;
    if (!tooMany && total <= availH) return { blocks, total, scale };
    scale *= 0.95;
  }
  return null;
}

/** A beat that holds too much for one screen, as two (half the list each; or the words cut at a sentence/the middle). */
export function splitBeat(b: Beat): [Beat, Beat] | null {
  if (b.kind === "kinetic" && (b.words?.length ?? 0) > 2) {
    const w = b.words!;
    const h = Math.ceil(w.length / 2);
    const hot = b.hot ?? -1;
    return [{ ...b, words: w.slice(0, h), hot: hot < h ? hot : undefined, seconds: undefined }, { ...b, words: w.slice(h), hot: hot >= h ? hot - h : undefined, seconds: undefined }];
  }
  const items = b.items ?? [];
  if ((b.kind === "points" || b.kind === "steps") && items.length > 1) {
    const h = Math.ceil(items.length / 2);
    return [{ ...b, items: items.slice(0, h), seconds: undefined }, { ...b, items: items.slice(h), seconds: undefined }];
  }
  const cut = (t: string) => {
    const w = t.split(/\s+/).filter(Boolean);
    if (w.length < 4) return null;
    const stop = w.findIndex((x, i) => i >= w.length / 3 && i <= (2 * w.length) / 3 && /[،.؛:!؟]$/.test(x));
    const at = stop >= 0 ? stop + 1 : Math.ceil(w.length / 2);
    return [w.slice(0, at).join(" "), w.slice(at).join(" ")] as const;
  };
  if (b.kind === "compare") {
    // a long headline goes first on its own; otherwise two columns that can't share one screen: one side after the other (the headline kept with the first)
    if ((b.title ?? "").split(/\s+/).filter(Boolean).length >= 4) return [{ kind: "statement", text: b.title, seconds: undefined, say: b.say, mood: b.mood, scene: b.scene }, { ...b, title: "", seconds: undefined }];
    return [{ ...b, kind: "statement", text: `${b.title ? `${b.title} — ` : ""}${b.right?.title ?? ""}: ${b.right?.text ?? ""}`, title: undefined, seconds: undefined }, { ...b, kind: "statement", text: `${b.left?.title ?? ""}: ${b.left?.text ?? ""}`, title: undefined, seconds: undefined }];
  }
  // the second half is a plain sentence of its own (it never carries the first half's points, number or handle again)
  const next = (text: string): Beat => ({ kind: "statement", text, seconds: undefined, say: b.say, mood: b.mood, scene: b.scene });
  const t = cut(b.text ?? "");
  if (t) return [{ ...b, text: t[0], seconds: undefined }, b.kind === "quote" ? { ...b, text: t[1], seconds: undefined } : next(t[1])];
  const h = cut(b.title ?? "");
  if (h) return [{ ...b, title: h[0], seconds: undefined }, next(h[1])];
  return null;
}

/**
/**
 * Entrances: short (240–320 ms) with a strong ease-out and exits always faster (160 ms); the headline alternates beat
 * to beat (a whip from the right, then a rise), so no two beats arrive the same way. Majed Alzaabi's rules (majed-video):
 * never a bounce and never from zero — numbers punch in (from big, no overshoot), the handle «settles» in from 0.94 —
 * and texts that enter together follow each other 30–80 ms apart.
 */
export const IN = {
  rise: { in: "rise", out: "fade", inMs: 260, outMs: 160 },
  fade: { in: "fade", out: "fade", inMs: 240, outMs: 160 },
  right: { in: "fromRight", out: "fade", inMs: 260, outMs: 160 },
  left: { in: "fromLeft", out: "fade", inMs: 260, outMs: 160 },
  whip: { in: "whip", out: "whip", inMs: 260, outMs: 180 },
  settle: { in: "settle", out: "fade", inMs: 280, outMs: 160 },
  punch: { in: "punch", out: "fade", inMs: 300, outMs: 160 },
  blur: { in: "blur", out: "fade", inMs: 320, outMs: 160 },
  glitch: { in: "glitch", out: "fade", inMs: 260, outMs: 160 },
  flash: { in: "flash", out: "fade", inMs: 220, outMs: 160 },
  wipe: { in: "wipe", out: "fade", inMs: 600, outMs: 160 },
};
type Anim = (typeof IN)[keyof typeof IN];
/** An entrance at the piece's pace: quicker when fast, softer when calm (exits stay faster than entrances). */
const paced = (a: Anim, pace: MotionLook["pace"]): Anim =>
  pace === "fast" ? { ...a, inMs: Math.round(a.inMs * 0.85), outMs: Math.min(Math.round(a.outMs * 0.85), Math.round(a.inMs * 0.85)) } : pace === "calm" ? { ...a, inMs: Math.min(450, Math.round(a.inMs * 1.3)) } : a;
/** Texts that enter together follow each other by this much (majed-video: 30–80 ms). */
export const STAGGER_MS = 60;
/** The headline's entrance for beat `bi` (the art leads by TEXT_LEAD ms, so the words land on it). */
const headInOf = (bi: number, look?: MotionLook) => (!look || look.entrance === "mixed" ? (bi % 2 === 0 ? IN.whip : IN.rise) : IN[look.entrance]);
const TEXT_LEAD = 80;

/** The texts of one beat, in reading order, with their roles, colours, fonts and entrances. */
function specsOf(b: Beat, pal: Palette, head: string, body: string, bi = 0, arabicDigits = false, look?: MotionLook): Spec[] {
  const specs: Spec[] = [];
  const headIn = (i: number) => headInOf(i, look);
  const add = (s: Omit<Spec, "maxLines" | "delay"> & { maxLines?: number; delay?: number }) => {
    if (s.body.replace(/[«»—\-●.:\s]/g, "")) specs.push({ maxLines: 2, delay: TEXT_LEAD + specs.length * STAGGER_MS, ...s, anim: paced(s.anim, look?.pace ?? "normal"), body: arabicDigits ? s.body : westernDigits(s.body) });
  };
  switch (b.kind) {
    case "title":
      add({ role: "head", body: b.title ?? "", color: pal.text, weight: 900, font: head, maxLines: 3, anim: headIn(bi) });
      add({ role: "sub", body: b.text ?? "", color: pal.second, weight: 700, font: body, anim: IN.rise });
      break;
    case "statement":
      add({ role: "head", body: b.text || b.title || "", color: pal.text, weight: 900, font: head, maxLines: 3, anim: headIn(bi) });
      break;
    case "stat":
      add({ role: "value", body: b.value ?? "", color: pal.accent, weight: 900, font: head, maxLines: 1, anim: IN.punch });
      add({ role: "sub", body: b.label ?? "", color: pal.text, weight: 700, font: body, anim: IN.rise });
      add({ role: "cap", body: b.text ?? "", color: pal.second, weight: 400, font: body, anim: IN.fade });
      break;
    case "points":
    case "steps": {
      add({ role: "head", body: b.title ?? "", color: pal.text, weight: 900, font: head, maxLines: 3, anim: headIn(bi) });
      const nums = arabicDigits ? ["١", "٢", "٣", "٤", "٥"] : ["1", "2", "3", "4", "5"];
      (b.items ?? []).forEach((it, i) => add({ role: "item", body: `${b.kind === "steps" ? `${nums[i] ?? i + 1}.` : "●"} ${it}`, color: i === 0 ? pal.accent : pal.text, weight: 700, font: body, list: true, delay: TEXT_LEAD + 360 + i * 340, anim: IN.right }));
      break;
    }
    case "quote":
      add({ role: "quote", body: b.text ? `«${b.text}»` : "", color: pal.text, weight: 700, font: body, maxLines: 4, anim: IN.fade });
      add({ role: "cap", body: b.by ? `— ${b.by}` : "", color: pal.accent, weight: 700, font: body, anim: IN.rise, delay: TEXT_LEAD + 320 });
      break;
    case "compare":
      add({ role: "head", body: b.title ?? "", color: pal.text, weight: 900, font: head, maxLines: 3, anim: headIn(bi) });
      add({ role: "sub", body: b.right?.title ?? "", color: pal.accent, weight: 900, font: head, col: "right", anim: IN.right, delay: TEXT_LEAD + STAGGER_MS });
      add({ role: "cap", body: b.right?.text ?? "", color: pal.text, weight: 400, font: body, col: "right", maxLines: 4, anim: IN.fade, delay: TEXT_LEAD + 2 * STAGGER_MS });
      add({ role: "sub", body: b.left?.title ?? "", color: pal.second, weight: 900, font: head, col: "left", anim: IN.left, delay: TEXT_LEAD + 3 * STAGGER_MS });
      add({ role: "cap", body: b.left?.text ?? "", color: pal.text, weight: 400, font: body, col: "left", maxLines: 4, anim: IN.fade, delay: TEXT_LEAD + 4 * STAGGER_MS });
      break;
    case "kinetic": {
      // kinetic typography: one word a line, each landing a beat after the one before; the hot word in the pill
      const words = b.words ?? [];
      const hot = b.hot != null && b.hot >= 0 && b.hot < words.length ? b.hot : -1;
      words.forEach((w, i) => add({ role: "head", body: w, color: i === hot ? pal.pillText : i % 2 ? pal.second : pal.text, box: i === hot ? pal.pill : null, weight: 900, font: head, maxLines: 1, delay: TEXT_LEAD + i * 240, anim: i === hot ? IN.settle : IN.rise }));
      break;
    }
    case "outro":
      add({ role: "head", body: b.title ?? "", color: pal.text, weight: 900, font: head, maxLines: 3, anim: headIn(bi) });
      add({ role: "sub", body: b.text ?? "", color: pal.second, weight: 700, font: body, anim: IN.rise });
      add({ role: "pill", body: b.handle ? (/[A-Za-z@]/.test(b.handle) ? `\u2066${b.handle}\u2069` : b.handle) : "", color: pal.pillText, box: pal.pill, weight: 900, font: body, maxLines: 1, anim: IN.settle, delay: TEXT_LEAD + 460 });
      break;
  }
  return specs;
}

export interface BeatTime {
  start: number;
  end: number;
}

/** The icon a beat shows: the one named, or (for "auto") the one its own words point at. */
export function iconFor(b: Beat) {
  if (!b.icon) return undefined;
  if (b.icon !== "auto") return iconById(b.icon);
  return iconOf([b.title, b.text, b.label, b.value, b.by, ...(b.items ?? []), ...(b.words ?? []), b.left?.title, b.right?.title].filter(Boolean).join(" "));
}
/** The icon's side as a fraction of the frame's short side, and the gap under it. */
export const ICON_U = 0.17;
const ICON_GAP = 0.025;
/** The frame a beat's words may use: below its icon, when it has one. */
function frameFor(b: Beat, f: Frame): Frame {
  if (!iconFor(b)) return f;
  return { ...f, top: f.top + (ICON_U * Math.min(f.W, f.H)) / f.H + ICON_GAP };
}
/** A beat's own look: its feeling's tempo and entrance over the piece's. */
const beatLook = (b: Beat, look: ReturnType<typeof lookOf>): ReturnType<typeof lookOf> => {
  const m = moodOf(b.mood);
  return m && m.id !== look.mood ? { ...look, pace: m.pace, entrance: m.entrance } : look;
};

/** The storyboard as placed texts (the layout the commands write), with where each beat's words sit for the art. */
export function layoutMotion(sb: Storyboard, W: number, H: number): { placed: Placed[]; palette: Palette; endMs: number; beats: Beat[]; anchors: Anchors[]; times: BeatTime[]; look: ReturnType<typeof lookOf>; weights: number[] } {
  const f = frameOf(W, H);
  const base = sizes(f);
  // the named skill's look, under what the person asked for (their palette, fonts and look win)
  const look = lookOf(sb.style, sb.look);
  const pal = brandPalette(sb.colors) ?? paletteOf(sb.palette || look.palette);
  const ad = sb.digits === "arabic";
  const head = sb.head || look.head || "cairo";
  const body = sb.body || look.body || "tajawal";
  // a beat too full for one screen becomes two (and so on), before anything is placed
  const queue = [...sb.beats];
  const beats: Beat[] = [];
  while (queue.length) {
    const b = queue.shift()!;
    // a runaway split (a storyboard of thousands of words) stops here: what is left is laid as it is, never dropped
    if (beats.length >= 96) {
      beats.push(b);
      continue;
    }
    if (layBeat(specsOf(b, pal, head, body, 0, ad, beatLook(b, look)), frameFor(b, f), base)) {
      beats.push(b);
      continue;
    }
    // too full with its icon: the icon goes before the words are split or cut
    if (b.icon) {
      queue.unshift({ ...b, icon: undefined });
      continue;
    }
    const parts = splitBeat(b);
    if (parts) {
      // the halves share the beat's time when it was given
      queue.unshift(...parts.map((x) => (b.seconds ? { ...x, seconds: Math.max(1.5, b.seconds! / 2) } : x)));
      continue;
    }
    // nothing left to split: a little under the usual smallest size before any word goes
    if (layBeat(specsOf(b, pal, head, body, 0, ad, beatLook(b, look)), frameFor(b, f), base, 0.6)) {
      beats.push(b);
      continue;
    }
    // still no room: the least important words go (the small note, then the second line), never the beat
    const lighter: Beat | null = b.text && b.kind !== "statement" && b.kind !== "quote" ? { ...b, text: "" } : b.label && b.kind === "stat" ? { ...b, label: "" } : null;
    if (lighter) queue.unshift(lighter);
    else beats.push(b);
  }
  const placed: Placed[] = [];
  const anchors: Anchors[] = [];
  const times: BeatTime[] = [];
  let t = sb.at ?? 0;
  // how long each beat takes; a piece asked to fit a length (the narration's) shares it by those weights
  const natural = beats.map((b) => Math.max(1400, beatMs(b, beatLook(b, look).pace)));
  const durs = fitDurations(natural, sb.fitMs);
  beats.forEach((b, bi) => {
    const dur = durs[bi];
    const lk = beatLook(b, look);
    const fb = frameFor(b, f);
    // a beat that holds too much even after splitting is set a little under the usual smallest size, never cut
    const specs = specsOf(b, pal, head, body, bi, ad, lk);
    const laid = layBeat(specs, fb, base) ?? layBeat(specs, fb, base, 0.6);
    times.push({ start: t, end: t + dur });
    if (!laid) {
      anchors.push({ top: f.top, bottom: 1 - f.bottom });
      t += dur;
      return;
    }
    // stacked from the top of the centred block (under the icon, when there is one); the two comparison columns side by side under the full-width texts
    const top = fb.top + (1 - fb.top - fb.bottom - laid.total) / 2;
    let y = top;
    const mine: Placed[] = [];
    // texts that enter one after another must all be readable before the beat ends: a short beat packs its entrances closer
    const lastIn = Math.max(...laid.blocks.map((x) => x.s.delay + x.s.anim.inMs), 0);
    const room = dur - 650;
    const squeeze = lastIn > room && lastIn > TEXT_LEAD ? Math.max(0.02, (room - TEXT_LEAD - 300) / Math.max(1, lastIn - TEXT_LEAD)) : 1;
    const placeOne = (blk: (typeof laid.blocks)[number], cx: number, cy: number, al: "center" | "right" = "center") => {
      const s = blk.s;
      // «right»: the block flush with the right margin (Arabic's start), its lines aligned right inside it
      const x = al === "right" ? 1 - f.side - blk.w / 2 : cx;
      const p: Placed = {
        beat: bi, role: s.role, body: blk.lines.join("\n"), lines: blk.lines, size: +blk.size.toFixed(4), weight: s.weight, font: s.font, color: s.color, box: s.box ?? null,
        align: al, x: +x.toFixed(4), y: +cy.toFixed(4), w: +blk.w.toFixed(4), h: +blk.h.toFixed(4),
        start: t + Math.round(TEXT_LEAD + (s.delay - TEXT_LEAD) * squeeze), end: t + dur, anim: s.anim,
      };
      placed.push(p);
      mine.push(p);
    };
    for (const blk of laid.blocks.filter((x) => (x.s.col ?? "full") === "full")) {
      placeOne(blk, 0.5, y + blk.h / 2, look.align);
      y += blk.h + 0.035 * laid.scale;
    }
    if (laid.blocks.some((x) => x.s.col === "right" || x.s.col === "left")) {
      y += 0.005;
      for (const col of ["right", "left"] as const) {
        let cy = y;
        for (const blk of laid.blocks.filter((x) => x.s.col === col)) {
          placeOne(blk, col === "right" ? 0.73 : 0.27, cy + blk.h / 2);
          cy += blk.h + 0.02;
        }
      }
    }
    const one = (role: Role) => {
      const p = mine.find((x) => x.role === role);
      return p ? { x: p.x, y: p.y, h: p.h, w: p.w } : undefined;
    };
    const ic = iconFor(b);
    const iconS = (ICON_U * Math.min(W, H)) / W;
    anchors.push({
      ...(ic ? { icon: { x: look.align === "right" ? 1 - f.side - iconS / 2 : 0.5, y: f.top + (ICON_U * Math.min(W, H)) / H / 2, size: ICON_U, id: ic.id } } : {}),
      head: one("head"),
      value: one("value"),
      quote: one("quote"),
      pill: one("pill"),
      items: mine.filter((x) => x.role === "item").map((x) => ({ y: x.y, h: x.h })),
      top,
      bottom: Math.max(...mine.map((x) => x.y + x.h / 2), top),
    });
    t += dur;
  });
  return { placed, palette: pal, endMs: t, beats, anchors, times, look, weights: beats.map((b, i) => (b.say ? narrationMs(b.say) + 350 : natural[i])) };
}

/** Beat lengths shared out to fill `total` (each at least 1.2 s), in proportion to how long each naturally takes. */
export function fitDurations(natural: number[], total?: number): number[] {
  if (!total || !natural.length) return natural;
  const MIN = 1200;
  // the voice is shorter than the words need to be read: every beat keeps the least a beat can be, and the piece runs a little longer
  if (total < MIN * natural.length) return natural.map(() => MIN);
  const out = natural.map(() => 0);
  let fixed = new Set<number>();
  for (let round = 0; round < 6; round++) {
    const free = natural.map((_, i) => i).filter((i) => !fixed.has(i));
    const rest = total - [...fixed].reduce((n, i) => n + out[i], 0);
    const sum = free.reduce((n, i) => n + natural[i], 0) || 1;
    let again = false;
    for (const i of free) {
      out[i] = (natural[i] * rest) / sum;
      if (out[i] < MIN) {
        out[i] = MIN;
        fixed = new Set([...fixed, i]);
        again = true;
      }
    }
    if (!again) break;
  }
  const rounded = out.map(Math.round);
  rounded[rounded.length - 1] += total - rounded.reduce((a, b) => a + b, 0);
  return rounded;
}

// ───────────── sounds: one short effect per arrival, five kinds, never the same on every beat ─────────────

export type SfxKind = "swish" | "whoosh" | "hit" | "pop" | "shimmer";
/** What each sound is (ElevenLabs makes it once; copies are placed at every cue). Short, clean, no tails. */
export const SFX: Record<SfxKind, { prompt: string; seconds: number; name: string }> = {
  swish: { prompt: "very short soft airy swish, a light transition swipe, clean and smooth, no tail, no reverb", seconds: 0.6, name: "سويش الانتقال" },
  whoosh: { prompt: "quick cinematic whoosh ending in a soft stop, tight and dry, no reverb, modern motion graphics", seconds: 0.7, name: "ووش الدخول" },
  hit: { prompt: "soft deep cinematic impact, a round sub thud with a short tail, clean, not harsh", seconds: 0.9, name: "ضربة الرقم" },
  pop: { prompt: "small round bubble pop, pleasant and soft, like a UI element appearing, very short", seconds: 0.35, name: "نبضة العنصر" },
  shimmer: { prompt: "gentle rising magical shimmer sparkle, soft and bright, short, no long tail", seconds: 1.1, name: "لمعة الختام" },
};
/** The sound cues of a piece: the transition into each beat, and the arrival of its main thing. */
export interface SfxCue {
  kind: SfxKind;
  at: number;
}
function cuesOf(beats: Beat[], times: BeatTime[], sfx: MotionLook["sfx"] = "full"): SfxCue[] {
  if (sfx === "none") return [];
  const out: SfxCue[] = [];
  beats.forEach((b, i) => {
    const t = times[i].start;
    if (i > 0) out.push({ kind: "swish", at: Math.max(0, t - 120) });
    switch (b.kind) {
      case "stat":
        out.push({ kind: "pop", at: t }, { kind: "hit", at: t + TEXT_LEAD + 120 });
        break;
      case "quote":
      case "outro":
        out.push({ kind: "shimmer", at: t + TEXT_LEAD });
        break;
      default:
        out.push({ kind: i % 2 === 0 ? "whoosh" : "pop", at: t + TEXT_LEAD });
    }
  });
  // «soft»: only the moments that matter (the number's hit, the quote's and the ending's shimmer)
  return capCues(sfx === "soft" ? out.filter((c) => c.kind === "hit" || c.kind === "shimmer") : out);
}

/** At most this many sound events in any minute (majed-video: sound only on the moments that mean something). */
export const SFX_PER_MINUTE = 15;
const SFX_RANK: Record<SfxKind, number> = { hit: 0, shimmer: 1, whoosh: 2, pop: 2, swish: 3 };
/**
 * The cues thinned to SFX_PER_MINUTE in every 60 s window: the number's hit and the ending's shimmer first, then the
 * arrivals, the transition swishes last; in time order.
 */
export function capCues(cues: SfxCue[], perMinute = SFX_PER_MINUTE): SfxCue[] {
  const kept: SfxCue[] = [];
  const fits = (all: SfxCue[]) => all.every((a) => all.filter((b) => b.at >= a.at && b.at < a.at + 60_000).length <= perMinute);
  for (const c of [...cues].sort((a, b) => SFX_RANK[a.kind] - SFX_RANK[b.kind] || a.at - b.at)) if (fits([...kept, c])) kept.push(c);
  return kept.sort((a, b) => a.at - b.at);
}

/** Everything the engine decided for a piece: the texts, the art to draw, and the sounds to make and place. */
export function motionPlan(sb: Storyboard, W: number, H: number) {
  const laid = layoutMotion(sb, W, H);
  const marks = [...laid.times.map((x) => x.start), laid.endMs];
  return { ...laid, art: pieceArt(laid.beats, laid.palette, laid.anchors, W, H, laid.look), cues: cuesOf(laid.beats, laid.times, laid.look.sfx), fit: { from: laid.times[0]?.start ?? sb.at ?? 0, marks, weights: laid.weights } as Fit };
}

/** The decoration's entrance by the beat's kind: shapes pop, bands and rails whip in. */
const artIn = (b: Beat) => (b.kind === "title" || b.kind === "points" || b.kind === "steps" ? IN.whip : b.kind === "statement" ? IN.right : IN.settle);

/**
 * The commands that make the piece: the background colour, then — when the art was drawn (`art`: picture key →
 * file id) — a background picture per beat on one track with a transition into the next, and the beat's decoration
 * on a track above it (entering just before the words, drifting slowly); then each text (add_text, then its look,
 * place and entrance/exit on "$N"), and a slow push-in on each headline. `base` = how many commands come before
 * these in the same answer (so "$N" points at the right one).
 */
export function motionCommands(sb: Storyboard, W: number, H: number, base = 0, art?: Map<string, string>): { commands: Command[]; endMs: number; palette: Palette } {
  const { placed, palette, endMs, beats, times, look } = layoutMotion(sb, W, H);
  const out: Command[] = [{ type: "set_background", color: palette.bg }];
  const ref = () => `$${base + out.length}`;
  if (art?.size) {
    let bgTrack = "new";
    let artTrack = "new";
    beats.forEach((b, i) => {
      const { start, end } = times[i];
      const bg = art.get(`bg-${i}`);
      if (bg) {
        out.push({ type: "add_clip", assetId: bg, trackId: bgTrack, at: start });
        const r = ref();
        if (bgTrack === "new") bgTrack = r;
        out.push({ type: "trim_clip", clipId: r, edge: "end", to: end });
        out.push({ type: "update_clip", clipId: r, patch: { fit: "cover", transition: i < beats.length - 1 ? (beatTransition(i + 1, look.transitions) as { kind: string; ms: number } | null) : null } });
      }
      // the decoration (and an icon or shapes alone, when the skill draws no decoration) is there when the engine drew it
      const deco = art.get(`art-${i}`);
      if (deco) {
        out.push({ type: "add_clip", assetId: deco, trackId: artTrack, at: start });
        const r = ref();
        if (artTrack === "new") artTrack = r;
        out.push({ type: "trim_clip", clipId: r, edge: "end", to: end });
        const a = artIn(b);
        out.push({ type: "update_clip", clipId: r, patch: { fit: "cover", anim: { in: a.in, out: "fade", inMs: a.inMs, outMs: 160 } as never } });
        // nothing still: the decoration turns and grows a touch over its beat
        if (look.drift) out.push({ type: "set_key", clipId: r, at: start, transform: { x: 0.5, y: 0.5, scale: 1, rotate: 0, opacity: 1 } });
        if (look.drift) out.push({ type: "set_key", clipId: r, at: end - 1, transform: { x: 0.5, y: 0.5, scale: 1.05, rotate: i % 2 === 0 ? 2 : -2, opacity: 1 } });
      }
    });
  }
  for (const p of placed) {
    out.push({ type: "add_text", at: p.start, body: p.body, duration: p.end - p.start });
    const r = ref();
    out.push({
      type: "update_clip",
      clipId: r,
      patch: {
        text: { body: p.body, size: p.size, color: p.color, weight: p.weight, font: p.font, align: p.align, box: p.box, highlight: null },
        transform: { x: p.x, y: p.y, scale: 1, rotate: 0, opacity: 1 },
        anim: p.anim as never,
      },
    });
    // nothing fully still: the headline and the big number drift in slowly over their beat
    if (look.drift && (p.role === "head" || p.role === "value")) {
      out.push({ type: "set_key", clipId: r, at: p.start, transform: { x: p.x, y: p.y, scale: 1, rotate: 0, opacity: 1 } });
      out.push({ type: "set_key", clipId: r, at: p.end - 1, transform: { x: p.x, y: p.y, scale: 1.04, rotate: 0, opacity: 1 } });
    }
  }
  return { commands: out, endMs, palette };
}

// ───────────── the check ─────────────

export interface MotionIssue {
  kind: "overlap" | "outside" | "long_line" | "contrast" | "fonts" | "tiny" | "bounce" | "slow_entrance" | "slow_exit" | "short_hold" | "digits" | "late_hook";
  text: string;
}

/** A text clip on screen, as the lint sees it (from the placed layout, or from any timeline). */
interface Box {
  id: string;
  body: string;
  x: number;
  y: number;
  w: number;
  h: number;
  start: number;
  end: number;
  color: string;
  box: string | null;
  size: number;
  font: string;
  anim?: { in: string | null; out: string | null; inMs: number; outMs: number } | null;
}

/** Entrances that bounce or grow from nothing (majed-video: never, unless the person asks for them by name). */
export const BOUNCY = new Set(["pop", "spin", "drop"]);

function boxesOf(tl: Timeline): Box[] {
  const out: Box[] = [];
  for (const tr of allTracks(tl)) {
    if (tr.hidden || tr.kind !== "text") continue;
    for (const c of tr.clips) {
      if (!c.text?.body.trim()) continue;
      const s = c.text;
      const size = s.size * (c.transform.scale || 1);
      const lines = wrapEm(s.body, (0.9 * tl.width) / (size * tl.height), s.font, s.weight);
      const wEm = Math.max(...lines.map((l) => emWidth(l, s.font, s.weight)), 0);
      out.push({ id: c.id, body: s.body, x: c.transform.x, y: c.transform.y, w: ((wEm + (s.box ? 0.6 : 0)) * size * tl.height) / tl.width, h: lines.length * LINE * size, start: c.start, end: clipEnd(c), color: s.color, box: s.box, size, font: s.font, anim: c.anim ?? null });
    }
  }
  return out;
}

/** What is wrong with the texts on screen: overlaps while both show, outside the safe area, long lines, weak contrast. */
export function lintBoxes(boxes: Box[], W: number, H: number, bg: string, only?: Set<string>): MotionIssue[] {
  const f = frameOf(W, H);
  const issues: MotionIssue[] = [];
  const name = (b: Box) => `«${b.body.replace(/\n/g, " ").slice(0, 30)}» (${b.id})`;
  const mine = (b: Box) => !only || only.has(b.id);
  for (let i = 0; i < boxes.length; i++) {
    const a = boxes[i];
    if (!mine(a)) continue;
    for (let j = 0; j < boxes.length; j++) {
      const b = boxes[j];
      if (j === i || (j < i && mine(b))) continue;
      const together = Math.min(a.end, b.end) - Math.max(a.start, b.start);
      if (together < 120) continue;
      const ox = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2);
      const oy = Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2);
      if (ox > 0.01 && oy > 0.004) issues.push({ kind: "overlap", text: `${name(a)} and ${name(b)} overlap on screen for ${(together / 1000).toFixed(1)} s (move one up/down by at least ${(oy * 100).toFixed(1)}% of the height, or make them follow each other in time)` });
    }
    if (a.y - a.h / 2 < f.top - 0.02 || a.y + a.h / 2 > 1 - f.bottom + 0.02 || a.x - a.w / 2 < f.side - 0.04 || a.x + a.w / 2 > 1 - f.side + 0.04) issues.push({ kind: "outside", text: `${name(a)} leaves the safe area (keep it between ${Math.round(f.top * 100)}% and ${Math.round((1 - f.bottom) * 100)}% of the height and ${Math.round(f.side * 100)}% from the sides)` });
    for (const line of a.body.split("\n")) if (line.split(/\s+/).filter(Boolean).length > 7) issues.push({ kind: "long_line", text: `${name(a)} has a line of more than 7 words; break it or shorten it` });
    const under = a.box ?? bg;
    const need = a.size >= 0.05 ? 3 : 4.5;
    if (/^#[0-9a-f]{6}/i.test(a.color) && /^#[0-9a-f]{6}/i.test(under) && contrast(a.color, under) < need) issues.push({ kind: "contrast", text: `${name(a)}: its colour ${a.color} on ${under} is hard to read (contrast ${contrast(a.color, under).toFixed(1)}, needs ${need})` });
    // majed-video's motion rules: no bounce, entrances 0.15–0.30 s (0.45 s for a hero moment), exits faster, read ≥ 0.6 s
    if (a.anim) {
      const { inMs, outMs } = a.anim;
      if (a.anim.in && BOUNCY.has(a.anim.in)) issues.push({ kind: "bounce", text: `${name(a)} enters with «${a.anim.in}», which bounces or grows from nothing; use "settle" (from 0.94 with a fade), "rise" or "fade"` });
      if (a.anim.in && a.anim.in !== "words" && a.anim.in !== "wipe" && a.anim.in !== "kashida" && inMs > 450) issues.push({ kind: "slow_entrance", text: `${name(a)} takes ${inMs} ms to enter; keep entrances 150–300 ms (up to 450 for the hook or the ending)` });
      if (a.anim.out && a.anim.in && outMs > inMs) issues.push({ kind: "slow_exit", text: `${name(a)} leaves slower (${outMs} ms) than it enters (${inMs} ms); exits are faster` });
      if (a.end - a.start - (a.anim.in ? inMs : 0) < 600) issues.push({ kind: "short_hold", text: `${name(a)} is readable for less than 0.6 s; keep every word on screen at least 0.6 s after it lands (better: until its sentence ends)` });
    }
    if (a.size < 0.022) issues.push({ kind: "tiny", text: `${name(a)} is too small to read on a phone (size ${a.size.toFixed(3)}; at least 0.025)` });
  }
  const fonts = new Set(boxes.filter(mine).map((b) => b.font));
  if (fonts.size > 2) issues.push({ kind: "fonts", text: `${fonts.size} fonts are used (${[...fonts].join(", ")}); keep to two` });
  return issues;
}

/** The lint on a timeline: its texts (optionally only some clips: the ones an answer added). */
export function lintMotion(tl: Timeline, only?: Set<string>): MotionIssue[] {
  return lintBoxes(boxesOf(tl), tl.width, tl.height, tl.background || "#000000", only);
}

/** The lint on a laid-out storyboard (the tests: what the engine makes must come out clean). */
export function lintPlaced(placed: Placed[], W: number, H: number, bg: string, o: { startMs?: number; arabicDigits?: boolean } = {}): MotionIssue[] {
  const issues = lintBoxes(
    placed.map((p, i) => ({ id: `p${i}`, body: p.body, x: p.x, y: p.y, w: p.w, h: p.h, start: p.start, end: p.end, color: p.color, box: p.box, size: p.size, font: p.font, anim: p.anim })),
    W,
    H,
    bg,
  );
  // the hook moves in the first second; Western digits unless the person asked for ٠١٢
  if (placed.length && o.startMs != null && Math.min(...placed.map((p) => p.start)) - o.startMs > 1000) issues.push({ kind: "late_hook", text: "nothing moves in the first second of the piece" });
  if (!o.arabicDigits) for (const p of placed) if (/[\u0660-\u0669\u06f0-\u06f9]/.test(p.body)) issues.push({ kind: "digits", text: `«${p.body.slice(0, 30)}» uses Eastern digits; Western digits (0–9) unless asked` });
  return issues;
}

/**
 * «قائمة الحقائق» (majed-video: no number or name on screen that the person didn't give): every number of the
 * storyboard, and which of them is not in the person's own words (digits compared as Western ones).
 */
export function storyboardNumbers(sb: Storyboard, source: string): { all: string[]; unsourced: string[] } {
  const text = [...sb.beats.flatMap((b) => [b.title, b.text, b.value, b.label, b.by, ...(b.items ?? []), ...(b.words ?? []), b.left?.title, b.left?.text, b.right?.title, b.right?.text])].filter(Boolean).join(" ");
  const nums = (t: string) => [...new Set((westernDigits(t).replace(/(\d)[,٬](?=\d{3})/g, "$1").match(/\d+(?:[.٫]\d+)?/g) ?? []).map((n) => n.replace("٫", ".")))];
  const have = new Set(nums(source));
  const all = nums(text).filter((n) => !/^[1-5]$/.test(n) || !sb.beats.some((b) => b.kind === "steps"));
  return { all, unsourced: all.filter((n) => !have.has(n)) };
}
