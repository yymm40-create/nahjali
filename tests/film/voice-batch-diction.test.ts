import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyDiction } from "@config/jawad/diction";

// «ولّد كل الجمل»: the lines' «النطق الدقيق» in ONE Claude call (a made-up Claude answers here).
const s = vi.hoisted(() => ({ calls: [] as { system: string; text: string; maxTokens: number }[], replies: [] as unknown[] }));
vi.mock("@/lib/film/anthropic", () => ({
  callClaudeJson: async (a: { system: string; turns: { content: string }[]; maxTokens: number }) => {
    s.calls.push({ system: a.system, text: a.turns[0].content, maxTokens: a.maxTokens });
    const reply = s.replies.shift() ?? {};
    if (reply instanceof Error) throw reply;
    return { data: reply, raw: "", usage: { input_tokens: 1, output_tokens: 1 } };
  },
  claudeCost: () => 0.03,
}));

const read = (p: string) => readFileSync(p, "utf8");
const A = { id: "GEN-01:0", text: "أنت جميلة يا سارة", note: "said by «علي» (alone)", label: "said by «علي»" };
const B = { id: "GEN-01:1", text: "كتب الدرس أمس", note: "said by «سارة» (alone)", label: "said by «سارة»" };
const C = { id: "GEN-02:0", text: "شكرا لك", note: "said by «علي» (alone)" };
const fixA = [{ i: 1, vocalized: "أَنْتِ", fem: true }];
const fixB = [{ i: 1, vocalized: "كُتِبَ", fem: false }];

describe("prepareSpeechBatch: many lines, one call", () => {
  beforeEach(() => {
    s.calls = [];
    s.replies = [];
  });

  it("reads all the lines in one call and gives each line exactly what the single path would make of the same fixes", async () => {
    const { prepareSpeechBatch } = await import("@/lib/jawad/server/diction");
    s.replies.push({ lines: [{ id: A.id, fixes: fixA }, { id: B.id, fixes: fixB }, { id: C.id, fixes: [] }] });
    const out = await prepareSpeechBatch([A, B, C], "precise", "the scenes");
    expect(s.calls).toHaveLength(1);
    const call = s.calls[0];
    // the same rules as one line, and the batch's own format
    expect(call.system).toMatch(/Words whose gender, person or number lives in a short vowel/);
    expect(call.system).toMatch(/SEVERAL LINES AT ONCE/);
    expect(call.system).toMatch(/"lines":\[\{"id"/);
    expect(call.text).toMatch(/^Note: the scenes/);
    expect(call.text).toContain(`LINE ${A.id} (said by «علي»)`);
    expect(call.text).toContain("WORDS:\n1:كتب 2:الدرس 3:أمس");
    // each line numbered from 1 by its own words
    expect(call.text).toContain("WORDS:\n1:شكرا 2:لك");
    const a = applyDiction(A.text, fixA, "precise");
    expect(out.get(A.id)).toMatchObject({ text: a.text, fixes: a.fixes, languageCode: "ar" });
    expect(out.get(B.id)!.text).toBe(applyDiction(B.text, fixB, "precise").text);
    expect(out.get(C.id)).toMatchObject({ text: C.text, fixes: [] });
    // the call's cost shared by the lines' words (4 + 3 + 2 words)
    const usd = [...out.values()].reduce((n, p) => n + p.usd, 0);
    expect(usd).toBeCloseTo(0.03, 10);
    expect(out.get(A.id)!.usd).toBeCloseTo((0.03 * 4) / 9, 10);
  });

  it("a line the reply got wrong (missing, or a word number it doesn't have) is checked alone — only that line", async () => {
    const { prepareSpeechBatch } = await import("@/lib/jawad/server/diction");
    s.replies.push({ lines: [{ id: A.id, fixes: fixA }, { id: B.id, fixes: [{ i: 9, vocalized: "x", fem: false }] }] }, { fixes: fixB }, { fixes: [] });
    const out = await prepareSpeechBatch([A, B, C], "spelled");
    expect(s.calls).toHaveLength(3);
    const singles = s.calls.slice(1);
    expect(singles.every((c) => !/SEVERAL LINES/.test(c.system) && /\{"fixes":\[/.test(c.system))).toBe(true);
    // B and C again, alone, each with its own note
    expect(singles.map((c) => c.text.split("\n")[0]).sort()).toEqual([`Note: ${B.note}`, `Note: ${C.note}`].sort());
    expect(out.get(A.id)!.text).toBe(applyDiction(A.text, fixA, "spelled").text);
    expect(out.get(B.id)!.text).toBe(applyDiction(B.text, fixB, "spelled").text);
    // its share of the batch, plus its own call
    expect(out.get(B.id)!.usd).toBeCloseTo((0.03 * 3) / 9 + 0.03, 10);
  });

  it("one line goes the single way; «كما كتبت» and a line without Arabic need no call", async () => {
    const { prepareSpeechBatch } = await import("@/lib/jawad/server/diction");
    s.replies.push({ fixes: fixA });
    const one = await prepareSpeechBatch([A, { id: "en", text: "Hello there" }], "precise");
    expect(s.calls).toHaveLength(1);
    expect(s.calls[0].system).not.toMatch(/SEVERAL LINES/);
    expect(s.calls[0].text).toMatch(/^Note: said by «علي» \(alone\)/);
    expect(one.get("en")).toEqual({ text: "Hello there", languageCode: undefined, fixes: [], usd: 0 });
    s.calls = [];
    const off = await prepareSpeechBatch([A, B], "off");
    expect(s.calls).toHaveLength(0);
    expect(off.get(B.id)!.text).toBe(B.text);
  });

  it("a long set is split by words, and a failed call says so (nothing half-prepared)", async () => {
    const { batchesOf, lineFixes, prepareSpeechBatch } = await import("@/lib/jawad/server/diction");
    const w = (n: number) => ({ words: Array.from({ length: n }) });
    expect(batchesOf([w(300), w(200), w(200), w(50)], 600).map((b) => b.map((x) => x.words.length))).toEqual([[300, 200], [200, 50]]);
    expect(batchesOf([w(1), w(1), w(1)], 600, 2)).toHaveLength(2);
    expect(lineFixes({ lines: [{ id: "a", fixes: [{ i: 2, vocalized: "x" }] }] }, "a", 2)).toEqual([{ i: 2, vocalized: "x" }]);
    expect(lineFixes({ lines: [{ id: "a", fixes: [{ i: 3, vocalized: "x" }] }] }, "a", 2)).toBeNull();
    expect(lineFixes({ lines: [{ id: "a", fixes: "no" }] }, "a", 2)).toBeNull();
    expect(lineFixes({}, "a", 2)).toBeNull();
    s.replies.push(new Error("busy"));
    await expect(prepareSpeechBatch([A, B], "precise")).rejects.toThrow("busy");
  });
});

describe("the film's voices page: speak all = prepare once, then each line", () => {
  it("a prepared line is sealed to its line, unchanged and fresh", async () => {
    const { openPrepared, sealPrepared } = await import("@/lib/film/voices");
    const spoken = { text: "/ʔanti/ جميلة", languageCode: "ar", fixes: [{ i: 1, word: "أنت", vocalized: "أَنْتِ", sent: "/ʔanti/" }] };
    const t = sealPrepared("p1", "GEN-01:0", "أنت جميلة", "precise", spoken, 1000);
    expect(openPrepared(t, "p1", "GEN-01:0", "أنت جميلة", "precise", 2000)).toEqual({ ...spoken, usd: 0 });
    // another project, line, wording or mode; expired; changed on the way
    expect(openPrepared(t, "p2", "GEN-01:0", "أنت جميلة", "precise", 2000)).toBeNull();
    expect(openPrepared(t, "p1", "GEN-01:1", "أنت جميلة", "precise", 2000)).toBeNull();
    expect(openPrepared(t, "p1", "GEN-01:0", "أنتِ جميلة", "precise", 2000)).toBeNull();
    expect(openPrepared(t, "p1", "GEN-01:0", "أنت جميلة", "spelled", 2000)).toBeNull();
    expect(openPrepared(t, "p1", "GEN-01:0", "أنت جميلة", "precise", 1000 + 3 * 3600_000)).toBeNull();
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), t: "something else" })).toString("base64url");
    expect(openPrepared(`${forged}.${sig}`, "p1", "GEN-01:0", "أنت جميلة", "precise", 2000)).toBeNull();
    expect(openPrepared(undefined, "p1", "GEN-01:0", "أنت جميلة", "precise", 2000)).toBeNull();
  });

  it("the pages prepare a group in one request and send each line its prepared text; the route reads it", () => {
    for (const p of ["src/app/film/[id]/voices/VoicesWorkspace.tsx", "src/app/film/[id]/videos/VideosWorkspace.tsx"]) {
      const page = read(p);
      expect(page).toMatch(/prepareLines\(/);
      expect(page).toMatch(/prepared\[key\] \? \{ prepared: prepared\[key\] \}/);
      expect(page).toMatch(/model: claude\.id/);
    }
    const route = read("src/app/api/film/projects/[id]/voices/route.ts");
    expect(route).toMatch(/b\.action === "prepare"[^\n]*withClaude\(model, \(\) => prepareLines\(project, user, b\.keys, b\.idempotencyKey, b\.diction\)\)/);
    expect(route).toMatch(/b\.diction, b\.prepared\)/);
    const lib = read("src/lib/film/voices.ts");
    // a prepared line is spoken without a check (or a hold) of its own
    expect(lib).toMatch(/prepared \?\? await prepareSpeech\(line\.line/);
    expect(lib).toMatch(/diction !== "off" && !prepared/);
  });
});

describe("the person's model reaches the robots of these pages", () => {
  it("every page sends model: claude.id, and the routes read it", () => {
    for (const p of [
      "src/components/jawad/studio/Studio.tsx",
      "src/components/jawad/studio/SmartEdit.tsx",
      "src/components/jawad/editor/SmartFix.tsx",
      "src/components/jawad/zaynab/ZaynabStudio.tsx",
      "src/components/jawad/cartoon/CartoonStudio.tsx",
      "src/components/jawad/cartoon/FilmPanel.tsx",
      "src/app/film/new/NewProject.tsx",
      "src/app/film/series/NewSeries.tsx",
      "src/app/film/JourneyUpgrade.tsx",
      "src/app/film/VoiceDesigner.tsx",
      "src/app/film/[id]/voices/VoicesWorkspace.tsx",
    ]) {
      const src = read(p);
      expect(src, p).toMatch(/useClaudeModel\(\)/);
      expect(src, p).toMatch(/model: (claude\.id|ctx\.model)/);
    }
    expect(read("src/app/api/jawad/director/route.ts")).toMatch(/withFixedPriceClaude\(body\.model/);
    expect(read("src/app/api/jawad/zaynab/route.ts")).toMatch(/withFixedPriceClaude\(body\.model/);
    expect(read("src/app/api/jawad/cartoon/route.ts")).toMatch(/direct\(input, body\.model\)/);
    expect(read("src/app/api/jawad/edit/understand/route.ts")).toMatch(/robotTurn\(user, body\.model/);
    expect(read("src/app/api/film/intake/route.ts")).toMatch(/robotTurn\(user, body\.model/);
    expect(read("src/lib/jawad/server/smart-edit.ts")).toMatch(/findClaudeModel\(b\.model\) \? \{ claude: String\(b\.model\) \}/);
  });

  it("a studio speech job keeps the requester's model and runs «النطق الدقيق» on it (never dearer than its fixed price)", () => {
    const jobs = read("src/lib/jawad/server/jobs.ts");
    expect(jobs).toMatch(/def\.output === "audio" && findClaudeModel\(b\.model\) \? \{ claude: String\(b\.model\) \}/);
    expect(jobs).toMatch(/withFixedPriceClaude\(job\.inputs\.claude, \(\) => prepareSpeech\(job\.prompt, diction\)\)/);
  });
});
