"use client";

// «خانة الطوارئ» · setup: she is put on one project, or on several at once, or on a single habit. For each project chosen the person says
// WHICH habits get an emergency and HOW SMALL their goal is on an emergency day (e.g. 20 pages → 5). Only counters and amounts can carry one.

import { useMemo, useState } from "react";
import { versionAt } from "@/lib/mahdi/engine";
import { fmtNum } from "@/lib/mahdi/i18n";
import { bySort, parseNumberInput, quantity } from "@/lib/mahdi/client/derive";
import type { Habit, Project } from "@/lib/mahdi/types";
import EmergencyNow from "./EmergencyNow";
import Icon from "./Icon";
import { useMahdi } from "./Provider";
import Sheet from "./Sheet";

interface Row {
  habit: Habit;
  project: Project;
  /** the usual goal */
  target: number;
  measure: "count" | "amount";
  unit: string;
}

/** A first suggestion for the smaller goal: a quarter of the usual one (at least 1 for a counter, one decimal for an amount). */
const suggest = (r: Pick<Row, "target" | "measure">) => (r.measure === "amount" ? Math.max(0.1, Math.round((r.target / 4) * 10) / 10) : Math.max(1, Math.round(r.target / 4)));

export default function EmergencySetup({ open, onClose, projectIds, habitId }: { open: boolean; onClose: () => void; projectIds?: string[]; habitId?: string }) {
  const { state, store, toast } = useMahdi();
  const { snap, today } = state;
  const projects = snap.projects.filter((p) => !p.archivedAt).sort(bySort);

  // every counter / amount habit that is active today, by project
  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const h of snap.habits) {
      const project = projects.find((p) => p.id === h.projectId);
      const v = versionAt({ id: h.id, projectId: h.projectId, versions: h.versions, logs: {} }, today);
      if (!project || !v || v.state !== "active" || v.measure === "check" || v.target <= 1) continue;
      out.push({ habit: h, project, target: v.target, measure: v.measure, unit: v.unit });
    }
    return out.sort((a, b) => a.habit.sortOrder - b.habit.sortOrder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.habits, snap.projects, today]);

  const withRows = projects.filter((p) => rows.some((r) => r.project.id === p.id));
  const [picked, setPicked] = useState<string[]>(() => {
    const first = projectIds?.length ? projectIds : habitId ? [snap.habits.find((h) => h.id === habitId)?.projectId ?? ""] : withRows.filter((p) => rows.some((r) => r.project.id === p.id && r.habit.emergencyTarget)).map((p) => p.id);
    return first.filter(Boolean);
  });
  // a habit is in when it is ticked; its number is what is typed (or its current / suggested one)
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(rows.map((r) => [r.habit.id, Boolean(r.habit.emergencyTarget) || r.habit.id === habitId])));
  const [num, setNum] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.habit.id, String(r.habit.emergencyTarget ?? suggest(r))])));
  const [busy, setBusy] = useState(false);

  const shown = rows.filter((r) => picked.includes(r.project.id));
  const togglePick = (id: string) => setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  const problem = (r: Row) => {
    const n = parseNumberInput(num[r.habit.id] ?? "");
    return !(n > 0 && n < r.target);
  };
  const bad = shown.filter((r) => on[r.habit.id] && problem(r));

  const save = async () => {
    // every habit of the chosen projects: ticked → its number; un-ticked but it had one → cleared
    const items = shown.flatMap((r): { habitId: string; target: number | null }[] => {
      if (on[r.habit.id]) return [{ habitId: r.habit.id, target: parseNumberInput(num[r.habit.id] ?? "") }];
      return r.habit.emergencyTarget ? [{ habitId: r.habit.id, target: null }] : [];
    });
    if (!items.length) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      await store.mutate("/api/mahdi/emergency", "POST", { action: "set", items });
      toast("انحفظت خانة الطوارئ ✓");
      onClose();
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <Sheet open={open} onClose={onClose} title="خانة الطوارئ">
      <div className="space-y-5">
        {/* one switch: «أنا الحين في طوارئ» for the habits the person ticks */}
        {!habitId && <EmergencyNow />}
        <p className="m-muted text-sm leading-relaxed">
          <Icon name="shield" size={16} /> يوم ما تقدر تسوي العادة كاملة؟ حدّد رقم أصغر تقبله في الطوارئ. إذا فعّلت «اليوم طوارئ» وسويت الرقم الصغير ينحسب لك إنجاز كامل بلون خاص، وآخر الأسبوع والشهر يبيّن لك كم يوم طوارئ اخترت وكم عادة.
        </p>

        {withRows.length === 0 ? (
          <p className="m-note text-sm">الطوارئ تنحط على العادات اللي هدفها عدّاد أو كمية (مثل ٢٠ صفحة، أو ٥ مرات). ما عندك عادة بهالشكل الحين.</p>
        ) : (
          <>
            <fieldset className="space-y-2">
              <legend className="m-label">أي مشاريع تبي فيها طوارئ؟ (تقدر تختار أكثر من مشروع)</legend>
              <div className="flex flex-wrap gap-2">
                {withRows.map((p) => (
                  <button key={p.id} type="button" className="m-option px-3 py-2 text-sm font-semibold" aria-pressed={picked.includes(p.id)} onClick={() => togglePick(p.id)} style={picked.includes(p.id) ? { borderColor: "var(--m-emergency)" } : undefined}>
                    {p.icon ? `${p.icon} ` : ""}{p.name}
                  </button>
                ))}
              </div>
            </fieldset>

            {shown.length === 0 ? (
              <p className="m-muted text-sm">اختر مشروع وحدة على الأقل.</p>
            ) : (
              <div className="space-y-4">
                {withRows.filter((p) => picked.includes(p.id)).map((p) => (
                  <section key={p.id} className={`p-${p.color} space-y-2`}>
                    <h3 className="flex items-center gap-2 font-semibold">
                      <span className="m-dot size-3" style={{ background: "var(--pc)" }} />
                      {p.icon ? `${p.icon} ` : ""}{p.name}
                    </h3>
                    <p className="m-muted text-xs">أي عادة تبيها فيها طوارئ؟ وإيش الرقم اللي تقبله في الطوارئ؟</p>
                    <ul className="space-y-2">
                      {rows.filter((r) => r.project.id === p.id).map((r) => (
                        <li key={r.habit.id} className="m-soft flex flex-wrap items-center gap-3 p-3">
                          <label className="flex min-w-0 flex-1 items-center gap-2">
                            <input type="checkbox" className="size-5" checked={Boolean(on[r.habit.id])} onChange={(e) => setOn((m) => ({ ...m, [r.habit.id]: e.target.checked }))} />
                            <span className="min-w-0 truncate font-semibold">{r.habit.icon ? `${r.habit.icon} ` : ""}{r.habit.name}</span>
                            <span className="m-num m-muted shrink-0 text-xs">من {quantity(r, r.target)}</span>
                          </label>
                          {on[r.habit.id] && (
                            <label className="flex items-center gap-2 text-sm">
                              <span className="m-muted">في الطوارئ</span>
                              <input
                                className="m-field m-num w-20"
                                inputMode="decimal"
                                value={num[r.habit.id] ?? ""}
                                onChange={(e) => setNum((m) => ({ ...m, [r.habit.id]: e.target.value }))}
                                aria-label={`رقم الطوارئ: ${r.habit.name}`}
                                aria-invalid={problem(r)}
                              />
                              <span className="m-muted">{r.measure === "amount" ? r.unit : "مرة"}</span>
                            </label>
                          )}
                          {on[r.habit.id] && problem(r) && <p className="w-full text-xs" style={{ color: "var(--m-warning)" }}>لازم يكون أقل من {fmtNum(r.target)}.</p>}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}

            <button type="button" className="m-btn m-btn-primary w-full" onClick={save} disabled={busy || bad.length > 0 || shown.length === 0}>
              احفظ خانة الطوارئ
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}
