// «Claude Code» — the design by program, for «زهراء فوتو ماستر» (an alternative to her plain commands): WRITE (or FIX)
// layout(D, K) from the design's facts and how it looks now, then REVIEW it from the design before and after its
// commands (the person's browser runs the program, applies its commands to a copy and renders both,
// src/components/claude-code/compute-host.ts). Placing photos, arranging and composing layers, writing and changing
// words. Lifting a piece out of a picture stays with the tools that SEE it (SAM 3 and GPT Image 2's reconstruction).
// Paid by real use (robotTurn). Server only.

import { UserError } from "@/lib/api";
import { robotTurn, type RobotUser } from "@/lib/claude-run";
import { callClaudeJson, claudeCost, claudeWhy, type ClaudePart } from "@/lib/film/anthropic";
import { PHOTO_TOOLS } from "@config/photo";
import { checkProgram } from "./compute";
import { CLAUDE_CODE_WAY, CODE_PASS, CODE_ROUNDS, LAYOUT_CONTRACT, LAYOUT_RUBRIC } from "./skill";

const text = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const jpeg = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9+/=]+$/.test(v) && v.length < 1_200_000 ? v : null);

const SYSTEM = (who: string) => `You are «${who}», working in your «Claude Code» mode as the designer and compositor of «زهراء فوتو ماستر» (never call yourself Claude).

${CLAUDE_CODE_WAY}

${LAYOUT_CONTRACT}

THE EDITOR'S COMMANDS (what your program returns, as objects — the same reference «${who}» uses):
${PHOTO_TOOLS}`;

const WRITE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["code", "notes"],
  properties: { code: { type: "string" }, notes: { type: "string", description: "to the person, Gulf Arabic, one sentence" } },
};
const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["scores", "verdict", "code"],
  properties: {
    scores: { type: "object", additionalProperties: false, required: LAYOUT_RUBRIC.map((r) => r.id), properties: Object.fromEntries(LAYOUT_RUBRIC.map((r) => [r.id, { type: "integer", description: r.en }])) },
    verdict: { type: "string", description: "to the person, Gulf Arabic, 1–2 sentences: what you saw and what you changed" },
    code: { type: "string", description: `the COMPLETE revised program when any score is below ${CODE_PASS}; empty otherwise` },
  },
};

async function ask<T>(user: RobotUser, who: string, model: unknown, label: string, parts: ClaudePart[], schema: object) {
  if (!process.env.ANTHROPIC_API_KEY) throw new UserError("Claude Code غير مفعّل على الخادم.", 503);
  const deadline = AbortSignal.timeout(240_000);
  return robotTurn(user, model, label, async () => {
    const r = await callClaudeJson<T>({ system: SYSTEM(who), turns: [{ role: "user", content: parts }], schema, maxTokens: 24_000, effort: "high", fallback: true, signal: deadline }).catch((e) => {
      console.error("claude code layout", label, e);
      if (deadline.aborted) throw new UserError("خدمة الذكاء الاصطناعي تأخرت. أعد المحاولة.", 504);
      throw new UserError(claudeWhy(e, "ما قدر Claude Code يرتّب التصميم الحين. جرّب مرة ثانية.", user.email), 502);
    });
    return { ...r, usd: claudeCost(r.usage) };
  });
}

const factsOf = (v: unknown) => {
  const s = JSON.stringify(v ?? null);
  if (!v || typeof v !== "object" || s.length > 120_000) throw new UserError("ما وصلني وصف التصميم.", 400);
  return s;
};

/** WRITE (or FIX) the layout program from the design's facts and how it looks now. */
export async function layoutWrite(user: RobotUser, who: string, b: Record<string, unknown>) {
  const request = text(b.request, 3000);
  const before = jpeg(b.before);
  if (request.length < 2 || !before) throw new UserError("ما وصلني الطلب أو صورة التصميم.", 400);
  const facts = factsOf(b.facts);
  const previous = text(b.code, 60_000);
  const parts: ClaudePart[] = [
    { type: "text", text: `${previous ? "FIX the layout program below." : "WRITE the layout program."}\nTHE REQUEST: ${request}\nD (the design's facts, exactly what your program receives):\n${facts}\n${previous ? `THE PROGRAM:\n${previous}\n\nWHAT WENT WRONG (from the sandbox or the editor):\n${text(b.errors, 4000) || "(no error text)"}` : ""}\nThe design as it looks now:` },
    { type: "image64", data: before, mediaType: "image/jpeg" },
  ];
  const r = await ask<{ code: string; notes: string }>(user, who, b.model, previous ? "Claude Code · تصليح التصميم" : "Claude Code · برنامج التصميم", parts, WRITE_SCHEMA);
  const chk = checkProgram("layout", r.data.code);
  return { code: chk.code, problems: chk.problems, notes: text(r.data.notes, 600), coins: r.coins };
}

/** REVIEW: before and after the program's commands; below the bar, the complete revised program. */
export async function layoutReview(user: RobotUser, who: string, b: Record<string, unknown>) {
  const request = text(b.request, 3000);
  const code = checkProgram("layout", b.code).code;
  const before = jpeg(b.before), after = jpeg(b.after);
  if (!code || !before || !after) throw new UserError("ما وصلتني الصور أو البرنامج.", 400);
  const facts = factsOf(b.facts);
  const round = Math.max(1, Math.min(CODE_ROUNDS, Math.round(Number(b.round) || 1)));
  const parts: ClaudePart[] = [
    { type: "text", text: `REVIEW ROUND ${round} of ${CODE_ROUNDS}. Be a HARSH art director. Judge what you SEE after the program's commands against before.\nTHE REQUEST: ${request}\nScore every criterion 1–10: ${LAYOUT_RUBRIC.map((r) => `${r.id}: ${r.en}`).join(" | ")}. If ANY score is below ${CODE_PASS}, return the COMPLETE revised program (it runs on the SAME facts D as before); otherwise code = "".\nD:\n${facts}\nTHE PROGRAM:\n${code}` },
    { type: "text", text: "BEFORE:" },
    { type: "image64", data: before, mediaType: "image/jpeg" },
    { type: "text", text: "AFTER:" },
    { type: "image64", data: after, mediaType: "image/jpeg" },
  ];
  const r = await ask<Record<string, unknown>>(user, who, b.model, `Claude Code · مراجعة التصميم ${round}`, parts, REVIEW_SCHEMA);
  const s = (r.data.scores ?? {}) as Record<string, unknown>;
  const scores = Object.fromEntries(LAYOUT_RUBRIC.map((x) => [x.id, Math.max(1, Math.min(10, Math.round(Number(s[x.id]) || 1)))])) as Record<string, number>;
  const pass = Object.values(scores).every((v) => v >= CODE_PASS);
  const revised = !pass && typeof r.data.code === "string" && r.data.code.trim() ? checkProgram("layout", r.data.code) : null;
  return { review: { scores, pass, verdict: text(r.data.verdict, 600) }, code: revised?.ok ? revised.code : "", problems: revised && !revised.ok ? revised.problems : [], coins: r.coins };
}
