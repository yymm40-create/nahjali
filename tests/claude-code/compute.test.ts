import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { checkProgram, COMPUTE_CSP, COMPUTE_KIT_JS, computeDoc, GRADE_LUT_SIZE } from "@/lib/claude-code/compute";
import { CODE_PASS, CODE_ROUNDS, EDIT_CONTRACT, EDIT_RUBRIC, GRADE_CONTRACT, GRADE_RUBRIC } from "@/lib/claude-code/skill";
import { codeLayer, CODE_LAYER_NAME } from "@/components/jawad/editor/claude-code";
import { MAX_LAYERS, NEUTRAL_GRADE } from "@/lib/editor/grade";

type C = { r: number; g: number; b: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const K: any = runInNewContext(`${COMPUTE_KIT_JS}; K`, { Math });
const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
/** A grade program sampled the way the page samples it. */
function sample(code: string, n = 9) {
  const fn = new Function("K", `${code}\n;return grade;`)(K) as (c: C, k: unknown) => number[] | C;
  const out: number[][] = [];
  for (let b = 0; b < n; b++) for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) {
    const v = fn({ r: r / (n - 1), g: g / (n - 1), b: b / (n - 1) }, K);
    out.push(Array.isArray(v) ? v : [v.r, v.g, v.b]);
  }
  return out;
}

describe("«Claude Code» · the compute page", () => {
  it("lets nothing out: no network, no frames, no workers", () => {
    expect(COMPUTE_CSP).toContain("default-src 'none'");
    expect(COMPUTE_CSP).toContain("connect-src 'none'");
    expect(COMPUTE_CSP).toContain("worker-src 'none'");
    const doc = computeDoc();
    expect(doc).toContain(COMPUTE_CSP);
    expect(doc).not.toMatch(/https?:\/\//);
    // the host gives every run its own sandbox with scripts only (no same-origin) and a time limit
    const host = read("src/components/claude-code/compute-host.ts");
    expect(host).toContain('setAttribute("sandbox", "allow-scripts")');
    expect(host).toContain("TIMEOUT_MS");
    expect(host).toContain("el.remove()");
  });

  it("checks a program before it runs", () => {
    expect(checkProgram("grade", "function grade(c, K) { return [c.r, c.g, c.b]; }").ok).toBe(true);
    expect(checkProgram("edit", "function edit(T, K) { return []; }").ok).toBe(true);
    expect(checkProgram("grade", "function edit(T, K) { return []; }").problems.join()).toContain("function grade");
    expect(checkProgram("edit", "function edit(T){ fetch('x'); return [] }").problems.join()).toContain("network");
    expect(checkProgram("grade", "function grade(c){ return [Math.random(),0,0] }").problems.join()).toContain("randomness");
    expect(checkProgram("edit", "function edit(T){ window.x = 1; return [] }").problems.join()).toContain("page");
    expect(checkProgram("grade", "```js\nfunction grade(c, K) { return c; }\n```").code).toBe("function grade(c, K) { return c; }");
  });

  it("the grade kit: identity stays identity, curves are smooth and monotone, skin is found", () => {
    const id = sample("function grade(c, K) { return [c.r, c.g, c.b]; }");
    for (const [i, v] of id.entries()) {
      const n = 9, r = (i % n) / (n - 1), g = (Math.floor(i / n) % n) / (n - 1), b = Math.floor(i / n / n) / (n - 1);
      expect(v[0]).toBeCloseTo(r, 6);
      expect(v[1]).toBeCloseTo(g, 6);
      expect(v[2]).toBeCloseTo(b, 6);
    }
    const s = K.curve([[0, 0.03], [0.25, 0.2], [0.75, 0.82], [1, 0.97]]);
    let prev = -1;
    for (let x = 0; x <= 1.0001; x += 0.01) {
      const y = s(x);
      expect(y).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = y;
    }
    expect(s(0)).toBeCloseTo(0.03, 3);
    expect(s(1)).toBeCloseTo(0.97, 3);
    expect(K.skin({ r: 0.85, g: 0.62, b: 0.5 })).toBeGreaterThan(0.6);
    expect(K.skin({ r: 0.2, g: 0.4, b: 0.9 })).toBeLessThan(0.05);
    const warm = K.temperature({ r: 0.5, g: 0.5, b: 0.5 }, 0.5);
    expect(warm.r).toBeGreaterThan(warm.b);
    expect(K.luma(warm)).toBeCloseTo(0.5, 5);
    const back = K.fromHsl(K.toHsl({ r: 0.3, g: 0.6, b: 0.2 }));
    expect(back.r).toBeCloseTo(0.3, 5);
    expect(back.g).toBeCloseTo(0.6, 5);
    expect(K.filmic(0.5)).toBe(0.5);
    expect(K.filmic(5)).toBeLessThan(1);
  });

  it("a colourist's program samples into numbers the LUT can hold", () => {
    const lut = sample(`function grade(c, K) {
      // balance → contrast → colour → finish
      var x = K.temperature(c, 0.15);
      var f = K.curve([[0, 0.04], [0.5, 0.48], [1, 0.96]]);
      x = { r: f(x.r), g: f(x.g), b: f(x.b) };
      x = K.lerpColor(K.vibrance(x, 1.15), c, 0.6 * K.skin(c));
      return [K.filmic(x.r), K.filmic(x.g), K.filmic(x.b)];
    }`);
    for (const v of lut) for (const x of v) expect(Number.isFinite(x)).toBe(true);
    expect(GRADE_LUT_SIZE ** 3 * 3).toBeLessThan(60_000);
  });

  it("the edit kit: ranges merged, padded and inverted; words and clips read from T", () => {
    expect(K.merge([[500, 900], [0, 200], [880, 1200]], 0)).toEqual([[0, 200], [500, 1200]]);
    expect(K.merge([[0, 100], [300, 400]], 250)).toEqual([[0, 400]]);
    expect(K.pad([[1000, 2000], [0, 100]], 150, 150)).toEqual([[1150, 1850]]);
    expect(K.invert([[100, 200], [500, 600]], 0, 1000)).toEqual([[0, 100], [200, 500], [600, 1000]]);
    expect(K.total([[0, 100], [300, 450]])).toBe(250);
    const T = { tracks: [{ id: "v", kind: "video", clips: [{ id: "b", start: 2000 }, { id: "a", start: 0 }] }, { id: "m", kind: "audio", clips: [{ id: "s", start: 0 }] }], speech: [{ clipId: "a", phrases: [[1200, 1500, "ثاني"], [100, 900, "أول"]] }] };
    expect(K.words(T).map((w: { w: string }) => w.w)).toEqual(["أول", "ثاني"]);
    expect(K.clipsOf(T, "video").map((c: { id: string; trackId: string }) => `${c.trackId}/${c.id}`)).toEqual(["v/a", "v/b"]);
    expect(K.main(T).id).toBe("v");
    expect(K.find(T, "s").track.id).toBe("m");
  });
});

describe("«Claude Code» · حيدرة executes by program", () => {
  it("writes, runs, fixes, reviews by a rubric, and applies only at the bar", () => {
    expect(CODE_PASS).toBe(8);
    expect(CODE_ROUNDS).toBeGreaterThanOrEqual(2);
    expect(GRADE_RUBRIC.map((r) => r.id)).toEqual(expect.arrayContaining(["ask", "skin", "tone"]));
    expect(EDIT_RUBRIC.map((r) => r.id)).toEqual(expect.arrayContaining(["ask", "flow", "clean"]));
    expect(GRADE_CONTRACT).toContain("function grade(c, K)");
    expect(EDIT_CONTRACT).toContain("function edit(T, K)");
    const loop = read("src/components/jawad/editor/claude-code.ts");
    expect(loop).toContain('"code_edit_write"');
    expect(loop).toContain('"code_edit_review"');
    expect(loop).toContain('"code_grade_review"');
    expect(loop).toContain("checkCommands(start");
    const route = read("src/app/api/jawad/editor/projects/[id]/route.ts");
    for (const a of ["code_edit_write", "code_edit_review", "code_grade_write", "code_grade_review"]) expect(route).toContain(`case "${a}"`);
    const assistant = read("src/lib/editor/assistant.ts");
    expect(assistant).toContain("YOU ARE CLAUDE CODE");
    expect(assistant).toContain('"code_edit", "code_grade"');
    expect(read("src/components/jawad/editor/AssistantPanel.tsx")).toContain('q.kind === "code_edit" || q.kind === "code_grade"');
  });

  it("puts the grade on its own layer «Claude Code», and on the same one next time", () => {
    expect(codeLayer([])).toBe(0);
    expect(codeLayer([{ ...NEUTRAL_GRADE, name: "أساسي" }])).toBe(1);
    expect(codeLayer([{ ...NEUTRAL_GRADE, name: "أساسي" }, { ...NEUTRAL_GRADE, name: CODE_LAYER_NAME }, { ...NEUTRAL_GRADE }])).toBe(1);
    expect(codeLayer(Array.from({ length: MAX_LAYERS }, () => ({ ...NEUTRAL_GRADE })))).toBe(MAX_LAYERS - 1);
  });
});

describe("«Claude Code» · pictures drawn in code in the image studio", () => {
  it("draws, looks, rewrites and keeps the picture in «أعمالي»", async () => {
    const { PICTURE_RUBRIC, pictureSize } = await import("@/lib/claude-code/picture-rubric");
    expect(PICTURE_RUBRIC.map((r) => r.id)).toEqual(expect.arrayContaining(["ask", "type", "composition"]));
    expect(pictureSize("16:9")).toEqual([1920, 1080]);
    expect(pictureSize("nope")).toEqual(pictureSize("1:1"));
    const draw = read("src/components/claude-code/draw.ts");
    expect(draw).toContain("new SceneHost()");
    expect(draw).toContain("host.frame(0)");
    expect(draw).toContain('action: "review"');
    expect(draw).toContain("host.destroy()");
    const save = read("src/lib/jawad/server/claude-code-picture.ts");
    expect(save).toContain('generator_id: CLAUDE_CODE_GENERATOR');
    expect(save).toContain("price_coins: 0");
    expect(save).toContain("idempotency_key");
    expect(read("src/lib/claude-code/picture.ts")).toContain("robotTurn(");
    expect(read("src/components/jawad/studio/Studio.tsx")).toContain("<ClaudeCodeCard<JobView>");
    expect(read("config/jawad/assistant.ts")).toContain("ارسم بـ Claude Code");
    expect(read("config/jawad/knowledge.ts")).toContain("THE WAY THE SITE'S ROBOTS EXECUTE");
  });
});

describe("«Claude Code» · زهراء and كاظم", () => {
  it("زهراء: the program's LUT lies on the base, read safely, taken off by reset or by its own op", async () => {
    const { applyOp, readDoc, readPhotoLut, docFromPicture, describeDoc } = await import("@/lib/photo/doc");
    const { applyLut } = await import("@/lib/photo/pixels");
    const n = 3;
    const id = new Uint8Array(n * n * n * 3);
    for (let b = 0; b < n; b++) for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) {
      const i = ((b * n + g) * n + r) * 3;
      id[i] = Math.round((r / (n - 1)) * 255);
      id[i + 1] = Math.round((g / (n - 1)) * 255);
      id[i + 2] = Math.round((b / (n - 1)) * 255);
    }
    const px = new Uint8ClampedArray([10, 128, 250, 255, 200, 30, 90, 255]);
    const copy = new Uint8ClampedArray(px);
    applyLut(copy, n, id);
    for (let i = 0; i < px.length; i++) expect(Math.abs(copy[i] - px[i])).toBeLessThanOrEqual(1);
    const data = Buffer.from(id).toString("base64");
    expect(readPhotoLut({ size: 3, data })).toEqual({ name: "Claude Code", size: 3, data });
    expect(readPhotoLut({ size: 4, data })).toBeNull();
    expect(readPhotoLut({ size: 3, data: "x!" })).toBeNull();
    const doc = docFromPicture({ id: "f", w: 800, h: 600 });
    const r = applyOp(doc, { op: "lut", size: 3, data } as never);
    expect("doc" in r && r.doc.lut?.size).toBe(3);
    const withLut = (r as { doc: typeof doc }).doc;
    expect(readDoc(JSON.parse(JSON.stringify(withLut))).lut?.data).toBe(data);
    expect(describeDoc(withLut)).toContain("Claude Code");
    const off = applyOp(withLut, { op: "lut", clear: true } as never);
    expect("doc" in off && off.doc.lut).toBeNull();
    const reset = applyOp(withLut, { op: "adjust_reset" } as never);
    expect("doc" in reset && reset.doc.lut).toBeNull();
    expect(read("src/components/jawad/photo/render.ts")).toContain("applyLut(data.data, lut.size");
    expect(read("src/lib/photo/chat.ts")).toContain("claude_code");
    expect(read("src/components/jawad/photo/PhotoEditor.tsx")).toContain("runCodeGrade(r.code.prompt)");
    expect(read("src/app/api/photo/code/route.ts")).toContain("gradeReview");
  });

  it("كاظم: «Claude Code» draws the design in the page, always with its writing, and keeps it as the artwork", () => {
    const chat = read("src/lib/designer/chat.ts");
    expect(chat).toContain('maker: { type: "string", enum: ["gpt", "code"]');
    expect(chat).toContain('maker === "code" ? "baked"');
    const produce = read("src/lib/designer/produce.ts");
    expect(produce).toContain("export async function codeBrief");
    expect(produce).toContain("export async function produceFromCode");
    expect(produce).toContain('maker: "code"');
    expect(read("src/components/jawad/designer/DesignerChat.tsx")).toContain('from: "designer"');
    expect(read("config/designer.ts")).toContain("«Claude Code» (maker = \"code\")");
    expect(read("src/lib/jawad/server/claude-code-picture.ts")).toContain('from === "designer"');
  });
});
