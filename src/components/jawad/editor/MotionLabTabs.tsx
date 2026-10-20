"use client";

// «مختبر الموشن» in TABS, like a browser's: every tab is ONE CONVERSATION of the lab (its scenario, versions, clip and
// what it is building), kept apart from the others and kept going while another tab is on show — a build in one tab
// runs on while the person talks in the next. Every conversation is kept on the server: «🗂️ المحادثات» lists the
// project's conversations to open again (in a tab of its own), rename or delete; closing a tab never loses one.

import { useEffect, useMemo, useState } from "react";
import { postJson } from "@/lib/fetch";
import { createPortal } from "react-dom";
import type { Cue } from "@/lib/editor/scene/contract";
import MotionLab, { type LabSource } from "./MotionLab";
import { NEW_TITLE, readTabs, storeOf, tabsKey, type Tab } from "./lab-tabs";
import type { FootageSource } from "./lab-footage";
import type { EditorAsset } from "./types";

/** What the editor asks the lab to open on (an idea, a clip, or a film of the timeline to work on again). */
export interface LabOpen {
  brief: string;
  seconds?: number;
  clipId?: string | null;
  source?: { assetId: string; source: LabSource; params?: Record<string, string>; auto?: boolean } | null;
}

interface OpenTab extends Tab {
  /** what the tab was opened on (kept in memory only: a tab opened again from the device restores its own work) */
  open?: LabOpen;
}
interface Status {
  busy: boolean;
  label: string;
  work: boolean;
}

const newId = () => Math.random().toString(36).slice(2, 8);
const hasOpen = (o: LabOpen | null | undefined) => Boolean(o && (o.brief || o.clipId || o.source));

export default function MotionLabTabs({
  projectId,
  width,
  height,
  assets,
  lab,
  footageClips,
  onUpload,
  onFilm,
  onClose,
  minimized,
  onMinimize,
}: {
  projectId: string;
  width: number;
  height: number;
  assets: EditorAsset[];
  lab: LabOpen;
  footageClips?: FootageSource[];
  onUpload?: (file: File, onProgress?: (p: number) => void) => Promise<EditorAsset>;
  onFilm: (film: File, cues: Cue[], music: { prompt: string; ms: number } | null, place?: { at: number; muteClipIds: string[] }, lab?: { source: LabSource; replaceAssetId: string | null }) => void;
  onClose: () => void;
  minimized: boolean;
  onMinimize: (v: boolean) => void;
}) {
  // the tabs the person left (or the first one); an opening with something in it (an idea, a clip, a film to work on
  // again) goes into a tab of its own, so what is already there is never written over
  const [state, setState] = useState<{ tabs: OpenTab[]; active: string }>(() => {
    const saved = typeof window === "undefined" ? null : readTabs(projectId);
    if (saved) {
      if (!hasOpen(lab)) return saved;
      const t: OpenTab = { id: newId(), title: NEW_TITLE, open: lab };
      return { tabs: [...saved.tabs, t], active: t.id };
    }
    return { tabs: [{ id: "main", title: NEW_TITLE, open: hasOpen(lab) ? lab : undefined }], active: "main" };
  });
  const [status, setStatus] = useState<Record<string, Status>>({});
  const { tabs, active } = state;

  // the editor opened the lab again on something while it was already open: a tab of its own for it
  const [seen, setSeen] = useState(lab);
  if (seen !== lab) {
    setSeen(lab);
    if (hasOpen(lab)) {
      const t: OpenTab = { id: newId(), title: NEW_TITLE, open: lab };
      setState((s) => ({ tabs: [...s.tabs, t], active: t.id }));
    }
  }

  // the tabs are kept on the device (their work is kept by each tab itself)
  useEffect(() => {
    try {
      localStorage.setItem(tabsKey(projectId), JSON.stringify({ tabs: tabs.map(({ id, title, chatId }) => ({ id, title, chatId: chatId ?? null })), active }));
    } catch {
      /* not kept */
    }
  }, [projectId, tabs, active]);

  // one stable callback pair per tab (a tab runs an effect on them), made again only when the set of tabs changes
  const ids = tabs.map((t) => t.id).join(",");
  const hooks = useMemo(
    () =>
      Object.fromEntries(
        ids.split(",").map((id) => [
          id,
          {
            status: (s: Status) => setStatus((all) => (all[id] && all[id].busy === s.busy && all[id].label === s.label && all[id].work === s.work ? all : { ...all, [id]: s })),
            title: (t: string) => setState((st) => (st.tabs.some((x) => x.id === id && x.title !== (t || NEW_TITLE)) ? { ...st, tabs: st.tabs.map((x) => (x.id === id ? { ...x, title: t || NEW_TITLE } : x)) } : st)),
            chat: (chatId: string) => setState((st) => (st.tabs.some((x) => x.id === id && x.chatId !== chatId) ? { ...st, tabs: st.tabs.map((x) => (x.id === id ? { ...x, chatId } : x)) } : st)),
          },
        ]),
      ),
    [ids],
  );

  const add = () => {
    const t: OpenTab = { id: newId(), title: NEW_TITLE };
    setState((s) => ({ tabs: [...s.tabs, t], active: t.id }));
  };

  // «🗂️ المحادثات»: the project's conversations on the server (opened again in a tab of their own)
  const [listOpen, setListOpen] = useState(false);
  const [list, setList] = useState<{ id: string; title: string; updated_at: string }[] | null>(null);
  const [listNote, setListNote] = useState("");
  const call = <T,>(body: Record<string, unknown>) => postJson<T>(`/api/jawad/editor/projects/${projectId}`, body);
  const loadList = async () => {
    setListNote("");
    try {
      const r = await call<{ chats: { id: string; title: string; updated_at: string }[]; missing: boolean }>({ action: "lab_chats" });
      setList(r.chats);
      if (r.missing) setListNote("المحادثات تنحفظ على هالجهاز بس لين يتحدّث الموقع (ملف 0087).");
    } catch (e) {
      setListNote(e instanceof Error ? e.message : String(e));
    }
  };
  const openChat = (c: { id: string; title: string }) => {
    const there = tabs.find((t) => t.chatId === c.id);
    if (there) setState((s) => ({ ...s, active: there.id }));
    else {
      const t: OpenTab = { id: newId(), title: c.title || NEW_TITLE, chatId: c.id };
      setState((s) => ({ tabs: [...s.tabs, t], active: t.id }));
    }
    setListOpen(false);
  };
  const renameChat = async (c: { id: string; title: string }) => {
    const title = window.prompt("اسم المحادثة", c.title)?.trim();
    if (!title) return;
    await call({ action: "lab_chat_rename", id: c.id, title }).catch((e: unknown) => setListNote(e instanceof Error ? e.message : String(e)));
    setState((s) => ({ ...s, tabs: s.tabs.map((t) => (t.chatId === c.id ? { ...t, title } : t)) }));
    void loadList();
  };
  const deleteChat = async (c: { id: string; title: string }) => {
    if (!window.confirm(`تحذف «${c.title || NEW_TITLE}» نهائيًا؟`)) return;
    await call({ action: "lab_chat_del", id: c.id }).catch((e: unknown) => setListNote(e instanceof Error ? e.message : String(e)));
    const open = tabs.find((t) => t.chatId === c.id);
    if (open) drop(open.id, false);
    void loadList();
  };

  /** A tab is closed (its conversation stays on the server, in «🗂️ المحادثات»; one never kept there is lost — asked first). */
  const drop = (id: string, ask = true) => {
    const st = status[id];
    const kept = Boolean(tabs.find((t) => t.id === id)?.chatId);
    if (ask && st && (st.busy || (st.work && !kept)) && !window.confirm(st.busy ? "هذا التبويب يشتغل الحين. تسكّره وتوقف شغله؟" : "هذا التبويب فيه شغل ما انحفظ على الخادم. تسكّره وتحذفه؟")) return;
    try {
      localStorage.removeItem(`jw-lab-${storeOf(projectId, id)}`);
      localStorage.removeItem(`jw-lab-part-${storeOf(projectId, id)}`);
    } catch {
      /* not kept */
    }
    setStatus((all) => Object.fromEntries(Object.entries(all).filter(([k]) => k !== id)));
    const rest = tabs.filter((t) => t.id !== id);
    if (!rest.length) {
      try {
        localStorage.removeItem(tabsKey(projectId));
      } catch {
        /* not kept */
      }
      onClose();
      return;
    }
    setState({ tabs: rest, active: active === id ? rest[Math.max(0, tabs.findIndex((t) => t.id === id) - 1)].id : active });
  };

  // a finished film of a tab goes to the timeline and the tab is done; the lab folds when other tabs still have work
  const filmOf = (id: string) => (...args: Parameters<typeof onFilm>) => {
    onFilm(...args);
    if (tabs.length > 1) {
      drop(id, false);
      onMinimize(true);
    } else onClose();
  };

  const busyTabs = tabs.filter((t) => status[t.id]?.busy);
  const shown = busyTabs.find((t) => t.id === active) ?? busyTabs[0];

  const strip = (
    <div className="mlab-tabs" role="tablist" aria-label="تبويبات المختبر">
      {tabs.map((t) => {
        const st = status[t.id];
        return (
          <div key={t.id} className="mlab-tab" data-on={t.id === active} data-busy={Boolean(st?.busy)}>
            <button type="button" role="tab" aria-selected={t.id === active} className="mlab-tab-main" onClick={() => setState((s) => ({ ...s, active: t.id }))} title={t.title}>
              {st?.busy ? <span className="jw-spinner !h-3 !w-3" aria-hidden /> : <span aria-hidden>{st?.work ? "●" : "○"}</span>}
              <span className="mlab-tab-name">{t.title}</span>
              {st?.busy && <span className="mlab-tab-state">{st.label}</span>}
            </button>
            <button type="button" className="mlab-tab-x" onClick={() => drop(t.id)} aria-label={`سكّر تبويب ${t.title}`} title="سكّر التبويب">
              ×
            </button>
          </div>
        );
      })}
      <button type="button" className="mlab-tab-new" onClick={add} aria-label="محادثة موشن جديدة" title="محادثة جديدة: شغل كامل بروحه">
        ＋
      </button>
      <button type="button" className="mlab-tab-new" aria-expanded={listOpen} onClick={() => (setListOpen((v) => !v), void loadList())} aria-label="المحادثات" title="محادثات المختبر في هالمشروع">
        🗂️
      </button>
      {listOpen && (
        <div className="mlab-chats" role="dialog" aria-label="محادثات المختبر">
          <div className="flex items-center justify-between gap-2">
            <b>🗂️ محادثات المختبر</b>
            <button type="button" className="jw-btn !min-h-9" onClick={() => setListOpen(false)}>
              ×
            </button>
          </div>
          {listNote && <p className="mlab-tip m-0">{listNote}</p>}
          {!list ? (
            <p className="mlab-tip m-0">…</p>
          ) : !list.length ? (
            <p className="mlab-tip m-0">ما فيه محادثات محفوظة بعد. اكتب لحيدرة وتنحفظ بروحها.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {list.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <button type="button" className="jw-btn !min-h-10 flex-1 !justify-start truncate" onClick={() => openChat(c)} title={c.title}>
                    {tabs.some((t) => t.chatId === c.id) ? "● " : ""}
                    {c.title || NEW_TITLE} <span className="mlab-tip">· {new Date(c.updated_at).toLocaleDateString("ar")}</span>
                  </button>
                  <button type="button" className="jw-btn !min-h-10 !px-2" onClick={() => void renameChat(c)} aria-label="غيّر الاسم" title="غيّر الاسم">
                    ✏️
                  </button>
                  <button type="button" className="jw-btn !min-h-10 !px-2" onClick={() => void deleteChat(c)} aria-label="احذف" title="احذف نهائيًا">
                    🗑️
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {tabs.map((t) => (
        <MotionLab
          key={t.id}
          projectId={projectId}
          width={width}
          height={height}
          assets={assets}
          initialBrief={t.open?.brief ?? ""}
          initialSeconds={t.open?.seconds}
          initialFootage={t.open?.clipId ?? null}
          initialSource={t.open?.source ?? null}
          footageClips={footageClips}
          onUpload={onUpload}
          onFilm={filmOf(t.id)}
          onClose={onClose}
          minimized={minimized}
          onMinimize={onMinimize}
          tabId={t.id}
          active={t.id === active}
          tabBar={strip}
          onStatus={hooks[t.id].status}
          onTitle={hooks[t.id].title}
          chatId={t.chatId ?? null}
          onChatId={hooks[t.id].chat}
        />
      ))}
      {minimized && typeof document !== "undefined" &&
        createPortal(
          <button type="button" className="jw-btn jw-btn-primary jw-3d mlab-fill !min-h-12 gap-2 !rounded-full !px-4 shadow-2xl" onClick={() => onMinimize(false)} aria-label="رجّع مختبر الموشن">
            {shown ? <span className="jw-spinner" /> : <span aria-hidden>✅</span>}
            🎬 {shown ? `${shown.title}: ${status[shown.id]?.label ?? ""}${busyTabs.length > 1 ? ` (+${busyTabs.length - 1})` : ""}` : "جاهز — افتح المختبر"}
          </button>,
          document.body,
        )}
    </>
  );
}
