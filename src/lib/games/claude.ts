// «صانع الألعاب الذكي» — one conversation turn with Claude (plain text, not JSON): the system text, the turns so far,
// the answer and what it cost. Server only.

import { claudeCost, siteSystem, withModel, type ClaudeUsage } from "@/lib/film/anthropic";
import { currentClaude } from "@/lib/film/claude-model";

export interface Turn {
  role: "user" | "assistant";
  text: string;
}

export interface Said {
  text: string;
  usd: number;
}

/**
 * The reply read as it is written (server-sent events), for a long one: the connection's headers come at once, so a reply that
 * takes many minutes (a whole game's code) is not cut by the HTTP client's own wait for them. Returns what talk returns.
 */
export async function readStream(res: Response): Promise<{ text: string; usage: ClaudeUsage; model: unknown; stop: string }> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  let model: unknown = null;
  let stop = "";
  const usage: ClaudeUsage = { input_tokens: 0, output_tokens: 0 };
  const take = (data: string) => {
    let e: Record<string, unknown>;
    try {
      e = JSON.parse(data) as Record<string, unknown>;
    } catch {
      return;
    }
    if (e.type === "message_start") {
      const m = (e.message ?? {}) as { model?: unknown; usage?: Partial<ClaudeUsage> };
      model = m.model;
      Object.assign(usage, m.usage ?? {});
    } else if (e.type === "content_block_delta") {
      const d = (e.delta ?? {}) as { type?: string; text?: string };
      if (d.type === "text_delta" && d.text) text += d.text;
    } else if (e.type === "message_delta") {
      const d = (e.delta ?? {}) as { stop_reason?: string };
      if (d.stop_reason) stop = d.stop_reason;
      const u = (e.usage ?? {}) as Partial<ClaudeUsage>;
      for (const [k, v] of Object.entries(u)) if (typeof v === "number" && v > 0) (usage as unknown as Record<string, number>)[k] = v;
    } else if (e.type === "error") {
      throw new Error(`Claude stream: ${(e.error as { message?: string } | undefined)?.message ?? "error"}`);
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buf += dec.decode(value, { stream: true });
    let cut: number;
    while ((cut = buf.indexOf("\n\n")) >= 0) {
      const event = buf.slice(0, cut);
      buf = buf.slice(cut + 2);
      const data = event
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (data) take(data);
    }
    if (done) break;
  }
  return { text: text.trim(), usage, model, stop };
}

/**
 * The persona answers: `system` is its whole instruction (the site's own knowledge goes first, see siteSystem). `stream`: read
 * the reply as it is written (for a long one, see readStream).
 */
export async function talk(o: { system: string; turns: Turn[]; maxTokens: number; effort?: "low" | "medium" | "high"; timeoutMs?: number; leader?: boolean; stream?: boolean }): Promise<Said> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const asked = currentClaude();
  const messages = o.turns.map((t, i) => ({
    role: t.role,
    // the last turn carries the cache mark: the next message reuses everything before it
    content: [{ type: "text", text: t.text, ...(i === o.turns.length - 1 ? { cache_control: { type: "ephemeral" } } : {}) }],
  }));
  const res = await fetch(`${process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com"}/v1/messages`, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: asked.id, max_tokens: o.maxTokens, system: siteSystem(o.system, true, o.leader), messages, ...(asked.effort ? { output_config: { effort: o.effort ?? "medium" } } : {}), ...(o.stream ? { stream: true } : {}) }),
    signal: AbortSignal.timeout(o.timeoutMs ?? 170_000),
  });
  if (o.stream && res.ok && res.body) {
    const r = await readStream(res);
    if (r.stop === "refusal") throw new Error("Claude declined this request");
    if (!r.text) throw new Error("Claude gave an empty answer");
    return { text: r.text, usd: claudeCost(withModel(r.usage, r.model, asked)) };
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Claude ${res.status}: ${body?.error?.message ?? "request failed"}`);
  if (body.stop_reason === "refusal") throw new Error("Claude declined this request");
  const text = (body.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("").trim();
  if (!text) throw new Error("Claude gave an empty answer");
  return { text, usd: claudeCost(withModel(body.usage as ClaudeUsage, body.model, asked)) };
}
