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

/** A question as typed: trimmed, inner runs of blank lines folded; null when empty or too long. */
export function cleanQuestion(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const q = v.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  return q.length >= 2 && q.length <= SHEIKH_QUESTION_MAX ? q : null;
}

/** «صلى الله عليه وسلم» and ﷺ written by the model become «صلى الله عليه وآله» (the owner's rule). */
export function sheikhWording(s: string): string {
  return s
    .replace(/\s*ﷺ/g, " صلى الله عليه وآله")
    .replace(/صلى الله عليه وسلم/g, "صلى الله عليه وآله")
    .replace(/\(ص\)/g, "(صلى الله عليه وآله)");
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
