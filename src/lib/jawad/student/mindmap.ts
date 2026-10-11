// «الطالب الذكي» — «🧠 الخريطة الذهنية»: the shapes, the grades by who studies, the student's choices, and the outline the
// student edits. Pure (no server, no model): the plan step, the renderer, the page and the tests all use it.
//
// Researched on 2026-10-11 before it was built:
// · Tony Buzan's mind map laws: the topic in the CENTRE (with an image), main branches radiating from it, thick at the
//   centre and thinner outwards, ONE key word per line (a word sits on its line), one colour per main branch, images and
//   icons throughout, numbering when the order matters. (xmind.com «mind mapping laws» · Buzan, The Mind Map Book.)
// · Joseph Novak's CONCEPT maps (Cornell): concepts in boxes from the most general at the top to the most specific,
//   every line carries a LINKING PHRASE so two concepts read as a proposition («النبات ← يصنع → الغذاء»), and
//   CROSS-LINKS between branches show integrative understanding — best for complex, university material.
//   (Novak & Cañas 2006, «The Theory Underlying Concept Maps and How to Construct and Use Them».)
// · David Hyerle's Thinking Maps: the shape follows the thinking — a TREE map to classify, a FLOW map for a sequence or
//   a process, (multi-flow for cause and effect, bubble maps to describe).
// · By age: young children take few main branches (3–5), one or two words each, pictures for every idea, big writing;
//   older students more branches and levels, key facts (names, dates, numbers) on the sub-branches; university
//   students concept maps with linking phrases and cross-links. Meta-analyses find mind / concept maps help learning
//   overall, and low-achieving students most — but a map alone doesn't teach critical thinking, and its strongest use is
//   RECALL: redraw it from memory (the blank map) and check it against the original, on a spaced schedule.
// Sources: scrapbox.io/nishio-en/mind-map · templates.xmind.com/mind-mapping-laws · frontiersin.org (10.3389/
// fpsyg.2022.871781) · pmc.ncbi.nlm.nih.gov (PMC9131007) · en.wikipedia.org/wiki/Mind_map · heuristi.ca concept-map
// guide · students.wlu.ca (concept vs mind mapping) · en.wikipedia.org/wiki/David_Hyerle · structural-learning.com
// (thinking maps) · alloprof.qc.ca (mind maps for school).

export type MapType = "radial" | "tree" | "concept" | "flow";
export const MAP_TYPE_IDS: readonly MapType[] = ["radial", "tree", "concept", "flow"];

/** The four shapes, as the student picks them («auto»: صادق chooses by the material and the level). */
export const MAP_TYPES: readonly { id: MapType; name: string; hint: string; en: string }[] = [
  { id: "radial", name: "شعاعية (بوزان)", hint: "الموضوع في الوسط والفروع ملوّنة حوله: الأنسب للحفظ والمراجعة", en: "a Buzan radial mind map: the topic in the centre, coloured main branches radiating to both sides, one key word or short phrase per line" },
  { id: "tree", name: "شجرية (تصنيف)", hint: "من العام للخاص بأعمدة: الأنسب للأقسام والأنواع والتصنيفات", en: "a tree map (classification): the topic at the top, its categories in columns, each with its members under it" },
  { id: "concept", name: "مفاهيمية (نوفاك)", hint: "كل خط عليه عبارة ربط وروابط بين الفروع: الأنسب للمادة المعقدة والجامعة", en: "a Novak concept map: concepts from the most general at the top down to the specific; EVERY line carries a short linking phrase so each pair reads as a proposition, plus cross-links between branches" },
  { id: "flow", name: "تسلسلية (خطوات)", hint: "مراحل بالترتيب بأسهم: الأنسب للعمليات والتاريخ والخطوات", en: "a flow map (sequence): the stages of a process or a history in order, right to left with arrows, each stage with its key points under it" },
];
export const mapTypeName = (t: string) => MAP_TYPES.find((m) => m.id === t)?.name ?? "يختارها صادق";

/** A small line icon drawn with the map (no emoji: the server's Chromium has no colour emoji font). */
export const MAP_ICONS: Record<string, string> = {
  idea: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h7M8 11h5",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  people: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 13.5a6 6 0 0 1 4 6",
  place: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  number: "M9 3L7 21M17 3l-2 18M4 8.5h17M3 15.5h17",
  warning: "M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  heart: "M12 20s-7.5-4.6-9.2-9.1A4.8 4.8 0 0 1 12 6.3a4.8 4.8 0 0 1 9.2 4.6C19.5 15.4 12 20 12 20z",
  star: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
  leaf: "M5 19C5 10 10 5 20 4c-1 10-6 15-15 15zM5 19l8-8",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z",
  question: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01",
  check: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l2.7 2.7L16 9.8",
  flask: "M9 3h6M10 3v6l-5.5 9.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3M7.5 15h9",
  scale: "M12 3v18M7 21h10M4 7h16M4 7l-2.5 6a3 3 0 0 0 5 0zM20 7l-2.5 6a3 3 0 0 0 5 0z",
  chart: "M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-8",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  quote: "M5 17h4l2-4V7H5v6h3zM13 17h4l2-4V7h-6v6h3z",
  tools: "M14.5 5.5a4 4 0 0 0-5 5L4 16l4 4 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z",
  money: "M3 7h18v10H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 10v4M18 10v4",
  home: "M4 11l8-7 8 7M6 9.5V20h12V9.5M10 20v-5h4v5",
};
export const MAP_ICON_IDS = Object.keys(MAP_ICONS);
export const iconOf = (v: unknown) => (typeof v === "string" && v in MAP_ICONS ? v : "");

// ───────────────────────────── the map ─────────────────────────────

/** A sub-branch: a key word (or short phrase), the linking phrase on its line (concept maps), and its details. */
export interface MindLeaf {
  label: string;
  link: string;
  details: string[];
}
export interface MindBranch {
  label: string;
  icon: string;
  link: string;
  children: MindLeaf[];
}
/** A cross-link between two nodes of the map (by their labels), with its phrase. */
export interface MindCross {
  from: string;
  to: string;
  label: string;
}
export interface MindMap {
  title: string;
  center: string;
  icon: string;
  type: MapType;
  branches: MindBranch[];
  links: MindCross[];
  /** drawn by صادق (Chromium): the picture and what it was drawn from */
  rendered?: { path: string; blank: string; sig: string } | null;
  /** drawn by GPT Image 2 from صادق's layout (the student's choice) */
  picture?: { path: string; sig: string } | null;
}
export interface MindPlan {
  maps: MindMap[];
}

// ───────────────────────────── grades by who studies ─────────────────────────────

export type MapGrade = "primary" | "middle" | "secondary" | "university" | "graduate" | "adult";

export interface Grade {
  name: string;
  /** main branches: from … to */
  branches: readonly [number, number];
  /** sub-branches per main branch, at most */
  children: number;
  /** details (facts) under a sub-branch, at most */
  details: number;
  /** words in a branch's label, at most */
  words: number;
  /** cross-links, at most */
  links: number;
  /** the shape when صادق chooses */
  type: MapType;
  /** one line for the student */
  says: string;
  /** what صادق is told */
  rule: string;
}

export const MAP_GRADES: Record<MapGrade, Grade> = {
  primary: {
    name: "ابتدائي",
    branches: [3, 5],
    children: 2,
    details: 0,
    words: 2,
    links: 0,
    type: "radial",
    says: "٣–٥ فروع، كلمة أو كلمتين، أيقونة لكل فرع، خط كبير",
    rule: "A CHILD's map: 3 to 5 main branches only, each ONE or TWO everyday words with an icon; at most 2 sub-branches of one or two words; NO details; nothing abstract — things the child can picture.",
  },
  middle: {
    name: "متوسط",
    branches: [4, 6],
    children: 3,
    details: 1,
    words: 3,
    links: 0,
    type: "radial",
    says: "٤–٦ فروع، مستويين، ٣ كلمات بالكثير",
    rule: "A middle-school map: 4 to 6 main branches of up to 3 words, each with an icon; up to 3 sub-branches; at most ONE short key fact under a sub-branch (a definition in a few words, a number, a name).",
  },
  secondary: {
    name: "ثانوي",
    branches: [5, 7],
    children: 4,
    details: 2,
    words: 4,
    links: 2,
    type: "radial",
    says: "٥–٧ فروع، ٣ مستويات، المصطلحات والأرقام والتواريخ",
    rule: "A secondary-school map: 5 to 7 main branches of up to 4 words; up to 4 sub-branches; up to 2 key facts under each (the terms, numbers, dates, names an exam asks about); up to 2 cross-links where two branches really connect.",
  },
  university: {
    name: "جامعي",
    branches: [5, 8],
    children: 4,
    details: 3,
    words: 5,
    links: 4,
    type: "concept",
    says: "٥–٨ فروع، عبارات ربط على الخطوط، روابط بين الفروع",
    rule: "A university map: 5 to 8 main branches of up to 5 words; up to 4 sub-branches; up to 3 precise facts under each; linking phrases on the lines (what relates to what, and how); up to 4 cross-links that show how the parts integrate.",
  },
  graduate: {
    name: "دراسات عليا",
    branches: [5, 8],
    children: 5,
    details: 3,
    words: 6,
    links: 6,
    type: "concept",
    says: "٥–٨ فروع، علاقات دقيقة، روابط تكاملية أكثر",
    rule: "A graduate map: 5 to 8 main branches of up to 6 words; up to 5 sub-branches; up to 3 precise facts under each (positions, evidence, authors, conditions); exact linking phrases; up to 6 cross-links showing the integrative structure and the tensions in the material.",
  },
  adult: {
    name: "عام",
    branches: [5, 7],
    children: 4,
    details: 2,
    words: 4,
    links: 2,
    type: "radial",
    says: "٥–٧ فروع، خلاصة عملية",
    rule: "A map for a grown-up learner: 5 to 7 main branches of up to 4 words; up to 4 sub-branches; up to 2 practical key facts under each; up to 2 cross-links.",
  },
};

/** The grade of a map from the project's level (the five levels of the first page, or anything written). */
export function gradeOf(level: string | null | undefined): MapGrade {
  const l = String(level ?? "");
  if (/ابتدائي|طفل|روضة/.test(l)) return "primary";
  if (/متوسط/.test(l)) return "middle";
  if (/ثانوي/.test(l)) return "secondary";
  if (/دراسات|ماجستير|دكتوراه/.test(l)) return "graduate";
  if (/جامع/.test(l)) return "university";
  return "adult";
}

// ───────────────────────────── the student's choices ─────────────────────────────

export interface MapSettings {
  /** the shape, or «auto» (صادق chooses by the material and the level) */
  mapType: MapType | "auto";
  /** one map of the whole material, or one of the whole plus one for each part */
  scope: "one" | "sections";
  /** صادق designs it (a sharp picture, exact text, free) or GPT Image 2 draws it from صادق's layout */
  render: "editable" | "image";
  imageQuality: "high" | "medium";
  /** «نسخة التسميع»: the same map with the branches empty, to fill from memory */
  recall: boolean;
}

export function mapSettings(s: Record<string, unknown>): MapSettings {
  return {
    mapType: MAP_TYPE_IDS.includes(s.mapType as MapType) ? (s.mapType as MapType) : "auto",
    scope: s.scope === "sections" ? "sections" : "one",
    render: s.render === "image" ? "image" : "editable",
    imageQuality: s.imageQuality === "medium" ? "medium" : "high",
    recall: s.recall !== false,
  };
}

/** The most maps: the whole material and up to 8 of its parts. */
export const MAX_MAPS = 9;

/** How many maps are made: one, or the whole material plus one for each part (a material of one part has one). */
export const mapsWanted = (scope: MapSettings["scope"], sections: number) => (scope === "sections" && sections > 1 ? Math.min(MAX_MAPS, 1 + sections) : 1);

// ───────────────────────────── cleaning (what the model or the browser sent) ─────────────────────────────

const clip = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** A map in the bounds of its grade: never more branches, sub-branches, details or cross-links than it allows. */
export function clampMap(raw: unknown, grade: MapGrade, fallbackType: MapType = MAP_GRADES[grade].type): MindMap {
  const g = MAP_GRADES[grade];
  const m = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v : []) as Record<string, unknown>[];
  const type = MAP_TYPE_IDS.includes(m.type as MapType) ? (m.type as MapType) : fallbackType;
  const branches: MindBranch[] = list(m.branches)
    .map((b) => ({
      label: clip(b?.label, 80),
      icon: iconOf(b?.icon),
      link: clip(b?.link, 40),
      children: list(b?.children)
        .map((c) => ({ label: clip(c?.label, 80), link: clip(c?.link, 40), details: (Array.isArray(c?.details) ? c.details : []).map((d) => clip(d, 120)).filter(Boolean).slice(0, g.details) }))
        .filter((c) => c.label)
        .slice(0, g.children),
    }))
    .filter((b) => b.label)
    .slice(0, g.branches[1]);
  const names = new Set(branches.flatMap((b) => [b.label, ...b.children.map((c) => c.label)]).map(norm));
  const links: MindCross[] = list(m.links)
    .map((l) => ({ from: clip(l?.from, 80), to: clip(l?.to, 80), label: clip(l?.label, 40) }))
    .filter((l) => l.from && l.to && norm(l.from) !== norm(l.to) && names.has(norm(l.from)) && names.has(norm(l.to)))
    .slice(0, g.links);
  const out: MindMap = { title: clip(m.title, 160), center: clip(m.center, 80) || clip(m.title, 80), icon: iconOf(m.icon), type, branches, links };
  const r = m.rendered as MindMap["rendered"];
  if (r && typeof r === "object" && typeof r.path === "string") out.rendered = { path: r.path, blank: typeof r.blank === "string" ? r.blank : "", sig: String(r.sig ?? "") };
  const p = m.picture as MindMap["picture"];
  if (p && typeof p === "object" && typeof p.path === "string") out.picture = { path: p.path, sig: String(p.sig ?? "") };
  return out;
}

const norm = (s: string) => s.replace(/[ً-ْـ]/g, "").replace(/\s+/g, " ").trim();

/** The labels of a map (its centre, branches, sub-branches; details too when asked): what a picture of it must say. */
export function mapWords(m: MindMap, details = true): string[] {
  return [m.center, ...m.branches.flatMap((b) => [b.label, ...b.children.flatMap((c) => [c.label, ...(details ? c.details : [])])])].filter(Boolean);
}

/** The words of a label, counted. */
export const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

// ───────────────────────────── the outline the student edits ─────────────────────────────
//
//   # عنوان الخريطة
//   * المركز
//   - فرع رئيسي | عبارة الربط
//   -- فرع فرعي | عبارة الربط
//   --- تفصيل
//   ~ من > إلى : عبارة الربط

/** A map as plain lines the student can edit (icons and the shape are kept outside it). */
export function toOutline(m: MindMap): string {
  const withLink = (label: string, link: string) => (link ? `${label} | ${link}` : label);
  const lines = [`# ${m.title}`, `* ${m.center}`];
  for (const b of m.branches) {
    lines.push(`- ${withLink(b.label, b.link)}`);
    for (const c of b.children) {
      lines.push(`-- ${withLink(c.label, c.link)}`);
      for (const d of c.details) lines.push(`--- ${d}`);
    }
  }
  for (const l of m.links) lines.push(`~ ${l.from} > ${l.to}${l.label ? ` : ${l.label}` : ""}`);
  return lines.join("\n");
}

/** The edited lines back to a map; the icons are kept by label from the map before (`prev`). */
export function fromOutline(text: string, prev: MindMap): MindMap {
  const split = (s: string) => {
    const i = s.indexOf(" | ");
    return i < 0 ? { label: s.trim(), link: "" } : { label: s.slice(0, i).trim(), link: s.slice(i + 3).trim() };
  };
  const icons = new Map(prev.branches.map((b) => [norm(b.label), b.icon]));
  const m: MindMap = { title: prev.title, center: prev.center, icon: prev.icon, type: prev.type, branches: [], links: [] };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const branch = m.branches[m.branches.length - 1];
    const leaf = branch?.children[branch.children.length - 1];
    if (line.startsWith("#")) m.title = line.replace(/^#+\s*/, "");
    else if (line.startsWith("*")) m.center = line.replace(/^\*+\s*/, "");
    else if (line.startsWith("~")) {
      const body = line.replace(/^~\s*/, "");
      const [pair, label = ""] = body.split(/\s+:\s+/);
      const [from = "", to = ""] = pair.split(/\s*>\s*/);
      if (from.trim() && to.trim()) m.links.push({ from: from.trim(), to: to.trim(), label: label.trim() });
    } else if (line.startsWith("---")) {
      if (leaf) leaf.details.push(line.replace(/^-+\s*/, ""));
    } else if (line.startsWith("--")) {
      if (branch) branch.children.push({ ...split(line.replace(/^-+\s*/, "")), details: [] });
    } else if (line.startsWith("-")) {
      const b = split(line.replace(/^-+\s*/, ""));
      m.branches.push({ ...b, icon: icons.get(norm(b.label)) ?? "", children: [] });
    }
  }
  return m;
}

// ───────────────────────────── review: how to study with the map ─────────────────────────────

/** The few lines printed with the blank map: how to use it (retrieval, then a spaced review). */
export const RECALL_STEPS = [
  "اقرأ الخريطة كاملة مرة وحدة، وتخيّل كل فرع بلونه.",
  "اقلب الورقة واملأ الخريطة الفارغة من ذاكرتك بدون ما تطالع.",
  "قارن بالأصل، وعلّم اللي نسيته بلون ثاني.",
  "أعدها بعد يوم، ثم بعد أسبوع، ثم بعد شهر: كل مرة أسرع.",
] as const;
