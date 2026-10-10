// «المصمم الذكي» — the conversations: kept per person with the project's record and the designs made, so a chat is
// still there after a reload, with its questions, its artwork and its layers as the person last left them. Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { DESIGNER, isDesignAspect, isDesignKind, type DesignAspect, type DesignKind } from "@config/designer";
import { readDesign, readLayers, type Design, type Layer } from "./layers";

const db = () => createAdminClient();

/** A file the person attached to a message (one of their JAWAD AI uploads). */
export interface Attachment {
  id: string;
  kind: "image" | "video" | "audio" | "doc";
  name: string;
  durationMs: number | null;
}

/** A question of a batch, answered by pressing (or writing). */
export interface Question {
  label: string;
  kind: "choice" | "source" | "directions" | "fonts";
  options: string[];
  multi: boolean;
}

export interface Turn {
  role: "user" | "assistant";
  text: string;
  /** the person's attachments with this message */
  files?: Attachment[];
  /** the questions this answer asks, as buttons */
  questions?: Question[];
  /** the design this answer produced (its artwork drawn by the produce step; its layers edited by the person) */
  design?: Design;
  error?: boolean;
}

/** A design ordered and being drawn: the produce step takes it. */
export interface PendingDesign {
  id: string;
  /** the message index the design is attached to */
  at: number;
  kind: DesignKind;
  aspect: DesignAspect;
  /** the artwork's prompt (English, no text); empty = keep the artwork that stands (only the layers change) */
  artwork: string;
  /** the person's attached pictures (jawad_uploads ids) handed to جواد as references */
  refs: string[];
  layers: Layer[];
  /** the artwork to keep when `artwork` is empty (a designer_files row) */
  keep: string | null;
}

export interface Chat {
  id: string;
  title: string;
  messages: Turn[];
  record: string;
  pending: PendingDesign | null;
  usd: number;
  updatedAt: string;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const objs = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : []);

function readFiles(v: unknown): Attachment[] | undefined {
  const out = objs(v)
    .filter((f) => typeof f.id === "string")
    .map((f) => ({ id: f.id as string, kind: (f.kind === "video" || f.kind === "audio" || f.kind === "doc" ? f.kind : "image") as Attachment["kind"], name: str(f.name, 200), durationMs: typeof f.durationMs === "number" ? f.durationMs : null }))
    .slice(0, DESIGNER.maxAttachments);
  return out.length ? out : undefined;
}

/** Questions from the model or from storage, checked: at most 5, each with a short label and at most 8 short options. */
export function readQuestions(v: unknown): Question[] | undefined {
  const out = objs(v)
    .map((q): Question => {
      const kind = q.kind === "source" || q.kind === "directions" || q.kind === "fonts" ? q.kind : "choice";
      const options = kind === "source" || kind === "fonts" ? [] : (Array.isArray(q.options) ? q.options : []).filter((o): o is string => typeof o === "string" && o.trim().length > 0).map((o) => o.trim().slice(0, 160)).slice(0, 8);
      return { label: str(q.label, 140).trim(), kind, options, multi: q.multi === true && kind === "choice" };
    })
    .filter((q) => q.label && (q.kind === "source" || q.kind === "fonts" || q.options.length > 0))
    .slice(0, 5);
  return out.length ? out : undefined;
}

/** Messages from storage, checked: only the two roles, text, the attachments, the questions, the design. */
export function cleanHistory(raw: unknown): Turn[] {
  if (!Array.isArray(raw)) return [];
  const out: Turn[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") continue;
    const m = t as Record<string, unknown>;
    const role = m.role === "assistant" ? "assistant" : m.role === "user" ? "user" : null;
    if (!role || typeof m.text !== "string") continue;
    const text = m.text.slice(0, role === "user" ? DESIGNER.messageMax : 60_000);
    const files = role === "user" ? readFiles(m.files) : undefined;
    if (!text.trim() && !files) continue;
    const turn: Turn = { role, text };
    if (files) turn.files = files;
    if (m.error === true) turn.error = true;
    if (role === "assistant") {
      const questions = readQuestions(m.questions);
      if (questions) turn.questions = questions;
      const design = readDesign(m.design);
      if (design) turn.design = design;
    }
    out.push(turn);
  }
  return out;
}

export function readPending(v: unknown): PendingDesign | null {
  if (!v || typeof v !== "object") return null;
  const p = v as Record<string, unknown>;
  const aspect = isDesignAspect(p.aspect) ? p.aspect : "1:1";
  const artwork = str(p.artwork, 6000).trim();
  const keep = typeof p.keep === "string" && p.keep ? p.keep : null;
  if (!artwork && !keep) return null;
  return {
    id: str(p.id, 60) || "legacy",
    at: num(p.at),
    kind: isDesignKind(p.kind) ? p.kind : "other",
    aspect,
    artwork,
    refs: (Array.isArray(p.refs) ? p.refs : []).filter((r): r is string => typeof r === "string").slice(0, 6),
    layers: readLayers(p.layers),
    keep,
  };
}

/** The turns sent to Claude: the last ones, starting with the person, without failed answers. */
export function forModel(history: Turn[]): Turn[] {
  const cut = history.filter((t) => !t.error).slice(-DESIGNER.historyTurns);
  while (cut.length && cut[0].role !== "user") cut.shift();
  return cut;
}

/** A short title from the first thing the person said. */
export const titleOf = (first: string) => first.replace(/\s+/g, " ").trim().slice(0, 60) || "تصميم جديد";

/** The index of the last answer that carries a design (where a retry, the layers' edits and the final PNG go). */
export const lastDesignAt = (messages: Turn[]) => messages.map((m) => !!m.design).lastIndexOf(true);

const view = (r: Record<string, unknown>): Chat => ({
  id: r.id as string,
  title: String(r.title ?? ""),
  messages: cleanHistory(r.messages),
  record: str(r.record, 20_000),
  pending: readPending(r.pending),
  usd: Number(r.usd ?? 0),
  updatedAt: String(r.updated_at ?? ""),
});

export async function listChats(userId: string) {
  const { data, error } = await db().from("designer_chats").select("id,title,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id as string, title: String(r.title || "تصميم جديد"), updatedAt: String(r.updated_at) }));
}

export async function getChat(userId: string, id: string): Promise<Chat | null> {
  const { data } = await db().from("designer_chats").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  return data ? view(data) : null;
}

/** Saves the conversation (a new one when `id` is null); returns its id. */
export async function saveChat(userId: string, id: string | null, patch: { messages: Turn[]; record?: string; pending?: PendingDesign | null; addUsd?: number }): Promise<string> {
  const set: Record<string, unknown> = { messages: patch.messages, updated_at: new Date().toISOString() };
  if (patch.record !== undefined) set.record = patch.record.slice(0, 20_000);
  if (patch.pending !== undefined) set.pending = patch.pending;
  if (id) {
    const { data } = await db().from("designer_chats").select("usd").eq("id", id).eq("user_id", userId).maybeSingle();
    if (!data) throw new Error("chat not found");
    set.usd = Number(data.usd ?? 0) + (patch.addUsd ?? 0);
    const { error } = await db().from("designer_chats").update(set).eq("id", id).eq("user_id", userId);
    if (error) throw error;
    return id;
  }
  const first = patch.messages.find((m) => m.role === "user")?.text ?? "";
  const { data, error } = await db().from("designer_chats").insert({ user_id: userId, title: titleOf(first), record: patch.record ?? "", pending: patch.pending ?? null, usd: patch.addUsd ?? 0, ...set }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteChat(userId: string, id: string) {
  await db().from("designer_chats").delete().eq("id", id).eq("user_id", userId);
}

/** The person's edits of the layers of the last design (saved as they are, so a reload shows them). */
export async function saveLayers(userId: string, chatId: string, layers: unknown): Promise<Design> {
  const chat = await getChat(userId, chatId);
  if (!chat) throw new Error("chat not found");
  const at = lastDesignAt(chat.messages);
  if (at < 0) throw new Error("no design");
  const design: Design = { ...chat.messages[at].design!, layers: readLayers(layers) };
  const messages = [...chat.messages];
  messages[at] = { ...messages[at], design };
  await saveChat(userId, chatId, { messages });
  return design;
}
