// «حيدرة كت» · «Claude Code» in the page — حيدرا ماكس executes by PROGRAM (src/lib/claude-code/skill.ts):
//   EDIT  (cut, trim, reorder, remove silences or mistakes): he writes edit(T, K) → it runs here in a sandbox on the
//         timeline's facts → its commands are checked on a copy (a bug or a bad command goes back to him to fix) →
//         he reads the timeline AFTER and scores it → below the bar he rewrites it → at the bar it is applied (one undo).
//   GRADE (colour): he writes grade(c, K) → it is sampled here into a 3D LUT → the clips' moments are graded with it →
//         he LOOKS at them against the same moments before, scores and rewrites → at the bar the LUT goes on the clips
//         as their own grading layer «Claude Code» (one undo).

import { asksAboutBackdrop, checkCommands, withoutBackdropEdits } from "@/lib/editor/assistant-core";
import { applyAll, type Command } from "@/lib/editor/commands";
import { MAX_LAYERS, NEUTRAL_GRADE, type Grade } from "@/lib/editor/grade";
import { duration, findClip, type AssetInfo, type Timeline } from "@/lib/editor/model";
import { CODE_FIXES, CODE_ROUNDS, EDIT_RUBRIC, GRADE_RUBRIC } from "@/lib/claude-code/skill";
import { GRADE_LUT_SIZE } from "@/lib/claude-code/compute";
import { postJson } from "@/lib/fetch";
import { ProgramError, runEdit, runGrade, toBase64 } from "@/components/claude-code/compute-host";
import type { Run } from "./Inspector";

export const CODE_LAYER_NAME = "حيدرا ماكس";

type Frame = { t: number; data: string; graded?: boolean; scope?: unknown };
export interface Look {
  clipId: string;
  frames: Frame[];
}
export interface CodeDeps {
  projectId: string;
  model: string;
  timeline: () => Timeline;
  infos: () => Map<string, AssetInfo>;
  run: Run;
  busy: (s: string | null) => void;
  signal?: AbortSignal;
  /** the silent parts of the clips (for cuts on speech) */
  quiet: () => Promise<unknown>;
  playhead: number;
  selected: string[];
  /** a clip's moments as they look now (as filmed, and graded when it is) */
  look: (tl: Timeline, clipId: string) => Promise<Look | null>;
  /** the same moments through the given grading layers */
  graded: (frames: { t: number; data: string }[], layers: Grade[], own: (t: number) => number) => Promise<Frame[]>;
}
interface Review {
  scores: Record<string, number>;
  worst: { problem: string; fix: string }[];
  pass: boolean;
  verdict: string;
}
interface Wrote {
  code: string;
  problems: string[];
  notes: string;
  facts?: unknown;
}

const api = <T>(d: CodeDeps, action: string, body: Record<string, unknown>) => postJson<T>(`/api/jawad/editor/projects/${d.projectId}`, { action, model: d.model, ...body }, d.signal);
const stopped = (d: CodeDeps) => {
  if (d.signal?.aborted) throw Object.assign(new Error("⏹️ وقّفت الطلب."), { name: "AbortError" });
};
const scoreLine = (rubric: readonly { id: string; ar: string }[], s: Record<string, number>) => rubric.map((r) => `${r.ar} ${s[r.id] ?? "—"}`).join(" · ");
const sec = (ms: number) => `${(ms / 1000).toFixed(1)} ث`;

export interface CodeOutcome {
  text: string;
  done: number;
}

/** «Claude Code» · the edit: write → run here → check → review → (rewrite) → apply. */
export async function codeEdit(d: CodeDeps, request: string): Promise<CodeOutcome> {
  const start = d.timeline();
  d.busy("نسمع الصوت ونلقى السكتات…");
  const quiet = await d.quiet();
  stopped(d);
  d.busy("حيدرا ماكس يكتب برنامج التقطيع…");
  let w = await api<Wrote>(d, "code_edit_write", { request, timeline: start, quiet, playhead: d.playhead, selected: d.selected });
  let code = w.code;
  let problems = w.problems;
  const facts = w.facts;
  let last: { cmds: Command[]; after: Timeline; review: Review } | null = null;
  for (let round = 1; round <= CODE_ROUNDS; round++) {
    // run it, and give it back to fix while it throws or sends a command that can't run
    let cmds: Command[] = [];
    for (let fix = 0; ; fix++) {
      stopped(d);
      try {
        if (problems.length) throw new ProgramError(problems.join("; "));
        d.busy(`أشغّل برنامج حيدرا ماكس على نسخة من التايملاين${round > 1 ? ` (جولة ${round})` : ""}…`);
        const raw = await runEdit(code, facts);
        if (!raw.length) throw new ProgramError("edit(T, K) returned no commands");
        const chk = checkCommands(start, raw.map((c) => JSON.stringify(c)), d.infos());
        if (chk.error) throw new ProgramError(`command ${chk.error.i + 1} of ${raw.length} can't run (${JSON.stringify(raw[chk.error.i]).slice(0, 300)}): ${chk.error.message}`);
        cmds = chk.cmds;
        break;
      } catch (e) {
        if (!(e instanceof ProgramError) || fix >= CODE_FIXES) throw e instanceof ProgramError ? new Error(`برنامج التقطيع ما اشتغل بعد ${fix + 1} محاولات: ${e.message}`) : e;
        d.busy("البرنامج طلع فيه خطأ — حيدرا ماكس يصلّحه…");
        w = await api<Wrote>(d, "code_edit_write", { request, timeline: start, quiet, code, errors: `${e.message}\n${e.stack2}` });
        code = w.code;
        problems = w.problems;
      }
    }
    const after = applyAll(start, cmds, d.infos()).timeline;
    const summary = `${cmds.length} commands (${[...new Set(cmds.map((c) => c.type))].join(", ")}); length ${sec(duration(start))} → ${sec(duration(after))}; clips ${start.tracks.reduce((n, t) => n + t.clips.length, 0)} → ${after.tracks.reduce((n, t) => n + t.clips.length, 0)}`;
    d.busy(`حيدرا ماكس يراجع التايملاين بعد البرنامج (جولة ${round} من ${CODE_ROUNDS})…`);
    const r = await api<{ review: Review; code: string; problems: string[] }>(d, "code_edit_review", { request, timeline: start, after, quiet, code, round, summary });
    last = { cmds, after, review: r.review };
    if (r.review.pass || !r.code) break;
    code = r.code;
    problems = r.problems;
  }
  stopped(d);
  if (!last) throw new Error("ما طلع من البرنامج شي.");
  // a program cuts and arranges: the background / colour key are the person's own settings, never changed by it
  const cmds = asksAboutBackdrop(request) ? last.cmds : withoutBackdropEdits(last.cmds as { type?: string; patch?: Record<string, unknown> }[]).cmds;
  const applied = d.run(cmds as typeof last.cmds, { label: `حيدرا ماكس: ${request.slice(0, 40)}` });
  if (!applied) throw new Error("ما قدرت أطبّق التقطيع على التايملاين.");
  const lens = `${sec(duration(start))} → ${sec(duration(last.after))}`;
  return { text: `${last.review.pass ? "✅" : "⚠️"} ${last.review.verdict}\n🧑‍💻 حيدرا ماكس · ${last.cmds.length} أمر · الطول ${lens}\n${scoreLine(EDIT_RUBRIC, last.review.scores)}`, done: last.cmds.length };
}

/** Which grading layer the program's LUT goes on: its own (if it is there already), else a new one, else the last. */
export function codeLayer(grades: Grade[]): number {
  const own = grades.findIndex((g) => g.name === CODE_LAYER_NAME);
  if (own >= 0) return own;
  return Math.min(MAX_LAYERS - 1, grades.length);
}

/** «Claude Code» · the colour: write → sample into a LUT here → look → review → (rewrite) → put it on the clips. */
export async function codeGrade(d: CodeDeps, request: string, clipIds: string[]): Promise<CodeOutcome> {
  const start = d.timeline();
  const clips = [...new Set(clipIds)].map((id) => findClip(start, id)?.clip).filter((c): c is NonNullable<typeof c> => !!c && !c.text).slice(0, 3);
  if (!clips.length) throw new Error("اختر مقطع فيديو أو صورة ألوّنه.");
  d.busy("حيدرا ماكس يشوف المقاطع قبل التلوين…");
  // the moments as the person sees them now (graded when they are); the program grades on top of that
  const before: Look[] = [];
  for (const c of clips) {
    const l = await d.look(start, c.id);
    if (!l) continue;
    const now = l.frames.filter((f) => f.graded);
    before.push({ clipId: c.id, frames: (now.length ? now : l.frames).slice(0, 3).map((f) => ({ ...f, graded: false })) });
  }
  if (!before.length) throw new Error("ما قدرت أشوف المقاطع.");
  stopped(d);
  d.busy("حيدرا ماكس يكتب برنامج التلوين…");
  let w = await api<Wrote>(d, "code_grade_write", { request, timeline: start, looks: before });
  let code = w.code;
  let problems = w.problems;
  let last: { lut: Uint8Array; review: Review } | null = null;
  for (let round = 1; round <= CODE_ROUNDS; round++) {
    let lut: Uint8Array | null = null;
    for (let fix = 0; ; fix++) {
      stopped(d);
      try {
        if (problems.length) throw new ProgramError(problems.join("; "));
        d.busy(`أشغّل برنامج التلوين وأبني الـLUT${round > 1 ? ` (جولة ${round})` : ""}…`);
        lut = await runGrade(code, GRADE_LUT_SIZE);
        break;
      } catch (e) {
        if (!(e instanceof ProgramError) || fix >= CODE_FIXES) throw e instanceof ProgramError ? new Error(`برنامج التلوين ما اشتغل بعد ${fix + 1} محاولات: ${e.message}`) : e;
        d.busy("البرنامج طلع فيه خطأ — حيدرا ماكس يصلّحه…");
        w = await api<Wrote>(d, "code_grade_write", { request, timeline: start, looks: before, code, errors: `${e.message}\n${e.stack2}` });
        code = w.code;
        problems = w.problems;
      }
    }
    const layer: Grade = { ...NEUTRAL_GRADE, name: CODE_LAYER_NAME, lut: { name: CODE_LAYER_NAME, size: GRADE_LUT_SIZE, data: toBase64(lut) }, lutAmount: 1 };
    // the same moments through the LUT (the "before" already carries the clip's own grading)
    const looks: Look[] = [];
    for (const b of before) looks.push({ clipId: b.clipId, frames: [...b.frames, ...(await d.graded(b.frames, [layer], () => 0))] });
    stopped(d);
    d.busy(`حيدرا ماكس يشوف النتيجة ويقيّمها (جولة ${round} من ${CODE_ROUNDS})…`);
    const r = await api<{ review: Review; code: string; problems: string[] }>(d, "code_grade_review", { request, timeline: start, looks, code, round });
    last = { lut, review: r.review };
    if (r.review.pass || !r.code) break;
    code = r.code;
    problems = r.problems;
  }
  stopped(d);
  if (!last) throw new Error("ما طلع من البرنامج شي.");
  const data = toBase64(last.lut);
  const cmds: Command[] = clips.map((c) => ({ type: "update_clip", clipId: c.id, patch: { grade: { layer: codeLayer(findClip(d.timeline(), c.id)?.clip.grades ?? c.grades), on: true, name: CODE_LAYER_NAME, lut: { name: CODE_LAYER_NAME, size: GRADE_LUT_SIZE, data }, lutAmount: 1 } } }));
  if (!d.run(cmds, { label: `حيدرا ماكس يلوّن: ${request.slice(0, 40)}` })) throw new Error("ما قدرت أحط التلوين على المقاطع.");
  return { text: `${last.review.pass ? "✅" : "⚠️"} ${last.review.verdict}\n🧑‍💻 حيدرا ماكس · LUT ${GRADE_LUT_SIZE}³ على ${clips.length} مقطع (طبقة «${CODE_LAYER_NAME}»)\n${scoreLine(GRADE_RUBRIC, last.review.scores)}`, done: cmds.length };
}
