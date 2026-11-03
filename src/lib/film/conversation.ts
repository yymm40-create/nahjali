// A film assistant's conversation (one per stage): stored messages, and the Claude turns built from them.
//
// What each reply re-reads is kept small (every message re-sends the whole conversation): a deliverable replaced by a
// later version of it is read as a short stub, a picture is sent as itself only where it is still needed, and a long
// conversation is read as the robot's own handoff of what came before + its latest turns (lib/robot-handoff) — with
// the stage's first message (the story / the handoffs and the approved references) always read in full.

import { createAdminClient } from "@/lib/supabase/admin";
import { remember } from "@/lib/robot-handoff";
import type { ClaudePart, ClaudeTurn } from "./anthropic";
import { FILM_BUCKET } from "./types";

import { storage } from "@/lib/storage";
const db = () => createAdminClient();

/** [[image:<asset id>]] inside a user message is sent to Claude as the real picture. */
export const IMAGE_MARK = /\[\[image:([0-9a-f-]{36})\]\]/g;

export async function addMessage(projectId: string, stage: string, content: string) {
  const { data, error } = await db().from("film_messages").insert({ project_id: projectId, stage, role: "user", content }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

interface StoredMessage {
  role: "user" | "assistant";
  content: string;
}

/** What an earlier version of a deliverable reads as once a later version replaced it. */
export const SUPERSEDED_STUB = "(نسخة سابقة من هذا التسليم، استُبدلت بنسخة أحدث لاحقًا في المحادثة — نصها الكامل محذوف من هنا؛ اعتمد على الأحدث)";
/** A field this long is worth stubbing (questions and short notes stay as they were). */
const LONG = 1200;

const parsed = (s: string): Record<string, unknown> | null => {
  try {
    const o = JSON.parse(s) as unknown;
    return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};
const long = (v: unknown) => (typeof v === "string" ? v.length : v && typeof v === "object" ? JSON.stringify(v).length : 0) > LONG;

/**
 * The assistant's stored replies (its raw JSON) whose deliverable — the same stage, and the same sheet / generation — a
 * LATER long reply replaced after a change was asked for: their long fields read as SUPERSEDED_STUB. A reply that came
 * right after «اعتمد» is the next deliverable, never a revision, so it replaces nothing (even if it labels itself with
 * the old stage). Only the latest full version of each deliverable is re-read every turn.
 */
export function stubSuperseded<M extends StoredMessage>(msgs: M[]): M[] {
  const json = msgs.map((m) => (m.role === "assistant" ? parsed(m.content) : null));
  const keyOf = (o: Record<string, unknown> | null) => (o && typeof o.stage === "number" ? `${o.stage}|${String(o.sheet_id ?? "") || String(o.gen_id ?? "")}` : null);
  const after = (i: number) => {
    for (let j = i - 1; j >= 0; j--) if (msgs[j].role === "user") return msgs[j].content.trim();
    return "";
  };
  const latest = new Map<string, number>();
  json.forEach((o, i) => {
    const k = keyOf(o);
    if (k && Object.values(o!).some(long) && after(i) !== "اعتمد") latest.set(k, i);
  });
  return msgs.map((m, i) => {
    const o = json[i];
    const k = keyOf(o);
    const last = k ? latest.get(k) : undefined;
    if (!o || last === undefined || last <= i) return m;
    if (!Object.values(o).some(long)) return m;
    return { ...m, content: JSON.stringify(Object.fromEntries(Object.entries(o).map(([f, v]) => [f, long(v) ? SUPERSEDED_STUB : v]))) };
  });
}

/** A long block (the Super Director's skill) sent more than once: every copy but the last reads as `note`. */
export function onlyLastCopy<M extends StoredMessage>(msgs: M[], block: string, note: string): M[] {
  if (!block) return msgs;
  const last = msgs.map((m) => m.role === "user" && m.content.includes(block)).lastIndexOf(true);
  return msgs.map((m, i) => (i < last && m.role === "user" && m.content.includes(block) ? { ...m, content: m.content.split(block).join(note) } : m));
}

/** Text turns: back-to-back messages of the same side joined (e.g. a correction sent after a failed reply). */
function textTurns(msgs: StoredMessage[]) {
  const turns: { role: "user" | "assistant"; text: string }[] = [];
  for (const m of msgs) {
    const prev = turns.at(-1);
    if (prev && prev.role === m.role) prev.text = `${prev.text}\n\n${m.content}`;
    else turns.push({ role: m.role, text: m.content });
  }
  return turns;
}

export interface StageTurnOptions {
  /** the person whose conversation it is (for the stored handoff), and the robot's name in it */
  userId?: string | null;
  robot?: string;
  /** the most turns read in full before the earlier ones are read as a handoff */
  window?: number;
  /** a picture still needed (e.g. a person's photo whose sheet is not drawn yet): sent as itself wherever it is */
  keepImage?: (assetId: string) => boolean;
  /** a message that must be read in full even when its turn is handed off (e.g. the Super Director's skill) */
  pin?: (content: string) => boolean;
  /** a long block sent more than once: only its last copy is read (`[block, note]`) */
  once?: [string, string];
}

/** The most turns a stage reads in full (the earlier ones are read as the robot's handoff). */
export const STAGE_WINDOW = 40;

/**
 * Builds Claude turns. [[image:id]] markers become real images (short-lived links) in the stage's FIRST message and the
 * LATEST one (and wherever `keepImage` says the picture is still needed); anywhere else Claude already looked at it in
 * its own turn, so it reads as a short note instead of being paid for again every message. Returns the turns and what
 * writing a handoff cost (USD) when one was written in this turn.
 */
export async function stageTurns(projectId: string, stage: string, o: StageTurnOptions = {}): Promise<{ turns: ClaudeTurn[]; usd: number }> {
  const client = db();
  const { data } = await client
    .from("film_messages")
    .select("role,content")
    .eq("project_id", projectId)
    .eq("stage", stage)
    .order("created_at", { ascending: true });
  let msgs = stubSuperseded(((data ?? []) as StoredMessage[]).map((m) => ({ role: m.role, content: String(m.content ?? "") })));
  if (o.once) msgs = onlyLastCopy(msgs, o.once[0], o.once[1]);
  const all = textTurns(msgs);
  if (!all.length) return { turns: [], usd: 0 };

  // a long conversation: the stage's first message + any pinned one, then the handoff, then the latest turns
  const mem = await remember({ key: `film:${projectId}:${stage}`, userId: o.userId ?? null, robot: o.robot ?? "مساعد الفيلم", turns: all, window: o.window ?? STAGE_WINDOW });
  let turns: { role: "user" | "assistant"; text: string }[];
  // (also when writing the handoff failed and only the latest turns came back: the first message is never dropped)
  if (mem.kept.length < all.length && all[0].role === "user") {
    const keptFrom = all.length - mem.kept.length;
    const pinned = o.pin ? msgs.filter((m, i) => i > 0 && m.role === "user" && o.pin!(m.content)).map((m) => m.content).filter((c) => !all[0].text.includes(c) && !all.slice(keptFrom).some((t) => t.text.includes(c))) : [];
    // the pictures still needed whose turns were handed off: they come with the first message
    const lost = o.keepImage ? [...new Set(all.slice(1, keptFrom).flatMap((t) => [...t.text.matchAll(IMAGE_MARK)].map((x) => x[1])))].filter(o.keepImage) : [];
    const head = [all[0].text, ...pinned, ...(lost.length ? [`صور ما زالت لازمة من رسائل سابقة:\n${lost.map((id) => `[[image:${id}]]`).join(" ")}`] : []), typeof mem.lead[0]?.content === "string" ? mem.lead[0].content : ""].filter(Boolean);
    turns = [{ role: "user", text: head.join("\n\n---\n\n") }, { role: "assistant", text: typeof mem.lead[1]?.content === "string" ? mem.lead[1].content : "تمام، أكمل من آخر الرسائل." }, ...mem.kept];
  } else {
    turns = mem.kept.length ? mem.kept : all;
  }

  const lastUser = turns.map((t) => t.role).lastIndexOf("user");
  const live = (id: string, i: number) => i === 0 || i === lastUser || Boolean(o.keepImage?.(id));
  const ids = [...new Set(turns.flatMap((t, i) => (t.role === "user" ? [...t.text.matchAll(IMAGE_MARK)].map((x) => x[1]).filter((id) => live(id, i)) : [])))];
  const urls: Record<string, string> = {};
  if (ids.length) {
    // only this project's pictures (an id typed into a message can't pull in someone else's)
    const { data: rows } = await client.from("film_assets").select("id,storage_path").eq("project_id", projectId).in("id", ids);
    for (const r of rows ?? []) {
      if (!r.storage_path) continue;
      const s = await storage.from(FILM_BUCKET).createSignedUrl(r.storage_path, 3600);
      if (s.data) urls[r.id] = s.data.signedUrl;
    }
  }
  const toParts = (text: string, i: number): ClaudePart[] => {
    const parts: ClaudePart[] = [];
    let last = 0;
    for (const m of text.matchAll(IMAGE_MARK)) {
      if (m.index! > last) parts.push({ type: "text", text: text.slice(last, m.index) });
      if (!live(m[1], i)) parts.push({ type: "text", text: "(صورة أُرسلت لك سابقًا في هذي المحادثة)" });
      else if (urls[m[1]]) parts.push({ type: "image", url: urls[m[1]] });
      else parts.push({ type: "text", text: "(الصورة غير متاحة)" });
      last = m.index! + m[0].length;
    }
    if (last < text.length) parts.push({ type: "text", text: text.slice(last) });
    return parts.length ? parts : [{ type: "text", text }];
  };
  return { turns: turns.map((t, i): ClaudeTurn => ({ role: t.role, content: t.role === "user" ? toParts(t.text, i) : t.text })), usd: mem.usd };
}

/** The stage's turns (no handoff options): kept for callers that only need the conversation. */
export async function buildTurns(projectId: string, stage: string): Promise<ClaudeTurn[]> {
  return (await stageTurns(projectId, stage)).turns;
}
