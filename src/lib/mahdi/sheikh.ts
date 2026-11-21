// «اسأل الشيخ»: the pure parts (limits, the message sent to the agent, reading its events), shared by the server, the
// page and the tests. The agent itself («الشيخ الذكي») lives on the Claude Platform; see server/sheikh.ts.

export type SheikhMode = "quick" | "deep";
export type SheikhStatus = "running" | "done" | "failed";

export interface SheikhFile {
  id: string;
  name: string;
  bytes: number;
}

export interface SheikhQuestion {
  id: string;
  mode: SheikhMode;
  question: string;
  status: SheikhStatus;
  answer: string | null;
  files: SheikhFile[];
  error: string | null;
  reported: boolean;
  createdAt: string;
  finishedAt: string | null;
}

/** How many questions a person may ask: quick ones per day, deep ones per week (the owner has no limit). */
export const SHEIKH_LIMITS = { quick: { count: 5, hours: 24 }, deep: { count: 2, hours: 24 * 7 } } as const;
/** The most a session may spend, in US cents at list prices (the platform pauses it there). */
export const SHEIKH_BUDGET_CENTS = { quick: 100, deep: 400 } as const;
/** A question still running after this long is given up. */
export const SHEIKH_GIVE_UP_MS = { quick: 12 * 60_000, deep: 40 * 60_000 } as const;
export const SHEIKH_QUESTION_MAX = 800;

/** What is left of a mode's allowance, from the times of the person's earlier questions of that mode. */
export function sheikhLeft(mode: SheikhMode, askedAt: string[], now = Date.now()): number {
  const { count, hours } = SHEIKH_LIMITS[mode];
  const since = now - hours * 3600_000;
  return Math.max(0, count - askedAt.filter((t) => Date.parse(t) >= since).length);
}

/** The question as the agent receives it: its kind first (the agent's prompt explains both). */
export function sheikhMessage(mode: SheikhMode, question: string): string {
  return `${mode === "quick" ? "[سؤال سريع]" : "[بحث شامل]"} ${question.trim()}`;
}

/** A question as typed: trimmed, inner runs of blank lines folded; null when too short or too long. */
export function cleanQuestion(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const q = v.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  return q.length >= 3 && q.length <= SHEIKH_QUESTION_MAX ? q : null;
}

// ---------- the agent's events ----------

interface Block {
  type?: string;
  text?: string;
}
export interface AgentEvent {
  id?: string;
  type?: string;
  content?: Block[];
  stop_reason?: { type?: string } | null;
  evaluated_permission?: string;
  tool_use_id?: string;
  error?: { message?: string } | null;
  processed_at?: string;
}

/** Events in the order they happened (by their processing time when every one has it). */
export function inOrder(events: AgentEvent[]): AgentEvent[] {
  if (!events.every((e) => typeof e.processed_at === "string")) return events;
  return events
    .map((e, i) => ({ e, i }))
    .sort((a, b) => Date.parse(a.e.processed_at!) - Date.parse(b.e.processed_at!) || a.i - b.i)
    .map((x) => x.e);
}

const textOf = (e: AgentEvent) =>
  (e.content ?? [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text!.trim())
    .filter(Boolean)
    .join("\n\n");

/**
 * The answer: the agent's last message after the last question (its earlier messages are notes between tool calls,
 * like «سأقرأ الصفحة بـ curl»). A short last message after a long one («الملف جاهز») keeps the long one before it.
 */
export function finalAnswer(events: AgentEvent[]): string {
  let start = 0;
  events.forEach((e, i) => {
    if (e.type === "user.message") start = i + 1;
  });
  const said = events.slice(start).filter((e) => e.type === "agent.message").map(textOf).filter(Boolean);
  if (!said.length) return "";
  const last = said[said.length - 1];
  const before = said[said.length - 2];
  return last.length < 200 && before && before.length > 400 ? `${before}\n\n${last}` : last;
}

/** How the run ended: «done» (idle after its turn), «waiting» (a tool call waits for a yes/no), or still «running». */
export function runState(events: AgentEvent[]): "done" | "waiting" | "running" | "terminated" {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === "session.status_terminated") return "terminated";
    if (e.type === "session.status_idle") return e.stop_reason?.type === "requires_action" ? "waiting" : "done";
    if (e.type === "session.status_running" || e.type === "user.message") return "running";
  }
  return "running";
}

/** Tool calls paused for a decision and not answered yet (nobody watches: the server answers «deny»). */
export function pendingAsks(events: AgentEvent[]): string[] {
  const answered = new Set(events.filter((e) => e.type === "user.tool_confirmation").map((e) => e.tool_use_id));
  return events
    .filter((e) => (e.type === "agent.tool_use" || e.type === "agent.mcp_tool_use") && e.evaluated_permission === "ask" && e.id && !answered.has(e.id))
    .map((e) => e.id!);
}

/** The last error the session reported, if any. */
export function lastError(events: AgentEvent[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) if (events[i].type === "session.error") return events[i].error?.message ?? "خطأ في الجلسة";
  return null;
}

// ---------- showing the answer ----------

export type AnswerPiece = { t: "text"; v: string } | { t: "link"; v: string };

/** An answer line cut into text and links (the sources are shown as tappable links). */
export function linkPieces(line: string): AnswerPiece[] {
  const out: AnswerPiece[] = [];
  const re = /https?:\/\/[^\s)»"'<>،]+/g;
  let at = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    const url = m[0].replace(/[.,;:]+$/, "");
    if (m.index > at) out.push({ t: "text", v: line.slice(at, m.index) });
    out.push({ t: "link", v: url });
    at = m.index + url.length;
  }
  if (at < line.length) out.push({ t: "text", v: line.slice(at) });
  return out;
}

/** The answer without Markdown marks the page doesn't draw (bold stars, heading hashes). */
export function plainAnswer(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ");
}
