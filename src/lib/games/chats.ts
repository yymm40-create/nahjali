// «صانع الألعاب الذكي» — the conversations: kept per person so a chat is still there after a reload. Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { GAMES, GAMES_MODES, type GamesMode } from "@config/games";
import type { Turn } from "./claude";

const db = () => createAdminClient();

export interface Chat {
  id: string;
  title: string;
  messages: Turn[];
  /** the way the person chose: the game built here, or a prompt to take elsewhere ("" = not chosen) */
  mode: GamesMode;
  updatedAt: string;
}

export const modeOf = (v: unknown): GamesMode => ((GAMES_MODES as readonly unknown[]).includes(v) ? (v as GamesMode) : "");

/** Messages from the page, checked: only the two roles, text only, the last turns, none too long. */
export function cleanHistory(raw: unknown): Turn[] {
  if (!Array.isArray(raw)) return [];
  const out: Turn[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") continue;
    const role = (t as { role?: unknown }).role === "assistant" ? "assistant" : (t as { role?: unknown }).role === "user" ? "user" : null;
    const text = (t as { text?: unknown }).text;
    if (!role || typeof text !== "string" || !text.trim()) continue;
    // two of the same role in a row are one turn (the model's turns alternate)
    const last = out[out.length - 1];
    const clean = text.slice(0, role === "user" ? GAMES.messageMax : 40_000);
    if (last && last.role === role) last.text += `\n\n${clean}`;
    else out.push({ role, text: clean });
  }
  return out;
}

/** What is sent to Claude: the turns, starting with the person (a turn from the persona can't open a conversation). */
export function forModel(history: Turn[]): Turn[] {
  const cut = history.slice(-GAMES.historyTurns);
  while (cut.length && cut[0].role !== "user") cut.shift();
  return cut;
}

/** A short title from the first thing the person said. */
export const titleOf = (first: string) => first.replace(/\s+/g, " ").trim().slice(0, 60) || "محادثة جديدة";

const view = (r: Record<string, unknown>): Chat => ({ id: r.id as string, title: String(r.title ?? ""), messages: cleanHistory(r.messages), mode: modeOf(r.mode), updatedAt: String(r.updated_at ?? "") });

/** A write that also sets the way (`mode`), and again without it when the column is not there yet (0050 not run). */
async function withMode<R extends { error: { code?: string; message?: string } | null }>(mode: GamesMode | null, run: (extra: { mode?: GamesMode }) => PromiseLike<R>): Promise<R> {
  if (!mode) return run({});
  const r = await run({ mode });
  if (r.error && (r.error.code === "42703" || r.error.code === "PGRST204" || /\bmode\b/.test(r.error.message ?? ""))) return run({});
  return r;
}

export async function listChats(userId: string) {
  const { data, error } = await db().from("games_chats").select("id,title,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id as string, title: String(r.title || "محادثة جديدة"), updatedAt: String(r.updated_at) }));
}

export async function getChat(userId: string, id: string): Promise<Chat | null> {
  const { data } = await db().from("games_chats").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  return data ? view(data) : null;
}

/** Saves the conversation (a new one when `id` is null), with the way chosen when one is given; returns its id. */
export async function saveChat(userId: string, id: string | null, messages: Turn[], addUsd: number, mode: GamesMode | null = null): Promise<string> {
  if (id) {
    const { data } = await db().from("games_chats").select("usd").eq("id", id).eq("user_id", userId).maybeSingle();
    if (!data) throw new Error("chat not found");
    const { error } = await withMode(mode, (extra) => db().from("games_chats").update({ messages, usd: Number(data.usd ?? 0) + addUsd, updated_at: new Date().toISOString(), ...extra }).eq("id", id).eq("user_id", userId));
    if (error) throw error;
    return id;
  }
  const first = messages.find((m) => m.role === "user")?.text ?? "";
  const { data, error } = await withMode(mode, (extra) => db().from("games_chats").insert({ user_id: userId, title: titleOf(first), messages, usd: addUsd, ...extra }).select("id").single());
  if (error) throw error;
  return data!.id as string;
}

export async function deleteChat(userId: string, id: string) {
  await db().from("games_chats").delete().eq("id", id).eq("user_id", userId);
}
