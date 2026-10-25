import { describe, expect, it } from "vitest";
import { asksToSearch, readRefs, REF_FRAMES_MAX, REFS_MAX, refsParts, refsText, researchText, searchPrompt } from "@/lib/editor/scene/references";

// «مختبر الموشن»: references (pictures and videos, to copy or to be inspired by) reach حيدرا ماكس bounded and in order, and a
// web search is asked when the person asks for one.

const jpg = "QUJD";
const video = (n: number, use = "inspire") => ({ kind: "video", name: "ريل", seconds: 20, use, frames: Array.from({ length: n }, (_, i) => ({ t: i * 3, data: jpg })) });

describe("readRefs", () => {
  it("reads pictures, videos and the old drawer's plain pictures", () => {
    const r = readRefs({ refs: [{ kind: "image", name: "شعار", frames: [{ t: 0, data: jpg }], use: "use" }, video(3)], references: [jpg] });
    expect(r.map((x) => [x.kind, x.use, x.frames.length])).toEqual([
      ["image", "use", 1],
      ["video", "inspire", 3],
      ["image", "inspire", 1],
    ]);
  });

  it("drops what is not a picture and keeps the counts within the budget", () => {
    const r = readRefs({ refs: [{ kind: "image", frames: [{ data: "not base64!" }] }, ...Array.from({ length: 9 }, () => video(8))] });
    expect(r.length).toBe(REFS_MAX);
    expect(r.reduce((n, x) => n + x.frames.length, 0)).toBeLessThanOrEqual(REF_FRAMES_MAX);
    // every reference keeps at least its first frame
    expect(r.every((x) => x.frames.length >= 1)).toBe(true);
  });

  it("keeps a video's frames in time order with their seconds in the turn", () => {
    const parts = refsParts(readRefs({ refs: [video(3)] }));
    expect(parts.filter((p) => p.type === "image64").length).toBe(3);
    expect(parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text)).toEqual(["REFERENCE 1 (video) · frame 1/3 at 0.0 s:", "REFERENCE 1 (video) · frame 2/3 at 3.0 s:", "REFERENCE 1 (video) · frame 3/3 at 6.0 s:"]);
  });

  it("tells «take from it» and «inspiration» apart", () => {
    expect(refsText(readRefs({ refs: [video(2, "use")] }))).toMatch(/TAKE FROM IT/);
    expect(refsText(readRefs({ refs: [video(2)] }))).toMatch(/INSPIRATION/);
    expect(refsText([])).toBe("");
  });
});

describe("web search", () => {
  it("knows a message that asks to search", () => {
    for (const m of ["ابحث عن ألوان شعار ستاربكس", "وش الترند في الريلز الحين؟", "دوّر لي على إحصائيات القهوة", "search for apple keynote style", "جيب لي معلومة من النت"]) expect(asksToSearch(m)).toBe(true);
    for (const m of ["خلّ اللون ذهبي", "أسرع شوي", "اعتمد وابنِ"]) expect(asksToSearch(m)).toBe(false);
  });

  it("brings what was found to the next step, and the piece to the search", () => {
    expect(researchText({ research: "القهوة ٢٠٢٦: ..." })).toMatch(/^WEB RESEARCH/);
    expect(researchText({})).toBe("");
    expect(searchPrompt({ query: "ابحث عن ترند", about: "إعلان قهوة" })).toMatch(/إعلان قهوة/);
  });
});
