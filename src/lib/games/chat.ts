// «صانع الألعاب الذكي» — one message in a conversation: the persona (the owner's edit or the template), the platform's
// rules and the library notes of the games named, then Claude's answer; the conversation saved. Server only.

import { GAMES } from "@config/games";
import { talk, type Turn } from "./claude";
import { cleanHistory, forModel, getChat, saveChat } from "./chats";
import { libraryBlock } from "./library";
import { getPersona, systemText } from "./persona";

export interface Reply {
  chatId: string;
  text: string;
  usd: number;
}

/** The person says something in a conversation (a new one when `chatId` is null). */
export async function say(userId: string, chatId: string | null, message: string): Promise<Reply> {
  const said = message.trim().slice(0, GAMES.messageMax);
  if (!said) throw new Error("empty message");
  const before = chatId ? ((await getChat(userId, chatId))?.messages ?? null) : [];
  if (before === null) throw new Error("chat not found");
  const history = cleanHistory([...before, { role: "user", text: said }]);
  const turns = forModel(history);
  const [persona, library] = await Promise.all([getPersona(), libraryBlock(turns.filter((t) => t.role === "user").map((t) => t.text))]);
  const r = await talk({ system: systemText(persona.text, library), turns, maxTokens: GAMES.maxTokens });
  const id = await saveChat(userId, chatId, [...history, { role: "assistant", text: r.text } as Turn], r.usd);
  return { chatId: id, text: r.text, usd: r.usd };
}
