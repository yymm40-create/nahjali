// «صانع المحتوى» — the conversations: kept per person with the project's record and what was produced, so a chat is
// still there after a reload, with its slides and the edit rooms it opened. Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { CONTENT, type CarouselAspect } from "@config/content";

const db = () => createAdminClient();

/** A file the person attached to a message (one of their JAWAD AI uploads). */
export interface Attachment {
  id: string;
  kind: "image" | "video" | "audio";
  name: string;
  durationMs: number | null;
}

/** One slide made by GPT Image 2 (a content_files row). */
export interface Slide {
  n: number;
  fileId: string;
  name: string;
  text: string;
}

export interface Turn {
  role: "user" | "assistant";
  text: string;
  /** the person's attachments with this message */
  files?: Attachment[];
  /** a carousel this answer produced (filled by the produce step) */
  slides?: { aspect: CarouselAspect; items: Slide[]; failed: number };
  /** an edit room this answer opened in «حيدرة كت» */
  editor?: { id: string; title: string };
  error?: boolean;
}

/** A carousel the persona asked to produce, waiting for the produce step (then cleared). */
export interface PendingProduce {
  aspect: CarouselAspect;
  slides: { n: number; text: string; prompt: string }[];
  /** the message index that announced it (its slides are attached there) */
  at: number;
}

export interface Chat {
  id: string;
  title: string;
  messages: Turn[];
  record: string;
  pending: PendingProduce | null;
  usd: number;
  updatedAt: string;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

function readFiles(v: unknown): Attachment[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter((f): f is Record<string, unknown> => !!f && typeof f === "object" && typeof f.id === "string")
    .map((f) => ({ id: f.id as string, kind: (f.kind === "video" || f.kind === "audio" ? f.kind : "image") as Attachment["kind"], name: str(f.name, 200), durationMs: typeof f.durationMs === "number" ? f.durationMs : null }))
    .slice(0, CONTENT.maxAttachments);
  return out.length ? out : undefined;
}

/** Messages from storage, checked: only the two roles, text, the attachments, what was produced. */
export function cleanHistory(raw: unknown): Turn[] {
  if (!Array.isArray(raw)) return [];
  const out: Turn[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") continue;
    const m = t as Record<string, unknown>;
    const role = m.role === "assistant" ? "assistant" : m.role === "user" ? "user" : null;
    if (!role || typeof m.text !== "string") continue;
    const text = m.text.slice(0, role === "user" ? CONTENT.messageMax : 60_000);
    const files = role === "user" ? readFiles(m.files) : undefined;
    if (!text.trim() && !files) continue;
    const turn: Turn = { role, text };
    if (files) turn.files = files;
    if (m.error === true) turn.error = true;
    const s = m.slides as Record<string, unknown> | undefined;
    if (s && typeof s === "object" && Array.isArray(s.items)) {
      turn.slides = {
        aspect: (["1:1", "2:3", "9:16", "16:9"].includes(String(s.aspect)) ? String(s.aspect) : "1:1") as CarouselAspect,
        items: (s.items as Record<string, unknown>[]).filter((x) => x && typeof x.fileId === "string").map((x) => ({ n: Number(x.n) || 0, fileId: x.fileId as string, name: str(x.name, 120), text: str(x.text, 2000) })),
        failed: Number(s.failed) || 0,
      };
    }
    const e = m.editor as Record<string, unknown> | undefined;
    if (e && typeof e === "object" && typeof e.id === "string") turn.editor = { id: e.id, title: str(e.title, 120) };
    out.push(turn);
  }
  return out;
}

export function readPending(v: unknown): PendingProduce | null {
  if (!v || typeof v !== "object") return null;
  const p = v as Record<string, unknown>;
  if (!Array.isArray(p.slides)) return null;
  const slides = (p.slides as Record<string, unknown>[])
    .filter((s) => s && typeof s === "object" && typeof s.prompt === "string")
    .map((s, i) => ({ n: Number(s.n) || i + 1, text: str(s.text, 2000), prompt: str(s.prompt, 4000) }))
    .slice(0, CONTENT.maxSlides);
  if (!slides.length) return null;
  return { aspect: (["1:1", "2:3", "9:16", "16:9"].includes(String(p.aspect)) ? String(p.aspect) : "1:1") as CarouselAspect, slides, at: Number(p.at) || 0 };
}

/** The turns sent to Claude: the last ones, starting with the person, without failed answers. */
export function forModel(history: Turn[]): Turn[] {
  const cut = history.filter((t) => !t.error).slice(-CONTENT.historyTurns);
  while (cut.length && cut[0].role !== "user") cut.shift();
  return cut;
}

/** A short title from the first thing the person said. */
export const titleOf = (first: string) => first.replace(/\s+/g, " ").trim().slice(0, 60) || "محادثة جديدة";

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
  const { data, error } = await db().from("content_chats").select("id,title,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id as string, title: String(r.title || "محادثة جديدة"), updatedAt: String(r.updated_at) }));
}

export async function getChat(userId: string, id: string): Promise<Chat | null> {
  const { data } = await db().from("content_chats").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  return data ? view(data) : null;
}

/** Saves the conversation (a new one when `id` is null); returns its id. */
export async function saveChat(userId: string, id: string | null, patch: { messages: Turn[]; record?: string; pending?: PendingProduce | null; addUsd?: number }): Promise<string> {
  const set: Record<string, unknown> = { messages: patch.messages, updated_at: new Date().toISOString() };
  if (patch.record !== undefined) set.record = patch.record.slice(0, 20_000);
  if (patch.pending !== undefined) set.pending = patch.pending;
  if (id) {
    const { data } = await db().from("content_chats").select("usd").eq("id", id).eq("user_id", userId).maybeSingle();
    if (!data) throw new Error("chat not found");
    set.usd = Number(data.usd ?? 0) + (patch.addUsd ?? 0);
    const { error } = await db().from("content_chats").update(set).eq("id", id).eq("user_id", userId);
    if (error) throw error;
    return id;
  }
  const first = patch.messages.find((m) => m.role === "user")?.text ?? "";
  const { data, error } = await db().from("content_chats").insert({ user_id: userId, title: titleOf(first), record: patch.record ?? "", pending: patch.pending ?? null, usd: patch.addUsd ?? 0, ...set }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteChat(userId: string, id: string) {
  await db().from("content_chats").delete().eq("id", id).eq("user_id", userId);
}
