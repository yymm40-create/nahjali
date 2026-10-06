"use client";

import { useEffect, useRef, useState } from "react";
import { formatTime } from "@/lib/editor/model";
import { api, postJson } from "@/lib/fetch";
import Icon from "../Icon";
import { ASSET_DRAG } from "./Timeline";
import type { EditorAsset, ImportItem } from "./types";
import type { UploadItem } from "./useUploads";

const KIND_ICON = { video: "video", audio: "music", image: "image" } as const;

/** The project's media: upload from the device, bring in the person's works, tap one to put it on the timeline. */
export default function Library({
  projectId,
  assets,
  thumbs,
  uploads,
  onPick,
  onDismiss,
  onAdd,
  onImported,
  onDelete,
  readOnly,
}: {
  projectId: string;
  assets: EditorAsset[];
  thumbs: Record<string, string | null>;
  uploads: UploadItem[];
  onPick: (files: FileList) => void;
  onDismiss: (key: string) => void;
  onAdd: (a: EditorAsset) => void;
  onImported: (a: EditorAsset[]) => void;
  onDelete: (a: EditorAsset) => void;
  readOnly: boolean;
}) {
  const [tab, setTab] = useState<"files" | "works">("files");
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-jw-line p-2">
        <div className="jw-seg flex-1" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "files"} onClick={() => setTab("files")}>
            ملفات المشروع
          </button>
          <button type="button" role="tab" aria-selected={tab === "works"} onClick={() => setTab("works")}>
            من أعمالي
          </button>
        </div>
      </div>

      {tab === "files" ? (
        <div className="jw-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-2">
          {!readOnly && (
            <>
              <input
                ref={input}
                type="file"
                multiple
                accept="video/mp4,video/quicktime,video/webm,audio/*,image/png,image/jpeg,image/webp,.mov,.m4a,.flac,.ogg,.aac"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) onPick(e.target.files);
                  e.target.value = "";
                }}
              />
              <button type="button" className="jw-btn jw-btn-primary w-full" onClick={() => input.current?.click()}>
                <Icon name="upload" size={16} /> ارفع من جهازك
              </button>
              <p className="text-center text-[11px] text-jw-faint">فيديو أو صوت أو صور، أكثر من ملف مرة وحدة. كل ملف ينزل في التايملاين بعد رفعه.</p>
            </>
          )}

          {uploads.map((u) => (
            <div key={u.key} className={`rounded-lg border p-2 text-xs ${u.error ? "border-jw-danger/50 bg-jw-danger/10" : "border-jw-line bg-jw-surface-2"}`}>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate" dir="auto">{u.name}</span>
                {(u.error || u.note) && (
                  <button type="button" className="text-jw-muted hover:text-jw-ink" onClick={() => onDismiss(u.key)} aria-label="إخفاء">
                    <Icon name="x" size={14} />
                  </button>
                )}
              </div>
              {u.error ? (
                <p className="mt-1 text-jw-danger">{u.error}</p>
              ) : u.note ? (
                <p className="mt-1 text-jw-warn">{u.note}</p>
              ) : (
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-jw-surface-3">
                  <div className="h-full bg-jw-accent transition-[width]" style={{ width: `${Math.max(4, u.progress * 100)}%` }} />
                </div>
              )}
            </div>
          ))}

          {assets.length ? (
            <ul className="grid grid-cols-3 gap-2 lg:grid-cols-2">
              {assets.map((a) => (
                <li key={a.id} className="group relative">
                  <button
                    type="button"
                    disabled={readOnly || a.status !== "ready"}
                    className="block w-full overflow-hidden rounded-lg border border-jw-line bg-jw-surface-2 text-start transition hover:border-jw-accent disabled:opacity-50"
                    onClick={() => onAdd(a)}
                    draggable={!readOnly && a.status === "ready"}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(ASSET_DRAG, a.id);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    title="أضفه للتايملاين عند مؤشر الوقت، أو اسحبه للمكان اللي تبيه"
                  >
                    <span className="relative block aspect-video bg-black/40">
                      {thumbs[a.id] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumbs[a.id]!} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="grid h-full place-items-center text-jw-faint">
                          <Icon name={KIND_ICON[a.kind]} size={22} />
                        </span>
                      )}
                      {a.durationMs != null && <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[10px] text-white" dir="ltr">{formatTime(a.durationMs, false)}</span>}
                      {a.status !== "ready" && <span className="absolute inset-0 grid place-items-center bg-black/60 text-[10px] text-jw-danger">انحذف</span>}
                      {!readOnly && a.status === "ready" && (
                        <span className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-jw-accent text-jw-on-accent opacity-90">
                          <Icon name="plus" size={12} strokeWidth={2.5} />
                        </span>
                      )}
                    </span>
                    <span className="block truncate px-1.5 py-1 text-[11px]" dir="auto">{a.name || "ملف"}</span>
                  </button>
                  {!readOnly && (
                    <button
                      type="button"
                      className="absolute left-1 top-1 hidden h-5 w-5 place-items-center rounded-full bg-black/70 text-white group-hover:grid"
                      onClick={() => onDelete(a)}
                      aria-label="احذف من المكتبة"
                      title="احذف من المكتبة"
                    >
                      <Icon name="trash" size={11} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            !uploads.length && <p className="py-6 text-center text-xs text-jw-faint">ما فيه ملفات بعد.</p>
          )}
        </div>
      ) : (
        <Works projectId={projectId} onImported={onImported} readOnly={readOnly} />
      )}
    </div>
  );
}

/** The person's works from JAWAD AI and the film maker, to bring in (the files stay where they are). */
function Works({ projectId, onImported, readOnly }: { projectId: string; onImported: (a: EditorAsset[]) => void; readOnly: boolean }) {
  const [items, setItems] = useState<ImportItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    api<{ items: ImportItem[] }>("/api/jawad/editor/importables")
      .then((r) => live && setItems(r.items))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, []);

  const bring = async () => {
    if (!items) return;
    setBusy(true);
    setError(null);
    try {
      const chosen = picked.map((k) => items.find((i) => `${i.source}:${i.id}` === k)!).filter(Boolean);
      const r = await postJson<{ assets: EditorAsset[] }>(`/api/jawad/editor/projects/${projectId}`, {
        action: "import",
        items: chosen.map((i) => ({ source: i.source, id: i.id, durationMs: i.durationMs, width: i.width, height: i.height, name: i.name })),
      });
      setPicked([]);
      onImported(r.assets);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر.");
    } finally {
      setBusy(false);
    }
  };

  if (error && !items) return <p className="p-3 text-xs text-jw-danger">{error}</p>;
  if (!items) return <div className="grid flex-1 place-items-center"><span className="jw-spinner" /></div>;
  if (!items.length) return <p className="p-4 text-center text-xs text-jw-faint">ما عندك أعمال بعد في «الجواد الذكي!» أو صانع الفيلم.</p>;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="jw-scroll grid min-h-0 flex-1 grid-cols-3 content-start gap-2 overflow-y-auto p-2 lg:grid-cols-2">
        {items.map((i) => {
          const k = `${i.source}:${i.id}`;
          const on = picked.includes(k);
          return (
            <li key={k}>
              <button
                type="button"
                disabled={readOnly}
                aria-pressed={on}
                onClick={() => setPicked((p) => (on ? p.filter((x) => x !== k) : [...p, k]))}
                className={`block w-full overflow-hidden rounded-lg border text-start ${on ? "border-jw-accent ring-2 ring-jw-accent" : "border-jw-line"}`}
              >
                <span className="relative block aspect-video bg-black/40">
                  {i.url && i.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.url} alt="" className="h-full w-full object-cover" />
                  ) : i.url && i.kind === "video" ? (
                    <video src={`${i.url}#t=0.5`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                  ) : (
                    <span className="grid h-full place-items-center text-jw-faint">
                      <Icon name={KIND_ICON[i.kind]} size={22} />
                    </span>
                  )}
                  {on && (
                    <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-jw-accent text-jw-on-accent">
                      <Icon name="check" size={12} strokeWidth={2.5} />
                    </span>
                  )}
                </span>
                <span className="block truncate px-1.5 py-1 text-[11px]">{i.source === "film" ? "🎬 " : ""}{i.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-jw-line p-2">
        {error && <p className="mb-1 text-xs text-jw-danger">{error}</p>}
        <button type="button" className="jw-btn jw-btn-primary w-full" disabled={!picked.length || busy || readOnly} onClick={bring}>
          {busy ? <span className="jw-spinner" /> : <Icon name="plus" size={16} />} أضف {picked.length ? `(${picked.length})` : ""} للمكتبة
        </button>
      </div>
    </div>
  );
}
