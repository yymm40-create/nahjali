"use client";

// «خانة الطوارئ» · inside a habit's log sheet: «اليوم طوارئ» turns this day's goal into the smaller one the person chose; reaching it counts
// as the day's goal reached and is shown in the emergency colour.

import { useState } from "react";
import { doneByEmergency, type ISODate, type Instance, type Version } from "@/lib/mahdi/engine";
import { fmtNum } from "@/lib/mahdi/i18n";
import { quantity } from "@/lib/mahdi/client/derive";
import type { Habit } from "@/lib/mahdi/types";
import Icon from "./Icon";
import { useMahdi } from "./Provider";

export default function EmergencyDay({ habit, version: v, inst, date }: { habit: Habit; version: Version; inst: Instance; date: ISODate }) {
  const { store, toast } = useMahdi();
  const [busy, setBusy] = useState(false);
  const target = habit.emergencyTarget;
  if (!target || v.measure === "check" || inst.kind !== "day" || target >= v.target) return null;
  const on = Boolean(inst.emergency);

  const toggle = async () => {
    setBusy(true);
    try {
      await store.mutate("/api/mahdi/emergency", "POST", { action: "day", habitIds: [habit.id], date, on: !on });
      toast(on ? "رجع هدفك الكامل لهذا اليوم." : `تمام، اليوم طوارئ: هدفك ${quantity(v, target)} بس.`);
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
          {doneByEmergency(inst) ? "تمّت بالطوارئ ✓ وتنحسب لك يوم كامل." : `اليوم طوارئ: باقي ${fmtNum(Math.max(0, inst.target - inst.value))} ${v.measure === "amount" ? v.unit : "مرة"}.`}
        </p>
      ) : (
        <p className="m-muted">ما تقدر تسويها كاملة اليوم؟ خلّ هدف اليوم أصغر، وإذا سويته ينحسب إنجاز كامل بلون خاص.</p>
      )}
      <button type="button" className={`m-btn m-btn-sm ${on ? "m-btn-ghost" : "m-btn-primary"}`} onClick={toggle} disabled={busy}>
        {on ? "ألغِ الطوارئ" : "اليوم طوارئ"}
      </button>
    </div>
  );
}
