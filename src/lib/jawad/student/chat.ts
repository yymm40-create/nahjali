// «الطالب الذكي» · «محادثة مع صادق» — an output that is a conversation kept with the material: the student discusses
// the topic with صادق, asks about any part of it, has it explained, summarised or prepared for, and صادق searches the
// web when asked (or when the material doesn't hold the answer), with its sources. Server only.

import { UserError } from "@/lib/api";
import { callClaudeSearch } from "@/lib/film/anthropic";
import { talk, type Turn } from "@/lib/games/claude";
import { readBrief } from "@config/jawad/student";
import { methodLine, studyAudience } from "@config/jawad/study-methods";
import { MATERIAL_RULE } from "./claude";
import { allText, loadCtx, researchText, understandingText } from "./context";
import { outputs, saveOutput, type Output } from "./db";
import { docText, type Doc, type DocPlan } from "./model";
import { chatMakeKinds, makeRules, splitOffer, type Offer } from "./offer";

export interface ChatMsg {
  role: "user" | "assistant";
  text: string;
  at: string;
  sources?: string[];
  /** what صادق offered to make in this message (a card with a button; nothing is made until it is pressed) */
  offer?: Offer;
}

export const chatOf = (o: Pick<Output, "content">): ChatMsg[] => {
  const m = (o.content as { messages?: unknown } | null)?.messages;
  return (Array.isArray(m) ? m : []).filter((x): x is ChatMsg => !!x && typeof x === "object" && ((x as ChatMsg).role === "user" || (x as ChatMsg).role === "assistant") && typeof (x as ChatMsg).text === "string");
};

const MESSAGE_MAX = 4000;
/** The material sent with every turn (the rest is reached through the understanding's map). */
const MATERIAL_MAX = 150_000;
const HISTORY = 30;
/** A request to look outside the material. */
const WANTS_SEARCH = /ابحث|دوّر|دور لي|من النت|من الإنترنت|من الانترنت|مصادر|مصدر|آخر الأخبار|أحدث|search/i;

/** The student says something to صادق in this conversation; returns the conversation with his answer, and its cost. */
export async function chatTurn(userId: string, o: Output, raw: unknown, leader: boolean): Promise<{ messages: ChatMsg[]; usd: number }> {
  if (o.kind !== "chat") throw new UserError("هذا الناتج مو محادثة.", 400);
  const said = String(raw ?? "").trim().slice(0, MESSAGE_MAX);
  if (!said) throw new UserError("اكتب رسالتك.");
  const c = await loadCtx(userId, o.project_id);
  const audience = studyAudience(c.project.level, readBrief(c.project.brief).purpose);
  const before = chatOf(o);
  let usd = 0;

  // «ابحث لي…»: the web first, its findings and links handed to صادق with the question
  let found = "";
  let sources: string[] = [];
  if (WANTS_SEARCH.test(said)) {
    const r = await callClaudeSearch({
      system: `${MATERIAL_RULE}\nSearch reliable sources for what the student asks about, in the context of their study topic (${c.understanding.topic}). Answer in Arabic: the facts found, briefly, each with where it comes from.`,
      prompt: said,
      maxUses: 4,
    }).catch(() => null);
    if (r) {
      usd += r.usd;
      found = r.text;
      sources = r.sources;
    }
  }

  const material = allText(c);
  const made = await outputs(o.project_id).catch(() => []);
  // «الخطيب الذكي»: the conversation is about the preacher's sermon — what was taken for it, and its text when written
  let sermon = "";
  if (c.khateeb) {
    const so = made.find((x) => x.kind === "sermon");
    const sp = (so?.plan as DocPlan | null)?.sermon;
    const topic = sp && sp.chosen >= 0 ? sp.topics[sp.chosen] : null;
    if (so && topic && sp) {
      const text = so.content ? docText(so.content as Doc) : "";
      sermon = [
        "THE PREACHER'S SERMON (what the Sheikh took for it; talk about THIS, and refine it with the preacher):",
        `Topic: ${String(so.settings.topic ?? "")} · goal: ${String(so.settings.goal ?? "")}`,
        `Angle: ${topic.title} — ${topic.idea}\nTakhallus point: ${topic.kooriz}`,
        `Key verse (${topic.verse.ref}): ${topic.verse.text}`,
        sp.tafsir ? `Tafsir (${sp.tafsir.source}): ${sp.tafsir.simple}` : "No tafsir was taken.",
        sp.poems?.length ? `Lines taken:\n${sp.poems.map((x) => `${x.text} (${x.ref}، ص${x.page})`).join("\n")}` : "",
        sp.sources?.length ? `Passages taken from the books:\n${sp.sources.map((x) => `${x.text} (${x.ref}، ص${x.page})`).join("\n")}` : "",
        text ? `THE SERMON'S TEXT SO FAR:\n${text.slice(0, 60_000)}` : "The sermon's text is not written yet.",
        "In this conversation: follow the owner's method and rules above exactly as in the sermon. You may discuss, advise, suggest wording or a passage the preacher asks for, and answer what he wants that is special or particular — but a verse, a narration or a line of poetry is only ever one given above or in the material, never from memory. To CHANGE the sermon's text itself, tell him to press «عدّل» on the sermon's text and write the change there (that revises the text and shows it to him again).",
      ]
        .filter(Boolean)
        .join("\n");
    }
  }
  const system = [
    MATERIAL_RULE,
    c.khateeb,
    sermon,
    `You are «${c.khateeb ? "الشيخ صادق" : "صادق"}» in a saved CONVERSATION with the ${c.khateeb ? "preacher" : "student"} about their study material (topic: ${c.understanding.topic}). Discuss it with them like a sharp, warm tutor: answer from the material first and say where in it; explain, simplify, give examples, quiz them when they want, help them prepare or debate, and push their thinking with a good question when it helps. When you add something that is NOT in the material, say so plainly («من خارج المادة»). Never invent sources, numbers or quotes. Reply in the student's language and dialect, short unless they ask for more.`,
    methodLine("chat", audience),
    makeRules(made),
    `Student level: ${c.project.level || "unspecified"}.`,
    `UNDERSTANDING OF THE MATERIAL:\n${understandingText(c)}`,
    `MATERIAL${material.length > MATERIAL_MAX ? " (the beginning; ask about a part to get it in detail)" : ""}:\n${material.slice(0, MATERIAL_MAX)}`,
    researchText(c),
  ]
    .filter(Boolean)
    .join("\n\n");

  const ask = found ? `${said}\n\n(ما وجده البحث في الويب الآن، للاستناد إليه مع ذكر المصدر:\n${found})` : said;
  const turns: Turn[] = [...before.slice(-HISTORY).map((m) => ({ role: m.role, text: m.text })), { role: "user" as const, text: ask }];
  while (turns.length && turns[0].role !== "user") turns.shift();
  const r = await talk({ system, turns, maxTokens: 6000, leader, stream: true, timeoutMs: 240_000 });
  usd += r.usd;

  const now = new Date().toISOString();
  // his markers become an offer under his words (a button), never an action by themselves
  const { text: answer, offer } = splitOffer(r.text, chatMakeKinds());
  const messages: ChatMsg[] = [...before, { role: "user", text: said, at: now }, { role: "assistant", text: answer, at: now, ...(sources.length ? { sources } : {}), ...(offer ? { offer } : {}) }];
  await saveOutput(o.id, { content: { messages }, status: "done", approved: true, error: null });
  return { messages, usd };
}
