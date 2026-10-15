"use client";

// /admin/film · «صور خريطة الستايلات»: the owner draws, once, the sample picture of every new style of the library
// (the course guide's 24 ship with theirs). Style by style, with a stop button; each is kept for everyone.

import { useCallback, useEffect, useRef, useState } from "react";
import { postJson } from "@/lib/fetch";
import { FILM_STYLES, GUIDE_STYLE_IDS } from "@config/film-styles";
import { StyleThumb } from "@/components/style-map/StyleBrowser";

const URL = "/api/jawad/styles";
const fetchPictures = (): Promise<{ pictures: Record<string, string>; usd: number } | null> =>
  fetch(URL, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

export default function StylePictures() {
  const [pics, setPics] = useState<Record<string, string>>({});
  const [usd, setUsd] = useState(0);
  const [making, setMaking] = useState<{ id: string; done: number; total: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const stop = useRef(false);
  const show = useCallback((d: { pictures: Record<string, string>; usd: number } | null) => {
    if (!d) return;
    setPics(d.pictures);
    setUsd(d.usd);
  }, []);
  const load = () => fetchPictures().then(show);
  useEffect(() => {
    void fetchPictures().then(show);
  }, [show]);

  const fresh = FILM_STYLES.filter((s) => !GUIDE_STYLE_IDS.has(s.id));
  const missing = fresh.filter((s) => !pics[s.id]);

  async function draw(all: boolean) {
    const todo = all ? fresh : missing;
    if (!todo.length) return;
    if (!confirm(`نرسم ${todo.length} صورة ستايل بـ GPT Image 2؟ التكلفة التقريبية $${(todo.length * usd).toFixed(2)} مرة وحدة، وتظهر للكل في كل المعارض.`)) return;
    stop.current = false;
    setMsg(null);
    let ok = 0;
    for (const [i, s] of todo.entries()) {
      if (stop.current) break;
      setMaking({ id: s.id, done: i, total: todo.length });
      try {
        await postJson(URL, { action: "draw", id: s.id });
        ok++;
      } catch (e) {
        setMsg(`«${s.name}»: ${e instanceof Error ? e.message : "تعذّر الرسم."}`);
        break;
      }
    }
    setMaking(null);
    if (ok) setMsg((m) => m ?? `انرسمت ${ok} صورة ستايل ✅`);
    await load();
  }

  return (
    <section className="card space-y-3 p-4">
      <h2 className="text-xl font-extrabold">🗺️ صور خريطة الستايلات ({FILM_STYLES.length - missing.length} من {FILM_STYLES.length})</h2>
      <p className="text-sm font-bold text-muted">
        الخريطة {FILM_STYLES.length} ستايل في ١٤ عائلة (الاستوديو، اختبار الستايل في المشهد والفيلم والمسلسل، وصانع المحتوى). الـ٢٤ حق الدليل صورها جاهزة؛ الجديدة ({fresh.length}) تنرسم <b>مرة وحدة</b> بـ GPT Image 2 (نفس المشهد لكل عائلة عشان تسهل المقارنة) وتظهر للكل. الستايل بلا صورة يظهر ببلاطة ألوان عائلته. التكلفة التقريبية للصورة ${usd.toFixed(3)}.
      </p>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={!!making || !missing.length} onClick={() => void draw(false)}>ارسم الناقص ({missing.length}) · ≈ ${(missing.length * usd).toFixed(2)}</button>
        <button className="btn btn-ghost" disabled={!!making} onClick={() => void draw(true)}>أعد رسم الجديدة كلها · ≈ ${(fresh.length * usd).toFixed(2)}</button>
        {making && <button className="btn btn-ghost" onClick={() => { stop.current = true; }}>أوقف بعد الحالية</button>}
      </div>
      {making && <p className="text-sm font-bold">يرسم «{FILM_STYLES.find((s) => s.id === making.id)?.name}» ({making.done + 1} من {making.total})… كل صورة تأخذ حتى دقيقتين، لا تقفل الصفحة.</p>}
      {msg && <p className="text-sm font-bold">{msg}</p>}
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {fresh.map((s) => (
          <li key={s.id} className="space-y-1 text-center text-xs font-bold">
            <span className="block overflow-hidden rounded-xl"><StyleThumb s={{ family: s.family, name: s.name, image: pics[s.id] ?? null }} /></span>
            <span className="block truncate">{s.name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
