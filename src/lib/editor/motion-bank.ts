// «موشن جرافيكس» — the bank: a million motion pieces, made on demand and the same every time (piece n is always the
// same piece). Each one is a storyboard written the way a good motion designer writes it for its feeling and its
// skill: the beats, the words, an icon where a picture carries the meaning, shapes drawn on the margins, the saying
// of every beat so the montage lasts exactly as long as the voice. A quarter of them carry the mistakes a hurried
// storyboard has (a title three times too long, seven points, a number of ten digits, shapes outside the frame, a
// made-up icon, a misspelt mood…), so the engine's repairs are tried on them too.
//
//   · pieceAt(n)      → the piece
//   · auditPiece(p)   → everything wrong with what the engine makes of it (nothing is the goal), and a score out of 10
//   · nearestMotionExamples → the closest worked pieces to a request, shown to حيدرة as examples
//
// Pure: the tests and scripts/motion-million.mjs run it, in batches of 20,000, and report each batch.

import { applyAll } from "./commands";
import { emptyTimeline, type Ratio } from "./model";
import { lintMotion, lintPlaced, motionCommands, motionPlan, narrationMs, PALETTES, readStoryboard, retimeMap, type BeatKind } from "./motion-build";
import { MOTION_ICONS } from "./motion-icons";
import { MOODS, MOTION_STYLES, SCENE_IDS, type MotionMood } from "./motion-styles";
import { VOCAB } from "./motion-topics";
import { SHAPE_TYPES } from "./motion-art";

/** How many pieces the bank holds. */
export const BANK_SIZE = 1_000_000;

const RATIOS: Ratio[] = ["9:16", "16:9", "1:1", "4:5"];
const SKILLS = MOTION_STYLES.filter((s) => !s.talk);
const HANDLES = ["@nahjali", "@jawad.ai", "@brand.ksa", "@learn.daily", "@sada.ar", "@ofoq"];
const HEADS = ["cairo", "tajawal", "almarai", "changa", "readex", "amiri"];
const COLOR_WORDS = ["accent", "second", "text", "pill", "bg"];

function rng(n: number) {
  let a = (Math.imul(n + 1, 2654435761) + 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface BankPiece {
  n: number;
  mood: MotionMood;
  style: string;
  ratio: Ratio;
  /** the topic's subject (what the words are about) */
  subject: string;
  /** the storyboard as حيدرة would write it (JSON-able; mistakes included when `noisy`) */
  raw: Record<string, unknown>;
  noisy: boolean;
}

/** Piece `n` (0 ≤ n < BANK_SIZE; any number works). `clean`: without the hurried mistakes (the worked examples). */
export function pieceAt(n: number, o: { clean?: boolean } = {}): BankPiece {
  const r = rng(n);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const mood = MOODS[n % MOODS.length];
  const skill = SKILLS[Math.floor(n / MOODS.length) % SKILLS.length];
  const v = VOCAB[mood.id];
  const subject = pick(v.subjects);
  const ratio = pick(RATIOS);
  const noisy = !o.clean && r() < 0.25;
  const sample = (a: string[], k: number) => {
    const pool = [...a];
    const out: string[] = [];
    while (out.length < k && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return out;
  };

  // the beats: the skill's kinds, a hook first and a closing last when the skill has one
  const kinds = [...new Set(skill.beats)] as BeatKind[];
  const mid = kinds.filter((k) => k !== "outro");
  const count = 4 + Math.floor(r() * 6);
  const seq: BeatKind[] = [mid[0] ?? "statement"];
  while (seq.length < count - (kinds.includes("outro") ? 1 : 0)) seq.push(pick(mid.length ? mid : (["statement"] as BeatKind[])));
  if (kinds.includes("outro")) seq.push("outro");

  const beats: Record<string, unknown>[] = seq.map((kind) => {
    const b: Record<string, unknown> = { kind };
    switch (kind) {
      case "title":
        b.title = pick(v.titles).replace("{s}", subject);
        b.text = pick(v.lines);
        break;
      case "statement":
        b.text = r() < 0.3 ? `${pick(v.lines)}، ${pick(v.lines)}` : pick(v.lines);
        break;
      case "stat": {
        const [value, label, note] = pick(v.stats);
        Object.assign(b, { value, label, text: note });
        break;
      }
      case "points":
      case "steps":
        b.title = subject;
        b.items = sample(v.items, 3 + Math.floor(r() * 2));
        break;
      case "compare": {
        const [rt, rx, lt, lx] = pick(v.compares);
        Object.assign(b, { title: subject, right: { title: rt, text: rx }, left: { title: lt, text: lx } });
        break;
      }
      case "quote": {
        const [text, by] = pick(v.quotes);
        Object.assign(b, { text, by });
        break;
      }
      case "kinetic": {
        const words = pick(v.words);
        Object.assign(b, { words, hot: Math.min(1, words.length - 1) });
        break;
      }
      case "outro": {
        const [title, text] = pick(v.outros);
        Object.assign(b, { title, text, handle: pick(HANDLES) });
        break;
      }
    }
    return b;
  });

  // pictures and drawing: an icon where a picture carries the meaning, a feeling of its own now and then, shapes on the margins
  for (const b of beats) {
    if (b.kind !== "kinetic" && r() < 0.42) b.icon = r() < 0.5 ? pick(v.icons) : "auto";
    if (r() < 0.12) b.mood = pick(MOODS).id;
    if (r() < 0.08) b.scene = pick(SCENE_IDS);
    if (r() < 0.3) b.shapes = Array.from({ length: 1 + Math.floor(r() * 4) }, () => shapeOf(r, pick, o.clean === true));
  }

  // the saying of each beat (what the voice reads over it), and sometimes the piece is asked to fit the narration
  const said = r() < 0.7;
  if (said) for (const b of beats) b.say = sayOf(b);
  const total = beats.reduce((n2, b) => n2 + (typeof b.say === "string" ? narrationMs(b.say) + 350 : 0), 0);

  const sb: Record<string, unknown> = { style: skill.id, mood: mood.id, beats, at: r() < 0.2 ? Math.floor(r() * 3000) : 0 };
  if (said && r() < 0.5) sb.fitMs = Math.round(total * (0.85 + r() * 0.4));
  if (r() < 0.25) sb.palette = pick(PALETTES).id;
  if (r() < 0.15) sb.head = pick(HEADS);
  if (r() < 0.15) sb.look = { pace: pick(["fast", "normal", "calm"]) };
  if (r() < 0.08) sb.colors = { bg: hex(r), text: hex(r), accent: hex(r) };
  if (r() < 0.05) sb.digits = "arabic";

  if (noisy) hurry(beats, r, pick, v.lines);
  return { n, mood: mood.id, style: skill.id, ratio, subject, raw: sb, noisy };
}

const hex = (r: () => number) => `#${Array.from({ length: 3 }, () => Math.floor(r() * 256).toString(16).padStart(2, "0")).join("")}`;

function shapeOf(r: () => number, pick: <T>(a: T[]) => T, clean: boolean) {
  const t = pick(SHAPE_TYPES);
  const bad = r() < 0.15 && !clean;
  return {
    t,
    x: bad ? r() * 3 - 1 : r(),
    y: bad ? r() * 3 - 1 : r(),
    w: bad ? r() * 4 : 0.05 + r() * 0.4,
    h: 0.02 + r() * 0.35,
    c: r() < 0.8 ? pick(COLOR_WORDS) : hex(r),
    o: bad ? 1 : 0.1 + r() * 0.7,
    r: Math.floor(r() * 360),
    ...(t === "icon" ? { icon: pick(MOTION_ICONS).id } : {}),
  };
}

/** What the voice says over a beat: its words, in reading order, with the pauses a narrator takes. */
function sayOf(b: Record<string, unknown>): string {
  const bits: string[] = [];
  const add = (x: unknown) => typeof x === "string" && x.trim() && bits.push(x.trim());
  if (b.kind === "kinetic") add((b.words as string[]).join(" "));
  if (b.kind === "stat") {
    add(b.value);
    add(b.label);
    add(b.text);
  } else {
    add(b.title);
    add(b.text);
    for (const it of (b.items as string[] | undefined) ?? []) add(it);
    for (const side of ["right", "left"] as const) {
      const s = b[side] as { title?: string; text?: string } | undefined;
      if (s) {
        add(s.title);
        add(s.text);
      }
    }
    add(b.by);
  }
  return `${bits.join("، ")}.`;
}

/** The hurried mistakes: what a storyboard written fast gets wrong. */
function hurry(beats: Record<string, unknown>[], r: () => number, pick: <T>(a: T[]) => T, lines: string[]) {
  for (const b of beats) {
    if (r() < 0.25 && typeof b.title === "string") b.title = `${b.title} ${pick(lines)} ${pick(lines)}`;
    if (r() < 0.2 && typeof b.text === "string") b.text = `${b.text} ${pick(lines)} ${pick(lines)} ${pick(lines)}`;
    if (r() < 0.25 && Array.isArray(b.items)) b.items = [...b.items, ...b.items, "نقطة زائدة"].slice(0, 7);
    if (r() < 0.3 && b.kind === "stat") b.value = pick(["1,250,000,000", "٣٠٠٠٠٠٠٠", "99.999%"]);
    if (r() < 0.12 && b.kind === "kinetic") b.words = [...(b.words as string[]), "وكلمة", "أخرى", "زيادة", "هنا"];
    if (r() < 0.12) b.icon = "no-such-icon";
    if (r() < 0.08) b.mood = "furious";
    if (r() < 0.06) b.scene = "volcano";
    if (r() < 0.05) b.seconds = pick([0.2, 99]);
  }
}

// ───────────── the audit ─────────────

export interface Issue {
  k: string;
  t: string;
}
export interface Audit {
  n: number;
  score: number;
  issues: Issue[];
  /** what was measured (for the batch report) */
  m: { beats: number; endMs: number; icons: number; shapes: number; scenes: number; dropped: number; ms: number };
}

const SIZES = new Map<Ratio, { w: number; h: number }>(RATIOS.map((r) => [r, { w: emptyTimeline(r).width, h: emptyTimeline(r).height }]));
const wordsOf = (t: string) => t.split(/[\s،.؛:!؟?«»"()●—-]+/u).filter((w) => w.length >= 2 && !/^[\d.,%+×]+$/.test(w));
const SVG_BAD = /NaN|undefined|Infinity|\[object/;

/** Everything wrong with what the engine makes of piece `p` (and its score). `deep`: also build and run the commands. */
export function auditPiece(p: BankPiece, o: { deep?: boolean; retime?: boolean } = {}): Audit {
  const t0 = Date.now();
  const issues: Issue[] = [];
  const add = (k: string, t: string) => issues.push({ k, t });
  const { w: W, h: H } = SIZES.get(p.ratio)!;
  const m: Audit["m"] = { beats: 0, endMs: 0, icons: 0, shapes: 0, scenes: 0, dropped: 0, ms: 0 };
  const done = (): Audit => {
    m.ms = Date.now() - t0;
    const lint = issues.filter((x) => x.k.startsWith("lint:")).length;
    const loss = (issues.some((x) => x.k === "crash") ? 10 : 0) + Math.min(6, lint * 2) + Math.min(3, m.dropped * 0.5) + issues.filter((x) => !["crash", "dropped_text"].includes(x.k) && !x.k.startsWith("lint:")).length * 2;
    return { n: p.n, score: Math.max(0, Math.round((10 - loss) * 10) / 10), issues, m };
  };
  const sb = readStoryboard(JSON.stringify(p.raw));
  if (!sb) {
    add("unreadable", "the storyboard was not read");
    return done();
  }
  let plan: ReturnType<typeof motionPlan>;
  try {
    plan = motionPlan(sb, W, H);
  } catch (e) {
    add("crash", String(e instanceof Error ? e.stack : e).slice(0, 300));
    return done();
  }
  const { placed, palette, endMs, beats, times, anchors, art } = plan;
  m.beats = beats.length;
  m.endMs = endMs;
  m.icons = anchors.filter((a) => a.icon).length;
  m.shapes = beats.reduce((n, b) => n + (b.shapes?.length ?? 0), 0);
  m.scenes = art.filter((a) => a.key.startsWith("bg-")).length;

  // the texts: no overlap, inside the safe area, readable
  for (const x of lintPlaced(placed, W, H, palette.bg, { startMs: sb.at ?? 0, arabicDigits: sb.digits === "arabic" })) add(`lint:${x.kind}`, x.text);

  // the times: beats follow each other, the last ends at endMs
  times.forEach((x, i) => {
    if (x.end <= x.start) add("times", `beat ${i} lasts ${x.end - x.start} ms`);
    if (i && Math.abs(times[i - 1].end - x.start) > 1) add("times", `beat ${i} does not start where the last ends`);
  });
  if (times.length && Math.abs(times[times.length - 1].end - endMs) > 1) add("times", "the piece does not end with its last beat");

  // the voice sets the timing: a piece asked to fit a length does, and a beat that is spoken lasts as long as the saying
  const start = sb.at ?? 0;
  if (sb.fitMs && endMs - start !== sb.fitMs && Math.abs(endMs - start - sb.fitMs) > beats.length + 1 && sb.fitMs >= 1200 * beats.length) add("fit", `fits ${endMs - start} ms instead of ${sb.fitMs}`);
  if (!sb.fitMs) beats.forEach((b, i) => {
    if (b.say && !b.seconds && times[i].end - times[i].start + 5 < Math.min(14_000, narrationMs(b.say) + 350)) add("say", `beat ${i} ends before its saying does`);
  });

  // nothing the storyboard says is lost on the way (a beat too full is split, never cut)
  const placedWords = new Set(wordsOf(placed.map((x) => x.body).join(" ")));
  const cleaned = sb.beats.flatMap((b) => wordsOf([b.title, b.text, b.label, b.by, ...(b.items ?? []), ...(b.words ?? []), b.left?.title, b.left?.text, b.right?.title, b.right?.text].filter(Boolean).join(" ")));
  const missing = [...new Set(cleaned)].filter((w) => !placedWords.has(w) && !placedWords.has(w.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))));
  m.dropped = missing.length;
  if (missing.length) add("dropped_text", `left out: ${missing.slice(0, 6).join("، ")}`);

  // the icon: above the words, inside the frame
  anchors.forEach((a, i) => {
    if (!a.icon) return;
    const u = Math.min(W, H);
    const half = (a.icon.size * u) / H / 2;
    const halfW = (a.icon.size * u) / W / 2;
    const mine = placed.filter((x) => x.beat === i);
    const textTop = mine.length ? Math.min(...mine.map((x) => x.y - x.h / 2)) : 1;
    if (a.icon.y + half > textTop + 0.002) add("icon", `beat ${i}: the icon (to ${(a.icon.y + half).toFixed(3)}) reaches the words (from ${textTop.toFixed(3)})`);
    if (a.icon.y - half < 0.02 || a.icon.x - halfW < 0.02 || a.icon.x + halfW > 0.98) add("icon", `beat ${i}: the icon leaves the frame`);
  });

  // the art: valid pictures of the frame's shape
  for (const a of art) {
    if (!a.svg.startsWith("<svg") || !a.svg.endsWith("</svg>")) add("art", `${a.key}: not a whole svg`);
    else if (SVG_BAD.test(a.svg)) add("art", `${a.key}: ${a.svg.match(SVG_BAD)![0]} in the drawing`);
    if (Math.abs(a.w / a.h - W / H) > 0.01) add("art", `${a.key}: wrong shape`);
  }

  // the feeling shows in the tempo (only when nothing else sets the lengths)
  if (!sb.fitMs && !beats.some((b) => b.say || b.seconds || b.mood) && !sb.look?.pace) {
    const avg = (endMs - start) / beats.length;
    const pace = plan.look.pace;
    if (pace === "calm" && avg < 3000) add("tempo", `a calm piece averages ${Math.round(avg)} ms a beat`);
    if (pace === "fast" && avg > 5600) add("tempo", `a fast piece averages ${Math.round(avg)} ms a beat`);
  }

  if (o.deep) deepAudit(p, sb, W, H, plan, add, o.retime === true);
  return done();
}

function deepAudit(p: BankPiece, sb: NonNullable<ReturnType<typeof readStoryboard>>, W: number, H: number, plan: ReturnType<typeof motionPlan>, add: (k: string, t: string) => void, retime: boolean) {
  try {
    const tl = emptyTimeline(p.ratio);
    const infos = new Map<string, { id: string; kind: "image"; durationMs: null; width: number; height: number; hasAudio: false }>();
    const ids = new Map<string, string>();
    for (const a of plan.art) {
      const id = `asset-${a.key}`;
      ids.set(a.key, id);
      infos.set(id, { id, kind: "image", durationMs: null, width: a.w, height: a.h, hasAudio: false });
    }
    const { commands } = motionCommands(sb, W, H, 0, ids);
    const out = applyAll(tl, commands, infos).timeline;
    for (const x of lintMotion(out)) add(`lint:timeline-${x.kind}`, x.text);
    if (retime) {
      const end = plan.endMs;
      // a recording shorter than the words need is not followed below the least each beat can be
      const target = Math.max(plan.fit.from + 1200 * plan.fit.weights.length, Math.round(plan.fit.from + (end - plan.fit.from) * (0.7 + 0.7 * ((p.n % 17) / 16))));
      const moved = applyAll(out, [{ type: "retime", map: retimeMap(plan.fit, target) }], infos).timeline;
      const clips = moved.tracks.flatMap((t) => t.clips);
      if (clips.some((c) => c.start < 0 || !Number.isFinite(c.start) || c.out <= c.in)) add("retime", "a clip has a bad time after the retime");
      const last = Math.max(...moved.tracks.flatMap((t) => t.clips.map((c) => c.start + (c.out - c.in) / (c.speed || 1))));
      if (Math.abs(last - target) > 60 + plan.beats.length * 2) add("retime", `the piece ends at ${last} instead of ${target}`);
      for (const x of lintMotion(moved)) if (x.kind === "overlap" || x.kind === "outside") add(`lint:retime-${x.kind}`, x.text);
    }
  } catch (e) {
    add("commands", String(e instanceof Error ? e.message : e).slice(0, 200));
  }
}

// ───────────── the examples حيدرة is shown ─────────────

const tokens = (t: string) => new Set(t.toLowerCase().split(/[\s،.؛:!؟?«»"()]+/u).filter((w) => w.length >= 3));

/** The closest clean pieces to a request (same feeling and skill when named; then the topic's words): compact storyboards. */
export function nearestMotionExamples(message: string, o: { mood?: MotionMood; style?: string }, k = 2): BankPiece[] {
  const want = tokens(message);
  const moodIdx = Math.max(0, MOODS.findIndex((m) => m.id === o.mood));
  const styles = o.style ? [Math.max(0, SKILLS.findIndex((s) => s.id === o.style))] : SKILLS.map((_, i) => i);
  const per = o.style ? 120 : 12;
  const scored: { n: number; score: number }[] = [];
  for (const si of styles) {
    for (let j = 0; j < per; j++) {
      const n = MOODS.length * (SKILLS.length * j + si) + (o.mood ? moodIdx : j % MOODS.length);
      const p = pieceAt(n, { clean: true });
      const have = tokens(JSON.stringify(p.raw));
      let score = 0;
      for (const w of want) if (have.has(w)) score += 1;
      scored.push({ n, score: score + (o.mood ? 0 : p.mood === "teach" ? 0.01 : 0) });
    }
  }
  return scored
    .sort((a, b) => b.score - a.score || a.n - b.n)
    .slice(0, k)
    .map((x) => pieceAt(x.n, { clean: true }));
}

/** The examples as a block for حيدرة's request: each a whole, working storyboard. */
export function motionExamplesBrief(pieces: BankPiece[]): string {
  if (!pieces.length) return "";
  return `WORKED EXAMPLES of motion pieces (from the site's bank of a million; each came out clean through the layout engine — copy their craft, not their words):\n${pieces
    .map((p) => `· ${MOODS.find((m) => m.id === p.mood)!.ar} / ${MOTION_STYLES.find((s) => s.id === p.style)!.ar} / ${p.ratio}: ${JSON.stringify(p.raw)}`)
    .join("\n")}`;
}

