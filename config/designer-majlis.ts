// «المصمم الذكي كاظم» — majlis invitations from ready designs (the owner, 11 November 2026): the person says how many
// khateebs and radoods take part, sees the designs that fit, picks one, fills its details and photos, and picks who makes
// it: «حيدرا ماكس» in code (the design exactly as picked, the faces unchanged) or GPT Image 2.6 (Sunburst or Flare) or
// GPT Image 2 (warned: the faces will likely change). Pure (server and browser).

import { MAJLIS_TEMPLATES } from "./designer-majlis-data";
import { MAJLIS_PEOPLE } from "./designer-majlis-people";

/** Every ready design: the 60 invitations, then the designs with people (بأشخاص_معدلة). */
export const MAJLIS_ALL = [...MAJLIS_TEMPLATES, ...MAJLIS_PEOPLE];

/** A word of a template: where it sits (fractions of the frame), its size (fraction of the height) and its look. */
export interface MajlisWord {
  /** the field it shows (see wordText) */
  k: string;
  /** the box of the placeholder word: x, y, w, h */
  r: number[];
  /** the shape it sits in (a plate, a pill): the room it may grow to */
  box?: number[];
  size: number;
  font: "head" | "body" | "lalezar" | "ruqaa";
  color: string;
  grad?: "gold" | "silver" | "red";
  align: "center" | "right" | "left";
}

/** A photo frame of a template: kh = the first person (the bigger or right one), rd = the second. */
export interface MajlisSlot {
  who: "kh" | "rd";
  /** "mask": the frame's exact inside is the template's mask picture; "person": a design WITH a man, the person cut out
   * of his photo stands where the man stood (his face at `face`); else a frame drawn in code */
  shape: "mask" | "arch" | "mihrab" | "round" | "rect" | "circle" | "person";
  r: number[];
  /** "person": where the man's face was (x, y, w, h fractions) — the person's face is put exactly there */
  face?: number[];
}

export interface MajlisTemplate {
  id: string;
  kind: "invite" | "people";
  /** made by GPT Image 2 (q…) or in code (c…) */
  source: "gpt" | "code";
  aspect: "3:4" | "4:5";
  size: [number, number];
  title: string;
  mask?: boolean;
  slots: MajlisSlot[];
  words: MajlisWord[];
  logo?: number[];
  /** a design with people: its title as a layer of its own (<id>_title.png), drawn over the person like in the original */
  titleLayer?: boolean;
  /** a design with people: the band (top and bottom, fractions of the height) that carries the names and details */
  band?: number[];
}

export const MAJLIS = {
  /** how many people the ready designs hold (more boxes come later — the owner's word) */
  maxPeople: 2,
  dir: "/designer/majlis",
} as const;

export const templateById = (id: unknown) => MAJLIS_ALL.find((t) => t.id === id) ?? null;
export const viewUrl = (id: string) => `${MAJLIS.dir}/${id}.jpg`;
export const baseUrl = (id: string) => `${MAJLIS.dir}/${id}_base.jpg`;
export const maskUrl = (id: string) => `${MAJLIS.dir}/${id}_mask.png`;
export const titleUrl = (id: string) => `${MAJLIS.dir}/${id}_title.png`;

/** The designs that fit this many people: the invitations (دعوات ٢) first, the ones with people after. */
export function templatesFor(kh: number, rd: number): MajlisTemplate[] {
  const n = kh + rd;
  if (n < 1 || n > MAJLIS.maxPeople) return [];
  return MAJLIS_ALL.filter((t) => t.slots.length === n).sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "invite" ? -1 : 1));
}

/** The details the person fills (labels shown in the form; defaults put in when left empty). */
export const MAJLIS_FIELDS = [
  { key: "host", label: "اسم المأتم أو الحسينية", placeholder: "مأتم الإمام علي عليه السلام", required: true },
  { key: "invite", label: "كلمة الدعوة", placeholder: "يدعوكم", def: "يدعوكم" },
  { key: "pre", label: "المناسبة (السطر تحت الاسم)", placeholder: "لإحياء ذكرى شهادة", def: "لإحياء ذكرى شهادة" },
  { key: "night", label: "الليلة", placeholder: "ليلة الأحد", required: true },
  { key: "date", label: "التاريخ", placeholder: "١٣ جمادى الأولى ١٤٤٨هـ", required: true },
  { key: "time", label: "الوقت", placeholder: "٨:٣٠", required: true },
  { key: "ampm", label: "صباحًا أو مساءً", placeholder: "مساءً", def: "مساءً" },
  { key: "place", label: "المكان", placeholder: "القطيف — حي الشريعة", required: true },
  { key: "women", label: "سطر النساء", placeholder: "يوجد مكان مخصّص للأخوات المؤمنات", def: "يوجد مكان مخصّص للأخوات المؤمنات" },
  { key: "live", label: "البث", placeholder: "بث مباشر", def: "بث مباشر" },
] as const;
export type MajlisFieldKey = (typeof MAJLIS_FIELDS)[number]["key"];

export interface MajlisPerson {
  role: "kh" | "rd";
  name: string;
  /** a jawad_uploads id (the person's photo) */
  photo: string;
}

export interface MajlisOrder {
  templateId: string;
  fields: Partial<Record<MajlisFieldKey, string>>;
  /** in the order of the template's slots: the first goes in the kh frame, the second in the rd frame */
  people: MajlisPerson[];
  /** a jawad_uploads id */
  logo?: string;
  /**
   * the person's choice (always asked): true = the background of each photo is removed and the person alone is put in
   * the design («حيدرا ماكس» cuts him out professionally); false = each photo goes in with its own background
   */
  cut: boolean;
  /** set once the photos in `people` are the cut-outs (the cut is not done twice) */
  cutDone?: boolean;
}

/** The background choice, as the picker asks it. */
export const MAJLIS_BG = [
  { cut: true, name: "✂️ فرّغ الخلفية", hint: "حيدرا ماكس يقص الشخص باحتراف ويحطه على خلفية التصميم" },
  { cut: false, name: "🖼️ خلّ الصورة بخلفيتها", hint: "الصورة تنحط مثل ما رفعتها، بخلفيتها" },
] as const;

export const ROLE_LABEL = { kh: "الخطيب الحسيني", rd: "الرادود" } as const;

/** Who makes the design. */
export const MAJLIS_MAKERS = [
  { id: "code", name: "حيدرا ماكس (كود)", hint: "نفس التصميم اللي اخترته بالضبط، والوجوه ما تتغير", warn: "" },
  { id: "sunburst", name: "GPT Image 2.6 · Sunburst", hint: "أدق في التفاصيل وأثبت في التعديل", warn: "" },
  { id: "flare", name: "GPT Image 2.6 · Flare", hint: "الأسرع", warn: "" },
  { id: "gpt2", name: "GPT Image 2", hint: "", warn: "⚠️ تنبيه: مع GPT Image 2 احتمال كبير تتغير ملامح الوجوه في الصور." },
] as const;
export type MajlisMaker = (typeof MAJLIS_MAKERS)[number]["id"];
export const isMajlisMaker = (v: unknown): v is MajlisMaker => MAJLIS_MAKERS.some((m) => m.id === v);

const clean = (v: unknown, n = 120) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");

/** An order from the page or from storage, checked; null when it can't be made. */
export function readOrder(raw: unknown): MajlisOrder | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const t = templateById(o.templateId);
  if (!t) return null;
  const f = (o.fields ?? {}) as Record<string, unknown>;
  const fields: MajlisOrder["fields"] = {};
  for (const d of MAJLIS_FIELDS) {
    const v = clean(f[d.key]);
    if (v) fields[d.key] = v;
  }
  const people = (Array.isArray(o.people) ? o.people : [])
    .map((p) => (p && typeof p === "object" ? (p as Record<string, unknown>) : {}))
    .map((p) => ({ role: p.role === "rd" ? ("rd" as const) : ("kh" as const), name: clean(p.name, 80), photo: typeof p.photo === "string" ? p.photo.slice(0, 60) : "" }))
    .slice(0, t.slots.length);
  if (people.length !== t.slots.length) return null;
  if (typeof o.cut !== "boolean") return null;
  return { templateId: t.id, fields, people, cut: o.cut, ...(o.cutDone === true ? { cutDone: true } : {}), ...(typeof o.logo === "string" && o.logo ? { logo: o.logo.slice(0, 60) } : {}) };
}

/** What's missing before it can be made (Arabic, for the form); empty when ready. */
export function orderMissing(o: MajlisOrder): string[] {
  const out: string[] = [];
  for (const d of MAJLIS_FIELDS) if ("required" in d && d.required && !o.fields[d.key]) out.push(d.label);
  o.people.forEach((p, i) => {
    if (!p.name) out.push(`اسم ${ROLE_LABEL[p.role]} ${i + 1}`);
    if (!p.photo) out.push(`صورة ${ROLE_LABEL[p.role]} ${i + 1}`);
  });
  return out;
}

const field = (o: MajlisOrder, k: MajlisFieldKey) => {
  const d = MAJLIS_FIELDS.find((x) => x.key === k)!;
  return o.fields[k] ?? ("def" in d ? d.def : "");
};

/** The text a template's word shows, from the order. */
export function wordText(o: MajlisOrder, k: string): string {
  const [a, b] = o.people;
  switch (k) {
    case "kh": return a?.name ?? "";
    case "rd": return b?.name ?? "";
    case "khLbl": return a ? ROLE_LABEL[a.role] : "";
    case "rdLbl": return b ? ROLE_LABEL[b.role] : "";
    case "hostShort": return field(o, "host");
    case "occ": return "السيدة فاطمة الزهراء عليها السلام";
    case "dateLine": return [field(o, "night"), field(o, "date")].filter(Boolean).join(" — ");
    case "timeLine": return [field(o, "time"), field(o, "ampm")].filter(Boolean).join(" ");
    case "names": return o.people.length > 1 ? o.people.map((p) => p.name).filter(Boolean).join("  ◆  ") : a ? `${ROLE_LABEL[a.role]}: ${a.name}` : "";
    case "roles": return o.people.length > 1 ? o.people.map((p) => ROLE_LABEL[p.role]).join("  ◆  ") : "";
    case "detailsA": return [field(o, "invite"), field(o, "host"), field(o, "pre"), "السيدة فاطمة الزهراء عليها السلام"].filter(Boolean).join(" ");
    case "detailsB": return [wordText(o, "dateLine"), wordText(o, "timeLine"), field(o, "place")].filter(Boolean).join("  ◆  ");
    case "extra": return [field(o, "women"), field(o, "live")].filter(Boolean).join("  ◆  ");
    case "hostLine": return [field(o, "invite"), field(o, "host"), field(o, "pre"), "السيدة فاطمة الزهراء عليها السلام"].filter(Boolean).join(" ");
    default: return MAJLIS_FIELDS.some((d) => d.key === k) ? field(o, k as MajlisFieldKey) : "";
  }
}

/** A one-line Arabic summary of the order (the person's message in the chat). */
export function orderSummary(o: MajlisOrder, maker: MajlisMaker): string {
  const t = templateById(o.templateId)!;
  const who = o.people.map((p) => `${ROLE_LABEL[p.role]}: ${p.name}`).join(" · ");
  return `دعوة مجلس من التصميم ${t.id.slice(1)} «${t.title}» — ${field(o, "host")} · ${who} · ${wordText(o, "dateLine")} · ${wordText(o, "timeLine")} · ${field(o, "place")} — يصمّمها: ${MAJLIS_MAKERS.find((m) => m.id === maker)!.name}`;
}

export { MAJLIS_TEMPLATES, MAJLIS_PEOPLE };
