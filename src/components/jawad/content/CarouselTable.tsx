"use client";

// «صانع المحتوى» — جدول ستايلات الكاروسيل: the 104 looks a person picks from, by niche, each with its two sample slides, what it
// is and what it suits. Instead of questions about colours and margins. Two ways out: help me choose, or something else.

import { useEffect, useState } from "react";

export interface CarouselItem {
  id: string;
  n: number;
  niche: string;
  name: string;
  description: string;
  bestFor: string;
  winner: boolean;
  realistic: boolean;
  cover: string;
  slide: string;
}

const ALL = "الكل";

function Row({ s, onPick, onOpen }: { s: CarouselItem; onPick: (s: CarouselItem) => void; onOpen: (s: CarouselItem) => void }) {
  return (
    <tr className={s.winner ? "win" : ""}>
      <td className="pics">
        <button type="button" onClick={() => onOpen(s)} aria-label={`كبّر ${s.name}`}>
          <img src={s.cover} alt={`غلاف ${s.name}`} loading="lazy" width={600} height={800} />
          <img src={s.slide} alt={`شريحة ${s.name}`} loading="lazy" width={600} height={800} />
        </button>
      </td>
      <td className="what">
        <b>{s.n}. {s.name}</b>
        {s.winner && <span className="tag gold">★ الأقوى في مجاله</span>}
        {s.realistic && <span className="tag">📷 فيه صور واقعية</span>}
        <p>{s.description}</p>
        <small>يناسب: {s.bestFor}</small>
      </td>
      <td className="act">
        <button type="button" className="ct-send" onClick={() => onPick(s)}>اختر</button>
      </td>
    </tr>
  );
}

export default function CarouselTable({ items, niches, recommended = [], disabled, onPick, onHelp, onOwn }: { items: CarouselItem[]; niches: string[]; recommended?: string[]; disabled?: boolean; onPick: (s: CarouselItem) => void; onHelp: () => void; onOwn: (what: string) => void }) {
  const [niche, setNiche] = useState(ALL);
  const [view, setView] = useState<CarouselItem | null>(null);
  const [own, setOwn] = useState<string | null>(null);
  const picks = recommended.map((id) => items.find((s) => s.id === id)).filter((s): s is CarouselItem => !!s);
  const shown = niches.filter((n) => niche === ALL || n === niche);

  useEffect(() => {
    if (!view) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setView(null);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [view]);

  const pick = (s: CarouselItem) => {
    if (disabled) return;
    setView(null);
    onPick(s);
  };

  return (
    <div className="ct-ctable">
      <div className="ct-ctable-ways">
        <button type="button" className="ct-opt" disabled={disabled} onClick={onHelp}>🤝 ما أعرف أختار، ساعدني</button>
        <button type="button" className="ct-opt ct-opt-write" aria-pressed={own !== null} disabled={disabled} onClick={() => setOwn(own === null ? "" : null)}>✍️ أبي شيئًا غير الموجود</button>
      </div>
      {own !== null && (
        <form className="ct-ctable-own" onSubmit={(e) => { e.preventDefault(); if (own.trim()) onOwn(own); }}>
          <input className="ct-inline" dir="auto" autoFocus value={own} maxLength={400} placeholder="صف الشكل الذي تريده بكلامك" onChange={(e) => setOwn(e.target.value)} />
          <button type="submit" className="ct-send" disabled={disabled || !own.trim()}>أرسل</button>
        </form>
      )}
      <div className="ct-ctable-chips" role="group" aria-label="صنّف حسب المجال">
        {[ALL, ...niches].map((n) => (
          <button key={n} type="button" className="ct-opt" aria-pressed={niche === n} onClick={() => setNiche(n)}>
            {n} <small>{n === ALL ? items.length : items.filter((s) => s.niche === n).length}</small>
          </button>
        ))}
      </div>
      <div className="ct-ctable-scroll">
        <table>
          <thead>
            <tr><th>الغلاف والشريحة</th><th>الستايل</th><th><span className="sr">اختيار</span></th></tr>
          </thead>
          {picks.length > 0 && (
            <tbody>
              <tr className="niche"><th colSpan={3}>ترشيحات محمد باقر لك</th></tr>
              {picks.map((s) => <Row key={s.id} s={s} onPick={pick} onOpen={setView} />)}
            </tbody>
          )}
          {shown.map((n) => (
            <tbody key={n}>
              <tr className="niche"><th colSpan={3}>{n}</th></tr>
              {items.filter((s) => s.niche === n).map((s) => <Row key={s.id} s={s} onPick={pick} onOpen={setView} />)}
            </tbody>
          ))}
        </table>
      </div>
      {view && (
        <div className="ct-lightbox" role="dialog" aria-modal="true" aria-label={view.name} onClick={() => setView(null)}>
          <div className="ct-lightbox-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="ct-lightbox-x" onClick={() => setView(null)} aria-label="أغلق">✕</button>
            <div className="ct-ctable-big">
              <img src={view.cover} alt={`غلاف ${view.name}`} />
              <img src={view.slide} alt={`شريحة ${view.name}`} />
            </div>
            <h4>{view.n}. {view.name} <small>({view.niche})</small></h4>
            <p>{view.description}</p>
            <p className="muted">يناسب: {view.bestFor}</p>
            {view.realistic && <p className="muted">📷 فيه صور واقعية: نسألك هل تضيف صورك أو نسويها لك من الصفر.</p>}
            <div className="ct-actions">
              <button type="button" className="ct-send" style={{ height: 42 }} disabled={disabled} onClick={() => pick(view)}>اختر هذا</button>
              <button type="button" className="ct-opt" onClick={() => setView(null)}>رجوع للجدول</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
