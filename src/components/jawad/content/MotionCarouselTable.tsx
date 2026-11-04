"use client";

// «صانع المحتوى» — جدول ستايلات الحركة: the ready motion styles of a motion carousel, each with a small moving
// preview (CSS only), what it fits, and the cheapest way that makes it; «ساعدني» leaves it to «محمد باقر», and
// «ابنِه معي من الصفر» takes the person's own words.

import { useState } from "react";
import { MOTION_CAROUSEL_STYLES, routeById, type MotionCarouselStyle } from "@config/content-motion-carousel";

const WORD: Record<string, string> = { counter: "٨٧٪", breaking: "عاجل", "text-behind": "جديد", quiz: "سؤال؟" };

const COST = { code: "الأرخص: بالكود فقط", picture: "+ صورة GPT Image 2", elements: "+ عناصر مفرّغة" } as const;

function Preview({ s }: { s: MotionCarouselStyle }) {
  return (
    <span className={`mvp mvp-${s.id}`} aria-hidden>
      <i className="bg" />
      <i className="el" />
      <b className="l1">{WORD[s.id] ?? "فكرتك"}</b>
      <b className="l2">تتحرك هنا</b>
      <i className="mark" />
    </span>
  );
}

export default function MotionCarouselTable({ recommended = [], disabled, onPick, onHelp, onOwn }: { recommended?: string[]; disabled?: boolean; onPick: (s: MotionCarouselStyle) => void; onHelp: () => void; onOwn: (what: string) => void }) {
  const [own, setOwn] = useState<string | null>(null);
  const picks = recommended.map((id) => MOTION_CAROUSEL_STYLES.find((s) => s.id === id)).filter((s): s is MotionCarouselStyle => !!s);
  const row = (s: MotionCarouselStyle, key: string) => (
    <tr key={key} className={picks.includes(s) ? "win" : ""}>
      <td className="mvcell"><Preview s={s} /></td>
      <td className="what">
        <b>{s.n}. {s.name}</b>
        <span className={`tag ${s.route === "code" ? "gold" : ""}`}>{COST[s.route]}</span>
        <span className="tag">{s.seconds} ثوانٍ للشريحة</span>
        <p>{s.feel}</p>
        <small>يناسب: {s.bestFor} · أرخص طريقة: {routeById(s.route)?.label}</small>
      </td>
      <td className="act">
        <button type="button" className="ct-send" disabled={disabled} onClick={() => onPick(s)}>اختر</button>
      </td>
    </tr>
  );
  return (
    <div className="ct-ctable ct-mvtable">
      <div className="ct-ctable-ways">
        <button type="button" className="ct-opt" disabled={disabled} onClick={onHelp}>🤝 ما أعرف أختار، ساعدني</button>
        <button type="button" className="ct-opt ct-opt-write" aria-pressed={own !== null} disabled={disabled} onClick={() => setOwn(own === null ? "" : null)}>🛠️ ابنِه معي من الصفر</button>
      </div>
      {own !== null && (
        <form className="ct-ctable-own" onSubmit={(e) => { e.preventDefault(); if (own.trim()) onOwn(own); }}>
          <input className="ct-inline" dir="auto" autoFocus value={own} maxLength={400} placeholder="صف الحركة: كيف يدخل الكلام، وش يتحرك، والصوت، والخلفية" onChange={(e) => setOwn(e.target.value)} />
          <button type="submit" className="ct-send" disabled={disabled || !own.trim()}>أرسل</button>
        </form>
      )}
      <div className="ct-ctable-scroll">
        <table>
          <thead>
            <tr><th>شكل الحركة</th><th>الستايل</th><th><span className="sr">اختيار</span></th></tr>
          </thead>
          {picks.length > 0 && (
            <tbody>
              <tr className="niche"><th colSpan={3}>ترشيحات محمد باقر لك</th></tr>
              {picks.map((s) => row(s, `p-${s.id}`))}
            </tbody>
          )}
          <tbody>
            <tr className="niche"><th colSpan={3}>ستايلات الحركة الجاهزة ({MOTION_CAROUSEL_STYLES.length})</th></tr>
            {MOTION_CAROUSEL_STYLES.map((s) => row(s, s.id))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
