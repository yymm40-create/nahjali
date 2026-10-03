"use client";

import Link from "next/link";
import { fmtPct, t } from "@/lib/mahdi/i18n";
import { duration } from "@/lib/mahdi/client/reading";
import BookCover from "./BookCover";
import Icon from "./Icon";
import { useReading } from "./useReading";

/** On the home screen: the book being read and a one-tap start, or an invitation to add the first book. */
export default function ReadingCard() {
  const { current, progress, summary } = useReading();
  const book = current[0]?.book;
  const p = book ? progress(book.id) : null;
  return (
    <section className="m-card flex items-center gap-4 p-4" aria-label={t.reading.title}>
      {book ? <BookCover book={book} width={48} /> : <Icon name="book" size={32} className="m-gold shrink-0" />}
      <Link href={book ? `/mahdi/reading/book/${book.id}` : "/mahdi/reading"} className="min-w-0 flex-1">
        <span className="m-eyebrow block">{t.reading.title}</span>
        <span className="block truncate font-semibold">{book ? book.title : t.reading.emptyTitle}</span>
        <span className="m-num block text-sm m-muted">
          {p ? `${fmtPct(p.share)} · ` : ""}
          {t.reading.today}: {duration(summary.today.seconds)}
        </span>
      </Link>
      <Link href={book ? `/mahdi/reading/session?book=${book.id}` : "/mahdi/reading/add"} className="m-icon-btn m-btn-primary size-12 shrink-0 rounded-2xl" aria-label={book ? t.reading.start : t.reading.addBook}>
        <Icon name={book ? "play" : "plus"} />
      </Link>
    </section>
  );
}
