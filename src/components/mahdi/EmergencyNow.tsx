"use client";

// «خانة الطوارئ» · «أنا الحين في طوارئ»: one switch for many habits at once. The person ticks which of their habits (those that carry an
// emergency goal) go to emergency NOW — today's goal, or this week's / month's for a habit counted per week or per month — and turns
// it on or off for all of them in one go, instead of opening each habit.

import { useMemo, useState } from "react";
import { instanceOn, type Instance } from "@/lib/mahdi/engine";
import { fmtNum } from "@/lib/mahdi/i18n";
import { bySort } from "@/lib/mahdi/client/derive";
import Icon from "./Icon";
import { useMahdi } from "./Provider";

interface Row {
  id: string;
  name: string;
  inst: Instance;
}

export default function EmergencyNow() {
  const { state, store, toast, items, timeline } = useMahdi();
  const { snap, today } = state;

  // every habit with an emergency goal that has a goal running today
  const rows = useMemo(() => {
    const order = new Map(snap.habits.slice().sort(bySort).map((h, i) => [h.id, i]));
    const out: Row[] = [];
    for (const h of snap.habits) {
      if (!h.emergencyTarget) continue;
      const item = items.find((i) => i.id === h.id);
      const inst = item ? instanceOn(item, today, timeline.ctx) : null;
      if (!inst || inst.measure === "check") continue;
      out.push({ id: h.id, name: `${h.icon ? `${h.icon} ` : ""}${h.name}`, inst });
    }
    return out.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }, [snap.habits, items, today, timeline.ctx]);

  const [picked, setPicked] = useState<Record<string, boolean>>(() => Object.fromEntries(rows.map((r) => [r.id, true])));
  const [busy, setBusy] = useState(false);
  if (!rows.length) return null;

  const chosen = rows.filter((r) => picked[r.id] ?? true);
  const onNow = rows.filter((r) => r.inst.emergency);
  const allOn = chosen.length > 0 && chosen.every((r) => r.inst.emergency);

  const run = async (on: boolean) => {
    const list = chosen.filter((r) => Boolean(r.inst.emergency) !== on);
    if (!list.length) return;
    setBusy(true);
    try {
      if (on) await store.mutate("/api/mahdi/emergency", "POST", { action: "day", habitIds: list.map((r) => r.id), date: today, on: true });
      else {
        // off: a week / month goal clears every chosen day of its period, a day goal just today
        const groups = new Map<string, Row[]>();
        for (const r of list) {
          const k = r.inst.kind === "day" ? `${today}|` : `${r.inst.periodStart}|${r.inst.periodEnd}`;
          groups.set(k, [...(groups.get(k) ?? []), r]);
        }
        for (const [k, rs] of groups) {
          const [from, to] = k.split("|");
          await store.mutate("/api/mahdi/emergency", "POST", { action: "day", habitIds: rs.map((r) => r.id), date: from, ...(to ? { to } : {}), on: false });
        }
      }
      toast(on ? `تمام، أنت الحين في طوارئ: ${list.length} عادة صار هدفها أصغر.` : "رجعت أهدافك الكاملة.");
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <section className="m-soft space-y-3 p-3" data-emergency={onNow.length ? "1" : undefined}>
      <h3 className="flex items-center gap-2 font-semibold" style={onNow.length ? { color: "var(--m-emergency)" } : undefined}>
        <Icon name="shield" size={18} /> أنا الحين في طوارئ
      </h3>
      <p className="m-muted text-xs">اختر العادات اللي تبيها طوارئ الحين، وبضغطة وحدة يصير هدفها الرقم الأصغر (اليوم، أو هذا الأسبوع / الشهر للعادة اللي هدفها بالأسبوع أو بالشهر).</p>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.id}>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-5" checked={picked[r.id] ?? true} onChange={(e) => setPicked((m) => ({ ...m, [r.id]: e.target.checked }))} />
              <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
              <span className="m-num m-muted shrink-0 text-xs">{r.inst.kind === "week" ? "الأسبوع" : r.inst.kind === "month" ? "الشهر" : "اليوم"}</span>
              {r.inst.emergency && (
                <span className="m-emergency-chip shrink-0">
                  طوارئ <span className="m-num">({fmtNum(r.inst.target)} بدل {fmtNum(r.inst.fullTarget ?? r.inst.target)})</span>
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        {!allOn && (
          <button type="button" className="m-btn m-btn-primary m-btn-sm" onClick={() => run(true)} disabled={busy || !chosen.length}>
            <Icon name="shield" size={16} /> فعّل الطوارئ الحين ({chosen.filter((r) => !r.inst.emergency).length})
          </button>
        )}
        {chosen.some((r) => r.inst.emergency) && (
          <button type="button" className="m-btn m-btn-ghost m-btn-sm" onClick={() => run(false)} disabled={busy}>
            ألغِ الطوارئ ({chosen.filter((r) => r.inst.emergency).length})
          </button>
        )}
      </div>
    </section>
  );
}
