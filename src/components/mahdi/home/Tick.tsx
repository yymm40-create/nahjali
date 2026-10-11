"use client";

// «لأجل المهدي» — the check mark of a habit done, in shapes: a round badge, a big bare tick, a ring, a rounded square,
// a scalloped seal. «تلقائي» gives each project its own shape (so the groups are told apart at a glance); the person
// can fix one shape for everything. The choice stays on this device.

import { useCallback, useSyncExternalStore } from "react";
import type { Project } from "@/lib/mahdi/types";

export const TICK_SHAPES = [
  { id: "circle", name: "دائري" },
  { id: "big", name: "خط كبير" },
  { id: "ring", name: "حلقة" },
  { id: "square", name: "مربع" },
  { id: "seal", name: "ختم" },
] as const;
export type TickShape = (typeof TICK_SHAPES)[number]["id"];
export type TickPref = TickShape | "auto";

const KEY = "mahdi:tick";
const listeners = new Set<() => void>();
const read = (): TickPref => {
  try {
    const v = localStorage.getItem(KEY);
    return TICK_SHAPES.some((s) => s.id === v) ? (v as TickShape) : "auto";
  } catch {
    return "auto";
  }
};

/** The person's choice of check shape («auto» = one shape for each project). */
export function useTickPref(): [TickPref, (v: TickPref) => void] {
  const pref = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => "auto" as TickPref,
  );
  const set = useCallback((v: TickPref) => {
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* this time only */
    }
    listeners.forEach((l) => l());
  }, []);
  return [pref, set];
}

/** The shape for a project: the person's fixed one, or by its place among the projects. */
export function shapeFor(pref: TickPref, projectId: string | undefined, projects: { id: string }[]): TickShape {
  if (pref !== "auto") return pref;
  const i = projects.findIndex((p) => p.id === projectId);
  return TICK_SHAPES[(i < 0 ? 0 : i) % TICK_SHAPES.length].id;
}

/** The shape this habit's check takes (reads the choice itself). */
export function useShape(projectId: string | undefined, projects: Pick<Project, "id">[]): TickShape {
  const [pref] = useTickPref();
  return shapeFor(pref, projectId, projects);
}

const CHECK = "M6.5 12.6l3.6 3.7 7.4-8.2";
const SCALLOP = "M12 1.6l2.3 1.9 2.9-.4 1.3 2.7 2.7 1.3-.4 2.9 1.9 2.3-1.9 2.3.4 2.9-2.7 1.3-1.3 2.7-2.9-.4-2.3 1.9-2.3-1.9-2.9.4-1.3-2.7-2.7-1.3.4-2.9L1.6 12l1.9-2.3-.4-2.9 2.7-1.3 1.3-2.7 2.9.4z";

/** A drawn check in `shape`, coloured by the project (`--pc`). */
export default function Tick({ shape, size = 28, className = "" }: { shape: TickShape; size?: number; className?: string }) {
  const c = "var(--pc, var(--m-gold))";
  return (
    <svg className={`m-tick ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      {shape === "circle" && (
        <>
          <circle cx="12" cy="12" r="11" fill={c} />
          <path d={CHECK} stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {shape === "big" && <path d="M2.8 13.4l6.6 6.4L21.4 4.4" stroke={c} strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />}
      {shape === "ring" && (
        <>
          <circle cx="12" cy="12" r="10" stroke={c} strokeWidth="2.4" />
          <path d={CHECK} stroke={c} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {shape === "square" && (
        <>
          <rect x="2" y="2" width="20" height="20" rx="6" fill={c} />
          <path d={CHECK} stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {shape === "seal" && (
        <>
          <path d={SCALLOP} fill={c} />
          <path d={CHECK} stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}
