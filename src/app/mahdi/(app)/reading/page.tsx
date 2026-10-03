"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { goalProgress, type ReadingMetric } from "@/lib/mahdi/engine";
import { fmtNum, fmtPct, t } from "@/lib/mahdi/i18n";
import { duration, flushPending, loadTimer, pendingCount, type TimerState } from "@/lib/mahdi/client/reading";
import BookCover from "@/components/mahdi/BookCover";
import Icon from "@/components/mahdi/Icon";
import { FeedbackCard } from "@/components/mahdi/Feedback";
import { useMahdi } from "@/components/mahdi/Provider";
import { useReading } from "@/components/mahdi/useReading";

/** «متعلّم على سبيل نجاة»: my current books, today's reading and the goals. */
export default function ReadingPage() {
  const { store } = useMahdi();
  const { reading, summary, current, progress, userId } = useReading();
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [pending, setPending] = useState(0);

  // A running session and sessions saved offline live on the device
  useEffect(() => {
    let live = true;
    const sync = () =>
      flushPending(userId).then((r) => {
        if (!live) return;
        if (r) store.setSnapPart({ reading: r });
        setPending(pendingCount(userId));
        setTimer(loadTimer(userId));
      });
    sync();
    window.addEventListener("online", sync);
    return () => {
      live = false;
      window.removeEventListener("online", sync);
    };
  }, [store, userId]);

  const timerBook = timer && reading.library.find((e) => e.book.id === timer.bookId);
  const daily = goalProgress(reading.goals.daily, summary.today);
  const weekly = goalProgress(reading.goals.weekly, summary.week);
  const unit = (m: ReadingMetric) => (m === "minutes" ? t.reading.unitMinutes : m === "narrations" ? t.reading.unitNarrations : t.reading.unitPages);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="m-display text-3xl">{t.reading.title}</h1>
        <p className="m-muted">{t.reading.tagline}</p>
      </header>

      {timerBook && (
        <Link href={`/mahdi/reading/session?book=${timerBook.book.id}`} className="m-note flex items-center gap-3 font-semibold">
          <Icon name="timer" className="m-gold" />
          <span className="flex-1">{timer?.runningSince ? t.reading.running : t.reading.paused}: {timerBook.book.title}</span>
          <Icon name="chevronLeft" size={18} />
        </Link>
      )}
      {pending > 0 && <p className="m-note text-sm" role="status">{t.reading.pendingSessions(pending)}</p>}

      <section className="grid grid-cols-3 gap-3" aria-label={t.reading.stats}>
        {(
          [
            [t.reading.today, summary.today],
            [t.reading.week, summary.week],
            [t.reading.month, summary.month],
          ] as const
        ).map(([label, v]) => (
          <div key={label} className="m-card p-3 text-center">
            <p className="m-eyebrow">{label}</p>
            <p className="m-num text-lg font-semibold">{duration(v.seconds)}</p>
            <p className="m-num text-sm m-muted">{t.reading.pages(v.pages)}</p>
            {v.narrations > 0 && <p className="m-num text-sm m-muted">{t.reading.narrations(v.narrations)}</p>}
          </div>
        ))}
      </section>

      {(daily || weekly || summary.streak > 0) && (
        <section className="m-card space-y-3 p-4">
          {summary.streak > 0 && (
            <p className="flex items-center gap-2 font-semibold">
              <Icon name="streak" className="m-gold" size={20} /> {t.reading.streak(summary.streak)}
            </p>
          )}
          {(
            [
              [t.reading.dailyGoal, daily],
              [t.reading.weeklyGoal, weekly],
            ] as const
          ).map(([label, g]) =>
            g ? (
              <div key={label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">{label}</span>
                  <span className="m-num m-muted">{t.reading.goalDone(g.done, g.target, unit(g.metric))}</span>
                </div>
                <div className="m-bar" role="progressbar" aria-label={label} aria-valuenow={Math.round(g.share * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <span style={{ width: `${g.share * 100}%` }} />
                </div>
              </div>
            ) : null,
          )}
        </section>
      )}

      <section className="space-y-3" aria-labelledby="current-title">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="current-title" className="text-lg font-semibold">{t.reading.current}</h2>
          <span className="m-num text-sm m-muted">{t.reading.currentHint(current.length, 3)}</span>
        </div>

        {current.length === 0 && (
          <div className="m-card space-y-3 p-6 text-center">
            <Icon name="book" size={36} className="m-gold mx-auto" />
            <p className="font-semibold">{t.reading.emptyTitle}</p>
            <p className="text-sm m-muted">{t.reading.emptyBody}</p>
          </div>
        )}

        <ul className="space-y-3">
          {current.map(({ book }) => {
            const p = progress(book.id);
            return (
              <li key={book.id} className="m-card flex gap-4 p-4">
                <Link href={`/mahdi/reading/book/${book.id}`} className="shrink-0" aria-label={book.title}>
                  <BookCover book={book} width={72} />
                </Link>
                <div className="min-w-0 flex-1 space-y-2">
                  <Link href={`/mahdi/reading/book/${book.id}`} className="block">
                    <span className="block truncate font-semibold">{book.title}</span>
                    {book.author && <span className="block truncate text-sm m-muted">{book.author}</span>}
                  </Link>
                  <div className="m-bar" role="progressbar" aria-label={book.title} aria-valuenow={Math.round(p.share * 100)} aria-valuemin={0} aria-valuemax={100}>
                    <span style={{ width: `${p.share * 100}%` }} />
                  </div>
                  <p className="m-num text-sm m-muted">
                    {fmtPct(p.share)} · {t.reading.u[book.unit].progress(p.readPages, p.totalPages)}
                    {p.secondsLeft !== null && <> · {t.reading.timeLeft(duration(p.secondsLeft))}</>}
                  </p>
                  <Link href={`/mahdi/reading/session?book=${book.id}`} className="m-btn m-btn-primary m-btn-sm w-full sm:w-auto">
                    <Icon name="timer" size={18} /> {p.nextPage && p.readPages > 0 ? t.reading.u[book.unit].continueFrom(p.nextPage) : t.reading.start}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>

        {current.length < 3 && (
          <Link href="/mahdi/reading/add" className="m-btn m-btn-ghost w-full">
            <Icon name="plus" size={18} /> {t.reading.addBook}
          </Link>
        )}
      </section>

      <nav className="grid gap-2 sm:grid-cols-2" aria-label={t.reading.title}>
        <Link href="/mahdi/reading/shelf" className="m-card flex items-center gap-3 p-4 font-semibold">
          <Icon name="book" className="m-gold" /> <span className="flex-1">{t.reading.shelf}</span>
          <span className="m-num text-sm m-muted">{fmtNum(reading.library.filter((e) => e.state === "finished").length)}</span>
          <Icon name="chevronLeft" size={18} />
        </Link>
        <Link href="/mahdi/reading/goals" className="m-card flex items-center gap-3 p-4 font-semibold">
          <Icon name="target" className="m-gold" /> <span className="flex-1">{t.reading.goalsLink}</span> <Icon name="chevronLeft" size={18} />
        </Link>
      </nav>
      <FeedbackCard place="reading" />
    </div>
  );
}
