"use client";

// «مختبر الموشن» in TABS, like a browser's: every tab is a whole lab of its own (its idea, plan, scene, conversation, clip
// and what it is building), kept apart from the others and kept going while another tab is on show — a build in one
// tab runs on while the person plans in the next. The lab's old single piece of work is the first tab.

import { useEffect, useMemo, useState } from "react";
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
      localStorage.setItem(tabsKey(projectId), JSON.stringify({ tabs: tabs.map(({ id, title }) => ({ id, title })), active }));
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
          },
        ]),
      ),
    [ids],
  );

  const add = () => {
    const t: OpenTab = { id: newId(), title: NEW_TITLE };
    setState((s) => ({ tabs: [...s.tabs, t], active: t.id }));
  };

  /** A tab is closed for good: its work goes with it (asked first when it is working or has something made). */
  const drop = (id: string, ask = true) => {
    const st = status[id];
    if (ask && st && (st.busy || st.work) && !window.confirm(st.busy ? "هذا التبويب يشتغل الحين. تسكّره وتوقف شغله؟" : "هذا التبويب فيه شغل محفوظ. تسكّره وتحذفه؟")) return;
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
      <button type="button" className="mlab-tab-new" onClick={add} aria-label="تبويب موشن جديد" title="تبويب جديد: شغل كامل بروحه">
        ＋
      </button>
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
