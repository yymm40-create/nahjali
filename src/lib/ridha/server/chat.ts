// «الرضا ماكس» — one message to him. The project lives on the person's device, so the page sends what he needs with
// each message: the studio written out as text (with the selected clip's measurements) and the last turns of the
// conversation. His answer is a reply, commands for the studio (checked and applied on the page) and next steps.
// Nothing is stored on the server. Server only.

import { UserError } from "@/lib/api";
import { callClaudeJson, claudeCost, isLeader, type ClaudeTurn } from "@/lib/film/anthropic";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { RIDHA_MAX, RIDHA_MAX_SCHEMA, RIDHA_MAX_SYSTEM } from "@config/ridha-max";
import { isAdmin } from "@config/site";

/** The branch is the owner's until he turns its section on; then everyone the platform lets in. */
export async function requireRidha(email: string | null | undefined) {
  if (isAdmin(email)) return;
  const rt = await loadRuntime();
  if (!rt.sections.some((s) => s.implementation === "ridha" && s.enabled)) throw new UserError("«الرضا فويس» مقفل لحسابك حاليًا.", 403);
}

interface Answer {
  reply: string;
  actions: string[];
  suggestions: string[];
}

export interface Said {
  reply: string;
  actions: string[];
  suggestions: string[];
  usd: number;
}

export async function say(email: string | null, b: { message?: unknown; state?: unknown; turns?: unknown }): Promise<Said> {
  const message = String(b.message ?? "").trim();
  if (!message) throw new UserError("اكتب رسالتك.");
  if (message.length > RIDHA_MAX.messageMax) throw new UserError(`الرسالة أطول من ${RIDHA_MAX.messageMax} حرف.`);
  if (!process.env.ANTHROPIC_API_KEY) throw new UserError("الرضا ماكس غير مفعّل على الخادم.", 503);
  const state = String(b.state ?? "").slice(0, RIDHA_MAX.stateMax);
  // the conversation so far, as the page kept it: only plain turns, the last few
  const history: ClaudeTurn[] = (Array.isArray(b.turns) ? b.turns : [])
    .filter((t): t is { role: "user" | "assistant"; text: string } => !!t && typeof t === "object" && ((t as { role?: unknown }).role === "user" || (t as { role?: unknown }).role === "assistant") && typeof (t as { text?: unknown }).text === "string")
    .slice(-RIDHA_MAX.historyTurns)
    .map((t) => ({ role: t.role, content: t.text.slice(0, 4000) }));
  const r = await callClaudeJson<Answer>({
    system: RIDHA_MAX_SYSTEM,
    turns: [...history, { role: "user", content: `<studio>\n${state}\n</studio>\n\nرسالة الشخص:\n${message}` }],
    schema: RIDHA_MAX_SCHEMA,
    maxTokens: RIDHA_MAX.maxTokens,
    effort: "medium",
    leader: isLeader(email),
  });
  const a = r.data;
  return {
    reply: String(a.reply ?? "").trim() || "…",
    actions: (Array.isArray(a.actions) ? a.actions : []).map((x) => String(x)).slice(0, 24),
    suggestions: (Array.isArray(a.suggestions) ? a.suggestions : []).map((s) => String(s).trim().slice(0, 80)).filter(Boolean).slice(0, 3),
    usd: claudeCost(r.usage),
  };
}
