// «صانع المحتوى» — the conversations: kept per person with the project's record and what was produced, so a chat is
// still there after a reload, with its questions, slides and the edit rooms it opened. Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { CONTENT, type CarouselAspect } from "@config/content";

const db = () => createAdminClient();

const ASPECTS = ["1:1", "2:3", "9:16", "16:9"];
const aspectOf = (v: unknown): CarouselAspect => (ASPECTS.includes(String(v)) ? String(v) : "1:1") as CarouselAspect;

/** A file the person attached to a message (one of their JAWAD AI uploads). */
export interface Attachment {
  id: string;
  kind: "image" | "video" | "audio" | "doc";
  name: string;
  durationMs: number | null;
}

/** One slide made by GPT Image 2 (a content_files row). */
export interface Slide {
  n: number;
  fileId: string;
  name: string;
  text: string;
  /** what the check after drawing still found wrong (the slide is kept, flagged) */
  flag?: string;
  /** drawn again by itself after the check found a mistake, and then sound */
  fixed?: boolean;
}

/** A slide that was not made, with what is needed to try it again. */
export interface SlideFailure {
  n: number;
  reason: string;
  /** the technical reason (only the owner sees it) */
  detail?: string;
  text: string;
  prompt: string;
}

/** The carousel of an answer: what exists, what is still being drawn, what failed, and the check's report. */
export interface SlidesBlock {
  aspect: CarouselAspect;
  items: Slide[];
  /** the numbers still being drawn (new ones, or ones being drawn again) */
  todo: number[];
  failed: SlideFailure[];
  running: boolean;
  total: number;
  styleId: string;
  templateId: string;
  report?: string;
}

/** One picture or video «محمد باقر» asked جواد for (outside a carousel), and where it stands. */
export interface MediaItem {
  id: string;
  kind: "image" | "video";
  name: string;
  prompt: string;
  aspect: string;
  quality?: string;
  resolution?: string;
  seconds?: number;
  withSound?: boolean;
  /** the person's attached files (jawad_uploads ids) used as references */
  refs: string[];
  state: "todo" | "running" | "done" | "failed";
  /** جواد's job once he took the request */
  jobId?: string;
  /** a content_files row, when made */
  fileId?: string;
  /** what جواد answered when he took it: his generator, the settings, the price */
  desk?: { generator: string; coins: number; free: boolean; settings: Record<string, unknown> };
  error?: string;
  /** the technical reason (only the owner sees it) */
  detail?: string;
  transient?: boolean;
  tries?: number;
}

/** The pictures and videos of an answer: requests handed to جواد. */
export interface MediaBlock {
  items: MediaItem[];
}

/** A question of a batch, answered by pressing (or writing). */
export interface Question {
  label: string;
  kind: "choice" | "templates" | "styles" | "motion" | "moods";
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
  /** a carousel this answer produced (filled by the produce step) */
  slides?: SlidesBlock;
  /** pictures and videos this answer handed to جواد (filled by the media step) */
  media?: MediaBlock;
  /** an edit room this answer opened in «حيدرة كت» */
  editor?: { id: string; title: string };
  error?: boolean;
}

/** A carousel ordered and being made: the produce step takes it a few slides at a time. */
export interface PendingProduce {
  id: string;
  aspect: CarouselAspect;
  slides: { n: number; text: string; prompt: string }[];
  /** the message index the slides are attached to */
  at: number;
  styleId: string;
  templateId: string;
  /** the person's attached pictures (jawad_uploads ids) handed to جواد with every slide: a logo, a photo, a product */
  refs?: string[];
  /** "fix": only these slides are drawn again, in a carousel that exists */
  mode: "all" | "fix";
  /** made in this production so far */
  made: Slide[];
  failed: SlideFailure[];
  /** failures of other slides of the carousel that this production leaves as they are */
  carry: SlideFailure[];
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
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const objs = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : []);

function readFiles(v: unknown): Attachment[] | undefined {
  const out = objs(v)
    .filter((f) => typeof f.id === "string")
    .map((f) => ({ id: f.id as string, kind: (f.kind === "video" || f.kind === "audio" || f.kind === "doc" ? f.kind : "image") as Attachment["kind"], name: str(f.name, 200), durationMs: typeof f.durationMs === "number" ? f.durationMs : null }))
    .slice(0, CONTENT.maxAttachments);
  return out.length ? out : undefined;
}

const readSlide = (x: Record<string, unknown>): Slide => ({
  n: num(x.n),
  fileId: x.fileId as string,
  name: str(x.name, 120),
  text: str(x.text, 2000),
  ...(typeof x.flag === "string" && x.flag ? { flag: x.flag.slice(0, 400) } : {}),
  ...(x.fixed === true ? { fixed: true } : {}),
});
const readFailure = (x: Record<string, unknown>): SlideFailure => ({ n: num(x.n), reason: str(x.reason, 300), ...(typeof x.detail === "string" && x.detail ? { detail: x.detail.slice(0, 400) } : {}), text: str(x.text, 2000), prompt: str(x.prompt, 4000) });

/** Media items from the model or from storage, checked. */
export function readMedia(v: unknown): MediaItem[] {
  return objs(v)
    .filter((x) => typeof x.prompt === "string" && (x.kind === "image" || x.kind === "video"))
    .map((x): MediaItem => {
      const d = x.desk as Record<string, unknown> | undefined;
      return {
        id: str(x.id, 60) || "m",
        kind: x.kind as MediaItem["kind"],
        name: str(x.name, 120),
        prompt: str(x.prompt, 4000),
        aspect: str(x.aspect, 8) || "9:16",
        ...(typeof x.quality === "string" && x.quality ? { quality: x.quality.slice(0, 12) } : {}),
        ...(typeof x.resolution === "string" && x.resolution ? { resolution: x.resolution.slice(0, 12) } : {}),
        ...(num(x.seconds) > 0 ? { seconds: num(x.seconds) } : {}),
        ...(typeof x.withSound === "boolean" ? { withSound: x.withSound } : {}),
        refs: (Array.isArray(x.refs) ? x.refs : []).filter((r): r is string => typeof r === "string").slice(0, 16),
        state: x.state === "running" || x.state === "done" || x.state === "failed" ? x.state : "todo",
        ...(typeof x.jobId === "string" && x.jobId ? { jobId: x.jobId } : {}),
        ...(typeof x.fileId === "string" && x.fileId ? { fileId: x.fileId } : {}),
        ...(d && typeof d === "object" ? { desk: { generator: str(d.generator, 80), coins: num(d.coins), free: d.free === true, settings: (d.settings as Record<string, unknown>) ?? {} } } : {}),
        ...(typeof x.error === "string" && x.error ? { error: x.error.slice(0, 300) } : {}),
        ...(typeof x.detail === "string" && x.detail ? { detail: x.detail.slice(0, 400) } : {}),
        ...(x.transient === true ? { transient: true } : {}),
        ...(num(x.tries) > 0 ? { tries: num(x.tries) } : {}),
      };
    })
    .slice(0, 12);
}

/** Questions from the model or from storage, checked: at most 6, each with a short label and at most 8 short options. */
export function readQuestions(v: unknown): Question[] | undefined {
  const out = objs(v)
    .map((q): Question => {
      const kind = q.kind === "templates" || q.kind === "styles" || q.kind === "motion" || q.kind === "moods" ? q.kind : "choice";
      const options = kind === "choice" ? (Array.isArray(q.options) ? q.options : []).filter((o): o is string => typeof o === "string" && o.trim().length > 0).map((o) => o.trim().slice(0, 140)).slice(0, 8) : [];
      return { label: str(q.label, 120).trim(), kind, options, multi: q.multi === true && kind === "choice" };
    })
    .filter((q) => q.label && (q.kind !== "choice" || q.options.length > 0))
    .slice(0, 6);
  return out.length ? out : undefined;
}

/** Messages from storage, checked: only the two roles, text, the attachments, the questions, what was produced. */
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
    if (role === "assistant") {
      const questions = readQuestions(m.questions);
      if (questions) turn.questions = questions;
    }
    const s = m.slides as Record<string, unknown> | undefined;
    if (s && typeof s === "object" && Array.isArray(s.items)) {
      turn.slides = {
        aspect: aspectOf(s.aspect),
        items: objs(s.items).filter((x) => typeof x.fileId === "string").map(readSlide),
        todo: (Array.isArray(s.todo) ? s.todo : []).map(num).filter((n) => n > 0).slice(0, CONTENT.maxSlides),
        failed: objs(s.failed).map(readFailure),
        running: s.running === true,
        total: num(s.total),
        styleId: str(s.styleId, 60),
        templateId: str(s.templateId, 60),
        ...(typeof s.report === "string" && s.report ? { report: s.report.slice(0, 4000) } : {}),
      };
    }
    const md = m.media as Record<string, unknown> | undefined;
    if (md && typeof md === "object" && Array.isArray(md.items)) {
      const items = readMedia(md.items);
      if (items.length) turn.media = { items };
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
  const slides = objs(p.slides)
    .filter((s) => typeof s.prompt === "string")
    .map((s, i) => ({ n: num(s.n) || i + 1, text: str(s.text, 2000), prompt: str(s.prompt, 4000) }))
    .slice(0, CONTENT.maxSlides);
  if (!slides.length) return null;
  return {
    id: str(p.id, 60) || "legacy",
    aspect: aspectOf(p.aspect),
    slides,
    at: num(p.at),
    styleId: str(p.styleId, 60),
    templateId: str(p.templateId, 60),
    ...(Array.isArray(p.refs) && p.refs.length ? { refs: p.refs.filter((r): r is string => typeof r === "string").slice(0, 6) } : {}),
    mode: p.mode === "fix" ? "fix" : "all",
    made: objs(p.made).filter((x) => typeof x.fileId === "string").map(readSlide),
    failed: objs(p.failed).map(readFailure),
    carry: objs(p.carry).map(readFailure),
  };
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
