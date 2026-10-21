// «الصحة العلوية»: the technique drawings of the exercises. A simple coach-style figure (head, torso, arms, legs as
// round strokes) drawn from joint angles, moving between the key positions of the exercise (config/mahdi/exercise-figures.ts),
// with its equipment (bench, dumbbell, barbell, cable, band…), the last position as a faint ghost, and an arrow along the
// path of the joint that shows the movement. Pure geometry: it returns shapes; the component (ExerciseFigure) draws them.
//
// Angles are degrees in screen space: 0 = right (where the figure faces), 90 = down, 180 = left, -90 = up.

export type Pt = [number, number];
/** Side view joints; the far leg and arm end in 2. */
export type Joint = "hip" | "knee" | "ankle" | "toe" | "shoulder" | "elbow" | "wrist" | "head" | "knee2" | "ankle2" | "toe2" | "elbow2" | "wrist2";
/** Front view joints: R = the right side of the picture, L = the left. */
export type FrontJoint = "hip" | "chest" | "head" | "elbowR" | "wristR" | "elbowL" | "wristL" | "kneeR" | "ankleR" | "kneeL" | "ankleL";

export interface SideFrame {
  view?: "side";
  /** where the anchor joint is (it stays there, the body hangs from it) */
  at: Pt;
  anchor: Joint;
  thigh: number;
  shin: number;
  foot?: number;
  torso: number;
  /** the head's direction (default: the torso's) */
  neck?: number;
  arm: number;
  fore: number;
  /** the far leg and arm (default: the same as the near ones) */
  thigh2?: number;
  shin2?: number;
  foot2?: number;
  arm2?: number;
  fore2?: number;
  /** shortening of the arms or forearms pointing at the viewer (1 = full) */
  armScale?: number;
  foreScale?: number;
}

/** Front (or back, or top) view: angles for the right side of the picture; the left mirrors them unless given. */
export interface FrontFrame {
  view: "front";
  at: Pt;
  armR: number;
  foreR: number;
  armL?: number;
  foreL?: number;
  thighR?: number;
  shinR?: number;
  thighL?: number;
  shinL?: number;
  /** arm and leg shortening (pointing at the viewer) */
  reach?: number;
  legReach?: number;
  /** shorter torso for a body bent toward the viewer */
  torsoScale?: number;
  /** turn the whole figure around the hip (lying down) */
  rot?: number;
  /** only the shoulders and arms, seen from above */
  top?: boolean;
}

export type Frame = SideFrame | FrontFrame;

type Ref = Pt | { joint: string; frame?: number; dx?: number; dy?: number };

export type Prop =
  | { t: "bench"; a: Ref; b: Ref; legs?: boolean }
  | { t: "box"; x: number; y: number; w: number; h?: number }
  | { t: "under"; joint: string; frame?: number; w: number; dx?: number; gap?: number; kind?: "chair" | "box" | "bench" }
  | { t: "wall"; x: number; top?: number }
  | { t: "post"; x: number; top: number }
  | { t: "bar"; at: Ref }
  | { t: "cable"; from: Pt; to: string }
  | { t: "band"; from: Ref; to: string; to2?: string }
  | { t: "towel"; from: Ref; to: string }
  | { t: "plate"; at: string; angle: number; len?: number }
  | { t: "pad"; at: string; dx?: number; dy?: number }
  | { t: "panel"; x: number; y: number; w: number; h: number };

export type Hold = "dumbbell" | "barbell" | "bottle" | "bag" | "handle" | "kettle";

export interface FigureDef {
  frames: Frame[];
  props?: Prop[];
  /** what the hands hold (drawn at the wrists) */
  hold?: Hold;
  /** hold it somewhere else than the wrist (a barbell on the back, a dumbbell between the feet) */
  holdAt?: string;
  /** the joint whose path gets the arrow */
  track?: string;
  /** a joint that pulses (a squeeze held in place: plank, kegel) */
  pulse?: string;
  /** a floor under the figure (default true; a top view has none) */
  floor?: boolean;
}

export type Shape =
  | { k: "line"; a: Pt; b: Pt; w: number; c: Tone; o?: number }
  | { k: "circle"; at: Pt; r: number; c: Tone; fill?: boolean; o?: number; w?: number }
  | { k: "rect"; x: number; y: number; w: number; h: number; c: Tone; o?: number; rx?: number }
  | { k: "path"; d: string; w: number; c: Tone; o?: number; dash?: string; fill?: boolean };

/** body = the near limbs and the trunk, far = the far limbs, gear = equipment, accent = the movement, ghost = the end position */
export type Tone = "body" | "far" | "gear" | "gearSoft" | "accent" | "ghost" | "floor";

export const VIEW = { w: 200, h: 150, floor: 135 };

const L = { thigh: 25, shin: 24, foot: 9, torso: 33, neck: 4, head: 7, arm: 17, fore: 16 };
const F = { shoulder: 12, hip: 7 };

const rad = (a: number) => (a * Math.PI) / 180;
const dir = (a: number, len: number): Pt => [Math.cos(rad(a)) * len, Math.sin(rad(a)) * len];
const add = (p: Pt, q: Pt): Pt => [p[0] + q[0], p[1] + q[1]];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const round = (n: number) => Math.round(n * 10) / 10;

/** Side view joint positions of a frame. */
function sidePoints(f: SideFrame): Record<Joint, Pt> {
  const hip: Pt = [0, 0];
  const knee = add(hip, dir(f.thigh, L.thigh));
  const ankle = add(knee, dir(f.shin, L.shin));
  const toe = add(ankle, dir(f.foot ?? 0, L.foot));
  const knee2 = add(hip, dir(f.thigh2 ?? f.thigh, L.thigh));
  const ankle2 = add(knee2, dir(f.shin2 ?? f.shin, L.shin));
  const toe2 = add(ankle2, dir(f.foot2 ?? f.foot ?? 0, L.foot));
  const shoulder = add(hip, dir(f.torso, L.torso));
  const head = add(shoulder, dir(f.neck ?? f.torso, L.neck + L.head));
  const as = f.armScale ?? 1;
  const fs = f.foreScale ?? 1;
  const elbow = add(shoulder, dir(f.arm, L.arm * as));
  const wrist = add(elbow, dir(f.fore, L.fore * fs));
  const elbow2 = add(shoulder, dir(f.arm2 ?? f.arm, L.arm * as));
  const wrist2 = add(elbow2, dir(f.fore2 ?? f.fore, L.fore * fs));
  const pts = { hip, knee, ankle, toe, knee2, ankle2, toe2, shoulder, head, elbow, wrist, elbow2, wrist2 };
  const o = pts[f.anchor];
  const shift: Pt = [f.at[0] - o[0], f.at[1] - o[1]];
  return Object.fromEntries(Object.entries(pts).map(([k, p]) => [k, add(p, shift)])) as Record<Joint, Pt>;
}

/** Front view positions (with the shoulder and hip corners for drawing). */
function frontPoints(f: FrontFrame) {
  const r = f.reach ?? 1;
  const lr = f.legReach ?? 1;
  const ts = f.torsoScale ?? 1;
  const mirror = (a: number) => 180 - a;
  const hip: Pt = [0, 0];
  const chest: Pt = [0, -L.torso * ts];
  const head: Pt = [0, -L.torso * ts - L.neck - L.head];
  const shR: Pt = [F.shoulder, chest[1] + 2];
  const shL: Pt = [-F.shoulder, chest[1] + 2];
  const hipR: Pt = [F.hip, 0];
  const hipL: Pt = [-F.hip, 0];
  const elbowR = add(shR, dir(f.armR, L.arm * r));
  const wristR = add(elbowR, dir(f.foreR, L.fore * r));
  const elbowL = add(shL, dir(f.armL ?? mirror(f.armR), L.arm * r));
  const wristL = add(elbowL, dir(f.foreL ?? mirror(f.foreR), L.fore * r));
  const kneeR = add(hipR, dir(f.thighR ?? 88, L.thigh * lr));
  const ankleR = add(kneeR, dir(f.shinR ?? 90, L.shin * lr));
  const kneeL = add(hipL, dir(f.thighL ?? mirror(f.thighR ?? 88), L.thigh * lr));
  const ankleL = add(kneeL, dir(f.shinL ?? mirror(f.shinR ?? 90), L.shin * lr));
  const pts = { hip, chest, head, shR, shL, hipR, hipL, elbowR, wristR, elbowL, wristL, kneeR, ankleR, kneeL, ankleL };
  const rot = rad(f.rot ?? 0);
  const turn = (p: Pt): Pt => [p[0] * Math.cos(rot) - p[1] * Math.sin(rot), p[0] * Math.sin(rot) + p[1] * Math.cos(rot)];
  return Object.fromEntries(Object.entries(pts).map(([k, p]) => [k, add(turn(p), f.at)])) as Record<keyof typeof pts, Pt>;
}

/** A frame with every optional angle written out (so a value given in one position moves from its default in the other). */
function complete(f: Frame): Frame {
  if (f.view === "front") {
    const thighR = f.thighR ?? 88;
    const shinR = f.shinR ?? 90;
    return { reach: 1, legReach: 1, torsoScale: 1, rot: 0, armL: 180 - f.armR, foreL: 180 - f.foreR, thighR, shinR, thighL: 180 - thighR, shinL: 180 - shinR, ...f };
  }
  const foot = f.foot ?? 0;
  return { neck: f.torso, foot, thigh2: f.thigh, shin2: f.shin, foot2: foot, arm2: f.arm, fore2: f.fore, armScale: 1, foreScale: 1, ...f };
}

/** The frame between two key positions (angles and the anchor point move together). */
function mix(a: Frame, b: Frame, t: number): Frame {
  const ca = complete(a) as unknown as Record<string, unknown>;
  const cb = complete(b) as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { ...ca };
  for (const [k, v] of Object.entries(ca)) {
    const w = cb[k];
    if (typeof v === "number" && typeof w === "number") out[k] = lerp(v, w, t);
  }
  out.at = [lerp(a.at[0], b.at[0], t), lerp(a.at[1], b.at[1], t)];
  return out as unknown as Frame;
}

/** The pose at a moment: `p` from 0 (first frame) to frames.length - 1 (last). */
export function frameAt(def: FigureDef, p: number): Frame {
  const n = def.frames.length;
  if (n === 1) return def.frames[0];
  const i = Math.min(n - 2, Math.max(0, Math.floor(p)));
  const t = Math.min(1, Math.max(0, p - i));
  // ease in and out: a coach's tempo, not a robot's
  const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  return mix(def.frames[i], def.frames[i + 1], e);
}

export function pointsOf(f: Frame): Record<string, Pt> {
  return f.view === "front" ? frontPoints(f) : sidePoints(f);
}

function resolve(ref: Ref, def: FigureDef, now: Record<string, Pt>): Pt {
  if (Array.isArray(ref)) return ref;
  const base = ref.frame === undefined ? now[ref.joint] : pointsOf(def.frames[ref.frame])[ref.joint];
  return [(base?.[0] ?? 0) + (ref.dx ?? 0), (base?.[1] ?? 0) + (ref.dy ?? 0)];
}

/** The body of one frame, as strokes. */
function bodyShapes(f: Frame, tone: { near: Tone; far: Tone }, o?: number): Shape[] {
  const p = pointsOf(f);
  const s: Shape[] = [];
  const limb = (a: string, b: string, w: number, c: Tone) => p[a] && p[b] && s.push({ k: "line", a: p[a], b: p[b], w, c, o });
  if (f.view === "front") {
    if (!f.top) {
      limb("hipL", "kneeL", 7, tone.near);
      limb("kneeL", "ankleL", 6, tone.near);
      limb("hipR", "kneeR", 7, tone.near);
      limb("kneeR", "ankleR", 6, tone.near);
      s.push({ k: "path", d: `M${p.shL.join(",")} L${p.shR.join(",")} L${p.hipR.join(",")} L${p.hipL.join(",")} Z`, w: 6, c: tone.near, o, fill: true });
    } else {
      const mid: Pt = [(p.shL[0] + p.shR[0]) / 2, (p.shL[1] + p.shR[1]) / 2];
      s.push({ k: "rect", x: mid[0] - F.shoulder - 3, y: mid[1] - 6, w: (F.shoulder + 3) * 2, h: 12, c: tone.near, o, rx: 6 });
    }
    limb("shL", "elbowL", 6, tone.near);
    limb("elbowL", "wristL", 5, tone.near);
    limb("shR", "elbowR", 6, tone.near);
    limb("elbowR", "wristR", 5, tone.near);
    s.push({ k: "circle", at: f.top ? [(p.shL[0] + p.shR[0]) / 2, (p.shL[1] + p.shR[1]) / 2 + 3] : p.head, r: L.head, c: f.top ? "far" : tone.near, fill: true, o });
    return s;
  }
  // far limbs first, then the trunk, then the near limbs on top
  limb("hip", "knee2", 7, tone.far);
  limb("knee2", "ankle2", 6, tone.far);
  limb("ankle2", "toe2", 4, tone.far);
  limb("shoulder", "elbow2", 6, tone.far);
  limb("elbow2", "wrist2", 5, tone.far);
  limb("hip", "shoulder", 10, tone.near);
  s.push({ k: "circle", at: p.head, r: L.head, c: tone.near, fill: true, o });
  limb("hip", "knee", 7, tone.near);
  limb("knee", "ankle", 6, tone.near);
  limb("ankle", "toe", 4, tone.near);
  limb("shoulder", "elbow", 6, tone.near);
  limb("elbow", "wrist", 5, tone.near);
  return s;
}

function holdShapes(def: FigureDef, p: Record<string, Pt>, f: Frame): Shape[] {
  if (!def.hold) return [];
  const spots = def.holdAt ? [def.holdAt] : f.view === "front" ? ["wristR", "wristL"] : ["wrist"];
  const out: Shape[] = [];
  for (const j of spots) {
    const at = p[j];
    if (!at) continue;
    switch (def.hold) {
      case "barbell":
        out.push({ k: "circle", at, r: 11, c: "gear", fill: true }, { k: "circle", at, r: 2.5, c: "gearSoft", fill: true });
        break;
      case "dumbbell":
        out.push({ k: "rect", x: at[0] - 6, y: at[1] - 3.5, w: 12, h: 7, c: "gear", rx: 2.5 });
        break;
      case "kettle":
        out.push({ k: "circle", at: [at[0], at[1] + 5], r: 6, c: "gear", fill: true });
        break;
      case "bottle":
        out.push({ k: "rect", x: at[0] - 3, y: at[1] - 7, w: 6, h: 14, c: "gearSoft", rx: 2 });
        break;
      case "bag":
        out.push({ k: "rect", x: at[0] - 7, y: at[1] - 1, w: 14, h: 12, c: "gear", rx: 3 });
        break;
      case "handle":
        out.push({ k: "line", a: [at[0], at[1] - 5], b: [at[0], at[1] + 5], w: 3.5, c: "gear" });
        break;
    }
  }
  return out;
}

function propShapes(def: FigureDef, now: Record<string, Pt>): { back: Shape[]; front: Shape[] } {
  const back: Shape[] = [];
  const front: Shape[] = [];
  const floor = VIEW.floor;
  for (const pr of def.props ?? []) {
    switch (pr.t) {
      case "bench": {
        const a = resolve(pr.a, def, now);
        const b = resolve(pr.b, def, now);
        back.push({ k: "line", a, b, w: 6, c: "gear" });
        if (pr.legs !== false) for (const q of [a, b]) if (q[1] < floor - 3) back.push({ k: "line", a: [q[0], q[1] + 3], b: [q[0], floor], w: 3, c: "gearSoft" });
        break;
      }
      case "box":
        back.push({ k: "rect", x: pr.x, y: pr.y, w: pr.w, h: pr.h ?? floor - pr.y, c: "gearSoft", rx: 2 });
        break;
      case "under": {
        const j = resolve({ joint: pr.joint, frame: pr.frame }, def, now);
        const top = j[1] + (pr.gap ?? 5);
        const x = j[0] + (pr.dx ?? 0) - pr.w / 2;
        if (pr.kind === "chair") {
          back.push({ k: "line", a: [x, top], b: [x + pr.w, top], w: 4, c: "gear" });
          back.push({ k: "line", a: [x + 2, top], b: [x + 2, floor], w: 3, c: "gearSoft" });
          back.push({ k: "line", a: [x + pr.w - 2, top], b: [x + pr.w - 2, floor], w: 3, c: "gearSoft" });
        } else if (pr.kind === "bench") {
          back.push({ k: "line", a: [x, top], b: [x + pr.w, top], w: 6, c: "gear" });
          back.push({ k: "line", a: [x + 4, top], b: [x + 4, floor], w: 3, c: "gearSoft" });
          back.push({ k: "line", a: [x + pr.w - 4, top], b: [x + pr.w - 4, floor], w: 3, c: "gearSoft" });
        } else back.push({ k: "rect", x, y: top, w: pr.w, h: floor - top, c: "gearSoft", rx: 2 });
        break;
      }
      case "wall":
        back.push({ k: "line", a: [pr.x, pr.top ?? 8], b: [pr.x, floor], w: 4, c: "gearSoft" });
        break;
      case "post":
        back.push({ k: "line", a: [pr.x, pr.top], b: [pr.x, floor], w: 5, c: "gearSoft" });
        break;
      case "panel":
        back.push({ k: "rect", x: pr.x, y: pr.y, w: pr.w, h: pr.h, c: "gearSoft", o: 0.35, rx: 4 });
        break;
      case "bar": {
        const at = resolve(pr.at, def, now);
        back.push({ k: "line", a: [at[0] - 30, at[1]], b: [at[0] + 30, at[1]], w: 4, c: "gear" });
        break;
      }
      case "cable": {
        const to = now[pr.to];
        back.push({ k: "circle", at: pr.from, r: 4, c: "gear", w: 2.5 });
        if (to) front.push({ k: "line", a: pr.from, b: to, w: 1.6, c: "gear" });
        break;
      }
      case "band": {
        const a = resolve(pr.from, def, now);
        for (const j of [pr.to, pr.to2]) {
          const b = j ? now[j] : undefined;
          if (b) front.push({ k: "path", d: `M${a.join(",")} L${b.join(",")}`, w: 2.4, c: "accent", o: 0.75, dash: "5 3" });
        }
        break;
      }
      case "towel": {
        const a = resolve(pr.from, def, now);
        const b = now[pr.to];
        if (b) front.push({ k: "line", a, b, w: 3.5, c: "gearSoft" });
        break;
      }
      case "plate": {
        const at = now[pr.at];
        if (!at) break;
        const d = dir(pr.angle, (pr.len ?? 22) / 2);
        front.push({ k: "line", a: [at[0] - d[0], at[1] - d[1]], b: [at[0] + d[0], at[1] + d[1]], w: 4, c: "gear" });
        break;
      }
      case "pad": {
        const at = now[pr.at];
        if (at) front.push({ k: "circle", at: [at[0] + (pr.dx ?? 0), at[1] + (pr.dy ?? 0)], r: 4.5, c: "gear", fill: true });
        break;
      }
    }
  }
  return { back, front };
}

/** The arrow along the tracked joint's path, from the first key position to the last. */
function arrowShapes(def: FigureDef): Shape[] {
  if (!def.track || def.frames.length < 2) return [];
  const n = def.frames.length - 1;
  const pts: Pt[] = [];
  for (let i = 0; i <= 24; i++) {
    const q = pointsOf(frameAt(def, (i / 24) * n))[def.track];
    if (q) pts.push(q);
  }
  if (pts.length < 2) return [];
  const len = pts.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]), 0);
  if (len < 6) return [];
  // set the arrow a little off the joint so it does not hide the hand or the foot
  const d = `M${pts.map((q) => q.map(round).join(",")).join(" L")}`;
  const end = pts[pts.length - 1];
  const prev = pts[Math.max(0, pts.length - 4)];
  const a = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
  const head = (da: number): Pt => [end[0] - Math.cos(a + da) * 6, end[1] - Math.sin(a + da) * 6];
  return [
    { k: "path", d, w: 2.2, c: "accent", dash: "3 3", o: 0.9 },
    { k: "path", d: `M${head(0.5).map(round).join(",")} L${end.map(round).join(",")} L${head(-0.5).map(round).join(",")}`, w: 2.4, c: "accent" },
  ];
}

/** Everything to draw at moment `p`: the ghost of the last position, the props, the body, the gear and the arrow. */
export function figureShapes(def: FigureDef, p: number, opts: { ghost?: boolean; arrow?: boolean } = {}): Shape[] {
  const f = frameAt(def, p);
  const now = pointsOf(f);
  const out: Shape[] = [];
  if (def.floor !== false) out.push({ k: "line", a: [6, VIEW.floor + 2], b: [VIEW.w - 6, VIEW.floor + 2], w: 2, c: "floor" });
  const props = propShapes(def, now);
  out.push(...props.back);
  if (opts.ghost !== false && def.frames.length > 1) {
    const last = def.frames[def.frames.length - 1];
    const lastPts = pointsOf(last);
    out.push(...bodyShapes(last, { near: "ghost", far: "ghost" }, 0.22), ...holdShapes(def, lastPts, last).map((s) => ({ ...s, c: "ghost" as Tone, o: 0.22 })));
  }
  out.push(...bodyShapes(f, { near: "body", far: "far" }));
  out.push(...holdShapes(def, now, f));
  out.push(...props.front);
  if (def.pulse && now[def.pulse]) out.push({ k: "circle", at: now[def.pulse], r: 9, c: "accent", w: 2.5 });
  if (opts.arrow !== false) out.push(...arrowShapes(def));
  return out;
}

/** Shapes as one SVG string (scripts and tests); the component draws the same shapes itself. */
export function shapesToSvg(shapes: Shape[], colors: Record<Tone, string>): string {
  const attr = (s: Shape) => `${s.o !== undefined ? ` opacity="${s.o}"` : ""}`;
  const body = shapes
    .map((s) => {
      switch (s.k) {
        case "line":
          return `<line x1="${round(s.a[0])}" y1="${round(s.a[1])}" x2="${round(s.b[0])}" y2="${round(s.b[1])}" stroke="${colors[s.c]}" stroke-width="${s.w}" stroke-linecap="round"${attr(s)}/>`;
        case "circle":
          return `<circle cx="${round(s.at[0])}" cy="${round(s.at[1])}" r="${s.r}" ${s.fill ? `fill="${colors[s.c]}"` : `fill="none" stroke="${colors[s.c]}" stroke-width="${s.w ?? 2}"`}${attr(s)}/>`;
        case "rect":
          return `<rect x="${round(s.x)}" y="${round(s.y)}" width="${round(s.w)}" height="${round(s.h)}" rx="${s.rx ?? 0}" fill="${colors[s.c]}"${attr(s)}/>`;
        case "path":
          return `<path d="${s.d}" ${s.fill ? `fill="${colors[s.c]}" stroke="${colors[s.c]}" stroke-linejoin="round"` : `fill="none" stroke="${colors[s.c]}"`} stroke-width="${s.w}" stroke-linecap="round"${s.dash ? ` stroke-dasharray="${s.dash}"` : ""}${attr(s)}/>`;
      }
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW.w} ${VIEW.h}">${body}</svg>`;
}
