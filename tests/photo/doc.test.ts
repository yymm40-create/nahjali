import { describe, expect, it } from "vitest";
import { applyOp, applyOps, cropDoc, describeDoc, docFromPicture, fitRect, fitSide, newDoc, orientedSize, readDoc, readOps, type Op, type PhotoDoc, type TextLayer } from "@/lib/photo/doc";
import { PHOTO, SIZE_PRESETS } from "@config/photo";

const FILES = new Map([["f1", { w: 4000, h: 3000 }], ["f2", { w: 800, h: 800 }]]);
const ctx = { files: FILES, fonts: ["readex", "amiri", "tajawal"] };
const run = (d: PhotoDoc, ...ops: Op[]) => {
  const r = applyOps(d, ops, ctx);
  if (r.error) throw new Error(`${r.error.op}: ${r.error.message}`);
  return r.doc;
};
const photo = () => docFromPicture({ id: "f1", w: 4000, h: 3000 }, 1600);
const withLayers = () =>
  run(photo(),
    { op: "add_text", text: "عنوان", font: "readex", size: 8, x: 30, y: 20, w: 30, color: "#FFFFFF", rotate: 10 },
    { op: "add_shape", shape: "rect", x: 70, y: 80, w: 40, h: 12, fill: "#000000", opacity: 0.5, stroke: "#FFFFFF", stroke_w: 0.5, radius: 3, rotate: 5 },
    { op: "add_image", file: "f2", x: 20, y: 70, w: 25 });
const near = (a: number, b: number, e = 0.6) => expect(Math.abs(a - b)).toBeLessThanOrEqual(e);
/** A layer's pixel size on the canvas (what the eye sees), for the turn and crop checks. */
const px = (d: PhotoDoc, id: string) => {
  const l = d.layers.find((x) => x.id === id)!;
  if (l.kind === "text") return { size: (l.size / 100) * d.height, w: (l.w / 100) * d.width };
  if (l.kind === "image") return { w: (l.w / 100) * d.width };
  return { w: (l.w / 100) * d.width, h: (l.h / 100) * d.height };
};

describe("making a project", () => {
  it("takes the picture's shape, within the allowed size", () => {
    const d = photo();
    expect([d.width, d.height]).toEqual([1600, 1200]);
    expect(d.base).toMatchObject({ fileId: "f1", w: 4000, h: 3000, rotate: 0 });
    expect(docFromPicture({ id: "x", w: 9000, h: 3000 }).width).toBe(PHOTO.maxSide);
    expect(fitSide(20, 30).width).toBeGreaterThanOrEqual(PHOTO.minSide);
    expect(newDoc(5000, 5000).width).toBe(PHOTO.maxSide);
  });

  it("reads anything into a safe project", () => {
    const d = readDoc({ width: -5, height: 99999, bg: "red", base: { fileId: "" }, filter: { id: "zzz", strength: 900 }, adjust: { exposure: 900, nonsense: 5 }, layers: [{ kind: "x" }, null, 5] });
    expect(d.width).toBe(PHOTO.minSide);
    expect(d.height).toBe(PHOTO.maxSide);
    expect(d.bg).toBe("#FFFFFF");
    expect(d.base).toBeNull();
    expect(d.filter).toEqual({ id: "none", strength: 100 });
    expect(d.adjust.exposure).toBe(100);
    expect(d.layers).toEqual([]);
    expect(readDoc(null).layers).toEqual([]);
    const again = readDoc(JSON.parse(JSON.stringify(withLayers())));
    expect(again).toEqual(withLayers());
  });
});

describe("commands", () => {
  it("are read from JSON strings or objects, and unknown ones are named", () => {
    expect(readOps(['{"op":"adjust","values":{"exposure":5}}', { op: "filter", id: "bw" }]).ops).toHaveLength(2);
    expect(readOps(["{not json"]).error).toMatch(/JSON/);
    expect(readOps([{ op: "hack" }]).error).toMatch(/غير معروف/);
    expect(readOps(Array.from({ length: 100 }, () => ({ op: "adjust_reset" }))).ops).toHaveLength(PHOTO.maxOps);
    expect(readOps("nope").ops).toEqual([]);
  });

  it("adjust sets sliders (clamped), reset clears them and the look; bad keys are refused", () => {
    let d = run(photo(), { op: "adjust", values: { exposure: 500, contrast: -30 } }, { op: "filter", id: "cinematic", strength: 60 });
    expect(d.adjust.exposure).toBe(100);
    expect(d.adjust.contrast).toBe(-30);
    expect(d.filter).toEqual({ id: "cinematic", strength: 60 });
    d = run(d, { op: "adjust_reset" });
    expect(d.adjust.exposure).toBe(0);
    expect(d.filter.id).toBe("none");
    expect("error" in applyOp(photo(), { op: "adjust", values: { glow: 3 } })).toBe(true);
    expect("error" in applyOp(photo(), { op: "filter", id: "nope" })).toBe(true);
    expect("error" in applyOp(photo(), { op: "adjust" })).toBe(true);
  });

  it("crop keeps the picture's shape true: the canvas and the shown part have the same ratio", () => {
    const d = run(photo(), { op: "crop", x: 10, y: 20, w: 50, h: 40 });
    expect([d.width, d.height]).toEqual([800, 480]);
    const b = d.base!;
    const o = orientedSize(b);
    near((b.crop.w * o.w) / (b.crop.h * o.h), d.width / d.height, 0.01);
    near(b.crop.x, 0.1, 0.001);
    near(b.crop.y, 0.2, 0.001);
    const again = run(d, { op: "crop", x: 0, y: 0, w: 50, h: 50 });
    near(again.base!.crop.w, 0.25, 0.001);
    expect("error" in applyOp(photo(), { op: "crop", x: 0, y: 0, w: 0, h: 50 })).toBe(true);
  });

  it("crop moves the layers with their content, and they keep their pixel size (the picture's scale is unchanged too)", () => {
    const d = withLayers();
    const c = run(d, { op: "crop", x: 0, y: 0, w: 50, h: 50 });
    const t = c.layers.find((l) => l.id === "t1") as TextLayer;
    near(t.x, 60, 0.1);
    near(t.y, 40, 0.1);
    // the canvas shrank to the kept part at the same scale, so the text is as big as before in pixels (twice as big in percent)
    near(px(c, "t1").size!, px(d, "t1").size!, 1.5);
    near(px(c, "t1").w, px(d, "t1").w, 3);
    near(t.size, 16, 0.1);
  });

  it("crop_ratio and canvas presets give exactly the ratio / size asked, centred on the focus", () => {
    const sq = run(photo(), { op: "crop_ratio", ratio: "1:1" });
    expect(sq.width).toBe(sq.height);
    near(sq.base!.crop.x, 0.125, 0.001);
    const left = run(photo(), { op: "crop_ratio", ratio: "1:1", focus: { x: 0, y: 50 } });
    near(left.base!.crop.x, 0, 0.001);
    const right = run(photo(), { op: "crop_ratio", ratio: "1:1", focus: { x: 100, y: 50 } });
    near(right.base!.crop.x + right.base!.crop.w, 1, 0.001);
    for (const p of SIZE_PRESETS) {
      const d = run(photo(), { op: "canvas", preset: p.id });
      const want = fitSide(p.w, p.h);
      expect([d.width, d.height]).toEqual([want.width, want.height]);
      const o = orientedSize(d.base!);
      near((d.base!.crop.w * o.w) / (d.base!.crop.h * o.h), d.width / d.height, 0.01);
    }
    expect("error" in applyOp(photo(), { op: "canvas", preset: "nope" })).toBe(true);
    expect("error" in applyOp(photo(), { op: "crop_ratio", ratio: "7:3" })).toBe(true);
    const free = run(photo(), { op: "canvas", width: 1200, height: 628 });
    expect([free.width, free.height]).toEqual([1200, 628]);
  });

  it("four quarter turns bring everything back; a turn swaps the sides and keeps the layers' look", () => {
    const d = run(withLayers(), { op: "crop", x: 10, y: 10, w: 70, h: 60 });
    const t1 = run(d, { op: "rotate", deg: 90 });
    expect([t1.width, t1.height]).toEqual([d.height, d.width]);
    expect(t1.base!.rotate).toBe(90);
    const o = orientedSize(t1.base!);
    near((t1.base!.crop.w * o.w) / (t1.base!.crop.h * o.h), t1.width / t1.height, 0.02);
    // the text keeps its size and width on the screen
    near(px(t1, "t1").size!, px(d, "t1").size!, 2);
    near(px(t1, "t1").w, px(d, "t1").w, 3);
    // the shape keeps its pixel size too
    near(px(t1, "s2").w, px(d, "s2").w, 3);
    near(px(t1, "s2").h!, px(d, "s2").h!, 3);
    let back = d;
    for (let i = 0; i < 4; i++) back = run(back, { op: "rotate", deg: 90 });
    expect(back.width).toBe(d.width);
    expect(back.height).toBe(d.height);
    expect(back.base!.rotate).toBe(0);
    near(back.base!.crop.x, d.base!.crop.x, 0.001);
    near(back.base!.crop.y, d.base!.crop.y, 0.001);
    near(back.base!.crop.w, d.base!.crop.w, 0.001);
    for (const l of d.layers) {
      const b = back.layers.find((x) => x.id === l.id)!;
      near(b.x, l.x, 0.3);
      near(b.y, l.y, 0.3);
      near(b.rotate, l.rotate, 0.3);
    }
    // -90 and 180
    const m = run(d, { op: "rotate", deg: -90 }, { op: "rotate", deg: 90 });
    near(m.base!.crop.x, d.base!.crop.x, 0.001);
    expect(run(d, { op: "rotate", deg: 180 }).base!.rotate).toBe(180);
    expect("error" in applyOp(d, { op: "rotate", deg: 45 })).toBe(true);
  });

  it("flipping twice returns, and the shown part mirrors", () => {
    const d = run(withLayers(), { op: "crop", x: 10, y: 10, w: 50, h: 60 });
    const f = run(d, { op: "flip", axis: "h" });
    near(f.base!.crop.x, 1 - (d.base!.crop.x + d.base!.crop.w), 0.001);
    expect(f.base!.flipX).toBe(true);
    near(f.layers.find((l) => l.id === "t1")!.x, 100 - d.layers.find((l) => l.id === "t1")!.x, 0.2);
    const twice = run(f, { op: "flip", axis: "h" });
    near(twice.base!.crop.x, d.base!.crop.x, 0.001);
    expect(twice.base!.flipX).toBe(false);
    const v = run(d, { op: "flip", axis: "v" }, { op: "flip", axis: "v" });
    near(v.base!.crop.y, d.base!.crop.y, 0.001);
    expect(v.base!.flipY).toBe(false);
    // after a quarter turn, a horizontal flip toggles the source's vertical flip
    expect(run(d, { op: "rotate", deg: 90 }, { op: "flip", axis: "h" }).base!.flipY).toBe(true);
    expect("error" in applyOp(d, { op: "flip", axis: "x" })).toBe(true);
  });

  it("text, shapes and pictures are added with safe values and listed under short ids", () => {
    const d = withLayers();
    expect(d.layers.map((l) => l.id)).toEqual(["t1", "s2", "i3"]);
    const t = d.layers[0] as TextLayer;
    expect(t.font).toBe("readex");
    expect(t.text).toBe("عنوان");
    expect(run(d, { op: "add_text", text: "x", font: "amiri", size: 999 }).layers[3]).toMatchObject({ kind: "text", font: "amiri", size: 30 });
    expect("error" in applyOp(d, { op: "add_text", text: "x", font: "comic" }, ctx)).toBe(true);
    expect("error" in applyOp(d, { op: "add_text", text: "   " }, ctx)).toBe(true);
    expect("error" in applyOp(d, { op: "add_shape", shape: "star" })).toBe(true);
    expect("error" in applyOp(d, { op: "add_image", file: "ghost" }, ctx)).toBe(true);
    const full = { ...d, layers: Array.from({ length: PHOTO.maxLayers }, (_, i) => ({ ...d.layers[0], id: `t${i}` })) } as PhotoDoc;
    expect("error" in applyOp(full, { op: "add_text", text: "x" }, ctx)).toBe(true);
  });

  it("update merges a patch through the layer's own checks; move, delete, duplicate, order and align work", () => {
    let d = withLayers();
    d = run(d, { op: "update", id: "t1", patch: { text: "جديد", color: "#ff0000", effect: "shadow", effect_color: "#111111", size: 12 } });
    expect(d.layers[0]).toMatchObject({ text: "جديد", color: "#FF0000", effect: "shadow", effectColor: "#111111", size: 12, id: "t1" });
    d = run(d, { op: "update", id: "s2", patch: { fill: "", stroke_w: 1.5 } });
    expect(d.layers[1]).toMatchObject({ fill: "", strokeW: 1.5 });
    expect("error" in applyOp(d, { op: "update", id: "ghost", patch: { x: 1 } })).toBe(true);
    expect("error" in applyOp(d, { op: "update", id: "t1", patch: { text: "" } })).toBe(true);
    d = run(d, { op: "move", id: "t1", x: 10, y: 95 });
    expect([d.layers[0].x, d.layers[0].y]).toEqual([10, 95]);
    d = run(d, { op: "align", id: "t1", to: "center" }, { op: "align", id: "t1", to: "middle" });
    expect([d.layers[0].x, d.layers[0].y]).toEqual([50, 50]);
    d = run(d, { op: "align", id: "s2", to: "bottom" });
    expect(d.layers[1].y).toBe(92);
    d = run(d, { op: "duplicate", id: "t1" });
    expect(d.layers).toHaveLength(4);
    expect(d.layers[1].id).toBe("t4");
    d = run(d, { op: "order", id: "t4", to: "front" });
    expect(d.layers.at(-1)!.id).toBe("t4");
    d = run(d, { op: "order", id: "t4", to: "back" });
    expect(d.layers[0].id).toBe("t4");
    d = run(d, { op: "order", id: "t4", to: "up" });
    expect(d.layers[1].id).toBe("t4");
    d = run(d, { op: "delete", id: "t4" });
    expect(d.layers.map((l) => l.id)).toEqual(["t1", "s2", "i3"]);
    expect("error" in applyOp(d, { op: "order", id: "t1", to: "sideways" })).toBe(true);
    expect("error" in applyOp(d, { op: "align", id: "t1", to: "nowhere" })).toBe(true);
  });

  it("changes the base: a new picture, straightening, the colour behind", () => {
    const blank = newDoc(1000, 1000);
    const a = run(blank, { op: "use_as_base", file: "f1" });
    expect([a.width, a.height]).toEqual([4000 > PHOTO.maxSide ? PHOTO.maxSide : 4000, 3000]);
    const b = run(withLayers(), { op: "use_as_base", file: "f2" });
    expect(b.base!.fileId).toBe("f2");
    near((b.base!.crop.w * 800) / (b.base!.crop.h * 800), b.width / b.height, 0.01);
    expect(run(photo(), { op: "straighten", deg: 40 }).base!.straighten).toBe(15);
    expect("error" in applyOp(blank, { op: "straighten", deg: 2 })).toBe(true);
    expect(run(photo(), { op: "bg", color: "#12ab34" }).bg).toBe("#12AB34");
    expect("error" in applyOp(photo(), { op: "bg", color: "blue" })).toBe(true);
    expect("error" in applyOp(photo(), { op: "use_as_base", file: "ghost" }, ctx)).toBe(true);
  });

  it("the first failing command stops the rest and keeps what was done before it", () => {
    const r = applyOps(photo(), [{ op: "adjust", values: { exposure: 10 } }, { op: "delete", id: "ghost" }, { op: "adjust", values: { contrast: 10 } }]);
    expect(r.applied).toBe(1);
    expect(r.error).toMatchObject({ index: 1, op: "delete" });
    expect(r.doc.adjust.exposure).toBe(10);
    expect(r.doc.adjust.contrast).toBe(0);
  });

  it("never changes the project it was given", () => {
    const d = withLayers();
    const before = JSON.stringify(d);
    applyOps(d, [{ op: "crop", x: 10, y: 10, w: 50, h: 50 }, { op: "rotate", deg: 90 }, { op: "flip", axis: "h" }, { op: "delete", id: "t1" }], ctx);
    expect(JSON.stringify(d)).toBe(before);
  });
});

describe("telling Claude", () => {
  it("lists the canvas, the base, the sliders and every layer with its id", () => {
    const d = run(withLayers(), { op: "adjust", values: { exposure: 12 } }, { op: "filter", id: "bw", strength: 80 });
    const t = describeDoc(d, [{ id: "f2", name: "شعار", w: 800, h: 800 }]);
    expect(t).toContain("اللوحة: 1600×1200");
    expect(t).toContain("الصورة الأساسية: ملف f1");
    expect(t).toContain("exposure=12");
    expect(t).toContain("الفلتر: bw بقوة 80");
    for (const id of ["t1", "s2", "i3"]) expect(t).toContain(`- ${id} `);
    expect(t).toContain("«عنوان»");
    expect(t).toContain("f2 («شعار» 800×800)");
    expect(describeDoc(newDoc(500, 500))).toContain("لوحة بلون");
  });

  it("fitRect keeps the shape and stays inside", () => {
    const r = fitRect({ x: 0, y: 0, w: 1, h: 1 }, { w: 4000, h: 3000 }, 1, { x: 100, y: 0 });
    expect(r.x + r.w).toBeLessThanOrEqual(1.0001);
    near((r.w * 4000) / (r.h * 3000), 1, 0.001);
    expect(cropDoc(newDoc(1000, 1000), { x: 0, y: 0, w: 100, h: 100 }).width).toBe(1000);
  });
});
