// «صانع الألعاب الذكي» — one message in a conversation: the persona (the owner's edit or the template), the platform's
// rules and the library notes of the games named, then Claude's answer; the conversation saved. Server only.

import { GAMES, type GamesMode } from "@config/games";
import { isLeader } from "@/lib/film/anthropic";
import { talk, type Turn } from "./claude";
import { cleanHistory, forModel, getChat, saveChat } from "./chats";
import { libraryBlock } from "./library";
import { getPersona, systemText } from "./persona";

export interface Reply {
  chatId: string;
  text: string;
  usd: number;
}

/**
 * The person says something in a conversation (a new one when `chatId` is null). `mode` is the way they chose (the game
 * built here, or a prompt to take elsewhere): given, it is kept with the conversation; absent, the kept one goes on.
 */
export async function say(userId: string, chatId: string | null, message: string, email: string | null = null, mode: GamesMode | null = null): Promise<Reply> {
  const said = message.trim().slice(0, GAMES.messageMax);
  if (!said) throw new Error("empty message");
  const chat = chatId ? await getChat(userId, chatId) : null;
  if (chatId && !chat) throw new Error("chat not found");
  const before = chat?.messages ?? [];
  const history = cleanHistory([...before, { role: "user", text: said }]);
  const turns = forModel(history);
  const [persona, library] = await Promise.all([getPersona(), libraryBlock(turns.filter((t) => t.role === "user").map((t) => t.text))]);
  const r = await talk({ system: systemText(persona.text, library, mode ?? chat?.mode ?? ""), turns, maxTokens: GAMES.maxTokens, leader: isLeader(email) });
  const id = await saveChat(userId, chatId, [...history, { role: "assistant", text: r.text } as Turn], r.usd, mode && mode !== chat?.mode ? mode : null);
  return { chatId: id, text: r.text, usd: r.usd };
}
