"use client";

// «الستايل» in the image and video studios: the library's 100 styles in 14 families, each under its studio or school
// («خريطة الستايلات», src/components/style-map/StyleBrowser.tsx), in a menu that opens from under the generator. The
// chosen one's text goes into what the generator reads as the look of the piece (the person's prompt stays as
// written); «جواد» knows them and can pick one too.

import { useEffect, useMemo, useState } from "react";
import { FILM_STYLES, findStyle, styleImage } from "@config/film-styles";
import StyleBrowser, { StyleThumb, type StyleCardView } from "@/components/style-map/StyleBrowser";

/** The pictures drawn for the new styles (the guide's 24 ship with the site), fetched once per page. */
let pictures: Promise<Record<string, string>> | null = null;
const loadPictures = () =>
  (pictures ??= fetch("/api/jawad/styles")
    .then((r) => (r.ok ? r.json() : { pictures: {} }))
    .then((d: { pictures?: Record<string, string> }) => d.pictures ?? {})
    .catch(() => ({}) as Record<string, string>));

export default function StylePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pics, setPics] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    void loadPictures().then((p) => live && setPics(p));
    return () => {
      live = false;
    };
  }, []);
  const cards: StyleCardView[] = useMemo(
    () => FILM_STYLES.map((s) => ({ id: s.id, family: s.family, school: s.school, name: s.name, description: s.description, feel: s.feel, bestFor: s.bestFor, photoreal: s.photoreal, image: pics[s.id] ?? styleImage(s.id) })),
    [pics],
  );
  const cur = value ? findStyle(value) : undefined;
  const curCard = cur ? cards.find((c) => c.id === cur.id) : undefined;
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold">🎨 الستايل <span className="text-xs font-normal text-jw-muted">(اختياري)</span></p>
      <button type="button" className="flex w-full items-center gap-3 rounded-xl border border-jw-line bg-jw-surface-2 p-2 text-start hover:border-jw-accent" onClick={() => setOpen(true)} aria-haspopup="dialog">
        {cur && curCard ? (
          <>
            <span className="w-24 shrink-0 overflow-hidden rounded-lg"><StyleThumb s={curCard} /></span>
            <span className="min-w-0 flex-1">
              <b className="block text-sm">{cur.name} <span className="text-xs font-normal text-jw-muted">· {cur.school}</span></b>
              <span className="line-clamp-1 text-xs text-jw-muted">{cur.description}</span>
            </span>
          </>
        ) : (
          <span className="flex-1 px-1 py-3 text-sm text-jw-muted">بدون ستايل — اضغط واختر من خريطة {FILM_STYLES.length} ستايل</span>
        )}
        <span className="text-xs text-jw-accent">{cur ? "غيّر" : "اختر"}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" role="dialog" aria-label="اختر الستايل" dir="rtl" onClick={() => setOpen(false)}>
          <div className="jw-panel flex max-h-[88dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between gap-2 border-b border-jw-line px-4 py-3">
              <div>
                <h2 className="text-base font-black">🗺️ خريطة الستايلات</h2>
                <p className="text-xs text-jw-muted">{FILM_STYLES.length} ستايل في ١٤ عائلة، كل واحد تحت شركته أو مدرسته. برومبت الستايل ينحط في البرومبت الرئيسي كستايل العمل كله، وبرومبتك يبقى مثل ما كتبته.</p>
              </div>
              <button type="button" className="jw-btn !min-h-9" onClick={() => setOpen(false)}>إغلاق</button>
            </header>
            <div className="jw-scroll min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <button type="button" className={`rounded-xl border px-4 py-2 text-sm ${!value ? "border-jw-accent bg-jw-accent/10 font-bold" : "border-jw-line"}`} onClick={() => (onChange(""), setOpen(false))}>
                بدون ستايل
              </button>
              <StyleBrowser skin="jawad" styles={cards} selected={value ? [value] : []} onPick={(id) => (onChange(id), setOpen(false))} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
