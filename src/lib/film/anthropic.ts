// Claude Opus 5.5 for the film branch's three assistants. Server only: the key never reaches the browser.

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

export type ClaudePart = { type: "text"; text: string } | { type: "image"; url: string };

export interface ClaudeTurn {
  role: "user" | "assistant";
  /** Plain text, or text + images (images are sent by short-lived URL so Claude can look at them). */
  content: string | ClaudePart[];
}

const toBlock = (p: ClaudePart) =>
  p.type === "text" ? { type: "text", text: p.text } : { type: "image", source: { type: "url", url: p.url } };

/**
 * One Messages API call with a cached system prompt and a JSON-schema reply.
 * The conversation prefix is cached too, so each next step re-reads it at the cheap cache rate.
 */
export async function callClaudeJson<T>({
  system,
  turns,
  schema,
  maxTokens,
}: {
  system: string;
  turns: ClaudeTurn[];
  schema: object;
  maxTokens: number;
}): Promise<{ data: T; raw: string; usage: ClaudeUsage }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");

  const messages = turns.map((t, i) => {
    const blocks: Record<string, unknown>[] = (typeof t.content === "string" ? [{ type: "text", text: t.content } as ClaudePart] : t.content).map(toBlock);
    // Cache breakpoint on the latest turn: the next request reuses everything up to here
    if (i === turns.length - 1) blocks[blocks.length - 1] = { ...blocks[blocks.length - 1], cache_control: { type: "ephemeral" } };
    return { role: t.role, content: blocks };
  });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages,
      output_config: { effort: "medium", format: { type: "json_schema", schema } },
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Claude ${res.status}: ${body?.error?.message ?? "request failed"}`);
  if (body.stop_reason === "max_tokens") throw new Error("Claude reply was cut off (max_tokens)");
  if (body.stop_reason === "refusal") throw new Error("Claude declined this request");

  const raw = (body.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
  return { data: JSON.parse(raw) as T, raw, usage: body.usage as ClaudeUsage };
}
