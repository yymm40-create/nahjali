"use client";

// «صانع المحتوى» — قائمة الخطوط: the 50 Arabic fonts a person picks from after the carousel's style, by group, each
// written in itself (its file is fetched when its row comes into view). The style's ready font is offered first, and
// «اختر لي» leaves it to «محمد باقر».

import { useEffect, useRef, useState } from "react";
import { familyOf, loadFont } from "@/components/jawad/editor/fontload";

export interface FontItem {
  id: string;
  name: string;
  group: string;
  feel: string;
  bestFor: string;
  top: boolean;
  seen?: string;
}

const ALL = "الكل";
const SAMPLE = "اكتب فكرتك، وأنا أصنع لك الكاروسيل";

function Row({ f, ready: first, disabled, onPick }: { f: FontItem; ready?: boolean; disabled?: boolean; onPick: (f: FontItem) => void }) {
  const el = useRef<HTMLTableRowElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready || !el.current) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          io.disconnect();
          void Promise.all([loadFont(f.id, 400), loadFont(f.id, 700)]).then(([ok]) => ok && setReady(true));
        }
      },
      { rootMargin: "160px" },
    );
    io.observe(el.current);
    return () => io.disconnect();
  }, [f.id, ready]);
  return (
    <tr ref={el} className={f.top || first ? "win" : ""}>
      <td className="sample">
        <span style={{ fontFamily: ready ? `"${familyOf(f.id)}", sans-serif` : undefined, opacity: ready ? 1 : 0.35 }}>{f.name}</span>
        <small style={{ fontFamily: ready ? `"${familyOf(f.id)}", sans-serif` : undefined, opacity: ready ? 1 : 0.35 }}>{SAMPLE}</small>
      </td>
      <td className="what">
        <b>{f.name}</b>
        {first && <span className="tag gold">خط الستايل الجاهز</span>}
        {f.top && <span className="tag gold">★ الأقوى في نوعه</span>}
        {f.seen && <span className="tag" title={f.seen}>📈 في إنستقرام</span>}
        <p>{f.feel}</p>
        <small>يناسب: {f.bestFor}</small>
      </td>
      <td className="act">
        <button type="button" className="ct-send" disabled={disabled} onClick={() => onPick(f)}>اختر</button>
      </td>
    </tr>
  );
}

export default function FontTable({ items, groups, ready, recommended = [], disabled, onPick, onReady, onAuto }: { items: FontItem[]; groups: string[]; ready?: FontItem | null; recommended?: string[]; disabled?: boolean; onPick: (f: FontItem) => void; onReady: (f: FontItem) => void; onAuto: () => void }) {
  const [group, setGroup] = useState(ALL);
  const picks = recommended.map((id) => items.find((f) => f.id === id)).filter((f): f is FontItem => !!f && f.id !== ready?.id);
  const shown = groups.filter((g) => group === ALL || g === group);
  return (
    <div className="ct-ctable ct-ftable">
      <div className="ct-ctable-ways">
        {ready && <button type="button" className="ct-opt" disabled={disabled} onClick={() => onReady(ready)}>✅ خط الستايل الجاهز: {ready.name}</button>}
        <button type="button" className="ct-opt" disabled={disabled} onClick={onAuto}>🎲 اختر لي الأنسب</button>
      </div>
      <div className="ct-ctable-chips" role="group" aria-label="صنّف حسب نوع الخط">
        {[ALL, ...groups].map((g) => (
          <button key={g} type="button" className="ct-opt" aria-pressed={group === g} onClick={() => setGroup(g)}>
            {g} <small>{g === ALL ? items.length : items.filter((f) => f.group === g).length}</small>
          </button>
        ))}
      </div>
      <div className="ct-ctable-scroll">
        <table>
          <thead>
            <tr><th>شكله</th><th>الخط</th><th><span className="sr">اختيار</span></th></tr>
          </thead>
          {(ready || picks.length > 0) && group === ALL && (
            <tbody>
              <tr className="niche"><th colSpan={3}>{ready ? "خط الستايل وترشيحات محمد باقر" : "ترشيحات محمد باقر لك"}</th></tr>
              {ready && <Row key={`r-${ready.id}`} f={ready} ready disabled={disabled} onPick={onReady} />}
              {picks.map((f) => <Row key={`p-${f.id}`} f={f} disabled={disabled} onPick={onPick} />)}
            </tbody>
          )}
          {shown.map((g) => (
            <tbody key={g}>
              <tr className="niche"><th colSpan={3}>{g}</th></tr>
              {items.filter((f) => f.group === g).map((f) => <Row key={f.id} f={f} disabled={disabled} onPick={onPick} />)}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
