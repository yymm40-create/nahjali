import { describe, expect, it } from "vitest";
import { WOMAN_WORDING } from "@config/content";
import { ARABIC_TEXT_RULES, CAROUSEL_TEMPLATES, designSystem } from "@config/content-templates";
import { FILM_STYLES } from "@config/film-styles";
import { DeskError, isTransientText } from "@/lib/content/jawad";
import { answerLine, DELEGATE_LINE, moodLine, motionLine, stripMarks, styleLine, templateLine } from "@/lib/content/marks";
import { readQuestions, readPending, cleanHistory } from "@/lib/content/chats";
import { catalogBlock, chosenBlock, chosenIds, motionCatalogBlock } from "@/lib/content/persona";
import { MOODS, MOTION_STYLES } from "@/lib/editor/motion-styles";
import { buildReport, isTransient, slidePrompt, UNCHECKED } from "@/lib/content/produce";
import { fixNote } from "@/lib/content/verify";

describe("a slide's prompt", () => {
  const base = { n: 3, total: 8, prompt: 'Slide content. Text: "مرحبا".', styleId: "", withRef: true };
  it("says where the slide stands, keeps Baqir's text, and adds the Arabic and dress rules", () => {
    const p = slidePrompt(base);
    expect(p).toContain("Slide 3 of 8");
    expect(p).toContain("slide 1");
    expect(p).toContain(base.prompt);
    expect(p).toContain(ARABIC_TEXT_RULES);
    expect(p).toContain(WOMAN_WORDING);
    expect(slidePrompt({ ...base, n: 1, withRef: false })).toContain("the first");
    expect(slidePrompt({ ...base, n: 1, withRef: true })).toContain("drawn again");
  });
  it("puts the chosen cartoon style in verbatim, for the drawings only, and nothing when none", () => {
    for (const s of FILM_STYLES) expect(slidePrompt({ ...base, styleId: s.id })).toContain(s.text);
    expect(slidePrompt({ ...base, styleId: FILM_STYLES[0].id })).toContain("not to the lettering layout");
    expect(slidePrompt(base)).not.toContain("ILLUSTRATION STYLE");
    expect(slidePrompt({ ...base, styleId: "unknown" })).not.toContain("ILLUSTRATION STYLE");
  });
  it("adds what the check found when a slide is drawn again", () => {
    const note = fixNote({ ok: false, checked: true, problems: ["حرف مقطوع"], woman: "violation", read: "", usd: 0 }, "عنوان الشريحة");
    expect(note).toContain("حرف مقطوع");
    expect(note).toContain('"عنوان الشريحة"');
    expect(note).toContain("plain fully black abaya");
    expect(slidePrompt({ ...base, fix: note })).toContain(note);
  });
});

describe("what the report tells", () => {
  const ok = { n: 1, fileId: "a", name: "slide-01", text: "t" };
  it("counts the sound ones, the ones drawn again, the flagged and the failed", () => {
    const r = buildReport({
      made: [ok, { ...ok, n: 2, fixed: true }, { ...ok, n: 3, flag: "حرف مقطوع في آخر الكلمة" }, { ...ok, n: 4, flag: UNCHECKED }],
      failed: [{ n: 5, reason: "المزوّد مشغول حاليًا", text: "", prompt: "" }],
      unchecked: 1,
    });
    expect(r).toContain("فحص ما بعد الرسم");
    expect(r).toContain("آلي");
    expect(r).toContain("لا يغني عن مراجعتك");
    expect(r).toContain("سليمة: 2 من 4");
    expect(r).toContain("أُعيد رسم 1 شريحة تلقائيًا");
    expect(r).toContain("الشريحة 3 (حرف مقطوع في آخر الكلمة)");
    expect(r).toContain("تعذّر الفحص الآلي لـ 1 شريحة");
    expect(r).toContain("الشريحة 5 (المزوّد مشغول حاليًا)");
    expect(r).not.toContain("الشريحة 4 (");
  });
  it("is short when everything is fine", () => {
    const r = buildReport({ made: [ok, { ...ok, n: 2 }], failed: [], unchecked: 0 });
    expect(r.split("\n")).toHaveLength(2);
    expect(r).toContain("سليمة: 2 من 2");
  });
});

describe("a refusal worth another try", () => {
  it("is a busy provider or a cut connection, not a policy refusal", () => {
    expect(isTransient(new DeskError("انقطع", "timeout", isTransientText("timeout")))).toBe(true);
    expect(isTransient(new DeskError("مشغول", "429 rate_limit_exceeded", isTransientText("429 rate_limit_exceeded")))).toBe(true);
    expect(isTransient(new DeskError("خطأ", "503 server error", isTransientText("503 server error")))).toBe(true);
    expect(isTransient(new DeskError("سياسة", "400 content_policy_violation", isTransientText("400 content_policy_violation")))).toBe(false);
    expect(isTransient(new Error("fetch failed"))).toBe(true);
    expect(isTransient(new Error("bad input"))).toBe(false);
  });
});

describe("the buttons and the galleries", () => {
  it("reads questions: at most 6, short labels, options only for a plain choice", () => {
    const q = readQuestions([
      { label: "المنصة؟", kind: "choice", options: ["انستغرام", " لينكدإن ", "", 5], multi: false },
      { label: "القالب؟", kind: "templates", options: ["x"], multi: true },
      { label: "", kind: "choice", options: ["a"] },
      { label: "بلا خيارات", kind: "choice", options: [] },
      { label: "الستايل؟", kind: "styles", options: [], multi: false },
    ]);
    expect(q).toEqual([
      { label: "المنصة؟", kind: "choice", options: ["انستغرام", "لينكدإن"], multi: false },
      { label: "القالب؟", kind: "templates", options: [], multi: false },
      { label: "الستايل؟", kind: "styles", options: [], multi: false },
    ]);
    expect(readQuestions([])).toBeUndefined();
    expect(readQuestions(Array.from({ length: 9 }, (_, i) => ({ label: `س${i}`, kind: "choice", options: ["a", "b"] })))).toHaveLength(6);
  });
  it("turns a pick into a message with a mark the server reads and the person never sees", () => {
    const t = templateLine({ id: "scrapbook", name: "دفتر قصاصات" });
    const s = styleLine({ id: "ghibli", name: "جيبلي" });
    expect(t).toBe("• القالب: «دفتر قصاصات» [قالب:scrapbook]");
    expect(s).toBe("• الستايل الكرتوني للصور: «جيبلي» [ستايل:ghibli]");
    expect(stripMarks(`${t}\n${s}`)).toBe("• القالب: «دفتر قصاصات»\n• الستايل الكرتوني للصور: «جيبلي»");
    expect(templateLine({ id: "none", name: "" })).toContain("[قالب:none]");
    expect(styleLine({ id: "none", name: "" })).toContain("[ستايل:none]");
    expect(answerLine("المنصة", ["انستغرام", "لينكدإن"])).toBe("• المنصة: انستغرام، لينكدإن");
    expect(DELEGATE_LINE).toContain("اختر أنت");
  });
  it("finds the last pick of each kind and tells him the full details of it", () => {
    const ids = chosenIds(["أبي كاروسيل", `${templateLine({ id: "minimal-clean", name: "بسيط نظيف" })}\n${styleLine({ id: "none", name: "" })}`, templateLine({ id: "scrapbook", name: "دفتر قصاصات" })]);
    expect(ids).toEqual({ template: "scrapbook", style: "none", motion: null, mood: null });
    expect(chosenIds(["لا شي"])).toEqual({ template: null, style: null, motion: null, mood: null });
    const t = CAROUSEL_TEMPLATES.find((x) => x.id === "scrapbook")!;
    const block = chosenBlock({ template: "scrapbook", style: "ghibli" });
    expect(block).toContain(t.name);
    expect(block).toContain(designSystem(t, 0));
    for (const p of t.palettes) expect(block).toContain(p.name);
    expect(block).toContain('"style_id"');
    expect(block).toContain("ghibli");
    expect(chosenBlock({ template: "none", style: "none" })).toContain("بدون قالب");
    expect(chosenBlock({ template: null, style: null })).toBe("");
  });
  it("lists all 24 templates and all 24 cartoon styles for him", () => {
    const c = catalogBlock();
    for (const t of CAROUSEL_TEMPLATES) expect(c).toContain(`- ${t.id} — ${t.name}`);
    for (const s of FILM_STYLES) expect(c).toContain(`- ${s.id} — ${s.name}`);
    expect(FILM_STYLES).toHaveLength(24);
  });
});

describe("what is kept with the conversation", () => {
  it("keeps the questions and the carousel's state, drops junk", () => {
    const h = cleanHistory([
      { role: "user", text: "أبي كاروسيل" },
      {
        role: "assistant",
        text: "تمام",
        questions: [{ label: "المنصة؟", kind: "choice", options: ["انستغرام"], multi: false }],
        slides: {
          aspect: "2:3",
          items: [{ n: 1, fileId: "f1", name: "slide-01", text: "t", flag: "حرف مقطوع", fixed: true }, { n: "x" }],
          todo: [2, 3, "x", -1],
          failed: [{ n: 4, reason: "مشغول", text: "t", prompt: "p", detail: "429" }],
          running: true,
          total: 4,
          styleId: "ghibli",
          templateId: "scrapbook",
          report: "تقرير",
        },
      },
    ]);
    expect(h[1].questions).toEqual([{ label: "المنصة؟", kind: "choice", options: ["انستغرام"], multi: false }]);
    expect(h[1].slides).toEqual({
      aspect: "2:3",
      items: [{ n: 1, fileId: "f1", name: "slide-01", text: "t", flag: "حرف مقطوع", fixed: true }],
      todo: [2, 3],
      failed: [{ n: 4, reason: "مشغول", detail: "429", text: "t", prompt: "p" }],
      running: true,
      total: 4,
      styleId: "ghibli",
      templateId: "scrapbook",
      report: "تقرير",
    });
    const p = readPending({ id: "x", aspect: "9:16", at: 2, mode: "fix", styleId: "ghibli", slides: [{ n: 3, text: "t", prompt: "p" }], made: [{ n: 3, fileId: "f", name: "n", text: "t" }], failed: [], carry: [{ n: 5, reason: "r", text: "t", prompt: "p" }] });
    expect(p?.mode).toBe("fix");
    expect(p?.made).toHaveLength(1);
    expect(p?.carry[0].n).toBe(5);
    expect(readPending({ slides: [] })).toBeNull();
  });
});

describe("the motion choices", () => {
  it("a pick of a skill or a mood carries a mark the server reads and the person never sees", () => {
    const line = `${motionLine({ id: "reel", name: "الريل السريع" })}\n${moodLine({ id: "sad", name: "الحزن" })}`;
    expect(stripMarks(line)).toBe("• مهارة الموشن: «الريل السريع»\n• مزاج الموشن: «الحزن»");
    expect(chosenIds(["أبي موشن", line])).toMatchObject({ motion: "reel", mood: "sad" });
    expect(chosenIds([motionLine({ id: "none", name: "" }), moodLine({ id: "none", name: "" })])).toMatchObject({ motion: "none", mood: "none" });
  });
  it("he is told the details of what was picked, and what to write in the storyboard", () => {
    const block = chosenBlock({ template: null, style: null, motion: "luxury", mood: "faith" });
    expect(block).toContain("الفخامة");
    expect(block).toContain('"style":"luxury"');
    expect(block).toContain("الخشوع");
    expect(block).toContain('"mood":"faith"');
    expect(chosenBlock({ template: null, style: null, motion: "none", mood: "none" })).toContain("اختر الأنسب");
  });
  it("he knows every skill and mood حيدرة has, and that حيدرة draws the backgrounds himself", () => {
    const text = motionCatalogBlock();
    for (const s of MOTION_STYLES.filter((x) => !x.talk)) expect(text).toContain(s.ar);
    for (const m of MOODS) expect(text).toContain(m.ar);
    expect(text).toContain("يرتب الخلفيات بنفسه");
    expect(text).toContain("GPT Image 2");
  });
  it("readQuestions keeps the two new galleries (with no options)", () => {
    expect(readQuestions([{ label: "المهارة؟", kind: "motion", options: ["x"], multi: true }, { label: "المزاج؟", kind: "moods", options: [], multi: false }])).toEqual([
      { label: "المهارة؟", kind: "motion", options: [], multi: false },
      { label: "المزاج؟", kind: "moods", options: [], multi: false },
    ]);
  });
});
