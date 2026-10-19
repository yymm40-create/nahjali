// A small in-memory stand-in for the database, with only what the khatma functions use and the same unique keys as
// migrations 0080 and 0081 (a second insert of the same key fails with 23505, like Postgres).
import type { SupabaseClient } from "@supabase/supabase-js";

export type Row = Record<string, unknown>;
const UNIQUE: Record<string, string[][]> = {
  mahdi_khatma_settings: [["group_id"]],
  mahdi_khatmas: [["id"], ["group_id", "number"]],
  mahdi_khatma_claims: [["khatma_id", "portion"]],
  mahdi_my_khatmas: [["id"], ["user_id", "number"]],
  mahdi_my_khatma_reads: [["khatma_id", "quarter"]],
  site_codes: [["id"], ["code"]],
  site_code_uses: [["code_id", "email"]],
};

export function fakeDb() {
  const tables: Record<string, Row[]> = { mahdi_khatma_settings: [], mahdi_khatmas: [], mahdi_khatma_claims: [], mahdi_my_khatmas: [], mahdi_my_khatma_reads: [] };
  let ids = 0;
  class Q {
    private filters: ((r: Row) => boolean)[] = [];
    private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
    private payload: Row | Row[] = {};
    private returning = false;
    private count = false;
    private head = false;
    private sort: [string, boolean] | null = null;
    private lim: [number, number] | null = null;
    private one = false;
    constructor(private table: string) {}
    select(_cols?: string, opts?: { count?: string; head?: boolean }) {
      if (this.op !== "select") this.returning = true;
      if (opts?.count) this.count = true;
      if (opts?.head) this.head = true;
      return this;
    }
    // a column, or a path into a json column: «meta->>model»
    private val(r: Row, c: string) {
      const [col, key] = c.split("->>");
      return key ? (r[col] as Record<string, unknown> | undefined)?.[key] : r[col];
    }
    eq(c: string, v: unknown) { this.filters.push((r) => this.val(r, c) === v); return this; }
    neq(c: string, v: unknown) { this.filters.push((r) => this.val(r, c) !== v); return this; }
    not(c: string, op: string, v: string) {
      const list = op === "in" ? v.replace(/[()]/g, "").split(",") : [v];
      this.filters.push((r) => !list.includes(String(this.val(r, c))));
      return this;
    }
    lt(c: string, v: number) { this.filters.push((r) => (r[c] as number) < v); return this; }
    gte(c: string, v: number | string) { this.filters.push((r) => (r[c] as number | string) >= v); return this; }
    in(c: string, v: unknown[]) { this.filters.push((r) => v.includes(r[c])); return this; }
    order(c: string, o?: { ascending?: boolean }) { this.sort = [c, o?.ascending !== false]; return this; }
    limit(n: number) { this.lim = [0, n - 1]; return this; }
    range(a: number, b: number) { this.lim = [a, b]; return this; }
    maybeSingle() { this.one = true; return this; }
    insert(rows: Row | Row[]) { this.op = "insert"; this.payload = rows; return this; }
    upsert(row: Row) { this.op = "upsert"; this.payload = row; return this; }
    update(patch: Row) { this.op = "update"; this.payload = patch; return this; }
    delete() { this.op = "delete"; return this; }
    private rows() { return (tables[this.table] ??= []).filter((r) => this.filters.every((f) => f(r))); }
    private clash(row: Row, except?: Row) {
      return (UNIQUE[this.table] ?? []).some((keys) => tables[this.table].some((r) => r !== except && keys.every((k) => r[k] === row[k])));
    }
    run(): { data: unknown; error: { code: string } | null; count?: number } {
      const t = (tables[this.table] ??= []);
      if (this.op === "insert") {
        for (const raw of [this.payload].flat()) {
          const row: Row = { ...raw };
          if (this.table === "mahdi_khatmas") Object.assign(row, { id: row.id ?? `k${++ids}`, status: row.status ?? "open", finished_at: null, starts_at: row.starts_at ?? new Date().toISOString() });
          if (this.table === "mahdi_khatma_claims") Object.assign(row, { claimed_at: new Date().toISOString(), done_at: null, status: row.status ?? "reading" });
          if (this.table === "mahdi_my_khatmas") Object.assign(row, { id: row.id ?? `m${++ids}`, status: row.status ?? "open", finished_on: null, habit_id: row.habit_id ?? null });
          if (this.clash(row)) return { data: null, error: { code: "23505" } };
          t.push(row);
        }
        return { data: null, error: null };
      }
      if (this.op === "upsert") {
        const row = this.payload as Row;
        const old = t.find((r) => r.group_id === row.group_id);
        if (old) Object.assign(old, row);
        else t.push({ ...row });
        return { data: null, error: null };
      }
      let hit = this.rows();
      if (this.op === "update") {
        hit.forEach((r) => Object.assign(r, this.payload));
        return { data: this.returning ? hit : null, error: null };
      }
      if (this.op === "delete") {
        tables[this.table] = t.filter((r) => !hit.includes(r));
        return { data: this.returning ? hit : null, error: null };
      }
      if (this.sort) {
        const [c, asc] = this.sort;
        hit = [...hit].sort((a, b) => ((a[c] as number) > (b[c] as number) ? 1 : -1) * (asc ? 1 : -1));
      }
      if (this.count && this.head) return { data: null, error: null, count: hit.length };
      if (this.lim) hit = hit.slice(this.lim[0], this.lim[1] + 1);
      if (this.one) return { data: hit[0] ?? null, error: null };
      return { data: hit.map((r) => ({ ...r })), error: null };
    }
    then<T>(ok: (v: ReturnType<Q["run"]>) => T, bad?: (e: unknown) => T) {
      try {
        return Promise.resolve(ok(this.run()));
      } catch (e) {
        return bad ? Promise.resolve(bad(e)) : Promise.reject(e);
      }
    }
  }
  const db = { from: (table: string) => new Q(table) } as unknown as SupabaseClient;
  return { db, tables };
}
