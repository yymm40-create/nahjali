import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { settingsLine, settingsParts } from "@/lib/jawad/student/summary";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

// «بعد ما اختار النواتج وحدد كل شي يقول لي اختار إعدادات كل واحد، يخليني أختار الصفحات مرة ثانية… اعتمد الاختيار اللي
// قبل»: the page count, the file type and the rest are chosen ONCE, on the outputs page, and an output's panel shows them
// as one line instead of asking again.
describe("what the student chose is shown as a line, not asked again", () => {
  it("says a written output's choices in the order they were asked", () => {
    expect(settingsLine("summary", { pages: 20, density: "high", format: "pdf", page: "A4" })).toBe("20 صفحة · مفصل · PDF");
    expect(settingsLine("explain", { pages: 0, density: "low", format: "docx" })).toBe("عدد الصفحات حسب المادة · مختصر · Word (DOCX) قابل للتعديل");
    expect(settingsParts("book", { writing: "summary", pages: 40, density: "medium", format: "both" })).toEqual(["كتاب ملخص", "40 صفحة", "تفصيل متوسط", "الاثنين"]);
    // a book that is the text as it is has no page count or density to speak of
    expect(settingsParts("book", { writing: "verbatim", pages: 99, density: "high", format: "pdf" })).toEqual(["النص كامل كما هو", "PDF"]);
  });

  it("says slides', a quiz's and a recording's choices", () => {
    expect(settingsLine("slides", { count: 12, render: "image", notesMode: "notes", aspect: "4:3" })).toBe("12 شريحة · تُرسم صورًا · الشرح في ملاحظات المحاضر · 4:3");
    expect(settingsLine("slides", { count: 0, render: "editable", notesMode: "both", aspect: "16:9" })).toBe("عدد الشرائح حسب المادة · شرائح قابلة للتعديل · الشرح على الشريحة وفي الملاحظات · عريض 16:9");
    expect(settingsLine("quiz", { count: 10, difficulty: "hard", types: ["mcq", "tf", "short"], usage: "sheet" })).toBe("10 سؤالًا · صعب · اختيار متعدد + صح وخطأ + أسئلة قصيرة · ورقة أطبعها");
    expect(settingsLine("audio", { mode: "multi" })).toBe("ملف لكل قسم");
  });

  it("is quiet when there is nothing chosen (a chat), and never prints junk from a bad value", () => {
    expect(settingsLine("chat", {})).toBe("");
    expect(settingsLine("transcript", { pages: 5 })).toBe("");
    expect(settingsLine("quiz", { count: "x", difficulty: 7, types: ["nope", 3, null], usage: {} })).toBe("");
    expect(settingsLine("summary", { pages: "abc", density: "weird", format: "exe" })).toBe("عدد الصفحات حسب المادة · PDF");
  });
});

describe("an output's panel does not ask for the settings again", () => {
  const panel = read("src/components/jawad/student/OutputPanel.tsx");
  const at = panel.indexOf("{/* ───────── settings ───────── */}");
  const settings = panel.slice(at, panel.indexOf("{/* ───────── start ───────── */}"));

  it("folds the settings unless something failed or the student is changing them", () => {
    expect(settings).toContain('open={o.status === "failed" || settingsDirty}');
    // it used to open on every output that was still at «settings», which is every output the wizard had just made
    expect(settings).not.toContain('o.status === "settings" ||');
  });

  it("shows what was chosen in the folded line", () => {
    expect(panel).toContain('import { settingsLine } from "@/lib/jawad/student/summary"');
    expect(settings).toContain("✓ اخترتها:");
    expect(settings).toContain("settingsLine(o.kind, settings)");
  });

  it("still lets the student change it, and keeps the one button to go on right under it", () => {
    expect(settings).toContain("<KindSettings");
    expect(settings).toContain("احفظ الإعدادات");
    expect(panel).toContain('label={o.kind === "audio" ? "جهّز نص القراءة"');
  });

  it("creates every output from the wizard with the student's own answers, not with the defaults", () => {
    const outputs = read("src/components/jawad/student/OutputsStep.tsx");
    expect(outputs).toContain("outputs: pick.map((k) => ({ kind: k, settings: of(k) }))");
    const action = read("src/lib/jawad/student/actions.ts");
    expect(action).toMatch(/\.\.\.autoSettings\(kind, p\.level\), \.\.\.given/);
  });
});
