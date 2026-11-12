import { afterEach, describe, expect, it, vi } from "vitest";
import type { OpRow } from "@/lib/editor/changes-core";

// A small in-memory stand-in for the database: only what the editor's save, log and points call. A table not in
// `tables` answers like a table the migration hasn't made yet (an error).
type Row = Record<string, unknown>;
const tables: Record<string, Row[] | undefined> = {};
let seq = 0;
function from(name: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let op: "select" | "update" | "delete" | "insert" | "upsert" = "select";
  let patch: Row = {};
  let rows: Row[] = [];
  let single = false;
  let limit = Infinity;
  let order: { k: string; asc: boolean } | null = null;
  const q = {
    select: () => q,
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
    in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), q),
    not: (k: string, _o: string, v: string) => (filters.push((r) => !v.replace(/[()]/g, "").split(",").includes(String(r[k]))), q),
    order: (k: string, o?: { ascending?: boolean }) => ((order = { k, asc: o?.ascending !== false }), q),
    limit: (n: number) => ((limit = n), q),
    maybeSingle: () => ((single = true), q),
    single: () => ((single = true), q),
    update: (p: Row) => ((op = "update"), (patch = p), q),
    delete: () => ((op = "delete"), q),
    insert: (v: Row | Row[]) => ((op = "insert"), (rows = (Array.isArray(v) ? v : [v]).map((r) => ({ id: ++seq, created_at: new Date().toISOString(), ...r }))), q),
    upsert: (v: Row) => ((op = "upsert"), (rows = [v]), q),
    then: (res: (v: unknown) => void) => {
      const t = tables[name];
      if (!t) return res({ data: null, error: { message: `relation "${name}" does not exist` } });
      if (op === "insert") return t.push(...rows), res({ data: rows, error: null });
      if (op === "upsert") {
        const at = t.findIndex((r) => r.user_id === rows[0].user_id);
        if (at >= 0) t[at] = { ...t[at], ...rows[0] };
        else t.push(rows[0]);
        return res({ data: rows, error: null });
      }
      let hit = t.filter((r) => filters.every((f) => f(r)));
      if (op === "update") hit.forEach((r) => Object.assign(r, patch));
      if (op === "delete") tables[name] = t.filter((r) => !hit.includes(r));
      if (order) {
        const { k, asc } = order;
        hit = [...hit].sort((a, b) => (Number(a[k]) - Number(b[k])) * (asc ? 1 : -1));
      }
      hit = hit.slice(0, limit);
      res({ data: single ? (hit[0] ?? null) : hit, error: null });
    },
  };
  return q;
}
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from }) }));

const { changeLog, rulesNote, shouldSnapshot, toPrune, SNAPSHOT_CAP, SNAPSHOT_EVERY_MS } = await import("@/lib/editor/changes-core");
const { saveTimeline } = await import("@/lib/editor/server");
const { changeHistory, pointTimeline, standingRules } = await import("@/lib/editor/changes");
const { emptyTimeline, readTimeline } = await import("@/lib/editor/model");
const { callClaudeJson } = await import("@/lib/film/anthropic");

const at = (min: number) => new Date(Date.UTC(2026, 10, 12, 10, min)).toISOString();
const op = (version: number, actor: string, label: string, min: number, steps?: string[]): OpRow => ({ version, actor, label, created_at: at(min), ...(steps ? { steps } : {}) });

describe("«سجل التغييرات»", () => {
  it("never shows the cost and listening rows as changes", () => {
    const log = changeLog([op(3, "user", "قص عند ٠:٠٣", 3), op(2, "claude", "0.0412", 2), op(2, "speech", "1.5", 2), op(2, "user", "أضفت نصًا", 1)]);
    expect(log.map((c) => c.what)).toEqual(["قص عند ٠:٠٣", "أضفت نصًا"]);
    expect(log.every((c) => c.who === "you")).toBe(true);
  });

  it("shows a turn of حيدرا ماكس as one line, named by the person's words, with his steps", () => {
    const log = changeLog([
      op(7, "user", "حذفت مقطعًا", 9),
      op(6, "haidara", "موسيقى", 6, ["أضفت صوتًا"]),
      op(5, "claude", "0.1", 5),
      op(5, "haidara", "حيدرا ماكس: قص السكتات وحط موسيقى", 5, ["شلت ٠:٠٤ (٣ جزء)", "حذفت مقطعًا", "حذفت مقطعًا"]),
      op(4, "user", "أضفت مقطعًا", 1),
    ]);
    expect(log.map((c) => c.who)).toEqual(["you", "haidara", "you"]);
    expect(log[1]).toMatchObject({ what: "«قص السكتات وحط موسيقى»", version: 6, from: 4, steps: ["شلت ٠:٠٤ (٣ جزء)", "حذفت مقطعًا ×2", "أضفت صوتًا"] });
    // a new message of the person is a new turn, even right after the last one
    expect(changeLog([op(2, "haidara", "حيدرا ماكس: ب", 2), op(1, "haidara", "حيدرا ماكس: أ", 1)]).map((c) => c.what)).toEqual(["«ب»", "«أ»"]);
  });

  it("knows his changes saved before the update by their name, and the person's undo of them as theirs", () => {
    const log = changeLog([op(3, "user", "تراجع: حيدرا ماكس: خلّه أقصر", 3), op(2, "user", "حيدرا ماكس: خلّه أقصر", 2)]);
    expect(log.map((c) => c.who)).toEqual(["you", "haidara"]);
    expect(log[1].steps).toEqual([]);
  });
});

describe("the points to come back to", () => {
  const base = { now: Date.parse(at(30)), version: 10 };
  it("are kept before and right after a turn of حيدرا ماكس, before a «ارجع لهنا», and every so often", () => {
    const recent = { version: 9, at: Date.parse(at(29)) };
    expect(shouldSnapshot({ ...base, actor: "haidara", before: "you", last: recent })).toBe(true);
    expect(shouldSnapshot({ ...base, actor: "haidara", before: "haidara", last: recent })).toBe(false);
    expect(shouldSnapshot({ ...base, actor: "user", before: "haidara", last: recent })).toBe(true);
    expect(shouldSnapshot({ ...base, actor: "restore", before: "you", last: recent })).toBe(true);
    expect(shouldSnapshot({ ...base, actor: "user", before: "you", last: recent })).toBe(false);
    expect(shouldSnapshot({ ...base, actor: "user", before: "you", last: { version: 9, at: base.now - SNAPSHOT_EVERY_MS } })).toBe(true);
    expect(shouldSnapshot({ ...base, actor: "user", before: "you", last: { version: -10, at: base.now } })).toBe(true);
    expect(shouldSnapshot({ ...base, actor: "user", before: null, last: null })).toBe(true);
    // the same version is never kept twice
    expect(shouldSnapshot({ ...base, actor: "restore", before: "you", last: { version: 10, at: 0 } })).toBe(false);
  });

  it("are capped: the oldest past the newest 30 are deleted", () => {
    const rows = Array.from({ length: 34 }, (_, i) => ({ id: 100 + i, version: i + 1 }));
    expect(toPrune(rows, SNAPSHOT_CAP)).toEqual([103, 102, 101, 100]);
    expect(toPrune(rows.slice(0, 30))).toEqual([]);
  });
});

describe("«ارجع لهنا»", () => {
  afterEach(() => {
    for (const k of Object.keys(tables)) delete tables[k];
  });
  const withText = (body: string) => readTimeline({ ...emptyTimeline(), tracks: [{ id: "t1", kind: "text", name: "نص", clips: [{ id: "c1", start: 0, in: 0, out: 2000, text: { body } }] }] });
  const project = (version: number, timeline = withText("قبل")) => ({ id: "11111111-1111-4111-8111-111111111111", user_id: "u1", title: "ريل", kind: "reel", version, timeline, film_project_id: null, export_path: null, exported_at: null, purge_at: null, purged_at: null, created_at: at(0), updated_at: at(0) });

  it("is a new change: a new version, logged, and the document it replaced is kept (so it can be taken back)", async () => {
    const p = project(5);
    Object.assign(tables, { editor_projects: [{ ...p }], editor_assets: [], editor_ops: [{ id: 1, project_id: p.id, version: 5, actor: "user", label: "أضفت نصًا", created_at: at(1) }], editor_snapshots: [{ id: 2, project_id: p.id, version: 3, timeline: withText("قديم"), created_at: at(1) }] });
    const back = await pointTimeline(p.id, 3);
    expect(JSON.stringify(back.timeline)).toContain("قديم");
    const r = await saveTimeline(p as never, { timeline: back.timeline, version: 5, actor: "restore", label: "رجّعت المشروع لـ: أضفت نصًا" });
    expect(r).toEqual({ ok: true, version: 6 });
    expect(tables.editor_projects![0]).toMatchObject({ version: 6 });
    expect(JSON.stringify(tables.editor_projects![0].timeline)).toContain("قديم");
    expect(tables.editor_snapshots!.find((s) => s.version === 5)?.timeline).toEqual(p.timeline);
    expect(tables.editor_ops!.at(-1)).toMatchObject({ version: 6, actor: "restore" });
    const h = await changeHistory(p.id);
    expect(h.changes[0]).toMatchObject({ version: 6, restore: true, who: "you" });
    expect(h.points).toEqual([5, 3]);
    // an old copy of the page (version 5 again) does not overwrite it
    expect(await saveTimeline(p as never, { timeline: withText("x"), version: 5 })).toMatchObject({ ok: false, version: 6 });
  });

  it("before the database update: the log still reads, nothing is offered to go back to, and a save still works", async () => {
    const p = project(1);
    Object.assign(tables, { editor_projects: [{ ...p }], editor_assets: [], editor_ops: [] });
    expect(await saveTimeline(p as never, { timeline: withText("بعد"), version: 1, actor: "haidara", label: "حيدرا ماكس: غيّر النص", steps: ["غيّرت النص"] })).toEqual({ ok: true, version: 2 });
    const h = await changeHistory(p.id);
    expect(h.points).toBeNull();
    expect(h.changes).toHaveLength(1);
    expect(h.changes[0]).toMatchObject({ who: "haidara", what: "«غيّر النص»" });
    await expect(pointTimeline(p.id, 1)).rejects.toThrow("0111");
  });
});

describe("«تعليماتي الدايمة»", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    for (const k of Object.keys(tables)) delete tables[k];
  });

  async function sentWith(turnNote: string) {
    let body: { messages: { role: string; content: { type: string; text?: string }[] }[] } | null = null;
    const done = [{ type: "message_start", message: { model: "claude-opus-5-5", usage: { input_tokens: 1, output_tokens: 1 } } }, { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }, { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: '{"ok":true}' } }, { type: "content_block_stop", index: 0 }, { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 1 } }, { type: "message_stop" }];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => ((body = JSON.parse(String(init.body))), new Response(done.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(""), { status: 200 }))));
    process.env.ANTHROPIC_API_KEY = "test";
    await callClaudeJson({ system: "TASK", turns: [{ role: "user", content: "قص السكتات" }], turnNote: turnNote || undefined, schema: { type: "object" }, maxTokens: 100 });
    return body!;
  }

  it("ride in the turn note of the request (not the system), and are absent when empty", async () => {
    const withRules = await sentWith(rulesNote("دايماً كابشن أصفر، لا تقص الأنفاس"));
    const first = withRules.messages.at(-1)!.content[0].text!;
    expect(first).toContain("<this_turn>");
    expect(first).toContain("دايماً كابشن أصفر، لا تقص الأنفاس");
    expect(first).toMatch(/unless their message now asks for something different/);
    expect(JSON.stringify((withRules as unknown as { system: unknown }).system)).not.toContain("كابشن أصفر");

    expect(rulesNote("   ")).toBe("");
    const without = await sentWith(rulesNote(""));
    expect(JSON.stringify(without.messages)).not.toContain("<this_turn>");
  });

  it("are the account's once kept, and the page's copy before the update", async () => {
    expect(await standingRules("u1", "من الجهاز")).toBe("من الجهاز");
    tables.editor_user_settings = [{ user_id: "u1", haidara_rules: "من الحساب" }];
    expect(await standingRules("u1", "من الجهاز")).toBe("من الحساب");
    expect(await standingRules("u2", "x".repeat(2000))).toHaveLength(1500);
  });
});
