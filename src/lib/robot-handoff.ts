// Every robot's long conversation (the owner, 28 October 2026: «لازم كل شي يصير محفوظ ومقري… يسوي لروحه هاندوف
// ويرسلها لروحه كأول رسالة»): the whole conversation stays stored with the chat, but a robot reads only its latest
// messages in one go. When it grows past that, the robot writes itself a HANDOFF of everything before (the goal, the
// person's decisions and taste, what was made, what is left, the exact details still needed), reads it as the FIRST
// message, then the latest messages — and tells the person so in that reply. The handoff is kept (robot_handoffs,
// migration 0096) and written again only after about half a window of new messages, each time from the previous
// handoff + what came after it, so nothing is ever dropped. Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { callClaudeJson, claudeCost, type ClaudeTurn } from "@/lib/film/anthropic";

export interface HandoffTurn {
  role: "user" | "assistant";
  text: string;
  error?: boolean;
}

export interface Remembered<T> {
  /** the handoff and its acknowledgement: put them before the kept turns */
  lead: ClaudeTurn[];
  /** the latest turns, read in full (starting with the person's) */
  kept: T[];
  /** a handoff was written in this turn: the reply says so (HANDOFF_NOTE) */
  fresh: boolean;
  /** what writing it cost (USD), to be charged with the reply */
  usd: number;
}

/** What the reply tells the person when the robot has just handed the conversation over to itself. */
export const HANDOFF_NOTE = "📌 المحادثة طالت، فكتبت لنفسي «تسليم» فيه كل اللي اتفقنا عليه وسويناه وقراراتك، وقريته أول شي — وأكمل معك من نفس المكان بالضبط. المحادثة كلها محفوظة وما ضاع منها شي.";

/** Adds the note to the top of a reply when a handoff was just written. */
export const withNote = (text: string, fresh: boolean) => (fresh ? `${HANDOFF_NOTE}\n\n${text}` : text);

const db = () => createAdminClient();
// before the migration: kept in this server's memory (written again after a restart)
const local = new Map<string, { upTo: number; text: string }>();

async function load(key: string): Promise<{ upTo: number; text: string } | null> {
  const { data, error } = await db().from("robot_handoffs").select("up_to,text").eq("key", key).maybeSingle();
  if (error) return local.get(key) ?? null;
  return data ? { upTo: Number(data.up_to) || 0, text: String(data.text ?? "") } : null;
}

async function store(key: string, userId: string | null, h: { upTo: number; text: string }) {
  local.set(key, h);
  await db()
    .from("robot_handoffs")
    .upsert({ key, user_id: userId, up_to: h.upTo, text: h.text, updated_at: new Date().toISOString() })
    .then(() => {}, () => {});
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["handoff"],
  properties: { handoff: { type: "string", description: "The handoff, in Arabic, under 1500 words." } },
} as const;

const leadOf = (text: string): ClaudeTurn[] => [
  { role: "user", content: `HANDOFF — your own handoff of everything earlier in this conversation (read it first; the latest messages follow):\n${text}` },
  { role: "assistant", content: "تمام، قريت التسليم وفاهم وين وصلنا. أكمل من نفس المكان." },
];

/**
 * Where the kept part starts: the first person's message at or after `from` (a conversation never starts with the
 * robot), or the end.
 */
function startAt<T extends HandoffTurn>(turns: T[], from: number) {
  let i = Math.max(0, from);
  while (i < turns.length && turns[i].role !== "user") i++;
  return i;
}

/** Writes the handoff of `turns[from, to)` on top of the previous one. */
async function write(robot: string, previous: string, turns: HandoffTurn[], from: number, to: number) {
  const transcript = turns
    .slice(from, to)
    .map((t) => `${t.role === "user" ? "الشخص" : robot}: ${t.text}`)
    .join("\n\n")
    .slice(-150_000);
  const r = await callClaudeJson<{ handoff: string }>({
    system:
      `You are ${robot}, a robot on an Arabic creative platform, writing a HANDOFF TO YOURSELF: in a moment you will continue this same conversation with the person, reading only this handoff and their latest messages. Merge the previous handoff (if any) with the conversation below into ONE complete handoff, in Arabic (Gulf, plain), in short sections: الهدف · قرارات الشخص وذوقه (what they chose, liked and refused) · اللي انسوّى (what was made, with names and numbers) · اللي باقي أو انطلب ولا تم · تفاصيل لازم تبقى (exact texts, names, prices, ids, links, settings still needed). Keep every decision and detail that still matters — drop nothing from the previous handoff unless it was replaced. Facts only, nothing invented.`,
    turns: [{ role: "user", content: `${previous ? `PREVIOUS HANDOFF:\n${previous}\n\n` : ""}CONVERSATION SINCE THEN:\n${transcript}` }],
    schema: SCHEMA,
    maxTokens: 6000,
    effort: "low",
    fallback: true,
  });
  return { text: r.data.handoff.trim().slice(0, 20_000), usd: claudeCost(r.usage) };
}

/**
 * The turns a robot reads: everything when it fits in `window`, else its handoff of what came before + the latest
 * turns. `key` names the conversation («content:<chat id>»). A failed handoff never stops the reply: the previous one
 * (or none) is used and it is tried again next turn.
 */
export async function remember<T extends HandoffTurn>(o: { key: string; userId: string | null; robot: string; turns: T[]; window: number; seed?: string | null }): Promise<Remembered<T>> {
  const turns = o.turns.filter((t) => !t.error);
  // `seed`: a handoff written before this conversation began (حيدرة كت's «سلّم المحادثة»): read first, built on
  const seed = o.seed?.trim() ? { upTo: 0, text: o.seed.trim() } : null;
  if (turns.length <= o.window) return { lead: seed ? leadOf(seed.text) : [], kept: turns.slice(startAt(turns, 0)), fresh: false, usd: 0 };
  let h = (await load(o.key).catch(() => null)) ?? seed;
  // a stored handoff from a conversation that was cut shorter since (a message taken back): start again
  if (h && h.upTo > turns.length) h = null;
  let fresh = false;
  let usd = 0;
  // written again once the kept part is past the window: it then covers all but about half a window
  if (!h || turns.length - h.upTo > o.window) {
    const to = startAt(turns, turns.length - Math.ceil(o.window / 2));
    try {
      const w = await write(o.robot, h?.text ?? "", turns, h?.upTo ?? 0, to);
      if (w.text) {
        h = { upTo: to, text: w.text };
        await store(o.key, o.userId, h);
        fresh = true;
      }
      usd = w.usd;
    } catch (e) {
      console.error("robot handoff", o.key, e);
    }
  }
  if (!h) return { lead: [], kept: turns.slice(startAt(turns, turns.length - o.window)), fresh: false, usd };
  return {
    lead: leadOf(h.text),
    kept: turns.slice(startAt(turns, h.upTo)),
    fresh,
    usd,
  };
}

/** The handoff as plain turns, for a robot whose turns are `{ role, text }`. */
export const leadTurns = (m: Pick<Remembered<unknown>, "lead">): HandoffTurn[] => m.lead.map((t) => ({ role: t.role, text: typeof t.content === "string" ? t.content : "" }));
