// «المشخّص» — the owner's 🐞 button, now able to find out WHY by itself. He describes a problem or asks «ليش ما تقدر
// تسوي كذا؟»; Claude gets what the browser recorded, what the server knows (services, missing tables and columns,
// failed jobs, charging settings, the person's access if an e-mail is mentioned) and then looks inside the site's own
// code — lists folders, searches, reads — for as many rounds as it needs. It answers in Gulf Arabic (the cause, how sure,
// what is missing or in conflict, what to try) and writes a complete message in English for the developer (Claude Code)
// that he copies and sends. Server only; owner only; never a secret.

import { UserError } from "@/lib/api";
import { callClaudeJson, claudeCost, claudeTrouble, type ClaudeTurn } from "@/lib/film/anthropic";
import { listDir, readCode, searchCode, MAX_READ_LINES } from "./code";
import { EMAIL, platformState } from "./state";

export const MAX_ROUNDS = 6;
const RESULT_CHARS = 36_000;

export interface DiagnoseTurn {
  role: "user" | "assistant";
  text: string;
}

interface Step {
  /** nothing more to look at: answer now */
  done: boolean;
  lists: string[];
  searches: { query: string; in?: string }[];
  reads: { path: string; from?: number; to?: number }[];
  reply: string;
  developerMessage: string;
  missing: string[];
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["done", "lists", "searches", "reads", "reply", "developerMessage", "missing"],
  properties: {
    done: { type: "boolean", description: "true when you have enough evidence and are giving the final answer in reply/developerMessage; false to look at more code first (fill lists/searches/reads)." },
    lists: { type: "array", items: { type: "string" }, description: "Folders to list (one level), e.g. \"src/lib/content\". Empty when not needed." },
    searches: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["query", "in"], properties: { query: { type: "string", description: "Text to find (not case-sensitive), or /regex/." }, in: { type: "string", description: "Only paths containing this (\"\" for everywhere)." } } },
      description: "Searches in the site's code (max 4 per round).",
    },
    reads: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["path", "from", "to"], properties: { path: { type: "string" }, from: { type: "integer" }, to: { type: "integer" } } },
      description: `Files to read, with a line range (max ${MAX_READ_LINES} lines each; max 4 per round).`,
    },
    reply: { type: "string", description: "FINAL answer to the owner in Gulf Arabic (empty while done=false): what happened; the cause, and how sure you are; what is missing or in conflict (name the file and the line); what he can do now; and what to send you if you cannot tell." },
    developerMessage: { type: "string", description: "FINAL message in English for the developer (Claude Code) to fix it without asking anything: the symptom, the exact evidence (log lines, statuses, numbers), the cause, the file paths and line numbers, the proposed change, and how to verify. Empty while done=false, or when nothing needs fixing." },
    missing: { type: "array", items: { type: "string" }, description: "FINAL: what the owner must send or do (a screenshot, an e-mail, the text of an error, a migration to run, a key to set) — short Arabic items. Empty when nothing." },
  },
};

const SYSTEM = `You are the site's DIAGNOSTICIAN, talking to its owner («القائد») who builds it with a developer (Claude Code). He describes something that went wrong or asks "why can't you do X?" or "why can't this person use Y?", in Gulf Arabic, often loosely. Your job is to find out WHY, by yourself, and to explain it so he can act on it or copy your developer message and send it on.

You are given: his words; the conversation so far; the browser report (the page he was on, the errors, rejected promises and failed requests with the server's words); and the SERVER STATE (which services are set up — yes/no, never the values; which database tables and columns the migrations expect but the database does NOT have, each with the migration file to run; the latest failed generations with their error; the charging settings; and the access, wallet and plan of any person whose e-mail he mentioned). The platform's knowledge text (above) says how everything is meant to work.

You can LOOK INSIDE THE SITE'S CODE: list a folder, search for a word or /regex/, and read lines of a file. Use it. A missing capability is usually one of these: a feature that is not built or not wired to this robot/section; a permission («السماح»/a code/«بلا حدود») or a switch that is off; a price missing or charging with an empty wallet; a database migration not run (see databaseMissing: name the exact file); a service key not set (see services); a rule in the code that forbids it on purpose (quote the rule: file and line); two rules that conflict; a limit (size, length, count); a provider error. Search for the exact Arabic message he saw, the route in the failed request, the name of the section — then read the code around it and follow the call chain until you know. Work in rounds (at most ${MAX_ROUNDS}): each round, ask for what you need (lists, searches, reads) with done=false; when you know, set done=true and give the final answer. Do not guess when a search can settle it; if after looking you still cannot tell, say exactly what is missing and what he should send (a screenshot, the e-mail, the exact text of the error) — in "missing".

Rules: facts only — quote the line, the status, the number; separate what you SAW from what you GUESS and say how sure you are. Never ask for or reveal a secret key or password (you never see any; the code has none). The site's rule holds: no real women in generated pictures. You only read; you change nothing. Be brief and practical in the Arabic reply (a short paragraph and a few bullets, no headers). The developer message is complete English with file paths and line numbers, so the developer needs nothing else.`;

const cut = (v: unknown, n: number) => {
  const s = typeof v === "string" ? v : JSON.stringify(v ?? null);
  return s.length > n ? `${s.slice(0, n)}…[cut]` : s;
};

/** One round's requests, run against the code; the results as the text of the next user turn. */
export async function runLooks(step: Pick<Step, "lists" | "searches" | "reads">): Promise<{ text: string; looked: string[] }> {
  const parts: string[] = [];
  const looked: string[] = [];
  for (const p of (step.lists ?? []).slice(0, 4)) {
    const entries = await listDir(p);
    looked.push(`📁 ${p || "/"}`);
    parts.push(`LIST ${p || "/"}:\n${entries.length ? entries.join("\n") : "(nothing, or not allowed)"}`);
  }
  for (const s of (step.searches ?? []).slice(0, 4)) {
    const hits = await searchCode(s.query, { in: s.in || undefined });
    looked.push(`🔎 ${s.query}${s.in ? ` في ${s.in}` : ""}`);
    parts.push(`SEARCH "${s.query}"${s.in ? ` in ${s.in}` : ""} (${hits.length} lines):\n${hits.length ? hits.map((h) => `${h.path}:${h.line}: ${h.text}`).join("\n") : "(no match)"}`);
  }
  for (const r of (step.reads ?? []).slice(0, 4)) {
    const f = await readCode(r.path, r.from, r.to);
    if ("error" in f) {
      parts.push(`READ ${r.path}: ${f.error}`);
    } else {
      looked.push(`📄 ${f.path}:${f.from}-${f.to}`);
      parts.push(`READ ${f.path} lines ${f.from}-${f.to} of ${f.total}:\n${f.text}`);
    }
  }
  return { text: cut(parts.join("\n\n"), RESULT_CHARS) || "(you asked for nothing; answer now)", looked };
}

export interface Diagnosis {
  reply: string;
  developerMessage: string;
  missing: string[];
  looked: string[];
  rounds: number;
  usd: number;
}

/**
 * The owner's words + the browser's report → a diagnosis. `history` is the conversation so far (his questions and the
 * earlier replies), so he can follow up («ليش؟» «وبعدين؟»).
 */
export async function diagnosePlatform(p: { message: string; report: string; path: string; history: DiagnoseTurn[] }): Promise<Diagnosis> {
  if (!process.env.ANTHROPIC_API_KEY) throw new UserError("المشخّص غير مفعّل على الخادم.", 503);
  const message = p.message.trim().slice(0, 4000) || "شنو المشكلة هنا؟";
  const mentioned = [...new Set(`${message}\n${p.history.map((h) => h.text).join("\n")}`.match(EMAIL) ?? [])].slice(0, 3);
  const state = await platformState(mentioned);

  const first = [
    `OWNER'S WORDS:\n${message}`,
    `PAGE: ${p.path.slice(0, 300)}`,
    `BROWSER REPORT:\n${cut(p.report, 40_000)}`,
    `SERVER STATE:\n${cut(state, 24_000)}`,
  ].join("\n\n");
  const turns: ClaudeTurn[] = [
    ...p.history.slice(-8).map((h) => ({ role: h.role, content: cut(h.text, 6000) })),
    { role: "user", content: first },
  ];
  // two user turns in a row are not allowed: if the history ends with a user turn, fold it into the first
  const merged: ClaudeTurn[] = [];
  for (const t of turns) {
    const last = merged[merged.length - 1];
    if (last && last.role === t.role && typeof last.content === "string" && typeof t.content === "string") last.content = `${last.content}\n\n${t.content}`;
    else merged.push({ ...t });
  }
  if (merged[0]?.role !== "user") merged.unshift({ role: "user", content: "(بداية المحادثة)" });

  const looked: string[] = [];
  let usd = 0;
  let step: Step | null = null;
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const last = round === MAX_ROUNDS;
    const r = await callClaudeJson<Step>({ system: SYSTEM, turns: merged, schema: SCHEMA, maxTokens: 12000, effort: "high", fallback: true, leader: true }).catch((e) => {
      console.error("platform diagnose", e);
      throw new UserError(claudeTrouble(e) ?? "ما قدر المشخّص يشتغل الحين؛ جرّب بعد شوي.", 502);
    });
    usd += claudeCost(r.usage);
    step = r.data;
    const wants = (step.lists?.length ?? 0) + (step.searches?.length ?? 0) + (step.reads?.length ?? 0) > 0;
    if (step.done || !wants || last) {
      if (!step.reply.trim() && !last) {
        // asked to stop looking but gave no answer: one more round to answer from what it has
        merged.push({ role: "assistant", content: JSON.stringify(step) }, { role: "user", content: "Answer now with done=true: what you found, and what is still unknown." });
        continue;
      }
      return {
        reply: step.reply.trim() || "ما قدرت أوصل لسبب واضح؛ ارسل لي نص الخطأ أو صورة للشاشة وبكمّل.",
        developerMessage: step.developerMessage.trim(),
        missing: (step.missing ?? []).map((m) => m.trim()).filter(Boolean).slice(0, 8),
        looked,
        rounds: round,
        usd,
      };
    }
    const res = await runLooks(step);
    looked.push(...res.looked);
    merged.push({ role: "assistant", content: JSON.stringify({ ...step, reply: "", developerMessage: "" }) }, { role: "user", content: `RESULTS (round ${round} of ${MAX_ROUNDS}${round === MAX_ROUNDS - 1 ? "; this is your last look: answer next" : ""}):\n\n${res.text}` });
  }
  throw new UserError("ما انتهى التشخيص؛ جرّب مرة ثانية.", 502);
}
