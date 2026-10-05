"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fmtNum, t } from "@/lib/mahdi/i18n";
import { parseNumberInput } from "@/lib/mahdi/client/derive";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { shrinkImage, uploadBookPdf } from "@/lib/mahdi/client/reading";
import type { Book, ReadingData } from "@/lib/mahdi/types";
import type { BookUnit } from "@/lib/mahdi/engine";
import BookCover from "@/components/mahdi/BookCover";
import { CoverPicker, PdfPicker } from "@/components/mahdi/BookFiles";
import Icon from "@/components/mahdi/Icon";
import { useMahdi } from "@/components/mahdi/Provider";
import { useReading } from "@/components/mahdi/useReading";

/** Adding a book: search the shared catalogue first; if it isn't there, add it with a photo of its cover. */
export default function AddBookPage() {
  const router = useRouter();
  const { store, toast } = useMahdi();
  const { reading, current } = useReading();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Book[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<{ title: string; author: string; pages: string; description: string; unit: BookUnit }>({ title: "", author: "", pages: "", description: "", unit: "page" });
  const [cover, setCover] = useState<Blob | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const full = current.length >= 3;
  const mine = new Map(reading.library.map((e) => [e.book.id, e.state]));

  // Search as the user types (a short pause first)
  useEffect(() => {
    let live = true;
    const id = setTimeout(() => {
      mahdiFetch<{ books: Book[] }>(`/api/mahdi/reading/books?q=${encodeURIComponent(q.trim())}`)
        .then((r) => {
          if (!live) return;
          setResults(r.books);
          setError("");
        })
        .catch((e) => live && setError((e as Error).message));
    }, 300);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [q]);

  async function choose(book: Book) {
    setBusy(true);
    try {
      const { reading: fresh } = await mahdiFetch<{ reading: ReadingData }>("/api/mahdi/reading/library", { method: "POST", json: { bookId: book.id, action: "add" } });
      store.setSnapPart({ reading: fresh });
      toast(t.reading.added);
      router.push(`/mahdi/reading/book/${book.id}`);
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const pages = Math.round(parseNumberInput(form.pages));
    if (!form.title.trim()) return setError(t.reading.titleRequired);
    if (!(pages >= 1 && pages <= 10000)) return setError(t.reading.u[form.unit].totalRequired);
    setBusy(true);
    setError("");
    const data = new FormData();
    data.append("title", form.title.trim());
    data.append("author", form.author.trim());
    data.append("pages", String(pages));
    data.append("unit", form.unit);
    data.append("description", form.description.trim());
    try {
      // An enhanced cover is already small; a photo is made smaller first
      if (cover) data.append("cover", cover instanceof File ? await shrinkImage(cover) : cover, cover instanceof File ? "cover.jpg" : "cover.webp");
      if (pdf) {
        setUploading(0);
        data.append("pdf", await uploadBookPdf(pdf, setUploading));
      }
      const res = await mahdiFetch<{ bookId: string; duplicate: boolean; reading: ReadingData }>("/api/mahdi/reading/books", { method: "POST", body: data });
      store.setSnapPart({ reading: res.reading });
      toast(res.duplicate ? t.reading.duplicate : t.reading.created);
      router.push(`/mahdi/reading/book/${res.bookId}`);
    } catch (err) {
      setError((err as Error).message);
    }
    setUploading(null);
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <Link href="/mahdi/reading" className="m-btn m-btn-quiet m-btn-sm -ms-3">
        <Icon name="chevronRight" size={18} /> {t.reading.title}
      </Link>
      <h1 className="m-display text-3xl">{t.reading.addTitle}</h1>

      {full && (
        <div className="m-note space-y-2">
          <p className="font-semibold">{t.reading.full}</p>
          <ul className="flex flex-wrap gap-2">
            {current.map(({ book }) => (
              <li key={book.id}>
                <Link href={`/mahdi/reading/book/${book.id}`} className="m-chip min-h-9">{book.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!creating && (
        <section className="space-y-3">
          <label className="block">
            <span className="m-label">{t.reading.searchLabel}</span>
            <span className="relative block">
              <input className="m-field" style={{ paddingInlineStart: "2.75rem" }} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.reading.searchPlaceholder} autoFocus />
              <Icon name="search" size={20} className="m-muted pointer-events-none absolute start-3 top-1/2 -translate-y-1/2" />
            </span>
            <span className="m-hint mt-1 block">{t.reading.searchHint}</span>
          </label>

          {results === null ? (
            <p className="m-muted">{t.common.loading}</p>
          ) : results.length === 0 ? (
            <p className="m-card p-5 text-center m-muted">{t.reading.noResults}</p>
          ) : (
            <ul className="space-y-3" aria-label={t.reading.results}>
              {results.map((b) => (
                <li key={b.id} className="m-card flex items-center gap-3 p-3">
                  <BookCover book={b} width={48} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{b.title}</span>
                    <span className="m-num block truncate text-sm m-muted">
                      {b.author ? `${b.author} · ` : ""}
                      {t.reading.u[b.unit].count(b.pages)}
                    </span>
                  </span>
                  {mine.has(b.id) ? (
                    <Link href={`/mahdi/reading/book/${b.id}`} className="m-chip m-chip-success">{t.reading.inLibrary}</Link>
                  ) : (
                    <button type="button" className="m-btn m-btn-ghost m-btn-sm" disabled={busy || full} onClick={() => choose(b)}>
                      <Icon name="plus" size={16} /> {t.reading.choose}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            className="m-btn m-btn-primary w-full"
            disabled={full}
            onClick={() => {
              setForm((f) => ({ ...f, title: f.title || q.trim() }));
              setCreating(true);
            }}
          >
            <Icon name="plus" size={18} /> {t.reading.newBook}
          </button>
        </section>
      )}

      {creating && (
        <form className="m-card space-y-4 p-5" onSubmit={create}>
          <h2 className="text-lg font-semibold">{t.reading.newBook}</h2>
          <CoverPicker title={form.title} onChange={setCover} />
          <label className="block">
            <span className="m-label">{t.reading.bookTitle}</span>
            <input className="m-field" required maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <fieldset className="space-y-2">
            <legend className="m-label">{t.reading.kind}</legend>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.reading.kind}>
              {(["page", "narration"] as const).map((u) => (
                <button key={u} type="button" role="radio" aria-checked={form.unit === u} className="m-option min-h-11 px-3 text-sm font-semibold" onClick={() => setForm({ ...form, unit: u })}>
                  {t.reading.kinds[u]}
                </button>
              ))}
            </div>
            <p className="m-hint">{t.reading.kindHint}</p>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="m-label">{t.reading.author} <span className="m-hint">({t.common.optional})</span></span>
              <input className="m-field" maxLength={80} value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
            </label>
            <label className="block">
              <span className="m-label">{t.reading.u[form.unit].total}</span>
              <input className="m-field m-num" inputMode="numeric" required value={form.pages} onChange={(e) => setForm({ ...form, pages: e.target.value })} />
            </label>
          </div>
          <label className="block">
            <span className="m-label">{t.reading.description} <span className="m-hint">({t.common.optional})</span></span>
            <textarea className="m-field" rows={3} maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <span className="m-hint mt-1 block">{t.reading.descriptionHint}</span>
          </label>
          <PdfPicker file={pdf} onChange={setPdf} disabled={busy} />
          {error && <p className="m-error" role="alert">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className="m-btn m-btn-ghost" onClick={() => setCreating(false)}>{t.common.back}</button>
            <button className="m-btn m-btn-primary" disabled={busy}>{uploading !== null ? t.reading.pdf.uploading(uploading) : busy ? t.common.saving : t.reading.create}</button>
          </div>
          <p className="m-num text-center text-sm m-muted">{fmtNum(form.description.length)}/500</p>
        </form>
      )}
    </div>
  );
}
