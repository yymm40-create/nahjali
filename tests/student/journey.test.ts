import { afterEach, describe, expect, it, vi } from "vitest";
import { briefLine, readBrief } from "@config/jawad/student";
import { nextAuto } from "@/components/jawad/student/autopilot";
import type { OutputView, ProjectState } from "@/components/jawad/student/client";
import { pickDesigns } from "@/lib/jawad/student/design-pick";
import type { Project } from "@/lib/jawad/student/db";

describe("the first page's brief", () => {
  it("reads what was stored, and falls back for old materials", () => {
    expect(readBrief(undefined)).toEqual({ purpose: "exam", purposeNote: "", mode: "files", focus: "" });
    expect(readBrief({ purpose: "teach", mode: "research", focus: "الخلية", purposeNote: "لطلاب صفي" })).toEqual({ purpose: "teach", purposeNote: "لطلاب صفي", mode: "research", focus: "الخلية" });
    expect(readBrief({ purpose: "hack", mode: "x" })).toMatchObject({ purpose: "exam", mode: "files" });
  });
  it("tells the writer the purpose", () => {
    expect(briefLine(readBrief({ purpose: "exam" }))).toContain("مراجعة للاختبار");
    expect(briefLine(readBrief({ purpose: "other", purposeNote: "مسابقة علمية" }))).toContain("مسابقة علمية");
  });
});

const output = (o: Partial<OutputView>): OutputView => ({
  id: "o1", kind: "summary", ord: 0, title: "ملخص", settings: { density: "low" }, status: "settings", stale: false, dependsOn: null, plan: null, planApproved: false,
  trial: null, trialCoins: 0, content: null, files: [], approved: false, requests: [], error: null, updatedAt: "", ...o,
});
const state = (stage: ProjectState["project"]["stage"], outputs: OutputView[] = []): ProjectState =>
  ({
    project: { id: "p", title: "", level: "", audience: "", stage, text_version: 1, understanding_version: 1, research_version: 0, allow_additions: true, web_search: false, brief: readBrief({}), expiresAt: "" },
    prices: { free: true, page: { high: 0, medium: 0 }, slide: { high: 0, medium: 0 } },
    sources: [], segments: [], coverage: { missing: [], duplicate: [], total: 0, approved: 0, complete: true }, textVersion: null, understanding: null, research: null, outputs, jobs: [], balance: null,
  }) as ProjectState;

describe("«ابدأ»: what runs by itself", () => {
  it("waits for the student to choose outputs (never chooses for them)", () => {
    expect(nextAuto(state("outputs"))).toBeNull();
  });
  it("plans, then makes, an output with the student's answers", () => {
    expect(nextAuto(state("outputs", [output({})]))?.label).toBe("ملخص: إعداد الخطة");
    expect(nextAuto(state("outputs", [output({ status: "plan_review", plan: {} })]))?.label).toBe("ملخص: اعتماد الخطة");
    expect(nextAuto(state("outputs", [output({ kind: "book", title: "كتاب", status: "trial_offer", plan: {}, planApproved: true })]))?.label).toBe("كتاب: تخطي التجربة");
  });
  it("draws the pages with GPT Image 2 after the text, when that was chosen", () => {
    expect(nextAuto(state("outputs", [output({ status: "done", settings: { pictures: "high" } })]))?.label).toBe("ملخص: رسم الصفحات بـ GPT Image 2");
    expect(nextAuto(state("outputs", [output({ status: "done", settings: { pictures: "high" }, files: ["pdf", "pictures_pdf"] })]))).toBeNull();
    expect(nextAuto(state("outputs", [output({ status: "done", settings: { pictures: "" } })]))).toBeNull();
  });
  it("tries a failed output again from where it stopped", () => {
    expect(nextAuto(state("outputs", [output({ status: "failed" })]))?.label).toBe("ملخص: إعادة إعداد الخطة");
    expect(nextAuto(state("outputs", [output({ status: "failed", plan: {}, planApproved: true })]))?.label).toBe("ملخص: إعادة التصنيع");
  });
});

describe("the design is Claude's choice", () => {
  const project = { id: "p", user_id: "u", title: "الخلية", level: "متوسط", audience: "", stage: "outputs", brief: { purpose: "exam" } } as unknown as Project;
  afterEach(() => vi.unstubAllGlobals());

  it("uses Claude's pick, its fonts, and passes the special request on", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "x");
    const picks = [{ kind: "book", style: "editorial", heading: "messiri", body: "markazi", accent: "amiri", custom: "", colors: { bg: "#ffffff", paper: "#ffffff", ink: "#000000", muted: "#555555", accent: "#aa0000", accent2: "#000000", line: "#dddddd" }, texture: "none", note: "ألوان هادئة" }];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ picks }) }], usage: { input_tokens: 1, output_tokens: 1 } }))));
    const r = await pickDesigns(project, ["book", "audio"], "الخلية", "ألوان هادئة");
    expect(r.designs.book).toEqual({ main: "editorial", roles: {}, fonts: { heading: "messiri", body: "markazi", accent: "amiri" }, custom: null });
    expect(r.designs.audio).toBeUndefined();
    expect(r.notes).toEqual({ book: "ألوان هادئة", audio: "ألوان هادئة" });
  });

  it("never stops the student when Claude can't answer", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await pickDesigns(project, ["slides", "summary"], "الخلية", "");
    expect(r.designs.slides.main).toBe("bento");
    expect(r.designs.summary.main).toBe("notebook");
  });
});
