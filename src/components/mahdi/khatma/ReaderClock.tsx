"use client";

// «الختمة العلوية» · the time pill at the top of the reader: the time spent reading, counted while the page is open and on
// screen (a tap pauses / resumes), shown in minutes, reported to the server every few seconds (and when the page is
// left), which keeps the day's total and adds each completed minute to the habit the person linked («عادة القراءة»).
// Used by the one Quran reader (my khatma, the free reading, a group's portion).

import { useCallback, useEffect, useRef, useState } from "react";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { CLOCK, isTimeHabit, minutesText, pillText, wholeMinutes } from "@/lib/mahdi/khatma/reader";
import HabitLinkButton from "../HabitLinkButton";
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

/**
 * The reading time's habit: «اربط بعادة», one button (the habits reading time can fill: minutes, hours, or done / not
 * done). `inline` when it sits inside the reader's own sheet.
 */
export function TimeHabitLink({ reader, onChange, inline = false }: { reader: ReaderState; onChange: (id: string | null) => unknown; inline?: boolean }) {
  const habits = useTimeHabits();
  const linked = habits.find((h) => h.id === reader.timeHabitId) ?? null;
  const unit = linked?.versions.at(-1)?.unit ?? "";
  const what = linked
    ? `كل دقيقة تقرؤها تنضاف لعادة «${linked.name}» في يومها${linked.versions.at(-1)?.measure === "check" ? " (تصير تمّت)" : unit && !/ساع/.test(unit) && unit !== "دقيقة" ? ` (${unit})` : ""}.`
    : "اختر عادة القراءة، فكل دقيقة تقرؤها تنضاف لها وحدها.";
  return (
    <HabitLinkButton
      linked={linked}
      habits={habits}
      onChange={onChange}
      what={what}
      inline={inline}
      empty="ما عندك عادة بالدقائق. أنشئ عادة مثل «قراءة القرآن 20 دقيقة» وترجع تربطها هنا."
    />
  );
}

const URL = "/api/mahdi/khatma/reader";

/**
 * The stopwatch of a reading visit: it goes on from one page of the reader to the next (each page is a new screen, so it is
 * kept here, outside the screens) and starts again from zero only after the person has been away from the reader for a while.
 */
const VISIT_GAP_MS = 10 * 60_000;
const visit = { seconds: 0, running: true, leftAt: 0 };
const visitSeconds = () => {
  if (visit.leftAt && Date.now() - visit.leftAt > VISIT_GAP_MS) {
    visit.seconds = 0;
    visit.running = true;
  }
  visit.leftAt = 0;
  return visit.seconds;
};

/**
 * The clock of a reading visit, for the pill at the top of the reader. The stopwatch does NOT start again when the person
 * moves to another portion: it goes on for the whole visit (the day's total keeps counting too). The screen is told only
 * when a whole minute passes (the pill shows minutes), so the page of the Quran is not redrawn every second.
 */
export function useReadingClock(rs: ReturnType<typeof useReaderState>) {
  const { store } = useMahdi();
  const { initial } = rs;
  const [running, setRunning] = useState(() => visit.running);
  // the visit's seconds when this screen opened (the day's total from the server already holds the ones reported before)
  const [from] = useState(visitSeconds);
  const [session, setSession] = useState(from);
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
      visit.seconds += 1;
      // the same minute: React keeps the old value and draws nothing
      setSession((s) => (wholeMinutes(s) === wholeMinutes(visit.seconds) ? s : visit.seconds));
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
      visit.leftAt = Date.now();
      flush();
    };
  }, [running, flush]);

  const toggle = useCallback(
    () =>
      setRunning((v) => {
        visit.running = !v;
        return !v;
      }),
    [],
  );
  const today = initial + (session - from);
  return { session, today, running, toggle };
}

/**
 * The small pill at the top of the reader: the visit's minutes, never seconds ticking in front of the person. A tap pauses
 * it (and another goes on).
 */
export default function ReaderClock({ clock }: { clock: ReturnType<typeof useReadingClock> }) {
  const { session, today, running, toggle } = clock;
  return (
    <button
      type="button"
      className="m-time-pill m-num"
      onClick={toggle}
      aria-pressed={!running}
      aria-label={`${running ? "وقت القراءة" : "العدّاد موقوف"}: ${minutesText(wholeMinutes(session))}، واليوم ${minutesText(wholeMinutes(today))}. ${running ? "اضغط توقفه" : "اضغط تكمّله"}`}
    >
      <Icon name={running ? "timer" : "pause"} size={16} />
      {pillText(session)}
    </button>
  );
}
