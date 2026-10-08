// «موشن جرافيكس» — the layout engine. حيدرة writes the piece as a storyboard (beats: a title, points, a big number,
// a quote, steps, a comparison, a statement, an outro — the words and the palette); this file turns it into the
// editor's own commands with the sizes, places, timing, colours and entrances worked out by measure, so nothing ever
// sits on anything else, every line fits the frame, and the look stays the same piece to piece. «lintMotion» checks
// any timeline's texts the same way (overlaps, lines too long, out of the safe area, weak contrast, too many fonts).
// Pure: shared by the server (حيدرة) and the tests.

import type { Command } from "./commands";
import { allTracks, clipEnd, type Timeline } from "./model";

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
];
export const paletteOf = (id: unknown) => PALETTES.find((p) => p.id === id || p.ar === id) ?? PALETTES[0];

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

export type BeatKind = "title" | "points" | "stat" | "quote" | "steps" | "compare" | "statement" | "outro";
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
  /** how long it stays (seconds); default: from its words */
  seconds?: number;
}
export interface Storyboard {
  palette?: string;
  /** headline font and body font (font ids); default Cairo / Tajawal */
  head?: string;
  body?: string;
  /** where the piece starts (ms) */
  at?: number;
  beats: Beat[];
}

const clean = (v: unknown, max = 160) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

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
  const kinds: BeatKind[] = ["title", "points", "stat", "quote", "steps", "compare", "statement", "outro"];
  const beats = (Array.isArray(s.beats) ? s.beats : [])
    .filter((b): b is Record<string, unknown> => !!b && typeof b === "object" && kinds.includes((b as { kind?: BeatKind }).kind as BeatKind))
    .slice(0, 24)
    .map((b): Beat => {
      const side = (v: unknown) => (v && typeof v === "object" ? { title: clean((v as Record<string, unknown>).title, 40), text: clean((v as Record<string, unknown>).text, 90) } : undefined);
      return {
        kind: b.kind as BeatKind,
        title: clean(b.title, 70),
        text: clean(b.text, 170),
        items: (Array.isArray(b.items) ? b.items : []).map((x) => clean(x, 60)).filter(Boolean).slice(0, 5),
        value: clean(b.value, 14),
        label: clean(b.label, 60),
        by: clean(b.by, 50),
        left: side(b.left),
        right: side(b.right),
        handle: clean(b.handle, 40),
        seconds: Number.isFinite(Number(b.seconds)) && Number(b.seconds) > 0 ? Math.min(12, Math.max(1.5, Number(b.seconds))) : undefined,
      };
    })
    .filter((b) => b.title || b.text || b.items?.length || b.value || b.left || b.right);
  if (!beats.length) return null;
  return { palette: clean(s.palette, 20), head: clean(s.head, 30) || undefined, body: clean(s.body, 30) || undefined, at: Number.isFinite(Number(s.at)) ? Math.max(0, Math.round(Number(s.at))) : 0, beats };
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
export function beatMs(b: Beat) {
  if (b.seconds) return Math.round(b.seconds * 1000);
  const words = [b.title, b.text, b.value, b.label, b.by, b.handle, ...(b.items ?? []), b.left?.title, b.left?.text, b.right?.title, b.right?.text].join(" ").split(/\s+/).filter(Boolean).length;
  return Math.round(Math.min(8, Math.max(2.5, words * 0.42 + 1.4)) * 1000);
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
function layBeat(specs: Spec[], f: Frame, base: ReturnType<typeof sizes>) {
  const availH = 1 - f.top - f.bottom;
  const colW = (c: Spec["col"]) => (c === "right" || c === "left" ? 0.4 : 1 - 2 * f.side);
  let scale = 1;
  for (let round = 0; round < 30; round++) {
    // past a role's floor the beat holds too much: it is split into two beats instead (see splitBeat)
    if (specs.some((s) => base[s.role] * scale < FLOOR[s.role])) return null;
    const blocks = specs.map((s) => {
      const size = base[s.role] * scale;
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
    // two columns that can't share one screen: one side after the other
    return [{ ...b, kind: "statement", text: `${b.right?.title ?? ""}: ${b.right?.text ?? ""}`, title: undefined, seconds: undefined }, { ...b, kind: "statement", text: `${b.left?.title ?? ""}: ${b.left?.text ?? ""}`, title: undefined, seconds: undefined }];
  }
  const t = cut(b.text ?? "");
  if (t) return [{ ...b, text: t[0], seconds: undefined }, { ...b, kind: b.kind === "title" || b.kind === "outro" ? "statement" : b.kind, title: b.kind === "quote" ? b.title : undefined, text: t[1], seconds: undefined }];
  const h = cut(b.title ?? "");
  if (h) return [{ ...b, title: h[0], seconds: undefined }, { ...b, kind: "statement", title: undefined, text: h[1], seconds: undefined }];
  return null;
}

const IN = {
  rise: { in: "rise", out: "fade", inMs: 380, outMs: 220 },
  fade: { in: "fade", out: "fade", inMs: 320, outMs: 200 },
  right: { in: "fromRight", out: "fade", inMs: 320, outMs: 200 },
  left: { in: "fromLeft", out: "fade", inMs: 320, outMs: 200 },
  pop: { in: "pop", out: "fade", inMs: 450, outMs: 220 },
};

/** The texts of one beat, in reading order, with their roles, colours, fonts and entrances. */
function specsOf(b: Beat, pal: Palette, head: string, body: string): Spec[] {
  const specs: Spec[] = [];
  const add = (s: Omit<Spec, "maxLines" | "delay"> & { maxLines?: number; delay?: number }) => {
    if (s.body.replace(/[«»—\-●.:\s]/g, "")) specs.push({ maxLines: 2, delay: specs.length * 120, ...s });
  };
  switch (b.kind) {
    case "title":
      add({ role: "head", body: b.title ?? "", color: pal.text, weight: 900, font: head, anim: IN.rise });
      if (b.title) add({ role: "bar", body: "ـــــــــــ", color: pal.accent, weight: 900, font: head, maxLines: 1, anim: IN.right });
      add({ role: "sub", body: b.text ?? "", color: pal.second, weight: 700, font: body, anim: IN.fade });
      break;
    case "statement":
      add({ role: "head", body: b.text || b.title || "", color: pal.text, weight: 900, font: head, maxLines: 3, anim: IN.rise });
      break;
    case "stat":
      add({ role: "value", body: b.value ?? "", color: pal.accent, weight: 900, font: head, maxLines: 1, anim: IN.pop });
      add({ role: "sub", body: b.label ?? "", color: pal.text, weight: 700, font: body, anim: IN.fade });
      add({ role: "cap", body: b.text ?? "", color: pal.second, weight: 400, font: body, anim: IN.fade });
      break;
    case "points":
    case "steps": {
      add({ role: "head", body: b.title ?? "", color: pal.text, weight: 900, font: head, anim: IN.rise });
      const nums = ["١", "٢", "٣", "٤", "٥"];
      (b.items ?? []).forEach((it, i) => add({ role: "item", body: `${b.kind === "steps" ? `${nums[i] ?? i + 1}.` : "●"} ${it}`, color: i === 0 ? pal.accent : pal.text, weight: 700, font: body, list: true, delay: 420 + i * 420, anim: IN.right }));
      break;
    }
    case "quote":
      add({ role: "quote", body: b.text ? `«${b.text}»` : "", color: pal.text, weight: 700, font: body, maxLines: 4, anim: IN.fade });
      add({ role: "cap", body: b.by ? `— ${b.by}` : "", color: pal.accent, weight: 700, font: body, anim: IN.fade, delay: 360 });
      break;
    case "compare":
      add({ role: "head", body: b.title ?? "", color: pal.text, weight: 900, font: head, anim: IN.rise });
      add({ role: "sub", body: b.right?.title ?? "", color: pal.accent, weight: 900, font: head, col: "right", anim: IN.right, delay: 260 });
      add({ role: "cap", body: b.right?.text ?? "", color: pal.text, weight: 400, font: body, col: "right", maxLines: 4, anim: IN.fade, delay: 380 });
      add({ role: "sub", body: b.left?.title ?? "", color: pal.second, weight: 900, font: head, col: "left", anim: IN.left, delay: 520 });
      add({ role: "cap", body: b.left?.text ?? "", color: pal.text, weight: 400, font: body, col: "left", maxLines: 4, anim: IN.fade, delay: 640 });
      break;
    case "outro":
      add({ role: "head", body: b.title ?? "", color: pal.text, weight: 900, font: head, anim: IN.rise });
      add({ role: "sub", body: b.text ?? "", color: pal.second, weight: 700, font: body, anim: IN.fade });
      add({ role: "pill", body: b.handle ? (/[A-Za-z@]/.test(b.handle) ? `\u2066${b.handle}\u2069` : b.handle) : "", color: pal.pillText, box: pal.pill, weight: 900, font: body, maxLines: 1, anim: IN.pop, delay: 520 });
      break;
  }
  return specs;
}

/** The storyboard as placed texts (the layout the commands write). Also used by the tests and the lint. */
export function layoutMotion(sb: Storyboard, W: number, H: number): { placed: Placed[]; palette: Palette; endMs: number; beats: Beat[] } {
  const f = frameOf(W, H);
  const base = sizes(f);
  const pal = paletteOf(sb.palette);
  const head = sb.head || "cairo";
  const body = sb.body || "tajawal";
  // a beat too full for one screen becomes two (and so on), before anything is placed
  const queue = [...sb.beats];
  const beats: Beat[] = [];
  while (queue.length && beats.length < 48) {
    const b = queue.shift()!;
    if (layBeat(specsOf(b, pal, head, body), f, base)) {
      beats.push(b);
      continue;
    }
    const parts = splitBeat(b);
    if (parts) {
      queue.unshift(...parts);
      continue;
    }
    // nothing left to split: the least important words go (the small note, then the second line), never the beat
    const lighter: Beat | null = b.text && b.kind !== "statement" && b.kind !== "quote" ? { ...b, text: "" } : b.label && b.kind === "stat" ? { ...b, label: "" } : b.title && b.kind !== "statement" ? { ...b, title: "" } : null;
    if (lighter) queue.unshift(lighter);
    else beats.push(b);
  }
  const placed: Placed[] = [];
  let t = sb.at ?? 0;
  beats.forEach((b, bi) => {
    const dur = beatMs(b);
    const laid = layBeat(specsOf(b, pal, head, body), f, base);
    if (!laid) {
      t += dur;
      return;
    }
    // stacked from the top of the centred block; the two comparison columns side by side under the full-width texts
    let y = f.top + (1 - f.top - f.bottom - laid.total) / 2;
    const placeOne = (blk: (typeof laid.blocks)[number], cx: number, cy: number) => {
      const s = blk.s;
      const x = cx;
      placed.push({
        beat: bi, role: s.role, body: blk.lines.join("\n"), lines: blk.lines, size: +blk.size.toFixed(4), weight: s.weight, font: s.font, color: s.color, box: s.box ?? null,
        align: "center", x: +x.toFixed(4), y: +cy.toFixed(4), w: +blk.w.toFixed(4), h: +blk.h.toFixed(4),
        start: t + s.delay, end: t + dur, anim: s.anim,
      });
    };
    for (const blk of laid.blocks.filter((x) => (x.s.col ?? "full") === "full")) {
      placeOne(blk, 0.5, y + blk.h / 2);
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
    t += dur;
  });
  return { placed, palette: pal, endMs: t, beats };
}

/**
 * The commands that make the piece: the background colour, then each text (add_text, then its look, place and
 * entrance/exit on "$N"), and a slow push-in on each headline. `base` = how many commands come before these in the
 * same answer (so "$N" points at the right one).
 */
export function motionCommands(sb: Storyboard, W: number, H: number, base = 0): { commands: Command[]; endMs: number; palette: Palette } {
  const { placed, palette, endMs } = layoutMotion(sb, W, H);
  const out: Command[] = [{ type: "set_background", color: palette.bg }];
  for (const p of placed) {
    out.push({ type: "add_text", at: p.start, body: p.body, duration: p.end - p.start });
    const ref = `$${base + out.length}`;
    out.push({
      type: "update_clip",
      clipId: ref,
      patch: {
        text: { body: p.body, size: p.size, color: p.color, weight: p.weight, font: p.font, align: p.align, box: p.box, highlight: null },
        transform: { x: p.x, y: p.y, scale: 1, rotate: 0, opacity: 1 },
        anim: p.anim as never,
      },
    });
    // nothing fully still: the headline and the big number drift in slowly over their beat
    if (p.role === "head" || p.role === "value") {
      out.push({ type: "set_key", clipId: ref, at: p.start, transform: { x: p.x, y: p.y, scale: 1, rotate: 0, opacity: 1 } });
      out.push({ type: "set_key", clipId: ref, at: p.end - 1, transform: { x: p.x, y: p.y, scale: 1.04, rotate: 0, opacity: 1 } });
    }
  }
  return { commands: out, endMs, palette };
}

// ───────────── the check ─────────────

export interface MotionIssue {
  kind: "overlap" | "outside" | "long_line" | "contrast" | "fonts" | "tiny";
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
}

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
      out.push({ id: c.id, body: s.body, x: c.transform.x, y: c.transform.y, w: ((wEm + (s.box ? 0.6 : 0)) * size * tl.height) / tl.width, h: lines.length * LINE * size, start: c.start, end: clipEnd(c), color: s.color, box: s.box, size, font: s.font });
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
export function lintPlaced(placed: Placed[], W: number, H: number, bg: string): MotionIssue[] {
  return lintBoxes(
    placed.map((p, i) => ({ id: `p${i}`, body: p.body, x: p.x, y: p.y, w: p.w, h: p.h, start: p.start, end: p.end, color: p.color, box: p.box, size: p.size, font: p.font })),
    W,
    H,
    bg,
  );
}
