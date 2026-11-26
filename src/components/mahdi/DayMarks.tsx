"use client";

// «أيام العذر والقضاء» (owner-approved, 26 November 2026): habits without guilt.
// - DayMarkSheet: «يوم عذر» for a day (travel, illness, the shar'i excuse — two a week), or a pause of up to 14 days from today.
// - DayMarkCard: on a day's page. A missed day is soft orange (never red) and can be made up («قضاء»); an excused day says so.
// - TodayExcuseCard / QadaCard: the home's one card when today is excused, or when a recent day can still be made up.
// Never a «your streak broke» message: an excused day keeps the streak, and a missed day is something you can still do.

import Link from "next/link";
import { useState } from "react";
import { CONSISTENCY_THRESHOLD } from "@config/mahdi";
import { addDays, dayState, EXCUSES_PER_WEEK, excusesLeft, markOn, missedDays, PAUSE_MAX_DAYS, pauseAround, type DayMarkKind, type ISODate } from "@/lib/mahdi/engine";
import { fmtDate, fmtNum, fmtRelativeDay } from "@/lib/mahdi/i18n";
import type { MarkOp } from "@/lib/mahdi/client/day-marks";
import Icon from "./Icon";
import { useMahdi } from "./Provider";
import Sheet from "./Sheet";

export const MARK_NAME: Record<DayMarkKind, string> = {
  travel: "سفر",
  illness: "مرض",
  shari: "عذر شرعي",
  pause: "إيقاف",
  qada: "قضاء",
};

const EXCUSE_HINT: Record<"travel" | "illness" | "shari", string> = {
  travel: "مسافر وجدولك تغيّر",
  illness: "تعبان، الله يشافيك",
  shari: "أيام العذر الشرعي",
};

function useMark() {
  const { markDay, toast } = useMahdi();
  const [busy, setBusy] = useState(false);
  const run = async (op: MarkOp, done: string) => {
    setBusy(true);
    try {
      await markDay(op);
      toast(done);
      return true;
    } catch (e) {
      toast((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { run, busy };
}

/** «يوم» in plain Gulf words: يوم واحد · يومين · 3 أيام · 14 يوم. */
export const daysWord = (n: number) => (n === 1 ? "يوم واحد" : n === 2 ? "يومين" : n <= 10 ? `${fmtNum(n)} أيام` : `${fmtNum(n)} يوم`);
const left = (n: number) => (n === 0 ? "خلصت أيام العذر هالأسبوع" : n === 1 ? "باقي لك يوم عذر واحد هالأسبوع" : n === 2 ? "باقي لك يومين عذر هالأسبوع" : `باقي لك ${fmtNum(n)} أيام عذر هالأسبوع`);

/** «يوم عذر»: the reasons for one day, how many are left this week, and (for today) a pause of up to 14 days. */
export function DayMarkSheet({ open, onClose, day }: { open: boolean; onClose: () => void; day: ISODate }) {
  const { state, dayMarks } = useMahdi();
  const { today, snap } = state;
  const { run, busy } = useMark();
  const [pauseFor, setPauseFor] = useState(3);
  const kind = markOn(dayMarks, day);
  const pause = pauseAround(dayMarks, day);
  const n = excusesLeft(dayMarks, day, snap.profile.weekStart);
  const when = fmtRelativeDay(day, today);
  const act = async (op: MarkOp, done: string) => {
    if (await run(op, done)) onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={day === today ? "يوم عذر" : `يوم عذر · ${when}`}>
      <div className="space-y-5">
        <p className="text-sm m-muted">يوم العذر ما يكسر سلسلتك ولا ينحسب عليك. لك {daysWord(EXCUSES_PER_WEEK)} عذر بالأسبوع، والإيقاف لين {daysWord(PAUSE_MAX_DAYS)}.</p>

        {pause ? (
          <div className="m-excuse-card space-y-3 p-4">
            <p className="font-semibold">
              <Icon name="pause" size={16} /> عاداتك موقّفة من {fmtDate(pause.from)} لين {fmtDate(pause.to)}
            </p>
            <button type="button" className="m-btn m-btn-primary w-full" disabled={busy} onClick={() => act({ action: "endPause", day: day < today ? today : day }, "رجعت عاداتك، الله يوفقك.")}>
              <Icon name="play" size={18} /> كمّل من اليوم
            </button>
          </div>
        ) : kind && kind !== "qada" ? (
          <div className="m-excuse-card space-y-3 p-4">
            <p className="font-semibold">{when}: يوم عذر ({MARK_NAME[kind]})</p>
            <button type="button" className="m-btn m-btn-ghost w-full" disabled={busy} onClick={() => act({ action: "clear", day }, "شلنا العذر عن هاليوم.")}>
              <Icon name="undo" size={18} /> ألغِ العذر
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="m-eyebrow">{left(n)}</p>
              <div className="grid gap-2">
                {(["travel", "illness", "shari"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="m-option flex items-center justify-between gap-3 p-3 text-start"
                    disabled={busy || n === 0}
                    onClick={() => act({ action: "set", day, kind: k }, `تمام، ${when} يوم عذر. سلسلتك محفوظة.`)}
                  >
                    <span>
                      <b className="block">{MARK_NAME[k]}</b>
                      <span className="m-hint">{EXCUSE_HINT[k]}</span>
                    </span>
                    <Icon name="chevronLeft" size={18} />
                  </button>
                ))}
              </div>
            </div>

            {day === today && (
              <div className="m-soft space-y-3 p-4">
                <p className="font-semibold">
                  <Icon name="pause" size={16} /> أوقف عاداتك كم يوم
                </p>
                <p className="text-sm m-muted">لسفر طويل أو ظرف. ما تنحسب عليك، وترجع متى ما تبي.</p>
                <div className="flex items-center justify-between gap-3">
                  <button type="button" className="m-icon-btn" aria-label="يوم أقل" disabled={pauseFor <= 1} onClick={() => setPauseFor((x) => Math.max(1, x - 1))}>
                    <Icon name="minus" />
                  </button>
                  <span className="m-num text-xl font-semibold">{daysWord(pauseFor)}</span>
                  <button type="button" className="m-icon-btn" aria-label="يوم زيادة" disabled={pauseFor >= PAUSE_MAX_DAYS} onClick={() => setPauseFor((x) => Math.min(PAUSE_MAX_DAYS, x + 1))}>
                    <Icon name="plus" />
                  </button>
                </div>
                <button type="button" className="m-btn m-btn-ghost w-full" disabled={busy} onClick={() => act({ action: "pause", from: today, days: pauseFor }, `وقّفنا عاداتك لين ${fmtDate(addDays(today, pauseFor - 1))}. ترجع متى ما تبي.`)}>
                  أوقفها لين {fmtDate(addDays(today, pauseFor - 1))}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

/** On a day's page: what this day is (missed and can be made up, made up, excused), and the one thing to do about it. */
export function DayMarkCard({ day }: { day: ISODate }) {
  const { state, timeline, dayMarks } = useMahdi();
  const { run, busy } = useMark();
  const [sheet, setSheet] = useState(false);
  const st = dayState(timeline, day, CONSISTENCY_THRESHOLD, dayMarks);
  const kind = markOn(dayMarks, day);
  const isToday = day === state.today;

  let body: React.ReactNode = null;
  if (st === "missed" && kind === "qada") {
    body = (
      <div className="m-missed-card flex items-start gap-3 p-4" role="status">
        <Icon name="undo" size={20} className="mt-0.5 shrink-0" />
        <p className="text-sm font-semibold">القضاء مفتوح: سجّل اللي سويته تحت، وينحسب لك هاليوم.</p>
      </div>
    );
  } else if (st === "missed") {
    body = (
      <div className="m-missed-card space-y-3 p-4">
        <p className="font-semibold">هاليوم فاتك، عادي.</p>
        <p className="text-sm">تقدر تقضيه الحين: سجّل اللي سويته وينحسب لك، أو علّمه يوم عذر إذا كان عندك عذر.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="m-btn m-btn-primary m-btn-sm" disabled={busy} onClick={() => run({ action: "set", day, kind: "qada" }, "تمام، سجّل اللي سويته تحت.")}>
            أبي أقضيه
          </button>
          <button type="button" className="m-btn m-btn-ghost m-btn-sm" onClick={() => setSheet(true)}>
            كان عندي عذر
          </button>
        </div>
      </div>
    );
  } else if (st === "qada") {
    body = (
      <p className="m-chip m-qada-chip">
        <Icon name="check" size={14} /> قضيت هاليوم، الله يتقبل
      </p>
    );
  } else if (st === "excused" && kind) {
    body = (
      <button type="button" className="m-excuse-card flex w-full items-center gap-3 p-4 text-start" onClick={() => setSheet(true)}>
        <Icon name="pause" size={20} className="shrink-0" />
        <span className="min-w-0 flex-1">
          <b className="block">يوم عذر ({MARK_NAME[kind]})</b>
          <span className="text-sm">ما يكسر سلسلتك. تقدر تسجّل لو سويت شي.</span>
        </span>
        <Icon name="chevronLeft" size={18} />
      </button>
    );
  } else if (st === "open" || st === "none" || (isToday && st !== "done")) {
    body = (
      <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => setSheet(true)}>
        <Icon name="pause" size={16} /> {isToday ? "عندك عذر اليوم؟" : "كان يوم عذر؟"}
      </button>
    );
  }

  if (!body) return null;
  return (
    <>
      {body}
      <DayMarkSheet open={sheet} onClose={() => setSheet(false)} day={day} />
    </>
  );
}

/** The home's card when today is excused or paused: it says so calmly, with a way back. */
export function TodayExcuseCard() {
  const { state, dayMarks } = useMahdi();
  const [sheet, setSheet] = useState(false);
  const kind = markOn(dayMarks, state.today);
  if (!kind || kind === "qada") return null;
  const pause = pauseAround(dayMarks, state.today);
  return (
    <section className="m-excuse-card flex items-center gap-3 p-4" aria-label="يوم عذر">
      <Icon name="pause" size={22} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{pause ? `عاداتك موقّفة لين ${fmtDate(pause.to)}` : `اليوم يوم عذر (${MARK_NAME[kind]})`}</p>
        <p className="text-sm">سلسلتك محفوظة. وإذا سويت شي، سجّله عادي.</p>
      </div>
      <button type="button" className="m-btn m-btn-ghost m-btn-sm" onClick={() => setSheet(true)}>
        غيّر
      </button>
      <DayMarkSheet open={sheet} onClose={() => setSheet(false)} day={state.today} />
    </section>
  );
}

/** The home's card when a day of the last week went by without its goals: it can still be made up («قضاء»). */
export function QadaCard() {
  const { timeline, dayMarks, state } = useMahdi();
  const missed = missedDays(timeline, CONSISTENCY_THRESHOLD, dayMarks, 7);
  if (!missed.length) return null;
  const last = missed[0];
  return (
    <Link href={`/mahdi/day/${last}`} className="m-missed-card flex items-center gap-3 p-4">
      <Icon name="undo" size={22} className="shrink-0" />
      <span className="min-w-0 flex-1">
        <b className="block">{missed.length === 1 ? `${fmtRelativeDay(last, state.today)} فاتك؟ تقدر تقضيه` : `عندك ${daysWord(missed.length)} تقدر تقضيها`}</b>
        <span className="block text-sm">سجّل اللي سويته وينحسب لك، أو علّمه يوم عذر.</span>
      </span>
      <Icon name="chevronLeft" size={18} />
    </Link>
  );
}
