"use client";

// «اللوحة» (/jawad-ai/canvas): a node canvas for «الاستوديو الإبداعي». The person wires a recipe — words, pictures,
// image / video / sound generators, the image tools, a style, «هويتي» — and runs it all with one press, or one node at
// a time. Each generator node is an ordinary studio job (the same /api/jawad/generate: the price the person agreed to,
// the hold, the refund on failure, «أعمالي»). Before a run the page shows what will run and the total; a node whose
// inputs did not change keeps its finished result (config/jawad/canvas.ts → planRun), so a rerun pays only for what
// changed. Canvases and recipes are saved per person (migration 0121; before it runs, the canvas lives in this browser
// and saving says so in one line).

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setPricing } from "@config/coins";
import { generatorById } from "@config/jawad/generators";
import { isImageTool } from "@config/jawad/image-tools";
import {
  ancestorsOf,
  CANVAS_TOOL_IDS,
  fitRecipe,
  inputsOf,
  isFresh,
  MANUAL_TOOL_ID,
  NODE_KIND_ORDER,
  NODE_KINDS,
  nodeProblem,
  planPrice,
  planRun,
  signatures,
  STARTER_RECIPES,
  topoOrder,
  validateGraph,
  wireProblem,
  type CanvasEdge,
  type CanvasGraph,
  type CanvasNode,
  type NodeData,
  type NodeKind,
  type NodeRun,
} from "@config/jawad/canvas";
import { evaluate, type Evaluation } from "@/lib/jawad/engine";
import { isOpenStatus, type JobView, type OutputView } from "@/lib/jawad/labels";
import { track } from "@/lib/feature-track";
import Riyal from "@/components/Riyal";
import { useAtCost } from "@/components/usePerks";
import { announceBalance } from "../CoinBalance";
import Dialog from "../Dialog";
import Icon from "../Icon";
import LoginLink from "../LoginLink";
import { lookRefItems, useLook } from "../studio/TasteBrand";
import { refMeta, type StudioGenerator, type UploadView } from "../studio/types";
import { uploadReference } from "../studio/upload";
import type { ImageSource } from "../studio/ImageTools";
import Board, { fitView, MAX_ZOOM, MIN_ZOOM, NODE_W } from "./Board";
import Inspector from "./Inspector";
import NodeCard, { type Media } from "./NodeCard";
import { asRefItem, nodeRequest, type NodeRequest } from "./request";
import type { CanvasProps, NodeStatus, Viewport } from "./types";
import "./canvas.css";

// the painting tool opens only when asked
const ImageTools = dynamic(() => import("../studio/ImageTools"), { ssr: false });

type Shape = { nodes: CanvasNode[]; edges: CanvasEdge[] };
interface SavedItem {
  id: string;
  name: string;
  kind: "canvas" | "recipe";
  nodes: number;
  updatedAt: string;
}

/** Jobs a canvas runs at once (the studio allows 3 open jobs per person; one stays free for the studio itself). */
const AT_ONCE = 2;
const HISTORY = 80;
const nid = () => Math.random().toString(36).slice(2, 10);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const draftKey = (userId: string | undefined) => `jawad:canvas:v1:${userId ?? "anon"}`;

async function call<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: T & { error?: string; code?: string; coins?: number } }> {
  const res = await fetch(url, { cache: "no-store", ...init });
  return { ok: res.ok, status: res.status, body: (await res.json().catch(() => ({}))) as T & { error?: string; code?: string; coins?: number } };
}
const send = <T,>(url: string, method: string, data: unknown) => call<T>(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

export default function CanvasStudio({ generators, prices, pricing, user, owner, allowed, balance: initialBalance }: CanvasProps) {
  setPricing(pricing);
  const atCost = useAtCost();
  const { look } = useLook(Boolean(user && allowed));

  // ── the graph, its results, and undo ──
  const [shape, setShapeState] = useState<Shape>({ nodes: [], edges: [] });
  const [runs, setRunsState] = useState<Record<string, NodeRun>>({});
  const shapeRef = useRef(shape);
  const runsRef = useRef(runs);
  const past = useRef<Shape[]>([]);
  const future = useRef<Shape[]>([]);
  const lastRecord = useRef<{ key: string; at: number } | null>(null);
  const [, setHistoryTick] = useState(0);
  const [dirty, setDirty] = useState(0);

  const setShape = useCallback((next: Shape, record: boolean | string = true) => {
    const prev = shapeRef.current;
    if (next === prev) return;
    if (record) {
      // typing in one field is one undo step (a pause of a second starts a new one)
      const key = typeof record === "string" ? record : "";
      const now = Date.now();
      const same = key && lastRecord.current?.key === key && now - lastRecord.current.at < 1000;
      if (!same) {
        past.current.push(prev);
        if (past.current.length > HISTORY) past.current.shift();
      }
      lastRecord.current = key ? { key, at: now } : null;
      future.current = [];
      setHistoryTick((t) => t + 1);
    }
    shapeRef.current = next;
    setShapeState(next);
    setDirty((d) => d + 1);
  }, []);
  const patchRuns = useCallback((fn: (cur: Record<string, NodeRun>) => Record<string, NodeRun>) => {
    runsRef.current = fn(runsRef.current);
    setRunsState(runsRef.current);
    setDirty((d) => d + 1);
  }, []);
  /** an undo step before a change made in many small moves (a drag) */
  const recordStep = useCallback(() => {
    past.current.push(shapeRef.current);
    if (past.current.length > HISTORY) past.current.shift();
    future.current = [];
    lastRecord.current = null;
    setHistoryTick((t) => t + 1);
  }, []);
  // what the prices, the cache and the checks read: everything but where the nodes sit (a drag recomputes nothing)
  const logicKey = useMemo(() => JSON.stringify({ n: shape.nodes.map(({ id, kind, data }) => ({ id, kind, data })), e: shape.edges }), [shape]);
  const graph: CanvasGraph = useMemo(() => {
    const p = JSON.parse(logicKey) as { n: Omit<CanvasNode, "x" | "y">[]; e: CanvasEdge[] };
    return { v: 1, nodes: p.n.map((n) => ({ ...n, x: 0, y: 0 })), edges: p.e, runs };
  }, [logicKey, runs]);
  const current = (): CanvasGraph => ({ v: 1, ...shapeRef.current, runs: runsRef.current });

  function undo() {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(shapeRef.current);
    lastRecord.current = null;
    shapeRef.current = prev;
    setShapeState(prev);
    setHistoryTick((t) => t + 1);
    setDirty((d) => d + 1);
  }
  function redo() {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(shapeRef.current);
    lastRecord.current = null;
    shapeRef.current = next;
    setShapeState(next);
    setHistoryTick((t) => t + 1);
    setDirty((d) => d + 1);
  }

  // ── the person's pictures and results (short-lived links, asked again after a reload) ──
  const [uploads, setUploads] = useState<Record<string, UploadView>>({});
  const [outputs, setOutputs] = useState<Record<string, OutputView>>({});
  const uploadsRef = useRef(uploads);
  const outputsRef = useRef(outputs);
  const addUploads = useCallback((list: UploadView[]) => {
    if (!list.length) return;
    uploadsRef.current = { ...uploadsRef.current, ...Object.fromEntries(list.map((u) => [u.id, u])) };
    setUploads(uploadsRef.current);
  }, []);
  const addOutputs = useCallback((list: OutputView[]) => {
    if (!list.length) return;
    outputsRef.current = { ...outputsRef.current, ...Object.fromEntries(list.map((o) => [o.id, o])) };
    setOutputs(outputsRef.current);
  }, []);
  const asked = useRef(new Set<string>());
  useEffect(() => {
    if (!user) return;
    const wantUploads = [...shape.nodes.flatMap((n) => (n.kind === "upload" && n.data.uploadId ? [n.data.uploadId] : [])), ...Object.values(runs).flatMap((r) => (r.uploadId ? [r.uploadId] : []))].filter((id) => !uploads[id] && !asked.current.has(id));
    const wantJobs = Object.values(runs).filter((r) => !outputs[r.outputId] && !asked.current.has(r.jobId)).map((r) => r.jobId);
    if (!wantUploads.length && !wantJobs.length) return;
    for (const id of [...wantUploads, ...wantJobs]) asked.current.add(id);
    const t = setTimeout(async () => {
      for (let i = 0; i < wantUploads.length; i += 60) {
        const r = await call<{ uploads: UploadView[] }>(`/api/jawad/uploads?ids=${wantUploads.slice(i, i + 60).join(",")}`).catch(() => null);
        if (r?.ok) addUploads(r.body.uploads);
      }
      for (let i = 0; i < wantJobs.length; i += 30) {
        const r = await call<{ jobs: JobView[] }>(`/api/jawad/jobs?ids=${wantJobs.slice(i, i + 30).join(",")}`).catch(() => null);
        if (r?.ok) addOutputs(r.body.jobs.flatMap((j) => j.outputs));
      }
    }, 0);
    return () => clearTimeout(t);
  }, [user, shape.nodes, runs, uploads, outputs, addUploads, addOutputs]);

  // ── generators each node kind may use ──
  const gensFor = useCallback(
    (kind: NodeKind): StudioGenerator[] =>
      generators.filter((g) => {
        const d = generatorById(g.id);
        if (!d) return false;
        if (kind === "tool") return (CANVAS_TOOL_IDS as readonly string[]).includes(g.id);
        if (kind === "image") return d.output === "image" && !isImageTool(g.id);
        if (kind === "video") return d.output === "video";
        if (kind === "audio") return d.output === "audio" && d.modes.some((m) => m.refStyle === "none");
        return false;
      }),
    [generators],
  );
  const available = useMemo(() => ({ image: gensFor("image").map((g) => g.id), video: gensFor("video").map((g) => g.id), audio: gensFor("audio").map((g) => g.id), tool: gensFor("tool").map((g) => g.id) }), [gensFor]);

  // ── each generator node's request and price (results not made yet are estimated) ──
  const evalOf = useCallback(
    (req: NodeRequest): Evaluation => {
      const tasteId = req.tasteId;
      const brand = req.brand ? { on: true, logo: typeof req.brand === "object" } : undefined;
      const items = req.refs.map(asRefItem);
      const extra = lookRefItems(req.def, req.refStyle, req.settings, items, look, tasteId, brand);
      return evaluate(req.def, { settings: req.settings, prompt: req.prompt, instructions: "", refStyle: req.refStyle, refs: [...items, ...extra].map(refMeta), atCost: !owner && atCost }, prices[req.def.id] ?? {});
    },
    [look, owner, atCost, prices],
  );
  const book = useMemo(() => ({ uploads, outputs }), [uploads, outputs]);
  const sigs = useMemo(() => signatures(graph), [graph]);
  const quotes = useMemo(() => {
    const out: Record<string, { ev: Evaluation | null; price: number | null; problem: string | null; estimated: boolean }> = {};
    for (const n of graph.nodes) {
      if (!NODE_KINDS[n.kind].runs) continue;
      const missing = nodeProblem(graph, n);
      const req = nodeRequest(graph, n.id, book, true);
      if ("problem" in req) {
        out[n.id] = { ev: null, price: null, problem: missing ?? req.problem, estimated: false };
        continue;
      }
      const ev = evalOf(req);
      const problem = missing ?? (n.data.generatorId === MANUAL_TOOL_ID ? null : ev.issues[0]?.message ?? (ev.price.ok ? null : ev.price.reason));
      out[n.id] = { ev, price: ev.price.ok ? ev.price.coins : null, problem, estimated: req.refs.some((r) => r.estimated) };
    }
    return out;
  }, [graph, book, evalOf]);

  // ── page state ──
  const [vp, setVp] = useState<Viewport>({ x: 600, y: 120, s: 1 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [mode, setMode] = useState<"board" | "list">("board");
  const [status, setStatusMap] = useState<Record<string, NodeStatus>>({});
  const setStatus = useCallback((id: string, s: NodeStatus | null) => setStatusMap((cur) => {
    const next = { ...cur };
    if (s) next[id] = s;
    else delete next[id];
    return next;
  }), []);
  const [notice, setNotice] = useState("");
  const [running, setRunning] = useState(false);
  const stopRef = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [balance, setBalance] = useState(initialBalance);
  const [uploading, setUploading] = useState<Record<string, string>>({});
  const [menu, setMenu] = useState(false);
  const [library, setLibrary] = useState(false);
  const [libTab, setLibTab] = useState<"starters" | "recipes" | "canvases">("starters");
  const [confirmRun, setConfirmRun] = useState<{ run: string[]; cached: number; rows: { id: string; title: string; price: number | null; manual: boolean }[]; total: number; unknown: number; estimated: boolean; problems: { id: string; title: string; message: string }[]; target?: string } | null>(null);
  const [priceAsk, setPriceAsk] = useState<{ title: string; was: number; now: number } | null>(null);
  const priceAnswer = useRef<((ok: boolean) => void) | null>(null);
  const [painting, setPainting] = useState<{ nodeId: string; source: ImageSource; sig: string } | null>(null);
  const [recipeName, setRecipeName] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // ── saving ──
  const [canvasId, setCanvasId] = useState<string | null>(null);
  const [name, setName] = useState("لوحتي");
  const [ready, setReady] = useState<boolean | null>(null);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [saveState, setSaveState] = useState<"" | "saving" | "saved" | "error">("");
  const loadSaved = useCallback(async () => {
    if (!user) return;
    const r = await call<{ ready: boolean; items: SavedItem[] }>("/api/jawad/canvases").catch(() => null);
    if (!r?.ok) return;
    setReady(r.body.ready);
    setSaved(r.body.items);
  }, [user]);
  useEffect(() => {
    const t = setTimeout(() => void loadSaved(), 0);
    return () => clearTimeout(t);
  }, [loadSaved]);

  const fit = useCallback((nodes: CanvasNode[]) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (r) setVp(fitView(nodes, r.width, r.height));
  }, []);

  const loadGraph = useCallback(
    (g: CanvasGraph, o: { id: string | null; name: string }) => {
      past.current = [];
      future.current = [];
      lastRecord.current = null;
      shapeRef.current = { nodes: g.nodes, edges: g.edges };
      runsRef.current = g.runs ?? {};
      setShapeState(shapeRef.current);
      setRunsState(runsRef.current);
      setStatusMap({});
      setSelected([]);
      setSelectedEdge(null);
      setCanvasId(o.id);
      setName(o.name);
      setSaveState(o.id ? "saved" : "");
      setHistoryTick((t) => t + 1);
      setTimeout(() => fit(g.nodes), 0);
    },
    [fit],
  );

  // first visit: the canvas kept in this browser, else the first ready recipe; phones start in the list
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    track("studio.canvas_open");
    const t = setTimeout(() => {
      if (window.matchMedia("(max-width: 767px)").matches) setMode("list");
      try {
        const raw = localStorage.getItem(draftKey(user?.id));
        const d = raw ? (JSON.parse(raw) as { id: string | null; name: string; graph: CanvasGraph }) : null;
        if (d?.graph?.nodes) return loadGraph({ v: 1, nodes: d.graph.nodes, edges: d.graph.edges ?? [], runs: d.graph.runs ?? {} }, { id: d.id, name: d.name || "لوحتي" });
      } catch {
        // nothing kept, or storage blocked
      }
      const first = STARTER_RECIPES[0];
      loadGraph(fitRecipe(first.graph, available, nid), { id: null, name: first.title });
    }, 0);
    return () => clearTimeout(t);
  }, [user, available, loadGraph]);

  // kept in this browser on every change; saved to the account a moment after (an opened canvas, once 0121 has run)
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(async () => {
      const g = current();
      try {
        localStorage.setItem(draftKey(user?.id), JSON.stringify({ id: canvasId, name, graph: g }));
      } catch {
        // storage full or blocked: the account copy still saves
      }
      if (!canvasId || !ready) return;
      setSaveState("saving");
      const r = await send(`/api/jawad/canvases/${canvasId}`, "PATCH", { name, graph: g }).catch(() => null);
      setSaveState(r?.ok ? "saved" : "error");
    }, 1200);
    return () => clearTimeout(t);
  }, [dirty, canvasId, ready, name, user]);

  async function saveNew() {
    if (!user) return setNotice("سجّل الدخول عشان تحفظ لوحاتك.");
    if (!ready) return setNotice("حفظ اللوحات يتفعّل قريب؛ لوحتك محفوظة الحين في متصفحك.");
    setSaveState("saving");
    const r = await send<{ canvas: { id: string } }>("/api/jawad/canvases", "POST", { name: name.trim() || "لوحتي", graph: current() }).catch(() => null);
    if (!r?.ok) {
      setSaveState("error");
      return setNotice(r?.body.error ?? "تعذّر الحفظ؛ جرّب مرة ثانية.");
    }
    track("studio.canvas_save");
    setCanvasId(r.body.canvas.id);
    setSaveState("saved");
    void loadSaved();
  }
  async function saveRecipe(recipe: string) {
    if (!user || !ready) return setNotice(!user ? "سجّل الدخول عشان تحفظ وصفاتك." : "حفظ الوصفات يتفعّل قريب.");
    const r = await send<{ canvas: { id: string } }>("/api/jawad/canvases", "POST", { kind: "recipe", name: recipe.trim() || name, graph: current() }).catch(() => null);
    if (!r?.ok) return setNotice(r?.body.error ?? "تعذّر حفظ الوصفة.");
    track("studio.canvas_recipe_save");
    setRecipeName(null);
    setNotice(`انحفظت الوصفة «${recipe.trim() || name}»: تلقاها في «لوحاتي ووصفاتي».`);
    void loadSaved();
  }
  async function openSaved(item: SavedItem) {
    const r = await call<{ canvas: { id: string; name: string; kind: string; graph: CanvasGraph } }>(`/api/jawad/canvases/${item.id}`).catch(() => null);
    if (!r?.ok) return setNotice(r?.body.error ?? "تعذّر فتح اللوحة.");
    setLibrary(false);
    if (r.body.canvas.kind === "recipe") {
      track("studio.canvas_recipe_use");
      loadGraph(fitRecipe(r.body.canvas.graph, available, nid), { id: null, name: r.body.canvas.name });
    } else loadGraph(r.body.canvas.graph, { id: r.body.canvas.id, name: r.body.canvas.name });
  }
  async function duplicateSaved(item: SavedItem) {
    const r = await send("/api/jawad/canvases", "POST", { fromId: item.id, kind: item.kind }).catch(() => null);
    if (!r?.ok) return setNotice(r?.body.error ?? "تعذّر النسخ.");
    void loadSaved();
  }
  async function deleteSaved(item: SavedItem) {
    const r = await send(`/api/jawad/canvases/${item.id}`, "DELETE", {}).catch(() => null);
    setDeleting(null);
    if (!r?.ok) return setNotice(r?.body.error ?? "تعذّر الحذف.");
    if (item.id === canvasId) setCanvasId(null);
    void loadSaved();
  }
  function newCanvas() {
    if (shape.nodes.length && !canvasId && !window.confirm("اللوحة الحالية ما انحفظت في حسابك. تبي تبدأ لوحة جديدة؟")) return;
    loadGraph({ v: 1, nodes: [], edges: [], runs: {} }, { id: null, name: "لوحة جديدة" });
  }

  // ── editing ──
  function addNode(kind: NodeKind) {
    const r = wrapRef.current?.getBoundingClientRect();
    const cx = r ? (r.width / 2 - vp.x) / vp.s : 0;
    const cy = r ? (r.height / 2 - vp.y) / vp.s : 0;
    const n0 = shapeRef.current.nodes.length;
    const data: NodeData = {};
    if (NODE_KINDS[kind].runs) {
      const first = kind === "tool" ? available.tool.find((id) => id !== MANUAL_TOOL_ID) ?? available.tool[0] : available[kind as "image" | "video" | "audio"]?.[0];
      if (first) data.generatorId = first;
    }
    if (kind === "video") data.imageAs = "first_frame";
    const node: CanvasNode = { id: nid(), kind, x: Math.round(-cx - NODE_W / 2 + (n0 % 4) * 24), y: Math.round(cy - 70 + (n0 % 4) * 24), data };
    setShape({ ...shapeRef.current, nodes: [...shapeRef.current.nodes, node] });
    setSelected([node.id]);
    setMenu(false);
    track("studio.canvas_node_add");
  }
  function connect(from: string, to: string, port: string) {
    const why = wireProblem(shapeRef.current, from, to, port);
    if (why) return setNotice(why);
    setShape({ ...shapeRef.current, edges: [...shapeRef.current.edges, { id: nid(), from, to, port }] });
    track("studio.canvas_wire");
  }
  function removeEdge(id: string) {
    setShape({ ...shapeRef.current, edges: shapeRef.current.edges.filter((e) => e.id !== id) });
    setSelectedEdge(null);
  }
  function removeNodes(ids: string[]) {
    if (!ids.length) return;
    const gone = new Set(ids);
    setShape({ nodes: shapeRef.current.nodes.filter((n) => !gone.has(n.id)), edges: shapeRef.current.edges.filter((e) => !gone.has(e.from) && !gone.has(e.to)) });
    patchRuns((cur) => Object.fromEntries(Object.entries(cur).filter(([id]) => !gone.has(id))));
    setSelected([]);
  }
  function duplicateNode(id: string) {
    const n = shapeRef.current.nodes.find((x) => x.id === id);
    if (!n) return;
    const copy: CanvasNode = { ...n, id: nid(), x: n.x - 30, y: n.y + 40, data: { ...n.data, ...(n.data.title ? { title: `${n.data.title} ٢` } : {}) } };
    setShape({ ...shapeRef.current, nodes: [...shapeRef.current.nodes, copy] });
    setSelected([copy.id]);
  }
  function setData(id: string, patch: Partial<NodeData>) {
    const textual = "text" in patch || "title" in patch;
    setShape(
      { ...shapeRef.current, nodes: shapeRef.current.nodes.map((n) => (n.id === id ? { ...n, data: Object.fromEntries(Object.entries({ ...n.data, ...patch }).filter(([, v]) => v !== undefined)) as NodeData } : n)) },
      textual ? `${id}:${Object.keys(patch).join(",")}` : true,
    );
  }
  async function upload(id: string, file: File) {
    setUploading((u) => ({ ...u, [id]: "يرفع ويفحص الصورة…" }));
    try {
      const v = await uploadReference(file, "image");
      addUploads([v]);
      setData(id, { uploadId: v.id });
      track("studio.ref_add");
      setUploading((u) => ({ ...u, [id]: "" }));
    } catch (e) {
      setUploading((u) => ({ ...u, [id]: (e as Error).message || "تعذّر الرفع." }));
    }
  }

  // keyboard: delete, undo/redo, select all, escape
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, select, [contenteditable=true]") || t.closest("[role=dialog]"))) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelected(shapeRef.current.nodes.map((n) => n.id));
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedEdge) removeEdge(selectedEdge);
        else removeNodes(selected);
      } else if (e.key === "Escape") {
        setSelected([]);
        setSelectedEdge(null);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  // ── running ──
  const titleOf = (id: string) => {
    const n = shapeRef.current.nodes.find((x) => x.id === id);
    return n ? n.data.title || NODE_KINDS[n.kind].label : "عقدة";
  };
  function askPrice(title: string, was: number, now: number) {
    return new Promise<boolean>((resolve) => {
      priceAnswer.current = resolve;
      setPriceAsk({ title, was, now });
    });
  }
  function answerPrice(ok: boolean) {
    priceAnswer.current?.(ok);
    priceAnswer.current = null;
    setPriceAsk(null);
  }

  function prepareRun(target?: string, force?: string[]) {
    setNotice("");
    if (!user) return setNotice("سجّل الدخول عشان تشغّل اللوحة.");
    if (!allowed) return setNotice("التوليد مقفل لحسابك حاليًا.");
    if (running) return setNotice("فيه تشغيل شغّال؛ انتظره يخلص أو أوقفه.");
    const g = current();
    const issues = validateGraph(g);
    if (issues.length) return setNotice(issues[0].message);
    const plan = planRun(g, { target, force });
    if (!plan.run.length) return setNotice(plan.cached.length ? "كل النتائج جاهزة وما تغيّر شي، فما فيه شي ينشغّل. تبي نسخة ثانية؟ اضغط «من جديد» على العقدة." : "ما فيه عقد توليد. ضيف «توليد صورة» أو افتح وصفة جاهزة.");
    const problems: { id: string; title: string; message: string }[] = [];
    for (const id of plan.run) {
      const n = g.nodes.find((x) => x.id === id)!;
      const q = quotes[id];
      const message = nodeProblem(g, n) ?? q?.problem ?? (q?.price == null && n.data.generatorId !== MANUAL_TOOL_ID ? "ما قدرنا نحسب سعرها؛ راجع إعداداتها." : null);
      if (message) problems.push({ id, title: titleOf(id), message });
    }
    // «امسح/عدّل» waits for the person's painting: it is not charged in this run
    const manual = (id: string) => g.nodes.find((n) => n.id === id)?.data.generatorId === MANUAL_TOOL_ID;
    const price = planPrice(plan, (id) => (manual(id) ? 0 : quotes[id]?.price ?? null));
    setConfirmRun({
      run: plan.run,
      cached: plan.cached.length,
      rows: plan.run.map((id) => ({ id, title: titleOf(id), price: price.each[id], manual: manual(id) })),
      total: price.total,
      unknown: price.unknown.length,
      estimated: plan.run.some((id) => quotes[id]?.estimated || [...ancestorsOf(g, id)].some((a) => plan.run.includes(a))),
      problems,
      target,
    });
  }

  async function watchJob(id: string, first: JobView, sig: string): Promise<boolean> {
    let job = first;
    for (;;) {
      if (!alive.current) return false;
      if (job.status === "succeeded") {
        const out = job.outputs.find((o) => o.kind === job.outputKind) ?? job.outputs[0];
        if (!out) {
          setStatus(id, { state: "failed", error: "خلص التوليد بدون نتيجة." });
          return false;
        }
        addOutputs(job.outputs);
        patchRuns((cur) => ({ ...cur, [id]: { sig, jobId: job.id, outputId: out.id, kind: out.kind } }));
        setStatus(id, { state: "done" });
        track("studio.job_ok");
        return true;
      }
      if (!isOpenStatus(job.status)) {
        setStatus(id, { state: "failed", error: job.error ?? (job.status === "cancelled" ? "انلغى التوليد؛ رجعت لك نقودك." : "ما نجح التوليد؛ رجعت لك نقودك.") });
        return false;
      }
      setStatus(id, { state: "working", note: job.status === "queued" ? "بالدور عند المزوّد…" : job.status === "saving" ? "يحفظ النتيجة…" : "يولّد…" });
      await sleep(4000);
      const r = await call<{ jobs: JobView[]; balance: number | null }>(`/api/jawad/jobs?ids=${job.id}`).catch(() => null);
      if (r?.ok && r.body.jobs[0]) {
        job = r.body.jobs[0];
        if (typeof r.body.balance === "number") setBalance(r.body.balance);
        announceBalance(r.body.balance);
      }
    }
  }

  const keys = useRef<Record<string, string>>({});
  async function runNode(id: string, expected: number | null): Promise<boolean> {
    const fail = (error: string) => (setStatus(id, { state: "failed", error }), false);
    setStatus(id, { state: "working", note: "يجهّز المداخل…" });
    // each result coming in by wire becomes one of the person's checked references first (once)
    const ins = inputsOf(current(), id);
    for (const src of [...(ins.refs ?? []), ...(ins.images ?? []), ...(ins.clips ?? []), ...(ins.image ?? [])]) {
      if (!NODE_KINDS[src.kind].runs) continue;
      const run = runsRef.current[src.id];
      if (!run) return fail(`«${titleOf(src.id)}» ما عندها نتيجة.`);
      if (run.uploadId && uploadsRef.current[run.uploadId]) continue;
      const r = await send<{ upload: UploadView }>("/api/jawad/uploads/from-output", "POST", { outputId: run.outputId }).catch(() => null);
      if (!r?.ok || !r.body.upload) return fail(r?.body.error ?? `تعذّر تجهيز نتيجة «${titleOf(src.id)}» كمرجع.`);
      addUploads([r.body.upload]);
      patchRuns((cur) => (cur[src.id] ? { ...cur, [src.id]: { ...cur[src.id], uploadId: r.body.upload.id } } : cur));
    }
    const g = current();
    const req = nodeRequest(g, id, { uploads: uploadsRef.current, outputs: outputsRef.current }, false);
    if ("problem" in req) return fail(req.problem);
    const sig = signatures(g)[id];
    const ev = evalOf(req);
    if (ev.issues.length) return fail(ev.issues[0].message);
    if (!ev.price.ok) return fail(ev.price.reason);
    let coins = ev.price.coins;
    if (!owner && expected != null && coins > expected && !(await askPrice(titleOf(id), expected, coins))) return fail("أوقفتها: السعر الفعلي أعلى من اللي وافقت عليه. ما انخصم شي.");
    const gen = generators.find((x) => x.id === req.def.id);
    if (!gen) return fail("هذا المولّد غير متاح لحسابك.");
    const keyName = `${id}:${sig}`;
    const body = {
      idempotencyKey: (keys.current[keyName] ??= uid()),
      sectionId: gen.sectionId,
      generatorId: req.def.id,
      refStyle: req.refStyle,
      settings: ev.settings,
      prompt: req.prompt,
      instructions: "",
      refs: req.refs.map((r) => ({ uploadId: r.uploadId!, role: r.meta.role })),
      expectedCoins: coins,
      ...(req.styleId ? { styleId: req.styleId } : {}),
      ...(req.tasteId ? { tasteId: req.tasteId } : {}),
      ...(req.brand ? { brand: req.brand } : {}),
    };
    setStatus(id, { state: "working", note: "يرسل…" });
    let job: JobView | null = null;
    for (let tries = 0; tries < 4 && !job; tries++) {
      const r = await send<{ job: JobView; balance: number | null; issues?: { message: string }[] }>("/api/jawad/generate", "POST", body).catch(() => null);
      if (!r) {
        // no answer: the same key again can never make a second job or a second charge
        await sleep(2500);
        continue;
      }
      if (r.ok) {
        job = r.body.job;
        if (typeof r.body.balance === "number") setBalance(r.body.balance);
        announceBalance(r.body.balance);
        break;
      }
      if (r.status === 409 && r.body.code === "price_changed" && typeof r.body.coins === "number") {
        if (!(await askPrice(titleOf(id), coins, r.body.coins))) return fail("أوقفتها بعد ما تغيّر السعر. ما انخصم شي.");
        coins = r.body.coins;
        body.expectedCoins = coins;
        continue;
      }
      delete keys.current[keyName];
      return fail(r.body.error ?? "تعذّر بدء التوليد.");
    }
    if (!job) return fail("تعذّر التأكد من وصول الطلب. اضغط «أعد» (ما يتكرر الخصم).");
    delete keys.current[keyName];
    return watchJob(id, job, sig);
  }

  async function execute(plan: string[], expected: Record<string, number | null>) {
    setRunning(true);
    stopRef.current = false;
    for (const id of plan) setStatus(id, { state: "queued" });
    const pending = new Set(plan);
    const bad = new Set<string>();
    const active = new Map<string, Promise<void>>();
    while (alive.current && (pending.size || active.size)) {
      const g = current();
      for (const id of [...pending]) {
        if ([...ancestorsOf(g, id)].some((a) => bad.has(a))) {
          pending.delete(id);
          bad.add(id);
          setStatus(id, { state: "skipped", note: "توقفت: العقدة قبلها لازم تخلص أول." });
        }
      }
      if (stopRef.current) {
        for (const id of pending) setStatus(id, { state: "skipped", note: "أوقفت التشغيل." });
        pending.clear();
      }
      for (const id of [...pending]) {
        if (active.size >= AT_ONCE) break;
        if ([...ancestorsOf(g, id)].some((a) => pending.has(a) || active.has(a))) continue;
        pending.delete(id);
        if (g.nodes.find((n) => n.id === id)?.data.generatorId === MANUAL_TOOL_ID) {
          bad.add(id);
          setStatus(id, { state: "manual", note: "لوّن الجزء بيدك: اضغط «لوّن وشغّل»، وبعدها شغّل اللي بعدها." });
          continue;
        }
        const p = runNode(id, expected[id] ?? null)
          .catch(() => (setStatus(id, { state: "failed", error: "انقطع الاتصال؛ اضغط «أعد»." }), false))
          .then((ok) => {
            if (!ok) bad.add(id);
            active.delete(id);
          });
        active.set(id, p);
      }
      if (!active.size) {
        for (const id of pending) setStatus(id, { state: "skipped" });
        break;
      }
      await Promise.race(active.values());
    }
    setRunning(false);
  }

  function confirmAndRun() {
    if (!confirmRun) return;
    const c = confirmRun;
    setConfirmRun(null);
    track(c.target ? "studio.canvas_run_one" : "studio.canvas_run_all");
    if (c.cached) track("studio.canvas_cached");
    void execute(c.run, Object.fromEntries(c.rows.map((r) => [r.id, r.price])));
  }

  function openPainting(id: string) {
    if (!user || !allowed) return setNotice(!user ? "سجّل الدخول أولًا." : "التوليد مقفل لحسابك حاليًا.");
    const g = current();
    const src = inputsOf(g, id).image?.[0];
    if (!src) return setNotice("وصّل «الصورة» أولًا.");
    let source: ImageSource | null = null;
    if (src.kind === "upload" && src.data.uploadId) {
      const u = uploadsRef.current[src.data.uploadId];
      source = { uploadId: src.data.uploadId, url: u?.url ?? null, width: u?.width ?? null, height: u?.height ?? null, tool: MANUAL_TOOL_ID };
    } else if (runsRef.current[src.id] && isFresh(g, signatures(g), src.id)) {
      const run = runsRef.current[src.id];
      const o = outputsRef.current[run.outputId];
      source = { outputId: run.outputId, url: o?.url ?? null, width: o?.width ?? null, height: o?.height ?? null, tool: MANUAL_TOOL_ID };
    }
    if (!source) return setNotice("الصورة الداخلة ما انصنعت بعد: شغّل العقدة قبلها أول.");
    setPainting({ nodeId: id, source, sig: signatures(g)[id] });
  }

  // ── views ──
  const mediaOf = (n: CanvasNode): Media | null => {
    if (n.kind === "upload") {
      const u = n.data.uploadId ? uploads[n.data.uploadId] : undefined;
      return n.data.uploadId ? { kind: "image", url: u?.url ?? null } : null;
    }
    const run = runs[n.id];
    if (!run) return null;
    const o = outputs[run.outputId];
    return { kind: run.kind, url: o?.url ?? null, downloadUrl: o?.downloadUrl };
  };
  const summaryOf = (n: CanvasNode): string | undefined => {
    if (n.kind === "text") return (n.data.text ?? "").slice(0, 140) || "اكتب النص…";
    if (n.kind === "style") return n.data.styleId ? `ستايل: ${n.data.styleId}` : n.data.tasteId ? `ذوقي: ${look?.tastes.find((t) => t.id === n.data.tasteId)?.name ?? "…"}` : "اختر ستايل";
    if (n.kind === "brand") return n.data.logo ? "ألوانك وخطوطك ونبرتك + الشعار" : "ألوانك وخطوطك ونبرتك";
    if (n.kind === "upload" && !n.data.uploadId) return "اختر صورة من الإعدادات";
    if (NODE_KINDS[n.kind].runs && n.data.text) return n.data.text.slice(0, 80);
    return undefined;
  };
  const canRun = Boolean(user && allowed) && !running;
  const renderNode = (n: CanvasNode) => {
    const q = quotes[n.id];
    const gathered = n.kind === "result" ? (inputsOf(graph, n.id).media ?? []).flatMap((s) => {
      const m = mediaOf(s);
      return m ? [m] : [];
    }) : undefined;
    return (
      <NodeCard
        node={n}
        status={status[n.id]}
        fresh={isFresh(graph, sigs, n.id)}
        generatorName={n.data.generatorId ? generators.find((g) => g.id === n.data.generatorId)?.name ?? generatorById(n.data.generatorId)?.name : undefined}
        price={q?.price}
        owner={owner}
        problem={q?.problem ?? (NODE_KINDS[n.kind].runs ? null : nodeProblem(graph, n))}
        summary={summaryOf(n)}
        media={n.kind === "result" ? undefined : mediaOf(n)}
        gathered={gathered}
        canRun={canRun}
        onRun={() => prepareRun(n.id)}
        onRerun={() => prepareRun(n.id, [n.id])}
        onManual={n.data.generatorId === MANUAL_TOOL_ID ? () => openPainting(n.id) : undefined}
      />
    );
  };

  const selNode = selected.length === 1 ? shape.nodes.find((n) => n.id === selected[0]) : undefined;
  const order = topoOrder(shape) ?? shape.nodes.map((n) => n.id);
  const runCount = planRun(graph).run.length;
  const inpaintGen = generators.filter((g) => g.id === MANUAL_TOOL_ID);

  return (
    <div className="cv" dir="rtl">
      <h1 className="sr-only">اللوحة — الاستوديو الإبداعي</h1>
      <div className="cv-bar">
        <Link href="/jawad-ai/images" className="jw-btn jw-btn-quiet !min-h-9 !px-2" aria-label="ارجع للاستوديو">
          <Icon name="wand" size={16} /> <span className="hidden sm:inline">الاستوديو</span>
        </Link>
        <input className="jw-input !min-h-9 w-36 text-sm sm:w-52" value={name} maxLength={60} onChange={(e) => (setName(e.target.value), setDirty((d) => d + 1))} aria-label="اسم اللوحة" />
        {canvasId ? (
          <span className="text-xs text-jw-muted">{saveState === "saving" ? "يحفظ…" : saveState === "error" ? "ما انحفظ" : "محفوظ"}</span>
        ) : (
          <button type="button" className="jw-btn !min-h-9 !px-3 text-sm" onClick={saveNew}>
            احفظ
          </button>
        )}
        <button type="button" className="jw-btn !min-h-9 !px-3 text-sm" onClick={() => (setLibrary(true), void loadSaved())}>
          <Icon name="folder" size={15} /> <span className="hidden sm:inline">لوحاتي ووصفاتي</span>
        </button>
        <div className="relative">
          <button type="button" className="jw-btn !min-h-9 !px-3 text-sm" onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
            <Icon name="plus" size={15} /> عقدة
          </button>
          {menu && (
            <div className="cv-menu" role="menu">
              {NODE_KIND_ORDER.map((k) => (
                <button key={k} type="button" role="menuitem" onClick={() => addNode(k)}>
                  <Icon name={NODE_KINDS[k].icon} size={15} />
                  <span>
                    <b>{NODE_KINDS[k].label}</b>
                    <small>{NODE_KINDS[k].hint}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="flex-1" />
        <button type="button" className="jw-btn jw-btn-icon !min-h-9" onClick={undo} disabled={!past.current.length} aria-label="تراجع">
          <Icon name="undo" size={15} />
        </button>
        <button type="button" className="jw-btn jw-btn-icon !min-h-9" onClick={redo} disabled={!future.current.length} aria-label="إعادة">
          <Icon name="redo" size={15} />
        </button>
        <div className="jw-seg !w-auto" role="tablist" aria-label="العرض">
          <button type="button" role="tab" aria-selected={mode === "board"} onClick={() => (setMode("board"), setTimeout(() => fit(shapeRef.current.nodes), 0))}>
            لوحة
          </button>
          <button type="button" role="tab" aria-selected={mode === "list"} onClick={() => setMode("list")}>
            قائمة
          </button>
        </div>
        {running ? (
          <button type="button" className="jw-btn !min-h-9 !px-3 text-sm" onClick={() => (stopRef.current = true)}>
            <Icon name="stop" size={15} /> أوقف
          </button>
        ) : user ? (
          <button type="button" className="jw-btn jw-btn-primary !min-h-9 !px-3 text-sm" onClick={() => prepareRun()} disabled={!allowed}>
            <Icon name="play" size={15} /> شغّل الكل{runCount ? ` (${runCount})` : ""}
          </button>
        ) : (
          <LoginLink className="jw-btn jw-btn-primary !min-h-9 !px-3 text-sm">سجّل الدخول للتشغيل</LoginLink>
        )}
      </div>
      {(notice || ready === false) && (
        <p className="cv-notice" role="status">
          {notice || "حفظ اللوحات في حسابك يتفعّل قريب؛ لوحتك محفوظة الحين في هذا المتصفح، وتقدر تبني وتشغّل عادي."}
          {notice && (
            <button type="button" onClick={() => setNotice("")} aria-label="سكّر">
              <Icon name="x" size={13} />
            </button>
          )}
        </p>
      )}

      <div className="cv-main" ref={wrapRef}>
        {mode === "board" ? (
          <>
            <Board
              nodes={shape.nodes}
              edges={shape.edges}
              vp={vp}
              onVp={setVp}
              selected={selected}
              onSelect={setSelected}
              selectedEdge={selectedEdge}
              onSelectEdge={setSelectedEdge}
              onBeginMove={recordStep}
              onMove={(ids, dx, dy) => setShape({ ...shapeRef.current, nodes: shapeRef.current.nodes.map((n) => (ids.includes(n.id) ? { ...n, x: Math.round(n.x + dx), y: Math.round(n.y + dy) } : n)) }, false)}
              onConnect={connect}
              renderNode={renderNode}
            />
            <div className="cv-zoom" dir="ltr">
              <button type="button" onClick={() => setVp((v) => zoomCenter(v, 1.2, wrapRef.current))} aria-label="كبّر" disabled={vp.s >= MAX_ZOOM}>
                +
              </button>
              <span>{Math.round(vp.s * 100)}%</span>
              <button type="button" onClick={() => setVp((v) => zoomCenter(v, 1 / 1.2, wrapRef.current))} aria-label="صغّر" disabled={vp.s <= MIN_ZOOM}>
                −
              </button>
              <button type="button" onClick={() => fit(shape.nodes)} aria-label="اعرض الكل">
                <Icon name="expand" size={14} />
              </button>
            </div>
            {selectedEdge && (
              <button type="button" className="cv-edge-del jw-btn !min-h-8 text-xs" onClick={() => removeEdge(selectedEdge)}>
                <Icon name="trash" size={13} /> شيل السلك
              </button>
            )}
            {selected.length > 1 && (
              <button type="button" className="cv-edge-del jw-btn !min-h-8 text-xs" onClick={() => removeNodes(selected)}>
                <Icon name="trash" size={13} /> احذف {selected.length} عقد
              </button>
            )}
            {!shape.nodes.length && (
              <div className="cv-empty">
                <p>لوحة فاضية. ضيف «عقدة» من فوق، أو افتح وصفة جاهزة.</p>
                <button type="button" className="jw-btn jw-btn-primary" onClick={() => (setLibTab("starters"), setLibrary(true))}>
                  وصفات جاهزة
                </button>
              </div>
            )}
          </>
        ) : (
          <ol className="cv-list jw-scroll" data-scroll>
            {order.map((id, i) => {
              const n = shape.nodes.find((x) => x.id === id);
              if (!n) return null;
              const ins = shape.edges.filter((e) => e.to === id).map((e) => titleOf(e.from));
              return (
                <li key={id} className={`cv-node cv-node-static cv-k-${n.kind} ${selected[0] === id ? "is-sel" : ""}`} onClick={(e) => !(e.target as HTMLElement).closest("[data-nodrag]") && setSelected([id])}>
                  <span className="cv-step">{i + 1}</span>
                  {renderNode(n)}
                  {ins.length > 0 && <p className="cv-from">ياخذ من: {ins.join("، ")}</p>}
                </li>
              );
            })}
            {!shape.nodes.length && <li className="cv-empty-li">ما فيه عقد. ضيف «عقدة» أو افتح «لوحاتي ووصفاتي».</li>}
          </ol>
        )}

        {selNode && (
          <Inspector
            key={selNode.id}
            node={selNode}
            nodes={shape.nodes}
            edges={shape.edges}
            generators={gensFor(selNode.kind)}
            ev={quotes[selNode.id]?.ev ?? null}
            price={quotes[selNode.id]?.price ?? null}
            owner={owner}
            look={look}
            media={mediaOf(selNode)}
            uploading={uploading[selNode.id] ?? ""}
            onData={(patch) => setData(selNode.id, patch)}
            onDelete={() => removeNodes([selNode.id])}
            onDuplicate={() => duplicateNode(selNode.id)}
            onDisconnect={removeEdge}
            onConnect={connect}
            onUpload={(f) => void upload(selNode.id, f)}
            onClose={() => setSelected([])}
          />
        )}
      </div>

      {/* before a run: what runs, what is reused, and the total */}
      <Dialog open={Boolean(confirmRun)} onClose={() => setConfirmRun(null)} title={confirmRun?.target ? `شغّل «${titleOf(confirmRun.target)}»` : "شغّل اللوحة"}>
        {confirmRun && (
          <div className="space-y-3 p-4" dir="rtl">
            <ul className="space-y-1.5 text-sm">
              {confirmRun.rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-jw-surface-2 px-3 py-2">
                  <span>{r.title}</span>
                  {r.manual ? <span className="text-xs text-jw-warn">تلوّنها بيدك بعدين</span> : r.price == null ? <span className="text-xs text-jw-muted">—</span> : <Riyal halalas={r.price} size={12} free={owner} />}
                </li>
              ))}
            </ul>
            {confirmRun.cached > 0 && <p className="text-xs text-jw-ok">{confirmRun.cached} عقدة نتيجتها جاهزة وما تغيّر شي فيها: ما بتنعاد وما تدفع عليها.</p>}
            <p className="flex items-center justify-between border-t border-jw-line pt-3 font-semibold">
              <span>{owner ? "القيمة" : "المجموع"}{confirmRun.estimated ? " (تقريبي)" : ""}</span>
              <Riyal halalas={confirmRun.total} size={15} free={owner} />
            </p>
            {confirmRun.estimated && <p className="text-xs text-jw-muted">بعض الأسعار تعتمد على مقاس نتيجة ما انصنعت بعد. إذا طلع السعر الفعلي أعلى، نسألك قبل ما نبدأ تلك العقدة.</p>}
            <p className="text-xs text-jw-muted">كل عقدة تولّد تنحجز قيمتها لما تبدأ، وإذا ما نجحت ترجع لك تلقائيًا. النتائج تنحفظ في «أعمالي» بعد.</p>
            {confirmRun.problems.length > 0 && (
              <ul className="space-y-1 rounded-lg border border-jw-danger/40 p-2 text-xs text-jw-danger" role="alert">
                {confirmRun.problems.map((p) => <li key={p.id}>«{p.title}»: {p.message}</li>)}
              </ul>
            )}
            {!owner && balance != null && confirmRun.total > balance && (
              <p className="text-xs text-jw-danger">
                رصيدك ما يكفي. <Link href="/jawad-ai/coins" className="underline">اشحن رصيدك</Link>
              </p>
            )}
            <div className="flex gap-2">
              <button type="button" className="jw-btn jw-btn-primary flex-1" disabled={confirmRun.problems.length > 0 || confirmRun.unknown > 0 || (!owner && balance != null && confirmRun.total > balance)} onClick={confirmAndRun}>
                {owner ? "شغّل" : <>أوافق على <Riyal halalas={confirmRun.total} size={13} /> وشغّل</>}
              </button>
              <button type="button" className="jw-btn" onClick={() => setConfirmRun(null)}>
                إلغاء
              </button>
            </div>
          </div>
        )}
      </Dialog>

      {/* a node's real price came out higher than agreed, or the price changed on the server */}
      <Dialog open={Boolean(priceAsk)} onClose={() => answerPrice(false)} title="تغيّر السعر">
        {priceAsk && (
          <div className="space-y-3 p-4 text-sm" dir="rtl">
            <p>
              سعر «{priceAsk.title}» صار <b><Riyal halalas={priceAsk.now} size={13} /></b> بدل <b><Riyal halalas={priceAsk.was} size={13} /></b>. ما انخصم شي بعد.
            </p>
            <div className="flex gap-2">
              <button type="button" className="jw-btn jw-btn-primary flex-1" onClick={() => answerPrice(true)}>
                أوافق على <Riyal halalas={priceAsk.now} size={13} />
              </button>
              <button type="button" className="jw-btn" onClick={() => answerPrice(false)}>
                أوقفها
              </button>
            </div>
          </div>
        )}
      </Dialog>

      {/* «لوحاتي ووصفاتي» */}
      <Dialog open={library} onClose={() => setLibrary(false)} title="لوحاتي ووصفاتي" wide>
        <div className="space-y-3 p-4" dir="rtl">
          <div className="jw-seg" role="tablist">
            {(
              [
                ["starters", "وصفات جاهزة"],
                ["recipes", "وصفاتي"],
                ["canvases", "لوحاتي"],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={libTab === k} onClick={() => setLibTab(k)}>
                {label}
              </button>
            ))}
          </div>
          {libTab === "starters" ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {STARTER_RECIPES.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="cv-recipe"
                    onClick={() => {
                      if (shape.nodes.length && !canvasId && !window.confirm("اللوحة الحالية ما انحفظت في حسابك. تبي تفتح الوصفة بدالها؟")) return;
                      track("studio.canvas_recipe_use");
                      setLibrary(false);
                      loadGraph(fitRecipe(r.graph, available, nid), { id: null, name: r.title });
                    }}
                  >
                    <Icon name={r.icon} size={18} />
                    <span>
                      <b>{r.title}</b>
                      <small>{r.hint}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : !user ? (
            <p className="text-sm text-jw-muted">
              <LoginLink className="underline">سجّل الدخول</LoginLink> عشان تشوف لوحاتك ووصفاتك.
            </p>
          ) : ready === false ? (
            <p className="text-sm text-jw-muted">حفظ اللوحات والوصفات يتفعّل قريب.</p>
          ) : (
            <ul className="space-y-1.5">
              {saved.filter((s) => s.kind === (libTab === "recipes" ? "recipe" : "canvas")).map((s) => (
                <li key={s.id} className="flex items-center gap-2 rounded-lg bg-jw-surface-2 px-3 py-2 text-sm">
                  <button type="button" className="flex-1 text-start" onClick={() => void openSaved(s)}>
                    <b>{s.name}</b> <small className="text-jw-muted">· {s.nodes} عقدة{s.id === canvasId ? " · مفتوحة" : ""}</small>
                  </button>
                  <button type="button" className="jw-btn jw-btn-icon !min-h-8" onClick={() => void duplicateSaved(s)} aria-label="نسخة">
                    <Icon name="copy" size={14} />
                  </button>
                  {deleting === s.id ? (
                    <button type="button" className="jw-btn !min-h-8 text-xs text-jw-danger" onClick={() => void deleteSaved(s)}>
                      متأكد؟ احذف
                    </button>
                  ) : (
                    <button type="button" className="jw-btn jw-btn-icon !min-h-8" onClick={() => setDeleting(s.id)} aria-label="احذف">
                      <Icon name="trash" size={14} />
                    </button>
                  )}
                </li>
              ))}
              {!saved.some((s) => s.kind === (libTab === "recipes" ? "recipe" : "canvas")) && <li className="text-sm text-jw-muted">{libTab === "recipes" ? "ما عندك وصفات. ابنِ لوحة واضغط «احفظ كوصفة»." : "ما عندك لوحات محفوظة."}</li>}
            </ul>
          )}
          <div className="flex flex-wrap gap-2 border-t border-jw-line pt-3">
            <button type="button" className="jw-btn" onClick={() => (setLibrary(false), newCanvas())}>
              <Icon name="plus" size={15} /> لوحة جديدة
            </button>
            <button type="button" className="jw-btn" disabled={!shape.nodes.length} onClick={() => setRecipeName(name)}>
              <Icon name="layers" size={15} /> احفظ اللوحة الحالية كوصفة
            </button>
          </div>
          {recipeName !== null && (
            <div className="flex gap-2">
              <input className="jw-input flex-1 text-sm" value={recipeName} maxLength={60} onChange={(e) => setRecipeName(e.target.value)} aria-label="اسم الوصفة" />
              <button type="button" className="jw-btn jw-btn-primary" onClick={() => void saveRecipe(recipeName)}>
                احفظ كوصفة
              </button>
            </div>
          )}
          <p className="text-xs text-jw-muted">الوصفة تحفظ العقد والأسلاك والإعدادات بدون النتائج ولا صورك، فتقدر تعيد استخدامها بصور جديدة.</p>
        </div>
      </Dialog>

      {painting && (
        <ImageTools
          open
          onClose={() => setPainting(null)}
          source={painting.source}
          initialTool={MANUAL_TOOL_ID}
          tools={inpaintGen}
          prices={prices}
          owner={owner}
          balance={balance}
          onCreated={(job, bal) => {
            const p = painting;
            setPainting(null);
            if (typeof bal === "number") setBalance(bal);
            setStatus(p.nodeId, { state: "working", note: "يولّد…" });
            void watchJob(p.nodeId, job, p.sig);
          }}
        />
      )}
    </div>
  );
}

/** Zoom by a factor around the middle of the board. */
function zoomCenter(v: Viewport, k: number, el: HTMLElement | null): Viewport {
  const r = el?.getBoundingClientRect();
  const cx = (r?.width ?? 0) / 2;
  const cy = (r?.height ?? 0) / 2;
  const s = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.s * k));
  return { s, x: cx - ((cx - v.x) / v.s) * s, y: cy - ((cy - v.y) / v.s) * s };
}
