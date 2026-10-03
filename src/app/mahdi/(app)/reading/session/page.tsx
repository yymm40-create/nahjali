"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { countPages, mergeRanges, parsePagesInput, type PageRange } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { parseNumberInput } from "@/lib/mahdi/client/derive";
import { clock, elapsedMs, loadTimer, saveTimer, sendSession, type TimerState } from "@/lib/mahdi/client/reading";
import BookCover from "@/components/mahdi/BookCover";
import ConfirmSheet from "@/components/mahdi/ConfirmSheet";
import Icon from "@/components/mahdi/Icon";
import { useMahdi } from "@/components/mahdi/Provider";
import { useReading } from "@/components/mahdi/useReading";

/** The current time, for event handlers (never called while rendering). */
const timeNow = () => Date.now();

/**
 * A reading session: choose the first page, then a timer that can pause and resume. It is kept on the device,
 * so closing the app or the browser does not lose it. At the end: the last page, other pages if not read in order,
 * and an optional note.
 */
export default function SessionPage() {
  const router = useRouter();
  const bookId = useSearchParams().get("book") ?? "";
  const { store, toast } = useMahdi();
  const { reading, progress, userId } = useReading();
  const entry = reading.library.find((e) => e.book.id === bookId);
  const book = entry?.book;
  const p = book ? progress(book.id) : null;

  const [timer, setTimerState] = useState<TimerState | null | undefined>(undefined); // undefined = not read yet
  const [now, setNow] = useState(timeNow);
  const [startPage, setStartPage] = useState("");
  const [ending, setEnding] = useState(false);
  const [endPage, setEndPage] = useState("");
  const [extra, setExtra] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [discarding, setDiscarding] = useState(false);
  const [awake, setAwake] = useState(false);
  const lock = useRef<WakeLockSentinel | null>(null);

  const setTimer = (s: TimerState | null) => {
    saveTimer(userId, s);
    setTimerState(s);
  };

  // The saved timer is read after the first render (the server has no access to it)
  useEffect(() => {
    let live = true;
    Promise.resolve().then(() => live && setTimerState(loadTimer(userId)));
    return () => {
      live = false;
    };
  }, [userId]);

  // The clock ticks while running
  useEffect(() => {
    if (!timer?.runningSince) return;
    const id = setInterval(() => setNow(timeNow()), 1000);
    return () => clearInterval(id);
  }, [timer?.runningSince]);

  // Keep the screen on while reading (if the device allows it)
  useEffect(() => {
    if (!awake || !timer?.runningSince || !("wakeLock" in navigator)) return;
    let released = false;
    navigator.wakeLock
      .request("screen")
      .then((l) => {
        if (released) l.release();
        else lock.current = l;
      })
      .catch(() => {});
    return () => {
      released = true;
      lock.current?.release().catch(() => {});
      lock.current = null;
    };
  }, [awake, timer?.runningSince]);

  if (!book || !p) {
    return (
      <div className="m-card space-y-4 p-6 text-center">
        <p>{t.errors.notFound}</p>
        <Link href="/mahdi/reading" className="m-btn m-btn-ghost">{t.reading.title}</Link>
      </div>
    );
  }
  if (timer === undefined) return <p className="m-muted">{t.common.loading}</p>;
  const U = t.reading.u[book.unit];

  const other = timer && timer.bookId !== book.id ? reading.library.find((e) => e.book.id === timer.bookId) : null;
  const mine = timer && timer.bookId === book.id ? timer : null;
  const ms = mine ? elapsedMs(mine, now) : 0;

  const begin = () => {
    const first = Math.round(parseNumberInput(startPage || String(p.nextPage ?? 1)));
    if (!(first >= 1 && first <= book.pages)) return setError(U.invalid(book.pages));
    setError("");
    const at = timeNow();
    setTimer({ bookId: book.id, startPage: first, startedAt: at, accumulated: 0, runningSince: at });
    setNow(at);
  };
  const pause = () => mine?.runningSince && setTimer({ ...mine, accumulated: elapsedMs(mine), runningSince: null });
  const resume = () => mine && !mine.runningSince && (setTimer({ ...mine, runningSince: timeNow() }), setNow(timeNow()));
  const end = () => {
    pause();
    setEnding(true);
    setEndPage("");
  };

  // Pages of this session: from the first page to the last, plus any others typed in
  const last = Math.round(parseNumberInput(endPage));
  const main: PageRange[] = mine && last >= 1 && last <= book.pages ? [[Math.min(mine.startPage, last), Math.max(mine.startPage, last)]] : [];
  const extraRanges = parsePagesInput(extra, book.pages);
  const ranges = mergeRanges([...main, ...(extraRanges ?? [])], book.pages);

  async function save() {
    if (!mine) return;
    if (endPage && !main.length) return setError(U.invalid(book!.pages));
    if (extraRanges === null) return setError(U.invalid(book!.pages));
    const seconds = Math.floor(elapsedMs(mine) / 1000);
    if (!ranges.length && seconds < 30) return setError(t.reading.sessionTooShort);
    setBusy(true);
    setError("");
    try {
      const fresh = await sendSession(userId, { bookId: book!.id, startedAt: new Date(mine.startedAt).toISOString(), seconds, ranges, note: note.trim() });
      setTimer(null);
      if (fresh) {
        store.setSnapPart({ reading: fresh });
        if (fresh.goals.habitId) store.refresh(true); // the linked habit was filled on the server
        toast(t.reading.saved);
      } else {
        toast(t.reading.savedOffline);
      }
      router.push("/mahdi/reading");
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <header className="flex items-center gap-4">
        <BookCover book={book} width={56} />
        <div className="min-w-0">
          <p className="m-eyebrow">{t.reading.sessionTitle}</p>
          <h1 className="m-display truncate text-2xl">{book.title}</h1>
          <p className="m-num text-sm m-muted">{U.progress(p.readPages, p.totalPages)}</p>
        </div>
      </header>

      {other && (
        <div className="m-note space-y-2">
          <p className="font-semibold">{t.reading.otherSession}</p>
          <Link href={`/mahdi/reading/session?book=${other.book.id}`} className="m-btn m-btn-ghost m-btn-sm">{t.reading.openSession}: {other.book.title}</Link>
        </div>
      )}

      {!timer && (
        <section className="m-card space-y-4 p-5">
          <label className="block">
            <span className="m-label">{U.startQ}</span>
            <input className="m-field m-num text-lg" inputMode="numeric" value={startPage} placeholder={String(p.nextPage ?? 1)} onChange={(e) => setStartPage(e.target.value)} />
          </label>
          {error && <p className="m-error" role="alert">{error}</p>}
          <button type="button" className="m-btn m-btn-primary w-full text-lg" onClick={begin}>
            <Icon name="play" /> {t.reading.begin}
          </button>
        </section>
      )}

      {mine && !ending && (
        <section className="m-card space-y-6 p-6 text-center" aria-live="polite">
          <p className={`m-chip mx-auto w-fit ${mine.runningSince ? "m-chip-success" : ""}`}>{mine.runningSince ? t.reading.running : t.reading.paused}</p>
          <p className="m-timer" role="timer" aria-label={t.reading.duration}>{clock(ms)}</p>
          <p className="m-num text-sm m-muted">{U.startedAt(mine.startPage)}</p>
          <div className="grid grid-cols-2 gap-3">
            {mine.runningSince ? (
              <button type="button" className="m-btn m-btn-ghost whitespace-nowrap px-3" onClick={pause}><Icon name="pause" size={20} /> {t.reading.pauseTimer}</button>
            ) : (
              <button type="button" className="m-btn m-btn-ghost whitespace-nowrap px-3" onClick={resume}><Icon name="play" size={20} /> {t.reading.resumeTimer}</button>
            )}
            <button type="button" className="m-btn m-btn-primary whitespace-nowrap px-3" onClick={end}><Icon name="check" size={20} /> {t.reading.end}</button>
          </div>
          {"wakeLock" in (typeof navigator === "undefined" ? {} : navigator) && (
            <label className="flex items-center justify-center gap-2 text-sm">
              <input type="checkbox" className="size-5 accent-[var(--m-gold)]" checked={awake} onChange={(e) => setAwake(e.target.checked)} /> {t.reading.keepAwake}
            </label>
          )}
          <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => setDiscarding(true)}>{t.reading.discard}</button>
        </section>
      )}

      {mine && ending && (
        <form
          className="m-card space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <h2 className="text-lg font-semibold">{t.reading.finishTitle}</h2>
          <p className="m-num m-muted">{t.reading.duration}: {clock(ms)}</p>
          <label className="block">
            <span className="m-label">{U.endLabel}</span>
            <input className="m-field m-num text-lg" inputMode="numeric" autoFocus value={endPage} onChange={(e) => setEndPage(e.target.value)} placeholder={String(mine.startPage)} />
            {main.length > 0 && <span className="m-hint mt-1 block">{U.readRange(main[0][0], main[0][1])}</span>}
          </label>
          <label className="block">
            <span className="m-label">{U.extra}</span>
            <input className="m-field m-num" inputMode="text" dir="ltr" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="40-45, 60" />
            <span className="m-hint mt-1 block">{U.extraHint}</span>
          </label>
          <label className="block">
            <span className="m-label">{t.reading.note}</span>
            <textarea className="m-field" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.reading.notePlaceholder} />
          </label>
          {ranges.length > 0 && <p className="m-num text-sm font-semibold">{U.count(countPages(ranges))}</p>}
          {error && <p className="m-error" role="alert">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className="m-btn m-btn-ghost" onClick={() => (setEnding(false), resume())}>{t.reading.resumeTimer}</button>
            <button className="m-btn m-btn-primary" disabled={busy}>{busy ? t.common.saving : t.reading.save}</button>
          </div>
        </form>
      )}

      <ConfirmSheet
        open={discarding}
        onClose={() => setDiscarding(false)}
        title={t.reading.discardTitle}
        body={t.reading.discardBody}
        confirmLabel={t.reading.discard}
        onConfirm={async () => {
          setTimer(null);
          router.push("/mahdi/reading");
        }}
      />
    </div>
  );
}
