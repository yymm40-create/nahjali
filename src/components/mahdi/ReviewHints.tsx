"use client";

// «حاسبوا أنفسكم» on the home: «اكتب ملاحظتك على يومك» in the evening (until the day turns at 6 in the morning), and «اكتب ملاحظتك على
// أسبوعك» on the last evening of the week and the day after. It disappears once the note is written, can be put off («لاحقًا») or turned
// off for good («لا تذكّرني»), and is turned back on from the notifications page. Shown only when the notes work (SQL 0094).

import Link from "next/link";
import { useEffect, useState } from "react";
import { addDays, startOfWeek, weekday, type ISODate } from "@/lib/mahdi/engine";
import { weekEndsOn } from "@/lib/mahdi/engage";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { readHints, writeHints, type HintPrefs } from "@/lib/mahdi/client/review-hints";
import Icon from "./Icon";
import { useMahdi } from "./Provider";

type Kind = "day" | "week";
const EVENING_FROM = 17;

/** The week the card is about: this week on its last evening, the one before on the day after it ends; null otherwise. */
export function hintWeek(today: ISODate, weekStart: number, hour: number): ISODate | null {
  const thisWeek = startOfWeek(today, weekStart);
  if (weekday(today) === weekEndsOn(weekStart) && (hour >= EVENING_FROM || hour < 6)) return thisWeek;
  if (weekday(today) === weekStart) return addDays(thisWeek, -7);
  return null;
}

export default function ReviewHints() {
  const { state, toast } = useMahdi();
  const { today } = state;
  const weekStart = state.snap.profile.weekStart;
  const [prefs, setPrefs] = useState<HintPrefs | null>(null);
  const [hour, setHour] = useState<number | null>(null);
  // a note already written (or the notes not working yet): the card stays away
  const [written, setWritten] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // read on the device after the first paint (the server cannot know them)
    const id = setTimeout(() => {
      setPrefs(readHints());
      setHour(new Date().getHours());
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const evening = hour !== null && (hour >= EVENING_FROM || hour < 6);
  const week = hour === null ? null : hintWeek(today, weekStart, hour);
  const want: { kind: Kind; start: ISODate }[] = [];
  if (prefs && evening && prefs.day && prefs.dayLater !== today) want.push({ kind: "day", start: today });
  if (prefs && week && prefs.week && prefs.weekLater !== week) want.push({ kind: "week", start: week });
  const wantKey = want.map((w) => `${w.kind}:${w.start}`).join(",");

  useEffect(() => {
    let live = true;
    for (const w of wantKey ? wantKey.split(",") : []) {
      const [kind, start] = w.split(":");
      mahdiFetch<{ note: string; ready: boolean }>(`/api/mahdi/notes?kind=${kind}&start=${start}`)
        .then((r) => live && setWritten((m) => ({ ...m, [w]: !r.ready || r.note.trim().length > 0 })))
        .catch(() => live && setWritten((m) => ({ ...m, [w]: true })));
    }
    return () => {
      live = false;
    };
  }, [wantKey]);

  const shown = want.filter((w) => written[`${w.kind}:${w.start}`] === false);
  if (!shown.length) return null;

  const later = (w: { kind: Kind; start: ISODate }) => setPrefs(writeHints(w.kind === "day" ? { dayLater: w.start } : { weekLater: w.start }));
  const off = (w: { kind: Kind }) => {
    setPrefs(writeHints(w.kind === "day" ? { day: false } : { week: false }));
    toast("تمام، ما نذكّرك. ترجّعه متى تبي من «الإشعارات».");
  };

  return (
    <div className="space-y-3">
      {shown.map((w) => (
        <section key={`${w.kind}:${w.start}`} className="m-card flex flex-col gap-3 p-4" aria-label={w.kind === "day" ? "ملاحظة يومك" : "ملاحظة أسبوعك"}>
          <div className="flex items-start gap-3">
            <Icon name="edit" size={22} className="m-gold mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">{w.kind === "day" ? "اكتب ملاحظتك على يومك" : "اكتب ملاحظتك على أسبوعك"}</p>
              <p className="text-sm m-muted">{w.kind === "day" ? "حاسب نفسك: دقيقة وحدة تكتب فيها كيف كان يومك." : "خلّص أسبوعك: شوف نتيجتك واكتب شنو تعلّمت."}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={w.kind === "day" ? `/mahdi/day/${w.start}` : `/mahdi/progress/week?start=${w.start}`} className="m-btn m-btn-primary m-btn-sm">
              اكتب الحين
            </Link>
            <button type="button" className="m-btn m-btn-ghost m-btn-sm" onClick={() => later(w)}>لاحقًا</button>
            <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => off(w)}>لا تذكّرني</button>
          </div>
        </section>
      ))}
    </div>
  );
}
