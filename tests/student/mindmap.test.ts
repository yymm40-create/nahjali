import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DESIGNED_KINDS, OUTPUT_KINDS } from "@config/jawad/student";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";
import { MAP_GRADES, MAP_ICONS, clampMap, fromOutline, gradeOf, mapSettings, mapsWanted, toOutline, type MindMap } from "@/lib/jawad/student/mindmap";
import { layoutMap, mapHtml, pictureAspect, pictureScale } from "@/lib/jawad/student/render/mindmap";
import { autoSettings } from "@/lib/jawad/student/defaults";
import { settingsLine } from "@/lib/jawad/student/summary";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

const sample = (type: MindMap["type"] = "radial"): MindMap => ({
  title: "الخلية النباتية",
  center: "الخلية",
  icon: "leaf",
  type,
  branches: [
    { label: "الجدار الخلوي", icon: "home", link: "يحيط بها", children: [{ label: "السليلوز", link: "يتكون من", details: ["مادة قوية"] }] },
    { label: "النواة", icon: "target", link: "تتحكم بها", children: [{ label: "DNA", link: "تحمل", details: [] }, { label: "النوية", link: "فيها", details: [] }] },
    { label: "البلاستيدات", icon: "leaf", link: "تحتوي", children: [{ label: "البناء الضوئي", link: "تقوم بـ", details: ["ينتج الجلوكوز"] }] },
  ],
  links: [{ from: "البناء الضوئي", to: "DNA", label: "يعتمد على" }],
});

describe("«خريطة ذهنية» is an output of «الطالب الذكي»", () => {
  it("is offered, designed, and known to صادق", () => {
    const k = OUTPUT_KINDS.find((o) => o.kind === "mindmap")!;
    expect(k.name).toBe("خريطة ذهنية");
    expect(DESIGNED_KINDS).toContain("mindmap");
    expect(JAWAD_KNOWLEDGE).toContain("خريطة ذهنية");
    expect(JAWAD_KNOWLEDGE).toContain("نسخة التسميع");
  });

  it("has its migration (the database allows the kind)", () => {
    const sql = read("supabase/migrations/0061_student_mindmap.sql");
    expect(sql).toContain("'mindmap'");
    for (const k of OUTPUT_KINDS) expect(sql, k.kind).toContain(`'${k.kind}'`);
  });

  it("starts with sensible choices: صادق designs it, with the recall copy", () => {
    const s = mapSettings(autoSettings("mindmap", "ثانوي"));
    expect(s).toMatchObject({ mapType: "auto", render: "editable", recall: true, scope: "sections" });
    expect(mapSettings(autoSettings("mindmap", "ابتدائي")).scope).toBe("one");
    expect(settingsLine("mindmap", { mapType: "concept", scope: "one", render: "image", recall: true })).toContain("يرسمها GPT Image 2");
  });
});

describe("the grade follows who studies", () => {
  it("reads the five levels of the first page", () => {
    expect(gradeOf("ابتدائي")).toBe("primary");
    expect(gradeOf("متوسط")).toBe("middle");
    expect(gradeOf("ثانوي")).toBe("secondary");
    expect(gradeOf("جامعي")).toBe("university");
    expect(gradeOf("دراسات عليا")).toBe("graduate");
    expect(gradeOf("")).toBe("adult");
  });

  it("grows with age: more branches, deeper, links only from secondary up", () => {
    expect(MAP_GRADES.primary.branches[1]).toBeLessThanOrEqual(5);
    expect(MAP_GRADES.primary.details).toBe(0);
    expect(MAP_GRADES.primary.words).toBeLessThanOrEqual(2);
    expect(MAP_GRADES.middle.links).toBe(0);
    expect(MAP_GRADES.university.type).toBe("concept");
    expect(MAP_GRADES.graduate.links).toBeGreaterThan(MAP_GRADES.secondary.links);
  });

  it("cuts a map to its grade in code (never trusting the model)", () => {
    const big = { ...sample(), branches: Array.from({ length: 12 }, (_, i) => ({ label: `فرع ${i}`, icon: "nope", link: "", children: Array.from({ length: 6 }, (_, j) => ({ label: `ف ${j}`, link: "", details: ["أ", "ب", "ج", "د"] })) })) };
    const child = clampMap(big, "primary");
    expect(child.branches).toHaveLength(5);
    expect(child.branches.every((b) => b.children.length <= 2 && b.children.every((c) => c.details.length === 0))).toBe(true);
    expect(child.branches[0].icon).toBe("");
    expect(child.links).toHaveLength(0);
    const grad = clampMap(big, "graduate");
    expect(grad.branches).toHaveLength(8);
    expect(grad.branches[0].children).toHaveLength(5);
  });

  it("keeps only cross-links between nodes that exist", () => {
    const m = clampMap({ ...sample(), links: [{ from: "البناء الضوئي", to: "DNA", label: "x" }, { from: "شي", to: "DNA", label: "y" }] }, "university");
    expect(m.links).toHaveLength(1);
  });
});

describe("how many maps", () => {
  it("one, or the whole plus one for each part (at most 9)", () => {
    expect(mapsWanted("one", 6)).toBe(1);
    expect(mapsWanted("sections", 1)).toBe(1);
    expect(mapsWanted("sections", 4)).toBe(5);
    expect(mapsWanted("sections", 20)).toBe(9);
  });
});

describe("the outline the student edits", () => {
  it("goes there and back without losing anything", () => {
    const m = sample("concept");
    const back = fromOutline(toOutline(m), m);
    expect(back.title).toBe(m.title);
    expect(back.center).toBe(m.center);
    expect(back.branches.map((b) => [b.label, b.link, b.icon])).toEqual(m.branches.map((b) => [b.label, b.link, b.icon]));
    expect(back.branches.map((b) => b.children)).toEqual(m.branches.map((b) => b.children));
    expect(back.links).toEqual(m.links);
  });

  it("reads a branch the student added", () => {
    const m = sample();
    const back = fromOutline(`${toOutline(m)}\n- الفجوة العصارية\n-- الماء | تخزن\n--- تحافظ على الضغط`, m);
    const added = back.branches[back.branches.length - 1];
    expect(added).toMatchObject({ label: "الفجوة العصارية", icon: "", children: [{ label: "الماء", link: "تخزن", details: ["تحافظ على الضغط"] }] });
  });
});

describe("the drawing", () => {
  const colors = { bg: "#fff", paper: "#fff", ink: "#111", muted: "#555", accent: "#2b6cb0", line: "#ddd" };
  const opts = { colors, fonts: { heading: "Readex Pro", body: "IBM Plex Sans Arabic" }, fontFaces: "" };

  for (const type of ["radial", "tree", "concept", "flow"] as const) {
    it(`${type}: every word has a box inside the page, none overlapping`, () => {
      const L = layoutMap(sample(type));
      const words = L.boxes.map((b) => b.text);
      for (const w of ["الخلية", "الجدار الخلوي", "السليلوز", "مادة قوية", "النوية"]) expect(words).toContain(w);
      for (const b of L.boxes) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w).toBeLessThanOrEqual(L.w);
        expect(b.y + b.h).toBeLessThanOrEqual(L.h);
      }
      const main = L.boxes.filter((b) => b.kind !== "detail");
      for (let i = 0; i < main.length; i++)
        for (let j = i + 1; j < main.length; j++) {
          const a = main[i];
          const b = main[j];
          const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
          expect(overlap, `${a.text} × ${b.text}`).toBe(false);
        }
    });
  }

  it("the biggest map of each grade, in every shape, still has no two boxes over each other", () => {
    for (const grade of Object.keys(MAP_GRADES) as (keyof typeof MAP_GRADES)[]) {
      const g = MAP_GRADES[grade];
      const raw = { ...sample(), branches: Array.from({ length: g.branches[1] }, (_, i) => ({ label: `الفرع الرئيسي رقم ${i + 1} للمادة`, icon: "idea", link: "يشمل", children: Array.from({ length: g.children }, (_, j) => ({ label: `فرع فرعي طويل شوي ${j + 1}`, link: "مثل", details: Array.from({ length: g.details }, () => "تفصيل فيه بعض الكلمات للحفظ") })) })) };
      for (const type of ["radial", "tree", "concept", "flow"] as const) {
        const L = layoutMap(clampMap({ ...raw, type }, grade), { young: grade === "primary" });
        const main = L.boxes;
        for (let i = 0; i < main.length; i++)
          for (let j = i + 1; j < main.length; j++) {
            const a = main[i];
            const b = main[j];
            const overlap = a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
            expect(overlap, `${grade}/${type}: ${a.text} × ${b.text}`).toBe(false);
          }
      }
    }
  });

  it("numbers the main branches, and a radial map puts them on both sides of the centre", () => {
    const L = layoutMap(sample("radial"));
    const center = L.boxes.find((b) => b.kind === "center")!;
    const branches = L.boxes.filter((b) => b.kind === "branch");
    expect(branches.map((b) => b.num)).toEqual([1, 2, 3]);
    expect(branches.some((b) => b.x > center.x + center.w)).toBe(true);
    expect(branches.some((b) => b.x + b.w < center.x)).toBe(true);
  });

  it("a concept map writes its linking phrases; a flow map draws arrows", () => {
    const concept = layoutMap(sample("concept"));
    expect(concept.edges.filter((e) => e.label).map((e) => e.label!.text)).toEqual(expect.arrayContaining(["يحيط بها", "يعتمد على"]));
    expect(concept.edges.some((e) => e.dashed)).toBe(true);
    expect(layoutMap(sample("flow")).edges.filter((e) => e.arrow)).toHaveLength(2);
  });

  it("the blank copy hides the branches but keeps the centre, and prints how to review", () => {
    const full = mapHtml(sample(), opts).html;
    const blank = mapHtml(sample(), { ...opts, blank: true }).html;
    expect(full).toContain("السليلوز");
    expect(blank).not.toContain("السليلوز");
    expect(blank).not.toContain("الجدار الخلوي");
    expect(blank).toContain("الخلية");
    expect(blank).toContain("نسخة التسميع");
    expect(blank).toContain("بعد يوم");
  });

  it("escapes what it writes, and draws icons as lines (no emoji)", () => {
    const html = mapHtml({ ...sample(), center: "<b>x</b>" }, opts).html;
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).toContain(MAP_ICONS.leaf);
  });

  it("a picture of high quality, in what a serverless browser holds", () => {
    const s = pictureScale(2400, 1200);
    expect(2400 * s).toBeGreaterThanOrEqual(4000);
    expect(2400 * s * 1200 * s).toBeLessThanOrEqual(24e6 + 1);
    expect(pictureScale(9000, 9000)).toBe(1);
    expect(pictureAspect(2400, 1200)).toBe("3:2");
    expect(pictureAspect(1000, 1500)).toBe("2:3");
    expect(pictureAspect(1000, 1000)).toBe("1:1");
  });
});

describe("the pipeline", () => {
  it("plans, then makes: صادق's pictures first (GPT Image 2 draws from them), then the files", () => {
    const make = read("src/lib/jawad/student/mindmap-make.ts");
    expect(make.indexOf("صادق's pictures first")).toBeLessThan(make.indexOf("s.render === \"image\""));
    expect(make).toContain("references: [{ bytes: ref");
    for (const f of ["maps_pdf", "blank_pdf", "art_pdf"]) expect(make).toContain(f);
    const outputs = read("src/lib/jawad/student/outputs.ts");
    expect(outputs).toContain("mapPlanStep");
    expect(outputs).toContain("mapFinalStep");
  });

  it("is approved straight to «ready» (no paid trial), and one map can be drawn again", () => {
    const actions = read("src/lib/jawad/student/actions.ts");
    expect(actions).toContain('o.kind === "book" || o.kind === "slides" ? "trial_offer" : "ready"');
    expect(actions).toContain('o.kind === "mindmap" && o.settings.render === "image"');
  });
});
