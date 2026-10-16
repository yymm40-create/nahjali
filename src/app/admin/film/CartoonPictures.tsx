"use client";

// /admin/film · «صور ستايلات الكرتون»: the owner draws, once, the sample picture of each look of «حولني الى الستايل
// الكرتوني». Nothing is drawn by itself: look by look from the buttons, with a stop button; each is kept for everyone.

import { useCallback, useEffect, useRef, useState } from "react";
import { postJson } from "@/lib/fetch";
import { CARTOON_STYLES } from "@config/jawad/cartoon";

const URL = "/api/jawad/cartoon-styles";
type Data = { pictures: Record<string, string>; usd: number };
const fetchPictures = (): Promise<Data | null> => fetch(URL, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

export default function CartoonPictures() {
  const [pics, setPics] = useState<Record<string, string>>({});
  const [usd, setUsd] = useState(0);
  const [making, setMaking] = useState<{ id: string; done: number; total: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const stop = useRef(false);
  const show = useCallback((d: Data | null) => {
    if (!d) return;
    setPics(d.pictures);
    setUsd(d.usd);
  }, []);
  const load = () => fetchPictures().then(show);
  useEffect(() => {
    void fetchPictures().then(show);
  }, [show]);

  const missing = CARTOON_STYLES.filter((s) => !pics[s.id]);

  async function draw(list: readonly { id: string; name: string }[]) {
    if (!list.length) return;
    if (!confirm(`نرسم ${list.length} صورة ستايل كرتوني بـ GPT Image 2؟ التكلفة التقريبية $${(list.length * usd).toFixed(2)} مرة وحدة، وتظهر للكل في صفحة الكرتون.`)) return;
    stop.current = false;
    setMsg(null);
    let ok = 0;
    for (const [i, s] of list.entries()) {
      if (stop.current) break;
      setMaking({ id: s.id, done: i, total: list.length });
      try {
        await postJson(URL, { action: "draw", id: s.id });
        ok++;
      } catch (e) {
        setMsg(`«${s.name}»: ${e instanceof Error ? e.message : "تعذّر الرسم."}`);
        break;
      }
    }
    setMaking(null);
    if (ok) setMsg((m) => m ?? `انرسمت ${ok} صورة ✅`);
    await load();
  }

  return (
    <section className="card space-y-3 p-4">
      <h2 className="text-xl font-extrabold">🧸 صور ستايلات الكرتون ({CARTOON_STYLES.length - missing.length} من {CARTOON_STYLES.length})</h2>
      <p className="text-sm font-bold text-muted">
        صفحة «حولني الى الستايل الكرتوني» فيها {CARTOON_STYLES.length} ستايل. كل ستايل ينرسم له <b>مرة وحدة</b> شخصية مخترعة (مو شخص حقيقي) بـ GPT Image 2 وتظهر للكل؛ وما ينرسم شي لحاله — بس لما تضغط. الستايل بلا صورة يظهر ببلاطة ملونة فيها أيقونته. التكلفة التقريبية للصورة ${usd.toFixed(3)}.
      </p>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={!!making || !missing.length} onClick={() => void draw(missing)}>ارسم الناقص ({missing.length}) · ≈ ${(missing.length * usd).toFixed(2)}</button>
        {making && <button className="btn btn-ghost" onClick={() => { stop.current = true; }}>أوقف بعد الحالية</button>}
      </div>
      {making && <p className="text-sm font-bold">يرسم «{CARTOON_STYLES.find((s) => s.id === making.id)?.name}» ({making.done + 1} من {making.total})… كل صورة تأخذ حتى دقيقتين، لا تقفل الصفحة.</p>}
      {msg && <p className="text-sm font-bold">{msg}</p>}
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {CARTOON_STYLES.map((s) => (
          <li key={s.id} className="space-y-1 text-center text-xs font-bold">
            <span className="block overflow-hidden rounded-xl">
              {pics[s.id] ? (
                // eslint-disable-next-line @next/next/no-img-element -- kept in the public bucket
                <img src={pics[s.id]} alt={s.name} loading="lazy" className="aspect-video w-full object-cover" />
              ) : (
                <span className="grid aspect-video w-full place-items-center bg-surface-2 text-2xl" aria-label={`${s.name}: بلا صورة`}>{s.icon}</span>
              )}
            </span>
            <span className="block truncate">{s.name}</span>
            <button className="btn btn-ghost !min-h-7 !px-2 !text-[11px]" disabled={!!making} onClick={() => void draw([s])}>{pics[s.id] ? "أعد رسمه" : "ارسمه"}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
