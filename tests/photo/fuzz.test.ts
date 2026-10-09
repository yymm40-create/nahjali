import { describe, expect, it } from "vitest";
import { setTimeout as tick } from "node:timers/promises";
import { applyOp, docFromPicture, newDoc, orientedSize, readDoc, type Op, type PhotoDoc } from "@/lib/photo/doc";
import { Rng } from "@config/content-examples";
import { ADJUSTS, FILTERS, PHOTO, RATIOS, SIZE_PRESETS } from "@config/photo";
import { FONTS } from "@config/jawad/student";

// Random sequences of commands, including nonsense: whatever happens, the project must stay valid — the canvas inside the
// allowed size, the layers inside their limit and place, the shown part of the picture inside the picture and the same shape
// as the canvas — and a command that is refused must leave the project exactly as it was.
const FILES = new Map([["f1", { w: 4000, h: 3000 }], ["f2", { w: 800, h: 1200 }], ["f3", { w: 300, h: 300 }]]);
const FONT_IDS = FONTS.map((f) => f.id);
const ctx = { files: FILES, fonts: FONT_IDS };

function randomOp(r: Rng, d: PhotoDoc): Op {
  const ids = d.layers.map((l) => l.id);
  const id = () => (ids.length && r.next() < 0.92 ? r.pick(ids) : "ghost");
  const n = (a: number, b: number) => a + r.next() * (b - a);
  const color = () => `#${Math.floor(r.next() * 0xffffff).toString(16).padStart(6, "0")}`;
  switch (r.int(0, 22)) {
    case 0: return { op: "adjust", values: Object.fromEntries(ADJUSTS.filter(() => r.next() < 0.4).map((a) => [a.key, n(a.min * 1.5, a.max * 1.5)])) };
    case 1: return { op: "adjust_reset" };
    case 2: return { op: "filter", id: r.next() < 0.9 ? r.pick(FILTERS).id : "nope", strength: n(-20, 140) };
    case 3: return { op: "crop", x: n(-10, 90), y: n(-10, 90), w: n(0, 110), h: n(0, 110) };
    case 4: return { op: "crop_ratio", ratio: r.next() < 0.95 ? r.pick(RATIOS) : "7:3", focus: { x: n(-20, 120), y: n(-20, 120) } };
    case 5: return { op: "canvas", preset: r.pick(SIZE_PRESETS).id, focus: { x: n(0, 100), y: n(0, 100) } };
    case 6: return { op: "canvas", width: Math.round(n(10, 6000)), height: Math.round(n(10, 6000)) };
    case 7: return { op: "rotate", deg: r.pick([90, -90, 180, 270, 45]) };
    case 8: return { op: "flip", axis: r.pick(["h", "v", "x"]) };
    case 9: return { op: "straighten", deg: n(-30, 30) };
    case 10: return { op: "bg", color: r.next() < 0.9 ? color() : "blue" };
    case 11: return { op: "add_text", text: r.next() < 0.95 ? "نص تجريبي طويل شوي لاختبار الالتفاف" : " ", font: r.pick(FONT_IDS), size: n(-5, 60), color: color(), x: n(-20, 120), y: n(-20, 120), w: n(0, 150), rotate: n(-400, 400), effect: r.pick(["none", "outline", "shadow", "glow", "pill", "x"]) };
    case 12: return { op: "add_shape", shape: r.pick(["rect", "ellipse", "line", "star"]), x: n(0, 100), y: n(0, 100), w: n(0, 200), h: n(0, 200), fill: r.next() < 0.5 ? color() : "", stroke: r.next() < 0.5 ? color() : "", stroke_w: n(0, 30), radius: n(0, 80), rotate: n(-200, 200), opacity: n(-1, 2) };
    case 13: return { op: "add_image", file: r.pick(["f1", "f2", "f3", "ghost"]), x: n(0, 100), y: n(0, 100), w: n(0, 300) };
    case 14: return { op: "use_as_base", file: r.pick(["f1", "f2", "f3", "ghost"]) };
    case 15: return { op: "update", id: id(), patch: { x: n(-20, 120), y: n(-20, 120), w: n(0, 200), h: n(0, 200), size: n(-5, 60), rotate: n(-500, 500), opacity: n(-1, 2), color: color(), text: r.next() < 0.9 ? "تحديث" : "" } };
    case 16: return { op: "move", id: id(), x: n(-50, 150), y: n(-50, 150) };
    case 17: return { op: "delete", id: id() };
    case 18: return { op: "duplicate", id: id() };
    case 19: return { op: "order", id: id(), to: r.pick(["front", "back", "up", "down", "side"]) };
    case 20: return { op: "align", id: id(), to: r.pick(["center", "middle", "left", "right", "top", "bottom", "x"]) };
    case 21: return { op: "rotate", deg: 90 };
    default: return { op: r.pick(["nonsense", "adjust", "crop"]) };
  }
}

/** The shown part of the picture has the canvas's shape (the picture is never stretched). */
const stretch = (d: PhotoDoc) => {
  if (!d.base) return 1;
  const o = orientedSize(d.base);
  return ((d.base.crop.w * o.w) / (d.base.crop.h * o.h)) / (d.width / d.height);
};

function invariants(d: PhotoDoc, startStretch: number) {
  expect(Number.isInteger(d.width) && Number.isInteger(d.height)).toBe(true);
  expect(d.width).toBeGreaterThanOrEqual(PHOTO.minSide);
  expect(d.height).toBeGreaterThanOrEqual(PHOTO.minSide);
  expect(d.width).toBeLessThanOrEqual(PHOTO.maxSide);
  expect(d.height).toBeLessThanOrEqual(PHOTO.maxSide);
  expect(d.layers.length).toBeLessThanOrEqual(PHOTO.maxLayers);
  expect(new Set(d.layers.map((l) => l.id)).size).toBe(d.layers.length);
  for (const l of d.layers) {
    expect(l.x).toBeGreaterThanOrEqual(0);
    expect(l.x).toBeLessThanOrEqual(100);
    expect(l.y).toBeGreaterThanOrEqual(0);
    expect(l.y).toBeLessThanOrEqual(100);
    expect(Math.abs(l.rotate)).toBeLessThanOrEqual(180);
    if (l.kind === "text") {
      expect(l.size).toBeGreaterThan(0);
      expect(FONT_IDS).toContain(l.font);
      expect(l.text.trim().length).toBeGreaterThan(0);
    }
    if (l.kind === "image") expect(FILES.has(l.fileId)).toBe(true);
  }
  for (const a of ADJUSTS) {
    expect(d.adjust[a.key]).toBeGreaterThanOrEqual(a.min);
    expect(d.adjust[a.key]).toBeLessThanOrEqual(a.max);
  }
  if (d.base) {
    const c = d.base.crop;
    expect(c.x).toBeGreaterThanOrEqual(-1e-9);
    expect(c.y).toBeGreaterThanOrEqual(-1e-9);
    expect(c.x + c.w).toBeLessThanOrEqual(1 + 1e-6);
    expect(c.y + c.h).toBeLessThanOrEqual(1 + 1e-6);
    expect(Math.abs(d.base.straighten)).toBeLessThanOrEqual(15);
    // the picture's shape is kept: the stretch never drifts far from where this sequence began (rounding of small canvases aside)
    expect(Math.abs(stretch(d) / startStretch - 1)).toBeLessThan(0.08);
  }
  // what is stored reads back the same
  const back = readDoc(JSON.parse(JSON.stringify(d)));
  expect([back.width, back.height, back.layers.length]).toEqual([d.width, d.height, d.layers.length]);
  expect(readDoc(back)).toEqual(back);
}

describe("random sequences of commands", () => {
  it("keep every project valid, and a refused command changes nothing (6000 sequences)", async () => {
    const r = new Rng(424242);
    let applied = 0;
    let refused = 0;
    for (let i = 0; i < 6000; i++) {
      let d = r.next() < 0.8 ? docFromPicture({ id: "f1", w: 4000, h: 3000 }, r.pick([400, 1080, 1600, 3000])) : newDoc(r.pick([300, 1080, 2000]), r.pick([300, 1350, 2500]));
      const start = stretch(d);
      for (let k = 0; k < r.int(1, 10); k++) {
        const op = randomOp(r, d);
        const before = JSON.stringify(d);
        const res = applyOp(d, op, ctx);
        if ("error" in res) {
          refused++;
          expect(typeof res.error).toBe("string");
          expect(res.error.length).toBeGreaterThan(3);
          expect(JSON.stringify(d)).toBe(before);
        } else {
          applied++;
          d = res.doc;
          // a blank canvas takes its shape from the first picture, so the stretch starts there
          try {
            invariants(d, d.base && !JSON.parse(before).base ? stretch(d) : start || stretch(d));
          } catch (e) {
            throw new Error(`${(e as Error).message}\nafter ${JSON.stringify(op)}\nbefore ${before}\nstart stretch ${start}`);
          }
        }
      }
      if (i % 600 === 0) await tick(0);
    }
    expect(applied).toBeGreaterThan(10000);
    expect(refused).toBeGreaterThan(2000);
  }, 120_000);
});
