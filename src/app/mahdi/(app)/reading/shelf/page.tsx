"use client";

import Link from "next/link";
import { fmtNum, t } from "@/lib/mahdi/i18n";
import BookCover from "@/components/mahdi/BookCover";
import Icon from "@/components/mahdi/Icon";
import { useReading } from "@/components/mahdi/useReading";
import type { LibraryEntry } from "@/lib/mahdi/types";

/** «مكتبتي»: finished books stand on a shelf by their covers; paused books on a shelf of their own. */
export default function ShelfPage() {
  const { reading } = useReading();
  const finished = reading.library
    .filter((e) => e.state === "finished")
    .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""));
  const paused = reading.library.filter((e) => e.state === "paused");

  const shelf = (list: LibraryEntry[], label: string) => (
    <ul className="m-shelf" aria-label={label}>
      {list.map(({ book }) => (
        <li key={book.id}>
          <Link href={`/mahdi/reading/book/${book.id}`} aria-label={book.title} className="block transition-transform hover:-translate-y-1">
            <BookCover book={book} width={76} />
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-6">
      <Link href="/mahdi/reading" className="m-btn m-btn-quiet m-btn-sm -ms-3">
        <Icon name="chevronRight" size={18} /> {t.reading.title}
      </Link>
      <h1 className="m-display text-3xl">{t.reading.shelf}</h1>

      <section className="space-y-3" aria-labelledby="done">
        <h2 id="done" className="flex items-baseline justify-between text-lg font-semibold">
          <span>{t.reading.shelfFinished}</span>
          <span className="m-num text-sm m-muted">{fmtNum(finished.length)}</span>
        </h2>
        {finished.length ? shelf(finished, t.reading.shelfFinished) : <p className="m-card p-6 text-center m-muted">{t.reading.shelfEmpty}</p>}
      </section>

      {paused.length > 0 && (
        <section className="space-y-3" aria-labelledby="paused">
          <h2 id="paused" className="text-lg font-semibold">{t.reading.shelfPaused}</h2>
          {shelf(paused, t.reading.shelfPaused)}
        </section>
      )}
    </div>
  );
}
