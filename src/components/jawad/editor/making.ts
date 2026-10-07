// «اصنع لي…»: what «حيدرة» started making with JAWAD AI for this project (kept on this device, so leaving and coming
// back keeps waiting for it). The editor checks the jobs every few seconds; a finished one is brought into the
// project's files and placed where حيدرة said, a failed one is reported (JAWAD AI gives the coins back).

import { useCallback, useEffect, useRef, useState } from "react";
import { postJson } from "@/lib/fetch";
import type { Command } from "@/lib/editor/commands";
import { placeMade } from "@/lib/editor/make";
import type { MakePlan } from "@/lib/editor/make-any";
import type { JobView } from "@/lib/jawad/labels";
import type { EditorAsset } from "./types";

export interface Making {
  jobId: string;
  kind: MakePlan["kind"];
  place: MakePlan["place"];
  at: number;
  name: string;
  started: number;
}

const key = (projectId: string) => `jw-editor-making-${projectId}`;
const EVENT = "jw-making";
const POLL_MS = 5000;

function load(projectId: string): Making[] {
  try {
    const v = JSON.parse(localStorage.getItem(key(projectId)) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => x && typeof x.jobId === "string") : [];
  } catch {
    return [];
  }
}
function save(projectId: string, list: Making[]) {
  try {
    localStorage.setItem(key(projectId), JSON.stringify(list.slice(-20)));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

/** Starts a priced plan (JAWAD AI checks it again and takes its coins), and waits for it. */
export async function startMaking(projectId: string, plan: MakePlan) {
  const r = await postJson<{ job: JobView }>(`/api/jawad/editor/projects/${projectId}`, { action: "make_start", key: `ed-${crypto.randomUUID()}`, plan });
  save(projectId, [...load(projectId), { jobId: r.job.id, kind: plan.kind, place: plan.place, at: plan.at, name: plan.name, started: Date.now() }]);
  return r.job;
}

/** The editor's side: checks the jobs started for this project and places what is ready. */
export function useMaking(o: { projectId: string; run: (c: Command[], opts: { label: string }) => unknown; onAssets: (a: EditorAsset[]) => void; flash: (text: string, bad?: boolean) => void; readOnly: boolean }) {
  const { projectId, run, onAssets, flash, readOnly } = o;
  const [list, setList] = useState<Making[]>([]);
  const busy = useRef(new Set<string>());
  useEffect(() => {
    const read = () => setList(load(projectId));
    read();
    window.addEventListener(EVENT, read);
    return () => window.removeEventListener(EVENT, read);
  }, [projectId]);

  const check = useCallback(async () => {
    const now = load(projectId);
    if (!now.length) return;
    const r = await fetch(`/api/jawad/jobs?ids=${now.map((m) => m.jobId).join(",")}`).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    const jobs = (r?.jobs ?? []) as JobView[];
    for (const m of now) {
      const j = jobs.find((x) => x.id === m.jobId);
      if (!j || busy.current.has(m.jobId)) continue;
      const drop = () => save(projectId, load(projectId).filter((x) => x.jobId !== m.jobId));
      if (j.status === "failed" || j.status === "cancelled") {
        drop();
        flash(`ما نجح صنع «${m.name}»: ${j.error || "تعذّر عند المزوّد"} (ما انخصم منك شي)`, true);
        continue;
      }
      const out = j.status === "succeeded" ? j.outputs[0] : undefined;
      if (!out) continue;
      busy.current.add(m.jobId);
      try {
        const res = await postJson<{ assets: EditorAsset[] }>(`/api/jawad/editor/projects/${projectId}`, {
          action: "import",
          items: j.outputs.map((x, i) => ({ source: "jawad", id: x.id, durationMs: x.durationMs, width: x.width, height: x.height, hasAudio: x.kind !== "image", name: j.outputs.length > 1 ? `${m.name} ${i + 1}` : m.name })),
        });
        onAssets(res.assets);
        drop();
        // the file must be known to the timeline before a clip is laid on it
        await new Promise((ok) => setTimeout(ok, 0));
        const cmds = res.assets[0] ? placeMade(m.kind, res.assets[0].id, m.place, m.at) : [];
        if (cmds.length) run(cmds, { label: `حيدرة صنع: ${m.name.slice(0, 30)}` });
        flash(`وصل «${m.name}» ✓${cmds.length ? "" : " (في الملفات)"}`);
      } catch {
        /* tried again at the next check */
      } finally {
        busy.current.delete(m.jobId);
      }
    }
  }, [projectId, run, onAssets, flash]);

  const waiting = list.length;
  useEffect(() => {
    if (!waiting || readOnly) return;
    const first = setTimeout(check, 1500);
    const t = setInterval(check, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [waiting, readOnly, check]);
  return list;
}
