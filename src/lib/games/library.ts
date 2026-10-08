// «مكتبة الألعاب» — the games the owner feeds, and what the chat reads of them: when a person names a game that is in
// the library (approved), its notes go to the persona as «مراجع المكتبة», marked as such. Drafts (written by Claude
// for the owner to look at) are never read by the chat until the owner approves them. Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeArabic } from "@/lib/islamic/text";

const db = () => createAdminClient();

export interface Game {
  id: string;
  name: string;
  genre: string;
  players: string;
  notes: string;
  status: "approved" | "draft";
  source: "owner" | "draft";
}

/** A name as a key: Arabic made the same however it was typed, Latin lower-cased, punctuation out. */
export const nameKey = (s: string) => normalizeArabic(s).replace(/\s+/g, " ").trim();

const row = (r: Record<string, unknown>): Game => ({
  id: r.id as string,
  name: String(r.name ?? ""),
  genre: String(r.genre ?? ""),
  players: String(r.players ?? ""),
  notes: String(r.notes ?? ""),
  status: r.status === "draft" ? "draft" : "approved",
  source: r.source === "draft" ? "draft" : "owner",
});

export async function listGames(limit = 5000): Promise<Game[]> {
  const { data, error } = await db().from("games_library").select("*").order("name", { ascending: true }).limit(limit);
  if (error) throw error;
  return (data ?? []).map(row);
}

export async function countGames() {
  const { count } = await db().from("games_library").select("id", { count: "exact", head: true });
  const { count: approved } = await db().from("games_library").select("id", { count: "exact", head: true }).eq("status", "approved");
  return { all: count ?? 0, approved: approved ?? 0 };
}

export interface GameInput {
  name: string;
  genre?: string;
  players?: string;
  notes?: string;
  status?: "approved" | "draft";
  source?: "owner" | "draft";
}

/** Adds games (a name that is already there is updated instead); returns how many were added and updated. */
export async function putGames(items: GameInput[]) {
  const rows = new Map<string, Record<string, unknown>>();
  for (const g of items) {
    const name = g.name.trim().slice(0, 120);
    const key = nameKey(name);
    if (!name || !key) continue;
    rows.set(key, { name, name_key: key, genre: (g.genre ?? "").trim().slice(0, 120), players: (g.players ?? "").trim().slice(0, 120), notes: (g.notes ?? "").trim().slice(0, 8000), status: g.status ?? "approved", source: g.source ?? "owner", updated_at: new Date().toISOString() });
  }
  if (!rows.size) return { added: 0, updated: 0 };
  const keys = [...rows.keys()];
  const had = new Set<string>();
  for (let i = 0; i < keys.length; i += 200) {
    const { data } = await db().from("games_library").select("name_key").in("name_key", keys.slice(i, i + 200));
    for (const r of data ?? []) had.add(r.name_key as string);
  }
  const list = [...rows.values()];
  for (let i = 0; i < list.length; i += 200) {
    const { error } = await db().from("games_library").upsert(list.slice(i, i + 200), { onConflict: "name_key" });
    if (error) throw error;
  }
  forgetLibrary();
  return { added: keys.filter((k) => !had.has(k)).length, updated: keys.filter((k) => had.has(k)).length };
}

export async function updateGame(id: string, patch: Partial<Pick<Game, "genre" | "players" | "notes" | "status">>) {
  const set: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.genre !== undefined) set.genre = patch.genre.trim().slice(0, 120);
  if (patch.players !== undefined) set.players = patch.players.trim().slice(0, 120);
  if (patch.notes !== undefined) set.notes = patch.notes.trim().slice(0, 8000);
  if (patch.status) set.status = patch.status;
  const { error } = await db().from("games_library").update(set).eq("id", id);
  if (error) throw error;
  forgetLibrary();
}

export async function removeGames(ids: string[]) {
  if (!ids.length) return;
  const { error } = await db().from("games_library").delete().in("id", ids);
  if (error) throw error;
  forgetLibrary();
}

/** «name | genre | players | notes» lines (the owner pastes a list): one game a line, the rest optional. */
export function parseGameLines(text: string): GameInput[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name = "", genre = "", players = "", ...rest] = l.split(/\s*[|،;]\s*|\t/);
      return { name: name.replace(/^[-•*\d.)\s]+/, ""), genre, players, notes: rest.join(" — ") };
    })
    .filter((g) => g.name.length > 0 && g.name.length <= 120);
}

// ───────── what the chat reads ─────────

let memo: { at: number; games: Game[] } | null = null;
export const forgetLibrary = () => {
  memo = null;
};
async function approved(): Promise<Game[]> {
  if (memo && Date.now() - memo.at < 60_000) return memo.games;
  const { data } = await db().from("games_library").select("*").eq("status", "approved").limit(5000);
  memo = { at: Date.now(), games: (data ?? []).map(row) };
  return memo.games;
}

/** The approved games a text names (the whole name, as words), the longest names first, at most `max`. */
export function namedIn(text: string, games: Game[], max = 5): Game[] {
  const hay = ` ${nameKey(text)} `;
  return games
    .filter((g) => {
      const k = nameKey(g.name);
      return k.length >= 3 && hay.includes(` ${k} `);
    })
    .sort((a, b) => b.name.length - a.name.length)
    .slice(0, max);
}

/** The «مراجع المكتبة» block for the games named in the person's messages (empty when none). */
export async function libraryBlock(texts: string[]): Promise<string> {
  const games = await approved().catch(() => [] as Game[]);
  if (!games.length) return "";
  const hits = namedIn(texts.join("\n"), games);
  if (!hits.length) return "";
  return [
    "مراجع المكتبة (ملاحظات اعتمدها صاحب المنصة عن ألعاب ذُكرت في المحادثة؛ هي مرجع للتفاصيل، فاذكر أن المعلومة من المكتبة، وما ليس فيها من معرفتك العامة فصنّفه «غير موثّق في المكتبة»):",
    ...hits.map((g) => `■ ${g.name}${g.genre ? ` — ${g.genre}` : ""}${g.players ? ` — اللاعبون: ${g.players}` : ""}\n${g.notes.slice(0, 2500)}`),
  ].join("\n\n");
}
