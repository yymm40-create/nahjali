"use client";

// «لأجل المهدي» app only (mahdi-app/): books the person's reminders on the phone itself, so each comes on its minute even
// with no internet — the tasks with a time (and «ما خلّصت…» an hour later), and the habits' «اجعله تنبيهًا» for the
// next week on the days they are due. Booked again whenever the day's data changes (a tick cancels that day's alert).
// A tap on one opens what it is for (the habit itself, the day of a task), and the app's data is fetched again whenever
// it comes back to the front. In a browser it does nothing: there the server's push does the work.

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { addDays, buildTimeline, dayGoals, dayStartMinute, inQuietHours, toMinutes, type DayStart, type ISODate } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { alertId, bookAlerts, inNativeApp, onAlertTap, type NativeAlert } from "@/lib/mahdi/client/native";
import { alertUrl } from "@/lib/mahdi/remind-offer";
import { toItems } from "@/lib/mahdi/client/derive";
import type { DayTask } from "@/lib/mahdi/types";
import { useMahdi } from "./Provider";

const WEEK = 7;

/** The moment a time of an app day happens (a day starts at the person's «بداية يومي», so 01:00 belongs to the night after). */
function momentOf(day: ISODate, hhmm: string, timeZone: string, dayStart: DayStart | undefined): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const date = h * 60 + m < dayStartMinute(timeZone, day, dayStart) ? addDays(day, 1) : day;
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(y, mo - 1, d, h, m, 0, 0);
}

export default function NativeAlerts() {
  const { state, store } = useMahdi();
  const { snap, logs, today } = state;
  const router = useRouter();

  // a tap on a reminder opens its own screen; back in the app, the data is fresh
  useEffect(() => {
    if (!inNativeApp()) return;
    const stop = onAlertTap((path) => router.push(path));
    const back = () => {
      if (document.visibilityState === "visible") void store.refresh();
    };
    document.addEventListener("visibilitychange", back);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", back);
    };
  }, [router, store]);

  useEffect(() => {
    if (!inNativeApp()) return;
    let live = true;
    const timer = setTimeout(async () => {
      const n = snap.notifications;
      const quiet = (hhmm: string) => {
        const min = toMinutes(hhmm);
        return min !== null && inQuietHours(min, n.quietStart, n.quietEnd);
      };
      const alerts: NativeAlert[] = [];

      // the tasks with a time: today's (from the app's data) and the days ahead
      let upcoming: DayTask[] = [];
      try {
        upcoming = (await mahdiFetch<{ upcoming: DayTask[] }>("/api/mahdi/tasks?upcoming=1")).upcoming ?? [];
      } catch {}
      for (const x of [...snap.tasks.filter((y) => y.date === today), ...upcoming]) {
        if (!x.at || x.doneAt || quiet(x.at)) continue;
        const name = x.title;
        const at = momentOf(x.date, x.at, snap.profile.timeZone, snap.profile.dayStart);
        alerts.push({ id: alertId(`task:${x.id}`), title: t.tasks.title, body: t.tasks.notifyAt([name]), schedule: { at, allowWhileIdle: true }, extra: { url: alertUrl("task", { date: x.date }) } });
        alerts.push({ id: alertId(`task-late:${x.id}`), title: t.tasks.title, body: t.tasks.notifyLate([name]), schedule: { at: new Date(at.getTime() + 3_600_000), allowWhileIdle: true }, extra: { url: alertUrl("task", { date: x.date }) } });
      }

      // the habits' own alerts, on each day of the coming week they are due (today: only if not done yet)
      if (n.habitReminders !== false) {
        const withTime = snap.habits.filter((h) => h.reminderTime);
        if (withTime.length) {
          const tl = buildTimeline(toItems(snap.habits, logs, snap.emergencyDays), today, addDays(today, WEEK - 1), { asOf: today, weekStart: snap.profile.weekStart });
          for (let k = 0; k < WEEK; k++) {
            const day = addDays(today, k);
            const due = dayGoals(tl, day);
            for (const h of withTime) {
              const time = h.reminderTime!.slice(0, 5);
              if (quiet(time)) continue;
              const inst = due.find((i) => i.itemId === h.id && i.kind === "day");
              if (!inst || (k === 0 && inst.progress >= 1)) continue;
              alerts.push({ id: alertId(`habit:${h.id}:${day}`), title: t.notify.title2, body: t.notify.habitBody([h.name]), schedule: { at: momentOf(day, time, snap.profile.timeZone, snap.profile.dayStart), allowWhileIdle: true }, extra: { url: alertUrl("habit", { id: h.id }) } });
            }
          }
        }
      }
      if (live) await bookAlerts(alerts).catch(() => {});
    }, 1500);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [snap.tasks, snap.habits, snap.notifications, snap.emergencyDays, snap.profile.weekStart, snap.profile.timeZone, snap.profile.dayStart, logs, today]);

  return null;
}
