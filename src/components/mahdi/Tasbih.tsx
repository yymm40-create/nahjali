"use client";

// «المسبحة»: at the top of every screen. A big button counts (with a light tap of the phone, a longer one every 33),
// a small one takes one back, a small one resets. It can be tied to one of today's habits (a count, an amount, or
// done/not done): from then on every count is added to that habit's day, and taking one back takes it from there too.
// The count and the tie are kept on this device.

import { useEffect, useMemo, useState } from "react";
import { dayGoals, periodGoalsOn, type Instance } from "@/lib/mahdi/engine";
import { fmtNum, t } from "@/lib/mahdi/i18n";
import Icon from "./Icon";
import { useMahdi } from "./Provider";
import Sheet from "./Sheet";

const KEY = (user: string) => `mahdi:tasbih:${user}`;
interface Saved {
  count: number;
  habitId: string | null;
}

function load(user: string): Saved {
  try {
    const v = JSON.parse(localStorage.getItem(KEY(user)) ?? "null") as Partial<Saved> | null;
    return { count: Math.max(0, Math.floor(Number(v?.count) || 0)), habitId: typeof v?.habitId === "string" ? v.habitId : null };
  } catch {
    return { count: 0, habitId: null };
  }
}

const buzz = (ms: number) => {
  try {
    navigator.vibrate?.(ms);
  } catch {}
};

/** The button in the top bar, and the sheet it opens. */
export default function TasbihButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="m-menu-btn" onClick={() => setOpen(true)} aria-label={t.tasbih.open} aria-haspopup="dialog" aria-expanded={open}>
        <Icon name="beads" size={22} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t.tasbih.title}>
        {open && <Tasbih />}
      </Sheet>
    </>
  );
}

function Tasbih() {
  const { state, store, timeline, allHabits, toast } = useMahdi();
  const { today } = state;
  const user = state.snap.profile.userId;
  const [saved, setSaved] = useState<Saved>(() => load(user));
  const [confirmReset, setConfirmReset] = useState(false);
  const [addNow, setAddNow] = useState(false);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem(KEY(user), JSON.stringify(saved));
    } catch {}
  }, [saved, user]);
  useEffect(() => {
    if (!confirmReset) return;
    const id = setTimeout(() => setConfirmReset(false), 2500);
    return () => clearTimeout(id);
  }, [confirmReset]);

  // today's habits a count can go to: those due today, and this week's / month's, that are counted, measured or done
  const choices = useMemo(() => {
    const byId = new Map(allHabits.map((h) => [h.id, h]));
    const seen = new Set<string>();
    const out: { inst: Instance; name: string }[] = [];
    for (const inst of [...dayGoals(timeline, today), ...periodGoalsOn(timeline, today)]) {
      const h = byId.get(inst.itemId);
      if (!h || seen.has(h.id)) continue;
      seen.add(h.id);
      out.push({ inst, name: `${h.icon ? `${h.icon} ` : ""}${h.name}` });
    }
    return out;
  }, [allHabits, timeline, today]);
  const linked = choices.find((c) => c.inst.itemId === saved.habitId) ?? null;

  const logToday = (habitId: string, delta: number, measure: Instance["measure"]) => {
    // the store's latest (fast taps come before the screen catches up)
    const cur = store.getState().logs[habitId]?.[today] ?? 0;
    const next = measure === "check" ? (delta > 0 ? 1 : 0) : Math.max(0, cur + delta);
    if (next !== cur) store.setLog(habitId, today, next);
  };

  const add = () => {
    const n = saved.count + 1;
    setSaved((s) => ({ ...s, count: s.count + 1 }));
    setBump((b) => b + 1);
    buzz(n % 33 === 0 ? 70 : 12);
    if (linked) logToday(linked.inst.itemId, 1, linked.inst.measure);
  };
  const minus = () => {
    if (saved.count <= 0) return;
    setSaved((s) => ({ ...s, count: Math.max(0, s.count - 1) }));
    buzz(8);
    if (linked) logToday(linked.inst.itemId, -1, linked.inst.measure);
  };
  const reset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    setSaved((s) => ({ ...s, count: 0 }));
    toast(t.tasbih.resetDone);
  };
  const tie = (habitId: string) => {
    const c = choices.find((x) => x.inst.itemId === habitId);
    setSaved((s) => ({ ...s, habitId: c ? habitId : null }));
    if (c && addNow && saved.count > 0) logToday(habitId, saved.count, c.inst.measure);
    setAddNow(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-5">
        <button
          type="button"
          onClick={add}
          aria-label={`${t.tasbih.add} — ${t.tasbih.count(fmtNum(saved.count))}`}
          className="relative grid size-56 select-none place-items-center rounded-full transition-transform active:scale-95"
          style={{
            background: "radial-gradient(circle at 35% 30%, var(--m-gold-2), var(--m-gold))",
            color: "var(--m-gold-ink)",
            boxShadow: "0 18px 40px -16px color-mix(in srgb, var(--m-gold) 70%, transparent), inset 0 2px 0 rgb(255 255 255 / 0.35)",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <span className="flex flex-col items-center leading-none">
            <span key={bump} className="m-num text-6xl font-bold" aria-live="polite">{fmtNum(saved.count)}</span>
            <Icon name="plus" size={26} strokeWidth={2.4} className="mt-3 opacity-80" />
          </span>
        </button>
        <div className="flex items-center gap-3">
          <button type="button" className="m-btn m-btn-ghost m-btn-sm" onClick={minus} disabled={saved.count <= 0} aria-label={t.tasbih.minus}>
            <Icon name="minus" size={18} /> {t.tasbih.minus}
          </button>
          <button type="button" className={`m-btn m-btn-sm ${confirmReset ? "m-btn-danger" : "m-btn-ghost"}`} onClick={reset} disabled={saved.count <= 0} aria-label={confirmReset ? t.tasbih.resetAgain : t.tasbih.reset}>
            <Icon name="archive" size={16} /> {confirmReset ? t.tasbih.resetAgain : t.tasbih.reset}
          </button>
        </div>
        {confirmReset && <p className="text-center text-xs m-muted">{t.tasbih.resetHint}</p>}
      </div>

      <section className="m-card space-y-3 p-4" aria-labelledby="tasbih-link">
        <h3 id="tasbih-link" className="flex items-center gap-2 font-semibold">
          <Icon name="target" size={18} /> {t.tasbih.link}
        </h3>
        {linked ? (
          <div className="space-y-2">
            <p className="text-sm">{t.tasbih.linked(linked.name)}</p>
            <p className="m-num text-sm m-muted">
              {linked.inst.measure === "check" ? (linked.inst.progress >= 1 ? "✓" : "—") : t.tasbih.progress(fmtNum(linked.inst.value), fmtNum(linked.inst.target))}
            </p>
            <span className="block h-2 overflow-hidden rounded-full" style={{ background: "var(--m-track)" }}>
              <span className="block h-full rounded-full transition-[width]" style={{ width: `${Math.round(linked.inst.progress * 100)}%`, background: "var(--m-gold)" }} />
            </span>
            <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => tie("")}>{t.tasbih.unlink}</button>
          </div>
        ) : choices.length === 0 ? (
          <p className="text-sm m-muted">{t.tasbih.noHabits}</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm m-muted">{t.tasbih.linkHint}</p>
            <select className="m-field" value="" onChange={(e) => tie(e.target.value)} aria-label={t.tasbih.link}>
              <option value="">{t.tasbih.linkNone}</option>
              {choices.map((c) => (
                <option key={c.inst.itemId} value={c.inst.itemId}>{c.name}</option>
              ))}
            </select>
            {saved.count > 0 && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4" checked={addNow} onChange={(e) => setAddNow(e.target.checked)} />
                {t.tasbih.addCurrent(fmtNum(saved.count))}
              </label>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
