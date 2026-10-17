"use client";

// «🎨 محرر العرض» — the deck's own editor, for every robot that designs decks (صادق today; قنبر and محمد باقر on the
// same engine): the slides down the side, the chosen one big with its words editable in place (B / I / U), its
// pictures swapped by a click, its speaker's notes, slides moved / copied / removed, undo, saved by itself, «▶️ اعرض»
// full screen, and the PDF / PPTX made from the deck exactly as it is now. Asking the robot to change a slide is the
// host's own panel (its billing), given the slide's number.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import SlideFrame, { clientFontCss, serializeSlide } from "./SlideFrame";
import DeckShow from "./DeckShow";
import { sanitizeSlide, slideText, type Deck } from "@/lib/slides/format";

export interface DeckApi {
  load(): Promise<{ deck: Deck; images: Record<string, string>; status: string; stale?: Record<string, boolean> }>;
  save(deck: Deck): Promise<void>;
  upload(dataUrl: string): Promise<{ token: string; path: string; url: string }>;
  exportFile(kind: "pdf" | "pptx"): Promise<string>;
}

/** A picture made small in the browser before it is sent (the long side at most 1920 px). */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => bad(new Error("ما قدرنا نقرأ الصورة."));
      i.src = url;
    });
    const k = Math.min(1, 1920 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return file.type === "image/png" ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const newId = (id: string) => `${id.slice(0, 24)}c${Math.random().toString(36).slice(2, 6)}`;

export default function DeckEditor({ api, title, backHref, backLabel = "رجوع", aiPanel }: { api: DeckApi; title: string; backHref: string; backLabel?: string; aiPanel?: (index: number, started: () => void, save: () => Promise<void>) => ReactNode }) {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [images, setImages] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [stale, setStale] = useState<Record<string, boolean>>({});
  const [sel, setSel] = useState(0);
  const [renderKey, setRenderKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showing, setShowing] = useState(false);
  const [exporting, setExporting] = useState<"" | "pdf" | "pptx">("");
  // the picture clicked in the slide: the element (changed in place) and whether one is picked (shown)
  const pickedEl = useRef<HTMLImageElement | null>(null);
  const [picked, setPickedOn] = useState(false);
  const setPicked = (img: HTMLImageElement | null) => {
    pickedEl.current = img;
    setPickedOn(Boolean(img));
  };
  const [canUndo, setCanUndo] = useState(false);
  const [frameDoc, setFrameDoc] = useState<Document | null>(null);
  const [width, setWidth] = useState(900);
  const history = useRef<Deck[]>([]);
  const lastPush = useRef(0);
  const stage = useRef<HTMLDivElement>(null);
  const fontsKey = deck ? deck.fonts.join(",") : "";
  const fontCss = useMemo(() => (fontsKey ? clientFontCss(fontsKey.split(",")) : ""), [fontsKey]);

  useEffect(() => {
    let live = true;
    api
      .load()
      .then((r) => {
        if (!live) return;
        setDeck(r.deck);
        setImages(r.images);
        setStatus(r.status);
        setStale(r.stale ?? {});
        setRenderKey((k) => k + 1);
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [api]);

  // while the robot is changing a slide, the deck is read again until it is done
  useEffect(() => {
    if (status !== "running") return;
    const t = setInterval(() => {
      api
        .load()
        .then((r) => {
          if (r.status === "running") return;
          setDeck(r.deck);
          setImages(r.images);
          setStatus(r.status);
          setStale(r.stale ?? {});
          setRenderKey((k) => k + 1);
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [status, api]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(280, Math.floor(el.clientWidth))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [deck === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const remember = (d: Deck, force = false) => {
    const now = Date.now();
    if (!force && now - lastPush.current < 1500) return;
    lastPush.current = now;
    history.current = [...history.current.slice(-49), structuredClone(d)];
    setCanUndo(true);
  };

  /** A change made here: kept in the undo list, marked unsaved. */
  const change = (fn: (d: Deck) => Deck, redraw = true) => {
    setDeck((d) => {
      if (!d) return d;
      remember(d, redraw);
      return fn(d);
    });
    setDirty(true);
    if (redraw) setRenderKey((k) => k + 1);
  };

  // saved by itself a moment after the last change
  useEffect(() => {
    if (!dirty || !deck || status === "running") return;
    const t = setTimeout(async () => {
      setSaving(true);
      try {
        await api.save(deck);
        setDirty(false);
        setStale({ pdf: true, pptx: true });
        setError("");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSaving(false);
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [dirty, deck, api, status]);

  const undo = () => {
    const prev = history.current.pop();
    setCanUndo(history.current.length > 0);
    if (!prev) return;
    setDeck(prev);
    setSel((i) => Math.min(i, prev.slides.length - 1));
    setDirty(true);
    setRenderKey((k) => k + 1);
  };

  const saveNow = async () => {
    if (!deck || !dirty) return;
    await api.save(deck);
    setDirty(false);
  };

  const exportAs = async (kind: "pdf" | "pptx") => {
    setExporting(kind);
    setError("");
    try {
      await saveNow();
      const url = await api.exportFile(kind);
      setStale((s) => ({ ...s, [kind]: false }));
      window.location.href = url;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting("");
    }
  };

  const swapPicture = async (file: File) => {
    const el = pickedEl.current;
    if (!el || !frameDoc) return;
    setError("");
    try {
      const up = await api.upload(await shrink(file));
      setImages((m) => ({ ...m, [up.path]: up.url }));
      el.setAttribute("src", up.url);
      el.setAttribute("data-token", up.path);
      const html = serializeSlide(frameDoc);
      if (html) change((d) => ({ ...d, slides: d.slides.map((s, i) => (i === sel ? { ...s, html: sanitizeSlide(html, s.id) } : s)) }), false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const format = (cmd: "bold" | "italic" | "underline") => {
    if (!frameDoc) return;
    frameDoc.execCommand(cmd);
    const html = serializeSlide(frameDoc);
    if (html) change((d) => ({ ...d, slides: d.slides.map((s, i) => (i === sel ? { ...s, html } : s)) }), false);
  };

  if (error && !deck) return <p className="jw-panel m-6 p-4 text-jw-warn">{error}</p>;
  if (!deck) return <p className="p-6 text-jw-muted">يفتح العرض…</p>;
  const slide = deck.slides[sel] ?? deck.slides[0];
  const running = status === "running";

  const move = (to: number) =>
    change((d) => {
      const s = [...d.slides];
      const [x] = s.splice(sel, 1);
      s.splice(to, 0, x);
      setSel(to);
      return { ...d, slides: s };
    });

  return (
    <div className="flex min-h-[calc(100dvh-var(--jw-header-h,56px))] flex-col" dir="rtl">
      {/* the bar: back, the deck, saving, undo, the show and the files */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-jw-line bg-jw-surface/95 px-3 py-2 backdrop-blur">
        <a href={backHref} className="jw-btn !min-h-9 px-3 text-sm">→ {backLabel}</a>
        <b className="min-w-0 flex-1 truncate">🎨 {title || deck.title}</b>
        <span className="text-xs text-jw-faint" role="status">{running ? "⏳ يعدّل الشريحة…" : saving ? "يحفظ…" : dirty ? "تعديلات ما انحفظت بعد" : "✓ محفوظ"}</span>
        <button type="button" className="jw-btn !min-h-9 px-3 text-sm" onClick={undo} disabled={!canUndo || running} title="تراجع">↶ تراجع</button>
        <button type="button" className="jw-btn jw-btn-primary !min-h-9 px-3 text-sm" onClick={() => setShowing(true)}>▶️ اعرض</button>
        <button type="button" className="jw-btn !min-h-9 px-3 text-sm" disabled={Boolean(exporting) || running} onClick={() => exportAs("pdf")}>{exporting === "pdf" ? "يجهّز PDF…" : "⬇️ PDF"}</button>
        <button type="button" className="jw-btn !min-h-9 px-3 text-sm" disabled={Boolean(exporting) || running} onClick={() => exportAs("pptx")}>{exporting === "pptx" ? "يجهّز PPTX…" : "⬇️ PPTX"}</button>
      </header>
      {error && <p className="mx-3 mt-2 rounded-xl border border-jw-warn/40 bg-jw-warn/10 p-2 text-sm">{error}</p>}
      {(stale.pdf || stale.pptx) && !dirty && <p className="mx-3 mt-2 text-xs text-jw-faint">عدّلت العرض: ملفات PDF / PPTX القديمة ما فيها تعديلاتك. صدّرها من فوق تنصنع من العرض كما هو الحين.</p>}

      <div className="grid flex-1 gap-3 p-3 md:grid-cols-[200px_1fr]">
        {/* the slides */}
        <nav className="order-2 flex gap-2 overflow-x-auto md:order-none md:max-h-[calc(100dvh-140px)] md:flex-col md:overflow-y-auto md:overflow-x-hidden" aria-label="الشرائح">
          {deck.slides.map((s, i) => (
            <button key={s.id} type="button" onClick={() => (setSel(i), setPicked(null))} className={`shrink-0 rounded-xl border-2 p-1 text-start ${i === sel ? "border-jw-accent" : "border-transparent hover:border-jw-line"}`} aria-current={i === sel} title={slideText(s.html).slice(0, 80)}>
              <span className="mb-1 block text-xs text-jw-faint">{(i + 1).toLocaleString("ar")}</span>
              <SlideFrame deck={deck} slide={s} images={images} width={176} fontCss={fontCss} />
            </button>
          ))}
        </nav>

        <main className="min-w-0 space-y-3">
          <div ref={stage} className="w-full overflow-hidden rounded-2xl shadow-lg ring-1 ring-jw-line">
            <SlideFrame
              deck={deck}
              slide={slide}
              images={images}
              width={width}
              fontCss={fontCss}
              editable={!running}
              renderKey={renderKey}
              onChange={(html) => change((d) => ({ ...d, slides: d.slides.map((s, i) => (i === sel ? { ...s, html } : s)) }), false)}
              onPickImage={setPicked}
              onFrame={setFrameDoc}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-jw-faint">اضغط على أي نص وعدّله مكانه ·</span>
            <button type="button" className="jw-btn !min-h-8 px-3 font-bold" onMouseDown={(e) => e.preventDefault()} onClick={() => format("bold")} aria-label="عريض">B</button>
            <button type="button" className="jw-btn !min-h-8 px-3 italic" onMouseDown={(e) => e.preventDefault()} onClick={() => format("italic")} aria-label="مائل">I</button>
            <button type="button" className="jw-btn !min-h-8 px-3 underline" onMouseDown={(e) => e.preventDefault()} onClick={() => format("underline")} aria-label="تسطير">U</button>
            <span className="flex-1" />
            <button type="button" className="jw-btn !min-h-8 px-3" disabled={sel === 0} onClick={() => move(sel - 1)}>⬆️ قدّمها</button>
            <button type="button" className="jw-btn !min-h-8 px-3" disabled={sel >= deck.slides.length - 1} onClick={() => move(sel + 1)}>⬇️ أخّرها</button>
            <button
              type="button"
              className="jw-btn !min-h-8 px-3"
              onClick={() =>
                change((d) => {
                  const s = [...d.slides];
                  const id = newId(slide.id);
                  s.splice(sel + 1, 0, { ...slide, id, html: sanitizeSlide(slide.html, id), edited: true });
                  setSel(sel + 1);
                  return { ...d, slides: s };
                })
              }
            >
              📄 كرّرها
            </button>
            <button
              type="button"
              className="jw-btn !min-h-8 px-3"
              disabled={deck.slides.length < 2}
              onClick={() => {
                if (!confirm("تحذف هالشريحة؟ (تقدر تتراجع)")) return;
                change((d) => ({ ...d, slides: d.slides.filter((_, i) => i !== sel) }));
                setSel((i) => Math.max(0, i - 1));
              }}
            >
              🗑️ احذفها
            </button>
          </div>

          {picked && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm">
              <span>🖼️ اخترت صورة في الشريحة.</span>
              <label className="jw-btn jw-btn-primary !min-h-9 cursor-pointer px-3">
                بدّلها بصورة من جهازك
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void swapPicture(f); }} />
              </label>
            </div>
          )}

          <label className="block space-y-1">
            <span className="text-sm font-semibold">📝 ملاحظات المحاضر (تطلع لك في العرض بزر N، وفي PPTX)</span>
            <textarea className="jw-textarea" rows={3} value={slide.notes} onChange={(e) => { const notes = e.target.value; change((d) => ({ ...d, slides: d.slides.map((s, i) => (i === sel ? { ...s, notes } : s)) }), false); }} />
          </label>

          {aiPanel && !running && aiPanel(sel, () => setStatus("running"), saveNow)}
        </main>
      </div>

      {showing && <DeckShow deck={deck} images={images} fontCss={fontCss} start={sel} onClose={() => setShowing(false)} />}
    </div>
  );
}
