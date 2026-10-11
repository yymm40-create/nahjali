"use client";

// «مكتبة المؤثرات» in «حيدرة كت»: ready sound effects by section (transitions, risers, hits, comedy, horror…), each
// heard with ▶ before it is taken, ticked and put in the project for free. The owner sees what is still to be made
// and makes it here (config/jawad/sfx-library.ts holds the list).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, postJson } from "@/lib/fetch";
import Icon from "../Icon";
import { SFX_CATEGORIES } from "@config/jawad/sfx-library";
import type { EditorAsset } from "./types";

interface Item { id: string; cat: string; name: string; seconds: number; loop: boolean; url: string | null }
interface State { items: Item[]; ready: number; total: number; missingUsd: number; owner: boolean }

export default function SfxLibrary({ projectId, onImported, readOnly }: { projectId: string; onImported: (a: EditorAsset[]) => void; readOnly: boolean }) {
  const [s, setS] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cat, setCat] = useState(SFX_CATEGORIES[0].id);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [making, setMaking] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    try {
      setS(await api<State>("/api/jawad/editor/sfx-library"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر.");
    }
  }, []);
  useEffect(() => {
    let live = true;
    api<State>("/api/jawad/editor/sfx-library")
      .then((r) => live && setS(r))
      .catch((e: Error) => live && setError(e.message));
    const player = audio;
    return () => {
      live = false;
      player.current?.pause();
    };
  }, []);

  const shown = useMemo(() => {
    const words = q.trim();
    return (s?.items ?? []).filter((i) => (words ? i.name.includes(words) : i.cat === cat) && (i.url || s?.owner));
  }, [s, cat, q]);

  const play = (i: Item) => {
    if (!i.url) return;
    audio.current?.pause();
    if (playing === i.id) return setPlaying(null);
    const a = new Audio(i.url);
    audio.current = a;
    a.onended = () => setPlaying(null);
    void a.play().catch(() => setPlaying(null));
    setPlaying(i.id);
  };

  const bring = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await postJson<{ assets: EditorAsset[] }>(`/api/jawad/editor/projects/${projectId}`, { action: "import_sfx", ids: picked });
      setPicked([]);
      onImported(r.assets);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر.");
    } finally {
      setBusy(false);
    }
  };

  /** The owner: makes the missing ones, a few per request, until none are left. */
  const makeAll = async () => {
    setError(null);
    let failures = 0;
    for (;;) {
      try {
        setMaking("…");
        const r = await postJson<{ done: string[]; failed: { id: string; why: string }[]; left: number }>("/api/jawad/editor/sfx-library", {});
        setMaking(`باقي ${r.left}`);
        if (r.failed.length) setError(`ما انصنع ${r.failed.length}: ${r.failed[0].why}`);
        if (!r.left || (!r.done.length && ++failures >= 2)) break;
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذّر.");
        break;
      }
    }
    setMaking(null);
    await load();
  };

  if (error && !s) return <p className="p-3 text-xs text-jw-danger">{error}</p>;
  if (!s) return <div className="grid flex-1 place-items-center"><span className="jw-spinner" /></div>;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {s.owner && s.ready < s.total && (
        <div className="m-2 rounded-lg border border-jw-accent/40 bg-jw-accent/10 p-2 text-xs">
          <p className="font-bold">للرئيس: جاهز {s.ready} من {s.total} مؤثر.</p>
          <p className="text-jw-muted">صناعة الباقي تكلف تقريبًا ${s.missingUsd.toFixed(2)} من ElevenLabs، مرة وحدة بس، وبعدها مجانية للكل.</p>
          <button type="button" className="jw-btn jw-btn-primary mt-1 w-full" disabled={!!making} onClick={() => void makeAll()}>
            {making ? <><span className="jw-spinner" /> نصنعها… {making}</> : "اصنع المؤثرات الناقصة"}
          </button>
        </div>
      )}
      {!s.owner && s.ready === 0 ? (
        <p className="p-4 text-center text-xs text-jw-faint">مكتبة المؤثرات قيد التجهيز؛ ترجع لك قريب إن شاء الله.</p>
      ) : (
        <>
          <div className="space-y-2 p-2">
            <input className="jw-input w-full text-xs" placeholder="ابحث: ووش، ضحك، رعب…" value={q} onChange={(e) => setQ(e.target.value)} />
            {!q.trim() && (
              <div className="jw-scroll flex gap-1.5 overflow-x-auto pb-1">
                {SFX_CATEGORIES.map((c) => (
                  <button key={c.id} type="button" title={c.hint} onClick={() => setCat(c.id)} className={`jw-chip shrink-0 text-xs ${cat === c.id ? "border-jw-accent text-jw-accent" : ""}`}>
                    {c.icon} {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <ul className="jw-scroll min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2">
            {shown.map((i) => {
              const on = picked.includes(i.id);
              return (
                <li key={i.id} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${on ? "border-jw-accent bg-jw-accent/10" : "border-jw-line"}`}>
                  <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon shrink-0" disabled={!i.url} onClick={() => play(i)} aria-label={playing === i.id ? "وقّف" : "اسمع"}>
                    {playing === i.id ? "⏸" : "▶"}
                  </button>
                  <button
                    type="button"
                    disabled={!i.url || readOnly}
                    aria-pressed={on}
                    onClick={() => setPicked((p) => (on ? p.filter((x) => x !== i.id) : [...p, i.id].slice(-40)))}
                    className="flex min-w-0 flex-1 items-center gap-2 text-start"
                  >
                    <span className="min-w-0 flex-1 truncate">{i.name}{i.loop ? " 🔁" : ""}</span>
                    <span className="shrink-0 text-jw-faint" dir="ltr">{i.url ? `${i.seconds}s` : "لم يُصنع"}</span>
                    {on && <Icon name="check" size={14} strokeWidth={2.5} />}
                  </button>
                </li>
              );
            })}
            {!shown.length && <li className="p-3 text-center text-jw-faint">ما فيه نتيجة.</li>}
          </ul>
          <div className="border-t border-jw-line p-2">
            {error && <p className="mb-1 text-xs text-jw-danger">{error}</p>}
            <button type="button" className="jw-btn jw-btn-primary w-full" disabled={!picked.length || busy || readOnly} onClick={() => void bring()}>
              {busy ? <span className="jw-spinner" /> : <Icon name="plus" size={16} />} أضف {picked.length ? `(${picked.length})` : ""} للمشروع · مجانًا
            </button>
          </div>
        </>
      )}
    </div>
  );
}
