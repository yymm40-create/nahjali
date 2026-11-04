// «حيدرا ماكس» is ONE window now (the owner, 3 November 2026: «حيدرا ماكس هو مختبر الموشن مب شيين مختلفين. نبي النتايج
// عالتايملاين على طول مع ميزة فتح اكثر من محادثة»): the motion lab runs inside his conversation, and the edit has as many
// conversations as the person opens, like Claude's. What needs no React: which conversation is which, where a message
// goes (the edit or the motion piece in the conversation), when a request already says enough to build without asking,
// and how the two streams of a conversation are shown as one.

import { NEW_TITLE, type Tab } from "./lab-tabs";

/** The project's main conversation: its messages are the project's own store (editor_chats), where the other robots
 * deliver; its motion work is a motion_lab_chats row marked `main`. Every other conversation is one row. */
export const MAIN = "main";
export const MAIN_TITLE = "المحادثة الرئيسية";

/** A conversation as the list shows it. */
export interface ChatRow {
  id: string;
  title: string;
  updated_at: string;
  main?: boolean;
}

/** What the page tells the server about the conversation it talks in (`chat`): nothing for the main one, its id once
 * kept, else a name of its own until it is (so two new conversations never share a memory). */
export const chatParam = (t: Pick<Tab, "id" | "chatId">): string | undefined => (t.id === MAIN ? undefined : (t.chatId ?? `new:${t.id}`));

/** The main conversation's motion row: the newest one marked main. */
export const mainRow = (rows: ChatRow[]) => rows.find((r) => r.main)?.id ?? null;

/**
 * The list under «🗂️ المحادثات»: the main conversation first, then every kept one (newest first), then the ones opened
 * on this device and not kept yet. `open` marks those on this device (the tab's id, to switch to it).
 */
export function conversationList(rows: ChatRow[] | null, tabs: Tab[]) {
  const main = mainRow(rows ?? []);
  const tabOf = (chatId: string) => tabs.find((t) => t.chatId === chatId)?.id ?? null;
  const out: { key: string; chatId: string | null; title: string; at: string | null; main: boolean; tab: string | null }[] = [
    { key: MAIN, chatId: main, title: MAIN_TITLE, at: rows?.find((r) => r.id === main)?.updated_at ?? null, main: true, tab: MAIN },
  ];
  for (const r of rows ?? []) {
    if (r.id === main) continue;
    out.push({ key: r.id, chatId: r.id, title: r.title || NEW_TITLE, at: r.updated_at, main: false, tab: tabOf(r.id) });
  }
  for (const t of tabs) {
    if (t.id === MAIN || (t.chatId && out.some((o) => o.chatId === t.chatId))) continue;
    out.push({ key: `tab:${t.id}`, chatId: t.chatId ?? null, title: t.title || NEW_TITLE, at: null, main: false, tab: t.id });
  }
  return out;
}

// what is plainly about the edit, never about a motion piece (said while a piece has the conversation, it goes to the edit)
const EDIT_ONLY = /كابشن|ترجم|السكتات|قص الصمت|شيل الصمت|تلوين|لوّن المقطع|لون المقطع|رفع الدقة|ارفع الدقة|افصل الصوت|فصل الصوت|قص المشاهد|بصمة صوت|خفّض الموسيقى|خفض الموسيقى|التايملاين كامل|المونتاج كامل/;

/**
 * Where a message goes: to the motion piece the conversation is on (its notes, its approval, its render…) or to the
 * edit. A piece has the conversation only while the person keeps it there (the 🎬 pill over the box); attached files
 * and what is plainly about the edit always go to the edit.
 */
export function routeOf(text: string, o: { focus: boolean; lab: boolean; pending?: number; search?: boolean }): "lab" | "editor" {
  if (!o.lab) return "editor";
  if (o.search) return "lab";
  if (!o.focus || (o.pending ?? 0) > 0) return "editor";
  return EDIT_ONLY.test(text) ? "editor" : "lab";
}

// the person said to go ahead without being asked («على طول»، «بدون ما تسألني»، «ابنه مباشرة»…)
const GO = /على طول|ع طول|مباشرة|مباشره|بدون ما تسأل|لا تسألني|بدون سيناريو|بدون خطة|ابنه|ابنيه|ابنِه|نفّذ|نفذ/;
const SECONDS = /\d+\s*(ث|ثانية|ثواني|ثوان|sec|s\b)|[٠-٩]+\s*(ث|ثانية|ثواني|ثوان)|(عشر|خمس|ست|سبع|ثمان|تسع|عشرين|ثلاثين)\s*(ثانية|ثواني|ثوان)/i;

/**
 * Does the person's message already say enough for the piece to be built without waiting on «اعتمد وابنِ»? When they
 * said to go ahead, or wrote a whole brief (what it is, its length, and enough words to say how it should look). The
 * scenario still comes as a card first; it is just approved by itself.
 */
export function saysEnough(text: string) {
  const t = text.trim();
  if (GO.test(t)) return true;
  const words = t.split(/\s+/).filter(Boolean).length;
  return words >= 20 && SECONDS.test(t);
}

/**
 * The conversation as one stream: the edit's messages and the motion piece's, each in its own order, merged by when
 * they were said (a message from before the times were kept takes the time of the one before it).
 */
export function mergeStream(edit: (number | undefined)[], lab: (number | undefined)[]): { k: "e" | "l"; i: number }[] {
  const fill = (xs: (number | undefined)[]) => {
    let last = 0;
    return xs.map((x) => (last = typeof x === "number" && Number.isFinite(x) && x >= last ? x : last));
  };
  const a = fill(edit);
  const b = fill(lab);
  const out: { k: "e" | "l"; i: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (j >= b.length || (i < a.length && a[i] <= b[j])) out.push({ k: "e", i: i++ });
    else out.push({ k: "l", i: j++ });
  }
  return out;
}

/** A kept message's time (the server keeps it as an ISO string), as a number; none when it is not known. */
export const timeOf = (at: unknown): number | undefined => {
  if (typeof at === "number" && Number.isFinite(at)) return at;
  if (typeof at === "string") {
    const t = Date.parse(at);
    if (Number.isFinite(t) && t > 0) return t;
  }
  return undefined;
};
