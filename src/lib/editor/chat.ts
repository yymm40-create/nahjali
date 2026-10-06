// «حيدرة كت»: Claude's conversation of an edit, kept with the project (it survives leaving and coming back, on
// any device). A long one can be handed over: Claude writes what matters into a summary and a new conversation starts
// from it. Server only.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaudeJson, claudeTrouble, type ClaudeTurn } from "@/lib/film/anthropic";
import { charged, type Who } from "./pricing";
import { stillOpen, type EditorProject } from "./server";

const db = () => createAdminClient();

export interface ChatMsg {
  role: "user" | "assistant";
  text: string;
  /** steps done on the timeline by that answer */
  done?: number;
  error?: boolean;
  at: string;
}
export interface Chat {
  messages: ChatMsg[];
  handoff: string | null;
  chats: number;
  /** false until the owner runs the migration: the page then keeps the chat on the device only */
  stored: boolean;
}

/** Kept per conversation (older ones are dropped from the start; a handoff keeps their substance). */
export const CHAT_MAX = 400;
/** From here the page suggests handing the conversation over. */
export const CHAT_LONG = { messages: 40, chars: 24_000 } as const;
export const isLongChat = (m: Pick<ChatMsg, "text">[]) => m.length >= CHAT_LONG.messages || m.reduce((n, x) => n + x.text.length, 0) >= CHAT_LONG.chars;

export function readMessages(v: unknown): ChatMsg[] {
  return (Array.isArray(v) ? v : [])
    .filter((m): m is Record<string, unknown> => !!m && typeof m === "object" && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
    .slice(-CHAT_MAX)
    .map((m) => ({
      role: m.role as ChatMsg["role"],
      text: (m.text as string).slice(0, 4000),
      ...(typeof m.done === "number" && m.done > 0 ? { done: Math.min(999, Math.round(m.done)) } : {}),
      ...(m.error === true ? { error: true } : {}),
      at: typeof m.at === "string" ? m.at.slice(0, 40) : new Date(0).toISOString(),
    }));
}

export async function loadChat(p: EditorProject): Promise<Chat> {
  const { data, error } = await db().from("editor_chats").select("messages,handoff,chats").eq("project_id", p.id).maybeSingle();
  if (error) return { messages: [], handoff: null, chats: 1, stored: false };
  return { messages: readMessages(data?.messages), handoff: data?.handoff ?? null, chats: Number(data?.chats ?? 1), stored: true };
}

async function saveChat(p: EditorProject, c: Omit<Chat, "stored">) {
  const { error } = await db()
    .from("editor_chats")
    .upsert({ project_id: p.id, user_id: p.user_id, messages: c.messages.slice(-CHAT_MAX), handoff: c.handoff, chats: c.chats, updated_at: new Date().toISOString() });
  if (error) console.error("editor chat save", error.message);
  return !error;
}

/** Adds turns to the stored conversation (nothing happens before the migration). */
export async function appendChat(p: EditorProject, add: Omit<ChatMsg, "at">[]) {
  const c = await loadChat(p);
  if (!c.stored) return;
  const at = new Date().toISOString();
  await saveChat(p, { ...c, messages: [...c.messages, ...add.map((m) => ({ ...m, text: m.text.slice(0, 4000), at }))] });
}

/** The turns Claude gets: the handoff summary first (when there is one), then the last turns of this conversation. */
export function chatTurns(c: Pick<Chat, "messages" | "handoff">, last = 8): ClaudeTurn[] {
  const turns: ClaudeTurn[] = c.messages
    .filter((m) => !m.error)
    .slice(-last)
    .map((m) => ({ role: m.role, content: m.text.slice(0, 2000) }));
  while (turns.length && turns[0].role !== "user") turns.shift();
  if (c.handoff) {
    turns.unshift(
      { role: "user", content: `HANDOFF — what we agreed and did earlier in this edit (from the previous conversation):\n${c.handoff}` },
      { role: "assistant", content: "تمام، فاهم وين وصلنا. كمّل." },
    );
  }
  return turns;
}

const HANDOFF_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary"],
  properties: { summary: { type: "string", description: "The handoff, in Arabic, under 1200 words." } },
} as const;

/**
 * Hands the conversation over: Claude writes a handoff (the goal of the edit, the person's taste and decisions, what
 * was done, what is left) and a new, empty conversation starts from it.
 */
export async function handOff(p: EditorProject, who: Who, b: { messages?: unknown; handoff?: unknown } = {}): Promise<Chat> {
  stillOpen(p);
  const stored = await loadChat(p);
  // before the migration the page keeps the conversation and sends it
  const c = stored.stored ? stored : { ...stored, messages: readMessages(b.messages), handoff: typeof b.handoff === "string" ? b.handoff.slice(0, 8000) : null };
  if (!c.messages.length) throw new UserError("ما فيه محادثة تتسلّم.", 400);
  if (!process.env.ANTHROPIC_API_KEY) throw new UserError("حيدرة غير مفعّل على الخادم.", 503);
  const transcript = c.messages
    .filter((m) => !m.error)
    .map((m) => `${m.role === "user" ? "الشخص" : "حيدرة"}: ${m.text}${m.done ? ` [نفّذ ${m.done} خطوات]` : ""}`)
    .join("\n")
    .slice(-60_000);
  const system =
    "You write a HANDOFF for a video-editing assistant that will continue this edit in a fresh conversation without seeing the old one. In Arabic (Gulf, plain), in short sections: هدف المونتاج · ذوق الشخص وقراراته (style, pace, fonts, colours, music, what they liked and refused) · اللي انسوّى · اللي باقي أو انطلب ولا تم · ملاحظات مهمة (ids or times only if still useful). Facts only, nothing invented.";
  const r = await charged(who, "editor_price_claude", 1, "هاندوف محادثة حيدرة في حيدرة كت", () =>
    callClaudeJson<{ summary: string }>({
      system,
      turns: [{ role: "user", content: `${c.handoff ? `PREVIOUS HANDOFF:\n${c.handoff}\n\n` : ""}CONVERSATION:\n${transcript}` }],
      schema: HANDOFF_SCHEMA,
      maxTokens: 4000,
      effort: "low",
      fallback: true,
    }).catch((e) => {
      console.error("editor handoff", e);
      throw new UserError(claudeTrouble(e) ?? "ما قدر حيدرة يكتب الهاندوف الحين؛ جرّب بعد شوي.", 502);
    }),
  );
  const next = { messages: [], handoff: r.data.summary.trim().slice(0, 8000), chats: c.chats + 1 };
  if (stored.stored && !(await saveChat(p, next))) throw new UserError("ما قدرنا نحفظ؛ جرّب مرة ثانية.", 500);
  return { ...next, stored: stored.stored };
}
