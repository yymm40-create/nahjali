// «الذكاء الإسلامي» — the conversations' memory: each chat kept with its questions, answers and sources, so it is
// there after a reload or on another device, and a follow-up is read in its context. A database without the table
// (SQL 0052 not run) keeps working without memory: the page's own history is used then. Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { isIslamicMode, type IslamicMode } from "./text";

const db = () => createAdminClient();

export interface ChatSource {
  n: number;
  url: string;
  title: string;
  source: string;
  kind: string;
  primary?: boolean;
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
  mode?: IslamicMode;
  sources?: ChatSource[];
  found?: boolean;
}

const missing = (e: { code?: string; message?: string } | null) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /relation .* does not exist|Could not find the table/i.test(e.message ?? ""));
/** The memory works only once SQL 0052 is run; until then nothing is kept (and nothing fails). */
export let memoryOff = false;

/** Turns from storage or the page, checked. */
export function cleanTurns(raw: unknown, max = 200): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatTurn[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") continue;
    const m = t as Record<string, unknown>;
    const role = m.role === "assistant" ? "assistant" : m.role === "user" ? "user" : null;
    if (!role || typeof m.text !== "string" || !m.text.trim()) continue;
    const turn: ChatTurn = { role, text: m.text.slice(0, role === "user" ? 4000 : 40_000) };
    if (isIslamicMode(m.mode)) turn.mode = m.mode;
    if (role === "assistant" && Array.isArray(m.sources)) {
      turn.sources = m.sources
        .filter((s): s is Record<string, unknown> => !!s && typeof s === "object" && typeof (s as { url?: unknown }).url === "string")
        .map((s) => ({ n: Number(s.n) || 0, url: String(s.url), title: String(s.title ?? "").slice(0, 300), source: String(s.source ?? "").slice(0, 120), kind: String(s.kind ?? ""), ...(s.primary === true ? { primary: true } : {}) }))
        .slice(0, 80);
    }
    if (role === "assistant" && typeof m.found === "boolean") turn.found = m.found;
    out.push(turn);
  }
  return out.slice(-max);
}

export const titleOf = (q: string) => q.replace(/\s+/g, " ").trim().slice(0, 60) || "محادثة";

export async function listChats(userId: string) {
  if (memoryOff) return [];
  const { data, error } = await db().from("islamic_chats").select("id,title,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(100);
  if (error) {
    if (missing(error)) memoryOff = true;
    return [];
  }
  return (data ?? []).map((r) => ({ id: r.id as string, title: String(r.title || "محادثة"), updatedAt: String(r.updated_at) }));
}

export async function getChat(userId: string, id: string): Promise<{ id: string; title: string; messages: ChatTurn[] } | null> {
  if (memoryOff) return null;
  const { data, error } = await db().from("islamic_chats").select("id,title,messages").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) {
    if (missing(error)) memoryOff = true;
    return null;
  }
  return data ? { id: data.id as string, title: String(data.title ?? ""), messages: cleanTurns(data.messages) } : null;
}

/** Keeps the conversation (a new one when `id` is null); returns its id, or null when there is no memory yet. */
export async function saveChat(userId: string, id: string | null, messages: ChatTurn[], addUsd: number): Promise<string | null> {
  if (memoryOff) return null;
  const now = new Date().toISOString();
  if (id) {
    const { data } = await db().from("islamic_chats").select("usd").eq("id", id).eq("user_id", userId).maybeSingle();
    if (data) {
      const { error } = await db().from("islamic_chats").update({ messages, usd: Number(data.usd ?? 0) + addUsd, updated_at: now }).eq("id", id).eq("user_id", userId);
      if (!error) return id;
      if (missing(error)) memoryOff = true;
      return null;
    }
  }
  const first = messages.find((m) => m.role === "user")?.text ?? "";
  const { data, error } = await db().from("islamic_chats").insert({ user_id: userId, title: titleOf(first), messages, usd: addUsd, updated_at: now }).select("id").single();
  if (error) {
    if (missing(error)) memoryOff = true;
    else console.error("islamic chat save", error.message);
    return null;
  }
  return data.id as string;
}

export async function deleteChat(userId: string, id: string) {
  if (memoryOff) return;
  await db().from("islamic_chats").delete().eq("id", id).eq("user_id", userId);
}
