"use client";

// /admin/film · «صور ستايلات الكرتون»: the owner draws, once, the sample picture of each look of «حولني الى الستايل
// الكرتوني». Nothing is drawn by itself: look by look from the buttons, with a stop button; each is kept for everyone.

import { useCallback, useEffect, useRef, useState } from "react";
import { postJson } from "@/lib/fetch";
import { CARTOON_CHOICES, CARTOON_PLACES, CARTOON_STYLES as ALL_STYLES, type CartoonPlace } from "@config/jawad/cartoon";

// only the looks the page offers now (3D, 2D, أنمي)
const CARTOON_STYLES = ALL_STYLES.filter((s) => CARTOON_CHOICES.some((c) => c.id === s.id));

const URL = "/api/jawad/cartoon-styles";
type Data = { pictures: Record<string, string>; places?: Record<string, string>; usd: number };
const fetchPictures = (): Promise<Data | null> => fetch(URL, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

export default function CartoonPictures() {
  const [pics, setPics] = useState<Record<string, string>>({});
  const [sheets, setSheets] = useState<Record<string, string>>({});
  const [usd, setUsd] = useState(0);
  const [making, setMaking] = useState<{ id: string; place?: CartoonPlace; done: number; total: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const stop = useRef(false);
  const show = useCallback((d: Data | null) => {
    if (!d) return;
    setPics(d.pictures);
    setSheets(d.places ?? {});
    setUsd(d.usd);
  }, []);
  const load = () => fetchPictures().then(show);
  useEffect(() => {
    void fetchPictures().then(show);
  }, [show]);

  const missing = CARTOON_STYLES.filter((s) => !pics[s.id]);

  async function draw(list: readonly { id: string; name: string; place?: CartoonPlace }[]) {
    if (!list.length) return;
    if (!confirm(`نرسم ${list.length} ${list[0].place ? "شيت بيئة" : "صورة ستايل كرتوني"} بـ GPT Image 2؟ التكلفة التقريبية $${(list.length * usd).toFixed(2)} مرة وحدة، وتظهر للكل في صفحة الكرتون.`)) return;
    stop.current = false;
    setMsg(null);
    let ok = 0;
    for (const [i, s] of list.entries()) {
      if (stop.current) break;
      setMaking({ id: s.id, place: s.place, done: i, total: list.length });
      try {
        await postJson(URL, s.place ? { action: "place", place: s.place, id: s.id } : { action: "draw", id: s.id });
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
      {making && <p className="text-sm font-bold">يرسم «{CARTOON_STYLES.find((s) => s.id === making.id)?.name}»{making.place ? ` · ${CARTOON_PLACES[making.place].name}` : ""} ({making.done + 1} من {making.total})… كل صورة تأخذ حتى دقيقتين، لا تقفل الصفحة.</p>}
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
      <h3 className="pt-2 text-lg font-extrabold">🏞️ شيتات البيئات لفيلم الكرتون ({Object.keys(sheets).length} من {Object.keys(CARTOON_PLACES).length * CARTOON_STYLES.length})</h3>
      <p className="text-sm font-bold text-muted">
        فيلم الشخصية يصير في وحدة من {Object.keys(CARTOON_PLACES).length} بيئات، وكل بيئة لها <b>شيت بيئة كامل</b> (٩ لقطات لنفس المكان، بدون ناس) بكل ستايل، عشان الفيلم يطلع بنفس ستايل الصورة ونفس المكان. ينرسم مرة وحدة ويظهر للكل؛ والبيئة بلا شيت يصوّرها الفيلم من وصفها بس.
      </p>
      {(Object.entries(CARTOON_PLACES) as [CartoonPlace, (typeof CARTOON_PLACES)[CartoonPlace]][]).map(([place, info]) => {
        const left = CARTOON_STYLES.filter((s) => !sheets[`${place}--${s.id}`]).map((s) => ({ id: s.id, name: s.name, place }));
        return (
          <div key={place} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <b>{info.icon} {info.name}</b>
              <button className="btn btn-ghost" disabled={!!making || !left.length} onClick={() => void draw(left)}>ارسم الناقص ({left.length}) · ≈ ${(left.length * usd).toFixed(2)}</button>
            </div>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {CARTOON_STYLES.map((s) => {
                const pic = sheets[`${place}--${s.id}`];
                return (
                  <li key={s.id} className="space-y-1 text-center text-xs font-bold">
                    <span className="block overflow-hidden rounded-xl">
                      {pic ? (
                        // eslint-disable-next-line @next/next/no-img-element -- kept in the public bucket
                        <img src={pic} alt={`${info.name} · ${s.name}`} loading="lazy" className="aspect-video w-full object-cover" />
                      ) : (
                        <span className="grid aspect-video w-full place-items-center bg-surface-2 text-2xl" aria-label={`${info.name} · ${s.name}: بلا شيت`}>{info.icon}</span>
                      )}
                    </span>
                    <span className="block truncate">{s.name}</span>
                    <button className="btn btn-ghost !min-h-7 !px-2 !text-[11px]" disabled={!!making} onClick={() => void draw([{ id: s.id, name: s.name, place }])}>{pic ? "أعد رسمه" : "ارسمه"}</button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
