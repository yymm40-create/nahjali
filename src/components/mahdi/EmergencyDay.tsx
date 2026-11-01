"use client";

// «خانة الطوارئ» · inside a habit's log sheet: «اليوم طوارئ» turns this day's goal into the smaller one the person chose; reaching it counts
// as the day's goal reached and is shown in the emergency colour. For a habit counted per week or per month (e.g. 1000 a week) it is
// «هذا الأسبوع طوارئ» / «هذا الشهر طوارئ»: the period's goal becomes the smaller one.

import { useState } from "react";
import { doneByEmergency, type ISODate, type Instance, type Version } from "@/lib/mahdi/engine";
import { fmtNum } from "@/lib/mahdi/i18n";
import { quantity } from "@/lib/mahdi/client/derive";
import type { Habit } from "@/lib/mahdi/types";
import Icon from "./Icon";
import { useMahdi } from "./Provider";

/** A partial week / month has a pro-rated goal: its emergency one is pro-rated the same way (as the engine does). */
const lowerOf = (inst: Instance, target: number, usual: number) => {
  const n = target * (inst.target / usual);
  return inst.measure === "amount" ? Math.max(0.1, Math.round(n * 10) / 10) : Math.max(1, Math.round(n));
};

export default function EmergencyDay({ habit, version: v, inst, date }: { habit: Habit; version: Version; inst: Instance; date: ISODate }) {
  const { store, toast } = useMahdi();
  const [busy, setBusy] = useState(false);
  const target = habit.emergencyTarget;
  if (!target || v.measure === "check" || target >= v.target) return null;
  const on = Boolean(inst.emergency);
  const span = inst.kind === "week" ? "هذا الأسبوع" : inst.kind === "month" ? "هذا الشهر" : "اليوم";

  const toggle = async () => {
    setBusy(true);
    try {
      // off: every day chosen in the period goes (a week / month goal is lowered by any of them)
      await store.mutate("/api/mahdi/emergency", "POST", { action: "day", habitIds: [habit.id], date: on ? inst.periodStart : date, ...(on && inst.kind !== "day" ? { to: inst.periodEnd } : {}), on: !on });
      toast(on ? `رجع هدفك الكامل ل${span}.` : `تمام، ${span} طوارئ: هدفك ${quantity(v, inst.kind === "day" ? target : lowerOf(inst, target, v.target))} بس.`);
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <div className="m-soft space-y-2 p-3 text-sm" data-emergency={on ? "1" : undefined}>
      <p className="font-semibold" style={on ? { color: "var(--m-emergency)" } : undefined}>
        <Icon name="shield" size={16} /> خانة الطوارئ: {quantity(v, target)} بدل {quantity(v, v.target)}
      </p>
      {on ? (
        <p className="m-num" style={{ color: "var(--m-emergency)" }}>
          {doneByEmergency(inst) ? `تمّت بالطوارئ ✓ وتنحسب لك ${inst.kind === "day" ? "يوم كامل" : "هدف كامل"}.` : `${span} طوارئ: باقي ${fmtNum(Math.max(0, inst.target - inst.value))} ${v.measure === "amount" ? v.unit : "مرة"}.`}
        </p>
      ) : (
        <p className="m-muted">ما تقدر تسويها كاملة {span}؟ خلّ هدف {span} أصغر، وإذا سويته ينحسب إنجاز كامل بلون خاص.</p>
      )}
      <button type="button" className={`m-btn m-btn-sm ${on ? "m-btn-ghost" : "m-btn-primary"}`} onClick={toggle} disabled={busy}>
        {on ? "ألغِ الطوارئ" : `${span} طوارئ`}
      </button>
    </div>
  );
}
