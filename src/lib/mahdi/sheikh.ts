// «الشيخ الذكي»: the pure parts of the chat (limits, the message shape, showing an answer), shared by the server, the
// chat and the tests. The sheikh searches the app's own copy of the thaqalayn hadith books (server/sheikh.ts).

export type SheikhMode = "quick" | "deep";

export interface SheikhSource {
  n: number;
  url: string;
  title: string;
  source: string;
}

export interface SheikhMsg {
  id: string;
  role: "user" | "sheikh";
  mode: SheikhMode;
  body: string;
  sources: SheikhSource[];
  reported: boolean;
  createdAt: string;
}

/** Questions a person may send in a day, of each kind (the owner has no limit). */
export const SHEIKH_DAILY: Record<SheikhMode, number> = { quick: 30, deep: 5 };
export const SHEIKH_QUESTION_MAX = 1000;
/** How much of the conversation the sheikh reads with a new question (its latest messages). */
export const SHEIKH_MEMORY = 8;

/** What is left of the day's questions, from the times of the person's questions. */
export function sheikhLeft(mode: SheikhMode, askedAt: string[], now = Date.now()): number {
  const since = now - 24 * 3600_000;
  return Math.max(0, SHEIKH_DAILY[mode] - askedAt.filter((t) => Date.parse(t) >= since).length);
}

/** When the next question of this kind comes back (24 hours after the oldest one still counted), as ms; null when
 *  nothing is counted (the day's allowance is whole). */
export function sheikhRenewAt(askedAt: string[], now = Date.now()): number | null {
  const since = now - 24 * 3600_000;
  const counted = askedAt.map((t) => Date.parse(t)).filter((t) => Number.isFinite(t) && t >= since);
  return counted.length ? Math.min(...counted) + 24 * 3600_000 : null;
}

/** «باقي لك 8 أسئلة اليوم» (Western digits, the number agreeing in Arabic). */
export function questionsLeftText(n: number): string {
  if (n >= 999) return "أسئلتك بلا حد";
  if (n <= 0) return "خلصت أسئلتك اليوم";
  if (n === 1) return "باقي لك سؤال واحد اليوم";
  if (n === 2) return "باقي لك سؤالين اليوم";
  return `باقي لك ${n} ${n <= 10 ? "أسئلة" : "سؤال"} اليوم`;
}

/** How long until a question comes back: «خلال 3 ساعات», «خلال 40 دقيقة» (never «بكرة»: it is within 24 hours). */
export function renewText(at: number | null, now = Date.now()): string | null {
  if (at === null) return null;
  const min = Math.max(1, Math.ceil((at - now) / 60_000));
  if (min < 60) return `يتجدد لك سؤال خلال ${min} ${min <= 10 && min > 2 ? "دقائق" : "دقيقة"}`;
  const h = Math.round(min / 60);
  return `يتجدد لك سؤال خلال ${h === 1 ? "ساعة" : h === 2 ? "ساعتين" : `${h} ${h <= 10 ? "ساعات" : "ساعة"}`}`;
}

/** What the server sends while the sheikh works, one JSON per line: a new round of searching (the text written so far
 *  is dropped: it was his note before searching), a piece of the answer, the end (the saved messages), or a failure. */
export type SheikhEvent =
  | { t: "search" }
  | { t: "text"; v: string }
  | { t: "done"; messages: SheikhMsg[]; left: Record<SheikhMode, number>; renew?: Record<SheikhMode, number | null> }
  | { t: "error"; message: string };

/** Cuts what arrived so far into whole events; `rest` is the unfinished last line, kept for the next piece. */
export function readEvents(buf: string): { events: SheikhEvent[]; rest: string } {
  const lines = buf.split("\n");
  const rest = lines.pop() ?? "";
  const events: SheikhEvent[] = [];
  for (const l of lines) {
    if (!l.trim()) continue;
    try {
      const e = JSON.parse(l) as SheikhEvent;
      if (e && typeof e === "object" && typeof e.t === "string") events.push(e);
    } catch {
      /* a broken line is skipped, never stops the answer */
    }
  }
  return { events, rest };
}

/** On a phone (a finger, no keyboard) Enter makes a new line and the button sends; with a keyboard Enter sends. */
export const enterSends = (coarsePointer: boolean, shift: boolean, composing: boolean) => !coarsePointer && !shift && !composing;

/** A question as typed: trimmed, inner runs of blank lines folded; null when empty or too long. */
export function cleanQuestion(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const q = v.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  return q.length >= 2 && q.length <= SHEIKH_QUESTION_MAX ? q : null;
}

/** «صلى الله عليه وسلم» and ﷺ written by the model become «صلى الله عليه وآله» (the owner's rule), and a narration is
 *  always told as «روي عن…», never «قال الإمام…» as a fact. */
export function sheikhWording(s: string): string {
  return riwayaWording(
    s
      .replace(/\s*ﷺ/g, " صلى الله عليه وآله")
      .replace(/صلى الله عليه وسلم/g, "صلى الله عليه وآله")
      .replace(/\(ص\)/g, "(صلى الله عليه وآله)"),
  );
}

/** Who a narration is told from: «قال <one of them>» outside a quoted text becomes «روي عن <them>». */
const TOLD_FROM = "(?:الإمام|الامام|رسول الله|النبي|أمير المؤمنين|امير المؤمنين|أبو عبد الله|أبي عبد الله|أبو جعفر|أبي جعفر|أبو الحسن|أبي الحسن|الصادق|الباقر|الرضا|الكاظم|السجاد|زين العابدين|الحسين|الحسن|فاطمة|الزهراء)";
const SAID = new RegExp(`(^|[\\s(\\-–—:،.])(و?)(?:قال|يقول)\\s+(?=${TOLD_FROM})`, "g");

/**
 * «قال الإمام الصادق عليه السلام» → «روي عن الإمام الصادق عليه السلام» in the sheikh's own words. The narration's text
 * itself (between « ») is never touched: it is quoted letter for letter from the book.
 */
export function riwayaWording(s: string): string {
  return s
    .split(/(«[^»]*»)/)
    .map((part) => (part.startsWith("«") ? part : part.replace(SAID, (_m, before: string, and: string) => `${before}${and}روي عن `).replace(/روي عن أبو /g, "روي عن أبي ")))
    .join("");
}

export type AnswerPiece = { t: "text"; v: string } | { t: "link"; v: string } | { t: "cite"; v: number } | { t: "bold"; v: string };

/** An answer line cut into text, links, bold and source numbers «[2]» (shown as tappable). */
export function linkPieces(line: string): AnswerPiece[] {
  const out: AnswerPiece[] = [];
  const re = /https?:\/\/[^\s)»"'<>،]+|\[(\d{1,2})\]|\*\*([^*]+)\*\*/g;
  let at = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    let whole = m[0];
    if (m.index > at) out.push({ t: "text", v: line.slice(at, m.index) });
    if (m[1]) out.push({ t: "cite", v: Number(m[1]) });
    else if (m[2]) out.push({ t: "bold", v: m[2] });
    else {
      whole = whole.replace(/[.,;:]+$/, "");
      out.push({ t: "link", v: whole });
    }
    at = m.index + whole.length;
  }
  if (at < line.length) out.push({ t: "text", v: line.slice(at) });
  return out;
}

/** The answer without the Markdown marks the chat doesn't draw (heading hashes, list stars). Bold stays (drawn). */
export function plainAnswer(s: string): string {
  return s.replace(/^#{1,6}\s+/gm, "").replace(/^\s*[-*]\s+/gm, "• ");
}

/** How long a question may still be waiting for its answer (a deep search takes a minute or two); an older one without an
 *  answer was lost (its answer failed) and no longer holds the next question. */
export const SHEIKH_PENDING_MS = 6 * 60_000;

/** The person's question still being answered (the newest message is theirs and recent), or null. Oldest first. */
export function pendingQuestion<T extends { role: "user" | "sheikh"; created_at: string }>(rows: T[], now = Date.now()): T | null {
  const last = rows[rows.length - 1];
  return last && last.role === "user" && now - Date.parse(last.created_at) < SHEIKH_PENDING_MS ? last : null;
}

/** The conversation the sheikh reads: only questions that got their answer, each with it (oldest first), so a question
 *  left without an answer is never mixed into the new one. */
export function answeredHistory<T extends { role: "user" | "sheikh" }>(rows: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    if (rows[i].role === "user" && rows[i + 1].role === "sheikh") out.push(rows[i], rows[i + 1]);
  }
  return out;
}
