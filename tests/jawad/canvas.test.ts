import { describe, expect, it } from "vitest";
import {
  asRecipe,
  cleanGraph,
  fitRecipe,
  NODE_KINDS,
  nodeProblem,
  planPrice,
  planRun,
  promptOf,
  signatures,
  STARTER_RECIPES,
  topoOrder,
  validateGraph,
  wireProblem,
  type CanvasGraph,
  type CanvasNode,
  type NodeKind,
} from "@config/jawad/canvas";
import { GENERATORS, generatorById } from "@config/jawad/generators";
import { FILM_STYLES } from "@config/film-styles";
import { FEATURES } from "@config/feature-use";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";
import { RESERVED_SECTION_IDS } from "@config/jawad/sections";

const node = (id: string, kind: NodeKind, data: CanvasNode["data"] = {}): CanvasNode => ({ id, kind, x: 0, y: 0, data });
const graph = (nodes: CanvasNode[], wires: [string, string, string][] = []): CanvasGraph => ({ v: 1, nodes, edges: wires.map(([from, to, port], i) => ({ id: `e${i}`, from, to, port })), runs: {} });
const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** text → image → video, image → upscale; a second text → music */
function chain(): CanvasGraph {
  return graph(
    [
      node("t", "text", { text: "a lighthouse" }),
      node("i", "image", { generatorId: "openai-gpt-image-2" }),
      node("v", "video", { generatorId: "wan-3-0", imageAs: "first_frame" }),
      node("u", "tool", { generatorId: "image-upscale" }),
      node("m", "text", { text: "calm music" }),
      node("a", "audio", { generatorId: "elevenlabs-music-v2-5" }),
      node("r", "result"),
    ],
    [
      ["t", "i", "prompt"],
      ["i", "v", "images"],
      ["i", "u", "image"],
      ["m", "a", "prompt"],
      ["v", "r", "media"],
      ["a", "r", "media"],
      ["u", "r", "media"],
    ],
  );
}
/** every generator node finished with the inputs it has now */
function allDone(g: CanvasGraph): CanvasGraph {
  let cur = g;
  let n = 1;
  for (const id of topoOrder(g)!) {
    if (!NODE_KINDS[g.nodes.find((x) => x.id === id)!.kind].runs) continue;
    const sig = signatures(cur)[id];
    cur = { ...cur, runs: { ...cur.runs, [id]: { sig, jobId: UUID(n), outputId: UUID(100 + n), kind: "image" } } };
    n++;
  }
  return cur;
}

describe("«اللوحة»: wires are type-checked", () => {
  const g = chain();
  it("text goes into a prompt, a picture into references or frames", () => {
    expect(wireProblem(g, "t", "v", "prompt")).toBeNull();
    expect(wireProblem(g, "i", "a", "prompt")).toMatch(/ما يقبل/);
    expect(wireProblem(g, "t", "i", "refs")).toMatch(/ما يقبل/);
    expect(wireProblem(g, "a", "v", "clips")).toBeNull();
    expect(wireProblem(g, "r", "i", "refs")).toMatch(/ما يطلع/);
  });
  it("a single input takes one wire, a wire is never doubled, a node never feeds itself", () => {
    const two = graph([...g.nodes, node("p", "upload", { uploadId: UUID(1) })], [["i", "u", "image"]]);
    expect(wireProblem(two, "p", "u", "image")).toMatch(/سلك واحد/);
    expect(wireProblem(g, "t", "i", "prompt")).toMatch(/موجود/);
    expect(wireProblem(g, "i", "i", "refs")).toMatch(/بنفسها/);
  });
  it("a valid graph has no issues; a mistyped wire is reported", () => {
    expect(validateGraph(g)).toEqual([]);
    const bad = { ...g, edges: [...g.edges, { id: "x", from: "a", to: "i", port: "refs" }] };
    expect(validateGraph(bad).map((i) => i.edgeId)).toEqual(["x"]);
  });
  it("cycles are rejected", () => {
    const loop = graph([node("a", "image", { generatorId: "openai-gpt-image-2" }), node("b", "image", { generatorId: "openai-gpt-image-2" })], [["a", "b", "refs"]]);
    expect(wireProblem(loop, "b", "a", "refs")).toMatch(/دائرة/);
    const forced = { ...loop, edges: [...loop.edges, { id: "back", from: "b", to: "a", port: "refs" }] };
    expect(validateGraph(forced).some((i) => i.edgeId === "back")).toBe(true);
    expect(topoOrder(forced)).toBeNull();
    expect(planRun(forced)).toEqual({ run: [], cached: [] });
  });
});

describe("«اللوحة»: run order", () => {
  it("every node runs after everything it takes from (ties keep the canvas order)", () => {
    const g = chain();
    const order = topoOrder(g)!;
    for (const e of g.edges) expect(order.indexOf(e.from), `${e.from}→${e.to}`).toBeLessThan(order.indexOf(e.to));
    expect(planRun(g).run).toEqual(["i", "v", "u", "a"]);
  });
  it("«شغّل هذي» runs the node and what it needs, nothing else", () => {
    expect(planRun(chain(), { target: "v" }).run).toEqual(["i", "v"]);
    expect(planRun(chain(), { target: "a" }).run).toEqual(["a"]);
  });
  it("the prompt is the wired words then the node's own", () => {
    const g = chain();
    g.nodes.find((n) => n.id === "i")!.data.text = "wide shot";
    expect(promptOf(g, "i")).toBe("a lighthouse\nwide shot");
  });
  it("a node says what is missing before it can run", () => {
    expect(nodeProblem(chain(), node("x", "tool", { generatorId: "image-upscale" }))).toMatch(/الصورة/);
    expect(nodeProblem(chain(), node("x", "image"))).toMatch(/المولّد/);
    expect(nodeProblem(chain(), node("x", "upload"))).toMatch(/صورة/);
  });
});

describe("«اللوحة»: price and cache", () => {
  it("the total is the sum of the nodes that will run", () => {
    const prices: Record<string, number> = { i: 120, v: 900, u: 15, a: 300 };
    const plan = planRun(chain());
    const p = planPrice(plan, (id) => prices[id]);
    expect(p.total).toBe(120 + 900 + 15 + 300);
    expect(p.unknown).toEqual([]);
    const partial = planPrice({ run: ["i", "v"], cached: ["a"] }, (id) => (id === "v" ? null : prices[id]));
    expect(partial).toEqual({ total: 120, each: { i: 120, v: null }, unknown: ["v"] });
  });
  it("finished results whose inputs did not change are reused (nothing to pay)", () => {
    const done = allDone(chain());
    const plan = planRun(done);
    expect(plan.run).toEqual([]);
    expect(plan.cached).toEqual(["i", "v", "u", "a"]);
    expect(planPrice(plan, () => 999).total).toBe(0);
  });
  it("a change reruns that node and everything after it, and only those", () => {
    const done = allDone(chain());
    const changed = { ...done, nodes: done.nodes.map((n) => (n.id === "t" ? { ...n, data: { text: "a castle" } } : n)) };
    expect(planRun(changed).run).toEqual(["i", "v", "u"]);
    expect(planRun(changed).cached).toEqual(["a"]);
    const music = { ...done, nodes: done.nodes.map((n) => (n.id === "a" ? { ...n, data: { ...n.data, settings: { duration: 30 } } } : n)) };
    expect(planRun(music).run).toEqual(["a"]);
  });
  it("moving or renaming a node changes nothing", () => {
    const done = allDone(chain());
    const moved = { ...done, nodes: done.nodes.map((n) => ({ ...n, x: n.x + 50, data: { ...n.data, title: "x" } })) };
    expect(planRun(moved).run).toEqual([]);
  });
  it("«من جديد» forces a node; what comes after it in that run runs too", () => {
    const done = allDone(chain());
    expect(planRun(done, { force: ["i"] }).run).toEqual(["i", "v", "u"]);
    expect(planRun(done, { target: "i", force: ["i"] }).run).toEqual(["i"]);
  });
  it("a node after one regenerated (a new output) is no longer fresh", () => {
    const done = allDone(chain());
    const again = { ...done, runs: { ...done.runs, i: { ...done.runs.i, outputId: UUID(999) } } };
    expect(planRun(again).run).toEqual(["v", "u"]);
  });
});

describe("«اللوحة»: the server keeps only a checked graph", () => {
  it("unknown kinds, bad ids, mistyped wires and foreign fields are dropped", () => {
    const raw = {
      nodes: [
        { id: "a", kind: "text", x: 1.4, y: "no", data: { text: "hi", evil: "<script>" } },
        { id: "b", kind: "image", x: 0, y: 0, data: { generatorId: "openai-gpt-image-2", settings: { aspect: "16:9", "bad key": 1, n: { deep: true } } } },
        { id: "c", kind: "laser", x: 0, y: 0 },
        { id: "bad id!", kind: "text" },
      ],
      edges: [
        { id: "w1", from: "a", to: "b", port: "prompt" },
        { id: "w2", from: "b", to: "a", port: "prompt" },
        { id: "w3", from: "a", to: "c", port: "x" },
      ],
      runs: { b: { sig: "s", jobId: UUID(1), outputId: UUID(2), kind: "image" }, a: { sig: "s", jobId: UUID(1), outputId: UUID(2), kind: "image" } },
    };
    const r = cleanGraph(raw);
    expect("graph" in r).toBe(true);
    if (!("graph" in r)) return;
    expect(r.graph.nodes.map((n) => n.id)).toEqual(["a", "b"]);
    expect(r.graph.nodes[0]).toEqual({ id: "a", kind: "text", x: 1, y: 0, data: { text: "hi" } });
    expect(r.graph.nodes[1].data.settings).toEqual({ aspect: "16:9" });
    expect(r.graph.edges.map((e) => e.id)).toEqual(["w1"]);
    expect(Object.keys(r.graph.runs)).toEqual(["b"]);
    expect(cleanGraph(raw, false)).toMatchObject({ graph: { runs: {} } });
  });
  it("a recipe keeps no results and no picture of the person's", () => {
    const g = { ...allDone(chain()), nodes: [...chain().nodes, node("p", "upload", { uploadId: UUID(5), title: "صورتك" })] };
    const r = asRecipe(g);
    expect(r.runs).toEqual({});
    expect(r.nodes.find((n) => n.id === "p")!.data).toEqual({ title: "صورتك" });
  });
  it("too big a graph is refused", () => {
    expect(cleanGraph({ nodes: Array.from({ length: 61 }, (_, i) => ({ id: `n${i}`, kind: "text" })), edges: [] })).toHaveProperty("error");
  });
});

describe("«اللوحة»: the ready recipes", () => {
  it("there are six, each a valid graph that can be planned", () => {
    expect(STARTER_RECIPES).toHaveLength(6);
    expect(new Set(STARTER_RECIPES.map((r) => r.id)).size).toBe(6);
    for (const r of STARTER_RECIPES) {
      expect(validateGraph(r.graph), r.id).toEqual([]);
      expect(topoOrder(r.graph), r.id).not.toBeNull();
      expect(planRun(r.graph).run.length, r.id).toBeGreaterThan(0);
      expect(r.graph.nodes.some((n) => n.kind === "result"), r.id).toBe(true);
      expect(cleanGraph(r.graph), r.id).toEqual({ graph: r.graph });
    }
  });
  it("name real generators of the right kind and real styles", () => {
    for (const r of STARTER_RECIPES) {
      for (const n of r.graph.nodes) {
        if (NODE_KINDS[n.kind].runs) {
          const def = generatorById(n.data.generatorId ?? "");
          expect(def, `${r.id}/${n.id}`).toBeDefined();
          expect(def!.output, `${r.id}/${n.id}`).toBe(NODE_KINDS[n.kind].generates);
        }
        if (n.data.styleId) expect(FILM_STYLES.some((s) => s.id === n.data.styleId), n.data.styleId).toBe(true);
      }
    }
  });
  it("show no realistic adult women and nothing regional in dress", () => {
    const words = JSON.stringify(STARTER_RECIPES.map((r) => r.graph.nodes.map((n) => n.data.text ?? "")));
    expect(words).not.toMatch(/\b(woman|women|girl|lady|female|model|thobe|ghutra|abaya|gulf|arab)\b/i);
  });
  it("fit a person's generators: unavailable ones become the first of the same kind, ids are new", () => {
    const r = STARTER_RECIPES.find((x) => x.id === "prompt-to-film")!;
    let n = 0;
    const fitted = fitRecipe(r.graph, { image: ["bfl-flux-2-pro"], video: ["wan-3-0"], audio: [], tool: [] }, () => `k${n++}`);
    expect(validateGraph(fitted)).toEqual([]);
    expect(fitted.nodes.find((x) => x.kind === "image")!.data.generatorId).toBe("bfl-flux-2-pro");
    expect(fitted.nodes.find((x) => x.kind === "video")!.data.generatorId).toBe("wan-3-0");
    expect(fitted.nodes.find((x) => x.kind === "audio")!.data.generatorId).toBeUndefined();
    expect(fitted.nodes.every((x) => /^k\d+$/.test(x.id))).toBe(true);
  });
});

describe("«اللوحة»: the platform knows it", () => {
  it("is described, tracked, and its address is reserved", () => {
    expect(JAWAD_KNOWLEDGE).toContain("/jawad-ai/canvas");
    expect(FEATURES.filter((f) => f.id.startsWith("studio.canvas_")).length).toBeGreaterThanOrEqual(5);
    expect(RESERVED_SECTION_IDS).toContain("canvas");
    // every generator a node can use exists in the registry
    expect(GENERATORS.some((g) => g.output === "video")).toBe(true);
  });
});
