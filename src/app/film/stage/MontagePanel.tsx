"use client";

// «المونتاج» inside the scene: the chosen takes play one after the other on one screen (a first look at the whole
// scene without leaving the page), a filmstrip to jump between them, the person's note on each take, then «حيدرة كت»
// for the real cut — or straight to it.

import { useEffect, useRef, useState } from "react";
import OpenEdit from "../[id]/edit/OpenEdit";
import SaveScene from "../[id]/edit/SaveScene";

export interface Take {
  genId: string;
  name: string;
  videoId: string | null;
  url: string;
  note: string;
  durationSec: number | null;
  approved: boolean;
  removed: boolean;
}

export default function MontagePanel({ filmId, filmTitle, takes, editExists, scene }: { filmId: string; filmTitle: string; takes: Take[]; editExists: boolean; scene: { url: string } | null }) {
  const playable = takes.filter((t) => t.url);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const cur = playable[i];
  useEffect(() => {
    const v = video.current;
    if (!v || !cur) return;
    v.load();
    if (playing) v.play().catch(() => setPlaying(false));
  }, [i, cur, playing]);
  const next = () => {
    if (i + 1 < playable.length) setI(i + 1);
    else {
      setPlaying(false);
      setI(0);
    }
  };
  const total = playable.reduce((n, t) => n + (t.durationSec ?? 0), 0);

  return (
    <div className="space-y-4">
      {playable.length > 0 ? (
        <section className="space-y-2">
          <div className="fs-screen">
            <video ref={video} src={cur?.url} playsInline controls={!playing} onEnded={next} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
            {cur && <span className="label">{cur.genId} · {cur.name}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary min-h-11 px-5" onClick={() => { if (!playing) { setI(0); setPlaying(true); setTimeout(() => video.current?.play().catch(() => null), 0); } else { video.current?.pause(); } }}>
              {playing ? "⏸ أوقف" : "▶️ شغّل المشهد كاملًا"}
            </button>
            <span className="text-xs font-bold text-muted">{playable.length} لقطات · {total ? `≈ ${Math.round(total)} ث` : ""} · تُعرض وراء بعض بترتيب المخرج (نظرة أولى، مو المونتاج النهائي)</span>
          </div>
          <div className="fs-strip">
            {playable.map((t, k) => (
              <button key={t.genId} type="button" aria-current={k === i} onClick={() => { setI(k); setPlaying(true); }}>
                <video src={`${t.url}#t=0.5`} muted playsInline preload="metadata" />
                <span>{t.genId}{t.approved ? " ✓" : ""}</span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <p className="card p-5 text-center text-sm font-bold text-muted">ما فيه فيديوهات جاهزة بعد. ولّدها من خطوة «التوليد» وترجع هنا تشوف المشهد كاملًا.</p>
      )}

      <section className="card space-y-3 p-4">
        <h2 className="font-extrabold">✂️ القص الحقيقي في «حيدرة كت»</h2>
        <p className="text-sm font-bold text-muted">يفتح مشروع هذا المشهد في برنامج المونتاج بلقطاته مرتّبة (بأصواتها)، وتقص وترتّب وتضيف نصوصًا وتصدّر. اكتب ملاحظتك على أي لقطة أول لو تبي حيدرة يعدّلها لك.</p>
        {takes.some((t) => !t.url) && (
          <p className="text-xs font-bold text-muted">لقطات بلا فيديو بعد: {takes.filter((t) => !t.url).map((t) => (t.removed ? `${t.genId} (انحذف بعد ٧ أيام)` : t.genId)).join("، ")}</p>
        )}
        <OpenEdit filmId={filmId} exists={editExists} disabled={!playable.length} filmTitle={filmTitle} cut={takes.map((t) => ({ genId: t.genId, name: t.name, videoId: t.videoId, note: t.note }))} />
        <p className="text-xs text-muted">بعد تصدير الفيلم بـ٣ أيام تنحذف ملفات المونتاج، والفيديوهات اللي في المونتاج ما تنحذف قبلها.</p>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-extrabold">🏆 المشهد الناجح</h2>
        <p className="text-sm font-bold text-muted">صدّرت المونتاج من «صدّر» داخل حيدرة كت؟ احفظه هنا: يبقى محفوظ في الموقع ولا ينحذف.</p>
        {scene && <video src={scene.url} controls playsInline className="w-full rounded-xl bg-black" />}
        <SaveScene filmId={filmId} saved={!!scene} disabled={!editExists} />
      </section>
    </div>
  );
}
