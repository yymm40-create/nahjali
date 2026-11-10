"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { fmtNum, t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { uploadBookPdf } from "@/lib/mahdi/client/reading";
import { countPdfPages } from "@/lib/mahdi/client/pdf";
import {
  GUIDE,
  GUIDE_BOOKS,
  GUIDE_BY,
  LEVEL_HINTS,
  LEVELS,
  STATUSES,
  fieldImage,
  guideBook,
  guideCount,
  nextUp,
  sameAuthor,
  searchGuide,
  type GuideBook,
  type GuideStatus,
} from "@/lib/mahdi/guide";
import type { Book, ReadingData } from "@/lib/mahdi/types";
import { PdfPicker, pdfSizeLabel } from "@/components/mahdi/BookFiles";
import Icon from "@/components/mahdi/Icon";
import Sheet from "@/components/mahdi/Sheet";
import { useMahdi } from "@/components/mahdi/Provider";
import { useReading } from "@/components/mahdi/useReading";

const G = t.reading.guide;
type Entry = { s: GuideStatus | null; n: string };
interface GuideState {
  ready: boolean;
  admin: boolean;
  list: Record<string, Entry>;
  pdf: Record<string, { bookId: string; size: number }>;
}
type Tab = "map" | "search" | "mine";
const TABS: Tab[] = ["map", "search", "mine"];

// Before migration 0105 my list stays on this device
const localKey = (userId: string) => `mahdi-guide-v1:${userId}`;
function readLocal(userId: string): Record<string, Entry> {
  try {
    return JSON.parse(localStorage.getItem(localKey(userId)) ?? "{}") as Record<string, Entry>;
  } catch {
    return {};
  }
}
function writeLocal(userId: string, list: Record<string, Entry>) {
  try {
    localStorage.setItem(localKey(userId), JSON.stringify(list));
  } catch {
    /* private mode: kept for this visit only */
  }
}

/** «مسبار القارئ» (الشيخ حسن البلوشي): the reading guide of «القارئ العلوي», its search, and my list. */
export default function GuidePage() {
  const { toast } = useMahdi();
  const { userId } = useReading();
  const [tab, setTab] = useState<Tab>("map");
  const [state, setState] = useState<GuideState>({ ready: true, admin: false, list: {}, pdf: {} });
  const [openId, setOpenId] = useState<string | null>(null);
  const refs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  useEffect(() => {
    let live = true;
    mahdiFetch<GuideState>("/api/mahdi/reading/guide")
      .then((s) => live && setState(s.ready ? s : { ...s, list: readLocal(userId) }))
      .catch((e) => live && toast((e as Error).message));
    return () => {
      live = false;
    };
  }, [userId, toast]);

  const entry = (key: string): Entry => state.list[key] ?? { s: null, n: "" };

  async function saveEntry(key: string, next: Entry) {
    const list = { ...state.list };
    if (!next.s && !next.n) delete list[key];
    else list[key] = next;
    setState((s) => ({ ...s, list }));
    if (!state.ready) return writeLocal(userId, list);
    try {
      await mahdiFetch("/api/mahdi/reading/guide", { method: "PUT", json: { id: key, status: next.s, note: next.n } });
    } catch (e) {
      toast((e as Error).message);
    }
  }

  const choose = (k: Tab) => {
    setTab(k);
    refs.current[k]?.focus();
  };
  const onKey = (e: React.KeyboardEvent, i: number) => {
    // Right-to-left: the arrow to the left goes to the next tab
    const step = e.key === "ArrowLeft" ? 1 : e.key === "ArrowRight" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    choose(TABS[(i + step + TABS.length) % TABS.length]);
  };
  const mineCount = Object.values(state.list).filter((v) => v.s).length;
  const label: Record<Tab, string> = { map: G.tabs.map, search: G.tabs.search, mine: `${G.tabs.mine} (${fmtNum(mineCount)})` };
  const open = openId ? guideBook(openId) : undefined;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link href="/mahdi/reading" className="m-muted inline-flex items-center gap-1 text-sm">
          <Icon name="chevronRight" size={16} /> {t.reading.title}
        </Link>
        <h1 className="m-display text-3xl">{G.title}</h1>
        <p className="m-gold font-semibold">{GUIDE_BY}</p>
        <p className="m-num m-muted text-sm">{G.total(fmtNum(guideCount()))}</p>
      </header>

      {!state.ready && <p className="m-note text-sm">{G.localOnly}</p>}

      <div role="tablist" aria-label={G.title} className="m-scroll-x -mx-1 flex gap-1.5 px-1 pb-1">
        {TABS.map((k, i) => (
          <button
            key={k}
            ref={(el) => {
              refs.current[k] = el;
            }}
            type="button"
            role="tab"
            id={`gtab-${k}`}
            aria-selected={tab === k}
            aria-controls={`gpanel-${k}`}
            tabIndex={tab === k ? 0 : -1}
            className="m-option min-h-11 shrink-0 px-4 text-sm font-semibold"
            onClick={() => choose(k)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {label[k]}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`gpanel-${tab}`} aria-labelledby={`gtab-${tab}`}>
        {tab === "map" && <MapTab state={state} onOpen={setOpenId} />}
        {tab === "search" && <SearchTab state={state} onOpen={setOpenId} />}
        {tab === "mine" && <MineTab state={state} onOpen={setOpenId} />}
      </div>

      <Sheet open={Boolean(open)} onClose={() => setOpenId(null)} title={open?.title ?? ""} wide>
        {open && <BookSheet key={open.key} book={open} entry={entry(open.key)} state={state} onSave={(e) => saveEntry(open.key, e)} onOpen={setOpenId} onState={setState} />}
      </Sheet>
    </div>
  );
}

/* ───────────────────────── The map: dimension → field → topic and level → books ───────────────────────── */

function MapTab({ state, onOpen }: { state: GuideState; onOpen: (id: string) => void }) {
  const [x, setX] = useState<number | null>(null);
  const [d, setD] = useState<number | null>(null);
  const [ti, setTi] = useState(-1);
  const [lv, setLv] = useState(-1);
  const top = useRef<HTMLDivElement>(null);
  const go = (fn: () => void) => {
    fn();
    top.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  const count = (xi: number, di?: number) => new Set(GUIDE_BOOKS.filter((b) => b.xi === xi && (di === undefined || b.di === di)).map((b) => b.key)).size;

  if (x === null) {
    return (
      <div ref={top} className="space-y-4">
        <section className="m-card space-y-2 p-5">
          <h2 className="text-lg font-semibold">{G.mapTitle}</h2>
          <p className="m-muted text-sm leading-7">{G.intro}</p>
        </section>
        <p className="m-eyebrow">{G.stepDim}</p>
        <ul className="grid gap-3 sm:grid-cols-3">
          {GUIDE.map((D, i) => (
            <li key={D.k}>
              <button type="button" className="m-option flex h-full w-full flex-col items-start gap-2 p-4 text-start" onClick={() => go(() => setX(i))}>
                <span className="m-display text-xl">{D.n}</span>
                <span className="m-muted text-sm leading-6">{D.d}</span>
                <span className="m-num m-gold mt-auto text-sm font-semibold">
                  {G.books(count(i))} · {G.fields(D.domains.length)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const D = GUIDE[x];
  if (d === null) {
    return (
      <div ref={top} className="space-y-4">
        <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => setX(null)}>
          <Icon name="chevronRight" size={16} /> {G.back}
        </button>
        <div>
          <h2 className="m-display text-2xl">{D.n}</h2>
          <p className="m-muted text-sm">{D.d}</p>
        </div>
        <p className="m-eyebrow">{G.stepField}</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {D.domains.map((M, i) => (
            <li key={M.k}>
              <button
                type="button"
                className="m-option block w-full overflow-hidden p-0 text-start"
                onClick={() =>
                  go(() => {
                    setD(i);
                    // one topic only: no need to choose it
                    setTi(M.topics.filter((tp) => tp.b.length).length === 1 ? M.topics.findIndex((tp) => tp.b.length) : -1);
                    setLv(-1);
                  })
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a small fixed picture of the site */}
                <img src={fieldImage(M.k)} alt="" width={1200} height={800} loading="lazy" className="aspect-[3/2] w-full object-cover" />
                <span className="block space-y-1 p-4">
                  <span className="block text-lg font-semibold">{M.n}</span>
                  <span className="m-muted block text-sm">{M.d}</span>
                  <span className="m-num m-gold block text-sm font-semibold">{G.books(count(x, i))}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const M = D.domains[d];
  const topics = M.topics.map((tp, i) => ({ tp, i })).filter(({ tp }) => tp.b.length);
  const list = GUIDE_BOOKS.filter((b) => b.xi === x && b.di === d && (ti === -1 || b.ti === ti) && (lv === -1 || b.level === lv));
  return (
    <div ref={top} className="space-y-4">
      <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => setD(null)}>
        <Icon name="chevronRight" size={16} /> {G.back}
      </button>
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- a small fixed picture of the site */}
        <img src={fieldImage(M.k)} alt="" width={96} height={64} className="h-16 w-24 shrink-0 rounded-xl object-cover" />
        <div className="min-w-0">
          <p className="m-eyebrow">{D.n}</p>
          <h2 className="m-display text-2xl">{M.n}</h2>
          <p className="m-muted text-sm">{M.d}</p>
        </div>
      </div>

      {topics.length > 1 && (
        <div className="space-y-2">
          <p className="m-label">{G.stepTopic}</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip on={ti === -1} onClick={() => setTi(-1)}>{G.allTopics}</Chip>
            {topics.map(({ tp, i }) => (
              <Chip key={tp.n + i} on={ti === i} onClick={() => setTi(i)}>
                {tp.n} <span className="m-num m-muted">({fmtNum(tp.b.length)})</span>
              </Chip>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-2">
        <p className="m-label">{G.stepLevel}</p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <Chip on={lv === -1} onClick={() => setLv(-1)}>{G.allLevels}</Chip>
          {LEVELS.map((L, i) => (
            <Chip key={L} on={lv === i} onClick={() => setLv(i)} title={LEVEL_HINTS[i]}>
              {L}
            </Chip>
          ))}
        </div>
        {lv !== -1 && <p className="m-hint">{LEVEL_HINTS[lv]}</p>}
      </div>

      <p className="m-num m-muted text-sm">{G.books(list.length)}</p>
      <BookList books={list} state={state} onOpen={onOpen} sub={ti === -1 ? "topic" : undefined} />
    </div>
  );
}

function Chip({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button type="button" aria-pressed={on} title={title} className="m-option min-h-10 px-3 py-1.5 text-sm font-semibold" onClick={onClick}>
      {children}
    </button>
  );
}

function BookList({ books, state, onOpen, sub }: { books: GuideBook[]; state: GuideState; onOpen: (id: string) => void; sub?: "topic" | "field" }) {
  return (
    <ul className="space-y-2">
      {books.map((b) => {
        const s = state.list[b.key]?.s;
        return (
          <li key={b.id}>
            <button type="button" className="m-option flex w-full flex-col items-start gap-1.5 p-3.5 text-start" onClick={() => onOpen(b.id)}>
              <span className="font-semibold leading-7">{b.title}</span>
              <span className="m-muted text-sm">
                {b.author || "—"}
                {sub === "topic" && <> · {b.topic}</>}
                {sub === "field" && <> · {b.field}</>}
              </span>
              <span className="flex flex-wrap gap-1.5">
                <span className="m-chip text-xs">{LEVELS[b.level]}</span>
                {state.pdf[b.key] && <span className="m-chip m-chip-gold text-xs">{G.pdfBadge}</span>}
                {s && <span className="m-chip m-chip-success text-xs">{G.status[s]}</span>}
                {b.isNew && <span className="m-chip text-xs">{G.newBadge}</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ───────────────────────── Search: the guide and the platform's readable books ───────────────────────── */

function SearchTab({ state, onOpen }: { state: GuideState; onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState<Book[]>([]);
  const found = useMemo(() => searchGuide(q), [q]);

  // Books of the shared catalogue that carry a PDF (not those already in the guide)
  useEffect(() => {
    let live = true;
    const query = q.trim();
    const id = setTimeout(() => {
      if (query.length < 2) return setPlatform([]);
      mahdiFetch<{ books: Book[] }>(`/api/mahdi/reading/books?q=${encodeURIComponent(query)}`)
        .then((r) => {
          if (!live) return;
          const linked = new Set(Object.values(state.pdf).map((p) => p.bookId));
          setPlatform(r.books.filter((b) => b.pdfSize !== null && !b.hidden && !linked.has(b.id)));
        })
        .catch(() => live && setPlatform([]));
    }, 300);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [q, state.pdf]);

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="m-label">{G.searchLabel}</span>
        <span className="relative block">
          <input className="m-field ps-10" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={G.searchPlaceholder} autoFocus />
          <Icon name="search" size={18} className="m-muted pointer-events-none absolute start-3 top-1/2 -translate-y-1/2" />
        </span>
      </label>
      {q.trim() && !found.length && !platform.length && <p className="m-muted text-sm">{G.searchEmpty}</p>}
      {found.length > 0 && (
        <section className="space-y-2">
          <h2 className="m-eyebrow">
            {G.searchGuide} · <span className="m-num">{G.books(found.length)}</span>
          </h2>
          <BookList books={found} state={state} onOpen={onOpen} sub="field" />
        </section>
      )}
      {platform.length > 0 && (
        <section className="space-y-2">
          <h2 className="m-eyebrow">{G.searchPlatform}</h2>
          <ul className="space-y-2">
            {platform.map((b) => (
              <li key={b.id} className="m-card flex items-center gap-3 p-3.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{b.title}</span>
                  {b.author && <span className="m-muted block truncate text-sm">{b.author}</span>}
                </span>
                <Link href={`/mahdi/reading/read/${b.id}`} className="m-btn m-btn-primary m-btn-sm shrink-0">
                  <Icon name="book" size={16} /> {G.readHere}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ───────────────────────── My list ───────────────────────── */

function MineTab({ state, onOpen }: { state: GuideState; onOpen: (id: string) => void }) {
  const { toast } = useMahdi();
  const keys = Object.entries(state.list).filter(([k, v]) => v.s && guideBook(k));
  const per = [0, 0, 0];
  keys.forEach(([k]) => per[guideBook(k)!.xi]++);
  const mx = Math.max(1, ...per);
  const order: GuideStatus[] = ["now", "want", "read"];

  async function copy() {
    const lines = [G.copyHead, ""];
    for (const s of order) {
      const g = keys.filter(([, v]) => v.s === s);
      if (!g.length) continue;
      lines.push(`${G.status[s]}:`);
      for (const [k, v] of g) {
        const b = guideBook(k)!;
        lines.push(`- ${b.title}${b.author ? ` — ${b.author}` : ""}${v.n ? ` (${v.n})` : ""}`);
      }
      lines.push("");
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n").trim());
      toast(G.copied);
    } catch {
      toast(t.errors.generic);
    }
  }

  if (!keys.length) {
    return (
      <div className="m-card space-y-3 p-6 text-center">
        <Icon name="book" size={36} className="m-gold mx-auto" />
        <p className="m-muted">{G.mineEmpty}</p>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <section className="m-card grid grid-cols-3 gap-2 p-4 text-center">
        {order.map((s) => (
          <div key={s}>
            <p className="m-num text-2xl font-semibold">{fmtNum(keys.filter(([, v]) => v.s === s).length)}</p>
            <p className="m-muted text-xs">{G.status[s]}</p>
          </div>
        ))}
      </section>
      <section className="m-card space-y-2 p-4" aria-label={G.balance}>
        <h2 className="text-sm font-semibold">{G.balance}</h2>
        {GUIDE.map((D, i) => (
          <div key={D.k} className="flex items-center gap-3 text-sm">
            <span className="w-36 shrink-0 truncate">{D.n}</span>
            <span className="m-bar flex-1" role="progressbar" aria-label={D.n} aria-valuenow={per[i]} aria-valuemin={0} aria-valuemax={mx}>
              <span style={{ width: `${(per[i] / mx) * 100}%` }} />
            </span>
            <b className="m-num w-6 text-end">{fmtNum(per[i])}</b>
          </div>
        ))}
      </section>
      {order.map((s) => {
        const g = keys.filter(([, v]) => v.s === s).map(([k]) => guideBook(k)!);
        return g.length ? (
          <section key={s} className="space-y-2">
            <h2 className="flex items-baseline justify-between font-semibold">
              {G.status[s]} <span className="m-num m-muted text-sm font-normal">{G.books(g.length)}</span>
            </h2>
            <BookList books={g} state={state} onOpen={onOpen} sub="field" />
          </section>
        ) : null;
      })}
      <button type="button" className="m-btn m-btn-ghost w-full" onClick={copy}>
        <Icon name="quote" size={18} /> {G.copy}
      </button>
    </div>
  );
}

/* ───────────────────────── One book ───────────────────────── */

function BookSheet({
  book,
  entry,
  state,
  onSave,
  onOpen,
  onState,
}: {
  book: GuideBook;
  entry: Entry;
  state: GuideState;
  onSave: (e: Entry) => void;
  onOpen: (id: string) => void;
  onState: (s: GuideState) => void;
}) {
  const { store, toast } = useMahdi();
  const { reading } = useReading();
  const [note, setNote] = useState(entry.n);
  const [busy, setBusy] = useState(false);
  const pdf = state.pdf[book.key];
  const inLib = pdf ? reading.library.find((e) => e.book.id === pdf.bookId) : undefined;
  const q = encodeURIComponent(`${book.title} ${book.author}`.trim());
  const up = nextUp(book);
  const same = sameAuthor(book);

  async function addToLibrary() {
    if (!pdf) return;
    setBusy(true);
    try {
      const { reading: fresh } = await mahdiFetch<{ reading: ReadingData }>("/api/mahdi/reading/library", { method: "POST", json: { bookId: pdf.bookId, action: "add" } });
      store.setSnapPart({ reading: fresh });
      if (!entry.s) onSave({ s: "now", n: note.trim() });
      toast(t.reading.added);
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }

  const addHref = `/mahdi/reading/add?${new URLSearchParams({ q: book.title, title: book.title, author: book.author })}`;
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        {book.author && <p className="m-muted">{book.author}</p>}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="m-muted">{G.dim}</dt>
          <dd>{book.dim}</dd>
          <dt className="m-muted">{G.field}</dt>
          <dd>{book.field}</dd>
          <dt className="m-muted">{G.topic}</dt>
          <dd>{book.topic}</dd>
          <dt className="m-muted">{G.level}</dt>
          <dd>
            {LEVELS[book.level]} <span className="m-muted">· {LEVEL_HINTS[book.level]}</span>
          </dd>
        </dl>
      </div>

      {pdf ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Link href={`/mahdi/reading/read/${pdf.bookId}`} className="m-btn m-btn-primary">
            <Icon name="book" size={18} /> {G.readHere}
            {pdf.size > 0 && <span className="m-num text-sm opacity-80">({pdfSizeLabel(pdf.size)})</span>}
          </Link>
          {inLib ? (
            <Link href={`/mahdi/reading/book/${pdf.bookId}`} className="m-btn m-btn-ghost">
              <Icon name="check" size={18} /> {G.openInMine}
            </Link>
          ) : (
            <button type="button" className="m-btn m-btn-ghost" disabled={busy} onClick={addToLibrary}>
              <Icon name="plus" size={18} /> {G.addToMine}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {book.src && (
            <a href={book.src} target="_blank" rel="noopener noreferrer" className="m-btn m-btn-ghost m-btn-sm">
              <Icon name="link" size={16} /> {G.feker}
            </a>
          )}
          <a href={`https://www.google.com/search?q=${q}`} target="_blank" rel="noopener noreferrer" className="m-btn m-btn-ghost m-btn-sm">
            <Icon name="search" size={16} /> {G.google}
          </a>
          <Link href={addHref} className="m-btn m-btn-ghost m-btn-sm">
            <Icon name="plus" size={16} /> {G.addManual}
          </Link>
        </div>
      )}

      <div className="space-y-2">
        <div role="radiogroup" aria-label={G.tabs.mine} className="grid grid-cols-3 gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={entry.s === s}
              className="m-option min-h-11 px-2 text-sm font-semibold"
              onClick={() => onSave({ s: entry.s === s ? null : s, n: note.trim() })}
            >
              {G.status[s]}
            </button>
          ))}
        </div>
        {entry.s && (
          <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => onSave({ s: null, n: note.trim() })}>
            {G.clearStatus}
          </button>
        )}
      </div>

      <label className="block">
        <span className="m-label">{G.note}</span>
        <textarea className="m-field" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder={G.notePlaceholder} />
      </label>
      {note.trim() !== entry.n && (
        <button
          type="button"
          className="m-btn m-btn-ghost m-btn-sm"
          onClick={() => {
            onSave({ s: entry.s, n: note.trim() });
            toast(G.noteSaved);
          }}
        >
          {G.noteSave}
        </button>
      )}

      {up.length > 0 && <Mini title={G.nextUp} books={up} onOpen={onOpen} />}
      {same.length > 0 && <Mini title={G.sameAuthor} books={same} onOpen={onOpen} />}

      {state.admin && <AdminPdf book={book} state={state} onState={onState} />}
    </div>
  );
}

function Mini({ title, books, onOpen }: { title: string; books: GuideBook[]; onOpen: (id: string) => void }) {
  return (
    <section className="space-y-2">
      <h3 className="m-eyebrow">{title}</h3>
      <ul className="space-y-1.5">
        {books.map((b) => (
          <li key={b.id}>
            <button type="button" className="m-soft flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-start text-sm" onClick={() => onOpen(b.id)}>
              <span className="min-w-0 truncate">{b.title}</span>
              <small className="m-muted shrink-0">{LEVELS[b.level]}</small>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The owner gives this guide book its PDF, or takes it away. */
function AdminPdf({ book, state, onState }: { book: GuideBook; state: GuideState; onState: (s: GuideState) => void }) {
  const { toast } = useMahdi();
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState("");
  const has = Boolean(state.pdf[book.key]);

  async function attach() {
    if (!file) return;
    setError("");
    try {
      setStep(G.adminCounting);
      const pages = await countPdfPages(file);
      const path = await uploadBookPdf(file, (pct) => setStep(t.reading.pdf.uploading(pct)));
      const fresh = await mahdiFetch<GuideState>("/api/mahdi/reading/guide/pdf", { method: "POST", json: { id: book.key, pdf: path, pages } });
      onState({ ...fresh, list: state.list });
      setFile(null);
      toast(G.adminAttached);
    } catch (e) {
      setError((e as Error).message || t.reading.pdf.failed);
    }
    setStep(null);
  }
  async function remove() {
    setStep(t.common.saving);
    try {
      const fresh = await mahdiFetch<GuideState>("/api/mahdi/reading/guide/pdf", { method: "DELETE", json: { id: book.key } });
      onState({ ...fresh, list: state.list });
      toast(G.adminRemoved);
    } catch (e) {
      setError((e as Error).message);
    }
    setStep(null);
  }

  return (
    <section className="m-soft space-y-3 rounded-2xl p-4">
      <h3 className="flex items-center gap-2 font-semibold">
        <Icon name="shield" size={18} className="m-gold" /> {G.admin}
      </h3>
      <p className="m-hint">{G.adminHint}</p>
      <PdfPicker file={file} onChange={setFile} disabled={step !== null} />
      {error && <p className="m-error text-sm" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {file && (
          <button type="button" className="m-btn m-btn-primary m-btn-sm" disabled={step !== null} onClick={attach}>
            {step ?? (has ? G.adminReplace : t.reading.pdf.add)}
          </button>
        )}
        {has && !file && (
          <button type="button" className="m-btn m-btn-danger m-btn-sm" disabled={step !== null} onClick={remove}>
            {G.adminRemove}
          </button>
        )}
      </div>
    </section>
  );
}
