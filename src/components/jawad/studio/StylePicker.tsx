"use client";

// «الستايل» in the image and video studios: the 24 styles of the course guide, each with its picture, in a menu that
// opens from under the generator. The chosen one's text goes into what the generator reads as the look of the piece
// (the person's prompt stays as written); «جواد» knows them and can pick one too.

import { useMemo, useState } from "react";
import Image from "next/image";
import { FILM_STYLES, findStyle, styleImage } from "@config/film-styles";

export default function StylePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const cur = value ? findStyle(value) : undefined;
  const groups = useMemo(() => [...new Set(FILM_STYLES.map((s) => s.group))].map((g) => ({ g, list: FILM_STYLES.filter((s) => s.group === g) })), []);
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold">🎨 الستايل <span className="text-xs font-normal text-jw-muted">(اختياري)</span></p>
      <button type="button" className="flex w-full items-center gap-3 rounded-xl border border-jw-line bg-jw-surface-2 p-2 text-start hover:border-jw-accent" onClick={() => setOpen(true)} aria-haspopup="dialog">
        {cur ? (
          <>
            <Image src={styleImage(cur.id)} alt="" width={96} height={54} className="h-[54px] w-24 shrink-0 rounded-lg object-cover" />
            <span className="min-w-0 flex-1">
              <b className="block text-sm">{cur.name}</b>
              <span className="line-clamp-1 text-xs text-jw-muted">{cur.description}</span>
            </span>
          </>
        ) : (
          <span className="flex-1 px-1 py-3 text-sm text-jw-muted">بدون ستايل — اضغط واختر من ٢٤ ستايل بصورها</span>
        )}
        <span className="text-xs text-jw-accent">{cur ? "غيّر" : "اختر"}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" role="dialog" aria-label="اختر الستايل" dir="rtl" onClick={() => setOpen(false)}>
          <div className="jw-panel flex max-h-[88dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between gap-2 border-b border-jw-line px-4 py-3">
              <div>
                <h2 className="text-base font-black">اختر الستايل</h2>
                <p className="text-xs text-jw-muted">برومبت الستايل ينحط في البرومبت الرئيسي كستايل العمل كله، وبرومبتك يبقى مثل ما كتبته.</p>
              </div>
              <button type="button" className="jw-btn !min-h-9" onClick={() => setOpen(false)}>إغلاق</button>
            </header>
            <div className="jw-scroll min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
              <button type="button" className={`rounded-xl border px-4 py-2 text-sm ${!value ? "border-jw-accent bg-jw-accent/10 font-bold" : "border-jw-line"}`} onClick={() => (onChange(""), setOpen(false))}>
                بدون ستايل
              </button>
              {groups.map(({ g, list }) => (
                <section key={g} className="space-y-2">
                  <h3 className="text-sm font-bold text-jw-muted">{g}</h3>
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {list.map((s) => (
                      <li key={s.id}>
                        <button type="button" className={`w-full overflow-hidden rounded-xl border text-start transition hover:border-jw-accent ${value === s.id ? "border-jw-accent ring-2 ring-jw-accent/40" : "border-jw-line"}`} onClick={() => (onChange(s.id), setOpen(false))} aria-pressed={value === s.id}>
                          <Image src={styleImage(s.id)} alt={s.name} width={320} height={180} className="aspect-video w-full object-cover" />
                          <span className="block space-y-0.5 p-2">
                            <b className="block text-sm">{s.name}</b>
                            <span className="line-clamp-2 text-[11px] text-jw-muted">{s.description}</span>
                            <span className="block text-[10px] text-jw-faint">يناسب: {s.bestFor}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
