import { describe, expect, it } from "vitest";
import { readSermonAsk, sermonFocus, sermonSettings } from "@config/jawad/khateeb";
import { readBrief, RESEARCH_PREFIX } from "@config/jawad/student";
import { nextKhateeb } from "@/components/jawad/khateeb/next";
import type { OutputView, ProjectState } from "@/components/jawad/student/client";
import type { SermonPlan } from "@/lib/jawad/student/model";

const ASK = { topic: "الصبر في حياة السيدة زينب", goal: "أن الصبر قوة وموقف", occasion: "وفاة السيدة زينب", length: "short", format: "pdf", poems: "", poetry: true, sources: false };

describe("«الخطيب الذكي»: the preacher's request", () => {
  it("is read back checked, and is nothing without a topic", () => {
    expect(readSermonAsk(ASK)).toEqual(ASK);
    expect(readSermonAsk({ ...ASK, topic: "  " })).toBeNull();
    expect(readSermonAsk(null)).toBeNull();
    expect(readSermonAsk({ topic: "الكرم", length: "huge", format: "exe" })).toMatchObject({ length: "medium", format: "both", poetry: true, sources: true });
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
  it("takes the closest topic, then the tafsir, then the lines, then approves the plan", () => {
    expect(label(state("outputs", [sermon({}, {})]))).toBe("يعتمد موضوعك وآيته");
    expect(label(state("outputs", [sermon({}, { chosen: 0 })]))).toBe("يجيب التفسير من مجمع البيان");
    expect(label(state("outputs", [sermon({}, { chosen: 0, tafsirMissing: true })]))).toBe("يبحث عن الأبيات في مراجع الشعر");
    // no lines found is marked as an empty list: he goes on without them; the sources were not asked for
    expect(label(state("outputs", [sermon({}, { chosen: 0, tafsirMissing: true, poems: [] })]))).toBe("يعتمد خطة الخطبة");
  });
  it("searches the sources too when they were asked for", () => {
    expect(label(state("outputs", [sermon({}, { chosen: 0, tafsirMissing: true, poems: [] })], {}, { ...ASK, sources: true }))).toBe("يبحث عن القصص والشواهد في المصادر");
  });
  it("waits while a job of the sermon is running", () => {
    const jobs = [{ id: "j", kind: "tafsir", outputId: "o1", status: "running", stage: "", progress: {}, error: null, coins: 0 }] as ProjectState["jobs"];
    expect(label(state("outputs", [sermon({}, { chosen: 0 })], { jobs }))).toBeNull();
  });
  it("writes it, then approves it", () => {
    expect(label(state("outputs", [sermon({ status: "ready", planApproved: true }, { chosen: 0 })]))).toBe("خطبة المنبر: التصنيع");
    expect(label(state("outputs", [sermon({ status: "review", planApproved: true }, { chosen: 0 })]))).toBe("خطبة المنبر: الاعتماد");
    expect(label(state("outputs", [sermon({ status: "done", planApproved: true }, { chosen: 0 })]))).toBeNull();
  });
});
