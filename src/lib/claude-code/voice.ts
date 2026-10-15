// «Claude Code» for a voice recording — before a voiceprint is saved (or a recording is used for one reading), Claude
// writes a cleaning program for THIS recording (silences, rumble, hum, level, peaks), the person's browser runs it
// in the sandbox, and he REVIEWS the result from its measurements and its waveform picture (he cannot hear it) against
// the recording before, rewriting the program until every score passes. Paid by real use (robotTurn). Server only.

import { UserError } from "@/lib/api";
import { robotTurn, type RobotUser } from "@/lib/claude-run";
import { callClaudeJson, claudeCost, claudeWhy, type ClaudePart } from "@/lib/film/anthropic";
import { checkProgram } from "./compute";
import { CLAUDE_CODE_WAY, CODE_PASS, CODE_ROUNDS, VOICE_CONTRACT, VOICE_RUBRIC } from "./skill";

const text = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const png = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9+/=]+$/.test(v) && v.length < 800_000 ? v : null);

const SYSTEM = (who: string) => `You are «${who}», working in your «Claude Code» mode as the dialogue editor of a voice recording (never call yourself Claude).

${CLAUDE_CODE_WAY}

${VOICE_CONTRACT}`;

const WRITE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["code", "notes"],
  properties: { code: { type: "string" }, notes: { type: "string", description: "to the person, Gulf Arabic, one sentence on what the program does" } },
};
const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["scores", "verdict", "code"],
  properties: {
    scores: { type: "object", additionalProperties: false, required: VOICE_RUBRIC.map((r) => r.id), properties: Object.fromEntries(VOICE_RUBRIC.map((r) => [r.id, { type: "integer", description: r.en }])) },
    verdict: { type: "string", description: "to the person, Gulf Arabic, 1–2 sentences: what changed in the numbers and what you fixed" },
    code: { type: "string", description: `the COMPLETE revised program when any score is below ${CODE_PASS}; empty otherwise` },
  },
};

async function ask<T>(user: RobotUser, who: string, model: unknown, label: string, parts: ClaudePart[], schema: object) {
  if (!process.env.ANTHROPIC_API_KEY) throw new UserError("Claude Code غير مفعّل على الخادم.", 503);
  const deadline = AbortSignal.timeout(180_000);
  return robotTurn(user, model, label, async () => {
    const r = await callClaudeJson<T>({ system: SYSTEM(who), turns: [{ role: "user", content: parts }], schema, maxTokens: 12_000, effort: "medium", fallback: true, signal: deadline }).catch((e) => {
      console.error("claude code voice", label, e);
      if (deadline.aborted) throw new UserError("خدمة الذكاء الاصطناعي تأخرت. أعد المحاولة.", 504);
      throw new UserError(claudeWhy(e, "ما قدر Claude Code ينظّف التسجيل الحين. جرّب مرة ثانية.", user.email), 502);
    });
    return { ...r, usd: claudeCost(r.usage) };
  });
}

const pic = (label: string, data: string | null): ClaudePart[] => (data ? [{ type: "text", text: label }, { type: "image64", data, mediaType: "image/png" }] : []);

/** WRITE (or FIX) the cleaning program for this recording, from its measurements and waveform. */
export async function voiceWrite(user: RobotUser, who: string, b: Record<string, unknown>) {
  const stats = text(b.stats, 1500);
  if (!stats) throw new UserError("ما وصلت قياسات التسجيل.", 400);
  const previous = text(b.code, 60_000);
  const parts: ClaudePart[] = [
    { type: "text", text: `${previous ? "FIX the cleaning program below." : "WRITE the cleaning program for this recording."}\nWHAT IT IS FOR: ${text(b.purpose, 200) || "a voiceprint"}\nTHE RECORDING NOW: ${stats}\n${previous ? `THE PROGRAM:\n${previous}\n\nWHAT WENT WRONG (from the sandbox):\n${text(b.errors, 4000) || "(no error text)"}` : ""}` },
    ...pic("ITS WAVEFORM (time left → right, the level in dB as the band's height; red marks are frames at or near clipping):", png(b.wave)),
  ];
  const r = await ask<{ code: string; notes: string }>(user, who, b.model, previous ? "Claude Code · تصليح تنظيف الصوت" : "Claude Code · برنامج تنظيف الصوت", parts, WRITE_SCHEMA);
  const chk = checkProgram("clean", r.data.code);
  return { code: chk.code, problems: chk.problems, notes: text(r.data.notes, 600), coins: r.coins };
}

/** REVIEW the cleaned recording against the one before; below the bar, the complete revised program. */
export async function voiceReview(user: RobotUser, who: string, b: Record<string, unknown>) {
  const code = checkProgram("clean", b.code).code;
  const before = text(b.before, 1500), after = text(b.after, 1500);
  if (!code || !before || !after) throw new UserError("ما وصلت القياسات أو البرنامج.", 400);
  const round = Math.max(1, Math.min(CODE_ROUNDS, Math.round(Number(b.round) || 1)));
  const parts: ClaudePart[] = [
    { type: "text", text: `REVIEW ROUND ${round} of ${CODE_ROUNDS}. Be a HARSH dialogue editor. You cannot hear: judge from the numbers and the two waveforms.\nWHAT IT IS FOR: ${text(b.purpose, 200) || "a voiceprint"}\nBEFORE: ${before}\nAFTER: ${after}\nScore every criterion 1–10: ${VOICE_RUBRIC.map((r) => `${r.id}: ${r.en}`).join(" | ")}. If ANY score is below ${CODE_PASS}, return the COMPLETE revised program; otherwise code = "".\nTHE PROGRAM:\n${code}` },
    ...pic("WAVEFORM BEFORE:", png(b.waveBefore)),
    ...pic("WAVEFORM AFTER:", png(b.waveAfter)),
  ];
  const r = await ask<Record<string, unknown>>(user, who, b.model, `Claude Code · مراجعة تنظيف الصوت ${round}`, parts, REVIEW_SCHEMA);
  const s = (r.data.scores ?? {}) as Record<string, unknown>;
  const scores = Object.fromEntries(VOICE_RUBRIC.map((x) => [x.id, Math.max(1, Math.min(10, Math.round(Number(s[x.id]) || 1)))])) as Record<string, number>;
  const pass = Object.values(scores).every((v) => v >= CODE_PASS);
  const revised = !pass && typeof r.data.code === "string" && r.data.code.trim() ? checkProgram("clean", r.data.code) : null;
  return { review: { scores, pass, verdict: text(r.data.verdict, 600) }, code: revised?.ok ? revised.code : "", problems: revised && !revised.ok ? revised.problems : [], coins: r.coins };
}
