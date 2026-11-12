"use client";

// «ترتيب أعمالي»: the bar above the works (search, sort, ⭐ المفضلة, folders) and the ⭐ / folder buttons on each work.
// Folders and favourites need migration 0113; until it runs they hide behind a one-line note and the search and sort
// still work. The works list itself lives in Studio (the server lists by the view; the panel filters what it has).

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { FOLDER_NAME_MAX, SEARCH_MAX, type WorkFolder, type WorkMark, type WorksView } from "@/lib/jawad/works-organise";
import type { WorkItem } from "@/lib/jawad/labels";
import { track } from "@/lib/feature-track";
import Dialog from "../Dialog";
import Icon from "../Icon";

type Post = { ok: boolean; body: { error?: string; folder?: WorkFolder; mark?: WorkMark } };
async function post(data: unknown): Promise<Post> {
  try {
    const res = await fetch("/api/jawad/works/organise", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    return { ok: res.ok, body: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, body: { error: "انقطع الاتصال، جرّب مرة ثانية." } };
  }
}

export interface Organise {
  /** null: not known yet; false: migration 0113 hasn't run (folders and ⭐ hidden) */
  ready: boolean | null;
  folders: WorkFolder[];
  favourites: number;
  error: string;
  setError: (e: string) => void;
  createFolder: (name: string) => Promise<WorkFolder | null>;
  renameFolder: (id: string, name: string) => Promise<boolean>;
  deleteFolder: (id: string) => Promise<boolean>;
  /** sets a work's folder and/or ⭐; the list is told through `onMarked` */
  mark: (it: WorkItem, patch: Partial<WorkMark>) => Promise<boolean>;
  /** «نقل لمجلد» is open for this work */
  moving: WorkItem | null;
  setMoving: (it: WorkItem | null) => void;
}

const OrganiseContext = createContext<Organise | null>(null);
export const OrganiseProvider = OrganiseContext.Provider;
export const useOrganise = () => useContext(OrganiseContext);

/** The folders and ⭐ of the person's works (asked once the panel shows their works). */
export function useOrganiseState(enabled: boolean, onMarked: (type: WorkItem["type"], id: string, mark: Partial<WorkMark>) => void): Organise {
  const [ready, setReady] = useState<boolean | null>(null);
  const [folders, setFolders] = useState<WorkFolder[]>([]);
  const [favourites, setFavourites] = useState(0);
  const [error, setError] = useState("");
  const [moving, setMoving] = useState<WorkItem | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    fetch("/api/jawad/works/organise", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { ready: boolean; folders: WorkFolder[]; favourites: number } | null) => {
        if (!live) return;
        setReady(Boolean(b?.ready));
        setFolders(b?.folders ?? []);
        setFavourites(b?.favourites ?? 0);
      })
      .catch(() => live && setReady(false));
    return () => {
      live = false;
    };
  }, [enabled]);

  const createFolder = useCallback(async (name: string) => {
    track("studio.works_folder");
    const r = await post({ action: "folder_create", name });
    if (!r.ok || !r.body.folder) return setError(r.body.error ?? "تعذّر إنشاء المجلد."), null;
    setError("");
    setFolders((cur) => [...cur, r.body.folder!]);
    return r.body.folder;
  }, []);
  const renameFolder = useCallback(async (id: string, name: string) => {
    const r = await post({ action: "folder_rename", id, name });
    if (!r.ok) return setError(r.body.error ?? "تعذّر تغيير الاسم."), false;
    setError("");
    setFolders((cur) => cur.map((f) => (f.id === id ? { ...f, name: name.replace(/\s+/g, " ").trim() } : f)));
    return true;
  }, []);
  const deleteFolder = useCallback(async (id: string) => {
    const r = await post({ action: "folder_delete", id });
    if (!r.ok) return setError(r.body.error ?? "تعذّر حذف المجلد."), false;
    setError("");
    setFolders((cur) => cur.filter((f) => f.id !== id));
    return true;
  }, []);
  const mark = useCallback(
    async (it: WorkItem, patch: Partial<WorkMark>) => {
      track(patch.favourite !== undefined ? "studio.works_favourite" : "studio.works_folder");
      const before: WorkMark = { folderId: it.folderId ?? null, favourite: Boolean(it.favourite) };
      // shown at once; put back if the server refuses
      onMarked(it.type, it.id, patch);
      const r = await post({ action: "mark", type: it.type, id: it.id, ...patch });
      if (!r.ok || !r.body.mark) {
        onMarked(it.type, it.id, before);
        setError(r.body.error ?? "تعذّر الحفظ.");
        return false;
      }
      const now = r.body.mark;
      setError("");
      onMarked(it.type, it.id, now);
      if (before.folderId !== now.folderId) setFolders((cur) => cur.map((f) => ({ ...f, count: f.count + (f.id === now.folderId ? 1 : 0) - (f.id === before.folderId ? 1 : 0) })));
      if (before.favourite !== now.favourite) setFavourites((n) => Math.max(0, n + (now.favourite ? 1 : -1)));
      return true;
    },
    [onMarked],
  );
  return { ready, folders, favourites, error, setError, createFolder, renameFolder, deleteFolder, mark, moving, setMoving };
}

/** The bar under «أعمالي»: search, newest/oldest, ⭐ المفضلة, and the folders (open one, make one, manage them). */
export function WorksToolbar({ view, onView, o, onFolderDeleted }: { view: WorksView; onView: (v: WorksView) => void; o: Organise; onFolderDeleted: (id: string) => void }) {
  const [text, setText] = useState(view.q);
  const [manage, setManage] = useState(false);
  // the search goes to the server a moment after typing stops (the list already filters what it has meanwhile)
  useEffect(() => {
    if (text.trim() === view.q.trim()) return;
    const t = setTimeout(() => {
      if (text.trim()) track("studio.works_search");
      onView({ ...view, q: text.trim().slice(0, SEARCH_MAX) });
    }, 350);
    return () => clearTimeout(t);
  }, [text, view, onView]);

  const active = view.folder ? o.folders.find((f) => f.id === view.folder) : null;
  return (
    <div className="space-y-2 border-b border-jw-line px-4 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[10rem] flex-1">
          <span className="sr-only">ابحث في أعمالك</span>
          <Icon name="search" size={14} className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-jw-faint" />
          <input
            type="search"
            value={text}
            maxLength={SEARCH_MAX}
            onChange={(e) => setText(e.target.value)}
            placeholder="ابحث بكلمة من البرومبت أو اسم المولّد"
            className="jw-input !min-h-8 w-full !py-1 !ps-8 text-xs"
          />
        </label>
        <div className="jw-seg" role="radiogroup" aria-label="الترتيب">
          {(["new", "old"] as const).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={view.sort === s} onClick={() => view.sort !== s && onView({ ...view, sort: s })} className="!min-h-8 !px-2.5 !text-xs">
              {s === "new" ? "الأحدث" : "الأقدم"}
            </button>
          ))}
        </div>
      </div>
      {o.ready === false ? (
        <p className="text-[11px] text-jw-faint">المجلدات و⭐ المفضلة تتفعّل قريب؛ البحث والترتيب شغّالين الحين.</p>
      ) : o.ready ? (
        <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5" role="group" aria-label="المجلدات والمفضلة">
          <button type="button" className={`jw-chip shrink-0 !px-2.5 !py-1 !text-xs ${!view.folder && !view.fav ? "!border-jw-accent !text-jw-ink" : ""}`} aria-pressed={!view.folder && !view.fav} onClick={() => onView({ ...view, folder: null, fav: false })}>
            كل الأعمال
          </button>
          <button
            type="button"
            className={`jw-chip shrink-0 !px-2.5 !py-1 !text-xs ${view.fav ? "!border-jw-accent !text-jw-ink" : ""}`}
            aria-pressed={view.fav}
            onClick={() => {
              if (!view.fav) track("studio.works_favourite");
              onView({ ...view, fav: !view.fav });
            }}
          >
            ⭐ المفضلة{o.favourites ? <span className="text-jw-faint" dir="ltr"> {o.favourites}</span> : null}
          </button>
          {o.folders.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`jw-chip shrink-0 !px-2.5 !py-1 !text-xs ${view.folder === f.id ? "!border-jw-accent !text-jw-ink" : ""}`}
              aria-pressed={view.folder === f.id}
              onClick={() => {
                if (view.folder !== f.id) track("studio.works_folder");
                onView({ ...view, folder: view.folder === f.id ? null : f.id });
              }}
            >
              <Icon name="folder" size={12} /> <bdi>{f.name}</bdi>
              <span className="text-jw-faint" dir="ltr">{f.count}</span>
            </button>
          ))}
          <button type="button" className="jw-chip shrink-0 !px-2.5 !py-1 !text-xs" onClick={() => setManage(true)}>
            <Icon name={o.folders.length ? "settings" : "plus"} size={12} /> {o.folders.length ? "المجلدات" : "مجلد جديد"}
          </button>
        </div>
      ) : null}
      {(active || view.fav || view.q) && (
        <p className="text-[11px] text-jw-muted" role="status">
          تعرض {view.fav ? "⭐ المفضلة" : ""}
          {view.fav && active ? " في " : ""}
          {active ? <>مجلد «<bdi>{active.name}</bdi>»</> : ""}
          {view.q ? <>{active || view.fav ? " · " : ""}نتائج «<bdi>{view.q}</bdi>»</> : ""} — أي توليد جديد يظهر فوق لين يخلص.
        </p>
      )}
      {o.error && (
        <p className="flex items-center gap-1.5 text-[11px] text-jw-danger" role="alert">
          <Icon name="alert" size={12} /> {o.error}
          <button type="button" className="ms-auto" onClick={() => o.setError("")} aria-label="إخفاء"><Icon name="x" size={11} /></button>
        </p>
      )}
      <FoldersDialog
        open={manage}
        onClose={() => setManage(false)}
        o={o}
        onDeleted={(id) => {
          if (view.folder === id) onView({ ...view, folder: null });
          onFolderDeleted(id);
        }}
      />
    </div>
  );
}

/** Make, rename and delete folders (a deleted folder's works stay in «أعمالي», out of any folder). */
function FoldersDialog({ open, onClose, o, onDeleted }: { open: boolean; onClose: () => void; o: Organise; onDeleted: (id: string) => void }) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [sure, setSure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    await fn();
    setBusy(false);
  };
  return (
    <Dialog open={open} onClose={onClose} title="المجلدات">
      {open && (
        <div className="space-y-3 p-4">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) void run(async () => (await o.createFolder(name)) && setName(""));
            }}
          >
            <input className="jw-input min-w-0 flex-1 text-sm" value={name} maxLength={FOLDER_NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder="اسم مجلد جديد (مثلًا: إعلان العيد)" aria-label="اسم المجلد الجديد" />
            <button type="submit" className="jw-btn jw-btn-primary shrink-0" disabled={busy || !name.trim()}>
              <Icon name="plus" size={14} /> أنشئ
            </button>
          </form>
          {o.error && <p className="text-xs text-jw-danger" role="alert">{o.error}</p>}
          {o.folders.length === 0 ? (
            <p className="text-sm text-jw-muted">ما عندك مجلدات بعد. سوّ واحد، وبعدين من زر <Icon name="folder" size={12} className="inline" /> على أي عمل انقله له.</p>
          ) : (
            <ul className="divide-y divide-jw-line rounded-lg border border-jw-line">
              {o.folders.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  {editing?.id === f.id ? (
                    <form
                      className="flex min-w-0 flex-1 gap-1.5"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void run(async () => (await o.renameFolder(f.id, editing.name)) && setEditing(null));
                      }}
                    >
                      <input className="jw-input min-w-0 flex-1 !min-h-8 text-sm" value={editing.name} maxLength={FOLDER_NAME_MAX} onChange={(e) => setEditing({ id: f.id, name: e.target.value })} aria-label="الاسم الجديد" autoFocus />
                      <button type="submit" className="jw-btn !min-h-8 !px-2 text-xs" disabled={busy}><Icon name="check" size={14} /> احفظ</button>
                      <button type="button" className="jw-btn jw-btn-quiet !min-h-8 !px-2 text-xs" onClick={() => setEditing(null)}>إلغاء</button>
                    </form>
                  ) : (
                    <>
                      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
                        <Icon name="folder" size={14} className="text-jw-accent" /> <bdi className="truncate">{f.name}</bdi>
                        <span className="text-xs text-jw-faint">({f.count})</span>
                      </span>
                      {sure === f.id ? (
                        <>
                          <span className="text-[11px] text-jw-muted">أعماله تبقى في «أعمالي».</span>
                          <button type="button" className="jw-btn !min-h-8 !px-2 text-xs text-jw-danger" disabled={busy} onClick={() => void run(async () => (await o.deleteFolder(f.id)) && (setSure(null), onDeleted(f.id)))}>
                            احذفه
                          </button>
                          <button type="button" className="jw-btn jw-btn-quiet !min-h-8 !px-2 text-xs" onClick={() => setSure(null)}>لا</button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="jw-btn jw-btn-quiet !min-h-8 !px-2 text-xs" onClick={() => (setSure(null), setEditing({ id: f.id, name: f.name }))}>
                            <Icon name="type" size={14} /> غيّر الاسم
                          </button>
                          <button type="button" className="jw-btn jw-btn-quiet !min-h-8 !px-2 text-xs text-jw-danger" onClick={() => (setEditing(null), setSure(f.id))}>
                            <Icon name="trash" size={14} /> حذف
                          </button>
                        </>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Dialog>
  );
}

/** ⭐ and the folder button on a work's card (nothing until folders are on, or for a work still being made here). */
export function MarkButtons({ it }: { it: WorkItem }) {
  const o = useOrganise();
  if (!o?.ready || it.id.startsWith("temp-")) return null;
  const folder = it.folderId ? o.folders.find((f) => f.id === it.folderId) : null;
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        className={`grid size-7 place-items-center rounded-md text-sm transition-colors hover:bg-jw-surface-2 ${it.favourite ? "" : "opacity-50 grayscale hover:opacity-100"}`}
        aria-pressed={Boolean(it.favourite)}
        aria-label={it.favourite ? "شيله من المفضلة" : "أضفه للمفضلة"}
        title={it.favourite ? "في المفضلة" : "أضفه للمفضلة"}
        onClick={() => void o.mark(it, { favourite: !it.favourite })}
      >
        ⭐
      </button>
      <button
        type="button"
        className={`flex h-7 max-w-[8rem] items-center gap-1 rounded-md px-1.5 text-[11px] transition-colors hover:bg-jw-surface-2 ${folder ? "text-jw-accent" : "text-jw-faint"}`}
        aria-label={folder ? `في مجلد «${folder.name}»، انقله` : "انقله لمجلد"}
        title={folder ? `في «${folder.name}»` : "انقله لمجلد"}
        onClick={() => o.setMoving(it)}
      >
        <Icon name="folder" size={13} />
        {folder && <bdi className="truncate">{folder.name}</bdi>}
      </button>
    </span>
  );
}

/** «انقله لمجلد»: one folder at most per work; «بدون مجلد» takes it out. A new folder can be made here too. */
export function MoveDialog({ items }: { items: WorkItem[] }) {
  const o = useOrganise();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  // the work as it is now in the list (its folder may have just changed)
  const it = o?.moving ? items.find((x) => x.type === o.moving!.type && x.id === o.moving!.id) ?? o.moving : null;
  if (!o) return null;
  const move = async (folderId: string | null) => {
    if (!it) return;
    setBusy(true);
    const ok = (it.folderId ?? null) === folderId ? true : await o.mark(it, { folderId });
    setBusy(false);
    if (ok) o.setMoving(null);
  };
  return (
    <Dialog open={Boolean(it)} onClose={() => o.setMoving(null)} title="انقله لمجلد">
      {it && (
        <div className="space-y-3 p-4">
          <ul className="space-y-1">
            {[{ id: null as string | null, name: "بدون مجلد", count: -1 }, ...o.folders].map((f) => {
              const on = (it.folderId ?? null) === f.id;
              return (
                <li key={f.id ?? "none"}>
                  <button type="button" disabled={busy} aria-pressed={on} onClick={() => void move(f.id)} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-start text-sm transition-colors ${on ? "border-jw-accent bg-jw-accent-soft" : "border-jw-line hover:border-jw-line-strong"}`}>
                    <Icon name={f.id ? "folder" : "x"} size={14} className={f.id ? "text-jw-accent" : "text-jw-faint"} />
                    <bdi className="min-w-0 flex-1 truncate">{f.name}</bdi>
                    {on && <Icon name="check" size={14} className="text-jw-accent" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              void (async () => {
                setBusy(true);
                const f = await o.createFolder(name);
                setBusy(false);
                if (f) {
                  setName("");
                  await move(f.id);
                }
              })();
            }}
          >
            <input className="jw-input min-w-0 flex-1 text-sm" value={name} maxLength={FOLDER_NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder="أو مجلد جديد…" aria-label="اسم مجلد جديد" />
            <button type="submit" className="jw-btn shrink-0" disabled={busy || !name.trim()}>
              <Icon name="plus" size={14} /> أنشئ وانقل
            </button>
          </form>
          {o.error && <p className="text-xs text-jw-danger" role="alert">{o.error}</p>}
        </div>
      )}
    </Dialog>
  );
}
