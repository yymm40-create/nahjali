// «استخدام المزايا»: a page tells the owner's /admin/use which feature was used — `track("studio.generate")` and
// nothing else. The uses wait a few seconds and go together (a repeat of the same feature within a moment — a slider
// dragged, a double click — is one use); a page being left sends what is waiting. Only the feature's id and a count go:
// the server adds the account (a signed-out visitor is not counted, and after the server says so the page stops
// sending). It never waits, never throws, and a failure is silently dropped.

import type { FeatureId } from "@config/feature-use";

const URL = "/api/feature-use";
/** a repeat of the same feature closer than this to the last one is the same use */
export const SAME_USE_MS = 1500;
/** how long uses wait to go together */
const WAIT_MS = 4000;

/** The uses waiting to be sent: each feature with how many times. */
export function makeBatch(sameUseMs = SAME_USE_MS) {
  const counts = new Map<FeatureId, number>();
  const lastAt = new Map<FeatureId, number>();
  return {
    /** One use; false when it was the same use as the one just before (not counted again). */
    add(id: FeatureId, now: number) {
      const last = lastAt.get(id);
      lastAt.set(id, now);
      if (last != null && now - last < sameUseMs) return false;
      counts.set(id, (counts.get(id) ?? 0) + 1);
      return true;
    },
    /** What is waiting, as the body the server reads, and the batch emptied; null when nothing waits. */
    take(): string | null {
      if (!counts.size) return null;
      const body = JSON.stringify({ uses: Object.fromEntries(counts) });
      counts.clear();
      return body;
    },
  };
}

const batch = makeBatch();
let timer: ReturnType<typeof setTimeout> | undefined;
let off = false;
let bound = false;

function send(leaving: boolean) {
  clearTimeout(timer);
  const body = batch.take();
  if (!body || off) return;
  try {
    // leaving the page: the browser delivers it after the page is gone
    if (leaving && navigator.sendBeacon?.(URL, new Blob([body], { type: "application/json" }))) return;
    void fetch(URL, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true })
      .then((r) => {
        if (r.status === 401) off = true;
      })
      .catch(() => null);
  } catch {
    /* not counted */
  }
}

/** One use of a feature (see config/feature-use.ts). Fire and forget. */
export function track(id: FeatureId): void {
  try {
    if (off || typeof window === "undefined" || !batch.add(id, Date.now())) return;
    if (!bound) {
      bound = true;
      window.addEventListener("pagehide", () => send(true));
      document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && send(true));
    }
    clearTimeout(timer);
    timer = setTimeout(() => send(false), WAIT_MS);
  } catch {
    /* not counted */
  }
}
