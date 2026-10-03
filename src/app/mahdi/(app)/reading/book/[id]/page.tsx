"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { formatRanges, parsePagesInput } from "@/lib/mahdi/engine";
import { fmtDate, fmtNum, fmtPct, fmtRelativeDay, t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { duration, sendSession } from "@/lib/mahdi/client/reading";
import type { ReadingData } from "@/lib/mahdi/types";
import BookCover from "@/components/mahdi/BookCover";
import ConfirmSheet from "@/components/mahdi/ConfirmSheet";
import Icon from "@/components/mahdi/Icon";
import { useMahdi } from "@/components/mahdi/Provider";
import Sheet from "@/components/mahdi/Sheet";
import { useReading } from "@/components/mahdi/useReading";

/** One book: progress, the map of pages read, sessions and notes, pages added by hand, and the library actions. */
export default function BookPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { store, toast } = useMahdi();
  const { reading, progress, sessionsOf, today, userId, current } = useReading();
  const entry = reading.library.find((e) => e.book.id === id);
  const [busy, setBusy] = useState(false);
  const [pagesText, setPagesText] = useState("");
  const [pagesError, setPagesError] = useState("");
  const [removing, setRemoving] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  if (!entry) {
    return (
      <div className="m-card space-y-4 p-6 text-center">
        <p>{t.errors.notFound}</p>
        <Link href="/mahdi/reading" className="m-btn m-btn-ghost">{t.reading.title}</Link>
      </div>
    );
  }
  const { book, state } = entry;
  const p = progress(book.id);
  const U = t.reading.u[book.unit];
  const sessions = [...sessionsOf(book.id)].reverse();
  const notes = sessions.filter((s) => s.note);

  const apply = (fresh: ReadingData) => {
    store.setSnapPart({ reading: fresh });
    if (fresh.goals.habitId) store.refresh(true);
  };

  async function act(action: "read" | "pause" | "finish", done: string) {
    setBusy(true);
    try {
      apply((await mahdiFetch<{ reading: ReadingData }>("/api/mahdi/reading/library", { method: "POST", json: { bookId: book.id, action } })).reading);
      toast(done);
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }

  async function addPages(e: React.FormEvent) {
    e.preventDefault();
    const ranges = parsePagesInput(pagesText, book.pages);
    if (!ranges || ranges.length === 0) return setPagesError(U.invalid(book.pages));
    setBusy(true);
    setPagesError("");
    try {
      const fresh = await sendSession(userId, { bookId: book.id, date: today, seconds: 0, ranges, note: "" });
      if (fresh) apply(fresh);
      toast(fresh ? U.saved : t.reading.savedOffline);
      setPagesText("");
    } catch (err) {
      setPagesError((err as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <Link href="/mahdi/reading" className="m-btn m-btn-quiet m-btn-sm -ms-3">
        <Icon name="chevronRight" size={18} /> {t.reading.title}
      </Link>

      <header className="flex gap-4">
        <BookCover book={book} width={104} />
        <div className="min-w-0 space-y-1">
          <h1 className="m-display text-2xl">{book.title}</h1>
          {book.author && <p className="m-muted">{book.author}</p>}
          <p className="m-num text-sm m-muted">{U.count(book.pages)}</p>
          {state === "finished" && entry.finishedAt && <p className="m-chip m-chip-success w-fit">{t.reading.finishedOn(fmtDate(entry.finishedAt.slice(0, 10)))}</p>}
        </div>
      </header>
      {book.hidden && <p className="m-note text-sm">{t.reading.hiddenNote}</p>}

      <section className="m-card space-y-3 p-5" aria-labelledby="prog">
        <div className="flex items-baseline justify-between">
          <h2 id="prog" className="font-semibold">{U.read}</h2>
          <span className="m-num text-2xl font-semibold">{fmtPct(p.share)}</span>
        </div>
        <div className="m-pagemap" role="img" aria-label={`${U.map}: ${formatRanges(p.ranges) || "—"}`}>
          {p.ranges.map(([a, b]) => (
            <span key={a} style={{ insetInlineStart: `${((a - 1) / book.pages) * 100}%`, width: `${((b - a + 1) / book.pages) * 100}%` }} />
          ))}
        </div>
        <p className="m-num text-sm m-muted">
          {U.progress(p.readPages, p.totalPages)}
          {p.seconds > 0 && <> · {duration(p.seconds)}</>}
          {p.pagesPerHour !== null && <> · {U.speed(Math.round(p.pagesPerHour))}</>}
          {p.secondsLeft !== null && <> · {t.reading.timeLeft(duration(p.secondsLeft))}</>}
        </p>
        {p.ranges.length > 0 && (
          <p className="m-num text-sm">
            <bdi dir="ltr">{formatRanges(p.ranges)}</bdi>
          </p>
        )}

        {state === "reading" && (
          <Link href={`/mahdi/reading/session?book=${book.id}`} className="m-btn m-btn-primary w-full">
            <Icon name="timer" /> {p.nextPage && p.readPages > 0 ? U.continueFrom(p.nextPage) : t.reading.start}
          </Link>
        )}
        {state !== "reading" && (
          <button type="button" className="m-btn m-btn-primary w-full" disabled={busy || current.length >= 3} onClick={() => act("read", t.reading.resumedToast)}>
            <Icon name="book" /> {t.reading.resume}
          </button>
        )}
        {state !== "reading" && current.length >= 3 && <p className="text-sm m-muted">{t.reading.full}</p>}
      </section>

      {book.description && (
        <section className="m-card space-y-1 p-5">
          <h2 className="font-semibold">{t.reading.about}</h2>
          <p className="whitespace-pre-line">{book.description}</p>
        </section>
      )}

      <form className="m-card space-y-3 p-5" onSubmit={addPages}>
        <label className="block">
          <span className="m-label">{U.add}</span>
          <input className="m-field m-num" dir="ltr" value={pagesText} onChange={(e) => setPagesText(e.target.value)} placeholder="1-12, 30" />
          <span className="m-hint mt-1 block">{U.addHint}</span>
        </label>
        {pagesError && <p className="m-error" role="alert">{pagesError}</p>}
        <button className="m-btn m-btn-ghost w-full" disabled={busy || !pagesText.trim()}>{U.addSave}</button>
      </form>

      {notes.length > 0 && (
        <section className="space-y-2" aria-labelledby="notes">
          <h2 id="notes" className="text-lg font-semibold">{t.reading.notes}</h2>
          <ul className="space-y-2">
            {notes.map((s) => (
              <li key={s.id} className="m-card p-4">
                <p className="whitespace-pre-line">«{s.note}»</p>
                <p className="m-num mt-1 text-sm m-muted">{fmtRelativeDay(s.date, today)}{s.ranges.length > 0 && <> · <bdi dir="ltr">{formatRanges(s.ranges)}</bdi></>}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2" aria-labelledby="sess">
        <h2 id="sess" className="text-lg font-semibold">{t.reading.sessions}</h2>
        {sessions.length === 0 ? (
          <p className="m-card p-5 text-center m-muted">{t.reading.noSessions}</p>
        ) : (
          <ul className="m-card divide-y" style={{ borderColor: "var(--m-line)" }}>
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{fmtRelativeDay(s.date, today)}</span>
                  <span className="m-num block text-sm m-muted">
                    {s.seconds > 0 ? duration(s.seconds) : t.reading.manual} · {U.count(s.pages)}
                    {s.ranges.length > 0 && <> (<bdi dir="ltr">{formatRanges(s.ranges)}</bdi>)</>}
                  </span>
                </span>
                <button type="button" className="m-icon-btn" aria-label={t.reading.deleteSession} onClick={() => setDeleting(s.id)}>
                  <Icon name="trash" size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="m-card space-y-2 p-5" aria-label={t.reading.actions}>
        {state === "reading" && (
          <>
            <button type="button" className="m-btn m-btn-ghost w-full justify-start" disabled={busy} onClick={() => act("finish", t.reading.finishedToast)}>
              <Icon name="check" /> {t.reading.markFinished}
            </button>
            <button type="button" className="m-btn m-btn-ghost w-full justify-start" disabled={busy} onClick={() => act("pause", t.reading.pausedToast)}>
              <Icon name="pause" /> {t.reading.pause}
            </button>
          </>
        )}
        {state === "paused" && (
          <button type="button" className="m-btn m-btn-ghost w-full justify-start" disabled={busy} onClick={() => act("finish", t.reading.finishedToast)}>
            <Icon name="check" /> {t.reading.markFinished}
          </button>
        )}
        <button type="button" className="m-btn m-btn-quiet w-full justify-start" onClick={() => (setReason(""), setReporting(true))}>
          <Icon name="flag" /> {t.reading.report}
        </button>
        <button type="button" className="m-btn m-btn-danger w-full justify-start" onClick={() => setRemoving(true)}>
          <Icon name="trash" /> {t.reading.remove}
        </button>
      </section>

      <p className="m-num text-center text-sm m-muted">{fmtNum(sessions.length)} · {t.reading.sessions}</p>

      <ConfirmSheet
        open={removing}
        onClose={() => setRemoving(false)}
        title={t.reading.removeTitle}
        body={t.reading.removeBody}
        confirmLabel={t.reading.remove}
        onConfirm={async () => {
          const { reading: fresh } = await mahdiFetch<{ reading: ReadingData }>("/api/mahdi/reading/library", { method: "POST", json: { bookId: book.id, action: "remove" } });
          store.setSnapPart({ reading: fresh });
          toast(t.reading.removed);
          router.push("/mahdi/reading");
        }}
      />
      <ConfirmSheet
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={t.reading.deleteSessionTitle}
        body={t.reading.deleteSessionBody}
        onConfirm={async () => {
          apply((await mahdiFetch<{ reading: ReadingData }>(`/api/mahdi/reading/sessions/${deleting}`, { method: "DELETE" })).reading);
          toast(t.reading.sessionDeleted);
        }}
      />
      <Sheet open={reporting} onClose={() => setReporting(false)} title={t.reading.reportTitle}>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setReporting(false);
            try {
              await mahdiFetch(`/api/mahdi/reading/books/${book.id}`, { method: "POST", json: { report: reason } });
              toast(t.reading.reported);
            } catch (err) {
              toast((err as Error).message);
            }
          }}
        >
          <p>{t.reading.reportBody}</p>
          <label className="block">
            <span className="m-label">{t.reading.reportReason}</span>
            <textarea className="m-field" rows={3} maxLength={300} required value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <button className="m-btn m-btn-primary w-full">{t.reading.reportSend}</button>
        </form>
      </Sheet>
    </div>
  );
}
