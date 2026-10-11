import { describe, expect, it } from "vitest";
import { readSermonAsk, sermonFocus, sermonSettings } from "@config/jawad/khateeb";
import { readBrief, RESEARCH_PREFIX } from "@config/jawad/student";
import { nextKhateeb } from "@/components/jawad/khateeb/next";
import type { OutputView, ProjectState } from "@/components/jawad/student/client";
import type { SermonPlan } from "@/lib/jawad/student/model";

const P1 = "11111111-1111-1111-1111-111111111111";
const S1 = "22222222-2222-2222-2222-222222222222";
const ASK = { topic: "الصبر في حياة السيدة زينب", goal: "أن الصبر قوة وموقف", occasion: "وفاة السيدة زينب", length: "short", format: "pdf", draftText: "", verse: null, tafsir: ["majma"], narrations: "", sourceIds: [], poetryIds: [P1], poems: "" };

describe("«الخطيب الذكي»: the preacher's request", () => {
  it("is read back checked, and is nothing without a topic", () => {
    expect(readSermonAsk(ASK)).toEqual(ASK);
    expect(readSermonAsk({ ...ASK, topic: "  " })).toBeNull();
    expect(readSermonAsk(null)).toBeNull();
    expect(readSermonAsk({ topic: "الكرم", length: "huge", format: "exe" })).toMatchObject({ length: "medium", format: "both", tafsir: ["majma"], poetryIds: [], sourceIds: [], verse: null });
  });
  it("keeps the verse the preacher gave, the tafsir he ticked, his own text and his chosen books", () => {
    const a = readSermonAsk({ ...ASK, draftText: "نص", verse: { surah: 33, from: 33, to: 33 }, tafsir: [], sourceIds: [S1, "not-an-id"], narrations: "رواية" })!;
    expect(a.verse).toEqual({ surah: 33, from: 33, to: 33 });
    expect(a.tafsir).toEqual([]);
    expect(a.sourceIds).toEqual([S1]);
    expect(sermonSettings(a)).toMatchObject({ draftText: "نص", verseSurah: 33, verseFrom: 33, narrations: "رواية", tafsir: "" });
    expect(readSermonAsk({ ...ASK, verse: { surah: 500, from: 1 } })!.verse).toBeNull();
  });
  it("is kept in the material's brief (and the student's brief has none)", () => {
    expect(readBrief({ mode: "research", sermon: ASK }).sermon).toEqual(ASK);
    expect(readBrief({ mode: "research" }).sermon).toBeUndefined();
  });
  it("gives the research its topic and goal, and the sermon its settings", () => {
    expect(sermonFocus(readSermonAsk(ASK)!)).toContain("الغاية منها: أن الصبر قوة وموقف");
    expect(sermonSettings(readSermonAsk(ASK)!)).toMatchObject({ topic: ASK.topic, goal: ASK.goal, length: "short", format: "pdf" });
  });
});

const sermon = (o: Partial<OutputView>, sp?: Partial<SermonPlan>): OutputView => ({
  id: "o1", kind: "sermon", ord: 0, title: "خطبة المنبر", settings: { topic: ASK.topic }, status: "plan_review", stale: false, dependsOn: null,
  plan: sp ? { sermon: { topics: [{ title: "t", idea: "i", kooriz: "k", verse: { surah: 2, from: 155, to: 155, ref: "البقرة ١٥٥", text: "…" } }], chosen: -1, tafsir: null, ...sp } } : null,
  planApproved: false, trial: null, trialCoins: 0, content: null, files: [], approved: false, requests: [], error: null, updatedAt: "", ...o,
});
const state = (stage: ProjectState["project"]["stage"], outputs: OutputView[] = [], more: Partial<ProjectState> = {}, ask: Record<string, unknown> = ASK): ProjectState =>
  ({
    project: { id: "p", title: "", level: "", audience: "", stage, text_version: 1, understanding_version: 1, research_version: 0, allow_additions: true, web_search: false, brief: readBrief({ mode: "research", sermon: ask }), expiresAt: "" },
    prices: { free: true, page: { high: 0, medium: 0 }, slide: { high: 0, medium: 0 }, map: { high: 0, medium: 0 } },
    sources: [], segments: [], coverage: { missing: [], duplicate: [], total: 0, approved: 0, complete: true }, textVersion: null, understanding: null, research: null, outputs, jobs: [], balance: null,
    ...more,
  }) as ProjectState;
const label = (s: ProjectState) => nextKhateeb(s)?.label ?? null;

describe("«الخطيب الذكي»: the Sheikh's own journey, step by step", () => {
  it("researches the topic's text first, with nothing uploaded", () => {
    expect(label(state("sources"))).toBe("يبحث في نصوص الموضوع");
  });
  it("then reads what he wrote (the student's reading steps)", () => {
    const written = { sources: [{ id: "s", ord: 0, kind: "text", name: `${RESEARCH_PREFIX}: x`, mime: "text/plain", bytes: 1, pages: 1, pagesDone: 0, status: "ready", body: "" }] } as Partial<ProjectState>;
    expect(label(state("sources", [], written))).toBe("استخراج النص");
  });
  it("makes the sermon by itself once the text is understood (nothing to choose)", () => {
    expect(label(state("outputs"))).toBe("يجهّز الخطبة");
    expect(label(state("outputs", [sermon({ status: "settings", plan: null })]))).toBe("خطبة المنبر: إعداد الخطة");
  });
  it("reads the preacher's own sermon text instead of researching, when he gave one", () => {
    expect(label(state("sources", [], {}, { ...ASK, draftText: "نص خطبتي ".repeat(40) }))).toBe("يقرأ نصك");
  });
  it("takes the closest topic, then the tafsir, then the lines, then approves the plan", () => {
    expect(label(state("outputs", [sermon({}, {})]))).toBe("يعتمد موضوعك وآيته");
    expect(label(state("outputs", [sermon({}, { chosen: 0 })]))).toBe("يجيب التفسير من مجمع البيان");
    expect(label(state("outputs", [sermon({}, { chosen: 0, tafsirMissing: true })]))).toBe("يبحث عن الأبيات في مراجع الشعر");
    // no lines found is marked as an empty list: he goes on without them; the sources were not asked for
    expect(label(state("outputs", [sermon({}, { chosen: 0, tafsirMissing: true, poems: [] })]))).toBe("يعتمد خطة الخطبة");
  });
  it("searches the books he chose too", () => {
    expect(label(state("outputs", [sermon({}, { chosen: 0, tafsirMissing: true, poems: [] })], {}, { ...ASK, sourceIds: [S1] }))).toBe("يبحث عن القصص والروايات في كتب المكتبة");
  });
  it("waits while a job of the sermon is running", () => {
    const jobs = [{ id: "j", kind: "tafsir", outputId: "o1", status: "running", stage: "", progress: {}, error: null, coins: 0 }] as ProjectState["jobs"];
    expect(label(state("outputs", [sermon({}, { chosen: 0 })], { jobs }))).toBeNull();
  });
  it("writes the text, then WAITS for the preacher to approve it before the files are made", () => {
    expect(label(state("outputs", [sermon({ status: "ready", planApproved: true }, { chosen: 0 })]))).toBe("خطبة المنبر: التصنيع");
    // the written text (a draft) is shown to him: nothing moves on by itself, not even the approval
    expect(label(state("outputs", [sermon({ status: "review", planApproved: true, content: { draft: true, chapters: [] } }, { chosen: 0 })]))).toBeNull();
    // the files, once he approved the text
    expect(label(state("outputs", [sermon({ status: "review", planApproved: true, content: { chapters: [] } }, { chosen: 0 })]))).toBe("خطبة المنبر: الاعتماد");
    expect(label(state("outputs", [sermon({ status: "done", planApproved: true }, { chosen: 0 })]))).toBeNull();
  });
});
