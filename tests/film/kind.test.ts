import { describe, expect, it } from "vitest";
import { FILM_KINDS, filmKind, readFilmKind } from "@config/film";
import { storyMessage } from "@/lib/film/script";
import { projectFields } from "@/lib/film/validate";
import type { FilmProject } from "@/lib/film/types";

// «الفيلم السينمائي غير … مشهد قصير من بره، فيلم سينمائي من داخل، أو مسلسل كامل»: what is being made is chosen at the
// start and the screenwriter is told, so a scene is never written as a film and a film is never written as one shot.
const project = (kind?: unknown): FilmProject =>
  ({ id: "p1", user_id: "u1", title: "الرسالة", story: "رجل يرجع لبيته بعد عشرين سنة.", fixed_facts: "", target_duration_sec: null, stage: "screenwriter", video_model: "seedance-2.5", created_at: "", updated_at: "", ...(kind === undefined ? {} : { kind }) }) as FilmProject;

describe("what is being made", () => {
  it("names three shapes, and the series has its own place", () => {
    expect(FILM_KINDS.map((k) => k.id)).toEqual(["scene", "film", "series"]);
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
});
