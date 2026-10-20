"use client";

// «الختمة العلوية» · the counter at the top of the reader: the time spent reading, counted while the page is open and on
// screen (pause / resume), reported to the server every few seconds (and when the page is left), which keeps the day's
// total and adds each completed minute to the habit the person linked («عادة القراءة»). Used by the khatma's reader and
// by the free reading.

import { useCallback, useEffect, useRef, useState } from "react";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { CLOCK, clockText, isTimeHabit, minutesText, wholeMinutes } from "@/lib/mahdi/khatma/reader";
import Icon from "../Icon";
import { useMahdi } from "../Provider";

export interface ReaderState {
  ready: boolean;
  timeHabitId: string | null;
  freePage: number | null;
  todaySeconds: number;
}

/** The reader's settings and today's seconds, and the way to change the habit. */
export function useReaderState() {
  const [state, setState] = useState<ReaderState | null>(null);
  // the day's seconds the first time they came (the clock adds to these; later reads already hold what it reported)
  const [initial, setInitial] = useState<number | null>(null);
  const [reload, setReload] = useState(0);
  const { toast } = useMahdi();
  useEffect(() => {
    let live = true;
    mahdiFetch<ReaderState>("/api/mahdi/khatma/reader")
      .then((s) => {
        if (!live) return;
        setState(s);
        setInitial((v) => v ?? s.todaySeconds);
      })
      .catch(() => {
        if (!live) return;
        setState({ ready: false, timeHabitId: null, freePage: null, todaySeconds: 0 });
        setInitial((v) => v ?? 0);
      });
    return () => {
      live = false;
    };
  }, [reload]);
  const setHabit = useCallback(
    async (habitId: string | null) => {
      try {
        await mahdiFetch("/api/mahdi/khatma/reader", { method: "POST", json: { action: "habit", habitId } });
        toast(habitId ? "انربطت عادة القراءة ✓" : "انفكّ الربط.");
      } catch (e) {
        toast((e as Error).message);
      }
      setReload((x) => x + 1);
    },
    [toast],
  );
  return { state, initial: initial ?? 0, setHabit, refresh: () => setReload((x) => x + 1) };
}

/** The habits reading time can fill (an amount, like minutes, or a done / not done one). */
export function useTimeHabits() {
  const { state } = useMahdi();
  return state.snap.habits.filter((h) => {
    const v = h.versions.at(-1);
    return v && v.state !== "archived" && isTimeHabit(v.measure);
  });
}

/** What the linked habit is told, in the person's words. */
export function TimeHabitLink({ reader, onChange }: { reader: ReaderState; onChange: (id: string | null) => void }) {
  const habits = useTimeHabits();
  const linked = habits.find((h) => h.id === reader.timeHabitId) ?? null;
  const unit = linked?.versions.at(-1)?.unit ?? "";
  return (
    <div className="space-y-2 text-sm">
      {linked ? (
        <>
          <p>
            مربوط بعادة «{linked.icon ? `${linked.icon} ` : ""}{linked.name}»: كل دقيقة تقرؤها تنضاف لها في يومها
            {linked.versions.at(-1)?.measure === "check" ? " (تصير تمّت)" : unit && !/ساع/.test(unit) && unit !== "دقيقة" ? ` (${unit})` : ""}.
          </p>
          <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => onChange(null)}>فك الربط</button>
        </>
      ) : habits.length === 0 ? (
        <p className="m-muted">عندك عادة قراءة؟ أنشئ عادة بالدقائق (مثل «قراءة القرآن ٢٠ دقيقة») وتربطها هنا، فينحسب وقتك فيها وحده.</p>
      ) : (
        <>
          <p className="m-muted">اربط وقت قراءتك بعادة القراءة، فكل دقيقة تنضاف لها وحدها.</p>
          <select className="m-field" value="" onChange={(e) => e.target.value && onChange(e.target.value)} aria-label="عادة القراءة">
            <option value="">اختر عادة القراءة…</option>
            {habits.map((h) => (
              <option key={h.id} value={h.id}>{h.icon} {h.name}{h.versions.at(-1)?.measure === "amount" ? ` · ${h.versions.at(-1)!.unit}` : ""}</option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}

const URL = "/api/mahdi/khatma/reader";

/** The bar at the top of the reader. `extra`: a line of the reader's own (e.g. the khatma's progress). */
export default function ReaderClock({ extra }: { extra?: string }) {
  const { store } = useMahdi();
  const { state: reader, initial, setHabit, refresh } = useReaderState();
  const [running, setRunning] = useState(true);
  const [session, setSession] = useState(0);
  const [panel, setPanel] = useState(false);
  const pending = useRef(0);

  const flush = useCallback(() => {
    const add = Math.min(pending.current, CLOCK.maxPerReport);
    if (add <= 0) return;
    pending.current -= add;
    void fetch(URL, { method: "POST", keepalive: true, headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ action: "time", seconds: add }) })
      .then((r) => (r.ok ? (r.json() as Promise<{ minutes?: number; credited?: boolean }>) : null))
      .then((r) => {
        // a minute went to the habit on the server: the screen takes its fresh log
        if (r?.credited) void store.refresh(true);
      })
      .catch(() => {
        pending.current += add;
      });
  }, [store]);

  useEffect(() => {
    const tick = setInterval(() => {
      if (!running || document.visibilityState !== "visible") return;
      pending.current += 1;
      setSession((s) => s + 1);
      if (pending.current >= CLOCK.reportEvery) flush();
    }, 1000);
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [running, flush]);

  const today = initial + session;
  return (
    <div className="sticky top-[calc(56px+env(safe-area-inset-top,0px))] z-10 -mx-1 mb-4 lg:top-16">
      <div className="m-card space-y-2 px-3 py-2" style={{ background: "color-mix(in srgb, var(--m-surface-solid) 92%, transparent)", backdropFilter: "blur(10px)" }}>
        <div className="flex items-center gap-3">
          <span aria-hidden className="text-xl">⏱</span>
          <span className="m-num text-2xl font-bold tabular-nums" role="timer" aria-label={`وقت القراءة ${clockText(session)}`}>{clockText(session)}</span>
          <span className="min-w-0 flex-1 truncate text-xs m-muted">
            اليوم {minutesText(wholeMinutes(today))}
            {reader?.timeHabitId && " · 🔗 تنضاف لعادتك"}
          </span>
          <button type="button" className="m-icon-btn m-btn-ghost" onClick={() => setRunning((v) => !v)} aria-label={running ? "أوقف العدّاد" : "كمّل العدّاد"} aria-pressed={!running}>
            <Icon name={running ? "pause" : "play"} size={18} />
          </button>
          <button type="button" className="m-icon-btn m-btn-ghost" onClick={() => setPanel((v) => !v)} aria-label="اربط بعادة القراءة" aria-expanded={panel}>
            <Icon name="target" size={18} />
          </button>
        </div>
        {extra && <p className="m-num text-xs m-muted">{extra}</p>}
        {!running && <p className="text-xs" style={{ color: "var(--m-gold)" }}>العدّاد موقوف.</p>}
        {reader && !reader.ready && <p className="text-xs m-muted">وقتك ما ينحفظ لين تتفعّل تحديثات القاعدة.</p>}
        {panel && reader && <TimeHabitLink reader={reader} onChange={(id) => void setHabit(id).then(refresh)} />}
      </div>
    </div>
  );
}
