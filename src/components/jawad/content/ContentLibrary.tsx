"use client";

// «📚 المكتبة» of a content project: every picture, slide and video already in its conversation (read from the messages,
// nothing is fetched), grouped by stage, in a drawer on the side like the film maker's library. A tap opens it big, with
// its download link. Read-only.

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

interface LibSlide { n: number; fileId: string; name: string; text: string; url: string | null; download: string | null; videoUrl?: string | null; videoDownload?: string | null }
interface LibMedia { id: string; kind: "image" | "video"; name: string; state: string; url?: string | null; download?: string | null }
interface LibMsg { thread?: "design"; error?: boolean; slides?: { items: LibSlide[]; phase?: "pictures" | "approve"; approved?: boolean }; media?: { items: LibMedia[] } }

export type LibGroup = "pictures" | "design" | "media";
export interface LibItem { key: string; group: LibGroup; title: string; image: string | null; video: string | null; download: string | null; file: string }

export const LIB_GROUPS: { key: LibGroup; label: string }[] = [
  { key: "pictures", label: "🖼️ الصور" },
  { key: "design", label: "✍️ الكتابة والموشن" },
  { key: "media", label: "🎨 وسائط" },
];

/** What the conversation already holds: its slides (pictures before the writing, made slides after) and جواد's media. */
export function libraryOf(msgs: LibMsg[]): LibItem[] {
  const twoChats = msgs.some((m) => m.thread === "design");
  const out: LibItem[] = [];
  const seen = new Set<string>();
  for (const m of msgs) {
    if (m.error) continue;
    if (m.slides) {
      const s = m.slides;
      const group: LibGroup = m.thread === "design" ? "design" : twoChats || s.phase || s.approved ? "pictures" : "design";
      for (const it of s.items) {
        const id = it.videoUrl ?? it.url;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const video = it.videoUrl ?? null;
        out.push({ key: `${group}-${it.fileId}-${it.n}`, group, title: `الشريحة ${it.n}`, image: it.url, video, download: video ? (it.videoDownload ?? null) : it.download, file: `${it.name}.${video ? "mp4" : "png"}` });
      }
    }
    for (const x of m.media?.items ?? []) {
      if (x.state !== "done" || !x.url || seen.has(x.url)) continue;
      seen.add(x.url);
      out.push({ key: `media-${x.id}`, group: "media", title: x.name, image: x.kind === "image" ? x.url : null, video: x.kind === "video" ? x.url : null, download: x.download ?? null, file: x.name });
    }
  }
  return out;
}

export default function ContentLibrary({ msgs, onClose }: { msgs: LibMsg[]; onClose: () => void }) {
  const items = useMemo(() => libraryOf(msgs), [msgs]);
  const [open, setOpen] = useState<LibItem | null>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && (open ? setOpen(null) : onClose());
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="ct-drawer-wrap" onClick={onClose}>
      <aside className="ct-drawer" role="dialog" aria-modal="true" aria-label="المكتبة" onClick={(e) => e.stopPropagation()}>
        <header className="ct-drawer-head">
          <span className="ic" aria-hidden>📚</span>
          <div>
            <b>المكتبة</b>
            <small>كل صورة وشريحة وفيديو انصنع في هذا المشروع ({items.length.toLocaleString("ar")})</small>
          </div>
          <button type="button" className="ct-tool" onClick={onClose} aria-label="سكّر">✕</button>
        </header>
        <div className="ct-drawer-body">
          {!items.length && <p className="ct-lib-empty">ما فيه شي هنا بعد. أول ما تنرسم الصور أو الشرائح تلقاها هنا.</p>}
          {LIB_GROUPS.map((g) => {
            const list = items.filter((x) => x.group === g.key);
            if (!list.length) return null;
            return (
              <section key={g.key} className="ct-lib-group">
                <h4>{g.label} <small>{list.length.toLocaleString("ar")}</small></h4>
                <div className="ct-lib-grid">
                  {list.map((x) => (
                    <button key={x.key} type="button" className="ct-lib-item" onClick={() => setOpen(x)} aria-label={`افتح ${x.title}`}>
                      {x.image ? <img src={x.image} alt="" loading="lazy" /> : x.video ? <video src={`${x.video}#t=0.5`} muted playsInline preload="metadata" /> : <span aria-hidden>🎨</span>}
                      {x.video && <span className="play" aria-hidden>▶</span>}
                      <small>{x.title}</small>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </aside>
      {open && (
        <div className="ct-viewer" role="dialog" aria-modal="true" aria-label={open.title} onClick={(e) => { e.stopPropagation(); setOpen(null); }}>
          <div onClick={(e) => e.stopPropagation()}>
            <div className="ct-viewer-head">
              <b>{open.title}</b>
              {open.download && <a className="ct-tool" href={open.download} download={open.file}>⬇️ حمّل</a>}
              <button type="button" className="ct-tool" onClick={() => setOpen(null)} aria-label="سكّر">✕</button>
            </div>
            {open.video ? <video src={open.video} poster={open.image ?? undefined} controls autoPlay playsInline /> : open.image && <img src={open.image} alt={open.title} />}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
