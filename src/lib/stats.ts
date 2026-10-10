// The owner's statistics (/admin/stats): visitors and pages, new accounts, the generations by section and generator, and
// the buying of the course and the balance — who started and did not finish. Read straight from the tables. Server only.

import { createAdminClient, listAllUsers } from "@/lib/supabase/admin";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { GENERATORS } from "@config/jawad/generators";

export type Range = "today" | "7d" | "30d" | "all";
export const RANGES: { id: Range; label: string }[] = [
  { id: "today", label: "اليوم" },
  { id: "7d", label: "آخر ٧ أيام" },
  { id: "30d", label: "آخر ٣٠ يوم" },
  { id: "all", label: "من البداية" },
];

/** Where a range starts (today = since midnight, Saudi time). */
export function rangeStart(r: Range, now = Date.now()): string | null {
  if (r === "all") return null;
  if (r === "today") {
    const riyadh = new Date(now + 3 * 3600_000);
    return new Date(Date.UTC(riyadh.getUTCFullYear(), riyadh.getUTCMonth(), riyadh.getUTCDate()) - 3 * 3600_000).toISOString();
  }
  return new Date(now - (r === "7d" ? 7 : 30) * 86400_000).toISOString();
}

const PAGE = 1000;
/** Every row of a query (a page at a time, up to a ceiling). */
async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, max = 50_000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += PAGE) {
    const { data, error } = await q(from, from + PAGE - 1);
    // the table itself is not there (or refused): said, so the page can tell
    if (error && from === 0) throw error;
    if (error || !data) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

export interface Order {
  id: string;
  kind: "course" | "credits";
  what: string;
  sar: number;
  name: string;
  phone: string;
  email: string;
  status: "started" | "transferred" | "confirmed" | "rejected";
  at: string;
}

export interface Stats {
  visitsReady: boolean;
  visitors: number;
  signedVisitors: number;
  views: number;
  pages: { path: string; views: number; visitors: number }[];
  newUsers: { email: string; at: string }[];
  makers: number;
  gens: { ok: number; failed: number; coins: number };
  bySection: { name: string; ok: number; failed: number; coins: number; people: number }[];
  byGenerator: { name: string; section: string; ok: number; failed: number; coins: number }[];
  funnels: { label: string; visitors: number; started: number; transferred: number; confirmed: number; sar: number }[];
  unfinished: Order[];
}

export async function loadStats(range: Range): Promise<Stats> {
  const db = createAdminClient();
  const since = rangeStart(range);
  const after = <Q extends { gte: (c: string, v: string) => Q }>(q: Q) => (since ? q.gte("created_at", since) : q);

  const [visits, users, jobs, course, credits, rt] = await Promise.all([
    all<{ visitor: string; user_id: string | null; path: string }>((a, b) => after(db.from("site_visits").select("visitor,user_id,path")).order("id", { ascending: false }).range(a, b)).catch(() => null),
    listAllUsers().catch(() => []),
    all<{ user_id: string; section_id: string; generator_id: string; status: string; price_coins: number; charge_state: string }>((a, b) =>
      after(db.from("jawad_jobs").select("user_id,section_id,generator_id,status,price_coins,charge_state")).order("created_at", { ascending: false }).range(a, b),
    ).catch(() => []),
    all<{ id: string; product: string; amount_sar: number; name: string; phone: string; email: string; status: Order["status"]; created_at: string }>((a, b) =>
      after(db.from("course_orders").select("id,product,amount_sar,name,phone,email,status,created_at")).order("created_at", { ascending: false }).range(a, b),
    ).catch(() => []),
    all<{ id: string; pack_name: string; price_sar: number; name: string; phone: string; email: string; status: Order["status"]; created_at: string }>((a, b) =>
      after(db.from("credit_orders").select("id,pack_name,price_sar,name,phone,email,status,created_at")).order("created_at", { ascending: false }).range(a, b),
    ).catch(() => []),
    loadRuntime(),
  ]);

  // visits (a table that may not be there yet)
  const v = visits ?? [];
  const pageMap = new Map<string, { views: number; who: Set<string> }>();
  for (const x of v) {
    const p = pageMap.get(x.path) ?? { views: 0, who: new Set<string>() };
    p.views++;
    p.who.add(x.visitor);
    pageMap.set(x.path, p);
  }
  const pages = [...pageMap].map(([path, p]) => ({ path, views: p.views, visitors: p.who.size })).sort((a, b) => b.visitors - a.visitors);
  const visitorsOf = (path: string) => pageMap.get(path)?.who.size ?? 0;

  // accounts made in the range
  const newUsers = users
    .filter((u) => !since || u.created_at >= since)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((u) => ({ email: u.email ?? "—", at: u.created_at }));

  // generations
  const secName = (id: string) => rt.sections.find((s) => s.id === id)?.name ?? id;
  const genName = (id: string) => rt.generators.find((g) => g.id === id)?.name ?? GENERATORS.find((g) => g.id === id)?.name ?? id;
  const charged = (j: { status: string; price_coins: number; charge_state: string }) => (j.status === "succeeded" && j.charge_state !== "none" ? j.price_coins : 0);
  const secMap = new Map<string, { ok: number; failed: number; coins: number; who: Set<string> }>();
  const genMap = new Map<string, { section: string; ok: number; failed: number; coins: number }>();
  let ok = 0;
  let failed = 0;
  let coins = 0;
  for (const j of jobs) {
    const good = j.status === "succeeded";
    const bad = j.status === "failed";
    ok += good ? 1 : 0;
    failed += bad ? 1 : 0;
    coins += charged(j);
    const s = secMap.get(j.section_id) ?? { ok: 0, failed: 0, coins: 0, who: new Set<string>() };
    s.ok += good ? 1 : 0;
    s.failed += bad ? 1 : 0;
    s.coins += charged(j);
    s.who.add(j.user_id);
    secMap.set(j.section_id, s);
    const g = genMap.get(j.generator_id) ?? { section: secName(j.section_id), ok: 0, failed: 0, coins: 0 };
    g.ok += good ? 1 : 0;
    g.failed += bad ? 1 : 0;
    g.coins += charged(j);
    genMap.set(j.generator_id, g);
  }

  // buying
  const PRODUCT: Record<string, string> = { combo: "الدورة كاملة", live: "الدورة المباشرة", recorded: "الدورة المسجّلة" };
  const orders: Order[] = [
    ...course.map((o) => ({ id: o.id, kind: "course" as const, what: PRODUCT[o.product] ?? o.product, sar: o.amount_sar, name: o.name, phone: o.phone, email: o.email, status: o.status, at: o.created_at })),
    ...credits.map((o) => ({ id: o.id, kind: "credits" as const, what: `باقة ${o.pack_name}`, sar: o.price_sar, name: o.name, phone: o.phone, email: o.email, status: o.status, at: o.created_at })),
  ];
  const funnel = (kind: Order["kind"], label: string, path: string) => {
    const list = orders.filter((o) => o.kind === kind);
    return {
      label,
      visitors: visitorsOf(path),
      started: list.length,
      transferred: list.filter((o) => o.status === "transferred" || o.status === "confirmed").length,
      confirmed: list.filter((o) => o.status === "confirmed").length,
      sar: list.filter((o) => o.status === "confirmed").reduce((n, o) => n + o.sar, 0),
    };
  };

  return {
    visitsReady: visits !== null,
    visitors: new Set(v.map((x) => x.visitor)).size,
    signedVisitors: new Set(v.filter((x) => x.user_id).map((x) => x.user_id)).size,
    views: v.length,
    pages,
    newUsers,
    makers: new Set(jobs.map((j) => j.user_id)).size,
    gens: { ok, failed, coins },
    bySection: [...secMap].map(([id, s]) => ({ name: secName(id), ok: s.ok, failed: s.failed, coins: s.coins, people: s.who.size })).sort((a, b) => b.ok - a.ok),
    byGenerator: [...genMap].map(([id, g]) => ({ name: genName(id), ...g })).sort((a, b) => b.ok - a.ok),
    funnels: [funnel("course", "🎓 الدورة", "/jawad-ai/course"), funnel("credits", "💳 شحن الرصيد", "/jawad-ai/credits")],
    // started and never pressed «تم التحويل»: the ones to follow up
    unfinished: orders.filter((o) => o.status === "started").sort((a, b) => b.at.localeCompare(a.at)),
  };
}
