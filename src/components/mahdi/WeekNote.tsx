"use client";

// «ملاحظاتي على أسبوعي» on the home screen: shown at the top once a week, on the day the person picked — the first
// day of the week (a look back at the week that just ended) or its last day (a look at this week before it ends).
// Every other day it is written from «حاسبوا أنفسكم», where it sits at the top of the week.

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { addDays } from "@/lib/mahdi/engine";
import { weekNoteFor, type WeekNoteDay } from "@/lib/mahdi/home-widgets";
import { fmtDate, t } from "@/lib/mahdi/i18n";
import Icon from "./Icon";
import { useMahdi } from "./Provider";
import ReviewNote from "./ReviewNote";

const KEY = "mahdi:week-note-day";
const EVENT = "mahdi:week-note-day";

function read(): WeekNoteDay {
  try {
    return localStorage.getItem(KEY) === "first" ? "first" : "last";
  } catch {
    return "last";
  }
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** On which day of the week the note comes to the home (kept on this device). */
export function useWeekNoteDay(): [WeekNoteDay, (d: WeekNoteDay) => void] {
  const day = useSyncExternalStore(subscribe, read, () => "last" as const);
  const set = (d: WeekNoteDay) => {
    try {
      localStorage.setItem(KEY, d);
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  };
  return [day, set];
}

/** «متى يطلع لك؟»: the first or the last day of the week. */
export function WeekNoteWhen() {
  const [day, setDay] = useWeekNoteDay();
  return (
    <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t.notes.weekWhen}>
      <span className="text-xs m-muted">{t.notes.weekWhen}</span>
      {(["first", "last"] as const).map((d) => (
        <button key={d} type="button" role="radio" aria-checked={day === d} className="m-option px-3 py-1 text-xs" onClick={() => setDay(d)}>
          {t.notes.weekWhenOpt[d]}
        </button>
      ))}
    </div>
  );
}

/** The week's note at the top of the home, on its day. */
export function WeekNoteHome() {
  const { state } = useMahdi();
  const [day] = useWeekNoteDay();
  const start = weekNoteFor(state.today, state.snap.profile.weekStart, day);
  if (!start) return null;
  const range = [fmtDate(start), fmtDate(addDays(start, 6))] as const;
  return (
    <div className="space-y-2">
      <ReviewNote kind="week" start={start} />
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs m-muted">
        <span>{day === "first" ? t.notes.weekPast(...range) : t.notes.weekNow(...range)}</span>
        <Link href={`/mahdi/progress/week?start=${start}`} className="m-gold font-semibold">
          {t.notes.toReview} <Icon name="chevronLeft" size={14} />
        </Link>
      </div>
      <WeekNoteWhen />
    </div>
  );
}
