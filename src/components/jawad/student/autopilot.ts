"use client";

// «الطالب الذكي» — «تخطَّ ودع المساعد يقرر»: the next step is chosen and approved automatically, with sensible
// choices for every setting (the level, the material, a style picked at random), until the student stops it.
// For one step, or for the whole way. Paid steps are charged at their price as they run.

import { useCallback, useEffect, useRef, useState } from "react";
import { autoSettings } from "@/lib/jawad/student/defaults";
import { newKey, post, type OutputView, type ProjectState } from "./client";

/** Written outputs that can also be drawn as pages by GPT Image 2 (lib/jawad/student/pictures.ts). */
export const PICTURE_KINDS: string[] = ["summary", "explain", "transcript", "book", "quiz"];

export interface AutoAction {
  label: string;
  run: () => Promise<unknown>;
}

const configured = (o: OutputView) => Object.keys(o.settings).some((k) => !k.startsWith("_"));

/** The next thing to do, or null when the student is needed (nothing uploaded, no output chosen) or all is done. */
export function nextAuto(s: ProjectState): AutoAction | null {
  const pid = s.project.id;
  const projectAct = (body: Record<string, unknown>) => post(`/api/jawad/student/projects/${pid}`, body);
  const outAct = (id: string, body: Record<string, unknown>) => post(`/api/jawad/student/outputs/${id}`, body);
  const paid = (body: Record<string, unknown>) => projectAct({ ...body, confirm: true, key: newKey() });
  const outPaid = (id: string, body: Record<string, unknown>) => outAct(id, { ...body, confirm: true, key: newKey() });

  const ready = s.sources.filter((x) => x.status === "ready");
  const unread = ready.some((x) => (x.kind === "pdf" ? x.pagesDone < x.pages : x.pagesDone < 1));
  switch (s.project.stage) {
    case "sources":
    case "review":
      if (!ready.length) return null;
      if (unread || s.coverage.missing.length) return { label: "استخراج النص", run: () => paid({ action: "extract" }) };
      if (s.coverage.approved < s.coverage.total) return { label: "اعتماد كل الصفحات", run: () => projectAct({ action: "segments_approve_all" }) };
      if (s.coverage.complete) return { label: "اعتماد النص الكامل", run: () => projectAct({ action: "text_approve" }) };
      return null;
    case "understanding": {
      const u = s.understanding;
      if (!u || u.content.basedOnText !== s.project.text_version) return { label: "فهم المادة", run: () => paid({ action: "understand" }) };
      return { label: "اعتماد الفهم", run: () => projectAct({ action: "understanding_approve" }) };
    }
    case "scope":
      if (s.project.web_search && s.project.allow_additions !== null) {
        if (!s.research) return { label: "البحث الخارجي", run: () => paid({ action: "research" }) };
        return { label: "اعتماد البحث", run: () => projectAct({ action: "research_approve" }) };
      }
      // the assistant's choice: explanations and examples allowed (marked as additions), no paid web search
      return { label: "تحديد حدود المصدر", run: () => projectAct({ action: "scope", allowAdditions: true, webSearch: false }) };
    case "outputs": {
      // nothing chosen yet: the student chooses (the outputs page)
      if (!s.outputs.length) return null;
      for (const o of [...s.outputs].sort((a, b) => a.ord - b.ord)) {
        // pages drawn by GPT Image 2, when that was the student's choice: after the written output is done
        const draw = String(o.settings.pictures ?? "");
        if (o.status === "done" && (draw === "high" || draw === "medium") && PICTURE_KINDS.includes(o.kind) && !o.files.includes("pictures_pdf")) {
          return { label: `${o.title}: رسم الصفحات بـ GPT Image 2`, run: () => outPaid(o.id, { action: "pictures", quality: draw }) };
        }
        if (o.status === "done" || o.status === "waiting") continue;
        // a failed output is tried again from where it stopped (twice at most: see the repeat guard below)
        if (o.status === "failed") {
          if (o.kind === "transcript" || (o.plan && o.planApproved)) return { label: `${o.title}: إعادة التصنيع`, run: () => outPaid(o.id, { action: "final" }) };
          return { label: `${o.title}: إعادة إعداد الخطة`, run: () => outPaid(o.id, { action: "plan" }) };
        }
        if (["planning", "running", "trial_running"].includes(o.status)) return null;
        if (o.kind === "transcript") {
          if (o.status === "settings") return { label: `${o.title}: إنشاء`, run: () => outPaid(o.id, { action: "final" }) };
        } else if (o.status === "settings") {
          if (!configured(o)) return { label: `${o.title}: اختيار الإعدادات`, run: () => outAct(o.id, { action: "settings", settings: autoSettings(o.kind, s.project.level) }) };
          return { label: `${o.title}: إعداد الخطة`, run: () => outPaid(o.id, { action: "plan" }) };
        }
        if (o.status === "plan_review") return { label: `${o.title}: اعتماد الخطة`, run: () => outAct(o.id, { action: "plan_approve" }) };
        if (o.status === "trial_offer") return { label: `${o.title}: تخطي التجربة`, run: () => outAct(o.id, { action: "skip_trial" }) };
        if (o.status === "ready" || o.status === "trial_review") return { label: `${o.title}: التصنيع`, run: () => outPaid(o.id, { action: "final" }) };
        if (o.status === "review") return { label: `${o.title}: الاعتماد`, run: () => outAct(o.id, { action: "approve" }) };
        return null;
      }
      return null;
    }
  }
  return null;
}

/**
 * Runs the next action whenever nothing is running. `scope`: "step" stops when the project leaves the stage it started
 * in; "material" reads what was added and understands it, then stops for the student to approve the understanding;
 * "all" goes on to the end. Stops by itself on any error, or when the student is needed.
 */
export function useAutopilot(state: ProjectState, busy: boolean, refresh: () => Promise<void>) {
  const [mode, setMode] = useState<null | { scope: "step" | "material" | "all"; stage: string }>(null);
  const [doing, setDoing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const acting = useRef(false);
  const [tick, setTick] = useState(0);
  // the same action again and again (a step that keeps failing): stop instead of looping
  const last = useRef<{ label: string; n: number }>({ label: "", n: 0 });

  const stop = useCallback(() => {
    setMode(null);
    setDoing(null);
  }, []);
  const start = useCallback(
    (scope: "step" | "material" | "all") => {
      setError(null);
      last.current = { label: "", n: 0 };
      setMode({ scope, stage: state.project.stage });
    },
    [state.project.stage],
  );

  useEffect(() => {
    if (!mode || busy || acting.current) return;
    // decided a moment after the render (never during it)
    const t = setTimeout(() => {
    if (mode.scope === "step" && state.project.stage !== mode.stage) {
      stop();
      return;
    }
    const next = nextAuto(state);
    // «المادة»: up to the understanding, which the student approves
    if (mode.scope === "material" && next && (!["sources", "review", "understanding"].includes(state.project.stage) || next.label === "اعتماد الفهم")) {
      stop();
      return;
    }
    if (!next) {
      // say why it stopped (a child would think the button did nothing)
      const failed = state.outputs.find((o) => o.status === "failed");
      if (["sources", "review"].includes(state.project.stage) && !state.sources.some((x) => x.status === "ready")) setError("أضف مادتك أولًا (صور أو PDF أو نص)، وبعدها اضغط المساعد مرة ثانية.");
      else if (failed) setError(`تعثّر «${failed.title}». افتحه واضغط «أعد المحاولة»، وبعدها شغّل المساعد مرة ثانية.`);
      stop();
      return;
    }
    last.current = last.current.label === next.label ? { label: next.label, n: last.current.n + 1 } : { label: next.label, n: 1 };
    if (last.current.n > 2) {
      setError(`توقف المساعد عند «${next.label}»: الخطوة لم تكتمل. راجعها ثم أعد التشغيل.`);
      stop();
      return;
    }
    acting.current = true;
    setDoing(next.label);
    next
      .run()
      .then(() => refresh())
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        stop();
      })
      .finally(() => {
        acting.current = false;
        setTick((n) => n + 1);
      });
    }, 400);
    return () => clearTimeout(t);
  }, [mode, busy, state, refresh, stop, tick]);

  return { mode, doing, error, start, stop };
}
