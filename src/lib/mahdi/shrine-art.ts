// «لأجل المهدي» — the holy shrines DRAWN (vector, by hand in code — not generated pictures): each shrine described by
// its real parts, read from the pictures made earlier (public/mahdi/shrines): its domes (gold, turquoise, green or
// white), its minarets, its great iwan, its clock tower, its arcades and walls. The parts become plain shapes that
// every design draws its own way (lines, neon, flat, black outlines, a silhouette, halftone dots, a pencil sketch,
// gold). Pure: the page and the tests use it.

export type Tint = "gold" | "turquoise" | "green" | "white" | "blue" | "sand";

export interface ShrineSpec {
  /** the arcade around the court: its height, and the tiles it is dressed in */
  wall: { h: number; tint: "blue" | "sand" };
  domes: { x: number; w: number; h: number; tint: Tint; drum?: number }[];
  minarets: { x: number; h: number; tint: Tint }[];
  iwans?: { x: number; w: number; h: number; tint: Tint }[];
  clock?: { x: number; h: number };
  /** a low cemetery wall and graves in front (al-Baqi) */
  graves?: boolean;
  /** battlements on the wall (Kufa, Sahla) */
  crenels?: boolean;
}

/** The thirteen shrines (ids as in the database), in a 400 × 200 frame whose ground is at y = 184. */
export const SHRINE_SPECS: Record<string, ShrineSpec> = {
  "imam-ali": { wall: { h: 34, tint: "blue" }, domes: [{ x: 200, w: 74, h: 62, tint: "gold" }], minarets: [{ x: 150, h: 128, tint: "gold" }, { x: 250, h: 128, tint: "gold" }], iwans: [{ x: 200, w: 70, h: 58, tint: "gold" }], clock: { x: 300, h: 104 } },
  "imam-hussain": { wall: { h: 36, tint: "blue" }, domes: [{ x: 200, w: 70, h: 64, tint: "gold" }], minarets: [{ x: 132, h: 146, tint: "gold" }, { x: 268, h: 146, tint: "gold" }], iwans: [{ x: 200, w: 64, h: 60, tint: "gold" }], clock: { x: 236, h: 112 } },
  abbas: { wall: { h: 36, tint: "blue" }, domes: [{ x: 150, w: 66, h: 58, tint: "gold" }], minarets: [{ x: 206, h: 146, tint: "gold" }, { x: 236, h: 146, tint: "gold" }], iwans: [{ x: 262, w: 60, h: 62, tint: "blue" }] },
  askariyain: { wall: { h: 34, tint: "blue" }, domes: [{ x: 196, w: 96, h: 76, tint: "gold" }, { x: 312, w: 40, h: 30, tint: "turquoise" }], minarets: [{ x: 128, h: 140, tint: "gold" }, { x: 262, h: 140, tint: "gold" }], iwans: [{ x: 196, w: 64, h: 54, tint: "blue" }], clock: { x: 286, h: 100 } },
  "imam-ridha": { wall: { h: 30, tint: "blue" }, domes: [{ x: 150, w: 70, h: 60, tint: "gold" }, { x: 300, w: 44, h: 36, tint: "turquoise" }], minarets: [{ x: 92, h: 144, tint: "gold" }, { x: 196, h: 132, tint: "gold" }], iwans: [{ x: 168, w: 78, h: 76, tint: "gold" }] },
  masuma: { wall: { h: 32, tint: "blue" }, domes: [{ x: 200, w: 66, h: 58, tint: "gold" }], minarets: [{ x: 140, h: 150, tint: "blue" }, { x: 260, h: 150, tint: "blue" }, { x: 98, h: 84, tint: "blue" }, { x: 302, h: 84, tint: "blue" }], iwans: [{ x: 200, w: 70, h: 68, tint: "gold" }] },
  kadhimiya: { wall: { h: 34, tint: "blue" }, domes: [{ x: 170, w: 52, h: 46, tint: "gold" }, { x: 232, w: 52, h: 46, tint: "gold" }], minarets: [{ x: 96, h: 140, tint: "gold" }, { x: 306, h: 140, tint: "gold" }, { x: 136, h: 102, tint: "gold" }, { x: 266, h: 102, tint: "gold" }], iwans: [{ x: 201, w: 60, h: 54, tint: "blue" }], clock: { x: 201, h: 118 } },
  jamkaran: { wall: { h: 30, tint: "blue" }, domes: [{ x: 200, w: 76, h: 70, tint: "turquoise" }, { x: 120, w: 34, h: 28, tint: "turquoise" }, { x: 280, w: 34, h: 28, tint: "turquoise" }, { x: 56, w: 26, h: 22, tint: "turquoise" }, { x: 344, w: 26, h: 22, tint: "turquoise" }], minarets: [{ x: 150, h: 150, tint: "turquoise" }, { x: 250, h: 150, tint: "turquoise" }], iwans: [{ x: 200, w: 56, h: 56, tint: "blue" }] },
  prophet: { wall: { h: 34, tint: "sand" }, domes: [{ x: 230, w: 58, h: 50, tint: "green" }, { x: 160, w: 34, h: 26, tint: "white" }], minarets: [{ x: 40, h: 104, tint: "white" }, { x: 92, h: 120, tint: "white" }, { x: 132, h: 98, tint: "white" }, { x: 286, h: 146, tint: "white" }, { x: 326, h: 112, tint: "white" }, { x: 368, h: 96, tint: "white" }] },
  baqi: { wall: { h: 14, tint: "sand" }, domes: [{ x: 262, w: 22, h: 18, tint: "green", drum: 6 }], minarets: [{ x: 210, h: 70, tint: "white" }, { x: 238, h: 84, tint: "white" }, { x: 290, h: 76, tint: "white" }, { x: 316, h: 62, tint: "white" }], graves: true },
  kufa: { wall: { h: 50, tint: "sand" }, domes: [{ x: 214, w: 30, h: 26, tint: "gold" }, { x: 246, w: 30, h: 26, tint: "gold" }], minarets: [{ x: 120, h: 112, tint: "sand" }, { x: 168, h: 96, tint: "sand" }, { x: 296, h: 104, tint: "sand" }, { x: 344, h: 92, tint: "sand" }], crenels: true },
  sahla: { wall: { h: 46, tint: "sand" }, domes: [{ x: 200, w: 60, h: 52, tint: "turquoise" }], minarets: [{ x: 150, h: 150, tint: "sand" }, { x: 250, h: 150, tint: "sand" }], iwans: [{ x: 200, w: 56, h: 60, tint: "blue" }], crenels: true },
  "sayyida-zainab": { wall: { h: 34, tint: "blue" }, domes: [{ x: 200, w: 70, h: 62, tint: "gold" }], minarets: [{ x: 142, h: 146, tint: "blue" }, { x: 258, h: 146, tint: "blue" }], iwans: [{ x: 200, w: 66, h: 64, tint: "blue" }] },
};

export const shrineSpec = (id: string | null | undefined) => SHRINE_SPECS[id ?? ""] ?? SHRINE_SPECS["imam-ali"];

export type Role = "dome" | "minaret" | "iwan" | "wall" | "detail" | "ground";

export interface Part {
  role: Role;
  tint: Tint;
  d: string;
}

const G = 184;
const r = (n: number) => Math.round(n * 10) / 10;

/** An onion dome on its drum, with its finial. */
function dome(x: number, w: number, h: number, tint: Tint, base: number, drum = Math.max(8, h * 0.28)): Part[] {
  const top = base - drum;
  const hw = w / 2;
  const domePath = `M${r(x - hw)},${r(top)} C${r(x - hw)},${r(top - h * 0.62)} ${r(x - hw * 0.28)},${r(top - h * 0.78)} ${r(x)},${r(top - h)} C${r(x + hw * 0.28)},${r(top - h * 0.78)} ${r(x + hw)},${r(top - h * 0.62)} ${r(x + hw)},${r(top)} Z`;
  return [
    // the drum and the hall under it, down to the ground (the arcade and the iwan stand in front of it)
    { role: "wall", tint: "blue", d: `M${r(x - hw * 0.86)},${G} V${r(top)} H${r(x + hw * 0.86)} V${G} Z` },
    { role: "dome", tint, d: domePath },
    { role: "detail", tint, d: `M${r(x)},${r(top - h)} V${r(top - h - 9)} M${r(x - 3)},${r(top - h - 12)} a3,3 0 1,0 6,0` },
  ];
}

/** A minaret: shaft, two balconies, a small onion cap and its finial. */
function minaret(x: number, h: number, tint: Tint): Part[] {
  const w = 9;
  const top = G - h;
  const b1 = G - h * 0.55;
  const b2 = G - h * 0.84;
  return [
    { role: "minaret", tint, d: `M${r(x - w / 2)},${G} V${r(top + 14)} H${r(x + w / 2)} V${G} Z` },
    { role: "minaret", tint, d: `M${r(x - w)},${r(b1)} h${w * 2} v5 h-${w * 2} Z M${r(x - w * 0.85)},${r(b2)} h${w * 1.7} v5 h-${w * 1.7} Z` },
    { role: "dome", tint, d: `M${r(x - w * 0.62)},${r(top + 14)} C${r(x - w * 0.62)},${r(top + 4)} ${r(x)},${r(top + 2)} ${r(x)},${r(top - 4)} C${r(x)},${r(top + 2)} ${r(x + w * 0.62)},${r(top + 4)} ${r(x + w * 0.62)},${r(top + 14)} Z` },
    { role: "detail", tint, d: `M${r(x)},${r(top - 4)} V${r(top - 11)}` },
  ];
}

/** The great iwan: a tall portal with its pointed arch. */
function iwan(x: number, w: number, h: number, tint: Tint): Part[] {
  const top = G - h;
  const hw = w / 2;
  const aw = w * 0.32;
  return [
    { role: "iwan", tint, d: `M${r(x - hw)},${G} V${r(top)} H${r(x + hw)} V${G} Z` },
    { role: "detail", tint, d: `M${r(x - aw)},${G} V${r(top + h * 0.42)} Q${r(x - aw)},${r(top + h * 0.16)} ${r(x)},${r(top + h * 0.1)} Q${r(x + aw)},${r(top + h * 0.16)} ${r(x + aw)},${r(top + h * 0.42)} V${G}` },
  ];
}

/** The arcade around the court: the wall and a row of arches. */
function wall(h: number, tint: "blue" | "sand", crenels?: boolean): Part[] {
  const top = G - h;
  const out: Part[] = [{ role: "wall", tint, d: `M0,${G} V${top} H400 V${G} Z` }];
  const arches: string[] = [];
  for (let x = 12; x < 400; x += 24) arches.push(`M${x},${G} V${r(top + h * 0.45)} Q${x},${r(top + h * 0.18)} ${x + 7},${r(top + h * 0.14)} Q${x + 14},${r(top + h * 0.18)} ${x + 14},${r(top + h * 0.45)} V${G}`);
  out.push({ role: "detail", tint, d: arches.join(" ") });
  if (crenels) {
    const c: string[] = [];
    for (let x = 0; x < 400; x += 12) c.push(`M${x},${top} v-5 h6 v5 Z`);
    out.push({ role: "wall", tint, d: c.join(" ") });
  }
  return out;
}

function clock(x: number, h: number): Part[] {
  const top = G - h;
  return [
    { role: "minaret", tint: "gold", d: `M${x - 9},${G} V${top + 18} H${x + 9} V${G} Z` },
    { role: "detail", tint: "white", d: `M${x - 6},${top + 34} a6,6 0 1,0 12,0 a6,6 0 1,0 -12,0 M${x},${top + 34} v-4 M${x},${top + 34} h3` },
    ...dome(x, 18, 14, "gold", top + 18, 4),
  ];
}

function graves(): Part[] {
  const g: string[] = [];
  for (let row = 0; row < 3; row++) for (let x = 8 + row * 9; x < 400; x += 26) g.push(`M${x},${G + 4 + row * 5} h12 v-${3 + ((x + row) % 3)} h-12 Z`);
  return [{ role: "ground", tint: "sand", d: g.join(" ") }];
}

/** Everything of a shrine as shapes, back to front (minarets and the wall behind, domes and the iwan in front). */
export function shrineParts(spec: ShrineSpec): Part[] {
  const out: Part[] = [];
  for (const m of spec.minarets) out.push(...minaret(m.x, m.h, m.tint));
  if (spec.clock) out.push(...clock(spec.clock.x, spec.clock.h));
  // a great dome stands on the main hall behind the iwan; a small one sits on the arcade
  const hall = Math.max(spec.wall.h + 10, ...(spec.iwans ?? []).map((i) => i.h - 6));
  for (const d of spec.domes) out.push(...dome(d.x, d.w, d.h, d.tint, G - (d.w >= 45 ? hall : spec.wall.h), d.drum));
  out.push(...wall(spec.wall.h, spec.wall.tint, spec.crenels));
  for (const i of spec.iwans ?? []) out.push(...iwan(i.x, i.w, i.h, i.tint));
  if (spec.graves) out.push(...graves());
  return out;
}

// ───────────────────────────── how each design draws it, and where ─────────────────────────────

/** The ways of drawing (each design picks one; colours come from the design's own tokens). */
export type ArtStyle = "gold" | "flat" | "outline" | "silhouette" | "line" | "glow" | "gradient" | "dots" | "sketch";

/** Where the shrine shows: behind every page, a banner on the home, a skyline under the greeting, the photo, or not. */
export type ShrinePlace = "backdrop" | "banner" | "horizon" | "photo" | "off";

export const SHRINE_PLACES: readonly { id: ShrinePlace | "auto"; label: string; hint: string }[] = [
  { id: "auto", label: "حسب التصميم", hint: "الطريقة اللي تناسب تصميمك" },
  { id: "backdrop", label: "خلفية لكل الصفحات", hint: "الحرم مرسوم خلف التطبيق كله" },
  { id: "banner", label: "لوحة كبيرة فوق الرئيسية", hint: "رسمة الحرم بارزة أول ما تفتح" },
  { id: "horizon", label: "أفق تحت الترحيب", hint: "خط الحرم الهادئ تحت اسمك" },
  { id: "photo", label: "الصورة بألوان التصميم", hint: "صورة الحرم الأصلية ملوّنة بتصميمك" },
  { id: "off", label: "بدون", hint: "بلا رسمة الحرم" },
];

export const readPlace = (v: unknown): ShrinePlace | "auto" => (SHRINE_PLACES.some((p) => p.id === v) ? (v as ShrinePlace | "auto") : "auto");

/** Real colours for the drawings that keep them (gold, flat, outline, gradient tints). */
export const TINT: Record<Tint, [string, string]> = {
  gold: ["#f7d774", "#c8961e"],
  turquoise: ["#5fd6cc", "#1b8a8f"],
  green: ["#34c46a", "#13733a"],
  white: ["#ffffff", "#d9d6cf"],
  blue: ["#3a64a8", "#1e3a6e"],
  sand: ["#e8cfa0", "#b8925a"],
};
