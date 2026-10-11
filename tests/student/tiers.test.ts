import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TIERS, tierReached } from "@/components/jawad/student/StartTiers";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const dir = "src/components/jawad/student";

// «خل صفحة كتابة المعلومات (المادة والغرض والمستوى) وصفحة سحب الملفات كلها في صفحة واحدة في البداية، وصفحة التفريغ
// معهم، كلهم في صفحة واحدة بس زي المراتب» — and the Islamic question was seen only by whoever went the files way.
describe("«الطالب الذكي» — the first page is ONE page of tiers", () => {
  // «لا تخليه من البداية يختار ثانوي جامعي… اسم المادة ويحط الملف حقه… بعدين يفرغ… يعتمد الفهم بعدين النواتج مباشرة»
  it("has the material (its name and its content) and the understanding as two tiers, in that order", () => {
    expect(TIERS.map((t) => t.id)).toEqual(["sources", "understanding"]);
    expect(TIERS.map((t) => t.n)).toEqual([1, 2]);
    // the material tier starts with the subject's name; no school level, audience or purpose any more
    const brief = read(`${dir}/BriefStep.tsx`);
    expect(brief).toContain("اسم المادة");
    for (const gone of ["المستوى التعليمي", "وش غرضك منها", "لمن؟"]) expect(brief, gone).not.toContain(gone);
    const home = read(`${dir}/StudentHome.tsx`);
    for (const gone of ["المستوى التعليمي", "وش غرضك منها", "لمن؟ (اختياري)"]) expect(home, gone).not.toContain(gone);
    expect(read(`${dir}/StartTiers.tsx`)).toContain("<BriefStep p={p} />");
    // and the material tier is where the files, the paste and the transcription of a video are
    const sources = read(`${dir}/SourcesStep.tsx`);
    for (const piece of ["اسحب ملفاتك هنا", "فرّغ الكلام", "فرّغ الرابط", "الصق نصًا"]) expect(sources, piece).toContain(piece);
  });

  it("opens the tier the material has reached, locks the ones ahead, and folds the ones behind", () => {
    // StudentProject counts 1 material · 2 understanding · 3 outputs; the tiers are 0 material · 1 understanding
    expect(tierReached(0)).toBe(0);
    expect(tierReached(1)).toBe(0);
    expect(tierReached(2)).toBe(1);
    expect(tierReached(3)).toBe(2);
    expect(tierReached(9)).toBe(2);
    const tiers = read(`${dir}/StartTiers.tsx`);
    expect(tiers).toContain("const locked = i > at;");
    expect(tiers).toContain("disabled={locked}");
    expect(tiers).toContain("aria-expanded={isOpen}");
  });

  it("is one page in StudentProject: two steps (the tiers, then the outputs), not four pages", () => {
    const project = read(`${dir}/StudentProject.tsx`);
    expect(project).toContain("<StartTiers");
    expect(project).toMatch(/const GROUPS = \[\s*\{ id: "start", label: "المادة"/);
    expect(project).toMatch(/\{ id: "outputs", label: "النواتج"/);
    // the old separate pages are not mounted from here any more
    for (const old of ["<BriefStep", "<SourcesStep", "<UnderstandingStep", "<ResearchRun"]) expect(project, old).not.toContain(old);
    // the tier the material moves to opens by itself when its stage changes
    expect(project).toContain("setOpen(step === \"outputs\" ? {} : { [step]: true })");
  });
});

describe("«الذكاء الإسلامي» in «الطالب الذكي» is for everyone, in every mode", () => {
  it("is its own component, used by the files step AND beside the research run", () => {
    expect(read(`${dir}/IslamicAsk.tsx`)).toContain('action: "ask_islamic"');
    expect(read(`${dir}/SourcesStep.tsx`)).toContain("<IslamicAsk");
    const tiers = read(`${dir}/StartTiers.tsx`);
    // the research way used to swap the whole page for a progress screen, and the question went with it
    const researchBranch = tiers.slice(tiers.indexOf("researching ? ("), tiers.indexOf("<SourcesStep"));
    expect(researchBranch).toContain("<ResearchRun");
    expect(researchBranch).toContain("<IslamicAsk");
  });

  it("is not behind any owner check on the page or on the server's action", () => {
    for (const f of [`${dir}/IslamicAsk.tsx`, `${dir}/StartTiers.tsx`, `${dir}/SourcesStep.tsx`]) {
      expect(read(f), f).not.toMatch(/isAdmin|isLeader|!owner|owner\s*&&|\bowner\s*\?/);
    }
    const action = read("src/lib/jawad/student/actions.ts");
    const at = action.indexOf('case "ask_islamic"');
    expect(action.slice(at, at + 600)).not.toMatch(/isAdmin|isLeader|!owner|owner\s*&&/);
  });

  it("is told to Claude as it is: on the material tier, in every mode", () => {
    const k = read("config/jawad/knowledge.ts");
    // the first page became three simple steps (#320); the question to «الذكاء الإسلامي» stays on the material step
    expect(k).toContain("THREE SIMPLE STEPS");
    expect(k).toContain("THE QUESTION TO «الذكاء الإسلامي» IS ON THE «المادة» TIER FOR EVERYONE AND IN EVERY MODE");
  });
});
