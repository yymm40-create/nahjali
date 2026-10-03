// BROWSER ONLY. The app's data on the device: a server snapshot, plus logs the user changed that the server hasn't
// confirmed yet. A tap updates the screen at once; the change is sent in the background, kept on the device while
// offline, and sent again when the connection returns. If two devices edit the same day, the newest edit wins.
import { todayIn, type ISODate } from "../engine";
import { t } from "../i18n";
import type { LogOp, Profile, Snapshot } from "../types";
import { ApiError, mahdiFetch } from "./fetch";

export interface StoreState {
  snap: Snapshot;
  /** What the screen shows: the snapshot's logs with the pending edits on top. */
  logs: Snapshot["logs"];
  pending: LogOp[];
  online: boolean;
  syncing: boolean;
  syncError: string | null;
  today: ISODate;
}

const opKey = (o: { habitId: string; date: string }) => `${o.habitId}|${o.date}`;

function withOps(logs: Snapshot["logs"], ops: LogOp[]): Snapshot["logs"] {
  if (!ops.length) return logs;
  const out = { ...logs };
  for (const o of ops) out[o.habitId] = { ...(out[o.habitId] ?? {}), [o.date]: o.value };
  return out;
}

export type MahdiStore = ReturnType<typeof createStore>;

export function createStore(initial: Snapshot) {
  const queueKey = `mahdi:queue:${initial.profile.userId}`;
  const listeners = new Set<() => void>();

  const loadQueue = (): LogOp[] => {
    try {
      const raw = JSON.parse(localStorage.getItem(queueKey) ?? "[]");
      return Array.isArray(raw) ? raw.filter((o) => o && typeof o.habitId === "string" && typeof o.date === "string") : [];
    } catch {
      return [];
    }
  };
  const saveQueue = (q: LogOp[]) => {
    try {
      if (q.length) localStorage.setItem(queueKey, JSON.stringify(q));
      else localStorage.removeItem(queueKey);
    } catch {}
  };

  // The saved queue is restored after the first render (restoreQueue), so server and browser render the same markup
  let state: StoreState = {
    snap: initial,
    logs: initial.logs,
    pending: [],
    online: true,
    syncing: false,
    syncError: null,
    today: initial.today,
  };

  const set = (patch: Partial<StoreState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  let flushing = false;
  let failures = 0;
  let lastSync = Date.now();
  let onSynced: (() => void) | null = null;

  const schedule = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(flush, ms);
  };

  async function flush() {
    if (flushing || state.pending.length === 0) return;
    if (!navigator.onLine) {
      set({ online: false });
      return;
    }
    flushing = true;
    set({ syncing: true });
    const batch = state.pending.slice(0, 100);
    try {
      const { results } = await mahdiFetch<{ results: { habitId: string; date: string; value?: number; error?: string }[] }>("/api/mahdi/logs", {
        method: "PUT",
        json: { ops: batch },
      });
      // Drop the edits the server answered, unless the user changed that day again meanwhile
      const sent = new Map(batch.map((o) => [opKey(o), o.ts]));
      const remaining = state.pending.filter((o) => sent.get(opKey(o)) !== o.ts);
      const serverLogs = { ...state.snap.logs };
      let refused: string | null = null;
      for (const r of results) {
        if (r.error) refused = r.error;
        if (typeof r.value === "number") serverLogs[r.habitId] = { ...(serverLogs[r.habitId] ?? {}), [r.date]: r.value };
      }
      saveQueue(remaining);
      failures = 0;
      set({
        snap: { ...state.snap, logs: serverLogs },
        logs: withOps(serverLogs, remaining),
        pending: remaining,
        syncing: false,
        online: true,
        syncError: refused,
      });
      if (remaining.length) schedule(0);
      else onSynced?.();
    } catch (e) {
      failures++;
      const offline = !navigator.onLine || (e instanceof ApiError && e.status === 0);
      set({ syncing: false, online: !offline, syncError: offline ? null : (e as Error).message || t.common.syncFailed });
      schedule(Math.min(60_000, 3_000 * 2 ** Math.min(failures, 5)));
    } finally {
      flushing = false;
    }
  }

  function replaceSnapshot(snap: Snapshot) {
    lastSync = Date.now();
    set({ snap, logs: withOps(snap.logs, state.pending), today: snap.today });
  }

  return {
    getState: () => state,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },

    /** Sets a day's total for a habit (optimistic). Returns the previous value, for "undo". */
    setLog(habitId: string, date: ISODate, value: number) {
      const prev = state.logs[habitId]?.[date] ?? 0;
      const op: LogOp = { habitId, date, value: Math.max(0, Math.round(value * 100) / 100), ts: Date.now() };
      const pending = [...state.pending.filter((o) => opKey(o) !== opKey(op)), op];
      saveQueue(pending);
      set({ pending, logs: withOps(state.logs, [op]), syncError: null });
      schedule(350);
      return prev;
    },

    flush,
    replaceSnapshot,

    /** Puts back edits saved on this device during an earlier visit (e.g. made offline), then sends them. */
    restoreQueue() {
      const saved = loadQueue();
      const known = new Set(state.pending.map(opKey));
      const extra = saved.filter((o) => !known.has(opKey(o)));
      if (extra.length) set({ pending: [...extra, ...state.pending], logs: withOps(state.logs, extra) });
      set({ online: navigator.onLine });
      return flush();
    },

    setProfile(profile: Profile) {
      const today = todayIn(profile.timeZone);
      set({ snap: { ...state.snap, profile }, today });
    },

    /** Structural changes (projects, habits): need the network; the server answers with a fresh snapshot. */
    async mutate<T = object>(url: string, method: string, json?: unknown): Promise<T & { snapshot?: Snapshot }> {
      if (!navigator.onLine) throw new ApiError(t.common.needsConnection, 0);
      const res = await mahdiFetch<T & { snapshot?: Snapshot }>(url, { method, json });
      if (res.snapshot) replaceSnapshot(res.snapshot);
      return res;
    },

    /** Fetches a fresh snapshot (after returning to the app). Edits waiting to be sent are kept on top. */
    async refresh(force = false) {
      if (!navigator.onLine || (!force && Date.now() - lastSync < 60_000)) return;
      await flush();
      try {
        replaceSnapshot(await mahdiFetch<Snapshot>("/api/mahdi/sync"));
      } catch {}
    },

    /** Called after logs reach the server (used to check milestones). */
    setOnSynced(fn: (() => void) | null) {
      onSynced = fn;
    },

    setSnapPart(part: Partial<Snapshot>) {
      set({ snap: { ...state.snap, ...part } });
    },

    setOnline(online: boolean) {
      set({ online });
      if (online) schedule(0);
    },

    /** Re-checks "today" (called every minute, so the app rolls over at midnight in the user's time zone). */
    tick() {
      const today = todayIn(state.snap.profile.timeZone);
      if (today !== state.today) set({ today });
    },
  };
}
