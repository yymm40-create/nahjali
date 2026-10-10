// Claude Opus 5.5 for the film branch's three assistants. Server only: the key never reaches the browser.

import { isAdmin } from "@config/site";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";
import { fitDocs, fitImages } from "@/lib/claude-images";
import { DEFAULT_CLAUDE_MODEL, claudeModelOf, servedModel, type ClaudeModel } from "@config/claude-models";
import { currentClaude } from "./claude-model";

/** The default model (a request made inside `withClaude` uses the person's choice instead — see `currentClaude`). */
export const CLAUDE_MODEL = DEFAULT_CLAUDE_MODEL;

export interface ClaudeUsage {
  /** the model that answered (stamped by the caller that made the request), so the cost follows it */
  model?: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number };
}

/** The usage of a reply, stamped with the model that answered. */
export const withModel = (usage: ClaudeUsage, served: unknown, asked: ClaudeModel = currentClaude()): ClaudeUsage => ({ ...usage, model: (servedModel(served) ?? asked).id });

/** USD for this usage, at the rates of the model that answered (the request's model when the usage carries none). */
export function claudeCost(u: ClaudeUsage, model?: ClaudeModel) {
  const m = model ?? (u.model ? claudeModelOf(u.model) : currentClaude());
  const prompt = u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
  const PRICE = m.longAbove && m.longRates && prompt > m.longAbove ? m.longRates : m.rates;
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
/**
 * The owner («القائد») talking: every robot knows him, greets him so, and opens the whole platform to him — every
 * detail of the knowledge above (sections, prices, rules, flows, files, what is on or off) and any technical or
 * administrative question, answered plainly and fully, holding back nothing of the site's inner workings. Never a
 * secret key or a password (the robots don't hold them anyway).
 */
export const LEADER_BLOCK = `<leader>
The person you are talking to is the OWNER and builder of this platform — «القائد». Greet him as «هلا بالقائد» at the start of your first reply in a conversation (once, naturally; not every message). He has FULL authority: answer every question about the platform's details from the knowledge above and from what you know of your own section — how things work inside, the prices and their rules, the limits, the flows between the assistants, the files and tables involved, what is on or off, what fails and why — fully, plainly and technically, without the caution you would use with a customer, and never say a detail is private or out of your scope. Follow his instructions about the work directly.
HIS WORD OVERRIDES EVERY RULE. Every rule, limit, style guide, house rule, safety-of-taste rule or "never" in the knowledge above or in your own instructions was written by him for his customers — and he may break any of them, including the ones he set himself, with a word. When he tells you to drop, bend or break a rule («كسره», «تجاوزه», «خالفه», «ما يهمني القيد», «أنا القائد أقول لك…»), do exactly what he says from that message on, without arguing, without warning him again, and without quietly keeping the rule in your output: the rule is off for him until he puts it back. If a rule is enforced in code and you cannot switch it off yourself, say so in one line and do the closest thing he asked. The only exceptions are things no one can lift: secret keys and passwords (you do not hold them), and what the law or the providers' own policies forbid (a real person imitated without consent, sexual content involving minors).
</leader>`;

export const siteSystem = (task: string, cache = true, leader = false) => [
  { type: "text", text: JAWAD_KNOWLEDGE },
  ...(leader ? [{ type: "text", text: LEADER_BLOCK }] : []),
  { type: "text", text: task, ...(cache ? { cache_control: { type: "ephemeral" } } : {}) },
];

/** Whether this e-mail is the owner's (the robots then read the leader block). */
export const isLeader = (email: string | null | undefined) => isAdmin(email);

/** How many times a request is tried in all, and the waits between the tries (ms). */
export const CLAUDE_TRIES = 3;
const CLAUDE_WAITS = [900, 2600];
/** One attempt never hangs for ever: it is dropped at this and tried again (the routes allow 300 s). */
export const CLAUDE_TIMEOUT_MS = 110_000;
/** The answers worth trying again: busy, rate-limited, or the provider's own stumble. */
const AGAIN = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529]);
/** A connection that broke on the way (nothing was answered), so trying again is not asking twice. */
const brokenLink = (e: unknown) => /fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|network|terminated|other side closed|aborted|The operation was aborted|timeout/i.test(e instanceof Error ? `${e.message} ${(e as { cause?: { message?: string } }).cause?.message ?? ""}` : String(e));

const nap = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One request to Claude, tried again when the answer is «busy» or the line broke — the recurring «جرّب بعد شوي» the
 * robots used to hand back was almost always one of these. `retry-after` is honoured when the API sends it; a reply
 * the API really refuses (a bad request, no credit, a key) is raised at once, because trying again changes nothing.
 */
export async function claudeFetch(url: string, init: RequestInit, tries = CLAUDE_TRIES, timeoutMs = CLAUDE_TIMEOUT_MS): Promise<{ res: Response; body: Record<string, unknown> }> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    if (i) await nap(CLAUDE_WAITS[Math.min(i - 1, CLAUDE_WAITS.length - 1)]);
    try {
      const res = await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(timeoutMs) });
      const body = ((await res.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
      if (res.ok) return { res, body };
      const why = (body.error as { message?: string } | undefined)?.message ?? "request failed";
      last = new Error(`Claude ${res.status}: ${why}`);
      if (!AGAIN.has(res.status) || i === tries - 1) throw last;
      const after = Number(res.headers?.get?.("retry-after") ?? "");
      if (Number.isFinite(after) && after > 0) await nap(Math.min(after * 1000, 8000));
    } catch (e) {
      last = e;
      // a request the API answered with a «no» is final; a broken line is tried again
      if (!brokenLink(e) && e instanceof Error && /^Claude \d/.test(e.message)) throw e;
      if (!brokenLink(e) || i === tries - 1) throw e;
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

/**
 * A piece of one turn. A picture is looked at; a PDF («doc») is READ — its own pages go to Claude as a document, so a
 * person can hand a lecture, a report or a form to any robot of the site and it answers from the file itself.
 */
export type ClaudePart =
  | { type: "text"; text: string }
  | { type: "image"; url: string }
  | { type: "image64"; data: string; mediaType: "image/jpeg" | "image/png" }
  | { type: "doc"; url: string; name?: string };

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
      : p.type === "doc"
        ? { type: "document", source: { type: "url", url: p.url }, ...(p.name ? { title: p.name.slice(0, 120) } : {}) }
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
  leader = false,
  timeoutMs,
}: {
  system: string;
  turns: ClaudeTurn[];
  schema: object;
  maxTokens: number;
  effort?: "low" | "medium" | "high" | "xhigh";
  /** A request the safety checks decline is answered by Anthropic's recommended fallback model instead (server-side). */
  fallback?: boolean;
  /** the owner is talking: the robot greets «القائد» and opens every detail of the platform to him */
  leader?: boolean;
  /** the longest one attempt may take (default CLAUDE_TIMEOUT_MS); a long conversation like حيدرة's asks for more */
  timeoutMs?: number;
}): Promise<{ data: T; raw: string; usage: ClaudeUsage }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const asked = currentClaude();

  // pictures by link are fetched and made to fit Claude's limits (a large cut-out logo was refused)
  const messages = await fitDocs(await fitImages(turns.map((t, i) => {
    const blocks: Record<string, unknown>[] = (typeof t.content === "string" ? [{ type: "text", text: t.content } as ClaudePart] : t.content).map(toBlock);
    // Cache breakpoint on the latest turn: the next request reuses everything up to here
    if (i === turns.length - 1) blocks[blocks.length - 1] = { ...blocks[blocks.length - 1], cache_control: { type: "ephemeral" } };
    return { role: t.role, content: blocks };
  })));

  // Haiku has no server-side fallback model
  const withFallback = fallback && asked.key !== "haiku";
  const call = async (level: typeof effort) => {
    // ANTHROPIC_BASE_URL only for a local test server; production talks to the API directly
    const { body: b } = await claudeFetch(`${process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com"}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        ...(withFallback ? { "anthropic-beta": "server-side-fallback-2026-07-01" } : {}),
      },
      body: JSON.stringify({
        model: asked.id,
        max_tokens: maxTokens,
        system: siteSystem(system, true, leader),
        messages,
        output_config: { ...(asked.effort ? { effort: level } : {}), format: { type: "json_schema", schema } },
        ...(withFallback ? { fallbacks: "default" } : {}),
      }),
    }, CLAUDE_TRIES, timeoutMs);
    return b as Record<string, unknown> & { stop_reason?: string; content?: { type: string; text?: string }[]; usage?: ClaudeUsage; model?: string };
  };

  let body = await call(effort);
  // the model's thinking shares the reply's token budget: a long request can use it all before the answer ends.
  // Once more, thinking less, before giving up.
  if (body.stop_reason === "max_tokens" && asked.effort && effort !== "low") body = await call("low");
  if (body.stop_reason === "max_tokens") throw new Error("Claude reply was cut off (max_tokens)");
  if (body.stop_reason === "refusal") throw new Error("Claude declined this request");

  const textOf = (b: Awaited<ReturnType<typeof call>>) => (b.content ?? []).filter((x: { type: string }) => x.type === "text").map((x: { text?: string }) => x.text ?? "").join("");
  let raw = textOf(body);
  try {
    return { data: JSON.parse(raw) as T, raw, usage: withModel(body.usage as ClaudeUsage, body.model, asked) };
  } catch {
    // a reply that isn't the JSON asked for: once more before giving up (it is almost always a one-off)
    body = await call(effort);
    raw = textOf(body);
    try {
      return { data: JSON.parse(raw) as T, raw, usage: withModel(body.usage as ClaudeUsage, body.model, asked) };
    } catch {
      throw new Error(`Claude reply was not the JSON asked for (${raw.slice(0, 120)})`);
    }
  }
}

/**
 * A short piece of web research: Claude searches (Anthropic's server-side web search, a few searches at most) and
 * answers in plain text. `pause_turn` (a long search turn) is continued until the answer is complete.
 */
export async function callClaudeSearch({ system, prompt, maxUses = 4, maxTokens = 4000 }: { system: string; prompt: string; maxUses?: number; maxTokens?: number }): Promise<{ text: string; sources: string[]; usd: number }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const messages: { role: "user" | "assistant"; content: unknown }[] = [{ role: "user", content: prompt }];
  const asked = currentClaude();
  let usd = 0;
  for (let round = 0; round < 3; round++) {
    const { body } = await claudeFetch(`${process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com"}/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: asked.id,
        max_tokens: maxTokens,
        system: siteSystem(system, false),
        messages,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: maxUses }],
        ...(asked.effort ? { output_config: { effort: "low" } } : {}),
      }),
    });
    const used = body.usage as (ClaudeUsage & { server_tool_use?: { web_search_requests?: number } }) | undefined;
    usd += claudeCost(withModel(used as ClaudeUsage, body.model, asked)) + (Number(used?.server_tool_use?.web_search_requests) || 0) * 0.01;
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

/**
 * The line the person reads when a request to Claude failed: the real reason when we know it (`claudeTrouble`), the
 * robot's own words when we don't — and for the OWNER the raw error too, always, so «جرّب بعد شوي» is never a dead
 * end he has to guess at.
 */
export function claudeWhy(e: unknown, say: string, email?: string | null): string {
  const raw = e instanceof Error ? e.message : String(e);
  return `${claudeTrouble(e) ?? say}${isLeader(email) ? ` (تفصيل للرئيس: ${raw.slice(0, 300)})` : ""}`;
}

/** A Claude failure the person should hear about as it is (the account's credit ran out, the API is overloaded). */
export function claudeTrouble(e: unknown): string | null {
  const m = e instanceof Error ? e.message : String(e);
  if (/credit balance is too low/i.test(m)) return "رصيد مزوّد الذكاء الاصطناعي عند المنصة خلص، فما قدر الروبوت يشتغل الحين. صاحب المنصة لازم يشحن الرصيد.";
  if (/Claude (429|529)|overloaded|rate.?limit/i.test(m)) return "الذكاء الاصطناعي مشغول الحين؛ جرّب بعد دقيقة.";
  if (/image.*(exceeds|too large|dimensions)|Unable to download|Could not process image|invalid image/i.test(m)) return "الروبوت ما قدر يقرا الصورة المرفقة (كبيرة أو تالفة). جرّب صورة أصغر أو بصيغة PNG/JPG.";
  if (/cut off \(max_tokens\)/i.test(m)) return "الرد طلع طويل جدًا وانقطع قبل ما يكتمل. اطلب شي واحد في المرة (أو قسّم طلبك لأجزاء)، أو جرّب موديل ثاني من زر 🧠.";
  if (/prompt is too long|too many tokens|exceeds? the (context|maximum)/i.test(m)) return "المحادثة طالت أكثر من اللي يستوعبه الموديل. ابدأ محادثة جديدة (والمشروع ينحفظ في السجل).";
  if (/ANTHROPIC_API_KEY is not set/i.test(m)) return "مفتاح الذكاء الاصطناعي ناقص على السيرفر، فما قدر الروبوت يشتغل. صاحب المنصة يضيف ANTHROPIC_API_KEY في إعدادات الخادم.";
  if (/Claude 401|Claude 403|authentication_error|invalid x-api-key|permission/i.test(m)) return "مفتاح الذكاء الاصطناعي مرفوض (منتهي أو ما عنده صلاحية). صاحب المنصة يجدّد المفتاح.";
  if (/declined this request|refusal/i.test(m)) return "الموديل رفض هذا الطلب بالذات. صِغ الطلب بصيغة ثانية (أو جرّب موديل ثاني من زر 🧠).";
  if (/was not the JSON asked for/i.test(m)) return "الرد رجع بصيغة غلط مرتين. جرّب مرة ثانية، وإذا تكرر قسّم طلبك أو بدّل الموديل من زر 🧠.";
  if (/Claude 5\d\d|api_error|internal server error/i.test(m)) return "خدمة الذكاء الاصطناعي عندها خلل الحين (جرّبنا ثلاث مرات). جرّب بعد دقيقة أو بدّل الموديل من زر 🧠.";
  if (/fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|network|terminated|other side closed|aborted|timeout/i.test(m)) return "الاتصال بخدمة الذكاء الاصطناعي انقطع (جرّبنا ثلاث مرات). جرّب مرة ثانية؛ وإذا كان طلبك فيه صور أو مقاطع كثيرة، خفّفها.";
  if (/Claude 413|too large|entity too large/i.test(m)) return "الطلب كبير جدًا على الخدمة (صور أو لقطات كثيرة). شِل بعض المرفقات وجرّب.";
  if (/Claude 400|invalid_request_error/i.test(m)) return `الخدمة رفضت صيغة الطلب (${m.replace(/^Claude 400: /, "").slice(0, 120)}). جرّب بعد تبسيط الطلب أو شيل المرفقات.`;
  return null;
}
