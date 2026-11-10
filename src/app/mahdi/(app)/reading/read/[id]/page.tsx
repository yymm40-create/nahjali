"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { fmtNum, t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { openPdf, type PdfDoc } from "@/lib/mahdi/client/pdf";
import { clock, elapsedMs, loadTimer, saveTimer, type TimerState } from "@/lib/mahdi/client/reading";
import type { ReadingData } from "@/lib/mahdi/types";
import Icon from "@/components/mahdi/Icon";
import { useMahdi } from "@/components/mahdi/Provider";
import { useReading } from "@/components/mahdi/useReading";

const R = t.reading.reader;
const timeNow = () => Date.now();
const lastPageKey = (userId: string, id: string) => `mahdi:reading:pdfpage:${userId}:${id}`;

interface Info {
  url: string;
  title: string;
  author: string;
  page: number;
}

/**
 * Reading a book's PDF inside the platform, one page at a time (the file is read in parts, so a big book opens fast).
 * It opens at the page I stopped at, and when the book is in my library the reading timer runs here and its session is
 * saved with the pages I reached.
 */
export default function ReadPdfPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { store, toast } = useMahdi();
  const { reading, userId } = useReading();
  const entry = reading.library.find((e) => e.book.id === id);

  const [info, setInfo] = useState<Info | null>(null);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [goTo, setGoTo] = useState("");
  const [timer, setTimerState] = useState<TimerState | null>(null);
  const [now, setNow] = useState(timeNow);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);

  // The file: its private link first, else through our own address
  useEffect(() => {
    let live = true;
    let opened: PdfDoc | null = null;
    (async () => {
      try {
        const i = await mahdiFetch<Info>(`/api/mahdi/reading/books/${id}/read`);
        if (!live) return;
        let local = 0;
        try {
          local = Number(localStorage.getItem(lastPageKey(userId, id))) || 0;
        } catch {}
        setInfo(i);
        try {
          opened = await openPdf(i.url);
        } catch {
          opened = await openPdf(`/api/mahdi/reading/books/${id}/file`);
        }
        if (!live) return void opened.destroy();
        const start = Math.min(Math.max(1, Math.max(i.page, local)), opened.numPages);
        setDoc(opened);
        setPage(start);
        if (start > 1) toast(R.resumed(start));
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => {
      live = false;
      opened?.destroy();
    };
  }, [id, userId, toast]);

  // The width to draw at
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [doc]);

  // Draw the page (sharp on high-density screens, never more than twice the pixels)
  useEffect(() => {
    if (!doc || !width || !canvas.current) return;
    let task: { promise: Promise<void>; cancel(): void } | null = null;
    let live = true;
    doc.getPage(page).then((p) => {
      if (!live || !canvas.current) return;
      const base = p.getViewport({ scale: 1 });
      const vp = p.getViewport({ scale: (width / base.width) * zoom });
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const c = canvas.current;
      c.width = Math.floor(vp.width * ratio);
      c.height = Math.floor(vp.height * ratio);
      c.style.width = `${Math.floor(vp.width)}px`;
      c.style.height = `${Math.floor(vp.height)}px`;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      task = p.render({ canvasContext: ctx, viewport: vp, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined });
      task.promise.catch(() => {});
    });
    return () => {
      live = false;
      task?.cancel();
    };
  }, [doc, page, width, zoom]);

  // Where I stopped: on this device at once, on the account after a short pause
  useEffect(() => {
    if (!doc) return;
    try {
      localStorage.setItem(lastPageKey(userId, id), String(page));
    } catch {}
    const tm = setTimeout(() => mahdiFetch(`/api/mahdi/reading/books/${id}/read`, { method: "PUT", json: { page } }).catch(() => {}), 1500);
    return () => clearTimeout(tm);
  }, [doc, page, id, userId]);

  // The reading timer (shared with the session page)
  useEffect(() => {
    let live = true;
    Promise.resolve().then(() => live && setTimerState(loadTimer(userId)));
    return () => {
      live = false;
    };
  }, [userId]);
  useEffect(() => {
    if (!timer?.runningSince) return;
    const tm = setInterval(() => setNow(timeNow()), 1000);
    return () => clearInterval(tm);
  }, [timer?.runningSince]);

  const total = doc?.numPages ?? 0;
  const turn = useCallback((step: number) => setPage((p) => Math.min(Math.max(1, p + step), total || 1)), [total]);

  // Keys: in a right-to-left book the left arrow is the next page
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest("input, textarea")) return;
      if (e.key === "ArrowLeft") turn(1);
      else if (e.key === "ArrowRight") turn(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn]);

  // Swipe: towards the right → next page (right-to-left book)
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if (zoom !== 1 || e.touches.length !== 1) return (touch.current = null);
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const dx = e.changedTouches[0].clientX - s.x;
    const dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(dx > 0 ? 1 : -1);
  };

  const mine = timer && timer.bookId === id ? timer : null;
  const other = timer && timer.bookId !== id ? timer : null;
  const startTimer = () => {
    const at = timeNow();
    const s: TimerState = { bookId: id, startPage: page, startedAt: at, accumulated: 0, runningSince: at };
    saveTimer(userId, s);
    setTimerState(s);
    setNow(at);
  };
  async function addToLibrary() {
    setBusy(true);
    try {
      const { reading: fresh } = await mahdiFetch<{ reading: ReadingData }>("/api/mahdi/reading/library", { method: "POST", json: { bookId: id, action: "add" } });
      store.setSnapPart({ reading: fresh });
      toast(t.reading.added);
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }

  if (failed) {
    return (
      <div className="m-card mx-auto max-w-lg space-y-4 p-6 text-center">
        <p className="font-semibold">{R.failed}</p>
        <a href={`/api/mahdi/reading/books/${id}/pdf`} className="m-btn m-btn-primary" download>
          <Icon name="arrowDown" size={18} /> {R.download}
        </a>
        <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => router.back()}>
          {t.reading.guide.back}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <header className="flex items-center gap-3">
        <button type="button" className="m-icon-btn shrink-0" onClick={() => router.back()} aria-label={t.reading.guide.back}>
          <Icon name="chevronRight" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold">{info?.title ?? R.loading}</h1>
          {info?.author && <p className="m-muted truncate text-sm">{info.author}</p>}
        </div>
        {entry && (
          <Link href={`/mahdi/reading/book/${id}`} className="m-icon-btn shrink-0" aria-label={t.reading.shelf}>
            <Icon name="info" />
          </Link>
        )}
      </header>

      {/* The reading timer */}
      {doc &&
        (mine ? (
          <div className="m-note flex flex-wrap items-center gap-3">
            <Icon name="timer" className="m-gold" />
            <span className="m-num flex-1 font-semibold" role="timer">
              {mine.runningSince ? t.reading.running : t.reading.paused} · {clock(elapsedMs(mine, now))}
            </span>
            <Link href={`/mahdi/reading/session?book=${id}&end=${page}`} className="m-btn m-btn-primary m-btn-sm">
              <Icon name="check" size={16} /> {R.timerEnd}
            </Link>
          </div>
        ) : other ? (
          <Link href={`/mahdi/reading/session?book=${other.bookId}`} className="m-note flex items-center gap-3 text-sm">
            <Icon name="timer" className="m-gold" /> <span className="flex-1">{R.timerOther}</span> <Icon name="chevronLeft" size={16} />
          </Link>
        ) : entry ? (
          <button type="button" className="m-btn m-btn-ghost m-btn-sm w-full" onClick={startTimer}>
            <Icon name="timer" size={16} /> {R.timerStart}
          </button>
        ) : (
          <button type="button" className="m-btn m-btn-ghost m-btn-sm w-full" disabled={busy} onClick={addToLibrary}>
            <Icon name="plus" size={16} /> {R.addFirst}
          </button>
        ))}

      <div ref={box} className="m-card overflow-auto p-0" style={{ touchAction: zoom === 1 ? "pan-y pinch-zoom" : "auto" }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {!doc && <p className="m-muted p-10 text-center">{R.loading}</p>}
        <canvas ref={canvas} className={doc ? "mx-auto block bg-white" : "hidden"} aria-label={total ? R.page(page, total) : undefined} role="img" />
      </div>

      {doc && (
        <nav className="m-card sticky bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-10 flex items-center gap-2 p-2" aria-label={R.goTo}>
          <button type="button" className="m-icon-btn" disabled={page <= 1} onClick={() => turn(-1)} aria-label={R.prev}>
            <Icon name="chevronRight" />
          </button>
          <form
            className="flex flex-1 items-center justify-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Math.round(Number(goTo.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))));
              if (n >= 1 && n <= total) setPage(n);
              setGoTo("");
            }}
          >
            <input
              className="m-field m-num w-16 px-2 py-1 text-center"
              inputMode="numeric"
              aria-label={R.goTo}
              value={goTo}
              placeholder={String(page)}
              onChange={(e) => setGoTo(e.target.value)}
            />
            <span className="m-num m-muted text-sm">/ {fmtNum(total)}</span>
          </form>
          <button type="button" className="m-icon-btn" onClick={() => setZoom((z) => Math.max(1, Math.round((z - 0.25) * 100) / 100))} disabled={zoom <= 1} aria-label={R.zoomOut}>
            <Icon name="minus" />
          </button>
          <button type="button" className="m-icon-btn" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} disabled={zoom >= 3} aria-label={R.zoomIn}>
            <Icon name="plus" />
          </button>
          <button type="button" className="m-icon-btn" disabled={page >= total} onClick={() => turn(1)} aria-label={R.next}>
            <Icon name="chevronLeft" />
          </button>
        </nav>
      )}
    </div>
  );
}
