import { describe, expect, it } from "vitest";
import { applyAll } from "@/lib/editor/commands";
import { emptyTimeline } from "@/lib/editor/model";
import { placeHookDesign } from "@/lib/editor/make";
import { checkDesign, deliveryText, DESIGN_SCHEMA, hookAspect, HOOK_ENTRANCES, HOOK_PALETTES, HOOK_STYLES, MEDIA_ANIMS, type HookDesign } from "@/lib/editor/hook-design";
import { lib, main, sound, video } from "./helpers";

const h = { text: "سرّ النجاح", lang: "العربية", orientation: "vertical" as const, domain: "قصص أطفال", age: "٦–٩" };
const raw: HookDesign = {
  research: "الحروف ثلاثية الأبعاد داخل المشهد (example.com)",
  researched: true,
  style: 9,
  styleWhy: "يجذب الأطفال",
  element: "أرنب يقفز فوق الكلمة",
  elementWhy: "يخدم المعنى",
  palette: 2,
  paletteWhy: "طاقة",
  background: "transparent",
  backgroundDesc: "مفرّغة فوق الفيديو",
  backgroundWhy: "المشهد يبقى",
  layout: "كلمة فوق كلمة",
  layoutWhy: "عمودي",
  entrance: 2,
  entranceWhy: "مرح",
  inAnim: "pop",
  inMs: 400,
  exit: "تلاشي مع صعود",
  exitWhy: "ناعم",
  outAnim: "fade",
  outMs: 300,
  imagePrompt: "Pixar-style 3D render of the words \"سرّ النجاح\" ...",
  lengthMs: 2400,
  sfxIn: { kind: "effect", prompt: "balloon inflate then pop, peak at 0.4s", seconds: 1, peakMs: 400, why: "يطابق الانتفاخ" },
  sfxOut: { kind: "effect", prompt: "soft whoosh fading out", seconds: 0.8, peakMs: 700, why: "اختفاء" },
  open: "",
};

describe("the hook designer's library", () => {
  it("has the owner's ten styles, palettes and entrances, each entrance on a real editor animation", () => {
    expect([HOOK_STYLES.length, HOOK_PALETTES.length, HOOK_ENTRANCES.length]).toEqual([10, 10, 10]);
    for (const e of HOOK_ENTRANCES) expect(MEDIA_ANIMS).toContain(e.anim);
    expect(MEDIA_ANIMS).not.toContain("words");
    expect(MEDIA_ANIMS).not.toContain("kenburns");
  });

  it("asks Claude only for editor animations that exist", () => {
    expect(DESIGN_SCHEMA.properties.inAnim.enum).toEqual(MEDIA_ANIMS);
  });
});

describe("a design made safe", () => {
  it("keeps the hook's words verbatim in the image prompt", () => {
    expect(checkDesign(raw, h).imagePrompt.startsWith(raw.imagePrompt)).toBe(true);
    const fixed = checkDesign({ ...raw, imagePrompt: "Pixar-style 3D render of the hook" }, h);
    expect(fixed.imagePrompt).toContain('"سرّ النجاح"');
  });

  it("replaces an unknown animation and keeps lengths sane", () => {
    const d = checkDesign({ ...raw, inAnim: "words" as never, outAnim: "nope" as never, inMs: 99999, lengthMs: 100, sfxIn: { ...raw.sfxIn, seconds: 30, peakMs: 9000 } }, h);
    expect(d.inAnim).toBe("pop"); // entrance 2's template
    expect(d.outAnim).toBe("fade");
    expect(d.inMs).toBe(3000);
    expect(d.lengthMs).toBeGreaterThanOrEqual(d.inMs + d.outMs);
    expect(d.sfxIn.seconds).toBe(5);
    expect(d.sfxIn.peakMs).toBe(5000);
  });

  it("always cuts the words out over the video (never a card behind them)", () => {
    const d = checkDesign({ ...raw, background: "scene" }, h);
    expect(d.background).toBe("transparent");
    expect(d.imagePrompt).toContain("Isolated lettering only");
  });

  it("frames the picture by background and orientation", () => {
    expect(hookAspect({ background: "transparent" }, "vertical")).toBe("1:1");
    expect(hookAspect({ background: "transparent" }, "horizontal")).toBe("3:2");
    expect(hookAspect({ background: "scene" }, "vertical")).toBe("9:16");
  });

  it("delivers in the owner's order", () => {
    const t = deliveryText(checkDesign(raw, h), h);
    const at = (s: string) => t.indexOf(s);
    expect(at("سرّ النجاح")).toBe(2);
    expect(at("البحث:")).toBeLessThan(at("• الأسلوب"));
    expect(at("• الخروجية")).toBeLessThan(at("أمر الصورة"));
    expect(at("أمر الصورة")).toBeLessThan(at("في البرنامج"));
    expect(at("في البرنامج")).toBeLessThan(at("مؤثر الدخول"));
    expect(at("مؤثر الدخول")).toBeLessThan(at("مؤثر الخروج"));
    expect(t.trim().split("\n").pop()).toContain("راجع رسم الحروف");
  });
});

describe("a designed hook on the timeline", () => {
  const assets = lib(video("v", 10_000), { id: "img", kind: "image", durationMs: null, width: 1024, height: 1024, hasAudio: false }, sound("in", 1000), sound("out", 800));
  const d = checkDesign(raw, h);
  const r = applyAll(applyAll(emptyTimeline(), [{ type: "add_clip", assetId: "v" }], assets).timeline, placeHookDesign(d, { image: "img", sfxIn: "in", sfxOut: "out" }, 500, "vertical"), assets);
  const t = r.timeline;
  const pic = t.tracks.flatMap((x) => x.clips).find((c) => c.assetId === "img")!;
  const sfx = (id: string) => t.tracks.flatMap((x) => x.clips).find((c) => c.assetId === id)!;

  it("shows the picture over the video for its length, with the design's entrance and exit", () => {
    expect(main(t).clips[0].assetId).toBe("v");
    expect([pic.start, pic.start + (pic.out - pic.in)]).toEqual([500, 2900]);
    expect(pic.anim).toMatchObject({ in: "pop", inMs: 400, out: "fade", outMs: 300 });
    expect(pic.fit).toBe("contain");
  });

  it("lands the entrance sound's peak on the arrival and the exit's on the vanishing", () => {
    expect(sfx("in").start + d.sfxIn.peakMs).toBe(500 + d.inMs);
    expect(sfx("out").start + d.sfxOut.peakMs).toBe(2900);
  });
});
