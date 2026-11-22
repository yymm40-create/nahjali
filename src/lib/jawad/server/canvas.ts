// «الجواد الذكي!» | JAWAD AI — «اللوحة», the database side: the person's saved canvases and their own recipes
// (migration 0126). Server only. Until 0126 runs every read answers «not ready» and the page keeps saving off with a
// one-line note; nothing here throws for a missing table. The graph is checked (config/jawad/canvas.ts) before it is kept.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { asRecipe, cleanCanvasName, cleanGraph, type CanvasGraph } from "@config/jawad/canvas";
import { isUuid } from "./uploads";

const db = () => createAdminClient();
/** The table of 0126 isn't there yet. */
export const canvasMissing = (e: unknown) => ["42P01", "PGRST202", "PGRST205"].includes((e as { code?: string } | null)?.code ?? "");
export const CANVAS_NOT_READY = "حفظ اللوحات يتفعّل قريب.";
/** How many canvases and recipes one person keeps. */
export const MAX_SAVED = 200;

export type CanvasKind = "canvas" | "recipe";

export interface CanvasSummary {
  id: string;
  name: string;
  kind: CanvasKind;
  nodes: number;
  updatedAt: string;
}
export interface CanvasDoc extends CanvasSummary {
  graph: CanvasGraph;
}

interface Row {
  id: string;
  user_id: string;
  name: string;
  kind: CanvasKind;
  graph: CanvasGraph;
  updated_at: string;
}

const summary = (r: Row): CanvasSummary => ({ id: r.id, name: r.name, kind: r.kind, nodes: Array.isArray(r.graph?.nodes) ? r.graph.nodes.length : 0, updatedAt: r.updated_at });

/** Whether 0126 has run, and the person's canvases and recipes, newest first. */
export async function listCanvases(userId: string): Promise<{ ready: boolean; items: CanvasSummary[] }> {
  const { data, error } = await db().from("jawad_canvases").select("id,user_id,name,kind,graph,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(MAX_SAVED);
  if (canvasMissing(error)) return { ready: false, items: [] };
  if (error) throw error;
  return { ready: true, items: ((data ?? []) as Row[]).map(summary) };
}

async function own(userId: string, id: unknown): Promise<Row> {
  if (!isUuid(id)) throw new UserError("لوحة غير صحيحة.", 400);
  const { data, error } = await db().from("jawad_canvases").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  if (canvasMissing(error)) throw new UserError(CANVAS_NOT_READY, 503);
  if (error) throw error;
  if (!data) throw new UserError("ما لقينا هذي اللوحة.", 404);
  return data as Row;
}

export async function getCanvas(userId: string, id: unknown): Promise<CanvasDoc> {
  const r = await own(userId, id);
  const g = cleanGraph(r.graph, r.kind === "canvas");
  return { ...summary(r), graph: "graph" in g ? g.graph : { v: 1, nodes: [], edges: [], runs: {} } };
}

function graphOf(raw: unknown, kind: CanvasKind): CanvasGraph {
  const g = cleanGraph(raw, kind === "canvas");
  if ("error" in g) throw new UserError(g.error, 400);
  return kind === "recipe" ? asRecipe(g.graph) : g.graph;
}

/** A new canvas or recipe: from a graph, or a copy of one of the person's own (`fromId`, «نسخة»). */
export async function createCanvas(userId: string, b: { name?: unknown; kind?: unknown; graph?: unknown; fromId?: unknown }): Promise<CanvasDoc> {
  const kind: CanvasKind = b.kind === "recipe" ? "recipe" : "canvas";
  let name = cleanCanvasName(b.name);
  let graph: CanvasGraph;
  if (b.fromId !== undefined) {
    const src = await own(userId, b.fromId);
    graph = graphOf(src.graph, kind);
    if (!name) name = cleanCanvasName(`${src.name} (نسخة)`);
  } else graph = graphOf(b.graph, kind);
  if (!name) throw new UserError("اكتب اسم اللوحة.", 400);
  const { count, error: countError } = await db().from("jawad_canvases").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (canvasMissing(countError)) throw new UserError(CANVAS_NOT_READY, 503);
  if ((count ?? 0) >= MAX_SAVED) throw new UserError(`عندك ${MAX_SAVED} لوحة ووصفة؛ احذف وحدة قديمة أولًا.`, 400);
  const { data, error } = await db().from("jawad_canvases").insert({ user_id: userId, name, kind, graph }).select("*").single();
  if (canvasMissing(error)) throw new UserError(CANVAS_NOT_READY, 503);
  if (error) throw error;
  return { ...summary(data as Row), graph };
}

/** Saves a canvas's name and/or graph. */
export async function updateCanvas(userId: string, id: unknown, b: { name?: unknown; graph?: unknown }): Promise<CanvasSummary> {
  const r = await own(userId, id);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (b.name !== undefined) {
    const name = cleanCanvasName(b.name);
    if (!name) throw new UserError("اكتب اسم اللوحة.", 400);
    patch.name = name;
  }
  if (b.graph !== undefined) patch.graph = graphOf(b.graph, r.kind);
  const { data, error } = await db().from("jawad_canvases").update(patch).eq("id", r.id).eq("user_id", userId).select("*").single();
  if (error) throw error;
  return summary(data as Row);
}

export async function deleteCanvas(userId: string, id: unknown): Promise<void> {
  const r = await own(userId, id);
  const { error } = await db().from("jawad_canvases").delete().eq("id", r.id).eq("user_id", userId);
  if (error) throw error;
}
