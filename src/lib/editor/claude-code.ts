// «حيدرة كت» · «Claude Code» — حيدرة EXECUTES cuts, arrangement and colour by writing a program (the Claude Code way,
// src/lib/claude-code/skill.ts): WRITE (or FIX after the browser's sandbox ran it and it threw), then REVIEW: for an
// edit he reads the timeline AFTER the program's commands ran on a copy; for a grade he LOOKS at the clips as filmed and
// after the program's LUT. Below the bar he rewrites the program; at the bar the page applies it. Paid by real use
// like every robot turn. Nothing runs here: the person's browser runs the programs (src/components/claude-code).

import { UserError } from "@/lib/api";
import { callClaudeJson, claudeCost, claudeWhy, type ClaudePart } from "@/lib/film/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProgram } from "@/lib/claude-code/compute";

/** The two programs of the editor (the voice has its own, src/lib/claude-code/voice.ts). */
type ProgramKind = "edit" | "grade";
import { CLAUDE_CODE_WAY, CODE_PASS, CODE_ROUNDS, EDIT_CONTRACT, EDIT_RUBRIC, GRADE_CONTRACT, GRADE_RUBRIC } from "@/lib/claude-code/skill";
import { context, type Spoken } from "./assistant-core";
import { COMMANDS_GUIDE } from "./assistant-commands";
import { GRADING_KNOW_HOW } from "./assistant-guide";
import { lookParts, readLook } from "./assistant";
import { readTimeline } from "./model";
import { claudeCharged, type Who } from "./pricing";
import { assetViews, stillOpen, type EditorProject } from "./server";

const db = () => createAdminClient();
const text = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

const IDENTITY = `You are «حيدرة», the editor and colourist of «حيدرة كت» (never call yourself Claude). Here you are working in your «حيدرا ماكس» mode.

${CLAUDE_CODE_WAY}`;

const SYSTEM: Record<ProgramKind, string> = {
  edit: `${IDENTITY}\n\n${EDIT_CONTRACT}\n\n${COMMANDS_GUIDE}`,
  grade: `${IDENTITY}\n\n${GRADE_CONTRACT}\n\n${GRADING_KNOW_HOW}`,
};
const RUBRICS = { edit: EDIT_RUBRIC, grade: GRADE_RUBRIC } as const;

const WRITE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["code", "notes"],
  properties: { code: { type: "string", description: "the COMPLETE program" }, notes: { type: "string", description: "to the person, Gulf Arabic, one sentence on what the program does (or what you fixed)" } },
};
const reviewSchema = (kind: ProgramKind) => ({
  type: "object",
  additionalProperties: false,
  required: ["scores", "worst", "verdict", "code"],
  properties: {
    scores: { type: "object", additionalProperties: false, required: RUBRICS[kind].map((r) => r.id), properties: Object.fromEntries(RUBRICS[kind].map((r) => [r.id, { type: "integer", description: r.en }])) },
    worst: { type: "array", items: { type: "object", additionalProperties: false, required: ["problem", "fix"], properties: { problem: { type: "string" }, fix: { type: "string" } } } },
    verdict: { type: "string", description: "to the person, Gulf Arabic, 1–2 sentences: what you checked and what you changed (honest)" },
    code: { type: "string", description: `the COMPLETE revised program when any score is below ${CODE_PASS}; empty when every score is ≥ ${CODE_PASS}` },
  },
});

async function ask<T>(who: Who, model: unknown, kind: ProgramKind, label: string, parts: ClaudePart[], schema: object, maxTokens: number) {
  if (!process.env.ANTHROPIC_API_KEY) throw new UserError("حيدرة غير مفعّل على الخادم.", 503);
  const deadline = AbortSignal.timeout(300_000);
  return claudeCharged(
    who,
    model,
    label,
    () =>
      callClaudeJson<T>({ system: SYSTEM[kind], turns: [{ role: "user", content: parts }], schema, maxTokens, effort: "high", fallback: true, signal: deadline }).catch((e) => {
        console.error("claude code", label, e);
        if (deadline.aborted) throw new UserError("خدمة الذكاء الاصطناعي تأخرت. أعد الطلب.", 504);
        throw new UserError(claudeWhy(e, "ما قدر حيدرة يكمل الشغل بالكود الحين. جرّب مرة ثانية.", who.email), 502);
      }),
    (x) => claudeCost(x.usage),
  );
}

/** The timeline's facts as حيدرة (and his edit program) see them: the same JSON his chat gets. */
async function factsOf(p: EditorProject, raw: unknown, extra: { playhead?: unknown; selected?: unknown; quiet?: unknown }) {
  const assets = await assetViews(p.id);
  const { data: metas } = await db().from("editor_assets").select("id,meta").eq("project_id", p.id);
  const transcripts = new Map((metas ?? []).map((m) => [m.id as string, (m.meta as { transcripts?: Record<string, Spoken> } | null)?.transcripts]));
  const tl = readTimeline(raw, new Set(assets.map((a) => a.id)));
  return { tl, facts: context(tl, assets, transcripts, extra) };
}

const scoresLine = (kind: ProgramKind) => RUBRICS[kind].map((r) => `${r.id}: ${r.en}`).join(" | ");

function readReview(kind: ProgramKind, raw: Record<string, unknown>) {
  const s = (raw.scores ?? {}) as Record<string, unknown>;
  const scores = Object.fromEntries(RUBRICS[kind].map((r) => [r.id, Math.max(1, Math.min(10, Math.round(Number(s[r.id]) || 1)))])) as Record<string, number>;
  const worst = (Array.isArray(raw.worst) ? raw.worst : []).slice(0, 3).map((w) => ({ problem: text((w as { problem?: unknown }).problem, 300), fix: text((w as { fix?: unknown }).fix, 300) }));
  const pass = Object.values(scores).every((v) => v >= CODE_PASS);
  return { scores, worst, pass, verdict: text(raw.verdict, 600) };
}

// ───────── the edit: cut, trim, reorder, remove silences and mistakes ─────────

/** WRITE (or FIX) the edit program for the request, from the timeline's facts. */
export async function codeEditWrite(p: EditorProject, who: Who, b: Record<string, unknown>) {
  stillOpen(p);
  const request = text(b.request, 3000);
  if (request.length < 2) throw new UserError("وش تبي أسوي بالتايملاين؟", 400);
  const { facts } = await factsOf(p, b.timeline, { playhead: b.playhead, selected: b.selected, quiet: b.quiet });
  const previous = text(b.code, 60_000);
  const errors = text(b.errors, 4000);
  const parts: ClaudePart[] = [
    {
      type: "text",
      text: `${previous ? "FIX the edit program below." : "WRITE the edit program for this request."}
THE REQUEST (the person's words): ${request}
T (the timeline, exactly what edit(T, K) receives):
${JSON.stringify(facts)}
${previous ? `THE PROGRAM:\n${previous}\n\nWHAT WENT WRONG (from the sandbox or the command check — fix exactly this, keep the rest):\n${errors || "(no error text)"}` : ""}
Write the COMPLETE program.`,
    },
  ];
  const r = await ask<{ code: string; notes: string }>(who, b.model, "edit", previous ? "حيدرا ماكس · تصليح التقطيع" : "حيدرا ماكس · برنامج التقطيع", parts, WRITE_SCHEMA, 32_000);
  const chk = checkProgram("edit", r.data.code);
  return { code: chk.code, problems: chk.problems, notes: text(r.data.notes, 600), facts, coins: r.coins, model: r.model };
}

/** REVIEW the edit: the timeline before and after the program's commands (ran on a copy in the browser). */
export async function codeEditReview(p: EditorProject, who: Who, b: Record<string, unknown>) {
  stillOpen(p);
  const request = text(b.request, 3000);
  const code = checkProgram("edit", b.code).code;
  if (!code) throw new UserError("ما وصلني البرنامج.", 400);
  const round = Math.max(1, Math.min(CODE_ROUNDS, Math.round(Number(b.round) || 1)));
  const before = await factsOf(p, b.timeline, { quiet: b.quiet });
  const after = await factsOf(p, b.after, {});
  const summary = text(b.summary, 3000);
  const parts: ClaudePart[] = [
    {
      type: "text",
      text: `REVIEW ROUND ${round} of ${CODE_ROUNDS}. Be a HARSH editor, not a proud author. Judge what the program DID (the timeline after), not what it intends.
THE REQUEST: ${request}
Score every criterion 1–10: ${scoresLine("edit")}. Name the worst problems and the exact fix. If ANY score is below ${CODE_PASS}, return the COMPLETE revised program; otherwise code = "".
THE PROGRAM:
${code}
WHAT IT DID (counted by the page): ${summary || "(none)"}
T BEFORE:
${JSON.stringify(before.facts)}
THE TIMELINE AFTER (the same shape):
${JSON.stringify(after.facts)}`,
    },
  ];
  const r = await ask<Record<string, unknown>>(who, b.model, "edit", `حيدرا ماكس · مراجعة التقطيع ${round}`, parts, reviewSchema("edit"), 32_000);
  const review = readReview("edit", r.data);
  const revised = !review.pass && typeof r.data.code === "string" && r.data.code.trim() ? checkProgram("edit", r.data.code) : null;
  return { review, code: revised?.ok ? revised.code : "", problems: revised && !revised.ok ? revised.problems : [], coins: r.coins, model: r.model };
}

// ───────── the grade: colour as a program, sampled into a LUT ─────────

const looksOf = (raw: unknown, tl: ReturnType<typeof readTimeline>) =>
  (Array.isArray(raw) ? raw : []).slice(0, 4).map((l) => readLook(l, tl)).filter((l): l is NonNullable<ReturnType<typeof readLook>> => !!l);

/** WRITE (or FIX) the grade program, from the clips as filmed (pictures and scopes) and the request. */
export async function codeGradeWrite(p: EditorProject, who: Who, b: Record<string, unknown>) {
  stillOpen(p);
  const request = text(b.request, 3000);
  if (request.length < 2) throw new UserError("وش اللوك اللي تبيه؟", 400);
  const { tl } = await factsOf(p, b.timeline, {});
  const looks = looksOf(b.looks, tl);
  if (!looks.length) throw new UserError("ما قدرت أشوف المقاطع اللي ألوّنها.", 400);
  const previous = text(b.code, 60_000);
  const errors = text(b.errors, 4000);
  const parts: ClaudePart[] = [
    {
      type: "text",
      text: `${previous ? "FIX the grade program below." : "WRITE the grade program for this request."}
THE REQUEST (the person's words): ${request}
THE CLIPS (${looks.length}): their moments as they look NOW, each with its scope, below (a picture marked "as filmed" already carries any grading the clip had — your program grades on top of it). Grade them to ONE look that fits them all.
${previous ? `THE PROGRAM:\n${previous}\n\nWHAT WENT WRONG (from the sandbox — fix exactly this):\n${errors || "(no error text)"}` : ""}
Write the COMPLETE program.`,
    },
    ...looks.flatMap((l, i): ClaudePart[] => [{ type: "text", text: `CLIP ${i + 1} (${l.clipId}):` }, ...lookParts(l)]),
  ];
  const r = await ask<{ code: string; notes: string }>(who, b.model, "grade", previous ? "حيدرا ماكس · تصليح التلوين" : "حيدرا ماكس · برنامج التلوين", parts, WRITE_SCHEMA, 24_000);
  const chk = checkProgram("grade", r.data.code);
  return { code: chk.code, problems: chk.problems, notes: text(r.data.notes, 600), coins: r.coins, model: r.model };
}

/** REVIEW the grade: he LOOKS at the same moments as filmed and after the program's LUT, scores and rewrites. */
export async function codeGradeReview(p: EditorProject, who: Who, b: Record<string, unknown>) {
  stillOpen(p);
  const request = text(b.request, 3000);
  const code = checkProgram("grade", b.code).code;
  if (!code) throw new UserError("ما وصلني البرنامج.", 400);
  const round = Math.max(1, Math.min(CODE_ROUNDS, Math.round(Number(b.round) || 1)));
  const { tl } = await factsOf(p, b.timeline, {});
  const looks = looksOf(b.looks, tl);
  if (!looks.some((l) => l.frames.some((f) => f.graded))) throw new UserError("ما وصلتني صور بعد التلوين.", 400);
  const parts: ClaudePart[] = [
    {
      type: "text",
      text: `REVIEW ROUND ${round} of ${CODE_ROUNDS}. Be a HARSH colourist, not a proud author. Judge what you SEE after the grade (and the scopes), against the same moments before it (marked "as filmed": the clip as it looked before your program).
THE REQUEST: ${request}
Score every criterion 1–10: ${scoresLine("grade")}. Name the worst problems and the exact fix. If ANY score is below ${CODE_PASS}, return the COMPLETE revised program; otherwise code = "".
THE PROGRAM:
${code}`,
    },
    ...looks.flatMap((l, i): ClaudePart[] => [{ type: "text", text: `CLIP ${i + 1} (${l.clipId}):` }, ...lookParts(l)]),
  ];
  const r = await ask<Record<string, unknown>>(who, b.model, "grade", `حيدرا ماكس · مراجعة التلوين ${round}`, parts, reviewSchema("grade"), 24_000);
  const review = readReview("grade", r.data);
  const revised = !review.pass && typeof r.data.code === "string" && r.data.code.trim() ? checkProgram("grade", r.data.code) : null;
  return { review, code: revised?.ok ? revised.code : "", problems: revised && !revised.ok ? revised.problems : [], coins: r.coins, model: r.model };
}
