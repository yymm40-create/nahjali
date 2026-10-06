"use client";

import Link from "next/link";
import InstallApp from "./InstallApp";
import { detectScenes } from "./scene-detect";
import { takeStartKit } from "./start-kit";
import { cutsOnTimeline } from "@/lib/editor/scenes";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { apply, applyAll, CommandError, type Applied, type Command } from "@/lib/editor/commands";
import { clipEnd, duration, findClip, formatTime, type AssetInfo, type Timeline as TL } from "@/lib/editor/model";
import { api, postJson } from "@/lib/fetch";
import Icon from "../Icon";
import AssistantPanel from "./AssistantPanel";
import Guard from "./Guard";
import SmartFix from "./SmartFix";
import { PluginTools } from "./plugins";
import { familyOf, loadFont, loadFontsOf } from "./fontload";
import { separateAsset } from "./make";
import { placeStems } from "@/lib/editor/make";
import CaptionsPanel from "./CaptionsPanel";
import ExportPanel from "./ExportPanel";
import Handles from "./Handles";
import Inspector, { type SceneCutRun, type InspectorTab } from "./Inspector";
import { peaksOf, waveImage } from "./peaks";
import Library from "./Library";
import { thumbnail } from "./media";
import { Player } from "./player";
import { FONTS, setFonts } from "./render";
import Timeline from "./Timeline";
import type { EditorAsset, EditorProjectView } from "./types";
import { useUploads, type Placement } from "./useUploads";

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

/** The editor's looks: colours and shapes (sections.css) and where the sections sit. */
const THEMES = {
  future: { label: "مستقبلي", icon: "🔷", hint: "أبيض وأزرق، ألواح تطفو", rail: "side", mirror: false, scale: 1, font: null, swatch: ["#eef3fc", "#2563eb", "#ffffff", "#0ea5e9"] },
  kids: { label: "سماء", icon: "☁️", hint: "للأطفال: غيوم وأزرار كبيرة ناعمة", rail: "clouds", mirror: false, scale: 1.12, font: "baloo-bhaijaan-2", swatch: ["#bfe7ff", "#ff7a59", "#ffffff", "#ffe6ef"] },
  cinema: { label: "استوديو", icon: "🎞️", hint: "سينمائي احترافي داكن ودقيق", rail: "pages", mirror: false, scale: 0.92, font: "ibm-plex-sans-arabic", swatch: ["#0f1012", "#e8a23a", "#1b1c20", "#2b2c32"] },
  nature: { label: "طبيعة", icon: "🌿", hint: "أخضر وأشجار، الأدوات يمين", rail: "side", mirror: true, scale: 1, font: "tajawal", swatch: ["#e6f2dc", "#2f7d4a", "#fbfaf2", "#c9b48a"] },
} as const satisfies Record<string, { label: string; icon: string; hint: string; rail: "side" | "clouds" | "pages"; mirror: boolean; scale: number; font: string | null; swatch: string[] }>;
type ThemeId = keyof typeof THEMES;
const RAIL_NAV = {
  side: "jw-glass jw-scroll my-2 hidden w-[4.25rem] shrink-0 flex-col gap-0.5 overflow-y-auto rounded-2xl p-1 lg:flex",
  clouds: "jw-scroll mx-2 mt-1 hidden gap-2 overflow-x-auto px-1 pb-2 pt-1 lg:flex",
  pages: "jw-glass jw-scroll mx-2 mb-2 hidden gap-px overflow-x-auto p-0.5 lg:flex",
  // (the phone keeps its own tool bar)
} as const;
const RAIL_ITEM = {
  side: "flex-col gap-0.5 rounded-xl px-0.5 py-1 text-[10px] leading-tight",
  clouds: "min-w-[4.75rem] flex-col justify-center gap-0.5 rounded-full px-3 py-2 text-xs font-bold",
  pages: "gap-1.5 rounded-sm px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide",
} as const;

type ClipKind = "video" | "image" | "audio" | "text";
/** What a clip is to the person: a text, a sound (a sound file, or a video's sound on a sound track), a picture, a video. */
function kindOfClip(tl: TL, assets: EditorAsset[], id: string): ClipKind | null {
  const f = findClip(tl, id);
  if (!f) return null;
  if (f.clip.text) return "text";
  if (f.track.kind === "audio") return "audio";
  const a = assets.find((x) => x.id === f.clip.assetId);
  return a?.kind === "image" ? "image" : a?.kind === "audio" ? "audio" : "video";
}
/** The sections each kind of clip has, and the one that opens first. */
const TABS_OF: Record<ClipKind, InspectorTab[]> = {
  video: ["basic", "fx", "motion", "anim", "color", "backdrop", "sound", "transition"],
  image: ["basic", "fx", "motion", "anim", "color", "backdrop", "transition"],
  audio: ["sound", "basic"],
  text: ["basic", "motion", "anim", "transition"],
};
const MAIN_TAB: Record<ClipKind, InspectorTab> = { video: "basic", image: "basic", audio: "sound", text: "basic" };
const EDIT_LABEL: Record<ClipKind, string> = { video: "الفيديو", image: "الصورة", audio: "السرعة", text: "الكتابة" };

/** The left rail's sections (a computer). */
const RAIL: { id: string; label: string; icon: string; tab?: InspectorTab; hint: string }[] = [
  { id: "media", label: "الوسائط", icon: "folder", hint: "ملفاتك: ارفع، اسحب للتايملاين" },
  { id: "edit", label: "تعديل", icon: "settings", tab: "basic", hint: "النص، الصوت، السرعة، الملاءمة" },
  { id: "fx", label: "مؤثرات", icon: "burst", tab: "fx", hint: "١٠٠ مؤثر على المقطع: تلفزيون قديم، قلتش، ضوء، مطر، مرايا…" },
  { id: "motion", label: "حركة", icon: "diamond", tab: "motion", hint: "المكان والحجم والدوران ونقاط الحركة (كي فريم)" },
  { id: "anim", label: "دخول/خروج", icon: "wand", tab: "anim", hint: "حركات الدخول والخروج" },
  { id: "color", label: "ألوان", icon: "palette", tab: "color", hint: "فلاتر وتصحيح ألوان" },
  { id: "backdrop", label: "الخلفية", icon: "user", tab: "backdrop", hint: "عزل الشخص وتغيير خلفيته" },
  { id: "sound", label: "الصوت", icon: "volume", tab: "sound", hint: "عزل الضوضاء، محسّن الصوت، المؤثرات" },
  { id: "transition", label: "انتقال", icon: "frames", tab: "transition", hint: "الانتقال للمقطع اللي بعده" },
  { id: "captions", label: "كابشن", icon: "type", hint: "كابشن تلقائي، مزامنة قصيدة، SRT" },
  { id: "styles", label: "أساليب", icon: "sparkles", hint: "أساليب مونتاج جاهزة بضغطة" },
  { id: "project", label: "المشروع", icon: "ratio", hint: "المقاس، الخلفية، المغناطيس" },
];

const SAVE_TEXT: Record<SaveState, string> = { saved: "محفوظ", dirty: "تعديلات…", saving: "نحفظ…", error: "ما انحفظ، نعيد…", conflict: "تغيّر من مكان ثاني" };

export default function Editor({ project, initialAssets, exportUrl, backHref, studioPath = null }: { project: EditorProjectView; initialAssets: EditorAsset[]; exportUrl: string | null; backHref: string; studioPath?: string | null }) {
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
  // Claude: open beside the work from the start on a computer; on a phone it opens over it when asked
  const [assisting, setAssisting] = useState(true);
  const [chat, setChat] = useState(false);
  // the left side's section (a computer): the library, a clip's settings, the ready styles, the project
  const [rail, setRail] = useState<"media" | "inspector" | "styles" | "project">("media");
  // the whole editor's size (people pick it; kept on this device)
  const [ui, setUi] = useState(1);
  // the look (kept on this device): colours, shapes and where the sections sit
  const [theme, setTheme] = useState<ThemeId>("future");
  const [picking, setPicking] = useState(false);
  // «كبّر الشاشة»: the preview takes the room of the side panels (and of the timeline on a phone) until shrunk again
  const [big, setBig] = useState(false);
  // Claude's width on a computer (dragged by its edge; kept on this device)
  const [chatW, setChatW] = useState(400);
  // the timeline's look, whatever the theme: «عادي» or «بريمير»
  const [tlLook, setTlLook] = useState<"classic" | "pro">("classic");
  // a request for Claude from a button (a ready style): the panel opens and sends it
  const [ask, setAsk] = useState<{ text: string; n: number } | null>(null);
  const [purgeAt, setPurgeAt] = useState(project.purgeAt);
  const [thumbs, setThumbs] = useState<Record<string, string | null>>({});
  const [waves, setWaves] = useState<Record<string, string | null>>({});
  const [tab, setTab] = useState<InspectorTab>("basic");
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const v = Number(localStorage.getItem("jw-editor-ui"));
        if (v >= 0.7 && v <= 1.4) setUi(v);
        if (localStorage.getItem("jw-editor-tl") === "pro") setTlLook("pro");
        const th = localStorage.getItem("jw-editor-theme");
        if (th && th in THEMES) setTheme(th as ThemeId);
        const w = Number(localStorage.getItem("jw-editor-chat-w"));
        if (w >= 300 && w <= 900) setChatW(w);
      } catch {
        /* private mode: the normal size */
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    // every size in the editor follows the page's base size, so the whole thing grows or shrinks together
    const root = document.documentElement;
    // (a phone keeps the normal size: the children's bigger look would push things off its narrow screen)
    const k = ui * (wide ? THEMES[theme].scale : Math.min(1, THEMES[theme].scale));
    root.style.fontSize = k === 1 ? "" : `${Math.round(k * 100)}%`;
    return () => {
      root.style.fontSize = "";
    };
  }, [ui, theme, wide]);
  useEffect(() => {
    const f = THEMES[theme].font;
    if (f) void loadFont(f, 400).then(() => loadFont(f, 700));
  }, [theme]);
  const pickTlLook = (v: "classic" | "pro") => {
    setTlLook(v);
    try {
      localStorage.setItem("jw-editor-tl", v);
    } catch {
      /* not kept */
    }
  };
  const pickTheme = (th: ThemeId) => {
    setTheme(th);
    setPicking(false);
    try {
      localStorage.setItem("jw-editor-theme", th);
    } catch {
      /* not kept */
    }
  };
  const sizeUi = (d: number) => {
    const v = Math.round(Math.min(1.4, Math.max(0.7, ui + d)) * 100) / 100;
    setUi(v);
    try {
      localStorage.setItem("jw-editor-ui", String(v));
    } catch {
      /* not kept */
    }
  };
  // one clip chosen, however (a tap, a new text, Claude): its settings show on the left
  // a clip chosen, however (a tap, a new text, Claude): its own settings come up on the left — a video's for a
  // video, the sound's for a sound, the writing for a text. The section stays when it suits the new clip too.
  const [seen, setSeen] = useState({ sel: selected, kind: null as ClipKind | null });
  const [wantTab, setWantTab] = useState<InspectorTab | null>(null);
  if (seen.sel !== selected) {
    const kind = selected.length === 1 ? kindOfClip(tl, assets, selected[0]) : null;
    setSeen({ sel: selected, kind });
    if (kind) {
      if (rail !== "inspector") setRail("inspector");
      const next = wantTab ?? (kind === seen.kind && TABS_OF[kind].includes(tab) ? tab : MAIN_TAB[kind]);
      if (next !== tab) setTab(next);
      if (wantTab) setWantTab(null);
    }
  }
  // picking one clip shows its settings on the left
  const pick = useCallback((ids: string[]) => {
    setSelected(ids);
    if (ids.length === 1) setRail("inspector");
  }, []);
  useEffect(() => {
    if (!big) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setBig(false);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [big]);
  // Claude's edge, dragged: wider toward the preview, narrower back
  const dragChat = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = chatW;
    const dir = THEMES[theme].mirror ? 1 : -1;
    let w = startW;
    const move = (ev: PointerEvent) => {
      w = Math.round(Math.min(Math.max(300, window.innerWidth * 0.6), Math.max(300, startW + dir * (ev.clientX - startX))));
      setChatW(w);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      try {
        localStorage.setItem("jw-editor-chat-w", String(w));
      } catch {
        /* not kept */
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const openClaude = (on?: boolean) => {
    setAssisting((v) => on ?? !v);
    setChat((v) => on ?? !v);
  };

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
  // files let go on the timeline land where they were dropped: one after another («line») or each on its own track
  // one above the other («stack»); the line goes on from the end of the last one placed
  const cursor = useRef<{ group: string; at: number } | null>(null);
  const placeAsset = useCallback(
    (a: EditorAsset, p?: Placement) => {
      if (!p) return run({ type: "add_clip", assetId: a.id });
      const want = a.kind === "audio" ? "audio" : "video";
      const onTrack = p.trackId ? tlRef.current.tracks.find((x) => x.id === p.trackId && x.kind === want && !x.locked)?.id : undefined;
      let at = p.at;
      if (p.mode === "line" && cursor.current?.group === p.group) at = cursor.current.at;
      const trackId = p.mode === "stack" && !p.first ? "new" : onTrack;
      const r = run({ type: "add_clip", assetId: a.id, at, ...(trackId ? { trackId } : {}) });
      const made = r?.select?.[0] ? findClip(r.timeline, r.select[0]) : null;
      if (made && p.mode === "line") cursor.current = { group: p.group, at: clipEnd(made.clip) };
      return r;
    },
    [run],
  );
  const uploads = useUploads(
    project.id,
    useCallback(
      (a: EditorAsset, place?: Placement) => {
        addAssets([a]);
        // each uploaded file goes on the timeline: pictures after what is there (or where it was dropped), sound from the start
        placeAsset(a, place);
      },
      [addAssets, placeAsset],
    ),
  );
  const [dropAsk, setDropAsk] = useState<{ files: File[]; at: number; trackId: string | null } | null>(null);
  const dropFiles = (files: File[], at: number, trackId: string | null, mode?: "stack" | "line") => {
    if (files.length > 1 && !mode) return setDropAsk({ files, at, trackId });
    const group = Math.random().toString(36).slice(2);
    uploads.add(files, files.map((_, i) => ({ at, trackId, mode: mode ?? "one", group, first: i === 0 })));
    flash(files.length > 1 ? `نرفع ${files.length} ملفات وننزّلها في التايملاين…` : "نرفع الملف وننزّله في مكانه…");
  };
  // what the launcher's «مشروع جديد» brought: device files go up and onto the timeline one after another, works
  // already in the library go on the timeline the same way
  const kitTaken = useRef(false);
  useEffect(() => {
    if (kitTaken.current || readOnly) return;
    kitTaken.current = true;
    const k = takeStartKit(project.id);
    if (!k) return;
    const t = setTimeout(() => {
      if (k.assets.length) {
        addAssets(k.assets);
        const group = `kit-${project.id}`;
        k.assets.forEach((a, i) => placeAsset(a, { at: 0, trackId: null, mode: "line", group, first: i === 0 }));
        if (!k.files.length) flash(`نزّلت ${k.assets.length} من أعمالك في التايملاين.`);
      }
      if (k.files.length) dropFiles(k.files, duration(tlRef.current), null, "line");
    }, 0);
    return () => clearTimeout(t);
    // once, when the editor opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // «التقطيع الذكي»: the clip read in the browser, then cut at every change of shot (one undo)
  const sceneCut: SceneCutRun = async (clipId, sensitivity, onProgress, signal) => {
    const f = findClip(tlRef.current, clipId);
    const a = f?.clip.assetId ? assets.find((x) => x.id === f.clip.assetId) : null;
    if (!f || !a?.url || a.kind !== "video") {
      flash("اختر مقطع فيديو.", true);
      return 0;
    }
    let found: number[];
    try {
      found = await detectScenes(a.url, f.clip.in / 1000, f.clip.out / 1000, { sensitivity, onProgress, signal });
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") flash(e instanceof Error && e.message ? `ما قدرت أقرأ المشاهد: ${e.message}` : "ما قدرت أقرأ المشاهد.", true);
      return 0;
    }
    const now = findClip(tlRef.current, clipId);
    if (!now) return 0;
    const at = cutsOnTimeline(now.clip, found);
    if (!at.length) {
      flash("ما لقيت تغيّر مشهد واضح في هذا المقطع؛ جرّب «حساس».");
      return 0;
    }
    if (run(at.map((ms, i) => ({ type: "split" as const, at: ms, clipIds: [i ? `$${i}` : clipId] })), { label: `تقطيع ذكي: ${at.length + 1} مشاهد` })) {
      flash(`قطّعته ${at.length + 1} مشاهد ✂️ — كل مشهد صار مقطع لحاله.`);
    }
    return at.length;
  };
  // a clip's sound split into talking, music and effects, each on its own track in step with it
  const separateClip = async (clipId: string) => {
    const f = findClip(tlRef.current, clipId);
    const a = f?.clip.assetId ? assets.find((x) => x.id === f.clip.assetId) : null;
    if (!f || !a || a.kind === "image" || !a.hasAudio) return flash("اختر مقطع فيه صوت.", true);
    flash("نفصل الكلام والموسيقى والمؤثرات… (يأخذ دقيقة أو أكثر)");
    const r = await separateAsset(project.id, a, f.clip.in, f.clip.out);
    addAssets(r.assets);
    run(placeStems(f.clip, r.assets.map((x) => x.id)), { label: "فصلت الكلام والموسيقى والمؤثرات" });
    flash(r.full ? "انفصل الصوت: الكلام والموسيقى والمؤثرات كل واحد في مسار." : "فصلنا الكلام في مسار بروحه. فصل الموسيقى عن المؤثرات يحتاج تفعيل خدمة fal على الخادم.");
  };
  const dropAsset = (id: string, at: number, trackId: string | null) => {
    const a = assets.find((x) => x.id === id);
    if (a) placeAsset(a, { at, trackId, mode: "one", group: "", first: true });
  };
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

  // what the sound looks like, under the sound clips (a video's sound taken out onto a sound track too)
  const heard = useMemo(() => new Set(tl.tracks.flatMap((t) => (t.kind === "audio" ? t.clips.map((c) => c.assetId ?? "") : []))), [tl.tracks]);
  useEffect(() => {
    let live = true;
    for (const a of assets) {
      if (a.id in waves || a.kind === "image" || (a.kind === "video" && !heard.has(a.id)) || !a.url) continue;
      void peaksOf(a.id, a.url).then((p) => live && setWaves((w) => ({ ...w, [a.id]: p ? waveImage(a.id, p) : null })));
    }
    return () => {
      live = false;
    };
  }, [assets, waves, heard]);

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
  // catalogue fonts the texts use: fetched once, then the frame is drawn again with them
  useEffect(() => {
    let live = true;
    void loadFontsOf(tl).then(() => live && player?.draw());
    return () => {
      live = false;
    };
  }, [tl, player]);

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

  const pluginCtx = () => ({
    projectId: project.id,
    tl,
    selected,
    playhead: at(),
    assets: assetMap,
    infos: infos.current,
    ask: (text: string) => {
      openClaude(true);
      setAsk((a) => ({ text, n: (a?.n ?? 0) + 1 }));
    },
  });
  // the sections: a rail at the side, big clouds over the timeline (children), or page tabs at the bottom (cinema)
  const railNav = (variant: "side" | "clouds" | "pages") => (
    <nav className={RAIL_NAV[variant]} aria-label="أقسام المحرر">
      {RAIL.filter((r) => !r.tab || !seen.kind || rail !== "inspector" || TABS_OF[seen.kind].includes(r.tab)).map((r, i) => {
            const label = r.id === "edit" && seen.kind && rail === "inspector" ? EDIT_LABEL[seen.kind] : r.label;
            const on = r.id === "media" ? rail === "media" : r.id === "styles" ? rail === "styles" : r.id === "project" ? rail === "project" : r.tab ? rail === "inspector" && tab === r.tab : false;
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={on}
                title={r.hint}
                onClick={() => {
                  if (r.id === "captions") return setCaptioning(true);
                  if (r.tab) {
                    setTab(r.tab);
                    setRail("inspector");
                  } else setRail(r.id as "media" | "styles" | "project");
                }}
                className={`jw-3d flex shrink-0 items-center ${RAIL_ITEM[variant]} ${on ? "jw-rail-on" : variant === "clouds" ? `jw-cloud-${i % 5} text-jw-ink` : "bg-jw-surface text-jw-muted hover:text-jw-ink"}`}
              >
                <Icon name={r.icon} size={variant === "clouds" ? 22 : variant === "pages" ? 14 : 16} />
                <span className="whitespace-nowrap">{label}</span>
              </button>
            );
          })}
    </nav>
  );
  const toolBtn = "flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[11px] text-jw-muted hover:bg-jw-surface-2 hover:text-jw-ink disabled:opacity-40 lg:flex-row lg:gap-1.5 lg:text-xs";

  return (
    <div
      className="flex h-dvh min-h-[480px] flex-col overflow-hidden lg:h-[calc(100dvh-var(--jw-header-h,56px)-var(--jw-bar-h,0px))] lg:min-h-[520px]"
      data-ed-theme={theme}
      // a phone: the editor takes the whole screen (JAWAD AI's header steps aside, sections.css)
      data-ed-full=""
      style={THEMES[theme].font ? { fontFamily: `"${familyOf(THEMES[theme].font!)}", var(--jw-font)` } : undefined}
      // files dropped anywhere else (the preview, the panels) go at the playhead
      onDragOver={(e) => {
        if (!readOnly && e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDrop={(e) => {
        if (readOnly || !e.dataTransfer.files.length) return;
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files).filter((f) => /^(video|audio|image)\//.test(f.type) || /\.(mp4|mov|m4v|webm|mkv|mp3|m4a|aac|wav|ogg|opus|flac|png|jpe?g|webp|gif|heic|avif)$/i.test(f.name));
        if (files.length) dropFiles(files, at(), null);
      }}
    >
      {/* top bar */}
      <div className="jw-glass z-10 mx-2 mt-2 flex items-center gap-2 rounded-2xl px-2 py-1.5">
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
        <PluginTools
          ctx={pluginCtx} run={run} flash={flash} readOnly={readOnly} className="lg:hidden" />
        {/* the look */}
        <div className="relative shrink-0">
          <button type="button" className="jw-btn jw-3d" onClick={() => setPicking((v) => !v)} aria-expanded={picking} title="الثيم: شكل المحرر وترتيبه">
            <Icon name="palette" size={16} /> <span className="hidden md:inline">{THEMES[theme].label}</span>
          </button>
          {picking && (
            <div role="menu" aria-label="الثيمات" className="jw-glass absolute end-0 top-full z-50 mt-2 grid w-[22rem] max-w-[90vw] grid-cols-2 gap-2 rounded-2xl p-2">
              {(Object.keys(THEMES) as ThemeId[]).map((k) => (
                <button key={k} type="button" role="menuitemradio" aria-checked={theme === k} onClick={() => pickTheme(k)} className={`overflow-hidden rounded-xl border-2 text-start ${theme === k ? "border-jw-accent" : "border-transparent hover:border-jw-line-strong"}`}>
                  <span className="flex h-14" style={{ background: THEMES[k].swatch[0] }}>
                    {THEMES[k].swatch.slice(1).map((c) => (
                      <span key={c} className="m-1.5 flex-1 rounded-lg" style={{ background: c }} />
                    ))}
                  </span>
                  <span className="block bg-jw-surface px-2 py-1.5">
                    <b className="block text-xs">{THEMES[k].icon} {THEMES[k].label}</b>
                    <span className="block text-[10px] leading-4 text-jw-muted">{THEMES[k].hint}</span>
                  </span>
                </button>
              ))}
              <div className="col-span-2">
                <InstallApp />
              </div>
            </div>
          )}
        </div>
        {/* the whole editor's size */}
        <div className="hidden items-center rounded-xl border border-jw-line bg-jw-surface-2 sm:flex" role="group" aria-label="حجم الواجهة">
          <button type="button" className="grid h-8 w-8 place-items-center rounded-s-xl text-jw-muted hover:text-jw-ink disabled:opacity-40" disabled={ui <= 0.7} onClick={() => sizeUi(-0.1)} aria-label="صغّر الواجهة" title="صغّر الواجهة">
            <Icon name="zoomOut" size={15} />
          </button>
          <button type="button" className="min-w-11 text-[11px] tabular-nums text-jw-muted hover:text-jw-ink" onClick={() => sizeUi(1 - ui)} title="الحجم الطبيعي" dir="ltr">
            {Math.round(ui * 100)}%
          </button>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-e-xl text-jw-muted hover:text-jw-ink disabled:opacity-40" disabled={ui >= 1.4} onClick={() => sizeUi(0.1)} aria-label="كبّر الواجهة" title="كبّر الواجهة">
            <Icon name="zoomIn" size={15} />
          </button>
        </div>
        <span className="hidden lg:contents"><button type="button" className={`jw-btn jw-3d shrink-0 ${assisting ? "border-jw-accent text-jw-accent" : ""}`} disabled={readOnly} onClick={() => openClaude()} aria-pressed={assisting} title="مساعدك: قل له وش تبي ويعدّل التايملاين">
          <span className="jw-orb h-4 w-4" aria-hidden /> Claude
        </button></span>
        <button type="button" className="jw-btn jw-btn-primary jw-3d shrink-0" disabled={readOnly || !total} onClick={() => setExporting(true)}>
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

      {/* Claude (right) · the preview · the left side: a section and its rail (a computer); sheets on a phone */}
      <div className={`flex min-h-0 flex-1 gap-0 lg:gap-2 lg:px-2 ${THEMES[theme].mirror ? "flex-row-reverse" : ""}`}>
        {sheet && <button type="button" aria-label="إغلاق" className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSheet(null)} />}
        {/* Claude: beside the work on a computer from the start, over it on a phone when asked */}
        <aside className={`${chat ? "fixed inset-0 z-50 flex" : "hidden"} jw-glass-lg relative flex-col bg-jw-surface lg:static lg:z-auto ${assisting && !big ? "lg:flex" : "lg:hidden"} lg:my-2 lg:shrink-0 lg:rounded-2xl`} style={wide ? { width: chatW } : undefined} aria-label="Claude">
          {/* its edge: drag to make the conversation wider or narrower (double-click: the usual width) */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="غيّر عرض محادثة Claude"
            title="اسحب لتكبير المحادثة أو تصغيرها"
            className={`absolute inset-y-6 z-10 hidden w-2 cursor-col-resize rounded-full hover:bg-jw-accent/40 lg:block ${THEMES[theme].mirror ? "start-0" : "end-0"}`}
            onPointerDown={dragChat}
            onDoubleClick={() => setChatW(400)}
          />
          <Guard name="Claude"><AssistantPanel ask={ask} onAssets={addAssets} onSeparate={separateClip} onSceneCut={(id: string) => sceneCut(id, "normal", () => {}, new AbortController().signal)} projectId={project.id} tl={tl} selected={selected} assets={assetMap} player={player} run={run} onUndo={undo} onClose={() => openClaude(false)} readOnly={readOnly} /></Guard>
        </aside>

        <section className="relative flex min-w-0 flex-1 flex-col" aria-label="المعاينة">
          <div className="relative flex min-h-0 flex-1 items-center justify-center p-2">
            <canvas ref={canvas} width={tl.width} height={tl.height} className="jw-screen max-h-full max-w-full rounded-xl" style={{ aspectRatio: `${tl.width} / ${tl.height}` }} />
            <Guard name="الإمساك"><Handles tl={tl} canvas={canvasEl} selected={selected} onSelect={pick} assets={assetMap} run={run} readOnly={readOnly} player={player} /></Guard>
            <button
              type="button"
              className="jw-glass jw-3d absolute end-3 top-3 z-20 flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold"
              onClick={() => setBig((v) => !v)}
              aria-label={big ? "صغّر الشاشة" : "كبّر الشاشة"}
              title={big ? "رجّع الشاشة لحجمها (Esc)" : "كبّر الشاشة: تختفي الألواح الجانبية مؤقتًا"}
            >
              <Icon name={big ? "shrink" : "expand"} size={16} />
              <span className="hidden sm:inline">{big ? "صغّر الشاشة" : "كبّر الشاشة"}</span>
            </button>
          </div>
          {toast && (
            <div role="status" className={`pointer-events-none absolute inset-x-3 bottom-3 mx-auto w-fit max-w-full rounded-lg px-3 py-2 text-center text-xs shadow-lg ${toast.bad ? "bg-jw-danger text-white" : "bg-jw-surface-3 text-jw-ink"}`}>
              {toast.text}
            </div>
          )}
        </section>

        <aside
          className={`${sheet === "library" ? "fixed inset-x-0 bottom-0 z-50 flex h-[72dvh] rounded-t-2xl shadow-2xl" : "hidden"} flex-col bg-jw-surface lg:static lg:z-auto ${rail === "media" && !big ? "lg:flex" : "lg:hidden"} jw-glass-lg lg:my-2 lg:h-auto lg:w-80 lg:shrink-0 lg:rounded-2xl`}
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

        <aside
          className={`${sheet === "inspector" ? "fixed inset-x-0 bottom-0 z-50 flex h-[65dvh] rounded-t-2xl shadow-2xl" : "hidden"} flex-col bg-jw-surface lg:static lg:z-auto ${(rail === "inspector" || rail === "project") && !big ? "lg:flex" : "lg:hidden"} jw-glass-lg lg:my-2 lg:h-auto lg:w-80 lg:shrink-0 lg:rounded-2xl`}
          aria-label="الإعدادات"
        >
          <SheetGrip onClose={() => setSheet(null)} title={one ? "تعديل المقطع" : "المشروع"} />
          <div className="jw-scroll min-h-0 flex-1 overflow-y-auto">
            <Guard name="الإعدادات"><Inspector tl={tl} selected={selected} assets={assetMap} run={run} readOnly={readOnly} player={player} tab={tab} onTab={setTab} flash={flash} rail={wide} projectView={wide && rail === "project"} thumbs={thumbs} onSceneCut={sceneCut} onSeparate={(id) => separateClip(id).catch((e) => flash(e instanceof Error ? e.message : "تعذّر الفصل.", true))} /></Guard>
          </div>
        </aside>

        <aside className={`hidden jw-glass flex-col lg:my-2 lg:w-80 lg:shrink-0 lg:rounded-2xl ${rail === "styles" && !big ? "lg:flex" : ""}`} aria-label="أساليب جاهزة">
          <div className="jw-scroll min-h-0 flex-1 overflow-y-auto">
            <PluginTools inline ctx={pluginCtx} run={run} flash={flash} readOnly={readOnly} />
          </div>
        </aside>

        {/* the rail of sections at the side (the blue and nature looks) */}
        {THEMES[theme].rail === "side" && !big && railNav("side")}
      </div>

      {THEMES[theme].rail === "clouds" && !big && railNav("clouds")}

      {/* transport and tools */}
      <div className="jw-glass mx-2 my-1 flex items-center gap-1 rounded-2xl px-2 py-1" dir="rtl">
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
        <div className="hidden items-center rounded-lg border border-jw-line p-0.5 text-[11px] lg:flex" role="radiogroup" aria-label="شكل التايملاين">
          {(
            [
              ["classic", "عادي"],
              ["pro", "بريمير"],
            ] as const
          ).map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={tlLook === v} onClick={() => pickTlLook(v)} className={`rounded-md px-2 py-1 ${tlLook === v ? "bg-jw-accent text-jw-on-accent" : "text-jw-muted hover:text-jw-ink"}`}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" className={`${toolBtn} hidden lg:flex ${tl.magnetic ? "text-jw-accent" : ""}`} onClick={() => run({ type: "set_magnetic", on: !tl.magnetic })} disabled={readOnly} title="المغناطيس: المسار الرئيسي بدون فراغات" aria-pressed={tl.magnetic}>
          <Icon name="magnet" size={16} /> مغناطيس
        </button>
      </div>

      {!(big && !wide) && <Guard name="التعديل الذكي"><SmartFix projectId={project.id} tl={tl} assets={assetMap} selected={selected} run={run} player={player} onAssets={addAssets} flash={flash} readOnly={readOnly} studioPath={studioPath} /></Guard>}
      <div className={`jw-glass mx-2 mb-2 shrink-0 overflow-hidden rounded-2xl ${big ? "hidden lg:block lg:h-[16%] lg:min-h-[110px]" : "h-[34%] min-h-[150px] lg:h-[30%] lg:min-h-[200px]"}`}>
        <Guard name="التايملاين"><Timeline tl={tl} assets={assetMap} thumbs={thumbs} waves={waves} selected={selected} onSelect={pick} run={run} player={player} compact={!wide} readOnly={readOnly} look={tlLook} onDropFiles={(f, at, tr) => dropFiles(f, at, tr)} onDropAsset={dropAsset} onEmpty={() => setSheet("library")} onTransition={(id) => {
          setWantTab("transition");
          pick([id]);
          if (!wide) setSheet("inspector");
        }} /></Guard>
      </div>

      {THEMES[theme].rail === "pages" && !big && railNav("pages")}

      {/* the phone's tool bar: Claude in the middle, one tap away (nothing floats over the timeline) */}
      <nav className="grid grid-cols-7 items-end border-t border-jw-line bg-jw-surface pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="الأدوات">
        <button type="button" className={toolBtn} onClick={() => setSheet("library")}>
          <Icon name="folder" size={19} /> الوسائط
        </button>
        <button type="button" className={toolBtn} onClick={split} disabled={readOnly || !total}>
          <Icon name="scissors" size={19} /> قص
        </button>
        <button type="button" className={toolBtn} onClick={() => remove(false)} disabled={readOnly || !selected.length}>
          <Icon name="trash" size={19} /> حذف
        </button>
        <button type="button" className="flex flex-col items-center gap-0.5 pb-1.5 text-[11px] font-semibold text-jw-accent disabled:opacity-40" onClick={() => openClaude(true)} disabled={readOnly} aria-label="افتح Claude مساعدك">
          <span className="jw-orb -mt-6 h-12 w-12 ring-4 ring-jw-surface" aria-hidden />
          Claude
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

      {dropAsk && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={() => setDropAsk(null)}>
          <div role="dialog" aria-modal="true" aria-label="كيف أرتّب الملفات؟" className="w-full max-w-sm space-y-3 rounded-2xl border border-jw-line bg-jw-surface p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold">سحبت {dropAsk.files.length} ملفات. كيف أرتّبها؟</p>
            <button type="button" autoFocus className="jw-btn jw-btn-primary w-full justify-start" onClick={() => { dropFiles(dropAsk.files, dropAsk.at, dropAsk.trackId, "stack"); setDropAsk(null); }}>
              <Icon name="layers" size={16} /> فوق بعض: كل ملف في مسار، كلها تبدأ من نفس اللحظة
            </button>
            <button type="button" className="jw-btn w-full justify-start" onClick={() => { dropFiles(dropAsk.files, dropAsk.at, dropAsk.trackId, "line"); setDropAsk(null); }}>
              <Icon name="film" size={16} /> ورا بعض: واحد بعد الثاني في نفس المسار
            </button>
            <button type="button" className="jw-btn jw-btn-quiet w-full" onClick={() => setDropAsk(null)}>إلغاء</button>
          </div>
        </div>
      )}

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
      <button type="button" className="jw-3d jw-play grid h-11 w-11 place-items-center rounded-full hover:opacity-95" onClick={() => player?.toggle()} aria-label={state.playing ? "إيقاف" : "تشغيل"} disabled={!total}>
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
