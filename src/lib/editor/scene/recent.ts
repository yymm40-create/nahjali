// «مختبر الموشن» — what this person made in the lab lately, as a compact list for the plan and the write (the owner:
// «قاعد يكرر في الموشنات اللي يسويها»): every new piece must take a clearly different approach from these unless the person
// asks for the same. Read from the lab's own conversations (migration 0087: each one's current plan in `state.plan`), only
// the plan's few telling fields, never a program. Sent in the step's own (uncached) text, so the cached prefix stays as it is.
// A database that is missing, slow or not configured gives an empty list: planning never waits on it or fails because of it.

import { createAdminClient } from "@/lib/supabase/admin";

/** How many recent pieces the plan is shown (newest first), and how long the look-up may take. */
export const RECENT_MAX = 6;
/** Rows read to find them: a conversation may hold editing messages and no plan yet (the lab runs inside حيدرا ماكس's chat). */
export const RECENT_FETCH = 20;
const RECENT_WAIT_MS = 2500;

export interface RecentPiece {
  title: string;
  idea: string;
  format: string;
  /** the shot count and the first few transitions / camera moves */
  shots: number;
  moves: string[];
  palette: string;
  fonts: string;
  /** made in the project the plan is for */
  here: boolean;
  /** days since the conversation was last touched */
  days: number;
}

const s = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** One saved plan, reduced to what tells pieces apart (null when it is not a plan). */
export function recentOf(plan: unknown, o: { here?: boolean; at?: string; now?: number; title?: string } = {}): RecentPiece | null {
  if (!plan || typeof plan !== "object") return null;
  const p = plan as Record<string, unknown>;
  const pal = (p.palette ?? {}) as Record<string, unknown>;
  const fo = (p.fonts ?? {}) as Record<string, unknown>;
  const shots = Array.isArray(p.shots) ? (p.shots as Record<string, unknown>[]) : [];
  const moves: string[] = [];
  for (const x of shots) {
    for (const m of [s(x?.transition, 40), s(x?.camera, 40)]) if (m && !moves.includes(m) && moves.length < 4) moves.push(m);
  }
  const title = s(p.title, 60) || s(o.title, 60);
  const idea = s(p.idea, 140);
  if (!title && !idea) return null;
  const at = o.at ? Date.parse(o.at) : NaN;
  return {
    title,
    idea,
    format: s(p.format, 50),
    shots: shots.length,
    moves,
    palette: ["bg", "accent", "second"].map((k) => s(pal[k], 9)).filter(Boolean).join(" "),
    fonts: [s(fo.head, 30), s(fo.body, 30)].filter(Boolean).join(" + "),
    here: Boolean(o.here),
    days: Number.isFinite(at) ? Math.max(0, Math.floor(((o.now ?? Date.now()) - at) / 86_400_000)) : -1,
  };
}

/** The person's recent lab pieces (newest first, at most RECENT_MAX); [] when there are none or the look-up fails. */
export async function recentPieces(userId: string, projectId: string): Promise<RecentPiece[]> {
  if (!userId) return [];
  try {
    const query = createAdminClient()
      .from("motion_lab_chats")
      .select("title,project_id,updated_at,plan:state->plan")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(RECENT_FETCH);
    const timeout = new Promise<{ data: null }>((ok) => setTimeout(() => ok({ data: null }), RECENT_WAIT_MS));
    const { data } = (await Promise.race([query, timeout])) as { data: { title?: string; project_id?: string; updated_at?: string; plan?: unknown }[] | null };
    const now = Date.now();
    return (data ?? [])
      .map((r) => recentOf(r.plan, { here: r.project_id === projectId, at: r.updated_at, now, title: r.title }))
      .filter((x): x is RecentPiece => Boolean(x))
      .slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

/** The list as the plan and the write read it (empty string when there is nothing to compare against). */
export function recentText(list: RecentPiece[]): string {
  if (!list.length) return "";
  const line = (r: RecentPiece, i: number) =>
    `${i + 1}. «${r.title || "—"}»${r.days >= 0 ? ` (${r.days === 0 ? "today" : `${r.days} d ago`}${r.here ? ", this project" : ""})` : r.here ? " (this project)" : ""} — idea: ${r.idea || "—"}${r.format ? ` · format: ${r.format}` : ""} · ${r.shots} shots${r.moves.length ? ` (${r.moves.join("; ")})` : ""}${r.palette ? ` · palette ${r.palette}` : ""}${r.fonts ? ` · fonts ${r.fonts}` : ""}`;
  return `THIS PERSON'S RECENT PIECES IN THE LAB (newest first — what you already made for them):\n${list.map(line).join("\n")}\nMake this one CLEARLY DIFFERENT from all of them — another idea, another structure and opening, another motion and transition language, another palette and type pairing — unless the person explicitly asks for the same or a continuation of one (then say which in "variety"). A brand's own colours and fonts may repeat; the design around them may not.`;
}
