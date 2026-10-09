// «المشخّص» — what the server knows right now, for the owner's diagnostician: which services are set up (yes/no, never
// the values), which database tables and columns the migrations expect but the database does not have (so a missing
// «SQL رقم …» is named at once), the latest failed generations, the charging settings, and — when the owner mentions a
// person's e-mail — what that person may use and what is in their wallet. Server only; owner only.

import { createAdminClient } from "@/lib/supabase/admin";
import { fullAccessOf } from "@/lib/access";
import { fmtSar } from "@config/coins";
import { readdir, readFile } from "fs/promises";
import path from "path";

const db = () => createAdminClient();

export const EMAIL = /[^\s@<>"'()،,؛;]+@[^\s@<>"'()،,؛;]+\.[^\s@<>"'()،,؛;.]+/g;

const SERVICE_KEYS = [
  "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "ELEVENLABS_API_KEY", "FAL_KEY", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL",
  "R2_BUCKET", "R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY",
];

export interface Expected {
  tables: { name: string; file: string }[];
  columns: { table: string; column: string; file: string }[];
}

/** The tables and added columns that the migration files (src of truth) say the database must have. */
export async function expectedSchema(dir = path.join(process.cwd(), "supabase/migrations")): Promise<Expected> {
  const names = (await readdir(dir).catch(() => [] as string[])).filter((f) => f.endsWith(".sql")).sort();
  const tables = new Map<string, string>();
  const columns = new Map<string, { table: string; column: string; file: string }>();
  for (const f of names) {
    const sql = (await readFile(path.join(dir, f), "utf8").catch(() => "")).replace(/--.*$/gm, "");
    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*\(/gi)) if (!tables.has(m[1])) tables.set(m[1], f);
    for (const m of sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?([^;]*);/gi)) {
      for (const c of m[2].matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?"?([a-z_][a-z0-9_]*)"?/gi)) columns.set(`${m[1]}.${c[1]}`, { table: m[1], column: c[1], file: f });
    }
  }
  return { tables: [...tables].map(([name, file]) => ({ name, file })), columns: [...columns.values()] };
}

const missingError = (e: { code?: string; message?: string } | null) => !!e && (e.code === "42P01" || e.code === "PGRST205" || e.code === "42703" || /does not exist|could not find|schema cache/i.test(e.message ?? ""));

/** What the database lacks of what the migrations expect (a probe per table/column; never reads rows). */
export async function missingSchema(): Promise<{ tables: { name: string; file: string }[]; columns: { table: string; column: string; file: string }[]; probed: number }> {
  const exp = await expectedSchema();
  const miss = { tables: [] as { name: string; file: string }[], columns: [] as { table: string; column: string; file: string }[], probed: 0 };
  const client = db();
  const tableGone = new Set<string>();
  for (let i = 0; i < exp.tables.length; i += 12) {
    await Promise.all(exp.tables.slice(i, i + 12).map(async (t) => {
      const { error } = await client.from(t.name).select("*", { head: true, count: "exact" }).limit(0);
      miss.probed++;
      if (missingError(error)) { miss.tables.push(t); tableGone.add(t.name); }
    }));
  }
  // columns of tables that exist (a table the migrations drop later is only reported if the probe fails the same way)
  const cols = exp.columns.filter((c) => !tableGone.has(c.table)).slice(0, 120);
  for (let i = 0; i < cols.length; i += 12) {
    await Promise.all(cols.slice(i, i + 12).map(async (c) => {
      const { error } = await client.from(c.table).select(c.column, { head: true, count: "exact" }).limit(0);
      miss.probed++;
      if (error && (error.code === "42703" || /column .* does not exist/i.test(error.message ?? ""))) miss.columns.push(c);
    }));
  }
  miss.tables.sort((a, b) => a.file.localeCompare(b.file));
  miss.columns.sort((a, b) => a.file.localeCompare(b.file));
  return miss;
}

/** A person by e-mail: what «السماح» gives them and their wallet (nothing else about them). */
export async function personFacts(email: string) {
  const mail = email.toLowerCase();
  const access = await fullAccessOf(mail).catch(() => null);
  const { listAllUsers } = await import("@/lib/supabase/admin");
  const user = (await listAllUsers().catch(() => [])).find((u) => u.email?.toLowerCase() === mail);
  const wallet = user ? (await db().from("smart_coin_wallets").select("balance,plan,library_until").eq("user_id", user.id).maybeSingle()).data : null;
  return {
    email: mail,
    registered: !!user,
    perms: access ? [...access.perms] : null,
    unlimited: access?.unlimited ?? null,
    balance: wallet ? `${fmtSar(wallet.balance as number)} ر.س` : user ? "(لا محفظة بعد)" : null,
    plan: (wallet?.plan as string | null) ?? null,
    libraryUntil: (wallet?.library_until as string | null) ?? null,
  };
}

/** The server's side of the picture, as one JSON-able object. */
export async function platformState(mentioned: string[] = []) {
  const [schema, jobs, limits] = await Promise.all([
    missingSchema().catch((e) => ({ error: String((e as Error).message ?? e) })),
    db().from("jawad_jobs").select("id,generator_id,status,submit_state,provider_status,error_message,created_at").eq("status", "failed").order("created_at", { ascending: false }).limit(12).then((r) => (r.error ? { error: r.error.message } : r.data)),
    db().from("film_limits").select("key,value").eq("scope", "all").eq("target", "").in("key", ["coins_required", "units_halalas", "price_usd_sar_x100", "price_step_halalas", "price_margin_pct", "price_was_margin_pct"]).then((r) => (r.error ? { error: r.error.message } : r.data)),
  ]);
  const people = await Promise.all([...new Set(mentioned.map((m) => m.toLowerCase()))].slice(0, 3).map((m) => personFacts(m).catch(() => ({ email: m, error: "تعذّر الفحص" }))));
  return {
    now: new Date().toISOString(),
    services: Object.fromEntries(SERVICE_KEYS.map((k) => [k, !!process.env[k]])),
    seedance: ["ARK_API_KEY", "seedance_api", "SEEDANCE_API"].some((k) => !!process.env[k]),
    deployment: { commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? null, env: process.env.VERCEL_ENV ?? null },
    databaseMissing: schema,
    chargingSettings: limits,
    latestFailedJobs: jobs,
    people,
  };
}
