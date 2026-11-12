// «سجل التغييرات» · «ارجع لهنا» · «تعليماتي الدايمة» in «حيدرة كت» — the rules both sides share (no server code here):
// which saved changes the person sees and how they read, when a save keeps the document it replaces as a point to come
// back to, how many such points a project keeps, and how the standing instructions ride with حيدرا ماكس's requests.

/** Rows of editor_ops that are not changes of the timeline: what حيدرا ماكس's answers cost, minutes listened to. */
export const INTERNAL_ACTORS: ReadonlySet<string> = new Set(["claude", "speech"]);
/** Who the page says made a save (anything else it sends is the person). */
export const PAGE_ACTORS = ["user", "haidara", "restore"] as const;
export type PageActor = (typeof PAGE_ACTORS)[number];
export const pageActor = (v: unknown): PageActor => (PAGE_ACTORS.includes(v as PageActor) ? (v as PageActor) : "user");

/** Points kept per project (the oldest go first). */
export const SNAPSHOT_CAP = 30;
/** The person's own edits: a point at least this often while they work… */
export const SNAPSHOT_EVERY_MS = 10 * 60_000;
/** …or after this many saves, whichever comes first. */
export const SNAPSHOT_EVERY_VERSIONS = 20;
/** Saves of حيدرا ماكس this close together, without a new message of the person between them, are one turn. */
const TURN_GAP_MS = 15 * 60_000;

/** «تعليماتي الدايمة»: how long they may be. */
export const RULES_MAX = 1500;

const HAIDARA = "حيدرا ماكس";
/** The label of the commands of one of his answers: «حيدرا ماكس: <the person's words>». */
const TURN_HEAD = /^حيدرا ماكس:\s*/;

export interface OpRow {
  version: number;
  actor: string;
  label: string;
  created_at: string;
  /** the commands of the save in plain Arabic (migration 0111; none before it) */
  steps?: unknown;
}

export type Who = "you" | "haidara";

/** One line of «سجل التغييرات». */
export interface Change {
  /** the project's version right after it: «ارجع لهنا» brings this back */
  version: number;
  /** the version just before it: «ألغِ تعديله» on a turn of حيدرا ماكس brings this back */
  from: number;
  who: Who;
  /** a «ارجع لهنا» itself */
  restore: boolean;
  what: string;
  /** what was done, step by step (his commands; empty for one plain edit) */
  steps: string[];
  /** when (the last save of it) */
  at: string;
}

/** Who made a saved change. Saves from before 0111's pages all say "user": his are known by their label. */
export function whoDid(row: Pick<OpRow, "actor" | "label">): Who {
  if (row.actor === "haidara") return "haidara";
  if (row.actor !== "user") return "you";
  const label = row.label ?? "";
  // «تراجع: حيدرا ماكس: …» is the person taking his step back
  return !/^تراجع/.test(label) && label.includes(HAIDARA) ? "haidara" : "you";
}

/** The steps a save carries, cleaned (the page sends them; old rows have none). */
export function readSteps(v: unknown): string[] {
  return (Array.isArray(v) ? v : [])
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 60);
}

const whatOf = (label: string, who: Who) => {
  const l = (label ?? "").trim();
  if (who === "haidara" && TURN_HEAD.test(l)) {
    const said = l.replace(TURN_HEAD, "").trim();
    return said ? `«${said}»` : "تعديل";
  }
  return l || "تعديل";
};

/** The same step done several times in a row reads once, with how many («حذفت مقطعًا ×3»). */
function squeeze(steps: string[]) {
  const out: { s: string; n: number }[] = [];
  for (const s of steps) {
    const last = out.at(-1);
    if (last && last.s === s) last.n++;
    else out.push({ s, n: 1 });
  }
  return out.map((x) => (x.n > 1 ? `${x.s} ×${x.n}` : x.s));
}

/**
 * The saved changes as the person reads them, newest first: the cost and listening rows are not changes and never show,
 * and the saves of one turn of حيدرا ماكس (his commands, then what he made and placed) are one line with his steps.
 */
export function changeLog(rows: OpRow[]): Change[] {
  const kept = rows.filter((r) => !INTERNAL_ACTORS.has(r.actor) && Number.isInteger(r.version)).sort((a, b) => a.version - b.version);
  const out: Change[] = [];
  for (const r of kept) {
    const who = whoDid(r);
    const steps = readSteps(r.steps);
    const last = out.at(-1);
    const sameTurn = last && who === "haidara" && last.who === "haidara" && !TURN_HEAD.test(r.label ?? "") && Date.parse(r.created_at) - Date.parse(last.at) < TURN_GAP_MS;
    if (last && sameTurn) {
      last.version = r.version;
      last.at = r.created_at;
      last.steps.push(...(steps.length ? steps : [whatOf(r.label, who)]));
      continue;
    }
    out.push({ version: r.version, from: r.version - 1, who, restore: r.actor === "restore", what: whatOf(r.label, who), steps, at: r.created_at });
  }
  return out.reverse().map((c) => ({ ...c, steps: squeeze(c.steps) }));
}

/**
 * Whether a save keeps the document it replaces as a point to come back to: before a turn of حيدرا ماكس and right after
 * it, before a «ارجع لهنا» (so it can be taken back too), and every so often while the person edits by hand.
 */
export function shouldSnapshot(o: {
  /** who is saving now */
  actor: PageActor | string;
  /** who made the document being replaced (null: nobody known — a new project) */
  before: Who | null;
  /** the newest point kept (its version, and when — ms) */
  last: { version: number; at: number } | null;
  /** the version being replaced */
  version: number;
  now: number;
}) {
  if (o.last && o.last.version >= o.version) return false;
  if (o.actor === "restore") return true;
  if (o.actor === "haidara" && o.before !== "haidara") return true;
  if (o.before === "haidara" && o.actor !== "haidara") return true;
  if (!o.last) return true;
  return o.now - o.last.at >= SNAPSHOT_EVERY_MS || o.version - o.last.version >= SNAPSHOT_EVERY_VERSIONS;
}

/** The points past the newest `cap` (by version): their ids, to delete. */
export function toPrune<T extends { id: number; version: number }>(rows: T[], cap = SNAPSHOT_CAP): number[] {
  return [...rows].sort((a, b) => b.version - a.version || b.id - a.id).slice(cap).map((r) => r.id);
}

/** The name of a «ارجع لهنا» in the log (and the undo list). */
export const restoreLabel = (c: Pick<Change, "what">, undoTurn = false) => (undoTurn ? `ألغيت تعديل حيدرا ماكس ${c.what}` : `رجّعت المشروع لـ: ${c.what}`).slice(0, 200);

/** «تعليماتي الدايمة», cleaned. */
export const cleanRules = (v: unknown) => (typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim().slice(0, RULES_MAX) : "");

/**
 * The standing instructions as حيدرا ماكس reads them, in the turn note of every request (never in the system: the
 * system and the conversation stay cached); nothing at all when the person wrote none.
 */
export function rulesNote(rules: unknown) {
  const r = cleanRules(rules);
  if (!r) return "";
  return `THE PERSON'S STANDING INSTRUCTIONS («تعليماتي الدايمة» — their own editing style, written by them once for every edit): follow them in this answer and in every command, request and program you make, unless their message now asks for something different (then the message wins for this request). Do not repeat them back.\n«${r}»`;
}
