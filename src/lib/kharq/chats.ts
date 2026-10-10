// «محمد الخارق» — the conversations: kept per person with his internal record (the ROCTCF template he embodies, never
// shown), the clickable questions, what he delivered, and the branches he pointed to. Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { KHARQ, isDeliverKind, isKharqStage, ROAD_IDS, type DeliverKind, type KharqStage } from "@config/kharq";

const db = () => createAdminClient();

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\u0000/g, "").slice(0, max) : "");

/** A file the person attached to a message (one of their JAWAD AI uploads). */
export interface Attachment {
  id: string;
  kind: "image" | "video" | "audio" | "doc";
  name: string;
  durationMs: number | null;
}

/** One clickable question: its options are buttons, and the page always adds «✍️ اكتب إجابة مختلفة». */
export interface Question {
  label: string;
  options: string[];
  multi: boolean;
}

/** A table he delivered: the head row and the body rows (every cell a plain string). */
export interface DeliverTable {
  columns: string[];
  rows: string[][];
}

/** A picture or a video he proposes. Nothing is made until the person presses the confirm button. */
export interface MediaAsk {
  /** stable inside the conversation, so the confirm button names which one */
  id: string;
  kind: "image" | "video";
  name: string;
  prompt: string;
  aspect: string;
  quality: string;
  resolution: string;
  seconds: number;
  withSound: boolean;
  /** the price the person was shown (halalas), filled by the server, null when it could not be worked out */
  coins: number | null;
  /** once confirmed: جواد's job, and where it stands */
  jobId?: string;
  state?: "running" | "done" | "failed";
  status?: string;
  fileId?: string;
  error?: string;
}

/** What he put in the person's hands in one answer. */
export interface Deliver {
  kind: DeliverKind;
  title: string;
  /** the words themselves (a text, a message, or the PDF's body as light markdown) */
  text: string;
  table: DeliverTable | null;
  media: MediaAsk[];
}

export interface Turn {
  role: "user" | "assistant";
  text: string;
  files?: Attachment[];
  questions?: Question[];
  deliver?: Deliver;
  /** branch ids of the site he pointed to */
  suggest?: string[];
  error?: boolean;
}

export interface Chat {
  id: string;
  title: string;
  messages: Turn[];
  /** his internal ROCTCF template; the page never receives it */
  brief: string;
  stage: KharqStage;
  updatedAt: string;
}

export function readQuestions(v: unknown): Question[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter((q): q is Record<string, unknown> => Boolean(q) && typeof q === "object")
    .map((q) => ({
      label: str(q.label, 300),
      options: (Array.isArray(q.options) ? q.options : []).filter((o): o is string => typeof o === "string").map((o) => o.slice(0, 180)).slice(0, 8),
      multi: q.multi === true,
    }))
    .filter((q) => q.label)
    .slice(0, 6);
  return out.length ? out : undefined;
}

export function readTable(v: unknown): DeliverTable | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const columns = (Array.isArray(o.columns) ? o.columns : []).map((c) => str(c, 160)).slice(0, 20);
  if (!columns.length) return null;
  const rows: string[][] = [];
  let cells = columns.length;
  for (const r of Array.isArray(o.rows) ? o.rows : []) {
    if (!Array.isArray(r)) continue;
    const row = columns.map((_, i) => str(r[i], 1200));
    if (cells + row.length > KHARQ.tableCells) break;
    cells += row.length;
    rows.push(row);
  }
  return rows.length ? { columns, rows } : null;
}

const ASPECTS = ["1:1", "16:9", "9:16", "3:2", "2:3", "4:3", "3:4", "21:9"];

export function readMedia(v: unknown, at = Date.now()): MediaAsk[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((m): m is Record<string, unknown> => Boolean(m) && typeof m === "object")
    .map((m, i): MediaAsk => {
      const video = m.kind === "video";
      const resolution = str(m.resolution, 10);
      return {
        id: str(m.id, 60) || `m${at}-${i}`,
        kind: video ? "video" : "image",
        name: str(m.name, 120) || (video ? "مقطع" : "صورة"),
        prompt: str(m.prompt, 6000),
        aspect: ASPECTS.includes(str(m.aspect, 10)) ? str(m.aspect, 10) : video ? "16:9" : "1:1",
        quality: ["low", "medium", "high"].includes(str(m.quality, 10)) ? str(m.quality, 10) : "high",
        resolution: video ? (["480p", "720p", "1080p"].includes(resolution) ? resolution : "1080p") : resolution === "hi" ? "hi" : "std",
        seconds: video ? Math.max(4, Math.min(15, Math.round(Number(m.seconds) || 5))) : 0,
        withSound: video ? m.withSound !== false && m.with_sound !== false : false,
        coins: typeof m.coins === "number" ? m.coins : null,
        ...(typeof m.jobId === "string" ? { jobId: m.jobId } : {}),
        ...(m.state === "running" || m.state === "done" || m.state === "failed" ? { state: m.state } : {}),
        ...(typeof m.status === "string" ? { status: str(m.status, 120) } : {}),
        ...(typeof m.fileId === "string" ? { fileId: m.fileId } : {}),
        ...(typeof m.error === "string" ? { error: str(m.error, 400) } : {}),
      };
    })
    .filter((m) => m.prompt)
    .slice(0, KHARQ.mediaMax);
}

export function readDeliver(v: unknown): Deliver | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const kind: DeliverKind = isDeliverKind(o.kind) ? o.kind : "none";
  if (kind === "none") return undefined;
  const d: Deliver = { kind, title: str(o.title, 200), text: str(o.text, KHARQ.textMax), table: readTable(o.table), media: readMedia(o.media) };
  // a delivery with nothing in it is no delivery
  if (!d.text && !d.table && !d.media.length) return undefined;
  return d;
}

const readFiles = (v: unknown): Attachment[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter((f): f is Record<string, unknown> => Boolean(f) && typeof f === "object" && typeof f.id === "string")
    .map((f) => ({
      id: f.id as string,
      kind: (f.kind === "video" || f.kind === "audio" || f.kind === "doc" ? f.kind : "image") as Attachment["kind"],
      name: str(f.name, 200),
      durationMs: typeof f.durationMs === "number" ? f.durationMs : null,
    }))
    .slice(0, 12);
  return out.length ? out : undefined;
};

const readSuggest = (v: unknown): string[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const out = [...new Set(v.filter((s): s is string => typeof s === "string").filter((s) => (ROAD_IDS as readonly string[]).includes(s)))].slice(0, 4);
  return out.length ? out : undefined;
};

/** Messages from the page or the store, checked: the two roles, the last turns, nothing too long, junk dropped. */
export function cleanHistory(raw: unknown): Turn[] {
  if (!Array.isArray(raw)) return [];
  const out: Turn[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") continue;
    const o = t as Record<string, unknown>;
    const role = o.role === "assistant" ? "assistant" : o.role === "user" ? "user" : null;
    if (!role) continue;
    const text = str(o.text, role === "user" ? KHARQ.messageMax : KHARQ.textMax);
    const files = readFiles(o.files);
    const deliver = role === "assistant" ? readDeliver(o.deliver) : undefined;
    if (!text.trim() && !files && !deliver) continue;
    out.push({
      role,
      text,
      ...(files ? { files } : {}),
      ...(role === "assistant" ? { ...(readQuestions(o.questions) ? { questions: readQuestions(o.questions) } : {}), ...(deliver ? { deliver } : {}), ...(readSuggest(o.suggest) ? { suggest: readSuggest(o.suggest) } : {}) } : {}),
    });
  }
  return out;
}

/** What is sent to him: the turns, starting with the person, and two of a role in a row joined (his turns alternate). */
export function forModel(history: Turn[]): Turn[] {
  const cut = history.slice(-KHARQ.historyTurns).filter((t) => !t.error);
  while (cut.length && cut[0].role !== "user") cut.shift();
  const out: Turn[] = [];
  for (const t of cut) {
    const last = out[out.length - 1];
    if (last && last.role === t.role && !t.files && !last.files) last.text = `${last.text}\n\n${t.text}`.slice(0, KHARQ.textMax);
    else out.push({ ...t });
  }
  return out;
}

/** A short title from the first thing the person said. */
export const titleOf = (first: string) => first.replace(/\s+/g, " ").trim().slice(0, 60) || "محادثة جديدة";

const view = (r: Record<string, unknown>): Chat => ({
  id: r.id as string,
  title: String(r.title ?? ""),
  messages: cleanHistory(r.messages),
  brief: str(r.brief, KHARQ.briefMax),
  stage: isKharqStage(r.stage) ? r.stage : "discover",
  updatedAt: String(r.updated_at ?? ""),
});

/** A write that also sets the columns of a later migration, and again without them when they are not there yet. */
async function withExtra<R extends { error: { code?: string; message?: string } | null }>(extra: Record<string, unknown>, run: (e: Record<string, unknown>) => PromiseLike<R>): Promise<R> {
  if (!Object.keys(extra).length) return run({});
  const r = await run(extra);
  if (r.error && (r.error.code === "42703" || r.error.code === "PGRST204")) return run({});
  return r;
}

export async function listChats(userId: string) {
  const { data, error } = await db().from("kharq_chats").select("id,title,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id as string, title: String(r.title || "محادثة جديدة"), updatedAt: String(r.updated_at) }));
}

export async function getChat(userId: string, id: string): Promise<Chat | null> {
  const { data } = await db().from("kharq_chats").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  return data ? view(data) : null;
}

/** Saves the conversation (a new one when `id` is null) with his record and where he stands; returns its id. */
export async function saveChat(userId: string, id: string | null, messages: Turn[], addUsd: number, o: { brief?: string; stage?: KharqStage } = {}): Promise<string> {
  const extra: Record<string, unknown> = {
    ...(o.brief !== undefined ? { brief: o.brief.slice(0, KHARQ.briefMax) } : {}),
    ...(o.stage ? { stage: o.stage } : {}),
  };
  if (id) {
    const { data } = await db().from("kharq_chats").select("usd").eq("id", id).eq("user_id", userId).maybeSingle();
    if (!data) throw new Error("chat not found");
    const { error } = await withExtra(extra, (e) =>
      db().from("kharq_chats").update({ messages, usd: Number(data.usd ?? 0) + addUsd, updated_at: new Date().toISOString(), ...e }).eq("id", id).eq("user_id", userId),
    );
    if (error) throw error;
    return id;
  }
  const first = messages.find((m) => m.role === "user")?.text ?? "";
  const { data, error } = await withExtra(extra, (e) => db().from("kharq_chats").insert({ user_id: userId, title: titleOf(first), messages, usd: addUsd, ...e }).select("id").single());
  if (error) throw error;
  return data!.id as string;
}

export async function deleteChat(userId: string, id: string) {
  await db().from("kharq_chats").delete().eq("id", id).eq("user_id", userId);
}

/** One answer's media ask found again by its id (the confirm button and the follow-up both start here). */
export function findAsk(chat: Chat, askId: string): { turn: number; ask: MediaAsk } | null {
  for (let i = chat.messages.length - 1; i >= 0; i--) {
    const ask = chat.messages[i].deliver?.media.find((m) => m.id === askId);
    if (ask) return { turn: i, ask };
  }
  return null;
}

/** The conversation with one media ask replaced (what the confirm and the follow-up write back). */
export function withAsk(messages: Turn[], turn: number, ask: MediaAsk): Turn[] {
  return messages.map((t, i) => {
    if (i !== turn || !t.deliver) return t;
    return { ...t, deliver: { ...t.deliver, media: t.deliver.media.map((m) => (m.id === ask.id ? ask : m)) } };
  });
}
