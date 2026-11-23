import { describe, expect, it } from "vitest";
import { FILM_KINDS, filmKind, projectKind, readFilmKind } from "@config/film";
import { storyMessage } from "@/lib/film/script";
import { projectFields } from "@/lib/film/validate";
import type { FilmProject } from "@/lib/film/types";
import { adBrandLines, adDirectorNote, adSheetsNote } from "@config/film-ad";
import { normalizeAdPlan, readBrand } from "@/lib/film/intake";

// «الفيلم السينمائي غير … مشهد قصير من بره، فيلم سينمائي من داخل، أو مسلسل كامل»: what is being made is chosen at the
// start and the screenwriter is told, so a scene is never written as a film and a film is never written as one shot.
const project = (kind?: unknown): FilmProject =>
  ({ id: "p1", user_id: "u1", title: "الرسالة", story: "رجل يرجع لبيته بعد عشرين سنة.", fixed_facts: "", target_duration_sec: null, stage: "screenwriter", video_model: "seedance-2.5", created_at: "", updated_at: "", ...(kind === undefined ? {} : { kind }) }) as FilmProject;

describe("what is being made", () => {
  it("names five shapes, and the series has its own place", () => {
    expect(FILM_KINDS.map((k) => k.id)).toEqual(["scene", "film", "lesson", "ad", "series"]);
    expect(filmKind("ad")!.brief).toContain("تخطَّ المرحلة 2 والمرحلة 3");
    expect(filmKind("lesson")!.brief).toContain("تخطَّ المرحلة 2 والمرحلة 3");
    expect(filmKind("film")!.ar).toBe("فيلم سينمائي");
    expect(filmKind("nope")).toBeNull();
    // a scene and a film each carry what the screenwriter is told; the series is made elsewhere
    expect(filmKind("scene")!.brief.length).toBeGreaterThan(40);
    expect(filmKind("film")!.brief.length).toBeGreaterThan(40);
    expect(filmKind("series")!.brief).toBe("");
  });

  it("reads anything into a shape the maker can build, and never into a series", () => {
    expect(readFilmKind("film")).toBe("film");
    expect(readFilmKind("scene")).toBe("scene");
    for (const v of [undefined, null, "series", "", 7, {}, "FILM"]) expect(readFilmKind(v)).toBe("scene");
  });

  it("the create form keeps the choice, and only a real one", () => {
    expect(projectFields({ title: "ت", kind: "film" }, { requireTitle: true }).kind).toBe("film");
    expect(projectFields({ title: "ت", kind: "series" }, { requireTitle: true }).kind).toBe("scene");
    // no choice sent: the field is not written at all, so an old project keeps whatever it has
    expect("kind" in projectFields({ title: "ت" }, { requireTitle: true })).toBe(false);
  });

  it("the screenwriter is told the shape before the story", () => {
    const asFilm = storyMessage(project("film"));
    expect(asFilm.startsWith("نوع العمل: فيلم سينمائي")).toBe(true);
    expect(asFilm).toContain("مشاهد مرقّمة");
    expect(asFilm).toContain("رجل يرجع لبيته");
    const asScene = storyMessage(project("scene"));
    expect(asScene.startsWith("نوع العمل: مشهد قصير")).toBe(true);
    expect(asScene).toContain("يقف بنفسه");
    expect(asScene).not.toContain("مشاهد مرقّمة");
  });

  it("a project made before the choice existed is a scene, not a film", () => {
    expect(storyMessage(project()).startsWith("نوع العمل: مشهد قصير")).toBe(true);
    expect(storyMessage(project("series")).startsWith("نوع العمل: مشهد قصير")).toBe(true);
  });

  it("a lesson is kept as a scene and known by its intake's plan («🎓 درس لطلابك»)", () => {
    expect(projectFields({ title: "ت", kind: "lesson" }, { requireTitle: true }).kind).toBe("scene");
    expect(readFilmKind("lesson")).toBe("scene");
    const plan = { format: "model", question: "كيف يشتغل القلب؟", points: ["الحجرات الأربع"], audience: "الصف الرابع" };
    const intake = { title: "القلب", concept: "درس القلب", understanding: "فهمت", fixedFacts: [], targetDurationSec: 60, characters: [], places: [], scenePlan: [], episodePlan: [], questions: [], lesson: plan };
    expect(projectKind({ kind: "scene", intake })).toBe("lesson");
    expect(projectKind({ kind: "scene", intake: { ...intake, lesson: null } })).toBe("scene");
    expect(projectKind({ kind: "film" })).toBe("film");
    const msg = storyMessage({ ...project("scene"), workflow_version: 2, intake } as FilmProject);
    expect(msg.startsWith("نوع العمل: درس لطلابك")).toBe(true);
    expect(msg).toContain("الكلام مختصر جدًا");
    expect(msg).toContain("خطة الدرس المعتمدة:");
    expect(msg).toContain("مجسم ثلاثي الأبعاد يشتغل (model)");
    expect(msg).toContain("كيف يشتغل القلب؟");
  });

  it("an ad is kept as a scene and known by its intake's plan («📣 إعلان»), its brand's pictures sent as themselves", () => {
    expect(projectFields({ title: "ت", kind: "ad" }, { requireTitle: true }).kind).toBe("scene");
    expect(readFilmKind("ad")).toBe("scene");
    const plan = { brand: "شاي بوجبارة", product: "قمع V60", message: "حِرفية", audience: "", ending: "الشعار", imitate: "لقطة قريبة جدًا للأيدي، كاميرا ثابتة", reference: "رابط يوتيوب: https://youtu.be/x" };
    const intake = { title: "إعلان", concept: "إعلان القهوة", understanding: "فهمت", fixedFacts: [], targetDurationSec: 20, characters: [], places: [], scenePlan: [], episodePlan: [], questions: [], ad: plan };
    expect(projectKind({ kind: "scene", intake })).toBe("ad");
    expect(projectKind({ kind: "scene", intake: { ...intake, ad: null } })).toBe("scene");
    const brand = adBrandLines([{ role: "product", name: "", assetId: "11111111-1111-4111-8111-111111111111" }, { role: "logo", name: "logo.png", assetId: "22222222-2222-4222-8222-222222222222" }]);
    // grouped by role: the logo first
    expect(brand.indexOf("الشعار")).toBeLessThan(brand.indexOf("المنتج"));
    expect(brand).toContain("[[image:22222222-2222-4222-8222-222222222222]]");
    const msg = storyMessage({ ...project("scene"), workflow_version: 2, intake } as FilmProject, brand);
    expect(msg.startsWith("نوع العمل: إعلان")).toBe(true);
    expect(msg).toContain("خطة الإعلان المعتمدة");
    expect(msg).toContain("كاميرا ثابتة");
    expect(msg).toContain("[[image:11111111-1111-4111-8111-111111111111]]");
    // the director follows the reference ad: its frames and سجاد's reading
    const note = adDirectorNote({ imitate: plan.imitate, frames: ["33333333-3333-4333-8333-333333333333"], source: plan.reference });
    expect(note).toContain("[[image:33333333-3333-4333-8333-333333333333]]");
    expect(note).toContain("كاميرا ثابتة");
    expect(adDirectorNote({ imitate: "", frames: [], source: "" })).toBe("");
    // the sheet maker puts the logo and the products on their own items
    expect(adSheetsNote(brand)).toContain("LOG-01");
    expect(adSheetsNote(brand)).toContain("PRD-01");
  });

  it("an ad plan keeps only what was given, and the brand's pictures only with a known role", () => {
    expect(normalizeAdPlan(null)).toBeNull();
    expect(normalizeAdPlan({ brand: " ب " })).toEqual({ brand: "ب", product: "", message: "", audience: "", ending: "", imitate: "", reference: "" });
    expect(readBrand([{ fileId: "11111111-1111-4111-8111-111111111111", role: "logo" }, { fileId: "nope", role: "logo" }, { fileId: "22222222-2222-4222-8222-222222222222", role: "hat" }])).toEqual([{ fileId: "11111111-1111-4111-8111-111111111111", role: "logo", name: "" }]);
  });
});
