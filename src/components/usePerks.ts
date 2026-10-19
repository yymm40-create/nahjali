"use client";

// What the person's codes give that the pages must show (the owner's «الأكواد» gifts): «بسعر الأداة» (the coin turns orange
// and every price is the tool's own cost) and the Claude ceiling. Asked once from the server per tab (kept a couple of
// minutes), shared by every component; anyone without such a code gets the plain defaults and nothing changes for them.

import { useSyncExternalStore } from "react";
import type { ClaudeModelKey } from "@config/claude-models";

export interface PagePerks {
  atCost: boolean;
  claudeModel: ClaudeModelKey | null;
}
const NONE: PagePerks = { atCost: false, claudeModel: null };
const KEY = "jw-perks";
const KEEP_MS = 120_000;

let value: PagePerks = NONE;
let started = false;
const subs = new Set<() => void>();

const readKept = (): PagePerks | null => {
  try {
    const raw = sessionStorage.getItem(KEY);
    const j = raw ? (JSON.parse(raw) as { v: PagePerks; at: number }) : null;
    return j && Date.now() - j.at < KEEP_MS ? j.v : null;
  } catch {
    return null;
  }
};

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  const kept = readKept();
  if (kept) {
    value = kept;
    return;
  }
  fetch("/api/access/perks", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<Partial<PagePerks>>) : NONE))
    .then((j) => {
      value = { atCost: j.atCost === true, claudeModel: (j.claudeModel as ClaudeModelKey | null | undefined) ?? null };
      try {
        sessionStorage.setItem(KEY, JSON.stringify({ v: value, at: Date.now() }));
      } catch {
        /* private window: asked again next time */
      }
      subs.forEach((f) => f());
    })
    .catch(() => {});
}

/** After a code is entered: forget what was kept, so the next page asks again. */
export function forgetPerks() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing kept */
  }
}

export function usePerks(): PagePerks {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      start();
      return () => void subs.delete(cb);
    },
    () => value,
    () => NONE,
  );
}

/** Whether every price this person sees is the tool's own cost (their coin is orange). */
export const useAtCost = () => usePerks().atCost;
