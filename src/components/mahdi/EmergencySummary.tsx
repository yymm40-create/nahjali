"use client";

// «خانة الطوارئ» · the week's and the month's count: how many emergency days the person chose, how many emergency habits, and how many of
// them they reached (in the emergency colour). Nothing is shown when there was none.

import { useMemo } from "react";
import { emergencyStats, minDate, type ISODate } from "@/lib/mahdi/engine";
import { fmtNum } from "@/lib/mahdi/i18n";
import { useMahdi } from "./Provider";
import { Tile } from "./Stats";

export default function EmergencySummary({ from, to }: { from: ISODate; to: ISODate }) {
  const { items, state } = useMahdi();
  const { snap, today } = state;
  const st = useMemo(
    () => emergencyStats(items, snap.emergencyDays, from, minDate(to, today), { asOf: today, weekStart: snap.profile.weekStart }),
    [items, snap.emergencyDays, from, to, today, snap.profile.weekStart],
  );
  if (!st.habits) return null;
  return (
    <section className="grid gap-3 sm:grid-cols-3" aria-label="الطوارئ">
      <Tile label="أيام الطوارئ" value={fmtNum(st.days)} sub="أيام اخترت فيها طوارئ" />
      <Tile label="عادات الطوارئ" value={fmtNum(st.habits)} sub={`${fmtNum(st.distinctHabits)} عادة مختلفة`} />
      <Tile label="تمّت بالطوارئ" value={`${fmtNum(st.reached)} / ${fmtNum(st.habits)}`} sub="تنحسب لك إنجاز كامل" />
    </section>
  );
}
