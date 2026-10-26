// «الأكواد»: a code's gift (migration 0083) — points in the wallet once per person, everything at cost with Claude's input
// and output counted, a ceiling on the Claude model, and a number of Seedance 2.0 generations.
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { capClaudeModel, CLAUDE_MODELS } from "@config/claude-models";
import { claudeIdFor, codeWelcome, NO_PERKS, perksByCodes, type CodeRow, type CodeUse } from "@config/access";
import { claudeHalalas, costHalalas, costOfLines, coinsFor, setPricing } from "@config/coins";
import { priceOf } from "@/lib/coins";
import { claudeCost } from "@/lib/film/anthropic";
import { fakeDb } from "../mahdi/fake-db";

const read = (p: string) => readFileSync(p, "utf8");
const NOW = Date.parse("2026-10-19T12:00:00Z");
const code = (id: string, o: Partial<CodeRow> = {}): CodeRow => ({ id, label: id, code: id.repeat(4), perms: ["film"], expiresAt: null, validHours: null, maxUses: null, enabled: true, unlimited: false, giftSar: 0, atCost: false, claudeModel: null, videoGens: null, ...o });
const use = (codeId: string, at = "2026-10-19T10:00:00.000Z"): CodeUse => ({ codeId, email: "a@b.co", at });
const ZAHRA = { giftSar: 35, atCost: true, claudeModel: "opus" as const, videoGens: 2 };

describe("what a code gives besides sections", () => {
  it("reads the gift only from codes still open, and the strictest ceiling wins", () => {
    expect(perksByCodes([code("a", ZAHRA)], [use("a")], NOW)).toEqual({ atCost: true, claudeModel: "opus", videoGens: { cap: 2, since: "2026-10-19T10:00:00.000Z" } });
    expect(perksByCodes([code("a", ZAHRA)], [], NOW)).toEqual(NO_PERKS);
    expect(perksByCodes([code("a", { ...ZAHRA, enabled: false })], [use("a")], NOW)).toEqual(NO_PERKS);
    expect(perksByCodes([code("a", { ...ZAHRA, expiresAt: new Date(NOW - 1).toISOString() })], [use("a")], NOW)).toEqual(NO_PERKS);
    // two codes: the cheaper Claude ceiling, the smaller generations cap counted from the earlier entry
    const two = perksByCodes([code("a", { claudeModel: "opus", videoGens: 5 }), code("b", { claudeModel: "sonnet", videoGens: 2, atCost: true })], [use("a", "2026-10-19T09:00:00.000Z"), use("b", "2026-10-19T11:00:00.000Z")], NOW);
    expect(two).toEqual({ atCost: true, claudeModel: "sonnet", videoGens: { cap: 2, since: "2026-10-19T09:00:00.000Z" } });
    // a code with no gift gives nothing extra
    expect(perksByCodes([code("a")], [use("a")], NOW)).toEqual(NO_PERKS);
  });

  it("caps the Claude model: a dearer pick is served by the ceiling, a cheaper or equal one stays", () => {
    const id = (k: string) => CLAUDE_MODELS.find((m) => m.key === k)!.id;
    expect(capClaudeModel(id("fable"), "opus")).toBe(id("opus"));
    expect(capClaudeModel(id("opus"), "opus")).toBe(id("opus"));
    expect(capClaudeModel(id("sonnet"), "opus")).toBe(id("sonnet"));
    expect(capClaudeModel(id("haiku"), "sonnet")).toBe(id("haiku"));
    expect(capClaudeModel(id("fable"), null)).toBe(id("fable"));
    expect(capClaudeModel("something else", "opus")).toBe(id("opus"));
    expect(claudeIdFor(id("fable"), { ...NO_PERKS, claudeModel: "opus" })).toBe(id("opus"));
    expect(claudeIdFor(id("fable"), NO_PERKS)).toBe(id("fable"));
  });

  it("tells the person what it gave, in plain words, with the price as «¤35» (the page draws the coin)", () => {
    const lines = codeWelcome(code("a", ZAHRA));
    expect(lines[0]).toContain("¤35");
    expect(lines.join(" ")).not.toMatch(/ريال/);
    expect(lines.join(" ")).toContain("«الأصيل»");
    expect(lines.join(" ")).toContain("توليدان");
    expect(lines.join(" ")).toContain("بدون أي ربح");
    expect(lines.at(-1)).toContain("🎞️");
    // re-entering: no gift line
    expect(codeWelcome(code("a", { ...ZAHRA, giftSar: 0 })).join(" ")).not.toContain("¤");
    // a code with no gift says only what it opens
    expect(codeWelcome(code("a"))).toHaveLength(1);
  });
});

describe("at cost: what the tool costs us, with Claude's input and output counted", () => {
  beforeEach(() => setPricing(null));

  it("no profit and no rounding up to half a riyal", () => {
    // a reply: 65 000 tokens in at the cache-write rate, 5 000 out, on the default model (4 / 5 / 20 USD per million)
    const usd = claudeCost({ input_tokens: 0, cache_creation_input_tokens: 65_000, output_tokens: 5_000, cache_creation: { ephemeral_5m_input_tokens: 65_000, ephemeral_1h_input_tokens: 0 } } as never, CLAUDE_MODELS.find((m) => m.key === "opus")!);
    expect(usd).toBeCloseTo(0.425, 3);
    expect(priceOf(usd, "claude", true)).toBe(costHalalas(usd));
    expect(priceOf(usd, "claude", true)).toBe(160);
    expect(claudeHalalas(usd)).toBe(255); // normal: cost + 60%
    // a video: the normal price carries 40% and is rounded to half riyals; at cost it is the cost to the halala
    const video = 2.109;
    expect(coinsFor(video, "video")).toBe(1150);
    expect(priceOf(video, "video", true)).toBe(costHalalas(video));
    expect(priceOf(video, "video", true)).toBe(791);
    expect(priceOf(0, "image", true)).toBe(0);
    // a mix of kinds costs the same total at cost, whatever the shares
    expect(priceOf(3, { claude: 1, image: 2 }, true)).toBe(costHalalas(3));
  });

  it("a price table's lines (hundredths of a halala) at cost: up to the halala, at least one", () => {
    expect(costOfLines([{ centi: 20_000 }, { centi: 150 }])).toBe(202);
    expect(costOfLines([{ centi: 1 }])).toBe(1);
    expect(costOfLines([{ centi: 100 }])).toBe(1);
  });

  it("is wired into every paid path that takes after use, and the studio's price", () => {
    const coins = read("src/lib/coins.ts");
    expect(coins).toContain("priceOf(costUsd, claude, await atCostFor(userId))");
    expect(coins).toContain("priceOf(costUsd, claude, await atCostFor(r.userId))");
    expect(coins).toMatch(/atCost \? priceOf\(usd, "claude", true\) : claudeHalalas\(usd, undefined, kind\)/);
    const jobs = read("src/lib/jawad/server/jobs.ts");
    expect(jobs).toContain("costOfLines(e.price.lines)");
    expect(jobs).toContain("(await perksOf(user.email)).atCost");
    expect(jobs).toContain("payCoins");
    expect(jobs).not.toMatch(/holdTeamCoins\(server\.team!, user, e\.price\.coins/);
  });
});

describe("the Claude ceiling reaches every robot", () => {
  it("the shared robot turn, the editor's Claude and the film maker's routes all serve the capped model", () => {
    for (const f of ["src/lib/claude-run.ts", "src/lib/editor/pricing.ts", "src/app/api/film/projects/[id]/sheets/route.ts", "src/app/api/film/projects/[id]/script/route.ts", "src/app/api/film/projects/[id]/director/route.ts", "src/app/api/film/sajjad/route.ts"]) {
      expect(read(f), f).toContain("claudeFor(");
    }
  });
});

// ───────────── the redemption and the Seedance 2.0 ceiling, on an in-memory database ─────────────

const h = vi.hoisted(() => ({ db: null as unknown, gifts: [] as { user: string; halalas: number; ref: string; label: string }[], failGift: false, perks: null as unknown }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.db }));
vi.mock("@/lib/api", () => {
  class UserError extends Error {
    constructor(message: string, public status = 400) {
      super(message);
    }
  }
  return { UserError, handle: <A extends unknown[]>(fn: (...a: A) => unknown) => fn, requireApiUser: async () => ({ id: "u1", email: "Ali@x.co" }) };
});
vi.mock("@/lib/launch", () => ({ isPublicOpen: async () => false }));
vi.mock("@/lib/coins", async (orig) => ({
  ...(await orig<typeof import("@/lib/coins")>()),
  giftCoinsOnce: async (user: string, halalas: number, ref: string, label: string) => {
    if (h.failGift) throw new Error("wallet down");
    if (h.gifts.some((g) => g.user === user && g.ref === ref)) return false;
    h.gifts.push({ user, halalas, ref, label });
    return true;
  },
}));
vi.mock("@/lib/access", async (orig) => ({
  ...(await orig<typeof import("@/lib/access")>()),
  forgetAccess: () => {},
  hasAnyAccess: async () => true,
  perksOf: async () => h.perks ?? { atCost: false, claudeModel: null, videoGens: null },
}));

describe("entering the code", () => {
  const seed = () => {
    const f = fakeDb();
    h.db = f.db;
    h.gifts = [];
    h.failGift = false;
    f.tables.site_code_uses = [];
    f.tables.site_codes = [{ id: "c1", label: "ضيوف زهراء", code: "zahra", perms: ["film", "video"], expires_at: null, valid_hours: null, max_uses: 30, enabled: true, unlimited: false, gift_sar: 35, at_cost: true, claude_model: "opus", video_gens: 2 }];
    return f;
  };
  const enter = async (codeText = "zahra") => {
    const { POST } = await import("@/app/api/access/code/route");
    const res = (await POST(new Request("http://x/api/access/code", { method: "POST", body: JSON.stringify({ code: codeText }) }))) as Response;
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };

  it("puts 35 riyals (3500 halalas) in the wallet once, records it, and tells what the code gives", async () => {
    const f = seed();
    const first = await enter();
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ ok: true, first: true });
    expect(h.gifts).toEqual([{ user: "u1", halalas: 3500, ref: "code-gift:c1", label: "هدية كود «ضيوف زهراء»" }]);
    expect(f.tables.site_code_uses).toMatchObject([{ code_id: "c1", email: "ali@x.co", gifted_halalas: 3500 }]);
    expect((first.body.welcome as string[])[0]).toContain("¤35");
    // again: no second gift, no gift line
    const again = await enter();
    expect(again.body).toMatchObject({ first: false });
    expect(h.gifts).toHaveLength(1);
    expect((again.body.welcome as string[]).join(" ")).not.toContain("¤35");
    expect(f.tables.site_code_uses).toHaveLength(1);
  });

  it("if the wallet cannot take the gift, the entry is undone so the person can try again", async () => {
    const f = seed();
    h.failGift = true;
    await expect(enter()).rejects.toThrow("wallet down");
    expect(f.tables.site_code_uses).toHaveLength(0);
    h.failGift = false;
    expect((await enter()).body).toMatchObject({ first: true });
    expect(h.gifts).toHaveLength(1);
  });

  it("a code without a gift gives no money, and the people limit still holds", async () => {
    const f = seed();
    f.tables.site_codes[0] = { ...f.tables.site_codes[0], gift_sar: 0, max_uses: 1 };
    // someone else took the only place: a new person is refused, and nothing is given
    f.tables.site_code_uses.push({ code_id: "c1", email: "other@x.co", at: new Date().toISOString() });
    await expect(enter()).rejects.toThrow("أقصى عدد");
    expect(h.gifts).toHaveLength(0);
    expect(f.tables.site_code_uses).toHaveLength(1);
    // a place free, no gift: they are in, and no money moves
    f.tables.site_code_uses.length = 0;
    expect((await enter()).body).toMatchObject({ ok: true, first: true });
    expect(h.gifts).toHaveLength(0);
  });
});

describe("the Seedance 2.0 ceiling", () => {
  const SINCE = "2026-10-19T10:00:00.000Z";
  const setup = (cap: number | null) => {
    const f = fakeDb();
    h.db = f.db;
    h.perks = cap === null ? null : { atCost: true, claudeModel: "opus", videoGens: { cap, since: SINCE } };
    f.tables.film_projects = [{ id: "p1", user_id: "u1" }, { id: "p2", user_id: "someone-else" }];
    return f;
  };
  const user = { id: "u1", email: "ali@x.co" };

  it("counts the studio's and the film maker's generations together; failed ones and other people's do not count", async () => {
    const f = setup(2);
    const { requireSeedanceRoom, seedanceUsed } = await import("@/lib/access-perks");
    await expect(requireSeedanceRoom(user)).resolves.toBeUndefined();
    f.tables.jawad_jobs = [
      { id: "j1", user_id: "u1", generator_id: "byteplus-seedance-2-0", status: "succeeded", created_at: "2026-10-19T11:00:00.000Z" },
      { id: "j2", user_id: "u1", generator_id: "byteplus-seedance-2-0", status: "failed", created_at: "2026-10-19T11:05:00.000Z" },
      { id: "j3", user_id: "u1", generator_id: "byteplus-seedance-2-5", status: "succeeded", created_at: "2026-10-19T11:10:00.000Z" },
      { id: "j4", user_id: "u1", generator_id: "byteplus-seedance-2-0", status: "succeeded", created_at: "2026-10-18T11:00:00.000Z" },
      { id: "j5", user_id: "u2", generator_id: "byteplus-seedance-2-0", status: "succeeded", created_at: "2026-10-19T11:00:00.000Z" },
    ];
    expect(await seedanceUsed("u1", SINCE)).toBe(1);
    await expect(requireSeedanceRoom(user)).resolves.toBeUndefined();
    f.tables.film_assets = [
      { id: "a1", project_id: "p1", kind: "video", status: "generated", meta: { model: "seedance-2.0" }, created_at: "2026-10-19T12:00:00.000Z" },
      { id: "a2", project_id: "p1", kind: "video", status: "failed", meta: { model: "seedance-2.0" }, created_at: "2026-10-19T12:01:00.000Z" },
      { id: "a3", project_id: "p1", kind: "video", status: "generated", meta: { model: "seedance-2.5" }, created_at: "2026-10-19T12:02:00.000Z" },
      { id: "a4", project_id: "p2", kind: "video", status: "generated", meta: { model: "seedance-2.0" }, created_at: "2026-10-19T12:03:00.000Z" },
      { id: "a5", project_id: "p1", kind: "image", status: "generated", meta: { model: "seedance-2.0" }, created_at: "2026-10-19T12:04:00.000Z" },
    ];
    expect(await seedanceUsed("u1", SINCE)).toBe(2);
    await expect(requireSeedanceRoom(user)).rejects.toThrow(/توليدان.*استعملت 2/);
  });

  it("no ceiling = nothing to check; a ceiling of zero closes it", async () => {
    setup(null);
    const { requireSeedanceRoom } = await import("@/lib/access-perks");
    await expect(requireSeedanceRoom(user)).resolves.toBeUndefined();
    setup(0);
    await expect(requireSeedanceRoom(user)).rejects.toThrow(/غير متاح/);
  });

  it("is checked before a Seedance 2.0 job or film video starts, and not for the owner", () => {
    const jobs = read("src/lib/jawad/server/jobs.ts");
    expect(jobs).toContain("def.id === SEEDANCE_20_GENERATOR && !owner");
    expect(jobs.indexOf("requireSeedanceRoom(user)")).toBeLessThan(jobs.indexOf("const rt = await loadRuntime()"));
    const film = read("src/lib/film/director.ts");
    expect(film).toContain('model === "seedance-2.0" && !isAdmin(user.email)');
  });
});

describe("the dashboard and the database", () => {
  it("migration 0083 adds the gift columns and nothing else; the owner can set them when making a code and later", () => {
    const sql = read("supabase/migrations/0083_code_gifts.sql");
    for (const c of ["gift_sar integer not null default 0", "at_cost boolean not null default false", "claude_model text", "video_gens integer", "gifted_halalas integer not null default 0"]) expect(sql).toContain(c);
    expect(sql).not.toMatch(/drop\s/i);
    const api = read("src/app/api/admin/access/route.ts");
    expect(api).toContain("giftSar");
    expect(api).toContain("codes_set");
    // the gift columns are sent only when a gift is set, so an old database still makes ordinary codes
    expect(api).toContain("...(hasGift ? g : {})");
    const ui = read("src/app/admin/access/Codes.tsx");
    for (const t of ["هدية الكود", "نقاط تنزل في حسابه", "أعلى موديل كلاود", "توليدات Seedance 2.0", "ربحك صفر", "تعديل الهدية", "المجموع لـ"]) expect(ui).toContain(t);
  });

  it("the person sees what the code gave before the page reloads, with the coin drawn by the shared component", () => {
    const gate = read("src/components/SecretGate.tsx");
    expect(gate).toContain("welcome");
    expect(gate).toContain("<Coined text={l}");
    expect(read("src/app/admin/access/Codes.tsx")).toContain("<Coined text={l}");
  });
});
