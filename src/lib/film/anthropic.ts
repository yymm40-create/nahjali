// Claude Opus 5.5 for the film branch's three assistants. Server only: the key never reaches the browser.

import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";

export const CLAUDE_MODEL = "claude-opus-5-5";

/** USD per 1M tokens (platform.claude.com/docs/en/about-claude/pricing, checked 2026-10-02). */
const PRICE = { input: 4, cacheWrite5m: 5, cacheWrite1h: 8, cacheRead: 0.2, output: 20 };

export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number };
}

export function claudeCost(u: ClaudeUsage) {
  const w1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  const w5m = u.cache_creation?.ephemeral_5m_input_tokens ?? (u.cache_creation_input_tokens ?? 0) - w1h;
  return (
    (u.input_tokens * PRICE.input +
      w5m * PRICE.cacheWrite5m +
      w1h * PRICE.cacheWrite1h +
      (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead +
      u.output_tokens * PRICE.output) /
    1_000_000
  );
}

export const totalTokens = (u: ClaudeUsage) =>
  u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + u.output_tokens;

/**
 * The system prompt of every Claude call on the site: what JAWAD AI is (the same text everywhere, first, so it is
 * part of each call's cached prefix), then the task's own instructions, which take precedence.
 */
export const siteSystem = (task: string, cache = true) => [
  { type: "text", text: JAWAD_KNOWLEDGE },
  { type: "text", text: task, ...(cache ? { cache_control: { type: "ephemeral" } } : {}) },
];

export type ClaudePart = { type: "text"; text: string } | { type: "image"; url: string } | { type: "image64"; data: string; mediaType: "image/jpeg" | "image/png" };

export interface ClaudeTurn {
  role: "user" | "assistant";
  /** Plain text, or text + images (images are sent by short-lived URL so Claude can look at them). */
  content: string | ClaudePart[];
}

const toBlock = (p: ClaudePart) =>
  p.type === "text"
    ? { type: "text", text: p.text }
    : p.type === "image64"
      ? { type: "image", source: { type: "base64", media_type: p.mediaType, data: p.data } }
      : { type: "image", source: { type: "url", url: p.url } };

/**
 * One Messages API call with a cached system prompt and a JSON-schema reply.
 * The conversation prefix is cached too, so each next step re-reads it at the cheap cache rate.
 */
export async function callClaudeJson<T>({
  system,
  turns,
  schema,
  maxTokens,
  effort = "medium",
  fallback = false,
}: {
  system: string;
  turns: ClaudeTurn[];
  schema: object;
  maxTokens: number;
  effort?: "low" | "medium" | "high" | "xhigh";
  /** A request the safety checks decline is answered by Anthropic's recommended fallback model instead (server-side). */
  fallback?: boolean;
}): Promise<{ data: T; raw: string; usage: ClaudeUsage }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");

  const messages = turns.map((t, i) => {
    const blocks: Record<string, unknown>[] = (typeof t.content === "string" ? [{ type: "text", text: t.content } as ClaudePart] : t.content).map(toBlock);
    // Cache breakpoint on the latest turn: the next request reuses everything up to here
    if (i === turns.length - 1) blocks[blocks.length - 1] = { ...blocks[blocks.length - 1], cache_control: { type: "ephemeral" } };
    return { role: t.role, content: blocks };
  });

  // ANTHROPIC_BASE_URL only for a local test server; production talks to the API directly
  const res = await fetch(`${process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com"}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      ...(fallback ? { "anthropic-beta": "server-side-fallback-2026-07-01" } : {}),
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system: siteSystem(system),
      messages,
      output_config: { effort, format: { type: "json_schema", schema } },
      ...(fallback ? { fallbacks: "default" } : {}),
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Claude ${res.status}: ${body?.error?.message ?? "request failed"}`);
  if (body.stop_reason === "max_tokens") throw new Error("Claude reply was cut off (max_tokens)");
  if (body.stop_reason === "refusal") throw new Error("Claude declined this request");

  const raw = (body.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
  return { data: JSON.parse(raw) as T, raw, usage: body.usage as ClaudeUsage };
}

/**
 * A short piece of web research: Claude searches (Anthropic's server-side web search, a few searches at most) and
 * answers in plain text. `pause_turn` (a long search turn) is continued until the answer is complete.
 */
export async function callClaudeSearch({ system, prompt, maxUses = 4, maxTokens = 4000 }: { system: string; prompt: string; maxUses?: number; maxTokens?: number }): Promise<{ text: string; sources: string[]; usd: number }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const messages: { role: "user" | "assistant"; content: unknown }[] = [{ role: "user", content: prompt }];
  let usd = 0;
  for (let round = 0; round < 3; round++) {
    const res = await fetch(`${process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com"}/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        system: siteSystem(system, false),
        messages,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: maxUses }],
        output_config: { effort: "low" },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Claude ${res.status}: ${body?.error?.message ?? "request failed"}`);
    usd += claudeCost(body.usage as ClaudeUsage) + (Number(body.usage?.server_tool_use?.web_search_requests) || 0) * 0.01;
    if (body.stop_reason === "refusal") throw new Error("Claude declined this request");
    if (body.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: body.content });
      continue;
    }
    const blocks = (body.content ?? []) as { type: string; text?: string; content?: unknown; citations?: { url?: string }[] }[];
    const text = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("").trim();
    const cited = blocks.flatMap((b) => (b.type === "text" ? (b.citations ?? []).map((c) => c.url ?? "") : []));
    const found = blocks.flatMap((b) => (b.type === "web_search_tool_result" && Array.isArray(b.content) ? (b.content as { url?: string }[]).map((r) => r.url ?? "") : []));
    return { text, sources: [...new Set([...cited, ...found].filter(Boolean))].slice(0, 6), usd };
  }
  throw new Error("Claude search did not finish");
}

/** A Claude failure the person should hear about as it is (the account's credit ran out, the API is overloaded). */
export function claudeTrouble(e: unknown): string | null {
  const m = e instanceof Error ? e.message : String(e);
  if (/credit balance is too low/i.test(m)) return "رصيد Claude (Anthropic) عند المنصة خلص، فما قدر Claude يشتغل. صاحب المنصة لازم يشحن رصيد Anthropic.";
  if (/Claude (429|529)|overloaded|rate.?limit/i.test(m)) return "Claude مشغول الحين؛ جرّب بعد دقيقة.";
  return null;
}
