import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { chapterSig, contentKey, isWritten, keepsPlan, keptChapters, pagesAsked, questionsNamed, settingsChange } from "@/lib/jawad/student/keep";
import { resizeTargets } from "@/lib/jawad/student/pages";
import { askJson } from "@/lib/jawad/student/claude";
import { understandCeiling } from "@/lib/jawad/student/understand";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

// The owner: «لو سوى ملخص ١٣ صفحة بعدين غير يبيه ١٤ صفحة تخيل يروح يعيد كل شي تماما!!» — a change pays only for what it changes.

const design = { main: "editorial", roles: {}, fonts: { heading: "readex", body: "plex", accent: "amiri" }, custom: null, frame: true };
const summary = { pages: 13, page: "A4", density: "medium", format: "pdf", pictures: "", design, extra: "" };
const plan = (n: number) => ({ title: "t", subtitle: "s", chapters: Array.from({ length: n }, (_, i) => ({ title: `ف${i}`, purpose: `p${i}`, segments: [`s${i}`], image: {} })) });

describe("what a changed setting needs", () => {
  it("a page count changed (13 → 14) keeps the plan and the text: the file is only fitted", () => {
    expect(settingsChange("summary", summary, { ...summary, pages: 14 }, plan(6))).toBe("fit");
    // the page size too
    expect(settingsChange("summary", summary, { ...summary, page: "A5" }, plan(6))).toBe("fit");
  });

  it("the design, the fonts, the frame, PDF / Word, numbering only print the same text again", () => {
    expect(settingsChange("summary", summary, { ...summary, design: { ...design, main: "bento" } }, plan(6))).toBe("render");
    expect(settingsChange("summary", summary, { ...summary, design: { ...design, frame: false } }, plan(6))).toBe("render");
    expect(settingsChange("summary", summary, { ...summary, format: "both" }, plan(6))).toBe("render");
    expect(settingsChange("summary", summary, { ...summary, numbered: false }, plan(6))).toBe("render");
  });

  it("what is written (density, special requests) is planned and written again", () => {
    expect(settingsChange("summary", summary, { ...summary, density: "high" }, plan(6))).toBe("content");
    expect(settingsChange("summary", summary, { ...summary, extra: "ركّز على التعاريف" }, plan(6))).toBe("content");
    // a printing change together with a content change is the content path
    expect(settingsChange("summary", summary, { ...summary, density: "low", pages: 14 }, plan(6))).toBe("content");
  });

  it("nothing changed when only empty values and hidden settings differ (the page's defaults, the plan's measure)", () => {
    const { pictures: _p, extra: _e, ...bare } = summary;
    void _p;
    void _e;
    expect(settingsChange("summary", bare, { ...summary, _capacity: { verdict: "fits" }, _wordScale: 1.2 }, plan(6))).toBe("none");
    // the keys in another order are the same settings
    expect(settingsChange("summary", summary, Object.fromEntries(Object.entries(summary).reverse()), plan(6))).toBe("none");
  });

  it("a page count whose plan no longer fits (20 chapters into 3 pages) is planned again", () => {
    expect(keepsPlan(plan(20), 3)).toBe(false);
    expect(settingsChange("summary", { ...summary, pages: 30 }, { ...summary, pages: 3 }, plan(20))).toBe("content");
    expect(keepsPlan(plan(3), 0)).toBe(true);
  });

  it("«حيدرا ماكس» designs with Claude: any change there stays the full path", () => {
    const max = { ...summary, maker: "max" };
    expect(settingsChange("summary", max, { ...max, pages: 14 }, plan(6))).toBe("content");
    expect(settingsChange("summary", summary, { ...summary, maker: "max" }, plan(6))).toBe("content");
  });

  it("slides from the template only print again; slides drawn as pictures are drawn again", () => {
    const slides = { count: 10, density: "medium", design, aspect: "16:9" };
    expect(settingsChange("slides", slides, { ...slides, aspect: "4:3" })).toBe("render");
    expect(settingsChange("slides", { ...slides, render: "image" }, { ...slides, render: "image", design: { ...design, main: "bento" } })).toBe("content");
    expect(settingsChange("slides", slides, { ...slides, count: 12 })).toBe("content");
  });

  it("the writing key ignores what only prints", () => {
    expect(contentKey("summary", summary)).toBe(contentKey("summary", { ...summary, pages: 20, format: "docx", design: { ...design, main: "bento" } }));
    expect(contentKey("summary", summary)).not.toBe(contentKey("summary", { ...summary, density: "high" }));
  });

  it("knows when the text is all written", () => {
    expect(isWritten("summary", plan(2), { chapters: [{ blocks: [] }, { blocks: [] }] }, true)).toBe(true);
    expect(isWritten("summary", plan(2), { chapters: [{ blocks: [] }, null] }, true)).toBe(false);
    expect(isWritten("quiz", { rows: [1, 2] }, { rowsDone: 2 }, true)).toBe(true);
    expect(isWritten("quiz", { rows: [1, 2] }, { rowsDone: 1 }, true)).toBe(false);
    expect(isWritten("slides", { slides: [] }, null, true)).toBe(true);
  });
});

describe("chapters kept across a new plan", () => {
  const base = { purpose: "يشرح الخلية", segments: ["a1", "a2"], texts: ["نص ١", "نص ٢"], rules: "level", settings: contentKey("summary", summary) };

  it("a chapter's signature is what it is written from — not its title", () => {
    expect(chapterSig(base)).toBe(chapterSig({ ...base }));
    expect(chapterSig(base)).not.toBe(chapterSig({ ...base, texts: ["نص ١ مصحّح", "نص ٢"] }));
    expect(chapterSig(base)).not.toBe(chapterSig({ ...base, segments: ["a1"] , texts: ["نص ١"] }));
    expect(chapterSig(base)).not.toBe(chapterSig({ ...base, settings: contentKey("summary", { ...summary, density: "high" }) }));
  });

  it("keeps the unchanged chapters under their new titles, leaves the changed ones to write", () => {
    const old = { chapters: [{ title: "قديم ١", blocks: [1], sig: "A" }, { title: "قديم ٢", blocks: [2], sig: "B" }] };
    const kept = keptChapters(old, ["B", "X", "A"], ["جديد ١", "جديد ٢", "جديد ٣"])!;
    expect(kept[0]).toEqual({ title: "جديد ١", blocks: [2], sig: "B" });
    expect(kept[1]).toBeNull();
    expect(kept[2]).toEqual({ title: "جديد ٣", blocks: [1], sig: "A" });
    // nothing to keep (or chapters written before signatures) — the plan starts empty as before
    expect(keptChapters(old, ["X"], ["ج"])).toBeNull();
    expect(keptChapters({ chapters: [{ title: "x", blocks: [] }] }, ["A"], ["ج"])).toBeNull();
  });

  it("a renamed chapter in a plan edited by hand keeps its text (plan_save)", () => {
    const actions = read("src/lib/jawad/student/actions.ts");
    const at = actions.indexOf('case "plan_save"');
    const block = actions.slice(at, at + 1500);
    expect(block).toContain("keepWritten(c, o, stampSigs(c, o, o.content as Doc, o.plan as DocPlan), plan as DocPlan)");
    expect(block).not.toContain("content: null }");
  });

  it("the plan step keeps what it can, and every written chapter carries its signature", () => {
    const outputs = read("src/lib/jawad/student/outputs.ts");
    expect(outputs).toContain("const content = keepWritten(c, o, o.content as Doc | null, plan);");
    expect(outputs).toContain("doc.chapters[0] = { ...r.chapter, sig: docChapterSig(c, o, plan.chapters[0]) };");
    expect(outputs).toContain("doc.chapters[i] = { ...r.chapter, sig: doc.chapters[i]?.sig ?? docChapterSig(c, o, plan.chapters[i]) };");
  });
});

describe("a page count missed by the type: one or two chapters, not all", () => {
  it("13 → 14 pages: the chapter with the most material grows, the others stay", () => {
    // six chapters of ~600 words; about one page (300 words) more is needed
    const words = [600, 600, 600, 600, 600, 600];
    const weights = [1000, 5000, 1000, 1000, 1000, 1000];
    const t = resizeTargets(words, weights, 1 + 300 / 3600);
    expect(t).toEqual([{ i: 1, words: 900 }]);
  });

  it("a bigger miss takes as few chapters as absorb it (at most half of each)", () => {
    const t = resizeTargets([600, 600, 600, 600], [4, 3, 2, 1], 1 - 500 / 2400);
    expect(t.map((x) => x.i)).toEqual([0, 1]);
    expect(t.reduce((s, x) => s + x.words, 0)).toBe(1200 - 500);
  });

  it("a miss too big for that is shared by every chapter, as before", () => {
    const t = resizeTargets([500, 500], [1, 1], 2);
    expect(t).toEqual([{ i: 0, words: 1000 }, { i: 1, words: 1000 }]);
    expect(resizeTargets([500, 500], [1, 1], 1.01)).toEqual([]);
  });

  it("the final step fits with targets, and holds only what that can cost", () => {
    const outputs = read("src/lib/jawad/student/outputs.ts");
    expect(outputs).toContain("const targets = resizeTargets(now, plan.chapters.map((ch) => segChars(c, ch.segments)), ratio);");
    // the old way rewrote every chapter with a new word scale
    expect(outputs).not.toContain("_wordScale: Math.round(k * 1000) / 1000");
    expect(outputs).toContain("Math.min(all, biggest * MAX_REFITS)");
    // already-written chapters (kept, or the trial's) are never priced again
    expect(outputs).toContain("(written[i] ? 0 : chapterUsd(i))");
  });
});

describe("the server takes the cheap path", () => {
  const actions = read("src/lib/jawad/student/actions.ts");

  it("a printing or page change keeps the plan and the chapters and only makes the file again", () => {
    const at = actions.indexOf('case "settings"');
    const block = actions.slice(at, at + 5000);
    expect(block).toContain("settingsChange(o.kind, cleanSettings(o.kind, o.settings), cleanSettings(o.kind, next), o.plan)");
    expect(block).toContain('if (change === "none") return { ok: true, change };');
    expect(block).toContain('await saveOutput(o.id, { settings: next, status: "ready", approved: false, error: null });');
    // the design is picked again only when the wishes changed
    expect(block).toContain("stable(wish) !== stable(wishOf(o.settings.design))");
  });

  it("«اجعله ١٤ صفحة» changes the count and fits the same text", () => {
    expect(actions).toContain("pagesAsked(note, pagesOf(o.settings)");
    expect(actions).toContain('return run("final", await estimateParts(user.id, { ...o, settings }, "final")');
  });

  it("CapacityAsk keeps the plan when its chapters suit the new number (no charge)", () => {
    const ask = read("src/components/jawad/student/CapacityAsk.tsx");
    expect(ask).toContain("keepsPlan(o.plan, c.best)");
    expect(ask).toContain("نفس الخطة، بلا كلفة");
  });

  it("the page says the truth: «ينصنع من جديد… ويُخصم بسعره» only for a change to what is written", () => {
    const panel = read("src/components/jawad/student/OutputPanel.tsx");
    const at = panel.indexOf("function changeLine");
    const block = panel.slice(at, at + 1800);
    expect(block).toContain('if (change === "content") return `ينصنع من جديد');
    expect(block).toContain("بدون كتابة جديدة");
    expect(panel).not.toContain('<p className="text-xs text-jw-faint">ينصنع من جديد بإعداداتك الجديدة، ويُخصم بسعره. ملفاتك الحالية تبقى لين تجهز الجديدة.</p>');
  });
});

describe("requests that are only about the length", () => {
  it("reads the page count asked for", () => {
    expect(pagesAsked("اجعله ١٤ صفحة", 13)).toBe(14);
    expect(pagesAsked("خله ١٤ صفحة بدل ١٣", 13)).toBe(14);
    expect(pagesAsked("make it 14 pages", 13)).toBe(14);
    expect(pagesAsked("أبيه صفحتين", 5)).toBe(2);
    expect(pagesAsked("خله صفحة وحدة", 5)).toBe(1);
    expect(pagesAsked("أقصر", 10)).toBe(8);
    expect(pagesAsked("خله أطول شوي", 10)).toBe(12);
  });

  it("leaves anything else to the normal revision", () => {
    expect(pagesAsked("اجعله ١٤ صفحة وأضف أمثلة", 13)).toBeNull();
    expect(pagesAsked("عدّل الفصل ٣", 13)).toBeNull();
    expect(pagesAsked("أقصر", 0)).toBeNull();
    expect(pagesAsked("اشرح الفكرة الثانية بتفصيل أكثر لأنها ما كانت واضحة أبد في الملف", 13)).toBeNull();
  });
});

describe("a quiz request that names its questions", () => {
  it("finds the questions named", () => {
    expect(questionsNamed("عدّل السؤال ٣ خله أسهل", 10)).toEqual([2]);
    expect(questionsNamed("الأسئلة ٢ و٥ غامضة", 10)).toEqual([1, 4]);
    expect(questionsNamed("س4 جوابه غلط", 10)).toEqual([3]);
    expect(questionsNamed("الأسئلة 2-4", 10)).toEqual([1, 2, 3]);
    expect(questionsNamed("السؤال 30", 10)).toEqual([]);
    // «درس ٣» is not a question; no number = the whole quiz as before
    expect(questionsNamed("في درس 3 فكرة ناقصة", 10)).toEqual([]);
    expect(questionsNamed("خل الأسئلة أصعب", 10)).toEqual([]);
  });

  it("only those are written again; the others stay", () => {
    const outputs = read("src/lib/jawad/student/outputs.ts");
    expect(outputs).toContain("if (only.length && !job.progress.rewritten)");
    expect(outputs).toContain("if (revising && !only.length && !job.progress.reset)");
    const actions = read("src/lib/jawad/student/actions.ts");
    expect(actions).toContain('estimateParts(user.id, o, "revise", -1, named)');
  });
});

describe("a plan asked again reads the material from the cache", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("the material goes first with a cache mark, the settings after it", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "x");
    const fetch = vi.fn(async () => new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: "{}" }], usage: { input_tokens: 1, output_tokens: 1 } })));
    vi.stubGlobal("fetch", fetch);
    await askJson({ system: "S", parts: [{ type: "text", text: "MATERIAL", cache: true }, { type: "text", text: "SETTINGS" }], schema: {} });
    const body = JSON.parse(String((fetch.mock.calls[0] as unknown as [string, { body: string }])[1].body));
    expect(body.messages[0].content[0]).toEqual({ type: "text", text: "MATERIAL", cache_control: { type: "ephemeral" } });
    expect(body.messages[0].content[1]).toEqual({ type: "text", text: "SETTINGS" });
  });

  it("the plans put the settings after the cached material and take the previous plan", () => {
    const outputs = read("src/lib/jawad/student/outputs.ts");
    expect(outputs).toContain("const material: StudentPart = { type: \"text\", text: `UNDERSTANDING:");
    expect(outputs).toContain("parts: [material, { type: \"text\", text: `${base}\\n\\nDensity:");
    expect(outputs).toContain("parts: [material, { type: \"text\", text: `${base}\\n\\n${rules}${again}` }]");
    const actions = read("src/lib/jawad/student/actions.ts");
    expect(actions).toContain('const previous = Boolean(o.plan) && (isPaged(o.kind) || ["slides", "quiz", "brochure"].includes(o.kind) || Boolean(note));');
  });
});

describe("a text corrected after it was understood", () => {
  it("is priced for the changed segments only (plus combining the notes)", () => {
    const t = { segments: Array.from({ length: 40 }, (_, i) => ({ id: `seg-${String(i).padStart(4, "0")}-xxxx`, label: `ص${i}`, text: "كلمة ".repeat(800) })) };
    const all = understandCeiling(t);
    const one = understandCeiling(t, new Set(t.segments.slice(1).map((s) => s.id.slice(0, 8))));
    // the reading of 39 unchanged segments is gone; the combining of all the notes stays
    expect(one).toBeLessThan(all / 2);
    expect(one).toBeGreaterThan(0);
  });

  it("re-reads only the segments that changed", () => {
    const u = read("src/lib/jawad/student/understand.ts");
    expect(u).toContain("export async function reusableNotes");
    expect(u).toContain("const kept = await reusableNotes(project.id, t);");
    const actions = read("src/lib/jawad/student/actions.ts");
    expect(actions).toContain("understandCeiling(t!.content, new Set(kept.map((n) => n.segment)))");
  });
});
