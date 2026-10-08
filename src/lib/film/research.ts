// «بحث سجاد»: web research for a film's or a series' story, asked for at the start («هل تبيني أبحث لتطوير القصة؟») or any
// time later in سجاد's chat («ابحث لي عن…»). The person sets the scope, سجاد brings findings, each is approved or
// dropped by hand, and only the approved ones go into the work (the screenwriter's brief, the series' context).
// Pure helpers: the saved shape, parsing Claude's findings, and the text the work reads. No database here.

export type ResearchAsked = "yes" | "no";
export type FindingStatus = "pending" | "approved" | "dropped";

export interface Finding {
  id: string;
  title: string;
  text: string;
  sources: string[];
  status: FindingStatus;
  /** what the person asked سجاد to look for */
  scope: string;
  at: string;
}

export interface Research {
  /** the answer at the start; missing when the work was made before this existed */
  asked?: ResearchAsked;
  items: Finding[];
}

export const RESEARCH_LIMITS = { findingsPerRun: 8, items: 60, scopeMax: 1500, titleMax: 120, textMax: 1500 } as const;

/** The saved column (jsonb, maybe missing or malformed) as a Research. */
export function readResearch(v: unknown): Research {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const asked = o.asked === "yes" || o.asked === "no" ? o.asked : undefined;
  const items = (Array.isArray(o.items) ? o.items : []).filter(
    (f): f is Finding => !!f && typeof f === "object" && typeof (f as Finding).id === "string" && typeof (f as Finding).title === "string" && typeof (f as Finding).text === "string",
  );
  return { ...(asked ? { asked } : {}), items: items.map((f) => ({ ...f, sources: Array.isArray(f.sources) ? f.sources.filter((s) => typeof s === "string") : [], status: f.status === "approved" || f.status === "dropped" ? f.status : "pending", scope: typeof f.scope === "string" ? f.scope : "", at: typeof f.at === "string" ? f.at : "" })) };
}

/**
 * Claude's research text → findings. Each finding starts with a «## » heading followed by its lines; a text without
 * headings is one finding. Sources are the run's (the API cites them for the whole answer).
 */
export function parseFindings(text: string, sources: string[], scope: string, now = new Date().toISOString()): Finding[] {
  const clean = text.replace(/\r/g, "").trim();
  if (!clean) return [];
  const hasTitle = /^##\s+/m.test(clean);
  // with headings, whatever comes before the first one is an intro and is dropped
  const blocks = hasTitle ? clean.split(/^##\s+/m).map((p) => p.trim()).filter(Boolean).slice(clean.startsWith("##") ? 0 : 1) : [clean];
  const out: Finding[] = [];
  for (const block of blocks.slice(0, RESEARCH_LIMITS.findingsPerRun)) {
    const [first, ...rest] = block.split("\n");
    const title = (hasTitle ? first : first.split(/[.:،؛]/)[0]).replace(/[#*_]/g, "").trim().slice(0, RESEARCH_LIMITS.titleMax) || "نتيجة";
    const body = (hasTitle ? rest.join("\n") : block).trim().slice(0, RESEARCH_LIMITS.textMax);
    out.push({ id: crypto.randomUUID(), title, text: body || title, sources: sources.slice(0, 6), status: "pending", scope: scope.slice(0, RESEARCH_LIMITS.scopeMax), at: now });
  }
  return out;
}

/** Marks findings approved or dropped (unknown ids are ignored); a decided finding may be decided again. */
export function decideFindings(r: Research, approve: string[], drop: string[]): Research {
  const a = new Set(approve);
  const d = new Set(drop);
  return { ...r, items: r.items.map((f) => (a.has(f.id) ? { ...f, status: "approved" } : d.has(f.id) ? { ...f, status: "dropped" } : f)) };
}

/** New findings join the saved ones (the oldest decided ones fall off when there are too many). */
export function addFindings(r: Research, found: Finding[]): Research {
  const items = [...r.items, ...found];
  const over = items.length - RESEARCH_LIMITS.items;
  if (over <= 0) return { ...r, items };
  let drop = over;
  return { ...r, items: items.filter((f) => (drop > 0 && f.status !== "pending" ? (drop--, false) : true)) };
}

export const pendingFindings = (r: Research) => r.items.filter((f) => f.status === "pending");
export const approvedFindings = (r: Research) => r.items.filter((f) => f.status === "approved");

/** The approved findings as the work reads them (the screenwriter, سجاد, the scenes). "" when none. */
export function researchText(r: Research, max = 6000): string {
  const ok = approvedFindings(r);
  if (!ok.length) return "";
  const lines = ["نتائج بحث اعتمدها صاحب العمل (استفد منها في القصة؛ لا تذكر البحث نفسه):"];
  for (const f of ok) lines.push(`- ${f.title}: ${f.text.replace(/\s+/g, " ").trim()}`);
  const s = lines.join("\n");
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
