"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { apply, applyAll, CommandError, type Applied, type Command } from "@/lib/editor/commands";
import { clipEnd, duration, findClip, formatTime, type AssetInfo, type Timeline as TL } from "@/lib/editor/model";
import { api, postJson } from "@/lib/fetch";
import Icon from "../Icon";
import AssistantPanel from "./AssistantPanel";
import Guard from "./Guard";
import { PluginTools } from "./plugins";
import CaptionsPanel from "./CaptionsPanel";
import ExportPanel from "./ExportPanel";
import Handles from "./Handles";
import Inspector, { type InspectorTab } from "./Inspector";
import { peaksOf, waveImage } from "./peaks";
import Library from "./Library";
import { thumbnail } from "./media";
import { Player } from "./player";
import { FONTS, setFonts } from "./render";
import Timeline from "./Timeline";
import type { EditorAsset, EditorProjectView } from "./types";
import { useUploads } from "./useUploads";

type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";
interface Step {
  tl: TL;
  label: string;
}

const info = (a: EditorAsset): AssetInfo => ({ id: a.id, kind: a.kind, durationMs: a.durationMs, width: a.width, height: a.height, hasAudio: a.hasAudio });
const SAVE_DELAY = 1200;

const wideQuery = "(min-width: 1024px)";
function useWide() {
  return useSyncExternalStore(
    (fn) => {
      const m = window.matchMedia(wideQuery);
      m.addEventListener("change", fn);
      return () => m.removeEventListener("change", fn);
    },
    () => window.matchMedia(wideQuery).matches,
    () => true,
  );
}

const SAVE_TEXT: Record<SaveState, string> = { saved: "محفوظ", dirty: "تعديلات…", saving: "نحفظ…", error: "ما انحفظ، نعيد…", conflict: "تغيّر من مكان ثاني" };

export default function Editor({ project, initialAssets, exportUrl, backHref }: { project: EditorProjectView; initialAssets: EditorAsset[]; exportUrl: string | null; backHref: string }) {
  const readOnly = project.purged;
  const wide = useWide();
  const [tl, setTl] = useState(project.timeline);
  const [title, setTitle] = useState(project.title);
  const [assets, setAssets] = useState(initialAssets);
  const [hist, setHist] = useState<{ past: Step[]; future: Step[] }>({ past: [], future: [] });
  const [selected, setSelected] = useState<string[]>([]);
  const [toast, setToast] = useState<{ text: string; bad: boolean } | null>(null);
  const [save, setSave] = useState<SaveState>("saved");
  const [sheet, setSheet] = useState<null | "library" | "inspector">(null);
  const [exporting, setExporting] = useState(false);
  const [captioning, setCaptioning] = useState(false);
  const [assisting, setAssisting] = useState(false);
  const [purgeAt, setPurgeAt] = useState(project.purgeAt);
  const [thumbs, setThumbs] = useState<Record<string, string | null>>({});
  const [waves, setWaves] = useState<Record<string, string | null>>({});
  const [tab, setTab] = useState<InspectorTab>("basic");
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);

  const tlRef = useRef(tl);
  const titleRef = useRef(title);
  const labelRef = useRef("");
  const versionRef = useRef(project.version);
  const infos = useRef(new Map(initialAssets.map((a) => [a.id, info(a)])));
  const dirty = useRef(false);
  const saving = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastStep = useRef<{ key: string | null; at: number }>({ key: null, at: 0 });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flash = useCallback((text: string, bad = false) => {
    clearTimeout(toastTimer.current);
    setToast({ text, bad });
    toastTimer.current = setTimeout(() => setToast(null), bad ? 6000 : 2500);
  }, []);

  // ---------- saving: a moment after the last change, the whole timeline with its version ----------
  const flush = useMemo(() => {
    const go = async (): Promise<void> => {
      clearTimeout(timer.current);
      if (saving.current) {
        await saving.current;
        if (dirty.current) return go();
        return;
      }
      // a negative version: the server has a newer one and the person hasn't chosen yet (see «احفظ نسختي فوقها»)
      if (!dirty.current || versionRef.current <= 0) return;
      dirty.current = false;
      setSave("saving");
      const run = (async () => {
        try {
          const r = await api<{ ok: boolean; version: number }>(`/api/jawad/editor/projects/${project.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ timeline: tlRef.current, version: versionRef.current, label: labelRef.current, title: titleRef.current }),
          });
          if (r.ok) {
            versionRef.current = r.version;
            setSave(dirty.current ? "dirty" : "saved");
          } else {
            // someone (another tab) saved in between: nothing is overwritten until the person decides
            dirty.current = true;
            versionRef.current = -r.version;
            setSave("conflict");
          }
        } catch {
          dirty.current = true;
          setSave("error");
          timer.current = setTimeout(() => void go(), 5000);
        }
      })();
      saving.current = run;
      await run;
      saving.current = null;
      if (dirty.current && versionRef.current > 0) timer.current = setTimeout(() => void go(), SAVE_DELAY);
    };
    return go;
  }, [project.id]);

  const markDirty = useCallback(() => {
    dirty.current = true;
    setSave((s) => (s === "conflict" ? s : "dirty"));
    clearTimeout(timer.current);
    if (versionRef.current > 0) timer.current = setTimeout(() => void flush(), SAVE_DELAY);
  }, [flush]);

  const keepMine = () => {
    versionRef.current = Math.abs(versionRef.current);
    dirty.current = true;
    void flush();
  };

  // unsaved work is never lost silently: leaving asks, hiding the tab saves
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (dirty.current || saving.current) e.preventDefault();
    };
    const hide = () => document.visibilityState === "hidden" && dirty.current && versionRef.current > 0 && void flush();
    window.addEventListener("beforeunload", leave);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("beforeunload", leave);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [flush]);

  // ---------- every change: one command (or several as one step), with undo ----------
  const commit = useCallback(
    (next: TL, label: string) => {
      tlRef.current = next;
      labelRef.current = label;
      setTl(next);
      markDirty();
    },
    [markDirty],
  );

  const run = useCallback(
    (cmd: Command | Command[], opts: { label?: string; coalesce?: string } = {}): Applied | null => {
      if (readOnly) return null;
      const cur = tlRef.current;
      let r: Applied;
      try {
        r = Array.isArray(cmd) ? applyAll(cur, cmd, infos.current, opts.label) : apply(cur, cmd, infos.current);
      } catch (e) {
        if (e instanceof CommandError) flash(e.message, true);
        else throw e;
        return null;
      }
      const now = Date.now();
      // a slider dragged (or a word typed) makes one undo step, not hundreds
      const merge = !!opts.coalesce && lastStep.current.key === opts.coalesce && now - lastStep.current.at < 1500;
      lastStep.current = { key: opts.coalesce ?? null, at: now };
      if (!merge) setHist((h) => ({ past: [...h.past.slice(-99), { tl: cur, label: r.label }], future: [] }));
      commit(r.timeline, r.label);
      if (r.select) setSelected(r.select);
      return r;
    },
    [readOnly, commit, flash],
  );

  const undo = () => {
    const step = hist.past.at(-1);
    if (!step || readOnly) return;
    setHist({ past: hist.past.slice(0, -1), future: [{ tl: tlRef.current, label: step.label }, ...hist.future] });
    commit(step.tl, `تراجع: ${step.label}`);
    flash(`تراجعت: ${step.label}`);
  };
  const redo = () => {
    const step = hist.future[0];
    if (!step || readOnly) return;
    setHist({ past: [...hist.past, { tl: tlRef.current, label: step.label }], future: hist.future.slice(1) });
    commit(step.tl, step.label);
    flash(`أعدت: ${step.label}`);
  };

  // ---------- media ----------
  const addAssets = useCallback((list: EditorAsset[]) => {
    for (const a of list) infos.current.set(a.id, info(a));
    setAssets((xs) => [...xs.filter((x) => !list.some((a) => a.id === x.id)), ...list]);
  }, []);
  const uploads = useUploads(
    project.id,
    useCallback(
      (a: EditorAsset) => {
        addAssets([a]);
        // each uploaded file goes on the timeline: pictures after what is there, sound from the start
        run({ type: "add_clip", assetId: a.id });
      },
      [addAssets, run],
    ),
  );
  const addToTimeline = (a: EditorAsset) => {
    const r = run({ type: "add_clip", assetId: a.id, at: player?.ms ?? 0 });
    // like CapCut: the playhead moves to the end of what was added, so the next one goes after it
    const added = r?.select?.[0] ? findClip(r.timeline, r.select[0]) : null;
    if (added && a.kind !== "audio") player?.seek(clipEnd(added.clip));
    if (!wide) setSheet(null);
  };
  const removeAsset = async (a: EditorAsset) => {
    if (tlRef.current.tracks.some((t) => t.clips.some((c) => c.assetId === a.id))) return flash("هذا الملف مستخدم في التايملاين؛ احذف مقاطعه أول.", true);
    await flush();
    try {
      await postJson(`/api/jawad/editor/projects/${project.id}`, { action: "delete_asset", id: a.id });
      infos.current.delete(a.id);
      setAssets((xs) => xs.filter((x) => x.id !== a.id));
    } catch (e) {
      flash(e instanceof Error ? e.message : "تعذّر الحذف.", true);
    }
  };

  // small pictures of the videos for the library and the timeline
  useEffect(() => {
    let live = true;
    for (const a of assets) {
      if (a.id in thumbs || a.kind === "audio") continue;
      void thumbnail(a.id, a.kind, a.url).then((url) => live && setThumbs((t) => ({ ...t, [a.id]: url })));
    }
    return () => {
      live = false;
    };
  }, [assets, thumbs]);

  // what the sound looks like, under the sound clips
  useEffect(() => {
    let live = true;
    for (const a of assets) {
      if (a.id in waves || a.kind !== "audio" || !a.url) continue;
      void peaksOf(a.id, a.url).then((p) => live && setWaves((w) => ({ ...w, [a.id]: p ? waveImage(a.id, p) : null })));
    }
    return () => {
      live = false;
    };
  }, [assets, waves]);

  // ---------- the preview ----------
  const canvas = useCallback((el: HTMLCanvasElement | null) => {
    if (!el) return;
    const p = new Player(el, tlRef.current);
    setPlayer(p);
    setCanvasEl(el);
    return () => {
      p.destroy();
      setPlayer(null);
      setCanvasEl(null);
    };
  }, []);
  const playerAssets = useMemo(() => assets.map((a) => ({ id: a.id, kind: a.kind, url: a.status === "ready" ? a.url : null, hasAudio: a.hasAudio, durationMs: a.durationMs })), [assets]);
  useEffect(() => {
    player?.update(tl, playerAssets);
  }, [player, tl, playerAssets]);

  // the text styles' fonts (loaded by the page) for the canvas
  useEffect(() => {
    const root = document.querySelector('[data-jw-section="editor"]') ?? document.querySelector(".jw");
    if (!root) return;
    const css = getComputedStyle(root);
    setFonts({ readex: css.getPropertyValue("--font-readex").trim() || undefined, naskh: css.getPropertyValue("--font-naskh").trim() || undefined, kufi: css.getPropertyValue("--font-kufi").trim() || undefined });
    void Promise.all(Object.values(FONTS).map((f) => document.fonts.load(`700 48px ${f}`).catch(() => null))).then(() => player?.draw());
  }, [player]);

  // ---------- tools ----------
  const at = () => player?.ms ?? 0;
  // the selected clips under the playhead; with none of them there, whatever is under the playhead
  const split = () => {
    const ms = at();
    const under = selected.filter((id) => {
      const f = findClip(tlRef.current, id);
      return f && ms > f.clip.start && ms < clipEnd(f.clip);
    });
    run({ type: "split", at: ms, clipIds: under.length ? under : undefined });
  };
  const remove = (ripple: boolean) => (selected.length ? run({ type: "delete", clipIds: selected, ripple }) : flash("اختر مقطعًا أول (اضغط عليه).", true));
  const duplicate = () => (selected[0] ? run({ type: "duplicate", clipId: selected[0] }) : flash("اختر مقطعًا أول.", true));
  const addText = () => {
    run({ type: "add_text", at: at() });
    if (!wide) setSheet("inspector");
  };

  // keyboard: the shortcuts every editor has (not while typing)
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keys.current = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      // Safari sends key events without a key (autofill, dictation)
      if (typeof e.key !== "string" || e.isComposing) return;
      const mod = e.ctrlKey || e.metaKey;
      const fps = tlRef.current.fps;
      if (e.code === "Space") {
        e.preventDefault();
        player?.toggle();
      } else if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicate();
      } else if ((mod && e.key.toLowerCase() === "b") || (!mod && e.key.toLowerCase() === "s")) {
        e.preventDefault();
        split();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove(e.shiftKey);
      } else if (e.key === "Escape") setSelected([]);
      else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const d = (e.shiftKey ? 1000 : 1000 / fps) * (e.key === "ArrowRight" ? 1 : -1);
        player?.seek(at() + d);
      } else if (e.key === "Home") player?.seek(0);
      else if (e.key === "End") player?.seek(duration(tlRef.current));
    };
  });
  useEffect(() => {
    const fn = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  // the time left before the project's files are deleted (3 days after export)
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const t0 = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, []);
  const hoursLeft = purgeAt && now ? Math.max(0, Math.ceil((new Date(purgeAt).getTime() - now) / 3_600_000)) : null;

  // a heavy project gets a word of warning once
  useEffect(() => {
    const clips = project.timeline.tracks.reduce((n, t) => n + t.clips.length, 0);
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    if (duration(project.timeline) > 20 * 60_000 || clips > 300 || (mem <= 4 && duration(project.timeline) > 8 * 60_000)) {
      const t = setTimeout(() => flash("المشروع كبير على جهازك؛ المعاينة والتصدير قد يبطؤون. قسّمه لمشاريع أصغر لو احتجت.", true), 800);
      return () => clearTimeout(t);
    }
  }, [project.timeline, flash]);

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const total = duration(tl);
  const one = selected.length === 1 ? findClip(tl, selected[0]) : null;

  const toolBtn = "flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[11px] text-jw-muted hover:bg-jw-surface-2 hover:text-jw-ink disabled:opacity-40 lg:flex-row lg:gap-1.5 lg:text-xs";

  return (
    <div className="flex h-[calc(100dvh-var(--jw-header-h,56px)-var(--jw-bar-h,0px))] min-h-[520px] flex-col overflow-hidden">
      {/* top bar */}
      <div className="flex items-center gap-2 border-b border-jw-line bg-jw-surface px-2 py-1.5">
        <Link href={backHref} className="jw-btn jw-btn-quiet jw-btn-icon shrink-0" aria-label="رجوع" title="رجوع">
          <Icon name="chevronRight" />
        </Link>
        <input
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-semibold hover:border-jw-line focus:border-jw-accent focus:outline-none"
          value={title}
          disabled={readOnly}
          maxLength={120}
          aria-label="اسم المشروع"
          onChange={(e) => {
            setTitle(e.target.value);
            titleRef.current = e.target.value;
          }}
          onBlur={() => {
            if (title.trim() && title !== project.title) {
              labelRef.current = "غيّرت الاسم";
              markDirty();
            }
          }}
        />
        <span className={`hidden shrink-0 text-[11px] sm:inline ${save === "error" || save === "conflict" ? "text-jw-danger" : "text-jw-faint"}`} aria-live="polite">
          {SAVE_TEXT[save]}
        </span>
        <PluginTools ctx={() => ({ projectId: project.id, tl, selected, playhead: at(), assets: assetMap })} run={run} flash={flash} readOnly={readOnly} />
        <button type="button" className={`jw-btn shrink-0 ${assisting ? "border-jw-accent text-jw-accent" : ""}`} disabled={readOnly} onClick={() => setAssisting((v) => !v)} aria-pressed={assisting} title="قل لـ Claude وش تبي ويعدّل التايملاين">
          <Icon name="sparkles" size={16} /> Claude
        </button>
        <button type="button" className="jw-btn jw-btn-primary shrink-0" disabled={readOnly || !total} onClick={() => setExporting(true)}>
          <Icon name="download" size={16} /> <span className="hidden sm:inline">صدّر</span>
        </button>
      </div>

      {save === "conflict" && (
        <div className="flex flex-wrap items-center gap-2 bg-jw-danger/15 px-3 py-2 text-xs">
          <span className="flex-1">انحفظت نسخة أحدث من هذا المشروع من نافذة ثانية.</span>
          <button type="button" className="jw-btn !min-h-8 text-xs" onClick={() => location.reload()}>حمّل الأحدث</button>
          <button type="button" className="jw-btn !min-h-8 text-xs" onClick={keepMine}>احفظ نسختي فوقها</button>
        </div>
      )}
      {readOnly ? (
        <p className="bg-jw-danger/15 px-3 py-2 text-xs">انحذفت ملفات هذا المشروع بعد ٣ أيام من تصديره (كما نبّهنا). التايملاين باقٍ للعرض فقط؛ ابدأ مشروعًا جديدًا لمونتاج جديد.</p>
      ) : (
        hoursLeft != null && (
          <p className="flex flex-wrap items-center gap-2 bg-jw-warn/15 px-3 py-1.5 text-xs text-jw-warn">
            <Icon name="clock" size={13} />
            <span className="flex-1">
              ملفات هذا المشروع تنحذف خلال {hoursLeft > 24 ? `${Math.ceil(hoursLeft / 24)} أيام` : `${hoursLeft} ساعة`}. تأكد إن الفيديو محفوظ عندك.
            </span>
            {exportUrl && (
              <a className="underline" href={exportUrl}>
                نزّل آخر تصدير
              </a>
            )}
          </p>
        )
      )}

      {/* library · preview · inspector (side panels on a computer, sheets on a phone) */}
      <div className="flex min-h-0 flex-1">
        {sheet && <button type="button" aria-label="إغلاق" className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSheet(null)} />}
        <aside
          className={`${sheet === "library" ? "fixed inset-x-0 bottom-0 z-50 flex h-[72dvh] rounded-t-2xl shadow-2xl" : "hidden"} flex-col border-jw-line bg-jw-surface lg:static lg:z-auto lg:flex lg:h-auto lg:w-72 lg:shrink-0 lg:rounded-none lg:border-e lg:shadow-none`}
          aria-label="الوسائط"
        >
          <SheetGrip onClose={() => setSheet(null)} title="الوسائط" />
          <Library
            projectId={project.id}
            assets={assets}
            thumbs={thumbs}
            uploads={uploads.items}
            onPick={(f) => uploads.add(f)}
            onDismiss={uploads.dismiss}
            onAdd={addToTimeline}
            onImported={(list) => {
              addAssets(list);
              flash(list.length > 1 ? `أضفت ${list.length} ملفات للمكتبة؛ اضغط على أي واحد لتنزله في التايملاين.` : "أضفته للمكتبة؛ اضغط عليه لتنزله في التايملاين.");
            }}
            onDelete={removeAsset}
            readOnly={readOnly}
          />
        </aside>

        <section className="relative flex min-w-0 flex-1 flex-col bg-black/40" aria-label="المعاينة">
          <div className="relative flex min-h-0 flex-1 items-center justify-center p-2">
            <canvas ref={canvas} width={tl.width} height={tl.height} className="max-h-full max-w-full rounded bg-black shadow-lg" style={{ aspectRatio: `${tl.width} / ${tl.height}` }} />
            <Guard name="الإمساك"><Handles tl={tl} canvas={canvasEl} selected={selected} onSelect={setSelected} assets={assetMap} run={run} readOnly={readOnly} player={player} /></Guard>
          </div>
          {toast && (
            <div role="status" className={`pointer-events-none absolute inset-x-3 bottom-3 mx-auto w-fit max-w-full rounded-lg px-3 py-2 text-center text-xs shadow-lg ${toast.bad ? "bg-jw-danger text-white" : "bg-jw-surface-3 text-jw-ink"}`}>
              {toast.text}
            </div>
          )}
        </section>

        <aside
          className={`${sheet === "inspector" ? "fixed inset-x-0 bottom-0 z-50 flex h-[65dvh] rounded-t-2xl shadow-2xl" : "hidden"} flex-col border-jw-line bg-jw-surface lg:static lg:z-auto ${assisting ? "lg:hidden" : "lg:flex"} lg:h-auto lg:w-72 lg:shrink-0 lg:rounded-none lg:border-s lg:shadow-none`}
          aria-label="الإعدادات"
        >
          <SheetGrip onClose={() => setSheet(null)} title={one ? "تعديل المقطع" : "المشروع"} />
          <div className="jw-scroll min-h-0 flex-1 overflow-y-auto">
            <Guard name="الإعدادات"><Inspector tl={tl} selected={selected} assets={assetMap} run={run} readOnly={readOnly} player={player} tab={tab} onTab={setTab} flash={flash} /></Guard>
          </div>
        </aside>
        {/* Claude: beside the preview on a computer, the whole screen on a phone */}
        {assisting && (
          <aside className="fixed inset-0 z-50 flex flex-col bg-jw-surface lg:static lg:z-auto lg:w-80 lg:shrink-0 lg:border-s lg:border-jw-line" aria-label="Claude">
            <Guard name="Claude"><AssistantPanel projectId={project.id} tl={tl} selected={selected} assets={assetMap} player={player} run={run} onUndo={undo} onClose={() => setAssisting(false)} readOnly={readOnly} /></Guard>
          </aside>
        )}
      </div>

      {/* transport and tools */}
      <div className="flex items-center gap-1 border-y border-jw-line bg-jw-surface px-2 py-1" dir="rtl">
        <div className="flex items-center gap-0.5">
          <button type="button" className={toolBtn} onClick={undo} disabled={!hist.past.length || readOnly} title="تراجع (Ctrl+Z)" aria-label="تراجع">
            <Icon name="undo" size={17} />
          </button>
          <button type="button" className={toolBtn} onClick={redo} disabled={!hist.future.length || readOnly} title="إعادة (Ctrl+Shift+Z)" aria-label="إعادة">
            <Icon name="redo" size={17} />
          </button>
        </div>
        <div className="hidden items-center gap-0.5 border-s border-jw-line ps-1 lg:flex">
          <button type="button" className={toolBtn} onClick={split} disabled={readOnly || !total} title="قص عند المؤشر (S)">
            <Icon name="scissors" size={16} /> قص
          </button>
          <button type="button" className={toolBtn} onClick={() => remove(false)} disabled={readOnly || !selected.length} title="حذف (Delete) · مع سحب اللي بعده: Shift+Delete">
            <Icon name="trash" size={16} /> حذف
          </button>
          <button type="button" className={toolBtn} onClick={duplicate} disabled={readOnly || selected.length !== 1} title="تكرار (Ctrl+D)">
            <Icon name="copy" size={16} /> تكرار
          </button>
          <button type="button" className={toolBtn} onClick={addText} disabled={readOnly} title="نص فوق الفيديو">
            <Icon name="type" size={16} /> نص
          </button>
          <button type="button" className={`${toolBtn} text-jw-accent`} onClick={() => setCaptioning(true)} disabled={readOnly} title="كابشن تلقائي من الكلام، مزامنة قصيدة، ملف SRT">
            <Icon name="sparkles" size={16} /> كابشن
          </button>
        </div>
        <Transport player={player} total={total} />
        <button type="button" className={`${toolBtn} hidden lg:flex ${tl.magnetic ? "text-jw-accent" : ""}`} onClick={() => run({ type: "set_magnetic", on: !tl.magnetic })} disabled={readOnly} title="المغناطيس: المسار الرئيسي بدون فراغات" aria-pressed={tl.magnetic}>
          <Icon name="magnet" size={16} /> مغناطيس
        </button>
      </div>

      <div className="h-[34%] min-h-[150px] shrink-0 lg:h-[30%] lg:min-h-[200px]">
        <Guard name="التايملاين"><Timeline tl={tl} assets={assetMap} thumbs={thumbs} waves={waves} selected={selected} onSelect={setSelected} run={run} player={player} compact={!wide} readOnly={readOnly} onEmpty={() => setSheet("library")} onTransition={(id) => {
          setSelected([id]);
          setTab("transition");
          if (!wide) setSheet("inspector");
        }} /></Guard>
      </div>

      {/* the phone's tool bar */}
      <nav className="grid grid-cols-6 border-t border-jw-line bg-jw-surface pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="الأدوات">
        <button type="button" className={toolBtn} onClick={() => setSheet("library")}>
          <Icon name="folder" size={19} /> الوسائط
        </button>
        <button type="button" className={toolBtn} onClick={split} disabled={readOnly || !total}>
          <Icon name="scissors" size={19} /> قص
        </button>
        <button type="button" className={toolBtn} onClick={() => remove(false)} disabled={readOnly || !selected.length}>
          <Icon name="trash" size={19} /> حذف
        </button>
        <button type="button" className={toolBtn} onClick={addText} disabled={readOnly}>
          <Icon name="type" size={19} /> نص
        </button>
        <button type="button" className={`${toolBtn} text-jw-accent`} onClick={() => setCaptioning(true)} disabled={readOnly}>
          <Icon name="sparkles" size={19} /> كابشن
        </button>
        <button type="button" className={`${toolBtn} ${one ? "text-jw-accent" : ""}`} onClick={() => setSheet("inspector")}>
          <Icon name={one ? "settings" : "ratio"} size={19} /> {one ? "تعديل" : "المقاس"}
        </button>
      </nav>

      <CaptionsPanel open={captioning} onClose={() => setCaptioning(false)} projectId={project.id} tl={tl} assets={assetMap} run={run} flash={flash} />
      <ExportPanel
        open={exporting}
        onClose={() => setExporting(false)}
        projectId={project.id}
        title={title}
        tl={tl}
        assets={assets}
        flush={flush}
        onExported={(p) => setPurgeAt(p)}
      />
    </div>
  );
}

function SheetGrip({ onClose, title }: { onClose: () => void; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-jw-line px-3 py-2 lg:hidden">
      <span className="flex-1 text-sm font-semibold">{title}</span>
      <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon" onClick={onClose} aria-label="إغلاق">
        <Icon name="x" />
      </button>
    </div>
  );
}

/** Play/pause and the time (they follow the player without re-rendering the editor). */
function Transport({ player, total }: { player: Player | null; total: number }) {
  const [state, setState] = useState({ ms: 0, playing: false });
  useEffect(() => {
    if (!player) return;
    let last = 0;
    return player.subscribe((ms, playing) => {
      const now = performance.now();
      if (playing && now - last < 90) return;
      last = now;
      setState({ ms, playing });
    });
  }, [player]);
  return (
    <div className="mx-auto flex items-center gap-1" dir="ltr">
      <button type="button" className="grid h-8 w-8 place-items-center rounded-full text-jw-muted hover:text-jw-ink" onClick={() => player?.seek(0)} aria-label="إلى البداية">
        <Icon name="skipBack" size={15} />
      </button>
      <button type="button" className="grid h-10 w-10 place-items-center rounded-full bg-jw-ink text-jw-bg hover:opacity-90" onClick={() => player?.toggle()} aria-label={state.playing ? "إيقاف" : "تشغيل"} disabled={!total}>
        <Icon name={state.playing ? "pause" : "play"} size={18} />
      </button>
      <button type="button" className="grid h-8 w-8 place-items-center rounded-full text-jw-muted hover:text-jw-ink" onClick={() => player?.seek(total)} aria-label="إلى النهاية">
        <Icon name="skipFwd" size={15} />
      </button>
      <span className="ms-1 text-xs tabular-nums text-jw-muted">
        <b className="text-jw-ink">{formatTime(state.ms)}</b> / {formatTime(total)}
      </span>
    </div>
  );
}
