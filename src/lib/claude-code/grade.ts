// «Claude Code» — colour by program, for any robot that grades a still picture (زهراء's photo editor): WRITE (or FIX)
// grade(c, K) from the picture as it is now, then REVIEW it from the picture before and after the program's LUT
// (the person's browser samples and applies it, src/components/claude-code/compute-host.ts). The editor has its own
// with clips and scopes (src/lib/editor/claude-code.ts). Paid by real use (robotTurn). Server only.

import { UserError } from "@/lib/api";
import { robotTurn, type RobotUser } from "@/lib/claude-run";
import { callClaudeJson, claudeCost, claudeWhy, type ClaudePart } from "@/lib/film/anthropic";
import { checkProgram } from "./compute";
import { CLAUDE_CODE_WAY, CODE_PASS, CODE_ROUNDS, GRADE_CONTRACT, GRADE_RUBRIC } from "./skill";

const text = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const jpeg = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9+/=]+$/.test(v) && v.length < 1_200_000 ? v : null);

const SYSTEM = (who: string) => `You are «${who}», working in your «حيدرا ماكس» mode as the colourist (never call yourself Claude).

${CLAUDE_CODE_WAY}

${GRADE_CONTRACT}

Grade a STILL photograph: the look the person asked for, as a top retoucher would (natural skin, depth, separation, nothing clipped or banded).`;

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
    scores: { type: "object", additionalProperties: false, required: GRADE_RUBRIC.map((r) => r.id), properties: Object.fromEntries(GRADE_RUBRIC.map((r) => [r.id, { type: "integer", description: r.en }])) },
    verdict: { type: "string", description: "to the person, Gulf Arabic, 1–2 sentences: what you saw and what you changed" },
    code: { type: "string", description: `the COMPLETE revised program when any score is below ${CODE_PASS}; empty otherwise` },
  },
};

async function ask<T>(user: RobotUser, who: string, model: unknown, label: string, parts: ClaudePart[], schema: object) {
  if (!process.env.ANTHROPIC_API_KEY) throw new UserError("حيدرا ماكس غير مفعّل على الخادم.", 503);
  const deadline = AbortSignal.timeout(240_000);
  return robotTurn(user, model, label, async () => {
    const r = await callClaudeJson<T>({ system: SYSTEM(who), turns: [{ role: "user", content: parts }], schema, maxTokens: 20_000, effort: "high", fallback: true, signal: deadline }).catch((e) => {
      console.error("claude code grade", label, e);
      if (deadline.aborted) throw new UserError("خدمة الذكاء الاصطناعي تأخرت. أعد المحاولة.", 504);
      throw new UserError(claudeWhy(e, "ما قدر حيدرا ماكس يلوّن الحين. جرّب مرة ثانية.", user.email), 502);
    });
    return { ...r, usd: claudeCost(r.usage) };
  }, undefined, { price: "max" });
}

/** WRITE (or FIX) the grade program from the picture as it is now. */
export async function gradeWrite(user: RobotUser, who: string, b: Record<string, unknown>) {
  const request = text(b.request, 2000);
  const before = jpeg(b.before);
  if (request.length < 2 || !before) throw new UserError("ما وصلني اللوك أو الصورة.", 400);
  const previous = text(b.code, 60_000);
  const parts: ClaudePart[] = [
    { type: "text", text: `${previous ? "FIX the grade program below." : "WRITE the grade program."}\nTHE LOOK ASKED FOR: ${request}\n${previous ? `THE PROGRAM:\n${previous}\n\nWHAT WENT WRONG (from the sandbox):\n${text(b.errors, 4000) || "(no error text)"}` : ""}\nThe picture as it is now:` },
    { type: "image64", data: before, mediaType: "image/jpeg" },
  ];
  const r = await ask<{ code: string; notes: string }>(user, who, b.model, previous ? "حيدرا ماكس · تصليح التلوين" : "حيدرا ماكس · برنامج التلوين", parts, WRITE_SCHEMA);
  const chk = checkProgram("grade", r.data.code);
  return { code: chk.code, problems: chk.problems, notes: text(r.data.notes, 600), coins: r.coins };
}

/** REVIEW: before and after the program's LUT; below the bar, the complete revised program. */
export async function gradeReview(user: RobotUser, who: string, b: Record<string, unknown>) {
  const request = text(b.request, 2000);
  const code = checkProgram("grade", b.code).code;
  const before = jpeg(b.before), after = jpeg(b.after);
  if (!code || !before || !after) throw new UserError("ما وصلتني الصور أو البرنامج.", 400);
  const round = Math.max(1, Math.min(CODE_ROUNDS, Math.round(Number(b.round) || 1)));
  const parts: ClaudePart[] = [
    { type: "text", text: `REVIEW ROUND ${round} of ${CODE_ROUNDS}. Be a HARSH colourist. Judge what you SEE after the grade against before.\nTHE LOOK ASKED FOR: ${request}\nScore every criterion 1–10: ${GRADE_RUBRIC.map((r) => `${r.id}: ${r.en}`).join(" | ")} (a single picture: "match" is how evenly the look holds across the picture). If ANY score is below ${CODE_PASS}, return the COMPLETE revised program; otherwise code = "".\nTHE PROGRAM:\n${code}` },
    { type: "text", text: "BEFORE:" },
    { type: "image64", data: before, mediaType: "image/jpeg" },
    { type: "text", text: "AFTER:" },
    { type: "image64", data: after, mediaType: "image/jpeg" },
  ];
  const r = await ask<Record<string, unknown>>(user, who, b.model, `حيدرا ماكس · مراجعة التلوين ${round}`, parts, REVIEW_SCHEMA);
  const s = (r.data.scores ?? {}) as Record<string, unknown>;
  const scores = Object.fromEntries(GRADE_RUBRIC.map((x) => [x.id, Math.max(1, Math.min(10, Math.round(Number(s[x.id]) || 1)))])) as Record<string, number>;
  const pass = Object.values(scores).every((v) => v >= CODE_PASS);
  const revised = !pass && typeof r.data.code === "string" && r.data.code.trim() ? checkProgram("grade", r.data.code) : null;
  return { review: { scores, pass, verdict: text(r.data.verdict, 600) }, code: revised?.ok ? revised.code : "", problems: revised && !revised.ok ? revised.problems : [], coins: r.coins };
}
