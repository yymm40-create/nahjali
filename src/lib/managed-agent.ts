import { createAdminClient } from "@/lib/supabase/admin";
import type { ClaudeUsage } from "@/lib/film/anthropic";

const BETA = "managed-agents-2026-04-01";
const API = () => `${process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com"}/v1`;
const WAIT_MS = 800;
const MAX_EVENT_PAGES = 20;

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "url"; url: string } }
  | { type: "document"; source: { type: "url"; url: string }; title?: string };

interface SessionUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number };
  active_seconds?: number;
  list_cost?: { amount?: string; currency?: string };
}

interface AgentSession {
  id: string;
  status: "idle" | "running" | "rescheduling" | "terminated" | string;
  usage?: SessionUsage | null;
}

interface AgentEvent {
  id: string;
  type: string;
  content?: { type: string; text?: string }[];
  error?: { message?: string };
}

interface SessionRow {
  session_id: string;
}

export interface ManagedAgentResult {
  text: string;
  usd: number;
  usage: ClaudeUsage;
  sessionId: string;
}

export interface ManagedAgentTurn {
  userId: string;
  contextType: "jawad" | "director" | "sajjad" | "smart_edit";
  contextKey: string;
  title: string;
  content: ContentBlock[];
  timeoutMs?: number;
}

export const managedAgentConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY && process.env.CLAUDE_AGENT_ID && process.env.CLAUDE_ENVIRONMENT_ID);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is missing");
  const response = await fetch(`${API()}${path}`, {
    ...init,
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": BETA,
      "content-type": "application/json",
      ...init.headers,
    },
    signal: init.signal ?? AbortSignal.timeout(120_000),
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(`Managed Agent ${response.status}: ${body.error?.message ?? "request failed"}`);
  return body;
}

async function events(sessionId: string) {
  const all: AgentEvent[] = [];
  let page = "";
  for (let index = 0; index < MAX_EVENT_PAGES; index++) {
    const query = new URLSearchParams({ limit: "100" });
    if (page) query.set("page", page);
    const result = await request<{ data?: AgentEvent[]; next_page?: string | null }>(`/sessions/${sessionId}/events?${query}`);
    all.push(...(result.data ?? []));
    if (!result.next_page) break;
    page = result.next_page;
  }
  return all;
}

const usageDelta = (before: SessionUsage | null | undefined, after: SessionUsage | null | undefined): ClaudeUsage => ({
  model: "claude-opus-5-5",
  input_tokens: Math.max(0, Number(after?.input_tokens ?? 0) - Number(before?.input_tokens ?? 0)),
  output_tokens: Math.max(0, Number(after?.output_tokens ?? 0) - Number(before?.output_tokens ?? 0)),
  cache_read_input_tokens: Math.max(0, Number(after?.cache_read_input_tokens ?? 0) - Number(before?.cache_read_input_tokens ?? 0)),
  cache_creation: {
    ephemeral_5m_input_tokens: Math.max(0, Number(after?.cache_creation?.ephemeral_5m_input_tokens ?? 0) - Number(before?.cache_creation?.ephemeral_5m_input_tokens ?? 0)),
    ephemeral_1h_input_tokens: Math.max(0, Number(after?.cache_creation?.ephemeral_1h_input_tokens ?? 0) - Number(before?.cache_creation?.ephemeral_1h_input_tokens ?? 0)),
  },
});

const usdDelta = (before: SessionUsage | null | undefined, after: SessionUsage | null | undefined) => {
  const cents = Math.max(0, Number(after?.list_cost?.amount ?? 0) - Number(before?.list_cost?.amount ?? 0));
  return cents / 100;
};

async function savedSession(userId: string, contextType: ManagedAgentTurn["contextType"], contextKey: string) {
  const { data, error } = await createAdminClient()
    .from("jawad_agent_sessions")
    .select("session_id")
    .eq("user_id", userId)
    .eq("context_type", contextType)
    .eq("context_key", contextKey)
    .maybeSingle();
  if (error) throw error;
  return (data as SessionRow | null)?.session_id ?? null;
}

async function rememberSession(input: ManagedAgentTurn, sessionId: string) {
  const { error } = await createAdminClient().from("jawad_agent_sessions").upsert(
    {
      user_id: input.userId,
      context_type: input.contextType,
      context_key: input.contextKey,
      session_id: sessionId,
      agent_version: Number(process.env.CLAUDE_AGENT_VERSION) || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,context_type,context_key" },
  );
  if (error) throw error;
}

async function forgetSession(input: ManagedAgentTurn) {
  await createAdminClient()
    .from("jawad_agent_sessions")
    .delete()
    .eq("user_id", input.userId)
    .eq("context_type", input.contextType)
    .eq("context_key", input.contextKey);
}

async function createSession(input: ManagedAgentTurn) {
  const agentId = process.env.CLAUDE_AGENT_ID!;
  const version = Number(process.env.CLAUDE_AGENT_VERSION);
  const session = await request<AgentSession>("/sessions", {
    method: "POST",
    body: JSON.stringify({
      agent: Number.isInteger(version) && version > 0 ? { type: "agent", id: agentId, version } : agentId,
      environment_id: process.env.CLAUDE_ENVIRONMENT_ID,
      title: input.title.slice(0, 200),
      metadata: { context_type: input.contextType, context_key: input.contextKey.slice(0, 200) },
      initial_events: [{ type: "user.message", content: input.content }],
    }),
  });
  await rememberSession(input, session.id);
  return session;
}

async function waitUntilIdle(sessionId: string, timeoutMs: number) {
  const end = Date.now() + timeoutMs;
  let session = await request<AgentSession>(`/sessions/${sessionId}`);
  while (session.status === "running" || session.status === "rescheduling") {
    if (Date.now() >= end) throw new Error("Managed Agent timed out");
    await sleep(WAIT_MS);
    session = await request<AgentSession>(`/sessions/${sessionId}`);
  }
  if (session.status !== "idle") throw new Error(`Managed Agent stopped with status ${session.status}`);
  return session;
}

/** One isolated turn through the configured Claude Managed Agent. */
export async function managedAgentTurn(input: ManagedAgentTurn): Promise<ManagedAgentResult> {
  if (!managedAgentConfigured()) throw new Error("Managed Agent is not configured");
  const contextKey = input.contextKey.trim().slice(0, 200);
  if (!contextKey) throw new Error("Managed Agent context key is missing");
  const normalized = { ...input, contextKey };
  let sessionId = await savedSession(input.userId, input.contextType, contextKey);
  let before: SessionUsage | null | undefined;
  let seen = new Set<string>();
  let session: AgentSession;

  if (sessionId) {
    try {
      session = await request<AgentSession>(`/sessions/${sessionId}`);
      if (session.status === "terminated") throw new Error("terminated");
      if (session.status !== "idle") throw new Error("Managed Agent session is busy");
      before = session.usage;
      seen = new Set((await events(sessionId)).map((event) => event.id));
      await request(`/sessions/${sessionId}/events`, {
        method: "POST",
        body: JSON.stringify({ events: [{ type: "user.message", content: input.content }] }),
      });
    } catch (error) {
      if (!/404|terminated/i.test(String(error))) throw error;
      await forgetSession(normalized);
      sessionId = null;
    }
  }

  if (!sessionId) {
    session = await createSession(normalized);
    sessionId = session.id;
    before = undefined;
  }

  const deadline = Date.now() + (input.timeoutMs ?? 110_000);
  // a session can read «idle» for a moment right after it was created or given a message, before the agent starts: so an
  // idle session that has said nothing yet is waited on again (until the deadline) instead of being taken as an empty answer
  let done = await waitUntilIdle(sessionId, Math.max(1000, deadline - Date.now()));
  let text = "";
  let seenTypes = "";
  for (;;) {
    const fresh = (await events(sessionId)).filter((event) => !seen.has(event.id));
    const failure = fresh.find((event) => event.type === "session.error");
    if (failure) throw new Error(failure.error?.message ?? "Managed Agent session failed");
    seenTypes = [...new Set(fresh.map((event) => event.type))].join(",");
    text = fresh
      .filter((event) => event.type === "agent.message")
      .flatMap((event) => event.content ?? [])
      .filter((block) => block.type === "text" && block.text)
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (text || Date.now() >= deadline) break;
    await sleep(1500);
    done = await waitUntilIdle(sessionId, Math.max(1000, deadline - Date.now()));
  }
  if (!text) throw new Error(`Managed Agent returned no text (${done.status}; ${seenTypes || "no events"})`);
  return { text, usd: usdDelta(before, done.usage), usage: usageDelta(before, done.usage), sessionId };
}

/** Accepts a plain JSON reply or one fenced in Markdown. */
export function managedJson<T>(text: string): T {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced ?? trimmed.slice(trimmed.indexOf("{"), trimmed.lastIndexOf("}") + 1);
  if (!candidate) throw new Error("Managed Agent did not return JSON");
  return JSON.parse(candidate) as T;
}
