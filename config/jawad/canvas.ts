// «الجواد الذكي!» | JAWAD AI — «اللوحة» (/jawad-ai/canvas), the pure part: the nodes and their ports, the wires and
// their type check, the order a canvas runs in, which nodes a run really needs (a finished result whose inputs did not
// change is reused, so a rerun pays only for what changed), the total price of a run, the check of a graph before the
// server keeps it, and the ready recipes. Shared by the page, the server (src/lib/jawad/server/canvas.ts) and
// tests/jawad/canvas.test.ts — no server imports here.
//
// Every generation a canvas runs is an ordinary studio job (the same /api/jawad/generate, price check, hold, refund and
// «أعمالي»); nothing here charges anything.

import type { OutputKind, Settings, SettingValue } from "./types";

// ───────────────────────────── nodes and ports ─────────────────────────────

/** What travels along a wire. */
export type PortType = "text" | "image" | "video" | "audio" | "style" | "brand";
export type NodeKind = "text" | "upload" | "image" | "video" | "audio" | "tool" | "style" | "brand" | "result";

export interface PortDef {
  id: string;
  label: string;
  accepts: PortType[];
  /** more than one wire may come in */
  many: boolean;
  /** the node cannot run without it */
  required?: boolean;
}

export interface NodeKindDef {
  kind: NodeKind;
  label: string;
  /** an icon name of src/components/jawad/Icon.tsx */
  icon: string;
  hint: string;
  inputs: PortDef[];
  /** what its single output carries (none: an end node) */
  output: PortType | null;
  /** it makes a studio job when it runs */
  runs: boolean;
  /** the kind of the generators it uses */
  generates?: OutputKind;
}

const PROMPT: PortDef = { id: "prompt", label: "البرومبت", accepts: ["text"], many: true };
const STYLE: PortDef = { id: "style", label: "الستايل", accepts: ["style"], many: false };
const BRAND: PortDef = { id: "brand", label: "هويتي", accepts: ["brand"], many: false };

export const NODE_KINDS: Record<NodeKind, NodeKindDef> = {
  text: { kind: "text", label: "نص / برومبت", icon: "type", hint: "وصف يدخل في برومبت أي مولّد توصله فيه.", inputs: [], output: "text", runs: false },
  upload: { kind: "upload", label: "صورة مرفوعة", icon: "upload", hint: "صورة من جهازك أو من «ملفاتي»: مرجع أو أول لقطة.", inputs: [], output: "image", runs: false },
  image: {
    kind: "image",
    label: "توليد صورة",
    icon: "image",
    hint: "أي مولّد صور بإعداداته؛ الصور الموصولة تصير مراجع.",
    inputs: [PROMPT, { id: "refs", label: "مراجع", accepts: ["image"], many: true }, STYLE, BRAND],
    output: "image",
    runs: true,
    generates: "image",
  },
  video: {
    kind: "video",
    label: "توليد فيديو",
    icon: "video",
    hint: "أي مولّد فيديو؛ الصورة الموصولة أول لقطة أو مرجع (تختار).",
    inputs: [PROMPT, { id: "images", label: "صور", accepts: ["image"], many: true }, { id: "clips", label: "فيديو/صوت مرجع", accepts: ["video", "audio"], many: true }, STYLE, BRAND],
    output: "video",
    runs: true,
    generates: "video",
  },
  audio: { kind: "audio", label: "صوت", icon: "audio", hint: "كلام بصوت، موسيقى، أو مؤثر صوتي من وصف.", inputs: [PROMPT], output: "audio", runs: true, generates: "audio" },
  tool: {
    kind: "tool",
    label: "أداة صورة",
    icon: "wand",
    hint: "وسّع الصورة، ارفع دقتها، أو امسح/عدّل جزء منها.",
    inputs: [{ id: "image", label: "الصورة", accepts: ["image"], many: false, required: true }, PROMPT],
    output: "image",
    runs: true,
    generates: "image",
  },
  style: { kind: "style", label: "ستايل", icon: "palette", hint: "ستايل من المكتبة أو واحد من «ذوقي».", inputs: [], output: "style", runs: false },
  brand: { kind: "brand", label: "هويتي", icon: "diamond", hint: "ألوانك وخطوطك ونبرتك (والشعار إذا تبي).", inputs: [], output: "brand", runs: false },
  result: { kind: "result", label: "نتيجة", icon: "check", hint: "يجمع النتائج النهائية في مكان واحد.", inputs: [{ id: "media", label: "النتائج", accepts: ["image", "video", "audio"], many: true }], output: null, runs: false },
};
export const NODE_KIND_ORDER: NodeKind[] = ["text", "upload", "image", "video", "audio", "tool", "style", "brand", "result"];
export const isNodeKind = (v: unknown): v is NodeKind => typeof v === "string" && v in NODE_KINDS;

/** The tools a «أداة صورة» node runs (config/jawad/image-tools.ts); the inpaint one needs the person's own painting. */
export const CANVAS_TOOL_IDS = ["image-outpaint", "image-upscale", "image-inpaint"] as const;
export const MANUAL_TOOL_ID = "image-inpaint";

// ───────────────────────────── the graph ─────────────────────────────

export interface NodeData {
  /** a name the person gave the node */
  title?: string;
  /** text: the words · a generator or tool: words added after what comes in by wire */
  text?: string;
  /** upload: the person's checked upload */
  uploadId?: string;
  /** image · video · audio · tool */
  generatorId?: string;
  settings?: Settings;
  /** video: what the connected pictures are (first picture = first frame, a second = last frame) */
  imageAs?: "first_frame" | "reference";
  /** style: one of the library's styles… */
  styleId?: string;
  /** …or one of the person's tastes («ذوقي») */
  tasteId?: string;
  /** brand: put the logo in too (pictures that take references) */
  logo?: boolean;
}

export interface CanvasNode {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  data: NodeData;
}

/** A wire from a node's output to one input port of another node. */
export interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  port: string;
}

/** A node's last finished result (kept with the canvas, so a rerun reuses it while nothing it depends on changed). */
export interface NodeRun {
  /** the node's input signature when it ran */
  sig: string;
  jobId: string;
  outputId: string;
  kind: OutputKind;
  /** the result copied once into the person's references (when a later node used it) */
  uploadId?: string;
}

export interface CanvasGraph {
  v: 1;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  runs: Record<string, NodeRun>;
}

export const MAX_NODES = 60;
export const MAX_EDGES = 160;
export const MAX_TEXT = 4000;
export const MAX_GRAPH_CHARS = 200_000;
export const CANVAS_NAME_MAX = 60;

export const emptyGraph = (): CanvasGraph => ({ v: 1, nodes: [], edges: [], runs: {} });
export const portOf = (kind: NodeKind, port: string) => NODE_KINDS[kind].inputs.find((p) => p.id === port);

export interface GraphIssue {
  nodeId?: string;
  edgeId?: string;
  message: string;
}

/** Why a wire from `from` into `to`'s `port` cannot be made (null: it can). Types, single ports and cycles are checked. */
export function wireProblem(g: Pick<CanvasGraph, "nodes" | "edges">, from: string, to: string, port: string, ignoreEdge?: string): string | null {
  const a = g.nodes.find((n) => n.id === from);
  const b = g.nodes.find((n) => n.id === to);
  if (!a || !b) return "العقدة غير موجودة.";
  if (a.id === b.id) return "ما تقدر توصل العقدة بنفسها.";
  const out = NODE_KINDS[a.kind].output;
  if (!out) return `«${NODE_KINDS[a.kind].label}» ما يطلع منها شي.`;
  const p = portOf(b.kind, port);
  if (!p) return "هذا المدخل غير موجود.";
  if (!p.accepts.includes(out)) return `«${p.label}» ما يقبل ${TYPE_AR[out]}.`;
  const edges = g.edges.filter((e) => e.id !== ignoreEdge);
  if (edges.some((e) => e.from === from && e.to === to && e.port === port)) return "هالسلك موجود.";
  if (!p.many && edges.some((e) => e.to === to && e.port === port)) return `«${p.label}» ياخذ سلك واحد بس.`;
  if (reaches(edges, to, from)) return "هالسلك يسوي دائرة (العقدة بترجع لنفسها).";
  return null;
}

export const TYPE_AR: Record<PortType, string> = { text: "نص", image: "صورة", video: "فيديو", audio: "صوت", style: "ستايل", brand: "هوية" };

/** Whether `target` can be reached from `start` along the wires. */
function reaches(edges: CanvasEdge[], start: string, target: string) {
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === target) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const e of edges) if (e.from === id) stack.push(e.to);
  }
  return false;
}

/** Everything wrong with a graph's shape (unknown kinds, broken or mistyped wires, cycles). Empty: it is valid. */
export function validateGraph(g: CanvasGraph): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const ids = new Set<string>();
  for (const n of g.nodes) {
    if (!isNodeKind(n.kind)) issues.push({ nodeId: n.id, message: "نوع عقدة غير معروف." });
    if (ids.has(n.id)) issues.push({ nodeId: n.id, message: "عقدتان بنفس الرقم." });
    ids.add(n.id);
  }
  if (g.nodes.length > MAX_NODES) issues.push({ message: `اللوحة تاخذ ${MAX_NODES} عقدة كحد أعلى.` });
  if (g.edges.length > MAX_EDGES) issues.push({ message: `اللوحة تاخذ ${MAX_EDGES} سلك كحد أعلى.` });
  const kept: CanvasEdge[] = [];
  for (const e of g.edges) {
    const why = wireProblem({ nodes: g.nodes, edges: kept }, e.from, e.to, e.port);
    // a cycle is reported once, as a cycle (the wire that closes it)
    if (why) issues.push({ edgeId: e.id, message: why });
    else kept.push(e);
  }
  return issues;
}

/** The order the nodes run in (each after everything it takes from); null when the wires make a cycle. Stable: ties keep the canvas's order. */
export function topoOrder(g: Pick<CanvasGraph, "nodes" | "edges">): string[] | null {
  const indeg = new Map(g.nodes.map((n) => [n.id, 0]));
  for (const e of g.edges) if (indeg.has(e.from) && indeg.has(e.to)) indeg.set(e.to, indeg.get(e.to)! + 1);
  const order: string[] = [];
  const ready = g.nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  const pos = new Map(g.nodes.map((n, i) => [n.id, i]));
  while (ready.length) {
    ready.sort((a, b) => pos.get(a)! - pos.get(b)!);
    const id = ready.shift()!;
    order.push(id);
    for (const e of g.edges) {
      if (e.from !== id || !indeg.has(e.to)) continue;
      const d = indeg.get(e.to)! - 1;
      indeg.set(e.to, d);
      if (d === 0) ready.push(e.to);
    }
  }
  return order.length === g.nodes.length ? order : null;
}

/** The nodes wired into each input port of a node, in wire order. */
export function inputsOf(g: Pick<CanvasGraph, "nodes" | "edges">, nodeId: string): Record<string, CanvasNode[]> {
  const out: Record<string, CanvasNode[]> = {};
  for (const e of g.edges) {
    if (e.to !== nodeId) continue;
    const src = g.nodes.find((n) => n.id === e.from);
    if (src) (out[e.port] ??= []).push(src);
  }
  return out;
}

/** Every node a node depends on (directly or further back). */
export function ancestorsOf(g: Pick<CanvasGraph, "edges">, nodeId: string): Set<string> {
  const seen = new Set<string>();
  const stack = [nodeId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const e of g.edges) {
      if (e.to !== id || seen.has(e.from)) continue;
      seen.add(e.from);
      stack.push(e.from);
    }
  }
  return seen;
}

/** Every node that depends on a node. */
export function descendantsOf(g: Pick<CanvasGraph, "edges">, nodeId: string): Set<string> {
  const seen = new Set<string>();
  const stack = [nodeId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const e of g.edges) {
      if (e.from !== id || seen.has(e.to)) continue;
      seen.add(e.to);
      stack.push(e.to);
    }
  }
  return seen;
}

// ───────────────────────────── signatures and the cache ─────────────────────────────

/** A value written the same way whatever the order of its keys. */
export function stableJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(stableJson).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stableJson(o[k])}`).join(",")}}`;
}

/** A short hash of a string (FNV-1a, 2 × 32 bits): enough to tell inputs apart, not a security measure. */
export function shortHash(s: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x5bd1e995) ^ (b >>> 13);
  }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36);
}

/** What of a node's own data changes its result (its name and place do not). */
function ownPart(n: CanvasNode): unknown {
  const d = n.data;
  switch (n.kind) {
    case "text":
      return { t: (d.text ?? "").trim() };
    case "upload":
      return { u: d.uploadId ?? null };
    case "style":
      return { s: d.styleId ?? null, t: d.tasteId ?? null };
    case "brand":
      return { l: Boolean(d.logo) };
    case "image":
    case "audio":
    case "tool":
      return { g: d.generatorId ?? null, s: d.settings ?? {}, t: (d.text ?? "").trim() };
    case "video":
      return { g: d.generatorId ?? null, s: d.settings ?? {}, t: (d.text ?? "").trim(), as: d.imageAs ?? "first_frame" };
    case "result":
      return null;
  }
}

/**
 * Each node's input signature: its own data and what comes in by wire. A generator's result counts by its finished
 * output when that result is still fresh, else as «still to make» — so a node after one that will run again runs again too,
 * and a node after one that was regenerated (a new output) is no longer fresh.
 */
export function signatures(g: CanvasGraph): Record<string, string> {
  const order = topoOrder(g) ?? g.nodes.map((n) => n.id);
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const sig: Record<string, string> = {};
  const token: Record<string, string> = {};
  for (const id of order) {
    const n = byId.get(id);
    if (!n) continue;
    const ins = g.edges.filter((e) => e.to === id).map((e) => [e.port, token[e.from] ?? "?"]);
    sig[id] = shortHash(stableJson({ k: n.kind, o: ownPart(n), i: ins }));
    const run = g.runs[id];
    token[id] = NODE_KINDS[n.kind].runs ? (run && run.sig === sig[id] ? `out:${run.outputId}` : `todo:${sig[id]}`) : `v:${sig[id]}`;
  }
  return sig;
}

/** A node whose finished result still matches its inputs. */
export const isFresh = (g: CanvasGraph, sigs: Record<string, string>, id: string) => Boolean(g.runs[id] && g.runs[id].sig === sigs[id]);

export interface RunPlan {
  /** the nodes that will make a job, in run order */
  run: string[];
  /** generator nodes reused from their finished result (nothing to pay) */
  cached: string[];
}

/**
 * What a run makes: every generator node («شغّل الكل»), or one node and what it needs («شغّل هذي»). A node runs when it
 * has no fresh result, or when it is forced («ولّد من جديد» / «أعد»); the rest reuse their result.
 */
export function planRun(g: CanvasGraph, o: { target?: string; force?: string[] } = {}): RunPlan {
  const order = topoOrder(g);
  if (!order) return { run: [], cached: [] };
  const wanted = o.target ? new Set([...ancestorsOf(g, o.target), o.target]) : null;
  const force = new Set(o.force ?? []);
  const kinds = new Map(g.nodes.map((n) => [n.id, n.kind]));
  // forcing a node makes everything after it (inside this run) stale too
  const stale = new Set<string>();
  const sigs = signatures(g);
  const run: string[] = [];
  const cached: string[] = [];
  for (const id of order) {
    const kind = kinds.get(id)!;
    if (!NODE_KINDS[kind].runs || (wanted && !wanted.has(id))) continue;
    const upstreamRuns = g.edges.some((e) => e.to === id && stale.has(e.from));
    if (force.has(id) || upstreamRuns || !isFresh(g, sigs, id)) {
      run.push(id);
      stale.add(id);
    } else cached.push(id);
    // a non-running node passes staleness through (none of them have inputs that run, except «نتيجة», which ends)
  }
  return { run, cached };
}

/** The total of a run: the sum of the prices of the nodes that will run (cached ones are free). `unknown`: a node whose price could not be worked out. */
export function planPrice(plan: RunPlan, priceOf: (id: string) => number | null): { total: number; each: Record<string, number | null>; unknown: string[] } {
  const each: Record<string, number | null> = {};
  let total = 0;
  const unknown: string[] = [];
  for (const id of plan.run) {
    const p = priceOf(id);
    each[id] = p;
    if (p == null) unknown.push(id);
    else total += p;
  }
  return { total, each, unknown };
}

/** The words a generator node reads: what its text wires bring (in wire order), then its own words. */
export function promptOf(g: Pick<CanvasGraph, "nodes" | "edges">, nodeId: string): string {
  const n = g.nodes.find((x) => x.id === nodeId);
  const parts = (inputsOf(g, nodeId).prompt ?? []).map((t) => (t.data.text ?? "").trim());
  parts.push((n?.data.text ?? "").trim());
  return parts.filter(Boolean).join("\n").slice(0, 40_000);
}

/** What is missing before a node can run (before the generator's own checks, which the studio's rules do). */
export function nodeProblem(g: Pick<CanvasGraph, "nodes" | "edges">, n: CanvasNode): string | null {
  const def = NODE_KINDS[n.kind];
  if (n.kind === "upload" && !n.data.uploadId) return "اختر صورة.";
  if (def.runs && !n.data.generatorId) return "اختر المولّد.";
  const ins = inputsOf(g, n.id);
  for (const p of def.inputs) if (p.required && !ins[p.id]?.length) return `وصّل «${p.label}».`;
  return null;
}

// ───────────────────────────── the server's check of a kept graph ─────────────────────────────

const ID = /^[A-Za-z0-9_-]{1,40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(-1e6, Math.min(1e6, Math.round(v))) : 0);

function cleanSettings(v: unknown): Settings | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const out: Settings = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>).slice(0, 40)) {
    if (!/^[A-Za-z0-9_:-]{1,40}$/.test(k)) continue;
    if (typeof x === "string") out[k] = x.slice(0, 200);
    else if (typeof x === "number" && Number.isFinite(x)) out[k] = x;
    else if (typeof x === "boolean") out[k] = x;
  }
  return out;
}

function cleanData(kind: NodeKind, v: unknown): NodeData {
  const d = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const out: NodeData = {};
  const title = str(d.title, 40)?.trim();
  if (title) out.title = title;
  const text = str(d.text, MAX_TEXT);
  if (text) out.text = text;
  if (kind === "upload" && typeof d.uploadId === "string" && UUID.test(d.uploadId)) out.uploadId = d.uploadId;
  if (NODE_KINDS[kind].runs) {
    const gid = str(d.generatorId, 80);
    if (gid && /^[a-z0-9._-]+$/.test(gid)) out.generatorId = gid;
    const s = cleanSettings(d.settings);
    if (s) out.settings = s;
  }
  if (kind === "video") out.imageAs = d.imageAs === "reference" ? "reference" : "first_frame";
  if (kind === "style") {
    const s = str(d.styleId, 80);
    if (s && /^[a-z0-9-]+$/.test(s)) out.styleId = s;
    else if (typeof d.tasteId === "string" && UUID.test(d.tasteId)) out.tasteId = d.tasteId;
  }
  if (kind === "brand") out.logo = d.logo === true;
  return out;
}

/** A graph as the server keeps it: only known fields, sizes capped, wires that pass the type check. null + why when it can't be kept. */
export function cleanGraph(raw: unknown, keepRuns = true): { graph: CanvasGraph } | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "اللوحة غير صالحة." };
  const r = raw as Record<string, unknown>;
  if (JSON.stringify(raw).length > MAX_GRAPH_CHARS) return { error: "اللوحة كبيرة جدًا." };
  const rawNodes = Array.isArray(r.nodes) ? r.nodes : [];
  const rawEdges = Array.isArray(r.edges) ? r.edges : [];
  if (rawNodes.length > MAX_NODES) return { error: `اللوحة تاخذ ${MAX_NODES} عقدة كحد أعلى.` };
  if (rawEdges.length > MAX_EDGES) return { error: `اللوحة تاخذ ${MAX_EDGES} سلك كحد أعلى.` };
  const nodes: CanvasNode[] = [];
  for (const x of rawNodes) {
    const n = (x ?? {}) as Record<string, unknown>;
    if (typeof n.id !== "string" || !ID.test(n.id) || !isNodeKind(n.kind) || nodes.some((m) => m.id === n.id)) continue;
    nodes.push({ id: n.id, kind: n.kind, x: num(n.x), y: num(n.y), data: cleanData(n.kind, n.data) });
  }
  const edges: CanvasEdge[] = [];
  for (const x of rawEdges) {
    const e = (x ?? {}) as Record<string, unknown>;
    if (typeof e.id !== "string" || !ID.test(e.id) || typeof e.from !== "string" || typeof e.to !== "string" || typeof e.port !== "string") continue;
    if (edges.some((m) => m.id === e.id)) continue;
    if (wireProblem({ nodes, edges }, e.from, e.to, e.port)) continue;
    edges.push({ id: e.id, from: e.from, to: e.to, port: e.port });
  }
  const runs: Record<string, NodeRun> = {};
  if (keepRuns && r.runs && typeof r.runs === "object") {
    for (const [id, x] of Object.entries(r.runs as Record<string, unknown>)) {
      const run = (x ?? {}) as Record<string, unknown>;
      const node = nodes.find((n) => n.id === id);
      if (!node || !NODE_KINDS[node.kind].runs) continue;
      if (typeof run.sig !== "string" || run.sig.length > 64 || typeof run.jobId !== "string" || !UUID.test(run.jobId) || typeof run.outputId !== "string" || !UUID.test(run.outputId)) continue;
      if (run.kind !== "image" && run.kind !== "video" && run.kind !== "audio") continue;
      runs[id] = { sig: run.sig, jobId: run.jobId, outputId: run.outputId, kind: run.kind, ...(typeof run.uploadId === "string" && UUID.test(run.uploadId) ? { uploadId: run.uploadId } : {}) };
    }
  }
  return { graph: { v: 1, nodes, edges, runs } };
}

export const cleanCanvasName = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, CANVAS_NAME_MAX) : "");

/** A recipe keeps the nodes and wires only: no results, and no picture of the person's (each use picks its own). */
export function asRecipe(g: CanvasGraph): CanvasGraph {
  return { v: 1, nodes: g.nodes.map((n) => ({ ...n, data: n.kind === "upload" ? { ...(n.data.title ? { title: n.data.title } : {}) } : n.data })), edges: g.edges, runs: {} };
}

// ───────────────────────────── estimating what is not made yet ─────────────────────────────

/** "16:9" → 16/9 (anything else → square). */
export function ratioOf(v: SettingValue | undefined): number {
  const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(String(v ?? ""));
  return m ? Number(m[1]) / Number(m[2]) : 1;
}

/** What a result not made yet probably looks like, from its generator's settings (for the price before a run; the real file is checked when it runs). */
export function expectedMedia(kind: OutputKind, s: Settings): { mime: string; bytes: number; width: number | null; height: number | null; durationMs: number | null; fps: number | null } {
  if (kind === "audio") return { mime: "audio/mpeg", bytes: 1_500_000, width: null, height: null, durationMs: Math.max(1, Number(s.duration) || 30) * 1000, fps: null };
  const r = ratioOf(s.aspect ?? s.ratio ?? s.shape);
  const long = kind === "video" ? 1280 : 1536;
  const even = (n: number) => Math.max(64, Math.round(n / 2) * 2);
  const width = even(r >= 1 ? long : long * r);
  const height = even(r >= 1 ? long / r : long);
  if (kind === "video") return { mime: "video/mp4", bytes: 8_000_000, width, height, durationMs: Math.max(1, Number(s.duration) || 5) * 1000, fps: 24 };
  return { mime: "image/png", bytes: 3_000_000, width, height, durationMs: null, fps: null };
}

// ───────────────────────────── ready recipes ─────────────────────────────

export interface StarterRecipe {
  id: string;
  title: string;
  hint: string;
  icon: string;
  graph: CanvasGraph;
}

type Spec = [id: string, kind: NodeKind, x: number, y: number, data?: NodeData];
const build = (nodes: Spec[], wires: [from: string, to: string, port: string][]): CanvasGraph => ({
  v: 1,
  nodes: nodes.map(([id, kind, x, y, data]) => ({ id, kind, x, y, data: data ?? {} })),
  edges: wires.map(([from, to, port], i) => ({ id: `w${i + 1}`, from, to, port })),
  runs: {},
});

/** Ready recipes (no realistic adult women, nothing in a regional dress: products, cartoon characters, places). */
export const STARTER_RECIPES: StarterRecipe[] = [
  {
    id: "product-motion",
    title: "صورة منتج ← فيديو حركة",
    hint: "ارفع صورة منتجك، وتطلع لقطة فيديو تتحرك حوله.",
    icon: "video",
    graph: build(
      [
        ["p", "upload", 0, 0, { title: "صورة المنتج" }],
        ["t", "text", 0, 180, { text: "Slow cinematic orbit around the product on a clean studio pedestal, soft reflections, gentle light sweep, premium commercial look." }],
        ["v", "video", 340, 60, { generatorId: "wan-3-0", imageAs: "first_frame", settings: { ratio: "9:16", duration: 5 } }],
        ["r", "result", 680, 80],
      ],
      [["p", "v", "images"], ["t", "v", "prompt"], ["v", "r", "media"]],
    ),
  },
  {
    id: "character-angles",
    title: "شخصية ← ٣ زوايا",
    hint: "صورة شخصية كرتونية، ثم نفس الشخصية من الجنب ومن الخلف.",
    icon: "user",
    graph: build(
      [
        ["t", "text", 0, 80, { text: "A cheerful cartoon boy astronaut with a round helmet and orange suit, full body, front view, plain light grey background, character design sheet." }],
        ["s", "style", 0, 260, { styleId: "pixar-classic" }],
        ["a", "image", 340, 0, { title: "من الأمام", generatorId: "google-nano-banana-pro", settings: { aspect: "1:1" } }],
        ["b", "image", 680, -120, { title: "من الجنب", generatorId: "google-nano-banana-pro", text: "Same character, exact same design and colours, full body side view (profile), same plain background.", settings: { aspect: "1:1" } }],
        ["c", "image", 680, 140, { title: "من الخلف", generatorId: "google-nano-banana-pro", text: "Same character, exact same design and colours, full body back view, same plain background.", settings: { aspect: "1:1" } }],
        ["r", "result", 1020, 20],
      ],
      [["t", "a", "prompt"], ["s", "a", "style"], ["a", "b", "refs"], ["a", "c", "refs"], ["s", "b", "style"], ["s", "c", "style"], ["a", "r", "media"], ["b", "r", "media"], ["c", "r", "media"]],
    ),
  },
  {
    id: "expand-upscale",
    title: "صورة ← توسيع ← رفع دقة",
    hint: "حوّل صورتك لمقاس الستوري، ثم ارفع دقتها.",
    icon: "expand",
    graph: build(
      [
        ["p", "upload", 0, 40, { title: "صورتك" }],
        ["o", "tool", 340, 0, { title: "وسّعها", generatorId: "image-outpaint", settings: { shape: "9:16" } }],
        ["u", "tool", 680, 0, { title: "ارفع الدقة", generatorId: "image-upscale", settings: { factor: "2", engine: "seedvr" } }],
        ["r", "result", 1020, 20],
      ],
      [["p", "o", "image"], ["o", "u", "image"], ["u", "r", "media"]],
    ),
  },
  {
    id: "prompt-to-film",
    title: "برومبت ← صورة ← فيديو ← موسيقى",
    hint: "مشهد كامل من وصف واحد: صورة، تتحرك، ومعها موسيقى.",
    icon: "film",
    graph: build(
      [
        ["t", "text", 0, 0, { text: "A small lighthouse on a rocky cliff at golden sunset, waves below, seagulls, cinematic wide shot." }],
        ["i", "image", 340, -40, { generatorId: "openai-gpt-image-2", settings: { aspect: "16:9" } }],
        ["m", "text", 340, 200, { title: "حركة المشهد", text: "Waves crash softly, the camera slowly pushes in toward the lighthouse, warm light flickers on." }],
        ["v", "video", 680, 40, { generatorId: "wan-3-0", imageAs: "first_frame", settings: { ratio: "16:9", duration: 5 } }],
        ["mt", "text", 680, 280, { title: "وصف الموسيقى", text: "Calm cinematic orchestral piece, gentle strings and piano, hopeful mood, no vocals." }],
        ["a", "audio", 1020, 260, { generatorId: "elevenlabs-music-v2-5", settings: { duration: 30, instrumental: true } }],
        ["r", "result", 1360, 100],
      ],
      [["t", "i", "prompt"], ["i", "v", "images"], ["m", "v", "prompt"], ["mt", "a", "prompt"], ["v", "r", "media"], ["a", "r", "media"]],
    ),
  },
  {
    id: "ad-story",
    title: "ستوري إعلان",
    hint: "صورة منتجك تصير بوستر ستوري بهويتك، ثم لقطة تتحرك.",
    icon: "sparkles",
    graph: build(
      [
        ["p", "upload", 0, 0, { title: "صورة المنتج" }],
        ["t", "text", 0, 180, { text: "Vertical 9:16 advertising story: the product from the reference on a bold coloured stage with soft shadows and floating light particles, generous empty space at the top for a headline." }],
        ["b", "brand", 0, 360, { logo: false }],
        ["i", "image", 340, 60, { title: "البوستر", generatorId: "google-nano-banana-pro", settings: { aspect: "9:16" } }],
        ["m", "text", 340, 300, { title: "الحركة", text: "Light particles drift upward, the product slowly rotates, subtle camera push-in." }],
        ["v", "video", 680, 100, { generatorId: "wan-3-0", imageAs: "first_frame", settings: { ratio: "9:16", duration: 5 } }],
        ["r", "result", 1020, 80],
      ],
      [["p", "i", "refs"], ["t", "i", "prompt"], ["b", "i", "brand"], ["i", "v", "images"], ["m", "v", "prompt"], ["i", "r", "media"], ["v", "r", "media"]],
    ),
  },
  {
    id: "youtube-thumbnail",
    title: "ثامبنيل يوتيوب",
    hint: "ثامبنيل ١٦:٩ بستايل ثابت، ثم رفع الدقة.",
    icon: "image",
    graph: build(
      [
        ["t", "text", 0, 0, { text: "YouTube thumbnail: an excited cartoon robot pointing at a big glowing laptop screen, bold high contrast colours, clean empty space on the left for the title." }],
        ["s", "style", 0, 200, { styleId: "illumination" }],
        ["i", "image", 340, 40, { generatorId: "openai-gpt-image-2", settings: { aspect: "16:9" } }],
        ["u", "tool", 680, 40, { title: "ارفع الدقة", generatorId: "image-upscale", settings: { factor: "2", engine: "seedvr" } }],
        ["r", "result", 1020, 60],
      ],
      [["t", "i", "prompt"], ["s", "i", "style"], ["i", "u", "image"], ["u", "r", "media"]],
    ),
  },
];

/**
 * A recipe made ready for this person: each generator it names, when not available to them, becomes the first one of the
 * same kind they have (no generator left: the node stays empty, «اختر المولّد»). New ids, so two copies never clash.
 */
export function fitRecipe(g: CanvasGraph, available: { image: string[]; video: string[]; audio: string[]; tool: string[] }, newId: () => string): CanvasGraph {
  const ids = new Map(g.nodes.map((n) => [n.id, newId()]));
  const listFor = (k: NodeKind) => (k === "image" ? available.image : k === "video" ? available.video : k === "audio" ? available.audio : k === "tool" ? available.tool : []);
  return {
    v: 1,
    nodes: g.nodes.map((n) => {
      const list = listFor(n.kind);
      const data = { ...n.data };
      if (NODE_KINDS[n.kind].runs && (!data.generatorId || !list.includes(data.generatorId))) {
        if (list[0]) data.generatorId = list[0];
        else delete data.generatorId;
      }
      return { ...n, id: ids.get(n.id)!, data };
    }),
    edges: g.edges.map((e) => ({ id: newId(), from: ids.get(e.from)!, to: ids.get(e.to)!, port: e.port })),
    runs: {},
  };
}
