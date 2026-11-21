// SERVER ONLY. «اسأل الشيخ»: a question goes to «الشيخ الذكي», a Claude Managed Agent (Claude Platform, the site's own
// key and workspace) that searches the narration books of مكتبة الثقلين in its environment «deep-researcher-env» (the
// network there reaches thaqalayn.com and ablibrary.net only). The run takes a minute or more, so nothing waits on it:
// the question is saved, the session started, and each look at the page asks the platform where it stands.
// The table is closed to clients; everything goes through here with the service role.
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SHEIKH_BUDGET_CENTS,
  SHEIKH_GIVE_UP_MS,
  finalAnswer,
  inOrder,
  lastError,
  pendingAsks,
  runState,
  sheikhMessage,
  type AgentEvent,
  type SheikhFile,
  type SheikhMode,
  type SheikhQuestion,
  type SheikhStatus,
} from "../sheikh";
import { check, UserError } from "./api";

/** The agent and its environment on the Claude Platform (they can be swapped without a deploy of new code). */
const AGENT_ID = () => process.env.MAHDI_SHEIKH_AGENT_ID || "agent_01DBsc4NNsKMJep4NT8xS3Rg";
const ENV_ID = () => process.env.MAHDI_SHEIKH_ENV_ID || "env_014VtWLH5iDowT3eo3mCgnrR";
const API = "https://api.anthropic.com/v1";

/** Postgres «relation does not exist»: the SQL file has not been run yet. */
const notReady = (e: unknown) => ["42P01", "PGRST205"].includes((e as { code?: string })?.code ?? "");
const NOT_READY = "«اسأل الشيخ» ما جهز بعد، جرّب بعد شوي.";

export interface SheikhRow {
  id: string;
  user_id: string;
  mode: SheikhMode;
  question: string;
  session_id: string | null;
  status: SheikhStatus;
  answer: string | null;
  files: SheikhFile[] | null;
  error: string | null;
  cost_cents: number | null;
  report: string | null;
  reported_at: string | null;
  created_at: string;
  finished_at: string | null;
}

export const sheikhView = (r: SheikhRow): SheikhQuestion => ({
  id: r.id,
  mode: r.mode,
  question: r.question,
  status: r.status,
  answer: r.answer,
  files: Array.isArray(r.files) ? r.files : [],
  error: r.status === "failed" ? r.error || "ما قدر الشيخ يكمل البحث. جرّب مرة ثانية." : null,
  reported: !!r.reported_at,
  createdAt: r.created_at,
  finishedAt: r.finished_at,
});

// ---------- the Claude Platform ----------

async function platform<T>(path: string, init: { method?: string; body?: unknown; files?: boolean } = {}): Promise<T> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new UserError("الشيخ الذكي غير مفعّل على الخادم.", 503);
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "managed-agents-2026-04-01",
      ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[sheikh] platform", res.status, path, text.slice(0, 500));
    if (res.status === 400 && /credit|balance|billing/i.test(text)) throw new UserError("رصيد الذكاء الاصطناعي خلص؛ صاحب التطبيق يشحنه.", 503);
    throw new UserError(res.status === 429 ? "الشيخ مشغول بأسئلة كثيرة الحين، جرّب بعد دقيقة." : "ما قدرنا نوصل للشيخ الذكي، جرّب بعد شوي.", 503);
  }
  return (await res.json()) as T;
}

/** Starts the agent on one question: a session (with a spending cap) and the question as its first message. */
async function startSession(mode: SheikhMode, question: string, title: string): Promise<string> {
  const session = await platform<{ id: string }>("/sessions", {
    method: "POST",
    body: {
      agent: AGENT_ID(),
      environment_id: ENV_ID(),
      title: title.slice(0, 80),
      budget: { type: "limit", max_list_cost: { amount: String(SHEIKH_BUDGET_CENTS[mode]), currency: "USD" } },
    },
  });
  await platform(`/sessions/${session.id}/events`, {
    method: "POST",
    body: { events: [{ type: "user.message", content: [{ type: "text", text: sheikhMessage(mode, question) }] }] },
  });
  return session.id;
}

/** Every event of a session, in order (a few pages at most for one question). */
async function sessionEvents(sessionId: string): Promise<AgentEvent[]> {
  const out: AgentEvent[] = [];
  let page: string | null = null;
  for (let i = 0; i < 20; i++) {
    const r: { data?: AgentEvent[]; next_page?: string | null } = await platform(`/sessions/${sessionId}/events${page ? `?page=${encodeURIComponent(page)}` : ""}`);
    out.push(...(r.data ?? []));
    page = r.next_page ?? null;
    if (!page) break;
  }
  return inOrder(out);
}

/** The files the agent wrote to /mnt/session/outputs/ (the Word file of a «بحث شامل»). */
async function sessionFiles(sessionId: string): Promise<SheikhFile[]> {
  const r = await platform<{ data?: { id: string; filename?: string; size_bytes?: number }[] }>(`/files?scope_id=${encodeURIComponent(sessionId)}`).catch(() => ({ data: [] }));
  return (r.data ?? []).map((f) => ({ id: f.id, name: f.filename || "ملف", bytes: Number(f.size_bytes) || 0 })).slice(0, 10);
}

/** One file of a session, streamed through to the person (only a file their own question made). */
export async function sheikhFileResponse(userId: string, questionId: string, fileId: string): Promise<Response> {
  const row = await oneRow(userId, questionId);
  const file = (row.files ?? []).find((f) => f.id === fileId);
  if (!file) throw new UserError("الملف غير موجود.", 404);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new UserError("الشيخ الذكي غير مفعّل على الخادم.", 503);
  const res = await fetch(`${API}/files/${encodeURIComponent(fileId)}/content`, {
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-beta": "managed-agents-2026-04-01" },
    cache: "no-store",
  });
  if (!res.ok || !res.body) throw new UserError("ما قدرنا نجيب الملف، جرّب بعد شوي.", 503);
  return new Response(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

// ---------- the questions ----------

const db = () => createAdminClient().from("mahdi_sheikh_questions");

async function oneRow(userId: string, id: string): Promise<SheikhRow> {
  const r = await db().select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  if (r.error) {
    if (notReady(r.error)) throw new UserError(NOT_READY, 503);
    throw r.error;
  }
  if (!r.data) throw new UserError("السؤال غير موجود.", 404);
  return r.data as SheikhRow;
}

/** The person's latest questions (newest first); null before the SQL is run. */
export async function myQuestions(userId: string, limit = 30): Promise<SheikhRow[] | null> {
  const r = await db().select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  if (r.error) {
    if (notReady(r.error)) return null;
    throw r.error;
  }
  return (r.data ?? []) as SheikhRow[];
}

/** When the person asked each mode lately (for the allowance). */
export async function askedTimes(userId: string): Promise<Record<SheikhMode, string[]>> {
  const since = new Date(Date.now() - 8 * 24 * 3600_000).toISOString();
  const r = await db().select("mode, created_at, status").eq("user_id", userId).gte("created_at", since);
  if (r.error) {
    if (notReady(r.error)) throw new UserError(NOT_READY, 503);
    throw r.error;
  }
  const out: Record<SheikhMode, string[]> = { quick: [], deep: [] };
  // a question that failed on our side doesn't use the allowance
  for (const q of (r.data ?? []) as { mode: SheikhMode; created_at: string; status: SheikhStatus }[]) if (q.status !== "failed") out[q.mode]?.push(q.created_at);
  return out;
}

/** Saves the question and starts the agent on it. */
export async function askSheikh(userId: string, mode: SheikhMode, question: string): Promise<SheikhRow> {
  const ins = await db().insert({ user_id: userId, mode, question, status: "running" }).select("*").single();
  if (ins.error) {
    if (notReady(ins.error)) throw new UserError(NOT_READY, 503);
    throw ins.error;
  }
  const row = ins.data as SheikhRow;
  try {
    const sessionId = await startSession(mode, question, `لأجل المهدي · ${question}`);
    return check(await db().update({ session_id: sessionId }).eq("id", row.id).select("*").single()) as SheikhRow;
  } catch (e) {
    await db().update({ status: "failed", error: e instanceof UserError ? e.message : "ما قدرنا نبدأ البحث.", finished_at: new Date().toISOString() }).eq("id", row.id);
    throw e;
  }
}

/**
 * Asks the platform where a running question stands and saves what changed: the answer and its files when the agent is
 * done, «failed» when the session ended without one or ran past its time. A tool call paused for a decision is denied
 * (nobody watches the run).
 */
export async function refreshQuestion(row: SheikhRow): Promise<SheikhRow> {
  if (row.status !== "running") return row;
  const age = Date.now() - Date.parse(row.created_at);
  const fail = async (error: string) =>
    (check(await db().update({ status: "failed", error, finished_at: new Date().toISOString() }).eq("id", row.id).select("*").single()) as SheikhRow);
  if (!row.session_id) return age > 120_000 ? fail("ما بدأ البحث. جرّب مرة ثانية.") : row;
  let events: AgentEvent[];
  try {
    events = await sessionEvents(row.session_id);
  } catch {
    return age > SHEIKH_GIVE_UP_MS[row.mode] ? fail("طوّل البحث أكثر من اللازم. جرّب سؤالًا أقصر.") : row;
  }
  const state = runState(events);
  if (state === "waiting") {
    const asks = pendingAsks(events);
    if (asks.length) {
      await platform(`/sessions/${row.session_id}/events`, {
        method: "POST",
        body: { events: asks.map((id) => ({ type: "user.tool_confirmation", tool_use_id: id, result: "deny" })) },
      }).catch(() => undefined);
      return row;
    }
  }
  if (state === "done" || state === "terminated" || state === "waiting") {
    const answer = finalAnswer(events);
    if (!answer) return fail(lastError(events) ? "صار خطأ أثناء البحث. جرّب مرة ثانية." : "ما وصل جواب من الشيخ. جرّب مرة ثانية.");
    const files = row.mode === "deep" ? await sessionFiles(row.session_id) : [];
    const session = await platform<{ usage?: { list_cost?: { amount?: string } } }>(`/sessions/${row.session_id}`).catch(() => null);
    const cents = Number(session?.usage?.list_cost?.amount);
    return check(
      await db()
        .update({ status: "done", answer: answer.slice(0, 60_000), files, cost_cents: Number.isFinite(cents) ? Math.round(cents) : null, finished_at: new Date().toISOString() })
        .eq("id", row.id)
        .select("*")
        .single(),
    ) as SheikhRow;
  }
  return age > SHEIKH_GIVE_UP_MS[row.mode] ? fail("طوّل البحث أكثر من اللازم. جرّب سؤالًا أقصر.") : row;
}

/** «في خطأ؟»: what the person says is wrong in an answer (the owner reads these). */
export async function reportAnswer(userId: string, id: string, text: string): Promise<SheikhRow> {
  await oneRow(userId, id);
  return check(await db().update({ report: text.slice(0, 1000), reported_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId).select("*").single()) as SheikhRow;
}
