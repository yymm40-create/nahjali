"use client";

// «الصحة العلوية» as its own app: everything its pages share — the profile being filled, the plan, the step of the
// setup, the tracker's days — and the link with «لأجل المهدي»'s habits: a value tracked here (a workout done, the
// protein, the water…) is logged on the habit made from the plan, and a habit ticked in «لأجل المهدي» shows here.
// Saved to the account (SQL 0059/0060), and kept on the device too so the pages work before those run or offline.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useMahdi } from "@/components/mahdi/Provider";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { todayIn } from "@/lib/mahdi/engine";
import { DEFAULT_PROFILE, type HealthPlan, type HealthProfile } from "@/lib/mahdi/health/plan";
import { emptyDay, type DayLog } from "@/lib/mahdi/health/tracker";

export type SetupStep = "track" | "about" | "goal" | "train" | "mode" | "build-food" | "build-day";

interface Health {
  uid: string;
  loaded: boolean;
  today: string;
  plan: HealthPlan | null;
  save: (p: HealthPlan) => void;
  profile: HealthProfile;
  setProfile: React.Dispatch<React.SetStateAction<HealthProfile>>;
  step: SetupStep;
  setStep: (s: SetupStep) => void;
  days: Record<string, DayLog>;
  day: (date: string) => DayLog;
  saveDay: (d: DayLog) => void;
  /** the habit made from the plan for this key, if it still exists */
  habitFor: (key: string) => string | null;
  /** the value logged on that habit on a date (null when there is no habit) */
  habitValue: (key: string, date: string) => number | null;
  /** logs a value on the habit (no-op without one) */
  logHabit: (key: string, date: string, value: number) => void;
}

const Ctx = createContext<Health | null>(null);
export const useHealth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useHealth outside HealthProvider");
  return c;
};

const read = <T,>(k: string): T | null => {
  try {
    return JSON.parse(localStorage.getItem(k) ?? "null") as T | null;
  } catch {
    return null;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* private window */
  }
};

export default function HealthProvider({ children }: { children: React.ReactNode }) {
  const { state, store } = useMahdi();
  const uid = state.snap.profile.userId;
  const today = todayIn(state.snap.profile.timeZone);
  const [plan, setPlan] = useState<HealthPlan | null>(null);
  const [profile, setProfile] = useState<HealthProfile>(DEFAULT_PROFILE);
  const [step, setStep] = useState<SetupStep>("track");
  const [days, setDays] = useState<Record<string, DayLog>>({});
  const [loaded, setLoaded] = useState(false);
  const planTimer = useRef<number | null>(null);
  const dayTimers = useRef<Record<string, number>>({});
  const planKey = `mahdi-health:${uid}`;
  const daysKey = `mahdi-health-days:${uid}`;

  useEffect(() => {
    let live = true;
    const localPlan = read<HealthPlan>(planKey);
    const localDays = read<Record<string, DayLog>>(daysKey) ?? {};
    Promise.allSettled([
      mahdiFetch<{ ready: boolean; plan: HealthPlan | null }>("/api/mahdi/health"),
      mahdiFetch<{ ready: boolean; days: DayLog[] }>("/api/mahdi/health/days"),
    ]).then(([p, d]) => {
      if (!live) return;
      const server = p.status === "fulfilled" ? p.value.plan : null;
      const best = server && (!localPlan || server.savedAt >= localPlan.savedAt) ? server : localPlan;
      setPlan(best);
      if (best) setProfile(best.profile);
      const merged = { ...localDays };
      if (d.status === "fulfilled") for (const x of d.value.days) merged[x.date] = x;
      setDays(merged);
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [planKey, daysKey]);

  const save = useCallback(
    (next: HealthPlan) => {
      const stamped = { ...next, savedAt: new Date().toISOString() };
      setPlan(stamped);
      write(planKey, stamped);
      if (planTimer.current) window.clearTimeout(planTimer.current);
      planTimer.current = window.setTimeout(() => {
        mahdiFetch("/api/mahdi/health", { method: "PUT", json: { plan: stamped } }).catch(() => {});
      }, 800);
    },
    [planKey],
  );

  const saveDay = useCallback(
    (d: DayLog) => {
      setDays((all) => {
        const next = { ...all, [d.date]: d };
        write(daysKey, next);
        return next;
      });
      window.clearTimeout(dayTimers.current[d.date]);
      dayTimers.current[d.date] = window.setTimeout(() => {
        mahdiFetch("/api/mahdi/health/days", { method: "PUT", json: { day: d } }).catch(() => {});
      }, 900);
    },
    [daysKey],
  );

  const habitFor = useCallback(
    (key: string) => {
      const id = plan?.links?.[key];
      return id && state.snap.habits.some((h) => h.id === id) ? id : null;
    },
    [plan, state.snap.habits],
  );

  const value = useMemo<Health>(
    () => ({
      uid,
      loaded,
      today,
      plan,
      save,
      profile,
      setProfile,
      step,
      setStep,
      days,
      day: (date) => days[date] ?? emptyDay(date),
      saveDay,
      habitFor,
      habitValue: (key, date) => {
        const id = habitFor(key);
        return id ? (state.snap.logs[id]?.[date] ?? 0) : null;
      },
      logHabit: (key, date, v) => {
        const id = habitFor(key);
        if (id) store.setLog(id, date, Math.max(0, Math.round(v * 100) / 100));
      },
    }),
    [uid, loaded, today, plan, save, profile, step, days, saveDay, habitFor, state.snap.logs, store],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
