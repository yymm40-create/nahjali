"use client";

// «ختمتي»: my khatma from the server, its actions, and the link with «لأجل المهدي»'s habits — a portion read here adds
// one to the linked habit on that day (a done/not-done habit becomes done), and one marked by mistake takes it back.
// The habit's log goes through the app's own log queue (instant on the screen, sent when online), like every tap.

import { useCallback, useEffect, useState } from "react";
import { useMahdi } from "@/components/mahdi/Provider";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { isDueOn, versionAt } from "@/lib/mahdi/engine";
import { habitValueAfter, type MyRead } from "@/lib/mahdi/khatma/mine";
import type { Division, PortionRange } from "@/lib/mahdi/khatma/portions";

export interface MyKhatma {
  id: string;
  number: number;
  days: number;
  startedOn: string;
  status: "open" | "done" | "stopped";
  finishedOn: string | null;
  dedicatedTo: string;
  forSoulOf: string;
  habitId: string | null;
  /** how it is cut, and the stretch of the Quran it covers (portion numbers in that division) */
  unit: Division;
  range: PortionRange;
}
export interface MyKhatmaData {
  ready: boolean;
  current?: (MyKhatma & { reads: MyRead[] }) | null;
  history?: MyKhatma[];
  today: string;
}

export function useMyKhatma() {
  const { state, store, toast } = useMahdi();
  const [data, setData] = useState<MyKhatmaData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    mahdiFetch<MyKhatmaData>("/api/mahdi/khatma/mine")
      .then((d) => live && (setData(d), setError("")))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [reload]);

  const habitId = data?.current?.habitId ?? null;
  const habit = habitId ? (state.snap.habits.find((h) => h.id === habitId) ?? null) : null;

  /** Moves the linked habit's log on a day by `n` portions (nothing when it does not run that day). */
  const bumpHabit = useCallback(
    (date: string, n: number) => {
      if (!habit || !n) return;
      const v = versionAt({ id: habit.id, projectId: habit.projectId, versions: habit.versions, logs: {} }, date);
      // week/month goals count any day; day goals only their own days
      if (!v || v.state !== "active" || ((v.freq === "daily" || v.freq === "days") && !isDueOn(v, date))) return;
      const cur = state.logs[habit.id]?.[date] ?? 0;
      const next = habitValueAfter(v.measure, cur, n);
      if (next !== cur) store.setLog(habit.id, date, next);
    },
    [habit, state.logs, store],
  );

  const post = useCallback(async <T = { ok: true }>(json: object, done?: string) => {
    setBusy(true);
    try {
      const r = await mahdiFetch<T>("/api/mahdi/khatma/mine", { method: "POST", json });
      if (done) toast(done);
      return r;
    } catch (e) {
      toast((e as Error).message);
      return null;
    } finally {
      setBusy(false);
      setReload((x) => x + 1);
    }
  }, [toast]);

  /** Marks portions read today; the habit gets the new ones. */
  const read = useCallback(
    async (quarters: number[]) => {
      const r = await post<{ added: number[]; finished: boolean; today: string }>({ action: "read", quarters });
      if (r) {
        bumpHabit(r.today, r.added.length);
        toast(r.finished ? "تمّت ختمتك بحمد الله 🤍 تقبّل الله." : "تقبّل الله ✓");
      }
      return r;
    },
    [post, bumpHabit, toast],
  );

  /** A portion marked by mistake: back to unread, and taken back from the habit on the day it had been read. */
  const unread = useCallback(
    async (quarter: number) => {
      const r = await post<{ readOn: string | null }>({ action: "unread", quarter }, "رجع غير مقروء.");
      if (r?.readOn) bumpHabit(r.readOn, -1);
      return r;
    },
    [post, bumpHabit],
  );

  return { data, error, busy, habit, post, read, unread, refresh: () => setReload((x) => x + 1), state, store, toast };
}
