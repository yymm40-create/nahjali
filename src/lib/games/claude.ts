// «صانع الألعاب الذكي» — one conversation turn with Claude (plain text, not JSON): the system text, the turns so far,
// the answer and what it cost. Server only.

import { CLAUDE_MODEL, claudeCost, siteSystem, type ClaudeUsage } from "@/lib/film/anthropic";

export interface Turn {
  role: "user" | "assistant";
  text: string;
}

export interface Said {
  text: string;
  usd: number;
}

/** The persona answers: `system` is its whole instruction (the site's own knowledge goes first, see siteSystem). */
export async function talk(o: { system: string; turns: Turn[]; maxTokens: number; effort?: "low" | "medium" | "high"; timeoutMs?: number; leader?: boolean }): Promise<Said> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const messages = o.turns.map((t, i) => ({
    role: t.role,
    // the last turn carries the cache mark: the next message reuses everything before it
    content: [{ type: "text", text: t.text, ...(i === o.turns.length - 1 ? { cache_control: { type: "ephemeral" } } : {}) }],
  }));
  const res = await fetch(`${process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com"}/v1/messages`, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: o.maxTokens, system: siteSystem(o.system, true, o.leader), messages, output_config: { effort: o.effort ?? "medium" } }),
    signal: AbortSignal.timeout(o.timeoutMs ?? 170_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Claude ${res.status}: ${body?.error?.message ?? "request failed"}`);
  if (body.stop_reason === "refusal") throw new Error("Claude declined this request");
  const text = (body.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("").trim();
  if (!text) throw new Error("Claude gave an empty answer");
  return { text, usd: claudeCost(body.usage as ClaudeUsage) };
}
