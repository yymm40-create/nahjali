// «الطالب الذكي» · «حيدرا ماكس» for every output: the output's content as pages (max-sources), designed and looked at by
// Claude Code (deck-make) and then made into the files. One step per call, like every other maker. Server only.

import { defaultDesign, maxAvailable, maxOn, pagesOf, type Design } from "@config/jawad/student";
import { claudeCeilingUsd } from "./claude";
import { getOutput, saveOutput, type Output } from "./db";
import { deckContent, deckStep, deckTodo, deckUsd, maxFiles, redesignSlide, slotPatch } from "./deck-make";
import type { Job, StepResult } from "./jobs";
import { maxSourceFor } from "./max-sources";
import type { DocPlan, QuizPlan } from "./model";
import { UserError } from "@/lib/api";

/** Is this output made by حيدرا ماكس? (a spoken recording never is: it has no pages) */
export const isMax = (o: Output) => maxAvailable(o.kind) && maxOn(o.settings);
const designOf = (o: Output): Design => (o.settings.design as Design) ?? defaultDesign("editorial");

/** Pages the output will have, before they exist (for the estimate): from what is known now. */
export function maxPagesGuess(o: Output, chars: number): { n: number; landscape: boolean } {
  switch (o.kind) {
    case "brochure":
      return { n: 2, landscape: true };
    case "mindmap":
      return { n: Math.max(1, ((o.plan as { maps?: unknown[] } | null)?.maps ?? []).length || 3), landscape: true };
    case "quiz": {
      const rows = (o.plan as QuizPlan | null)?.rows ?? [];
      const q = rows.reduce((s, r) => s + Object.values(r.counts).reduce((a, b) => a + b, 0), 0) || 10;
      return { n: Math.ceil(q / 5) + Math.ceil(q / 8), landscape: false };
    }
    case "slides":
      return { n: ((o.plan as { slides?: unknown[] } | null)?.slides ?? []).length || 10, landscape: true };
    default: {
      const want = pagesOf(o.settings);
      const chapters = ((o.plan as DocPlan | null)?.chapters ?? []).length;
      return { n: want || Math.max(2, Math.ceil(chars / 4 / 230) + (o.kind === "book" ? 1 : 0), chapters), landscape: false };
    }
  }
}

/** What the design adds to an output's price (zero when it isn't made by حيدرا ماكس, or its pages are already designed). */
export function maxUsd(o: Output, chars: number): number {
  if (!isMax(o) || o.kind === "slides") return 0;
  const src = maxSourceFor(o);
  if (src) return deckUsd(deckTodo(o, src, designOf(o)), src.aspect);
  const g = maxPagesGuess(o, chars);
  return deckUsd(Math.min(g.n, 60), g.landscape ? "a4l" : "a4");
}

/** The ceiling of one extra Claude read (kept so a small estimate never reads zero) */
export const maxFloorUsd = () => claudeCeilingUsd(0, 0);

/**
 * The last step of an output made by حيدرا ماكس: its pages designed and checked batch by batch; when all are done, the
 * files (by kind) are made and the output is ready for review. `status` = what the output becomes (review, or the
 * trial's `trial_review` with `first` pages only is not used: a Max output has no trial of its own).
 */
export async function maxFinal(job: Job, o: Output): Promise<StepResult> {
  const design = designOf(o);
  const src = maxSourceFor(o);
  if (!src || !src.briefs.length) throw new UserError("ما فيه محتوى نصمّمه بعد.", 409);
  // «اطلب من حيدرا ماكس» on one page: that page designed again with the request, then looked at like any other
  if (job.kind === "revise" && job.input.page && !job.progress.redesigned) {
    const r = await redesignSlide(o, src, design, Number(job.input.chapter), String(job.input.note ?? ""));
    return { ...r, progress: { ...job.progress, ...(r.progress ?? {}) } };
  }
  const step = await deckStep(o, src, design);
  if (step) return { ...step, progress: { ...job.progress, ...(step.progress ?? {}) } };
  const fresh = await getOutput(job.user_id, o.id);
  const dc = deckContent(fresh, src, design);
  const files = await maxFiles(fresh, dc.deck);
  const { draft: _d, ...rest } = (fresh.content ?? {}) as Record<string, unknown>;
  void _d;
  const base = fresh.kind === "slides" ? fresh.content : { ...rest };
  const next = slotPatch({ ...fresh, content: base } as Output, { deck: dc.deck, unchecked: [], manual: dc.manual });
  await saveOutput(o.id, { status: "review", content: next, files }, { kind: job.kind === "revise" ? "revision" : "final", snapshot: { files: Object.values(files) }, userId: o.user_id });
  return { done: true, stage: "جاهز: افتح «🎨 محرر العرض» لتعدّله وتعرضه" };
}
