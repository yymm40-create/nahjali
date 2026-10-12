// Where people's coins went («فلوس الموقع»), read from the coins ledger: every spend row's label is sorted into a
// branch of the site. Used by the owner's pages: one person's spend (by branch and by kind), and the whole site's
// spend by branch. Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { GENERATORS } from "@config/jawad/generators";

/** Rows that are money in (not spend). */
const IN = new Set(["grant", "purchase"]);
const GEN_OUTPUT = new Map(GENERATORS.map((g) => [g.name, g.output]));

export const BRANCHES = [
  "صناعة الصور",
  "صناعة الفيديو",
  "صناعة الصوت",
  "التعديل الذكي والمخرج",
  "الفيلم السينمائي",
  "حيدرة كت",
  "الطالب الذكي",
  "محادثة جواد",
  "صانع المحتوى",
  "المصمم الذكي",
  "زهراء فوتو ماستر",
  "صانع الألعاب",
  "محمد الخارق",
  "كتيب الجداول",
  "الذكاء الإسلامي",
  "لأجل المهدي",
  "أخرى",
] as const;
export type Branch = (typeof BRANCHES)[number];

/** The branch a ledger label belongs to. */
export function branchOf(label: string | null | undefined): Branch {
  const l = String(label ?? "").trim();
  if (l.startsWith("JAWAD AI")) {
    if (/التعديل الذكي|المخرج الخارق/.test(l)) return "التعديل الذكي والمخرج";
    if (/مكتبة الأصوات/.test(l)) return "صناعة الصوت";
    const out = GEN_OUTPUT.get(l.replace(/^JAWAD AI\s*·\s*/, ""));
    return out === "video" ? "صناعة الفيديو" : out === "audio" ? "صناعة الصوت" : "صناعة الصور";
  }
  if (/حيدرة/.test(l)) return "حيدرة كت";
  if (/الطالب الذكي|صادق|الخطيب/.test(l)) return "الطالب الذكي";
  if (/محادثة جواد/.test(l)) return "محادثة جواد";
  if (/السيناريست|شيت|رد المخرج|^فيديو$|صوت جملة|سجاد|سجّاد|الفيلم|المسلسل/.test(l)) return "الفيلم السينمائي";
  if (/محمد باقر|صانع المحتوى/.test(l)) return "صانع المحتوى";
  if (/كاظم|المصمم/.test(l)) return "المصمم الذكي";
  if (/زهراء|فكّ عناصر|إعادة كتابة كلام|قص الخلفية/.test(l)) return "زهراء فوتو ماستر";
  if (/قنبر|لعبة/.test(l)) return "صانع الألعاب";
  if (/الخارق/.test(l)) return "محمد الخارق";
  if (/كتيب|📘|عباس|زينب/.test(l)) return "كتيب الجداول";
  if (/الإسلامي|الاسلامي/.test(l)) return "الذكاء الإسلامي";
  if (/المهدي/.test(l)) return "لأجل المهدي";
  return "أخرى";
}

export interface SpendRow {
  branch: Branch;
  /** halalas spent (net of refunds) */
  halalas: number;
  /** distinct operations (refs) */
  times: number;
  people?: number;
}
export interface SpendLine {
  label: string;
  branch: Branch;
  halalas: number;
  times: number;
  last: string;
}

type Ledger = { user_id: string; delta: number; reason: string; ref: string | null; label: string | null; created_at: string };

/** Sums the spend rows into branches, smallest first. */
export function byBranch(rows: Ledger[]): SpendRow[] {
  const m = new Map<Branch, { halalas: number; refs: Set<string>; people: Set<string> }>();
  for (const r of rows) {
    if (IN.has(r.reason)) continue;
    const b = branchOf(r.label);
    const e = m.get(b) ?? { halalas: 0, refs: new Set(), people: new Set() };
    e.halalas -= r.delta;
    if (r.ref) e.refs.add(r.ref);
    e.people.add(r.user_id);
    m.set(b, e);
  }
  return [...m.entries()]
    .map(([branch, e]) => ({ branch, halalas: e.halalas, times: e.refs.size, people: e.people.size }))
    .filter((x) => x.halalas > 0)
    .sort((a, b) => a.halalas - b.halalas);
}

/** One person's spend by kind (label), largest first. */
export function byLabel(rows: Ledger[]): SpendLine[] {
  const m = new Map<string, { halalas: number; refs: Set<string>; last: string }>();
  for (const r of rows) {
    if (IN.has(r.reason)) continue;
    const label = String(r.label ?? "").trim() || "بدون وصف";
    const e = m.get(label) ?? { halalas: 0, refs: new Set(), last: r.created_at };
    e.halalas -= r.delta;
    if (r.ref) e.refs.add(r.ref);
    if (r.created_at > e.last) e.last = r.created_at;
    m.set(label, e);
  }
  return [...m.entries()]
    .map(([label, e]) => ({ label, branch: branchOf(label), halalas: e.halalas, times: e.refs.size, last: e.last }))
    .filter((x) => x.halalas > 0)
    .sort((a, b) => b.halalas - a.halalas);
}

const COLS = "user_id,delta,reason,ref,label,created_at";

/** One person's ledger (their own wallet and the team wallets they spent from). */
export async function userSpend(userId: string) {
  const db = createAdminClient();
  const [own, team] = await Promise.all([
    db.from("smart_coin_ledger").select(COLS).eq("user_id", userId).order("created_at", { ascending: false }).limit(20_000),
    db.from("team_coin_ledger").select(COLS).eq("user_id", userId).order("created_at", { ascending: false }).limit(20_000),
  ]);
  const rows = [...((own.data ?? []) as Ledger[]), ...((team.data ?? []) as Ledger[])];
  return { lines: byLabel(rows), branches: byBranch(rows).reverse() };
}

/** The whole site's spend by branch (smallest first), from the latest rows. */
export async function siteSpend(sinceDays: number | null) {
  const db = createAdminClient();
  const all: Ledger[] = [];
  for (const table of ["smart_coin_ledger", "team_coin_ledger"]) {
    for (let from = 0; from < 200_000; from += 10_000) {
      let q = db.from(table).select(COLS).not("reason", "in", "(grant,purchase)").order("created_at", { ascending: false }).range(from, from + 9_999);
      if (sinceDays) q = q.gte("created_at", new Date(Date.now() - sinceDays * 86400_000).toISOString());
      const { data, error } = await q;
      if (error || !data?.length) break;
      all.push(...(data as Ledger[]));
      if (data.length < 10_000) break;
    }
  }
  return byBranch(all);
}
