import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { evaluate, priceTable } from "@/lib/jawad/engine";
import { centiFor, coinsOf, directorOffered, GENERATORS, generatorById, priceKindOf, SMART_SELECT_KEY } from "@config/jawad/generators";
import {
  binaryMask,
  fillMegapixels,
  fitMegapixels,
  IMAGE_TOOL_IDS,
  IMAGE_TOOL_USD,
  IMG_INPAINT_ID,
  IMG_OUTPAINT_ID,
  IMG_UPSCALE_ID,
  INPAINT_MAX_MP,
  isImageTool,
  MASK_WORK_SIDE,
  maskCanvasSize,
  maskProblem,
  maskToRgba,
  needsEnglish,
  OUTPAINT_ALL_SCALE,
  OUTPAINT_MAX_SIDE,
  OUTPAINT_SHAPES,
  outpaintPlan,
  topazTier,
  upscaleUsd,
} from "@config/jawad/image-tools";
import { growMask, normalizeMask } from "@/lib/jawad/server/image-mask";
import { compositeInside } from "@/lib/photo/repair";
import type { GeneratorDef, RefMeta } from "@config/jawad/types";

// «🖼️ أدوات الصورة» in «الاستوديو الإبداعي»: «امسح بالفرشاة · عدّل هالجزء», «وسّع الصورة» and «ارفع دقة الصورة».

const pic = (w: number, h: number, id = "p"): RefMeta => ({ id, kind: "image", role: "reference", name: id, mime: "image/png", bytes: 1000, width: w, height: h, durationMs: null, fps: null, status: "ready" });
const run = (def: GeneratorDef, settings: Record<string, unknown>, refs: RefMeta[], prompt = "", table = priceTable(def, undefined)) =>
  evaluate(def, { settings: settings as never, prompt, instructions: "", refStyle: "references", refs, strict: false }, table);
const inpaint = generatorById(IMG_INPAINT_ID)!;
const outpaint = generatorById(IMG_OUTPAINT_ID)!;
const upscale = generatorById(IMG_UPSCALE_ID)!;

describe("the three tools are generators", () => {
  it("are registered on fal as pictures in the images section, never offered the Super Director", () => {
    for (const id of IMAGE_TOOL_IDS) {
      const g = generatorById(id)!;
      expect(g, id).toBeTruthy();
      expect(isImageTool(id)).toBe(true);
      expect(g.output).toBe("image");
      expect(g.provider.id).toBe("fal");
      expect(g.defaultSection).toBe("images");
      expect(g.api.tracking).toBe("sync");
      expect(directorOffered(g)).toBe(false);
      // every price line says where its cost comes from
      for (const k of g.priceKeys) {
        expect(k.defaultCenti, `${id} ${k.key}`).toBeGreaterThan(0);
        expect(k.basis, `${id} ${k.key}`).toMatch(/fal|Claude/);
      }
      expect(g.sources.every((s) => s.url.startsWith("https://fal.ai/models/"))).toBe(true);
    }
    expect(isImageTool("openai-gpt-image-2")).toBe(false);
    expect(GENERATORS.filter((g) => isImageTool(g.id))).toHaveLength(3);
  });
});

describe("the mask", () => {
  it("is binary: painted where the page's paint is at least half opaque", () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 255, 0, 0, 127, 0, 0, 0, 0, 9, 9, 9, 128]);
    const m = binaryMask(rgba, 2, 2);
    expect([...m.data]).toEqual([255, 0, 0, 255]);
    expect(m.painted).toBe(2);
    expect(() => binaryMask(rgba, 3, 2)).toThrow();
    // encoded white where painted, black elsewhere, always opaque
    expect([...maskToRgba(m.data)]).toEqual([255, 255, 255, 255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255]);
  });

  it("is drawn in the picture's own shape, at most MASK_WORK_SIDE on its long side", () => {
    for (const [w, h] of [[1024, 1024], [4096, 2304], [1080, 1920], [8000, 600], [300, 200]]) {
      const s = maskCanvasSize(w, h);
      expect(Math.max(s.width, s.height)).toBeLessThanOrEqual(MASK_WORK_SIDE);
      expect(maskProblem({ width: w, height: h }, s), `${w}x${h}`).toBeNull();
      if (Math.max(w, h) <= MASK_WORK_SIDE) expect(s).toEqual({ width: w, height: h });
    }
    expect(maskProblem({ width: 1024, height: 1024 }, { width: 1024, height: 576 })).toMatch(/شكل/);
    expect(maskProblem({ width: 1024, height: 1024 }, { width: 8, height: 8 })).toMatch(/صغير/);
    expect(maskProblem({ width: 0, height: 0 }, { width: 8, height: 8 })).toBeTruthy();
  });

  it("is stretched by the server to exactly the picture's size, pure black and white", async () => {
    // a 100×50 mask with soft (antialiased) edges, as a canvas would make it
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect width="100" height="50" fill="#000"/><circle cx="50" cy="25" r="15" fill="#fff"/></svg>`;
    const soft = await sharp(Buffer.from(svg)).blur(2).png().toBuffer();
    const { png, painted } = await normalizeMask(soft, 400, 200);
    const meta = await sharp(png).metadata();
    expect([meta.width, meta.height]).toEqual([400, 200]);
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    const values = new Set<number>();
    for (let i = 0; i < info.width * info.height; i++) values.add(data[i * info.channels]);
    expect([...values].sort((a, b) => a - b)).toEqual([0, 255]);
    // about the circle's area (π·60², 4× the size each way)
    expect(painted / (Math.PI * 60 * 60)).toBeGreaterThan(0.8);
    expect(painted / (Math.PI * 60 * 60)).toBeLessThan(1.2);
    // grown a little, never shrunk
    const grown = await growMask(png, 400, 200, 10);
    const g = await sharp(grown).greyscale().raw().toBuffer();
    let more = 0;
    for (const v of g) if (v >= 128) more++;
    expect(more).toBeGreaterThan(painted);
  });

  it("changes nothing outside it: only the masked pixels come from the model's answer", async () => {
    const W = 64;
    const H = 48;
    const base = await sharp({ create: { width: W, height: H, channels: 3, background: "#0000ff" } }).png().toBuffer();
    const painted = await sharp({ create: { width: W, height: H, channels: 3, background: "#ff0000" } }).png().toBuffer();
    const hole = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#000"/><rect x="24" y="16" width="16" height="16" fill="#fff"/></svg>`)).png().toBuffer();
    const out = await compositeInside(base, painted, hole, W, H, 0.3);
    const { data, info } = await sharp(out).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const at = (x: number, y: number) => [...data.subarray((y * W + x) * info.channels, (y * W + x) * info.channels + 3)];
    expect(at(2, 2)).toEqual([0, 0, 255]);
    expect(at(60, 44)).toEqual([0, 0, 255]);
    expect(at(32, 24)[0]).toBeGreaterThan(240);
    expect(at(32, 24)[2]).toBeLessThan(15);
  });
});

describe("«وسّع الصورة»: the canvas", () => {
  const pictures = [[1024, 1024], [1536, 1024], [1024, 1536], [1080, 1920], [1920, 1080], [4000, 3000], [800, 600]];
  it("holds the whole picture, centred, in the chosen shape, no bigger than the provider takes", () => {
    for (const [w, h] of pictures) {
      for (const shape of OUTPAINT_SHAPES) {
        const p = outpaintPlan(w, h, shape);
        if (!p) {
          // only when the picture already has that shape
          expect(shape).not.toBe("all");
          const [a, b] = shape.split(":").map(Number);
          expect(Math.abs(w / h - a / b) / (a / b)).toBeLessThan(0.02);
          continue;
        }
        const tag = `${w}x${h} → ${shape}`;
        expect(p.x, tag).toBeGreaterThanOrEqual(0);
        expect(p.y, tag).toBeGreaterThanOrEqual(0);
        expect(p.x + p.imgW, tag).toBeLessThanOrEqual(p.canvasW);
        expect(p.y + p.imgH, tag).toBeLessThanOrEqual(p.canvasH);
        // centred to the pixel
        expect(Math.abs(p.canvasW - p.imgW - 2 * p.x), tag).toBeLessThanOrEqual(1);
        expect(Math.abs(p.canvasH - p.imgH - 2 * p.y), tag).toBeLessThanOrEqual(1);
        expect(Math.max(p.canvasW, p.canvasH), tag).toBeLessThanOrEqual(OUTPAINT_MAX_SIDE);
        expect(p.canvasW * p.canvasH, tag).toBeLessThan(5000 * 5000);
        expect(p.canvasW % 2 + (p.canvasH % 2), tag).toBe(0);
        // the picture keeps its own shape, and something is really added
        expect(Math.abs(p.imgW / p.imgH - w / h) / (w / h), tag).toBeLessThan(0.01);
        expect(p.added, tag).toBeGreaterThan(0.01);
        if (shape === "all") expect(Math.abs(p.canvasW / p.imgW - OUTPAINT_ALL_SCALE), tag).toBeLessThan(0.01);
        else {
          const [a, b] = shape.split(":").map(Number);
          expect(Math.abs(p.canvasW / p.canvasH - a / b) / (a / b), tag).toBeLessThan(0.005);
          // the smallest such canvas: the picture touches two opposite sides
          expect(p.imgW === p.canvasW || p.imgH === p.canvasH, tag).toBe(true);
        }
      }
    }
  });

  it("square to 9:16 adds above and below, landscape to 1:1 adds above and below, portrait to 16:9 adds left and right", () => {
    expect(outpaintPlan(1024, 1024, "9:16")).toMatchObject({ canvasW: 1024, canvasH: 1820, imgW: 1024, imgH: 1024, x: 0, y: 398 });
    expect(outpaintPlan(1536, 1024, "1:1")).toMatchObject({ canvasW: 1536, canvasH: 1536, x: 0, y: 256 });
    expect(outpaintPlan(1080, 1920, "16:9")).toMatchObject({ canvasW: 3414, canvasH: 1920, y: 0 });
    expect(outpaintPlan(1024, 1024, "1:1")).toBeNull();
    expect(outpaintPlan(1024, 1024, "all")).toMatchObject({ canvasW: 1536, canvasH: 1536, x: 256, y: 256 });
    // too big: made smaller, the picture with it
    const big = outpaintPlan(4000, 3000, "9:16")!;
    expect(big.canvasH).toBe(OUTPAINT_MAX_SIDE);
    expect(big.imgW).toBe(big.canvasW);
  });
});

describe("prices (each from the provider's published cost)", () => {
  const usd = (e: ReturnType<typeof run>) => (e.price.ok ? e.price.usdCeiling : NaN);
  const coins = (e: ReturnType<typeof run>) => (e.price.ok ? e.price.coins : NaN);

  it("«امسحه» is one picture of the object remover, whatever its size", () => {
    for (const [w, h] of [[512, 512], [4096, 4096]]) {
      const e = run(inpaint, { action: "remove" }, [pic(w, h), pic(maskCanvasSize(w, h).width, maskCanvasSize(w, h).height, "mask")]);
      expect(e.issues).toEqual([]);
      expect(usd(e)).toBeCloseTo(IMAGE_TOOL_USD.erase);
      expect(coins(e)).toBe(coinsOf(centiFor(IMAGE_TOOL_USD.erase), priceKindOf(inpaint)));
    }
  });

  it("«بدّله» is per megapixel sent (rounded up, at most 4 MP), and an Arabic description adds its English line", () => {
    expect(fillMegapixels(1024, 1024)).toBe(2);
    expect(fillMegapixels(1000, 1000)).toBe(1);
    expect(fillMegapixels(4000, 3000)).toBe(INPAINT_MAX_MP);
    const sent = fitMegapixels(4000, 3000, INPAINT_MAX_MP);
    expect(sent.width * sent.height).toBeLessThanOrEqual(INPAINT_MAX_MP * 1e6);
    expect(Math.abs(sent.width / sent.height - 4 / 3)).toBeLessThan(0.01);
    const english = run(inpaint, { action: "replace" }, [pic(1024, 1024), pic(1024, 1024, "mask")], "a white coffee cup");
    expect(usd(english)).toBeCloseTo(2 * IMAGE_TOOL_USD.fillPerMp);
    const arabic = run(inpaint, { action: "replace" }, [pic(1024, 1024), pic(1024, 1024, "mask")], "كوب قهوة أبيض");
    expect(usd(arabic)).toBeCloseTo(2 * IMAGE_TOOL_USD.fillPerMp + IMAGE_TOOL_USD.translate);
    expect(arabic.price.ok && arabic.price.lines).toHaveLength(2);
    expect(needsEnglish("كوب")).toBe(true);
    expect(needsEnglish("  a cup ")).toBe(false);
  });

  it("follows the owner's price table (and stops when a line has no price)", () => {
    const table = { ...priceTable(inpaint, undefined), erase: 4321 };
    const e = run(inpaint, { action: "remove" }, [pic(512, 512), pic(512, 512, "mask")], "", table);
    expect(e.price.ok && e.price.lines[0].centi).toBe(4321);
    const none = run(inpaint, { action: "remove" }, [pic(512, 512), pic(512, 512, "mask")], "", { ...table, erase: null });
    expect(none.price.ok).toBe(false);
    // «✨ تحديد ذكي» has its own line (SAM 3 + Claude Haiku)
    expect(priceTable(inpaint, undefined)[SMART_SELECT_KEY]).toBe(centiFor(IMAGE_TOOL_USD.sam + IMAGE_TOOL_USD.translate));
  });

  it("«وسّع الصورة» is one fixed price", () => {
    expect(usd(run(outpaint, { shape: "9:16" }, [pic(1024, 1024)]))).toBeCloseTo(IMAGE_TOOL_USD.expand);
    expect(usd(run(outpaint, { shape: "all" }, [pic(4000, 3000)], "شارع بالليل"))).toBeCloseTo(IMAGE_TOOL_USD.expand + IMAGE_TOOL_USD.translate);
  });

  it("«ارفع الدقة»: SeedVR2 per megapixel of the result, Topaz by its size tier, nothing past 64 MP", () => {
    expect(usd(run(upscale, { factor: "2", engine: "seedvr" }, [pic(1024, 1024)]))).toBeCloseTo(5 * IMAGE_TOOL_USD.seedvrPerMp);
    expect(usd(run(upscale, { factor: "4", engine: "topaz" }, [pic(1024, 1024)]))).toBeCloseTo(0.08);
    expect(usd(run(upscale, { factor: "4", engine: "topaz" }, [pic(2048, 1536)]))).toBeCloseTo(0.32);
    expect(topazTier(30)?.usd).toBe(0.16);
    expect(topazTier(100)).toBeNull();
    expect(upscaleUsd(4096, 4096, 2, "seedvr")).toBeNull();
    expect(upscaleUsd(2000, 2000, 4, "seedvr")).toBeCloseTo(64 * IMAGE_TOOL_USD.seedvrPerMp);
  });
});

describe("the tools' rules", () => {
  it("«امسح بالفرشاة» needs the picture and its mask in the same shape, and words to replace with", () => {
    expect(run(inpaint, { action: "remove" }, [pic(1024, 1024)]).issues.some((i) => i.field === "refs")).toBe(true);
    expect(run(inpaint, { action: "remove" }, [pic(1024, 1024), pic(1024, 576, "mask")]).issues.map((i) => i.message).join(" ")).toMatch(/شكل/);
    expect(run(inpaint, { action: "replace" }, [pic(1024, 1024), pic(1024, 1024, "mask")]).issues.map((i) => i.field)).toContain("prompt");
    expect(run(inpaint, { action: "remove" }, [pic(1536, 1024), pic(1536, 1024, "mask")]).issues).toEqual([]);
    expect(run(inpaint, {}, [pic(1024, 1024), pic(1024, 1024, "mask")]).settings.action).toBe("remove");
    expect(run(inpaint, {}, []).mode.id).toBe("image_inpaint");
  });

  it("«وسّع الصورة» turns off the shape the picture already has", () => {
    const square = run(outpaint, { shape: "1:1" }, [pic(1024, 1024)]);
    expect(square.options.find((o) => o.key === "shape")?.disabledValues?.["1:1"]).toBeTruthy();
    expect(square.issues.some((i) => i.field === "shape")).toBe(true);
    expect(run(outpaint, { shape: "all" }, [pic(1024, 1024)]).issues).toEqual([]);
    expect(run(outpaint, { shape: "9:16" }, [pic(1080, 1920)]).issues.some((i) => i.field === "shape")).toBe(true);
    expect(run(outpaint, { shape: "9:16" }, [pic(1024, 1024)]).issues).toEqual([]);
    expect(run(outpaint, { shape: "9:16" }, []).issues.some((i) => i.field === "refs")).toBe(true);
  });

  it("«ارفع الدقة» turns off a factor whose result is too big, takes no words", () => {
    const big = run(upscale, { factor: "4" }, [pic(3000, 3000)]);
    expect(big.options.find((o) => o.key === "factor")?.disabledValues?.["4"]).toBeTruthy();
    expect(big.issues.some((i) => i.field === "factor")).toBe(true);
    expect(run(upscale, { factor: "2" }, [pic(3000, 3000)]).issues).toEqual([]);
    expect(run(upscale, { factor: "2" }, [pic(4096, 4096)]).issues.some((i) => i.field === "refs")).toBe(true);
    expect(run(upscale, { factor: "2" }, [pic(1024, 1024)], "sharper").issues.some((i) => i.field === "prompt")).toBe(true);
  });
});
