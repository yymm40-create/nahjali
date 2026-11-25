// «من فكرة لمسودة» on the page: the approved plan's parts made one after another (JAWAD AI lets only a few jobs run at
// once, so a queue starts the next as one finishes), each brought into the project's files when ready, and — once
// nothing is left on its way — the draft built as one change on the timeline. Kept on this device per project, so
// leaving and coming back carries on. A part that failed waits for «أعد هالمشهد» (its job was refunded by JAWAD AI);
// one made again after the draft was built goes straight into its own place.

import { useCallback, useEffect, useRef, useState } from "react";
import { postJson } from "@/lib/fetch";
import { track } from "@/lib/feature-track";
import type { Command } from "@/lib/editor/commands";
import { assembleDraft, draftCommands, nextToStart, placeLate, retryParts, runSummary, type BuiltInfo, type DraftFile, type DraftLook, type DraftOptions, type DraftPlan, type PartRun } from "@/lib/editor/draft";
import type { Timeline } from "@/lib/editor/model";
import type { JobView } from "@/lib/jawad/labels";
import type { EditorAsset } from "./types";

/** JAWAD AI's limit on jobs running at once for one person (config/jawad/brand.ts MAX_ACTIVE_JOBS) */
const AT_ONCE = 3;
const TICK_MS = 4000;

export interface DraftRun {
  v: 1;
  /** this run's id (the jobs' keys are made from it, so a click sent twice never makes a part twice) */
  id: string;
  plan: DraftPlan;
  opts: DraftOptions;
  look: DraftLook;
  parts: PartRun[];
  built: BuiltInfo | null;
  /** the timeline refused the draft (a locked track, too many clips…): not tried again until «جرّب البناء مرة ثانية» */
  buildError?: string | null;
  at: number;
}

const key = (projectId: string) => `jw-editor-draft-${projectId}`;
export function loadRun(projectId: string): DraftRun | null {
  try {
    const v = JSON.parse(localStorage.getItem(key(projectId)) ?? "null");
    return v && v.v === 1 && Array.isArray(v.parts) && v.plan ? (v as DraftRun) : null;
  } catch {
    return null;
  }
}
function saveRun(projectId: string, r: DraftRun | null) {
  try {
    if (r) localStorage.setItem(key(projectId), JSON.stringify(r));
    else localStorage.removeItem(key(projectId));
  } catch {}
}

/** A request whose refusal matters (busy, price changed): the status and the body, never thrown. */
async function call(projectId: string, body: unknown) {
  try {
    const res = await fetch(`/api/jawad/editor/projects/${projectId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
    return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  } catch {
    return { status: 0, body: { error: "تعذّر الاتصال." } };
  }
}

/** A sound's or video's real length when the job didn't say (read from the file in the browser). */
function measure(url: string | null, kind: "audio" | "video"): Promise<number | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((ok) => {
    const el = document.createElement(kind);
    const done = (v: number | null) => {
      el.removeAttribute("src");
      ok(v);
    };
    const t = setTimeout(() => done(null), 10_000);
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      clearTimeout(t);
      done(Number.isFinite(el.duration) && el.duration > 0 ? Math.round(el.duration * 1000) : null);
    };
    el.onerror = () => {
      clearTimeout(t);
      done(null);
    };
    el.src = url;
  });
}

export function useDraftRun(o: { projectId: string; tl: Timeline; run: (c: Command[], opts: { label: string; by?: "haidara" }) => unknown; onAssets: (a: EditorAsset[]) => void; flash: (text: string, bad?: boolean) => void; readOnly: boolean }) {
  const { projectId, run, onAssets, flash, readOnly } = o;
  const [state, setState] = useState<DraftRun | null>(null);
  const ref = useRef<DraftRun | null>(null);
  const tlRef = useRef(o.tl);
  useEffect(() => {
    tlRef.current = o.tl;
  }, [o.tl]);
  const set = useCallback(
    (r: DraftRun | null) => {
      ref.current = r;
      saveRun(projectId, r);
      setState(r);
    },
    [projectId],
  );
  useEffect(() => {
    const t = setTimeout(() => set(loadRun(projectId)), 0);
    return () => clearTimeout(t);
  }, [projectId, set]);

  const patchParts = (fn: (p: PartRun) => PartRun) => {
    const r = ref.current;
    if (r) set({ ...r, parts: r.parts.map(fn) });
  };

  const busy = useRef(false);
  const tick = useCallback(async () => {
    if (busy.current || readOnly) return;
    busy.current = true;
    try {
      // 1. start what fits
      for (const p of nextToStart(ref.current?.parts ?? [], AT_ONCE)) {
        const r = ref.current;
        if (!r) return;
        patchParts((x) => (x.key === p.key ? { ...x, state: "starting" } : x));
        const res = await call(projectId, { action: "draft_start", plan: r.plan, ...r.opts, run: r.id, only: [p.key], attempt: p.attempt, expectedCoins: p.coins });
        const got = (res.body.parts as { key: string; job?: JobView; error?: string; busy?: boolean }[] | undefined)?.find((x) => x.key === p.key);
        if (res.status === 409 && res.body.code === "price_changed") {
          const coins = Number(res.body.coins) || p.coins;
          patchParts((x) => (x.key === p.key ? { ...x, state: "failed", coins, error: `السعر صار أعلى؛ اضغط «أعد» إذا موافق.` } : x));
        } else if (got?.job) patchParts((x) => (x.key === p.key ? { ...x, state: "waiting", jobId: got.job!.id, error: null } : x));
        else if (got?.busy || res.status === 429) patchParts((x) => (x.key === p.key ? { ...x, state: "queued" } : x));
        else patchParts((x) => (x.key === p.key ? { ...x, state: "failed", error: String(got?.error ?? res.body.error ?? "تعذّر البدء.") } : x));
      }

      // 2. ask about what is on its way
      const waiting = (ref.current?.parts ?? []).filter((x) => x.state === "waiting" && x.jobId);
      if (waiting.length) {
        const r = await fetch(`/api/jawad/jobs?ids=${waiting.map((x) => x.jobId).join(",")}`, { cache: "no-store" }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
        const jobs = (r?.jobs ?? []) as JobView[];
        const ready: { part: PartRun; job: JobView }[] = [];
        for (const part of waiting) {
          const j = jobs.find((x) => x.id === part.jobId);
          if (!j) continue;
          if (j.status === "failed" || j.status === "cancelled") patchParts((x) => (x.key === part.key ? { ...x, state: "failed", error: `${j.error || "تعذّر عند المزوّد"} (رجعت نقوده)` } : x));
          else if (j.status === "succeeded" && j.outputs[0]) ready.push({ part, job: j });
        }
        if (ready.length) {
          try {
            const res = await postJson<{ assets: EditorAsset[] }>(`/api/jawad/editor/projects/${projectId}`, {
              action: "import",
              items: ready.map(({ part, job }) => {
                const x = job.outputs[0];
                return { source: "jawad", id: x.id, durationMs: x.durationMs, width: x.width, height: x.height, hasAudio: x.kind !== "image", name: `${ref.current?.plan.title || "مسودة"} · ${part.key}` };
              }),
            });
            onAssets(res.assets);
            for (const [i, { part, job }] of ready.entries()) {
              const a = res.assets[i];
              if (!a) continue;
              const ms = a.kind === "image" ? null : (a.durationMs ?? job.outputs[0].durationMs ?? (await measure(a.url, a.kind === "audio" ? "audio" : "video")));
              patchParts((x) => (x.key === part.key ? { ...x, state: "ready", assetId: a.id, durationMs: ms, error: null } : x));
            }
            // the files must be known to the timeline before clips are laid on them
            await new Promise((ok) => setTimeout(ok, 0));
          } catch {
            // brought in at the next check
          }
        }
      }

      // 3. a late part (made again) goes into its place; once everything is settled, the draft is built
      const r = ref.current;
      if (!r) return;
      const fileOf = (p: PartRun): DraftFile | undefined => (p.assetId ? { assetId: p.assetId, kind: p.kind === "image" ? "image" : p.kind === "video" ? "video" : "audio", durationMs: p.durationMs ?? null } : undefined);
      if (r.built) {
        for (const p of r.parts.filter((x) => x.state === "ready")) {
          const f = fileOf(p);
          const cmds = f ? placeLate(r.built, p, f) : [];
          if (cmds.length) run(cmds, { label: `المسودة: ${p.kind === "music" ? "الموسيقى" : `المشهد ${(p.scene ?? 0) + 1}`}`, by: "haidara" });
          patchParts((x) => (x.key === p.key ? { ...x, state: "placed" } : x));
        }
        return;
      }
      const sum = runSummary(r.parts);
      if (r.buildError || !sum.settled || !r.parts.some((x) => x.state === "ready")) return;
      const files = Object.fromEntries(r.parts.filter((x) => x.state === "ready").map((x) => [x.key, fileOf(x)]));
      const b = assembleDraft(r.plan, r.opts, files, r.look);
      const done = run(draftCommands(b, tlRef.current, r.plan.title), { label: `من فكرة لمسودة: ${(r.plan.title || "مسودة").slice(0, 30)}`, by: "haidara" });
      if (!done) {
        set({ ...r, buildError: "ما قدرت أحط المسودة على التايملاين (شوف الرسالة اللي طلعت)." });
        return;
      }
      track("editor.draft_built");
      set({ ...r, built: b.info, parts: r.parts.map((x) => (x.state === "ready" ? { ...x, state: "placed" } : x)) });
      flash(sum.failed ? `انبنت المسودة ✓ — ${sum.failed} جزء ما نجح، أعده من نافذة المسودة.` : "انبنت المسودة على التايملاين ✓ (تراجع واحد يشيلها)");
    } finally {
      busy.current = false;
    }
    // patchParts reads the ref; it changes with nothing else
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, readOnly, run, onAssets, flash, set]);

  const live = !!state && !state.buildError && (!state.built || state.parts.some((x) => x.state !== "placed" && x.state !== "failed" && x.state !== "stopped"));
  useEffect(() => {
    if (!live || readOnly) return;
    const first = setTimeout(tick, 800);
    const t = setInterval(tick, TICK_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [live, readOnly, tick]);

  return {
    state,
    /** the approved plan sent off */
    begin: (r: Omit<DraftRun, "v" | "id" | "built" | "at">) => {
      track("editor.draft_start");
      set({ ...r, v: 1, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, built: null, at: Date.now() });
    },
    retry: (keys: string[]) => {
      const r = ref.current;
      if (!r || !keys.length) return;
      track("editor.draft_retry");
      set({ ...r, parts: retryParts(r.parts, keys) });
    },
    /** what hasn't started stays unmade (nothing is taken for it); the draft is built with what is ready */
    stop: () => patchParts((x) => (x.state === "queued" ? { ...x, state: "stopped", error: "وقّفته" } : x)),
    clear: () => set(null),
    /** after a refused build: try putting the draft on the timeline again */
    rebuild: () => {
      const r = ref.current;
      if (r) set({ ...r, buildError: null });
    },
  };
}
