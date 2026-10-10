// «صانع الألعاب الذكي» — one conversation turn with Claude (plain text, not JSON): the system text, the turns so far,
// the answer and what it cost. Server only.

import { AGAIN, brokenLink, claudeCost, nap, siteSystem, withModel, type ClaudeUsage } from "@/lib/film/anthropic";
import { currentClaude } from "@/lib/film/claude-model";

export interface Turn {
  role: "user" | "assistant";
  text: string;
}

export interface Said {
  text: string;
  usd: number;
  /** why the reply ended: "end_turn"; "max_tokens" (it ran out of length); "cut" (the line broke or the wait ran out after
   * much of it was written, see `keepPartial`) */
  stop: string;
}

/** A reply cut off after at least this much text is kept (`keepPartial`): the rest can be asked for, instead of all of it again. */
export const PARTIAL_MIN = 4000;

/** A failure worth trying again (the service busy or failing for a moment, the line broken) — not a «no» to this request. */
export const passing = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  const status = /^Claude (\d{3})\b/.exec(m)?.[1];
  if (status) return AGAIN.has(Number(status));
  return brokenLink(e) || /overloaded|api_error|internal server error|stream: error/i.test(m);
};

/**
 * The reply read as it is written (server-sent events), for a long one: the connection's headers come at once, so a reply that
 * takes many minutes (a whole game's code) is not cut by the HTTP client's own wait for them. Returns what talk returns.
 */
export async function readStream(res: Response, keepPartial = false): Promise<{ text: string; usage: ClaudeUsage; model: unknown; stop: string }> {
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
  try {
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
  } catch (e) {
    // cut off in the middle (the line, the wait, the service): what was written is kept when it is worth continuing from;
    // its output is counted from its length (the reply's own count never came)
    if (!keepPartial || text.length < PARTIAL_MIN) throw e;
    usage.output_tokens = Math.max(usage.output_tokens, Math.ceil(text.length / 3));
    return { text, usage, model, stop: "cut" };
  }
  // a stream that ended without its last event was cut too
  if (!stop && keepPartial && text.length >= PARTIAL_MIN) {
    usage.output_tokens = Math.max(usage.output_tokens, Math.ceil(text.length / 3));
    return { text, usage, model, stop: "cut" };
  }
  return { text: stop === "max_tokens" ? text : text.trim(), usage, model, stop };
}

/**
 * The persona answers: `system` is its whole instruction (the site's own knowledge goes first, see siteSystem). `stream`: read
 * the reply as it is written (for a long one, see readStream); `keepPartial`: a long reply cut off is returned as far as it got
 * (stop "cut") instead of failing. A passing failure (the service busy, the line broken) is tried again, up to three times
 * within `timeoutMs`.
 */
export async function talk(o: { system: string; turns: Turn[]; maxTokens: number; effort?: "low" | "medium" | "high"; timeoutMs?: number; leader?: boolean; stream?: boolean; keepPartial?: boolean }): Promise<Said> {
  const deadline = Date.now() + (o.timeoutMs ?? 170_000);
  for (let i = 0; ; i++) {
    try {
      return await talkOnce(o, deadline - Date.now());
    } catch (e) {
      const left = deadline - Date.now();
      if (i >= 2 || !passing(e) || left < 45_000) throw e;
      console.warn("claude talk: trying again", e instanceof Error ? e.message : e);
      await nap(i ? 6000 : 2000);
    }
  }
}

async function talkOnce(o: Parameters<typeof talk>[0], wait: number): Promise<Said> {
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
    signal: AbortSignal.timeout(Math.max(wait, 1000)),
  });
  if (o.stream && res.ok && res.body) {
    const r = await readStream(res, o.keepPartial);
    if (r.stop === "refusal") throw new Error("Claude declined this request");
    if (!r.text.trim()) throw new Error("Claude gave an empty answer");
    return { text: r.text, usd: claudeCost(withModel(r.usage, r.model, asked)), stop: r.stop };
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Claude ${res.status}: ${body?.error?.message ?? "request failed"}`);
  if (body.stop_reason === "refusal") throw new Error("Claude declined this request");
  const text = (body.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("").trim();
  if (!text) throw new Error("Claude gave an empty answer");
  return { text, usd: claudeCost(withModel(body.usage as ClaudeUsage, body.model, asked)), stop: String(body.stop_reason ?? "") };
}
