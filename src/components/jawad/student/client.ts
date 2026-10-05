// «الطالب الذكي» — browser helpers and the state shapes the pages receive.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Design } from "@config/jawad/student";

export interface JobView {
  id: string;
  kind: string;
  outputId: string | null;
  status: "queued" | "running" | "succeeded" | "failed";
  stage: string;
  progress: Record<string, unknown>;
  error: string | null;
  coins: number;
}

export interface SegmentView {
  id: string;
  sid: string;
  sourceId: string;
  page: number;
  part: number;
  label: string;
  raw: string;
  text: string;
  uncertain: string[];
  status: "pending" | "approved";
}

export interface OutputView {
  id: string;
  kind: "summary" | "explain" | "transcript" | "book" | "slides" | "audio" | "quiz";
  ord: number;
  title: string;
  settings: Record<string, unknown> & { design?: Design; _styleDraft?: Design | null };
  status: string;
  stale: boolean;
  dependsOn: string | null;
  plan: unknown;
  planApproved: boolean;
  trial: unknown;
  trialCoins: number;
  content: unknown;
  files: string[];
  approved: boolean;
  requests: { at: string; kind: "edit" | "other"; text: string }[];
  error: string | null;
  updatedAt: string;
}

export interface Understanding {
  topic: string;
  materialType: string;
  overview: string;
  sections: { title: string; about: string; segments: string[] }[];
  ambiguous: { note: string; segments: string[] }[];
  unsure: string[];
  coverage: { covered: number; total: number; missing: string[] };
  basedOnText: number;
}

export interface Research {
  question: string;
  paragraphs: { text: string; cites: number[] }[];
  sources: { url: string; title: string; pageAge: string | null; accessedAt: string }[];
  searches: number;
}

export interface ProjectState {
  project: {
    id: string;
    title: string;
    level: string;
    audience: string;
    stage: "sources" | "review" | "understanding" | "scope" | "outputs";
    text_version: number;
    understanding_version: number;
    research_version: number;
    allow_additions: boolean | null;
    web_search: boolean | null;
    expiresAt: string;
  };
  sources: { id: string; ord: number; kind: "text" | "image" | "pdf"; name: string; mime: string; bytes: number; pages: number; pagesDone: number; status: string; body: string | null }[];
  segments: SegmentView[];
  coverage: { missing: string[]; duplicate: string[]; total: number; approved: number; complete: boolean };
  textVersion: { version: number; at: string } | null;
  understanding: { version: number; approved: boolean; content: Understanding; note: string } | null;
  research: { version: number; approved: boolean; content: Research } | null;
  outputs: OutputView[];
  jobs: JobView[];
  balance: number | null;
}

export async function post<T = Record<string, unknown>>(url: string, body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("تعذّر الاتصال. تأكد من الإنترنت وجرّب مرة ثانية.");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "صار خطأ غير متوقع.");
  return json as T;
}

export const newKey = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, "");

/** The project's state, refreshed while something is running (and on demand). */
export function useProject(initial: ProjectState) {
  const [state, setState] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const busy = state.jobs.some((j) => j.status === "queued" || j.status === "running");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/jawad/student/projects/${initial.project.id}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "تعذّر التحديث.");
      setState(json as ProjectState);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر التحديث.");
    }
  }, [initial.project.id]);

  useEffect(() => {
    if (!busy) return;
    timer.current = setTimeout(refresh, document.hidden ? 8000 : 4000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [busy, state, refresh]);

  const act = useCallback(
    async (body: Record<string, unknown>) => {
      const r = await post(`/api/jawad/student/projects/${initial.project.id}`, body);
      await refresh();
      return r;
    },
    [initial.project.id, refresh],
  );
  const actOutput = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      const r = await post(`/api/jawad/student/outputs/${id}`, body);
      await refresh();
      return r;
    },
    [refresh],
  );
  return { state, refresh, act, actOutput, busy, error };
}

export const fileUrl = (outputId: string, name: string, inline = false) => `/api/jawad/student/outputs/${outputId}/file?name=${name}${inline ? "&inline=1" : ""}`;

/** @font-face rules that load the fonts from the site (for the live previews). */
export function fontFacesUrl(ids: { id: string; files: { weight: string }[]; family: string }[]) {
  return ids.map((f) => f.files.map((file, i) => `@font-face{font-family:"${f.family}";src:url(/api/jawad/student/fonts/${f.id}?i=${i}) format("truetype");font-weight:${file.weight};font-display:swap}`).join("\n")).join("\n");
}
