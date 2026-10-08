"use client";

// «المكتبة»: everything the scene ever made, in a drawer — newest first like a conversation, filtered by step or kind,
// side by side as a grid when the person wants to compare. A tap opens the item to read, watch, hear or download.

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/fetch";
import type { LibraryItem } from "@/lib/film/library";

const STEP_LABEL: Record<LibraryItem["step"], string> = { story: "القصة", script: "السيناريست", sheets: "الشيتات", director: "المخرج", videos: "الفيديو", voices: "الأصوات", edit: "المونتاج" };
const KIND_ICON: Record<LibraryItem["kind"], string> = { text: "📄", image: "🖼️", video: "🎬", audio: "🎙️" };
const STATE_LABEL: Record<LibraryItem["state"], string> = { approved: "معتمد", current: "جديد", older: "نسخة أقدم", archived: "أرشيف", failed: "فشل" };
const day = (iso: string) => new Date(iso).toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "long" });

export default function LibraryDrawer({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [grid, setGrid] = useState(false);
  const [open, setOpen] = useState<LibraryItem | null>(null);
  useEffect(() => {
    let live = true;
    api<{ items: LibraryItem[] }>(`/api/film/projects/${projectId}/library`)
      .then((r) => live && setItems(r.items))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [projectId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (open ? setOpen(null) : onClose());
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const shown = useMemo(() => (items ?? []).filter((i) => filter === "all" || i.step === filter || i.kind === filter), [items, filter]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of items ?? []) {
      c[i.step] = (c[i.step] ?? 0) + 1;
      c[i.kind] = (c[i.kind] ?? 0) + 1;
    }
    return c;
  }, [items]);
  const filters = [["all", "الكل"], ["image", "🖼️ صور"], ["video", "🎬 فيديو"], ["audio", "🎙️ أصوات"], ["text", "📄 نصوص"], ...Object.entries(STEP_LABEL)].filter(([k]) => k === "all" || counts[k]);

  return (
    <>
      <div className="fs-drawer-back" onClick={onClose} />
      <aside className="fs fs-drawer" aria-label="المكتبة">
        <header>
          <span className="text-2xl" aria-hidden>🗂️</span>
          <div className="min-w-0 flex-1">
            <p className="font-black">المكتبة</p>
            <p className="truncate text-xs font-bold text-muted">كل اللي انصنع في هذا المشهد يبقى هنا، حتى لو رجعت وغيّرت</p>
          </div>
          <button type="button" className="fs-tool" aria-pressed={grid} onClick={() => setGrid(!grid)} title="جنب بعض">{grid ? "☰" : "▦"}</button>
          <button type="button" className="fs-tool" onClick={onClose} aria-label="إغلاق">✕</button>
        </header>
        <div className="filters">
          {filters.map(([k, label]) => (
            <button key={k} type="button" className="fs-tool" aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {label}{k !== "all" ? ` ${counts[k]}` : ""}
            </button>
          ))}
        </div>
        <div className={`fs-lib ${grid ? "fs-lib-grid" : ""}`}>
          {!items && !error && <p className="p-4 text-center text-sm font-bold text-muted">نجمع كل شي…</p>}
          {error && <p className="error-box text-sm">{error}</p>}
          {items && !shown.length && <p className="p-4 text-center text-sm font-bold text-muted">ما فيه شي هنا بعد.</p>}
          {shown.map((it, i) => {
            const newDay = !grid && (i === 0 || day(shown[i - 1].at) !== day(it.at));
            return (
              <div key={it.id} className="contents">
                {newDay && <p className="fs-lib-day">{day(it.at)}</p>}
                <button type="button" className="fs-lib-item" onClick={() => setOpen(it)}>
                  <span className="thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                    {it.kind === "image" && it.url ? <img src={it.url} alt="" loading="lazy" /> : it.kind === "video" && it.url ? <video src={`${it.url}#t=0.5`} muted playsInline preload="metadata" /> : KIND_ICON[it.kind]}
                  </span>
                  <span className="min-w-0">
                    <b>{it.title}</b>
                    <small>{STEP_LABEL[it.step]}{it.note ? ` · ${it.note}` : ""}</small>
                  </span>
                  <span className="state" data-s={it.state}>{STATE_LABEL[it.state]}</span>
                </button>
              </div>
            );
          })}
        </div>
      </aside>
      {open && (
        <div className="fs fs-view" onClick={() => setOpen(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate font-black">{KIND_ICON[open.kind]} {open.title} <span className="text-xs font-bold text-muted">· {STATE_LABEL[open.state]}</span></p>
              {open.kind === "text" && <button type="button" className="fs-tool" onClick={() => navigator.clipboard?.writeText(open.text ?? "").catch(() => null)}>انسخ</button>}
              {open.url && open.kind !== "text" && <a className="fs-tool" href={open.url} download target="_blank" rel="noopener">⬇️ حمّل</a>}
              <button type="button" className="fs-tool" onClick={() => setOpen(null)} aria-label="إغلاق">✕</button>
            </div>
            <div className="body">
              {open.kind === "text" && <pre dir="auto">{open.text}</pre>}
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
              {open.kind === "image" && open.url && <img src={open.url} alt={open.title} />}
              {open.kind === "video" && open.url && <video src={open.url} controls autoPlay playsInline />}
              {open.kind === "audio" && open.url && <audio src={open.url} controls autoPlay className="w-full" />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
