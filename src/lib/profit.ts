// SERVER ONLY. «صافي الربح» (/admin/profit): the money that came in (balance top-ups by bank transfer and course sales,
// confirmed by the owner) minus what the site's use really cost (the providers' prices: Claude, OpenAI, Seedance,
// ElevenLabs…) = the owner's net profit. Everyone's use costs — paying people, gifts and free accounts, and the
// owners' own use (shown on its own). The real cost comes from:
//   • site_costs (migration 0092): written when each operation is charged (robots, «حيدرا ماكس», jobs, editor tools);
//   • jawad_jobs: the studio's generations keep their own provider cost;
//   • older operations (before 0092) or ones without a cost record: estimated from what was charged for them, at the
//     margin of their kind at that time — marked «تقديري».

import { createAdminClient } from "@/lib/supabase/admin";
import { loadPricing } from "@/lib/coins";
import { branchOf, BRANCHES, type Branch } from "@/lib/spend";
import { GENERATORS } from "@config/jawad/generators";
import { CO_OWNER_EMAILS, OWNER_EMAILS } from "@config/site";

type Kind = "claude" | "image" | "video" | "other";

/** The margins of each period (to estimate the cost of what was charged before costs were recorded). */
const MARGINS: { from: string; m: Record<Kind, number> }[] = [
  { from: "2026-10-21", m: { claude: 40, image: 30, video: 40, other: 40 } },
  { from: "0000", m: { claude: 10, image: 60, video: 40, other: 30 } },
];

/** What a branch is mostly priced as. */
const BRANCH_KIND: Partial<Record<Branch, Kind>> = {
  "صناعة الصور": "image",
  "صناعة الفيديو": "video",
  "صناعة الصوت": "other",
  "كتيب الجداول": "image",
  "زهراء فوتو ماستر": "image",
  أخرى: "other",
};
const kindOf = (b: Branch): Kind => BRANCH_KIND[b] ?? "claude";

/** The cost behind a price in halalas, at the margin of its kind on that date (an estimate: prices are rounded up). */
export function estimateCost(halalas: number, branch: Branch, at: string): number {
  const m = (MARGINS.find((x) => at.slice(0, 10) >= x.from) ?? MARGINS[MARGINS.length - 1]).m[kindOf(branch)];
  return halalas / (1 + m / 100);
}

export interface ProfitBranch {
  branch: Branch;
  /** cost of everyone's use but the owners', halalas */
  people: number;
  /** cost of the owners' own use */
  owners: number;
  /** the part of both that is an estimate */
  estimated: number;
  /** what people were charged for it (coins taken), halalas */
  charged: number;
}

export interface Profit {
  /** money in, halalas */
  topups: number;
  topupsCount: number;
  /** balance given with the top-ups (the price + the package's extra) */
  topupsCredit: number;
  courses: number;
  coursesCount: number;
  income: number;
  /** what people's use cost (exact + estimated), halalas */
  peopleCost: number;
  /** what the owners' own use cost */
  ownersCost: number;
  /** each owner's own use */
  owners: { email: string; cost: number }[];
  /** part of the costs that is an estimate */
  estimated: number;
  net: number;
  /** coins people were charged for their use (what they spent from their balance) */
  charged: number;
  /** balance still in people's wallets (bought or given, not used yet) */
  unusedBalance: number;
  branches: ProfitBranch[];
  /** since when the exact costs are recorded (null: not yet, migration 0092 missing) */
  recordingSince: string | null;
}

const PAGE = 10_000;
type Row = Record<string, unknown>;

/** A filter on the rows read: one column equal to a value, or not in a list ("(a,b)"). */
type Filter = { eq?: [string, string]; notIn?: [string, string] };

async function all(table: string, cols: string, since: string | null, dateCol = "created_at", filter: Filter = {}): Promise<Row[]> {
  const db = createAdminClient();
  const out: Row[] = [];
  for (let from = 0; from < 500_000; from += PAGE) {
    let q = db.from(table).select(cols).order(dateCol, { ascending: true }).range(from, from + PAGE - 1);
    if (since) q = q.gte(dateCol, since);
    if (filter.eq) q = q.eq(filter.eq[0], filter.eq[1]);
    if (filter.notIn) q = q.not(filter.notIn[0], "in", filter.notIn[1]);
    const { data, error } = await q;
    if (error || !data?.length) break;
    out.push(...(data as unknown as Row[]));
    if (data.length < PAGE) break;
  }
  return out;
}

/** The owners' accounts (id → e-mail). */
async function ownerIds(): Promise<Map<string, string>> {
  const want = new Set([...OWNER_EMAILS, ...CO_OWNER_EMAILS].map((e) => e.toLowerCase()));
  const found = new Map<string, string>();
  const db = createAdminClient();
  for (let page = 1; page <= 50 && found.size < want.size; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    for (const u of data.users) if (u.email && want.has(u.email.toLowerCase())) found.set(u.id, u.email.toLowerCase());
    if (data.users.length < 1000) break;
  }
  return found;
}

const GEN_BRANCH = new Map(GENERATORS.map((g) => [g.id, (g.output === "video" ? "صناعة الفيديو" : g.output === "audio" ? "صناعة الصوت" : "صناعة الصور") as Branch]));

/** The net profit since a moment (null: from the start). */
export async function computeProfit(since: string | null): Promise<Profit> {
  const pricing = await loadPricing();
  const rate = pricing.usdToSar * 100;
  const [owners, credits, courses, costs, jobs, ledger, team, free, wallets] = await Promise.all([
    ownerIds(),
    all("credit_orders", "price_sar,credit_sar,confirmed_at,status", since, "confirmed_at", { eq: ["status", "confirmed"] }),
    all("course_orders", "amount_sar,confirmed_at,status", since, "confirmed_at", { eq: ["status", "confirmed"] }),
    all("site_costs", "ref,user_id,label,cost_halalas,created_at", since),
    all("jawad_jobs", "id,user_id,generator_id,status,cost_usd_actual,cost_usd_estimate,created_at", since, "created_at", { eq: ["status", "succeeded"] }),
    all("smart_coin_ledger", "user_id,delta,reason,ref,label,created_at", since, "created_at", { notIn: ["reason", "(grant,purchase)"] }),
    all("team_coin_ledger", "user_id,delta,reason,ref,label,created_at", since, "created_at", { notIn: ["reason", "(grant,purchase,fund,withdraw)"] }),
    all("site_free_usage", "user_id,ref,label,halalas,created_at", since),
    all("smart_coin_wallets", "balance", null, "updated_at"),
  ]);

  const branches = new Map<Branch, ProfitBranch>(BRANCHES.map((b) => [b, { branch: b, people: 0, owners: 0, estimated: 0, charged: 0 }]));
  const ownerCost = new Map<string, number>();
  let estimated = 0;
  const addCost = (userId: unknown, branch: Branch, cost: number, est: boolean) => {
    if (!(cost > 0)) return;
    const b = branches.get(branch)!;
    const owner = typeof userId === "string" ? owners.get(userId) : undefined;
    if (owner) {
      b.owners += cost;
      ownerCost.set(owner, (ownerCost.get(owner) ?? 0) + cost);
    } else b.people += cost;
    if (est) {
      b.estimated += cost;
      estimated += cost;
    }
  };

  // 1) the exact costs
  const exact = new Set<string>();
  for (const c of costs) {
    exact.add(String(c.ref));
    addCost(c.user_id, branchOf(String(c.label ?? "")), Number(c.cost_halalas) || 0, false);
  }
  for (const j of jobs) {
    exact.add(String(j.id));
    const usd = Number(j.cost_usd_actual ?? j.cost_usd_estimate) || 0;
    addCost(j.user_id, GEN_BRANCH.get(String(j.generator_id)) ?? "صناعة الصور", usd * rate, false);
  }

  // 2) what people were charged (net of refunds, per operation); estimated cost where no exact one was recorded
  const charged = new Map<string, { user: unknown; label: string; at: string; halalas: number }>();
  for (const r of [...ledger, ...team]) {
    const ref = String(r.ref ?? "");
    // moving balance into or out of a team wallet is not use
    if (ref.startsWith("team-fund:") || ref.startsWith("team-withdraw:")) continue;
    const key = ref || `row:${String(r.created_at)}:${String(r.user_id)}`;
    const e = charged.get(key) ?? { user: r.user_id, label: String(r.label ?? ""), at: String(r.created_at), halalas: 0 };
    e.halalas -= Number(r.delta) || 0;
    charged.set(key, e);
  }
  let chargedTotal = 0;
  for (const [ref, e] of charged) {
    if (e.halalas <= 0) continue;
    const branch = branchOf(e.label);
    branches.get(branch)!.charged += e.halalas;
    chargedTotal += e.halalas;
    if (!exact.has(ref)) addCost(e.user, branch, estimateCost(e.halalas, branch, e.at), true);
  }
  // the free accounts' and the owners' use before its cost was recorded: from its value at the site's prices
  for (const f of free) {
    const ref = String(f.ref ?? "");
    if (exact.has(ref) || charged.has(ref)) continue;
    const branch = branchOf(String(f.label ?? ""));
    addCost(f.user_id, branch, estimateCost(Number(f.halalas) || 0, branch, String(f.created_at)), true);
  }

  const topups = credits.reduce((s, c) => s + (Number(c.price_sar) || 0) * 100, 0);
  const topupsCredit = credits.reduce((s, c) => s + (Number(c.credit_sar) || 0) * 100, 0);
  const courseSum = courses.reduce((s, c) => s + (Number(c.amount_sar) || 0) * 100, 0);
  const list = [...branches.values()].filter((b) => b.people + b.owners + b.charged > 0).sort((a, b) => b.people + b.owners - (a.people + a.owners));
  const peopleCost = list.reduce((s, b) => s + b.people, 0);
  const ownersCost = list.reduce((s, b) => s + b.owners, 0);
  const income = topups + courseSum;
  const firstCost = costs.length ? String(costs[0].created_at) : null;
  return {
    topups,
    topupsCount: credits.length,
    topupsCredit,
    courses: courseSum,
    coursesCount: courses.length,
    income,
    peopleCost,
    ownersCost,
    owners: [...ownerCost.entries()].map(([email, cost]) => ({ email, cost })).sort((a, b) => b.cost - a.cost),
    estimated,
    net: income - peopleCost - ownersCost,
    charged: chargedTotal,
    unusedBalance: wallets.reduce((s, w) => s + Math.max(0, Number(w.balance) || 0), 0),
    branches: list,
    recordingSince: firstCost,
  };
}
