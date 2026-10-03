"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { UNDO_MS } from "@config/mahdi";
import { buildTimeline, type Item, type Timeline } from "@/lib/mahdi/engine";
import { createStore, type MahdiStore, type StoreState } from "@/lib/mahdi/client/store";
import { challengeHabits, toItems } from "@/lib/mahdi/client/derive";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import type { Habit, Snapshot } from "@/lib/mahdi/types";

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
  /** A new toast with the same key replaces the old one (e.g. several taps on one habit). */
  key?: string;
}

interface Ctx {
  store: MahdiStore;
  state: StoreState;
  items: Item[];
  /** Personal habits plus joined challenges (as habits). */
  allHabits: Habit[];
  timeline: Timeline;
  toasts: Toast[];
  toast: (message: string, action?: Toast["action"], key?: string) => void;
  dismiss: (id: number) => void;
  /** Milestones just reached, waiting for their reveal. */
  revealed: string[];
  closeReveal: () => void;
}

const MahdiContext = createContext<Ctx | null>(null);

export function useMahdi() {
  const v = useContext(MahdiContext);
  if (!v) throw new Error("useMahdi outside MahdiProvider");
  return v;
}

export default function MahdiProvider({ initial, children }: { initial: Snapshot; children: React.ReactNode }) {
  const [store] = useState(() => createStore(initial));
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);

  // A newer server snapshot (e.g. after router.refresh) replaces the device copy
  const seen = useRef(initial);
  useEffect(() => {
    if (initial !== seen.current) {
      seen.current = initial;
      store.replaceSnapshot(initial);
    }
  }, [initial, store]);

  useEffect(() => {
    store.restoreQueue(); // edits left on the device from a previous visit
    const online = () => store.setOnline(true);
    const offline = () => store.setOnline(false);
    const visible = () => {
      if (document.visibilityState === "visible") {
        store.tick();
        store.refresh();
      }
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visible);
    const clock = setInterval(() => store.tick(), 60_000);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visible);
      clearInterval(clock);
    };
  }, [store]);

  const { snap } = state;
  const allHabits = useMemo(() => [...snap.habits, ...challengeHabits(snap)], [snap]);
  const items = useMemo(() => toItems(allHabits, state.logs), [allHabits, state.logs]);
  const timeline = useMemo(
    () => buildTimeline(items, state.snap.logsFrom, state.today, { asOf: state.today, weekStart: state.snap.profile.weekStart }),
    [items, state.snap.logsFrom, state.today, state.snap.profile.weekStart],
  );

  // Milestones: the server re-checks after logs are saved
  const [revealed, setRevealed] = useState<string[]>([]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      try {
        const res = await mahdiFetch<{ fresh: string[]; rewards: Snapshot["rewards"] }>("/api/mahdi/rewards", { method: "POST" });
        store.setSnapPart({ rewards: res.rewards });
        const unseen = res.rewards.filter((r) => !r.seenAt).map((r) => r.milestoneId);
        if (unseen.length) setRevealed(unseen);
      } catch {}
    };
    store.setOnSynced(() => {
      clearTimeout(timer);
      timer = setTimeout(check, 1500);
    });
    const first = setTimeout(check, 3000);
    return () => {
      store.setOnSynced(null);
      clearTimeout(timer);
      clearTimeout(first);
    };
  }, [store]);
  const closeReveal = useCallback(() => {
    setRevealed((ids) => {
      if (ids.length) mahdiFetch("/api/mahdi/rewards", { method: "PATCH", json: { ids } }).catch(() => {});
      return [];
    });
  }, []);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (message: string, action?: Toast["action"], key?: string) => {
      const id = nextId.current++;
      setToasts((list) => [...list.filter((x) => !key || x.key !== key).slice(-2), { id, message, action, key }]);
      setTimeout(() => dismiss(id), action ? UNDO_MS : 3500);
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({ store, state, items, allHabits, timeline, toasts, toast, dismiss, revealed, closeReveal }),
    [store, state, items, allHabits, timeline, toasts, toast, dismiss, revealed, closeReveal],
  );
  return <MahdiContext.Provider value={value}>{children}</MahdiContext.Provider>;
}
