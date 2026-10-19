"use client";

import Link from "next/link";
import { coinStr } from "@config/coins";
import { download } from "./export";
import InstallApp from "./InstallApp";
import { detectScenes } from "./scene-detect";
import { takeStartKit } from "./start-kit";
import { forgetOpen, rememberOpen } from "./open-project";
import { remapTimeline } from "./package";
import PhoneTools, { type ClipKindOf, type PhoneAction } from "./PhoneTools";
import { cutsOnTimeline } from "@/lib/editor/scenes";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { apply, applyAll, CommandError, type Applied, type ClipPatch, type Command } from "@/lib/editor/commands";
import ContextMenu, { type MenuItem } from "./ContextMenu";
import SequenceTabs from "./SequenceTabs";
import { DEFAULT_LAYOUT, firstRect, onScreen, PANELS, readLayout, saveLayout, type Layout, type PanelId, type Rect } from "./layout";
import { ATTRS, copyClips, pasteable, type Attr } from "./clipboard";
import { gradeView, setGradeView } from "./grade-gl";
import { allTracks, flatten, clipEnd, duration, findClip, formatTime, mainTrack, type AssetInfo, type Clip, type Timeline as TL, type TrackKind } from "@/lib/editor/model";
import { api, postJson } from "@/lib/fetch";
import Icon, { type IconName } from "../Icon";
import AssistantPanel from "./AssistantPanel";
import { UPDATE_EVENT, updating } from "@/components/NewVersion";
import MovableBubble from "@/components/MovableBubble";
import RobotFace from "@/components/RobotFace";
import "./haidara-pop.css";
import Guard from "./Guard";
import SmartFix from "./SmartFix";
import { PluginTools } from "./plugins";
import { familyOf, loadFont, loadFontsOf } from "./fontload";
import { makeMusicAsset, separateAsset, stemQuality } from "./make";
import MotionLab from "./MotionLab";
import { sourceOf, type FootageSource } from "./lab-footage";
import type { Cue } from "@/lib/editor/scene/contract";
import { placeStems } from "@/lib/editor/make";
import CaptionsPanel from "./CaptionsPanel";
import { planSync } from "./sync";
import ExportPanel from "./ExportPanel";
import Handles from "./Handles";
import Inspector, { type SceneCutRun, type InspectorTab } from "./Inspector";
import { peaksOf, waveImage } from "./peaks";
import Library from "./Library";
import { framesOf, measureVideo, thumbnail } from "./media";
import { Player } from "./player";
import { makeProxy, needsProxy, proxyUrl } from "./proxy";
import { FONTS, setFonts } from "./render";
import ShortcutsPage from "./ShortcutsPage";
import KeyStudio from "./KeyStudio";
import MenuBar, { type MenuAct } from "./MenuBar";
import CommandBar from "./CommandBar";
import ClipStrip from "./ClipStrip";
import ScopesPanel from "./ScopesPanel";
import "./workspaces.css";
import { PAGE_INFO, PRO, WS_BY_ID, wsVars, type PageId } from "./workspaces";
import { TL_ZOOM } from "./Timeline";
import { BIG_STEP, comboOf, KEYS_STORE, keyTable, readProgram, type ActionId, type ProgramId } from "@/lib/editor/shortcuts";
import { rateLabel } from "@/lib/editor/shuttle";
import { PREVIEW_ZOOM_KEY, PREVIEW_ZOOMS, previewSize, readPreviewZoom, type PreviewZoom } from "@/lib/editor/preview-zoom";
import { describeDevice, PERF_MODES, PERF_SHARES, type DeviceReport, type PerfPrefs } from "@/lib/editor/perf";
import { benchDevice, deviceNow, loadPerf, perfPlan, savePerf } from "./perf-bench";
import { resetKeyGl } from "./key-gl";
import { resetGradeGl } from "./grade-gl";
import Timeline from "./Timeline";
import type { EditorAsset, EditorProjectView } from "./types";
import { useUploads, type Placement } from "./useUploads";
import { diagNote, startDiag } from "./diag";
import { startMaking, useMaking } from "./making";
import type { MakePlan } from "@/lib/editor/make-any";
import Coined from "@/components/Coined";

type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";
interface Step {
  tl: TL;
  label: string;
}

/** the quick tools shown at first (the person adds or removes more) */
// (the rest lives in the menus at the top left, or on the keyboard: no tool twice on the screen)
const DEFAULT_TOOLS = ["split", "delete", "duplicate", "text"];

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
  // «كاب كت»: the menus as tabs at the top of the left column, their contents under them
  tabs: "cut-tabs hidden lg:grid",
  side: "jw-glass jw-scroll my-2 hidden w-[4.25rem] shrink-0 flex-col gap-0.5 overflow-y-auto rounded-2xl p-1 lg:flex",
  clouds: "jw-scroll mx-2 mt-1 hidden gap-2 overflow-x-auto px-1 pb-2 pt-1 lg:flex",
  pages: "jw-glass jw-scroll mx-2 mb-2 hidden gap-px overflow-x-auto p-0.5 lg:flex",
  // (the phone keeps its own tool bar)
} as const;
const RAIL_ITEM = {
  tabs: "flex-col justify-center gap-0.5 rounded-lg px-0.5 py-1.5 text-[10.5px] leading-tight",
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
  video: ["basic", "fx", "motion", "opacity", "anim", "color", "backdrop", "sound", "transition"],
  image: ["basic", "fx", "motion", "opacity", "anim", "color", "backdrop", "transition"],
  audio: ["sound", "basic"],
  text: ["basic", "motion", "opacity", "anim", "transition"],
};
const MAIN_TAB: Record<ClipKind, InspectorTab> = { video: "basic", image: "basic", audio: "sound", text: "basic" };
const EDIT_LABEL: Record<ClipKind, string> = { video: "الفيديو", image: "الصورة", audio: "السرعة", text: "الكتابة" };

/** The left rail's sections (a computer). */
const RAIL: { id: string; label: string; icon: string; tab?: InspectorTab; hint: string }[] = [
  { id: "media", label: "الوسائط", icon: "folder", hint: "ملفاتك: ارفع، اسحب للتايملاين" },
  { id: "edit", label: "تعديل", icon: "settings", tab: "basic", hint: "النص، الصوت، السرعة، الملاءمة" },
  { id: "fx", label: "مؤثرات", icon: "burst", tab: "fx", hint: "١٠٠ مؤثر على المقطع: تلفزيون قديم، قلتش، ضوء، مطر، مرايا…" },
  { id: "motion", label: "حركة", icon: "diamond", tab: "motion", hint: "المكان والحجم والدوران ونقاط الحركة (كي فريم)" },
  { id: "opacity", label: "شفافية", icon: "layers", tab: "opacity", hint: "الشفافية، أوضاع الدمج، الكي (شاشة خضراء ولوما)" },
  { id: "anim", label: "دخول/خروج", icon: "wand", tab: "anim", hint: "حركات الدخول والخروج" },
  { id: "color", label: "ألوان", icon: "palette", tab: "color", hint: "فلاتر وتصحيح ألوان" },
  { id: "backdrop", label: "الخلفية", icon: "user", tab: "backdrop", hint: "عزل الشخص وتغيير خلفيته" },
  { id: "sound", label: "الصوت", icon: "volume", tab: "sound", hint: "عزل الضوضاء، محسّن الصوت، المؤثرات" },
  { id: "transition", label: "انتقال", icon: "frames", tab: "transition", hint: "الانتقال للمقطع اللي بعده" },
  { id: "captions", label: "كابشن", icon: "type", hint: "كابشن تلقائي، مزامنة قصيدة، SRT" },
  { id: "styles", label: "أساليب", icon: "sparkles", hint: "أساليب مونتاج جاهزة بضغطة" },
  { id: "project", label: "المشروع", icon: "ratio", hint: "المقاس، الخلفية، المغناطيس" },
  { id: "haidara", label: "حيدرة", icon: "sparkles", hint: "حيدرة: قل له وش تبي ويعدّل المونتاج" },
];

const SAVE_TEXT: Record<SaveState, string> = { saved: "محفوظ", dirty: "تعديلات…", saving: "نحفظ…", error: "ما انحفظ، نعيد…", conflict: "تغيّر من مكان ثاني" };

export default function Editor({ project, initialAssets, exportUrl, backHref, studioPath = null, owner = false }: { project: EditorProjectView; initialAssets: EditorAsset[]; exportUrl: string | null; backHref: string; studioPath?: string | null; /** the site's owner: «🩺 تشخيص» in حيدرة */ owner?: boolean }) {
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
  // «منطقة التصدير»: the In and Out points (timeline ms); an end left empty = the project's start / end
  const [rangeIO, setRangeIO] = useState<{ from: number | null; to: number | null }>({ from: null, to: null });
  // «⌨️ الاختصارات»: whose keys win a clash (asked once on a computer; kept on this device), and the page of all keys
  const [keysFrom, setKeysFrom] = useState<ProgramId | null>(null);
  const [keysOpen, setKeysOpen] = useState<false | "first" | "page">(false);
  const importInput = useRef<HTMLInputElement>(null);
  const [captioning, setCaptioning] = useState(false);
  // Claude: open beside the work from the start on a computer; on a phone it opens over it when asked
  const [assisting, setAssisting] = useState(false);
  const [chat, setChat] = useState(false);
  // the left side's section (a computer): the library, a clip's settings, the ready styles, the project
  const [rail, setRail] = useState<"media" | "inspector" | "styles" | "project" | "haidara">("media");
  // «كاب كت»: the right column, where an option that needs its own window opens (the captions, the export)
  const [rightEl, setRightEl] = useState<HTMLDivElement | null>(null);
  // the whole editor's size (people pick it; kept on this device)
  const [ui, setUi] = useState(1);
  // the look (kept on this device): colours, shapes and where the sections sit
  const [theme] = useState<ThemeId>("future");
  // «واجهات البرامج»: the editor dressed as one of twenty editors (its colours, menus and pages; kept on this device)
  const [wsId, setWsId] = useState<string | null>(null);
  const ws = wsId ? (WS_BY_ID.get(wsId) ?? null) : null;
  // the page of a workspace: «التلوين» and the other big pages give the tools most of the screen
  const [page, setPage] = useState<PageId>("edit");
  const bigPage = !!ws && PAGE_INFO[page].big;
  // «غرفة التلوين»: the colour page as a whole room — the picture and the scopes above, the wheels, curves and the rest below
  const colorRoom = bigPage && page === "color" && wide;
  const [picking, setPicking] = useState(false);
  /** the look in use: a workspace's, or one of the four themes */
  const T = ws ? { label: ws.ar, icon: ws.icon, hint: ws.hint, rail: ws.rail, mirror: !!ws.mirror, scale: ws.scale, font: ws.font, swatch: [ws.pal.bg, ws.pal.accent, ws.pal.s1, ws.pal.s3] } : THEMES[theme];
  // «كبّر الشاشة»: the preview takes the room of the side panels (and of the timeline on a phone) until shrunk again
  const [big, setBig] = useState(false);
  // Claude's width on a computer (dragged by its edge; kept on this device)
  const [chatW, setChatW] = useState(400);
  // حيدرة's place on a computer: docked beside the preview, the whole side from top to bottom («طول كامل»), or half
  // the screen («نص الشاشة»); kept on this device
  const [chatMode, setChatModeState] = useState<"dock" | "tall" | "half">("dock");
  const setChatMode = (m: "dock" | "tall" | "half") => {
    setChatModeState(m);
    try {
      localStorage.setItem("jw-editor-chat-mode", m);
    } catch {
      /* not kept */
    }
  };
  // the timeline's height, dragged by its top edge (null: the usual share of the screen); kept on this device
  const [tlH, setTlH] = useState<number | null>(null);
  // the conversation over the whole editor (a computer), and its text size (kept on this device)
  const [chatBig, setChatBig] = useState(false);
  // JAWAD AI's two top bars (the header and the sections bar) on a computer: tiny by default, one press brings them out,
  // and they can be hidden completely (a small tab stays to bring them back); kept on this device
  const [bars, setBarsState] = useState<"mini" | "open" | "off">("mini");
  const setBars = (v: "mini" | "open" | "off") => {
    setBarsState(v);
    try {
      localStorage.setItem("jw-editor-bars", v);
    } catch {
      /* not kept */
    }
  };
  // «حيدرة فوق التايملاين»: on a computer his conversation sits right over the timeline (instead of a popup) so edits are
  // asked and seen in the same place; kept on this device
  const [chatDock, setChatDockState] = useState(false);
  const setChatDock = (v: boolean) => {
    setChatDockState(v);
    if (v) setChatBig(false);
    try {
      localStorage.setItem("jw-editor-chat-dock", v ? "1" : "");
    } catch {
      /* not kept */
    }
  };
  const [chatZoom, setChatZoom] = useState(1);
  const zoomChat = (z: number) => {
    setChatZoom(z);
    try {
      localStorage.setItem("jw-editor-chat-zoom", String(z));
    } catch {}
  };
  // «واجهتي»: panels' order, the settings panel's width, and panels floating as windows (a computer)
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT);
  const [layoutOpen, setLayoutOpen] = useState(false);
  // «🎬 مختبر الموشن»: open, with a brief (from حيدرة's chat or empty)
  const [lab, setLab] = useState<{ brief: string; seconds?: number; clipId?: string | null } | null>(null);
  // the lab folded to its pill: kept here, so «مختبر الموشن» in the toolbar brings the same work back instead of
  // looking like a dead button (the window stays mounted while it is folded, and the work carries on)
  const [labMin, setLabMin] = useState(false);
  const openLab = (brief = "", seconds?: number, clipId?: string | null) => {
    setLabMin(false);
    setLab((now) => (now && !brief && !clipId ? now : { brief, seconds, clipId }));
  };
  // «🩺 تشخيص»: the owner's browser keeps a record of what goes wrong while the editor is open
  useEffect(() => {
    if (owner) startDiag();
  }, [owner]);
  // the window last grabbed sits over the others
  const [front, setFront] = useState<PanelId | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setLayout(readLayout()), 0);
    return () => clearTimeout(t);
  }, []);
  const putLayout = (next: Layout) => {
    setLayout(next);
    saveLayout(next);
  };
  const floatToggle = (id: PanelId) => {
    setFront(id);
    const float = { ...layout.float };
    if (float[id]) delete float[id];
    else float[id] = firstRect(id, Object.keys(float).length);
    putLayout({ ...layout, float });
  };
  const moveDocked = (id: PanelId, by: -1 | 1) => {
    const o = [...layout.order];
    const i = o.indexOf(id);
    const j = i + by;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    putLayout({ ...layout, order: o });
  };
  /** a floating window dragged by its bar */
  const dragWindow = (id: PanelId, e: React.PointerEvent) => {
    const r = layout.float[id];
    if (!r || e.button > 0) return;
    e.preventDefault();
    setFront(id);
    const sx = e.clientX;
    const sy = e.clientY;
    let last = r;
    const move = (ev: PointerEvent) => {
      last = onScreen({ ...r, x: r.x + ev.clientX - sx, y: r.y + ev.clientY - sy });
      setLayout((l) => ({ ...l, float: { ...l.float, [id]: last } }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setLayout((l) => {
        const next = { ...l, float: { ...l.float, [id]: last } };
        saveLayout(next);
        return next;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  /** a floating window's size, kept when its corner is dragged (a ref callback per panel, made once) */
  const watchSize = (id: PanelId) => {
    let ro: ResizeObserver | null = null;
    return (el: HTMLElement | null) => {
      ro?.disconnect();
      ro = null;
      if (!el) return;
      let t = 0;
      ro = new ResizeObserver(() => {
        clearTimeout(t);
        t = window.setTimeout(() => {
          setLayout((l) => {
            const r = l.float[id];
            if (!r) return l;
            const w = Math.round(el.offsetWidth);
            const h = Math.round(el.offsetHeight);
            if (Math.abs(w - r.w) < 2 && Math.abs(h - r.h) < 2) return l;
            const next = { ...l, float: { ...l.float, [id]: { ...r, w, h } } };
            saveLayout(next);
            return next;
          });
        }, 250);
      });
      ro.observe(el);
    };
  };
  const [sizeChat] = useState(() => watchSize("chat"));
  const [sizePanel] = useState(() => watchSize("panel"));
  const [sizePreview] = useState(() => watchSize("preview"));
  /** the settings / library panel's edge dragged wider or narrower */
  const dragPanel = (e: React.PointerEvent) => {
    e.preventDefault();
    const sx = e.clientX;
    const w0 = layout.panelW;
    // the panel grows toward the middle: which way that is depends on its side
    const dir = (layout.order.indexOf("panel") > layout.order.indexOf("preview") ? 1 : -1) * (T.mirror ? -1 : 1);
    let w = w0;
    const move = (ev: PointerEvent) => {
      w = Math.min(720, Math.max(260, w0 + (ev.clientX - sx) * dir));
      setLayout((l) => ({ ...l, panelW: w }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setLayout((l) => {
        const next = { ...l, panelW: w };
        saveLayout(next);
        return next;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // the preview on the whole screen
  const stage = useRef<HTMLElement>(null);
  const stageRef = useCallback(
    (el: HTMLElement | null) => {
      stage.current = el;
      sizePreview(el);
    },
    [sizePreview],
  );
  // «تكبير المعاينة»: the picture at a chosen share of the stage («ملء» … ٤٠٠٪), scrolled around when larger than it
  const [pz, setPz] = useState<PreviewZoom>("fit");
  const [stageBox, setStageBox] = useState({ w: 0, h: 0 });
  const stageRo = useRef<ResizeObserver | null>(null);
  const stageInner = useCallback((el: HTMLDivElement | null) => {
    stageRo.current?.disconnect();
    stageRo.current = null;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setStageBox({ w: el.clientWidth - 16, h: el.clientHeight - 16 }));
    ro.observe(el);
    stageRo.current = ro;
  }, []);
  const pickZoom = (z: PreviewZoom) => {
    setPz(z);
    try {
      localStorage.setItem(PREVIEW_ZOOM_KEY, z);
    } catch {
      /* not kept */
    }
  };
  const [full, setFull] = useState(false);
  const toggleFull = () => {
    const el = stage.current;
    if (document.fullscreenElement) return void document.exitFullscreen().catch(() => {});
    // (an iPhone can't put a page part on the whole screen: it fills the page instead)
    if (el?.requestFullscreen && !full) el.requestFullscreen().catch(() => setFull(true));
    else setFull((v) => !v);
  };
  useEffect(() => {
    const sync = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  useEffect(() => {
    if (!chatBig && !full) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setChatBig(false);
      if (!document.fullscreenElement) setFull(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [chatBig, full]);
  // the timeline's look, whatever the theme: «عادي» or «بريمير»
  const [tlLook, setTlLook] = useState<"classic" | "pro">("classic");
  // a request for Claude from a button (a ready style): the panel opens and sends it
  const [ask, setAsk] = useState<{ text: string; n: number } | null>(null);
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
        // the pro look is THE look of the editor on a computer (the older themes and their picker are gone; a phone keeps its own)
        if (window.matchMedia(wideQuery).matches) {
          setWsId(PRO.id);
          setTlLook(PRO.tl);
        }
        const w = Number(localStorage.getItem("jw-editor-chat-w"));
        if (w >= 300 && w <= 900) setChatW(w);
        const z = Number(localStorage.getItem("jw-editor-chat-zoom"));
        if (z >= 0.85 && z <= 1.6) setChatZoom(z);
        if (localStorage.getItem("jw-editor-chat-dock")) setChatDockState(true);
        const bs = localStorage.getItem("jw-editor-bars");
        if (bs === "open" || bs === "off") setBarsState(bs);
        const cm = localStorage.getItem("jw-editor-chat-mode");
        if (cm === "tall" || cm === "half") setChatModeState(cm);
        setPz(readPreviewZoom(localStorage.getItem(PREVIEW_ZOOM_KEY)));
        const kp = readProgram(localStorage.getItem(KEYS_STORE));
        if (kp) setKeysFrom(kp);
        else if (window.matchMedia("(min-width: 1024px) and (pointer: fine)").matches) setKeysOpen("first");
        const th2 = Number(localStorage.getItem("jw-editor-tl-h"));
        if (th2 >= 110 && th2 <= 2000) setTlH(th2);
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
    const k = ui * (wide ? T.scale : Math.min(1, T.scale));
    root.style.fontSize = k === 1 ? "" : `${Math.round(k * 100)}%`;
    return () => {
      root.style.fontSize = "";
    };
  }, [ui, T.scale, wide]);
  useEffect(() => {
    const f = T.font;
    if (f) void loadFont(f, 400).then(() => loadFont(f, 700));
  }, [T.font]);
  const pickKeys = (p: ProgramId) => {
    setKeysFrom(p);
    try {
      localStorage.setItem(KEYS_STORE, p);
    } catch {
      /* not kept */
    }
  };
  const pickTlLook = (v: "classic" | "pro") => {
    setTlLook(v);
    try {
      localStorage.setItem("jw-editor-tl", v);
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
      if (rail !== "inspector" && rail !== "haidara") setRail("inspector");
      const next = wantTab ?? (kind === seen.kind && TABS_OF[kind].includes(tab) ? tab : MAIN_TAB[kind]);
      if (next !== tab) setTab(next);
      if (wantTab) setWantTab(null);
    }
  }
  // picking one clip shows its settings on the left
  const pick = useCallback((ids: string[]) => {
    setSelected(ids);
    if (ids.length === 1) setRail((r) => (r === "haidara" ? r : "inspector"));
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
    const dir = T.mirror ? 1 : -1;
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
  // the timeline's top edge, dragged: taller up, shorter down (between 110 px and three quarters of the editor)
  const dragTimeline = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const box = e.currentTarget.parentElement!;
    const startY = e.clientY;
    const startH = box.getBoundingClientRect().height;
    const most = Math.max(200, (box.parentElement?.getBoundingClientRect().height ?? window.innerHeight) * 0.75);
    let h = startH;
    const move = (ev: PointerEvent) => {
      h = Math.round(Math.min(most, Math.max(110, startH - (ev.clientY - startY))));
      setTlH(h);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      try {
        localStorage.setItem("jw-editor-tl-h", String(h));
      } catch {
        /* not kept */
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const resetTimeline = () => {
    setTlH(null);
    try {
      localStorage.removeItem("jw-editor-tl-h");
    } catch {
      /* not kept */
    }
  };
  const openClaude = (on?: boolean) => {
    // a computer: حيدرة is one of the menus at the top left (his conversation shows under them)
    if (wideRef.current) {
      const open = on ?? railRef.current !== "haidara";
      if (open) {
        setAssisting(true);
        setChat(true);
        setRail("haidara");
      } else if (railRef.current === "haidara") setRail("media");
      return;
    }
    setAssisting((v) => on ?? !v);
    setChat((v) => on ?? !v);
  };

  // Arrived with a request for حيدرة (…?haydara=…, e.g. the film's «قص وعدّل بحسب ملاحظاتي»): sent once, then the
  // address is cleaned so a reload doesn't send it again
  useEffect(() => {
    const t = setTimeout(() => {
      const q = new URLSearchParams(window.location.search).get("haydara");
      if (!q?.trim()) return;
      window.history.replaceState(null, "", window.location.pathname);
      setAssisting(true);
      setChat(true);
      setAsk((a) => ({ text: q.slice(0, 2000), n: (a?.n ?? 0) + 1 }));
    }, 800);
    return () => clearTimeout(t);
  }, []);

  const wideRef = useRef(wide);
  const railRef = useRef(rail);
  useEffect(() => {
    wideRef.current = wide;
    railRef.current = rail;
  }, [wide, rail]);
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
    if (bad) diagNote(`shown to the person: ${text}`);
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
      // «حدّث الحين» saved first and is loading the new version: let it go
      if (updating()) return;
      if (dirty.current || saving.current) e.preventDefault();
    };
    // «حدّث الحين»: save now, and tell it when the save is done
    const onUpdate = () => {
      (window as { __jwFlush?: Promise<unknown> }).__jwFlush = dirty.current || saving.current ? Promise.resolve(flush()) : Promise.resolve();
    };
    window.addEventListener(UPDATE_EVENT, onUpdate);
    const hide = () => document.visibilityState === "hidden" && dirty.current && versionRef.current > 0 && void flush();
    window.addEventListener("beforeunload", leave);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("beforeunload", leave);
      window.removeEventListener(UPDATE_EVENT, onUpdate);
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
  // «رفع الدقة»: a video sent to Topaz (fal) comes back as a new file; the page asks how far it is every 15 s (and
  // again after a reload: the files still being made are remembered on this device), then the clips that used the
  // original play the new one
  const upKey = `jw-upscale-${project.id}`;
  const upWatch = useRef(new Set<string>());
  const watchUpscale = useCallback(
    (id: string, from: string) => {
      if (upWatch.current.has(id)) return;
      upWatch.current.add(id);
      const keep = (on: boolean) => {
        try {
          const all = JSON.parse(localStorage.getItem(upKey) ?? "{}") as Record<string, string>;
          if (on) all[id] = from;
          else delete all[id];
          localStorage.setItem(upKey, JSON.stringify(all));
        } catch {
          /* not kept */
        }
      };
      keep(true);
      void (async () => {
        for (let i = 0; i < 960; i++) {
          await new Promise((r) => setTimeout(r, 15_000));
          const r = await postJson<{ state: string; asset?: EditorAsset; message?: string }>(`/api/jawad/editor/projects/${project.id}`, { action: "upscale_check", id }).catch(() => null);
          if (!r) continue;
          if (r.state === "done" && r.asset) {
            addAssets([r.asset]);
            // «رفع دقة الفيديو كامل» (from = "dl:<file name>"): the whole export, upscaled — it is saved on the device, no clip to switch
            if (from.startsWith("dl:")) {
              const file = from.slice(3) || "jawad-4k.mp4";
              try {
                const blob = await (await fetch(r.asset.url!)).blob();
                download(blob, file);
                flash(`✅ نزل الفيديو كامل بدقة ${r.asset.width}×${r.asset.height} («${file}»). نسخته باقية في المكتبة.`);
              } catch {
                flash(`✅ الفيديو الكامل بدقة ${r.asset.width}×${r.asset.height} جاهز في المكتبة (نزّله من هناك).`);
              }
              break;
            }
            // the new file's info first, then the clips switched to it (one undo)
            setTimeout(() => {
              const done = run({ type: "swap_asset", from, to: id }, { label: "رفع الدقة" });
              flash(done ? `✅ صار المقطع بدقة ${r.asset!.width}×${r.asset!.height}، والأصلي باقي في المكتبة.` : `✅ النسخة بدقة ${r.asset!.width}×${r.asset!.height} جاهزة في المكتبة.`);
            }, 50);
            break;
          }
          if (r.state === "failed") {
            setAssets((xs) => xs.filter((x) => x.id !== id));
            flash(r.message ?? "ما انرفعت الدقة.", true);
            break;
          }
        }
        keep(false);
        upWatch.current.delete(id);
      })();
    },
    [addAssets, flash, project.id, run, upKey],
  );
  useEffect(() => {
    try {
      for (const [id, from] of Object.entries(JSON.parse(localStorage.getItem(upKey) ?? "{}") as Record<string, string>)) watchUpscale(id, from);
    } catch {
      /* nothing remembered */
    }
  }, [upKey, watchUpscale]);
  const upscale = useCallback(
    async (assetId: string, target: "4k" | "1080p") => {
      const found = assets.find((x) => x.id === assetId);
      if (!found) return;
      let a = found;
      // a work brought in without its size on record: the browser reads it from the file first
      if (!a.width || !a.height || !a.durationMs) {
        const m = a.url ? await measureVideo(a.url) : null;
        if (!m) return flash(`ما قدرت أقرا دقة «${a.name}»؛ شغّله مرة في المعاينة وأعد المحاولة.`, true);
        a = { ...a, width: a.width || m.width, height: a.height || m.height, durationMs: a.durationMs || m.durationMs };
        const known = a;
        setAssets((xs) => xs.map((x) => (x.id === known.id ? { ...x, width: known.width, height: known.height, durationMs: known.durationMs } : x)));
      }
      if (Math.max(a.width!, a.height!) >= 3800) return flash(`«${a.name}» دقته ${a.width}×${a.height} — هذا 4K أصلًا.`, true);
      if (!window.confirm(`أرفع دقة «${a.name}» (${a.width}×${a.height}) إلى ${target === "4k" ? "4K" : "1080p"} بالذكاء الاصطناعي (Topaz)؟\nياخذ من دقايق لأكثر على حسب طوله، وتقدر تكمل شغلك. النسخة الجديدة تنضاف للمكتبة والأصلي يظل.`)) return;
      try {
        const r = await postJson<{ asset: EditorAsset; coins: number }>(`/api/jawad/editor/projects/${project.id}`, { action: "upscale", assetId, target, width: a.width, height: a.height, durationMs: a.durationMs });
        addAssets([r.asset]);
        flash(`⬆️ بدأ رفع الدقة${r.coins ? ` (${coinStr(r.coins)})` : ""}… أعلمك إذا خلص.`);
        watchUpscale(r.asset.id, assetId);
      } catch (e) {
        flash(e instanceof Error ? e.message : "ما بدأ رفع الدقة.", true);
      }
    },
    [assets, addAssets, flash, project.id, watchUpscale],
  );
  // «رفع دقة الفيديو كامل» (from the export window): the exported file is already up as a library file (it isn't put on
  // the timeline); it is sent to be upscaled whole, and the 4K file downloads by itself when it is ready
  const upscaleWhole = useCallback(
    async (a: EditorAsset, target: "4k" | "1080p", file: string) => {
      try {
        const r = await postJson<{ asset: EditorAsset; coins: number }>(`/api/jawad/editor/projects/${project.id}`, { action: "upscale", assetId: a.id, target, width: a.width, height: a.height, durationMs: a.durationMs });
        addAssets([r.asset]);
        flash(`⬆️ بدأ رفع دقة الفيديو كامل إلى ${target === "4k" ? "4K" : "1080p"}${r.coins ? ` (${coinStr(r.coins)})` : ""}… ينزل لك لحاله لما يخلص.`);
        watchUpscale(r.asset.id, `dl:${file}`);
      } catch (e) {
        flash(e instanceof Error ? e.message : "ما بدأ رفع الدقة.", true);
      }
    },
    [addAssets, flash, project.id, watchUpscale],
  );
  // files let go on the timeline land where they were dropped: one after another («line») or each on its own track
  // one above the other («stack»); the line goes on from the end of the last one placed
  const cursor = useRef<{ group: string; at: number } | null>(null);
  const placeAsset = useCallback(
    (a: EditorAsset, p?: Placement) => {
      if (!p) return run({ type: "add_clip", assetId: a.id });
      const want = a.kind === "audio" ? "audio" : "video";
      const onTrack = p.trackId === "new" ? "new" : p.trackId ? tlRef.current.tracks.find((x) => x.id === p.trackId && x.kind === want && !x.locked)?.id : undefined;
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
  // «افتح مشروع محفوظ»: the saved timeline, waiting for its files to be up
  const pkgWait = useRef<{ timeline: TL; count: number; ids: Map<string, string> } | null>(null);
  const uploads = useUploads(
    project.id,
    useCallback(
      (a: EditorAsset, place?: Placement) => {
        addAssets([a]);
        // the export window's whole-video upscale: the file stays out of the timeline
        if (place?.group.startsWith("expup:")) {
          const [, target, ...name] = place.group.split(":");
          void upscaleWhole(a, target === "1080p" ? "1080p" : "4k", name.join(":"));
          return;
        }
        // a saved project's file: kept until all are up, then its timeline comes back pointing at them
        const w = pkgWait.current;
        if (w && place?.group.startsWith("pkg:")) {
          w.ids.set(place.group.slice(4), a.id);
          if (w.ids.size < w.count) return;
          pkgWait.current = null;
          commit(remapTimeline(w.timeline, w.ids), "فتحت المشروع المحفوظ");
          flash("رجع المشروع كامل: التايملاين وكل ملفاته.");
          return;
        }
        // each uploaded file goes on the timeline: pictures after what is there (or where it was dropped), sound from the start
        placeAsset(a, place);
      },
      [addAssets, placeAsset, commit, flash, upscaleWhole],
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
  // open again from «حيدرة كت» after visiting other sections, until the person leaves it
  useEffect(() => rememberOpen(project.id), [project.id]);
  const kitTaken = useRef(false);

  useEffect(() => {
    if (kitTaken.current || readOnly) return;
    kitTaken.current = true;
    const k = takeStartKit(project.id);
    if (!k) return;
    if (k.pkg) {
      const { timeline, media } = k.pkg;
      pkgWait.current = { timeline, count: media.length, ids: new Map() };
      const t = setTimeout(() => {
        if (!media.length) {
          commit(timeline, "فتحت المشروع المحفوظ");
          return;
        }
        uploads.add(
          media.map((m) => m.file),
          media.map((m, i) => ({ at: 0, trackId: null, mode: "one", group: `pkg:${m.oldId}`, first: i === 0 })),
        );
        flash(`نرفع ${media.length} ملف من المشروع المحفوظ، وبعدها يرجع التايملاين مثل ما كان…`);
      }, 0);
      return () => clearTimeout(t);
    }
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
    const r = await separateAsset(project.id, a, f.clip.in, f.clip.out, (text) => flash(text), stemQuality());
    addAssets(r.assets);
    run(placeStems(f.clip, r.assets.map((x) => x.id)), { label: "فصلت الكلام والموسيقى والمؤثرات" });
    flash(r.full ? "انفصل الصوت: الكلام والموسيقى والمؤثرات كل واحد في مسار." : r.assets.length > 1 ? "انفصل الكلام عن الموسيقى، كل واحد في مسار (المؤثرات بقت مع الموسيقى)." : "فصلنا الكلام في مسار بروحه. فصل الموسيقى يحتاج تفعيل خدمة fal على الخادم.");
  };
  // «زامن الصوت»: the chosen clips are lined up by what they hear (a camera and a phone, a camera and a microphone track)
  const [syncing, setSyncing] = useState(false);
  const syncClips = async (ids: string[]) => {
    if (syncing) return;
    setSyncing(true);
    try {
      const plan = await planSync(tlRef.current, ids, new Map(assets.map((x) => [x.id, x])), (text) => flash(text));
      if (plan.cmds.length) run(plan.cmds, { label: `زامنت ${plan.moved} مقطع بالصوت` });
      flash(plan.notes.join(" "), !plan.cmds.length);
    } catch (e) {
      flash(e instanceof Error ? e.message : "تعذّرت المزامنة.", true);
    } finally {
      setSyncing(false);
    }
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
  // «🎬 مختبر الموشن»: the rendered film goes up and onto the timeline at the playhead, its sound cues on their own
  // sound tracks at their moments (a few tracks, so cues close together don't push each other), music under it
  const placeFilm = async (film: File, cues: Cue[], music: { prompt: string; ms: number } | null, place?: { at: number; muteClipId: string }) => {
    const at = Math.round(place?.at ?? player?.ms ?? 0);
    // built on the person's own clip: the piece lands on its own track over it, and the clip under it is muted (its
    // voice is inside the piece already)
    uploads.add([film], [{ at, trackId: place ? "new" : null, mode: "one", group: `lab-${at}`, first: true }]);
    if (place && findClip(tlRef.current, place.muteClipId)) run({ type: "update_clip", clipId: place.muteClipId, patch: { volume: 0 } }, { label: "مختبر الموشن على فيديوك" });
    flash("🎬 نرفع المقطع وننزّله عند مؤشر الوقت…");
    setLab(null);
    setLabMin(false);
    if (cues.length) {
      try {
        const ids = [...new Set(cues.map((c) => c.sfx))];
        const r = await postJson<{ assets: EditorAsset[] }>(`/api/jawad/editor/projects/${project.id}`, { action: "import_sfx", ids });
        addAssets(r.assets);
        const byName = new Map(r.assets.map((a) => [a.name, a]));
        const { sfxById } = await import("@config/jawad/sfx-library");
        const lanes: { trackId: string; end: number }[] = [];
        for (const c of cues) {
          const a = byName.get(`🔊 ${sfxById(c.sfx)?.name ?? ""}`);
          if (!a) continue;
          const when = at + Math.round(c.t * 1000);
          const free = lanes.find((l) => l.end <= when);
          const lane = free ?? (lanes.length < 4 ? null : lanes.reduce((x, y) => (y.end < x.end ? y : x)));
          const added = run({ type: "add_clip", assetId: a.id, at: when, trackId: lane?.trackId ?? "new" }, { label: "مؤثرات الموشن" });
          const id = added?.select?.[0];
          const f = id && added ? findClip(added.timeline, id) : null;
          if (!f) continue;
          if (c.vol < 0.99) run({ type: "update_clip", clipId: id!, patch: { volume: c.vol } }, { label: "مؤثرات الموشن", coalesce: `lab-vol-${id}` });
          const end = clipEnd(f.clip);
          if (lane) lane.end = end;
          else lanes.push({ trackId: f.track.id, end });
        }
      } catch (e) {
        flash(e instanceof Error ? `المؤثرات: ${e.message}` : "ما قدرنا نضيف مؤثرات الموشن.", true);
      }
    }
    if (music) {
      try {
        flash("🎵 نصنع الموسيقى على الإيقاع…");
        const a = await makeMusicAsset(project.id, music.prompt, Math.max(10_000, music.ms));
        addAssets([a]);
        const added = run({ type: "add_clip", assetId: a.id, at, trackId: "new" }, { label: "موسيقى الموشن" });
        const id = added?.select?.[0];
        if (id) {
          run({ type: "trim_clip", clipId: id, edge: "end", to: at + music.ms }, { label: "موسيقى الموشن" });
          run({ type: "update_clip", clipId: id, patch: { volume: 0.55, fadeOut: 600 } }, { label: "موسيقى الموشن" });
        }
      } catch (e) {
        flash(e instanceof Error ? `الموسيقى: ${e.message}` : "ما قدرنا نصنع الموسيقى.", true);
      }
    }
  };
  const removeAsset = async (a: EditorAsset) => {
    if (allTracks(tlRef.current).some((t) => t.clips.some((c) => c.assetId === a.id))) return flash("هذا الملف مستخدم في أحد التسلسلات؛ احذف مقاطعه أول.", true);
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
  const flashRef = useRef(flash);
  useEffect(() => {
    flashRef.current = flash;
  }, [flash]);
  const canvas = useCallback((el: HTMLCanvasElement | null) => {
    if (!el) return;
    const p = new Player(el, tlRef.current);
    // the latest flash (the player is made once; a ref keeps it from being made again)
    p.onTrouble = (m) => flashRef.current(m, true);
    setPlayer(p);
    setCanvasEl(el);
    return () => {
      p.destroy();
      setPlayer(null);
      setCanvasEl(null);
    };
  }, []);
  // «اصنع لي…»: what حيدرة started making with JAWAD AI, placed when it is ready
  const making = useMaking({ projectId: project.id, run, onAssets: addAssets, flash, readOnly });
  const extendClip = async (clipId: string, edge: "start" | "end", seconds: number, prompt: string, quality: "720p" | "1080p", withSound: boolean) => {
    const found = findClip(tlRef.current, clipId);
    const asset = found?.clip.assetId ? assets.find((item) => item.id === found.clip.assetId) : null;
    if (!found || !asset?.url || asset.kind !== "video") throw new Error("اختر مقطع فيديو جاهز أولًا.");
    const boundary = edge === "start" ? found.clip.in : Math.max(found.clip.in, found.clip.out - 50);
    const [frame] = await framesOf(asset.url, "video", boundary, boundary + 2, 1, 720);
    if (!frame?.data) throw new Error("تعذّر قراءة فريم الربط من المقطع.");
    const { plan } = await postJson<{ plan: MakePlan }>(`/api/jawad/editor/projects/${project.id}`, {
      action: "extend_plan",
      clipId,
      edge,
      frame: frame.data,
      seconds,
      prompt,
      quality,
      withSound,
    });
    if (!plan.generatorId.startsWith("byteplus-seedance-")) throw new Error("AI Extend متاح عبر Seedance فقط.");
    if (!plan.free && !window.confirm(`تمديد ${edge === "start" ? "بداية" : "نهاية"} المقطع عبر ${plan.generatorName} مقابل ${coinStr(plan.coins)}؟`)) return;
    await startMaking(project.id, plan);
    flash(`بدأ ${plan.generatorName} تمديد ${edge === "start" ? "البداية" : "النهاية"}؛ سيُركّب تلقائيًا عند اكتماله.`);
  };
  /** «🩺 تشخيص»: the editor's state as it stands (read when a diagnosis is asked for, never while drawing) */
  const diagApp = () => ({
    save,
    version: versionRef.current,
    unsaved: dirty.current,
    readOnly,
    wide,
    theme,
    uiZoom: ui,
    layout,
    gradeView: { ...gradeView },
    playheadMs: player?.ms ?? null,
    playing: player?.playing ?? null,
    selected,
    openTimeline: tl.seqs?.find((x) => !x.tl)?.name ?? null,
    timelines: tl.seqs?.length ?? 1,
    size: `${tl.width}x${tl.height}@${tl.fps}`,
    tracks: tl.tracks.map((t) => ({ kind: t.kind, name: t.name, clips: t.clips.length, ...(t.muted ? { muted: true } : {}), ...(t.hidden ? { hidden: true } : {}) })),
    files: assets.map((a) => ({ id: a.id, kind: a.kind, name: a.name, mime: a.mime, mb: Math.round(a.bytes / 1e5) / 10, status: a.status, hasUrl: !!a.url, origin: a.origin, size: a.width ? `${a.width}x${a.height}` : null, durationMs: a.durationMs })),
  });
  // «النسخة الخفيفة»: a 4K video (anything over 1080p) gets a light copy made on this device once, and the preview
  // plays it (smooth seeking, no 4K streaming); the export always uses the original
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const proxyBusy = useRef(new Set<string>());
  useEffect(() => {
    if (readOnly) return;
    const todo = assets.filter((a) => a.status === "ready" && a.url && needsProxy(a) && !previews[a.id] && !proxyBusy.current.has(a.id));
    if (!todo.length) return;
    let stop = false;
    for (const a of todo) proxyBusy.current.add(a.id);
    void (async () => {
      for (const a of todo) {
        if (stop) break;
        try {
          let url = await proxyUrl(a.id);
          if (!url) {
            flashRef.current(`🎞️ «${a.name}» دقته ${a.width}×${a.height}: أجهّز له نسخة خفيفة للمعاينة على جهازك (مرة وحدة)، والتصدير يظل بالدقة الأصلية…`);
            let last = 0;
            url = await makeProxy(a.id, a.url!, (p) => {
              if (p - last >= 0.25) {
                last = p;
                diagNote(`النسخة الخفيفة «${a.name}»: ${Math.round(p * 100)}٪`, "note");
              }
            });
            if (url) flashRef.current(`✅ «${a.name}» صار يشتغل خفيف في المعاينة.`);
          }
          if (url && !stop) setPreviews((m) => ({ ...m, [a.id]: url! }));
        } catch (e) {
          diagNote(`النسخة الخفيفة «${a.name}» ما انعملت: ${e instanceof Error ? e.message : String(e)}`, "note");
        } finally {
          proxyBusy.current.delete(a.id);
        }
      }
    })();
    return () => {
      stop = true;
    };
  }, [assets, previews, readOnly]);
  const playerAssets = useMemo(() => assets.map((a) => ({ id: a.id, kind: a.kind, url: a.status === "ready" ? a.url : null, preview: a.status === "ready" ? (previews[a.id] ?? null) : null, hasAudio: a.hasAudio, durationMs: a.durationMs, name: a.name, width: a.width, height: a.height })), [assets, previews]);
  useEffect(() => {
    // nested timelines («Nest») opened into their clips, so they play like any others
    player?.update(flatten(tl), playerAssets);
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

  // ---------- the clipboard (Ctrl+C / X / V, and «لصق السمات» Ctrl+Alt+V) ----------
  const copySel = (ids = selected) => {
    const n = copyClips(tlRef.current, ids);
    flash(n ? (n > 1 ? `نسخت ${n} مقاطع.` : "نسخت المقطع.") : "اختر مقطعًا أول.", !n);
    return n;
  };
  const cutSel = (ids = selected) => {
    if (copySel(ids)) run({ type: "delete", clipIds: ids, ripple: false }, { label: "قص" });
  };
  const paste = (ms = at()) => {
    const c = pasteable();
    if (!c) return flash("ما فيه شي منسوخ: انسخ مقطع أول (Ctrl+C).", true);
    run({ type: "paste_clips", clips: c.clips, at: ms });
  };
  /** the first copied clip's looks onto the selected clips (each takes what fits it) */
  const pasteAttrs = (which: Attr[], ids = selected) => {
    const src = pasteable()?.clips[0]?.clip;
    if (!src) return flash("انسخ المقطع اللي تبي سماته أول (Ctrl+C).", true);
    const cmds: Command[] = [];
    for (const id of ids) {
      const f = findClip(tlRef.current, id);
      if (!f || f.clip.id === src.id || f.track.locked) continue;
      const a = f.clip.assetId ? infos.current.get(f.clip.assetId) : null;
      const picture = !f.clip.text && f.track.kind === "video" && !!a && a.kind !== "audio";
      const patch: ClipPatch = {};
      for (const k of which) {
        if (k === "grades" && picture) patch.grades = src.grades;
        if (k === "fx" && picture) patch.fx = src.fx;
        if (k === "crop" && picture) patch.crop = src.crop;
        if (k === "bg" && picture) patch.bg = src.bg;
        if (k === "key" && picture) patch.key = src.key;
        if (k === "blend" && f.track.kind !== "audio") patch.blend = src.blend;
        if (k === "transform" && f.track.kind !== "audio") patch.transform = src.transform;
        if (k === "anim" && f.track.kind !== "audio") patch.anim = src.anim;
        if (k === "sound" && a && a.kind !== "image" && a.hasAudio) patch.sound = src.sound;
      }
      if (Object.keys(patch).length) cmds.push({ type: "update_clip", clipId: id, patch });
    }
    if (!cmds.length) return flash("ما فيه سمات تنفع للمقاطع المحددة.", true);
    run(cmds, { label: "لصق السمات" });
  };
  type MenuAt = { x: number; y: number; clipId: string | null; ms: number; trackId: string | null };
  const [menu, setMenu] = useState<(MenuAt & { items: MenuItem[] }) | null>(null);
  const openMenu = (m: MenuAt) => setMenu({ ...m, items: menuItems(m) });
  const menuItems = (m: MenuAt): MenuItem[] => {
    const can = !readOnly;
    const has = !!pasteable();
    if (!m.clipId)
      return [
        { label: "لصق هنا", keys: "Ctrl+V", onClick: () => paste(m.ms), disabled: !can || !has },
        { label: "تحديد الكل", keys: "Ctrl+A", onClick: () => setSelected(tlRef.current.tracks.filter((t) => !t.locked).flatMap((t) => t.clips.map((c) => c.id))) },
        { label: "نص هنا", onClick: () => run({ type: "add_text", at: m.ms }), disabled: !can, sep: true },
      ];
    const ids = selected.includes(m.clipId) ? selected : [m.clipId];
    const f = findClip(tlRef.current, m.clipId);
    const a = f?.clip.assetId ? infos.current.get(f.clip.assetId) : null;
    const video = !!a && a.kind === "video" && f?.track.kind === "video";
    return [
      { label: "قص", keys: "Ctrl+X", onClick: () => cutSel(ids), disabled: !can },
      { label: "نسخ", keys: "Ctrl+C", onClick: () => copySel(ids) },
      { label: "لصق عند المؤشر", keys: "Ctrl+V", onClick: () => paste(), disabled: !can || !has },
      {
        label: "لصق السمات",
        keys: "Ctrl+Alt+V",
        disabled: !can || !has,
        items: [{ label: "كل السمات", onClick: () => pasteAttrs(Object.keys(ATTRS) as Attr[], ids) }, ...(Object.entries(ATTRS) as [Attr, string][]).map(([k, label]) => ({ label, onClick: () => pasteAttrs([k], ids) }))],
      },
      { label: "تكرار", keys: "Ctrl+D", onClick: () => run({ type: "duplicate", clipId: m.clipId! }), disabled: !can || ids.length > 1, sep: true },
      { label: ids.length > 1 ? `دمج ${ids.length} في تسلسل (Nest)` : "دمج في تسلسل (Nest)", onClick: () => run({ type: "nest", clipIds: ids }), disabled: !can },
      ...(f?.clip.seq ? [{ label: "افتح التسلسل المتداخل", onClick: () => run({ type: "seq_open", id: f.clip.seq! }) }] : []),
      { label: "تقسيم عند المؤشر", keys: "S", onClick: split, disabled: !can },
      ...(ids.length > 1 ? [{ label: syncing ? "أزامن الصوت…" : `🎯 زامن الصوت (${ids.length} مقاطع)`, onClick: () => void syncClips(ids), disabled: !can || syncing }] : []),
      ...(video ? [{ label: "فصل صوت الفيديو لمسار", onClick: () => run({ type: "extract_audio", clipId: m.clipId! }), disabled: !can }] : []),
      ...(a && a.kind !== "image" && a.hasAudio ? [{ label: "فصل الكلام والموسيقى والمؤثرات", onClick: () => void separateClip(m.clipId!).catch((e) => flash(e instanceof Error ? e.message : "تعذّر الفصل.", true)), disabled: !can }] : []),
      ...(f && !f.clip.text && f.track.kind === "video" ? [{ label: "التلوين", onClick: () => { setWantTab("color"); pick([m.clipId!]); } }] : []),
      { label: "حذف", keys: "Delete", onClick: () => run({ type: "delete", clipIds: ids, ripple: false }), disabled: !can, danger: true, sep: true },
      { label: "حذف وسحب اللي بعده", keys: "Shift+Delete", onClick: () => run({ type: "delete", clipIds: ids, ripple: true }), disabled: !can, danger: true },
    ];
  };
  const addText = () => {
    run({ type: "add_text", at: at() });
    if (!wide) setSheet("inspector");
  };

  // keyboard: our shortcuts and those of Premiere, Resolve, CapCut and Final Cut at once — on a clash, the program the
  // person chose first wins (see «⌨️ الاختصارات»). Not while typing.
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  const keyMap = useMemo(() => keyTable(keysFrom ?? "jawad"), [keysFrom]);
  // the clip a trim acts on: the chosen one under the playhead, else the top clip there on an unlocked track
  const clipAtHead = (ok: (c: Clip, kind: TrackKind) => boolean = () => true) => {
    const ms = at();
    const t = tlRef.current;
    const hit = (id: string) => {
      const f = findClip(t, id);
      return f && !f.track.locked && ms >= f.clip.start && ms < clipEnd(f.clip) && ok(f.clip, f.track.kind) ? f.clip.id : null;
    };
    for (const id of selected) if (hit(id)) return hit(id);
    for (const tr of [...t.tracks].reverse()) {
      if (tr.locked || tr.hidden) continue;
      const c = tr.clips.find((c) => ms >= c.start && ms < clipEnd(c) && ok(c, tr.kind));
      if (c) return c.id;
    }
    return null;
  };
  const edits = () => [...new Set(tlRef.current.tracks.flatMap((t) => t.clips.flatMap((c) => [c.start, clipEnd(c)])))].sort((a, b) => a - b);
  const keyDo = (action: ActionId, from: ProgramId) => {
    const fps = tlRef.current.fps;
    const ms = at();
    const big = BIG_STEP[from];
    const step = big.ms ?? (big.frames! * 1000) / fps;
    const need = (ok: boolean, msg: string) => (ok ? true : (flash(msg, true), false));
    const busy = readOnly && !["play", "pause", "playFwd", "back", "frameBack", "frameFwd", "bigBack", "bigFwd", "start", "end", "prevEdit", "nextEdit", "nextMarker", "prevMarker", "copy", "selectAll", "deselect", "zoomIn", "zoomOut", "zoomFit", "full", "focus"].includes(action);
    if (busy) return;
    switch (action) {
      case "play":
        return player?.toggle();
      case "pause":
        return player?.playing ? player.pause() : undefined;
      // «J K L»: L forward, J backward, each press again twice as fast (×2, ×4, ×8); K stops
      case "playFwd":
        return player?.shuttle(1);
      case "back":
        return player?.shuttle(-1);
      case "frameBack":
      case "frameFwd":
        return player?.seek(ms + (1000 / fps) * (action === "frameFwd" ? 1 : -1));
      case "bigBack":
      case "bigFwd":
        return player?.seek(Math.max(0, ms + step * (action === "bigFwd" ? 1 : -1)));
      case "start":
        return player?.seek(0);
      case "end":
        return player?.seek(duration(tlRef.current));
      case "prevEdit":
      case "nextEdit": {
        const pts = edits();
        const to = action === "nextEdit" ? pts.find((p) => p > ms + 1) : [...pts].reverse().find((p) => p < ms - 1);
        return to !== undefined ? player?.seek(to) : undefined;
      }
      case "nextMarker":
      case "prevMarker": {
        const mk = tlRef.current.markers;
        const to = action === "nextMarker" ? mk.find((p) => p > ms + 1) : [...mk].reverse().find((p) => p < ms - 1);
        return to !== undefined ? player?.seek(to) : flash("ما فيه علامة بهالاتجاه.", true);
      }
      case "split":
        return split();
      case "splitAll":
        return run({ type: "split", at: ms });
      case "delete":
      case "ripple":
        return remove(action === "ripple");
      case "trimStart":
      case "trimEnd": {
        const id = clipAtHead();
        if (!need(!!id, "حط المؤشر داخل مقطع أول.")) return;
        return run({ type: "trim_clip", clipId: id!, edge: action === "trimStart" ? "start" : "end", to: ms });
      }
      case "duplicate":
        return duplicate();
      case "transition": {
        const id = selected[0] ?? clipAtHead();
        if (!need(!!id, "اختر المقطع اللي تبي الانتقال بعده.")) return;
        return run({ type: "update_clip", clipId: id!, patch: { transition: { kind: "fade", ms: 500 } } });
      }
      case "marker":
        return run({ type: "set_markers", markers: [Math.round(ms)], mode: "add" });
      case "undo":
        return undo();
      case "redo":
        return redo();
      case "copy":
        return selected.length ? copySel() : undefined;
      case "cut":
        return selected.length ? cutSel() : undefined;
      case "paste":
        return pasteable() ? paste() : undefined;
      case "pasteAttrs":
        return pasteAttrs(Object.keys(ATTRS) as Attr[]);
      case "selectAll":
        // all the clips (of the unlocked tracks), to move or delete together
        return setSelected(tlRef.current.tracks.filter((t) => !t.locked).flatMap((t) => t.clips.map((c) => c.id)));
      case "deselect":
        return setSelected([]);
      case "zoomIn":
      case "zoomOut":
      case "zoomFit":
        return void window.dispatchEvent(new CustomEvent(TL_ZOOM, { detail: action === "zoomIn" ? "in" : action === "zoomOut" ? "out" : "fit" }));
      case "full":
        return toggleFull();
      case "focus":
        return setBig((v) => !v);
      case "save":
        return void flush();
      case "import":
        return importInput.current?.click();
      case "export":
        return duration(tlRef.current) ? setExporting(true) : flash("ما فيه شي تصدّره للحين.", true);
      case "markIn":
        setRangeIO((r) => ({ from: Math.round(ms), to: r.to != null && r.to <= ms ? null : r.to }));
        return flash(`بداية منطقة التصدير: ${formatTime(ms)}`);
      case "markOut":
        setRangeIO((r) => ({ from: r.from != null && r.from >= ms ? null : r.from, to: Math.round(ms) }));
        return flash(`نهاية منطقة التصدير: ${formatTime(ms)}`);
      case "clearRange":
        setRangeIO({ from: null, to: null });
        return flash("شلت منطقة التصدير؛ التصدير على المشروع كله.");
    }
  };
  // «واجهات البرامج»: a page, and what a menu item does
  const openPage = (p: PageId) => {
    if (p === "captions") return setCaptioning(true);
    if (p === "deliver") return duration(tlRef.current) ? setExporting(true) : flash("ما فيه شي تصدّره للحين.", true);
    const info = PAGE_INFO[p];
    if (p === "media") setRail("media");
    if (info.tab) {
      // the clip to work on: the chosen one, or the one under the playhead
      // (a picture or a video for colour and effects; anything with sound for the sound page)
      const fits = (c: Clip, kind: TrackKind) => (info.tab === "sound" ? !c.text && (kind === "audio" || !!assets.find((x) => x.id === c.assetId)?.hasAudio) : info.tab === "motion" ? true : !c.text && kind === "video");
      const sel = selected.length === 1 ? findClip(tlRef.current, selected[0]) : null;
      const id = sel && fits(sel.clip, sel.track.kind) ? sel.clip.id : clipAtHead(fits);
      if (!id) {
        flash("اختر مقطع (أو حط المؤشر عليه) وبعدين افتح الصفحة.", true);
        return;
      }
      setWantTab(info.tab);
      setTab(info.tab);
      pick([id]);
      setRail("inspector");
    }
    setPage(p);
  };
  const menuAct = (a: MenuAct) => {
    if ("key" in a) return keyDo(a.key, keysFrom ?? "jawad");
    if ("page" in a) return openPage(a.page);
    if (a.open === "captions") setCaptioning(true);
    else if (a.open === "shortcuts") setKeysOpen("page");
    else if (a.open === "layout") setLayoutOpen(true);
    else if (a.open === "haidara") openClaude();
    else if (a.open === "haidaraDock") {
      const on = !(assisting && chatDock);
      setChatDock(on);
      openClaude(on ? true : assisting);
    }
    else setRail(a.open === "media" ? "media" : a.open === "styles" ? "styles" : "project");
  };
  useEffect(() => {
    keys.current = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      // Safari sends key events without a key (autofill, dictation)
      if (typeof e.key !== "string" || e.isComposing || keysOpen) return;
      const combo = comboOf(e);
      const hit = combo && keyMap.get(combo);
      if (!hit) return;
      // copy/cut/paste with nothing to act on stay the browser's (text on the page)
      if ((hit.action === "copy" || hit.action === "cut") && !selected.length) return;
      if (hit.action === "paste" && !pasteable()) return;
      e.preventDefault();
      keyDo(hit.action, hit.from);
    };
  });
  useEffect(() => {
    const fn = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

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
  // «🎥 على فيديوك» in the motion lab: the filmed clips on the timeline it can build a piece on (played at their own speed)
  const footageClips = useMemo<FootageSource[]>(
    () =>
      tl.tracks.flatMap((t) =>
        t.kind === "text" || t.kind === "audio"
          ? []
          : t.clips.flatMap((c) => {
              const a = c.assetId ? assetMap.get(c.assetId) : null;
              return a && a.kind === "video" && a.url && a.status === "ready" && (c.speed || 1) === 1 && c.out - c.in >= 2000 ? [sourceOf(c, a)] : [];
            }),
      ),
    [tl.tracks, assetMap],
  );
  const total = duration(tl);
  const exportRange = rangeIO.from == null && rangeIO.to == null ? null : { from: Math.max(0, rangeIO.from ?? 0), to: Math.min(total, rangeIO.to ?? total) };
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
  const railNav = (variant: "side" | "clouds" | "pages" | "tabs") => (
    <nav className={`${RAIL_NAV[variant]} ${variant === "side" ? "lg:order-last" : ""}`} aria-label="أقسام المحرر">
      {RAIL.filter((r) => !r.tab || !seen.kind || rail !== "inspector" || TABS_OF[seen.kind].includes(r.tab)).map((r, i) => {
            const label = r.id === "edit" && seen.kind && rail === "inspector" ? EDIT_LABEL[seen.kind] : r.label;
            const on = r.id === "media" ? rail === "media" : r.id === "styles" ? rail === "styles" : r.id === "project" ? rail === "project" : r.id === "haidara" ? rail === "haidara" : r.tab ? rail === "inspector" && tab === r.tab : false;
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={on}
                title={r.hint}
                onClick={() => {
                  if (r.id === "captions") return setCaptioning(true);
                  if (r.id === "haidara") return openClaude(true);
                  if (r.tab) {
                    setTab(r.tab);
                    setRail("inspector");
                  } else setRail(r.id as "media" | "styles" | "project");
                  if (variant === "tabs") setSheet(null);
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
  const oneAsset = one?.clip.assetId ? assetMap.get(one.clip.assetId) : null;
  const oneKind: ClipKindOf | null = one ? (one.clip.text ? "text" : (oneAsset?.kind ?? "video")) : null;
  // the clip under the playhead (the main track first), for a tool pressed with nothing selected
  const underPlayhead = () => {
    const ms = at();
    const hit = (clips: Clip[]) => clips.find((c) => ms >= c.start && ms < clipEnd(c))?.id ?? null;
    const m = mainTrack(tlRef.current);
    return (m && hit(m.clips)) ?? hit(tlRef.current.tracks.flatMap((t) => t.clips));
  };
  const phoneAct = (a: PhoneAction) => {
    const target = () => {
      const id = selected[0] ?? underPlayhead();
      if (!id) flash("حرّك التايملاين لمقطع أول، أو اضغط عليه.", true);
      return id;
    };
    switch (a.kind) {
      case "library":
        return setSheet("library");
      case "split":
        return split();
      case "delete":
        return remove(false);
      case "duplicate":
        return duplicate();
      case "text":
        return addText();
      case "captions":
        return setCaptioning(true);
      case "claude":
        return openClaude(true);
      case "ask":
        openClaude(true);
        return setAsk((q) => ({ text: a.text, n: (q?.n ?? 0) + 1 }));
      case "tab":
        setTab(a.tab);
        return setSheet("inspector");
      case "project":
        setSelected([]);
        return setSheet("inspector");
      case "deselect":
        return setSelected([]);
      case "pick": {
        const id = target();
        if (id) pick([id]);
        return;
      }
      case "extract": {
        const id = target();
        if (id) run({ type: "extract_audio", clipId: id });
        return;
      }
      case "separate": {
        const id = target();
        if (id) void separateClip(id).catch((e) => flash(e instanceof Error ? e.message : "تعذّر الفصل.", true));
        return;
      }
      case "sceneCut":
        setTab("basic");
        return setSheet("inspector");
    }
  };
  // the quick tools over the timeline: the person picks which show (kept on this device)
  const [tools, setTools] = useState<string[]>(DEFAULT_TOOLS);
  const [toolsOpen, setToolsOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const v = JSON.parse(localStorage.getItem("jw-editor-tools") ?? "null");
        if (Array.isArray(v)) setTools(v.filter((x) => typeof x === "string"));
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const pickTools = (list: string[]) => {
    setTools(list);
    try {
      localStorage.setItem("jw-editor-tools", JSON.stringify(list));
    } catch {}
  };
  const [cmp, setCmp] = useState(false);
  const doTool = (id: string) => {
    switch (id) {
      case "split":
        return split();
      case "delete":
        return remove(false);
      case "ripple":
        return remove(true);
      case "duplicate":
        return duplicate();
      case "copy":
        return void copySel();
      case "cut":
        return cutSel();
      case "paste":
        return paste();
      case "attrs":
        return pasteAttrs(Object.keys(ATTRS) as Attr[]);
      case "text":
        return addText();
      case "captions":
        return setCaptioning(true);
      case "extract":
        if (selected[0]) run({ type: "extract_audio", clipId: selected[0] });
        return;
      case "stems":
        if (selected[0]) void separateClip(selected[0]).catch((e) => flash(e instanceof Error ? e.message : "تعذّر الفصل.", true));
        return;
      case "color":
        if (selected[0]) {
          setWantTab("color");
          pick([selected[0]]);
        }
        return;
      case "compare":
        setGradeView(cmp ? "on" : "off");
        setCmp(!cmp);
        player?.seek(player.ms);
        return;
      case "selectAll":
        return setSelected(tlRef.current.tracks.filter((t) => !t.locked).flatMap((t) => t.clips.map((c) => c.id)));
      case "full":
        return toggleFull();
      case "nest":
        if (selected.length) run({ type: "nest", clipIds: selected });
        return;
      case "export":
        return setExporting(true);
    }
  };
  const single = selected.length === 1;
  const some = selected.length > 0;
  const quick: { id: string; label: string; icon: IconName; disabled?: boolean; title?: string; accent?: boolean; pressed?: boolean }[] = [
    { id: "split", label: "قص", icon: "scissors", disabled: readOnly || !total, title: "قص عند المؤشر (S)" },
    { id: "delete", label: "حذف", icon: "trash", disabled: readOnly || !some, title: "حذف (Delete)" },
    { id: "ripple", label: "حذف وسحب", icon: "trash", disabled: readOnly || !some, title: "حذف وسحب اللي بعده (Shift+Delete)" },
    { id: "duplicate", label: "تكرار", icon: "copy", disabled: readOnly || !single, title: "تكرار (Ctrl+D)" },
    { id: "copy", label: "نسخ", icon: "copy", disabled: !some, title: "نسخ (Ctrl+C)" },
    { id: "cut", label: "قص ونسخ", icon: "scissors", disabled: readOnly || !some, title: "قص (Ctrl+X)" },
    { id: "paste", label: "لصق", icon: "download", disabled: readOnly, title: "لصق عند المؤشر (Ctrl+V)" },
    { id: "attrs", label: "لصق السمات", icon: "layers", disabled: readOnly || !some, title: "لصق التلوين والمؤثرات والحركة (Ctrl+Alt+V)" },
    { id: "text", label: "نص", icon: "type", disabled: readOnly, title: "نص فوق الفيديو" },
    { id: "captions", label: "كابشن", icon: "sparkles", disabled: readOnly, title: "كابشن تلقائي من الكلام، مزامنة قصيدة، ملف SRT", accent: true },
    { id: "extract", label: "فصل الصوت", icon: "audio", disabled: readOnly || !single, title: "صوت الفيديو في مسار لحاله" },
    { id: "stems", label: "فصل الكلام", icon: "music", disabled: readOnly || !single, title: "الكلام والموسيقى والمؤثرات كل واحد بمسار" },
    { id: "color", label: "تلوين", icon: "palette", disabled: !single, title: "افتح التلوين للمقطع" },
    { id: "compare", label: "قبل/بعد", icon: "eye", pressed: cmp, title: "اعرض الصورة قبل التلوين" },
    { id: "selectAll", label: "تحديد الكل", icon: "grid", title: "تحديد الكل (Ctrl+A)" },
    { id: "full", label: "ملء الشاشة", icon: "frames", title: "الفيديو على الشاشة كاملة" },
    { id: "nest", label: "Nest", icon: "layers", disabled: readOnly || !some, title: "دمج المقاطع المحددة في تسلسل متداخل" },
    { id: "export", label: "تصدير", icon: "download", title: "صدّر الفيديو" },
  ];

  // «واجهتي» while drawing: where each panel sits, and the floating windows
  // «كاب كت» (the owner): the places are fixed — the menus top left, the screen in the middle, a second window top right
  const floated = (id: PanelId): Rect | undefined => (void id, undefined);
  const placeStyle = (id: PanelId, docked?: React.CSSProperties): React.CSSProperties | undefined => {
    if (!wide) return undefined;
    const r = floated(id);
    const order = id === "preview" ? 2 : id === "panel" ? 3 : 1;
    return r ? { left: r.x, top: r.y, width: r.w, height: r.h, order } : { ...docked, order };
  };
  const floatCls = (id: PanelId) => (floated(id) ? `lg:!fixed ${front === id ? "lg:!z-[57]" : "lg:!z-[56]"} lg:!m-0 lg:!flex lg:flex-col lg:overflow-hidden lg:rounded-2xl lg:border lg:border-jw-line lg:!bg-jw-surface lg:shadow-2xl lg:[resize:both]` : "");
  const floatBar = (id: PanelId) =>
    floated(id) ? (
      <div className="hidden shrink-0 cursor-move select-none items-center gap-2 border-b border-jw-line bg-jw-surface-2 px-2 py-1 text-[11px] font-semibold lg:flex" onPointerDown={(e) => dragWindow(id, e)} title="اسحبها لأي مكان؛ كبّرها من زاويتها">
        <Icon name="grid" size={12} />
        <span className="flex-1">{PANELS[id]}</span>
        <button type="button" className="rounded px-1.5 py-0.5 text-jw-muted hover:bg-jw-surface hover:text-jw-ink" onPointerDown={(e) => e.stopPropagation()} onClick={() => floatToggle(id)}>
          رجّعها مكانها
        </button>
      </div>
    ) : null;
  // the settings panel's edge that faces the picture: drag to make it wider
  const panelAfter = layout.order.indexOf("panel") > layout.order.indexOf("preview");
  const panelEdge = !floated("panel") && wide ? (
    <div role="separator" aria-orientation="vertical" aria-label="غيّر عرض اللوحة" title="اسحب لتعريض اللوحة (ضغطتين: العرض الأصلي)" className={`absolute inset-y-6 z-10 hidden w-2 cursor-col-resize rounded-full hover:bg-jw-accent/40 lg:block ${panelAfter !== T.mirror ? "start-0" : "end-0"}`} onPointerDown={dragPanel} onDoubleClick={() => putLayout({ ...layout, panelW: 320 })} />
  ) : null;

  // حيدرة along the whole side (top to bottom): the editor makes room for him on that side
  // حيدرة is a popup over the work now (never a column beside it)
  const sideChat = false as boolean;
  const chatPad = chatMode === "half" ? "50%" : `${chatW + 12}px`;
  const toolBtn = "flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[11px] text-jw-muted hover:bg-jw-surface-2 hover:text-jw-ink disabled:opacity-40 lg:flex-row lg:gap-1.5 lg:text-xs";

  return (
    <div
      className={`relative flex h-dvh min-h-[480px] flex-col overflow-hidden lg:h-[calc(100dvh-var(--jw-header-h,56px)-var(--jw-bar-h,0px))] lg:min-h-[520px] ${sideChat ? (T.mirror ? "lg:pe-[var(--jw-chat-pad)]" : "lg:ps-[var(--jw-chat-pad)]") : ""}`}
      data-ed-theme={ws ? "ws" : theme}
      data-ed-page={bigPage ? "big" : undefined}
      data-ed-bars={bars}
      // a phone: the editor takes the whole screen (JAWAD AI's header steps aside, sections.css)
      data-ed-full=""
      style={{ ...(bars !== "open" ? ({ "--jw-header-h": "0px", "--jw-bar-h": "0px" } as React.CSSProperties) : {}), ...(ws ? (wsVars(ws) as React.CSSProperties) : {}), ...(T.font ? { fontFamily: `"${familyOf(T.font!)}", var(--jw-font)` } : {}), ...(sideChat ? ({ "--jw-chat-pad": chatPad } as React.CSSProperties) : {}) }}
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
      {/* JAWAD AI's header and sections bar, folded: a thin strip (mini), the real bars (open), or a tiny tab (off) */}
      {bars === "off" ? (
        <button type="button" className="ed-bars-tab" onClick={() => setBars("mini")} aria-label="أظهر شريط الجواد" title="أظهر شريط الجواد">
          <Icon name="chevronDown" size={12} />
        </button>
      ) : (
        <div className="ed-bars-strip">
          {bars === "mini" ? (
            <button type="button" onClick={() => setBars("open")} title="اطلع شريط الجواد والأقسام (صناعة الصور والفيديو وغيرها)">
              <Icon name="chevronDown" size={12} /> JAWAD AI · الأقسام
            </button>
          ) : (
            <button type="button" onClick={() => setBars("mini")} title="صغّر الشريطين">
              <Icon name="chevronUp" size={12} /> صغّر
            </button>
          )}
          <button type="button" onClick={() => setBars("off")} title="خبّي الشريطين تماماً">
            <Icon name="x" size={11} /> إخفاء
          </button>
        </div>
      )}
      {/* top bar */}
      <div className="jw-glass relative z-30 mx-2 mt-2 flex items-center gap-2 rounded-2xl px-2 py-1.5">
        <Link href={backHref} onClick={forgetOpen} className="jw-btn jw-btn-quiet jw-btn-icon shrink-0" aria-label="اطلع من المشروع" title="اطلع من المشروع">
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
        {ws && wide && (
          <>
            {/* (the pages are the menus at the top left now; the colour room and the others stay in the menu bar) */}
            <CommandBar disabled={readOnly} onSend={(text) => pluginCtx().ask(text)} />
          </>
        )}
        <PluginTools
          ctx={pluginCtx} run={run} flash={flash} readOnly={readOnly} className="lg:hidden" />
        {/* «⌨️ الاختصارات»: every key, and whose program wins a clash */}
        {ws && wide && (
          <button type="button" className={`jw-btn jw-3d hidden shrink-0 text-xs lg:inline-flex ${big ? "pro-on" : ""}`} onClick={() => setBig((v) => !v)} aria-pressed={big} title="وضع التركيز: الشاشة والتايملاين بس (⇧F)">
            <Icon name="focus" size={15} /> <span className="hidden xl:inline">تركيز</span>
          </button>
        )}
        {making.length > 0 && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-jw-accent/40 bg-jw-accent/10 px-2.5 py-1 text-[11px] font-semibold text-jw-accent" title={making.map((m) => m.name).join("، ")} aria-live="polite">
            <span className="jw-spinner !h-3 !w-3" /> حيدرة يصنع {making.length === 1 ? `«${making[0].name.slice(0, 24)}»` : `${making.length} أشياء`}
          </span>
        )}
        {/* «⋯ المزيد»: what is used now and then (the shortcuts, the app, the editor's size) — one button instead of four */}
        <div className="relative shrink-0">
          <button type="button" className={`jw-btn jw-3d ${picking ? "border-jw-accent text-jw-accent" : ""}`} onClick={() => setPicking((v) => !v)} aria-expanded={picking} title="المزيد: الاختصارات، التطبيق، حجم الواجهة">
            <Icon name="grid" size={16} /> <span className="hidden md:inline">المزيد</span>
          </button>
          {picking && (
            <div role="menu" aria-label="المزيد" className="jw-glass absolute end-0 top-full z-50 mt-2 w-[20rem] max-w-[90vw] space-y-2 rounded-2xl p-2">
              <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start text-sm hover:bg-jw-surface-2" onClick={() => { setPicking(false); setKeysOpen("page"); }}>
                <Icon name="keyboard" size={15} /> الاختصارات (بريمير، دافنشي، كاب كت، فاينل كت)
              </button>
              <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-sm">
                <span>حجم الواجهة</span>
                <div className="flex items-center rounded-xl border border-jw-line bg-jw-surface-2" role="group" aria-label="حجم الواجهة">
                  <button type="button" className="grid h-8 w-8 place-items-center rounded-s-xl text-jw-muted hover:text-jw-ink disabled:opacity-40" disabled={ui <= 0.7} onClick={() => sizeUi(-0.1)} aria-label="صغّر الواجهة"><Icon name="zoomOut" size={15} /></button>
                  <button type="button" className="min-w-11 text-[11px] tabular-nums text-jw-muted hover:text-jw-ink" onClick={() => sizeUi(1 - ui)} title="الحجم الطبيعي" dir="ltr">{Math.round(ui * 100)}%</button>
                  <button type="button" className="grid h-8 w-8 place-items-center rounded-e-xl text-jw-muted hover:text-jw-ink disabled:opacity-40" disabled={ui >= 1.4} onClick={() => sizeUi(0.1)} aria-label="كبّر الواجهة"><Icon name="zoomIn" size={15} /></button>
                </div>
              </div>
              <div className="border-t border-jw-line pt-2"><InstallApp /></div>
            </div>
          )}
        </div>
        <span className="lg:hidden"><button type="button" className={`jw-btn jw-3d shrink-0 ${assisting ? "border-jw-accent text-jw-accent" : ""}`} disabled={readOnly} onClick={() => openClaude()} aria-pressed={assisting} title="حيدرة">
          <span className="jw-orb h-4 w-4" aria-hidden /> حيدرة
        </button></span>
        <button type="button" className="jw-btn jw-btn-primary jw-3d shrink-0" disabled={readOnly || !total} onClick={() => setExporting(true)}>
          <Icon name="download" size={16} /> <span className="hidden sm:inline">صدّر</span>
        </button>
      </div>

      {ws && wide && !big && <MenuBar ws={ws} keysFrom={keysFrom ?? "jawad"} onAct={menuAct} />}

      {save === "conflict" && (
        <div className="flex flex-wrap items-center gap-2 bg-jw-danger/15 px-3 py-2 text-xs">
          <span className="flex-1">انحفظت نسخة أحدث من هذا المشروع من نافذة ثانية.</span>
          <button type="button" className="jw-btn !min-h-8 text-xs" onClick={() => location.reload()}>حمّل الأحدث</button>
          <button type="button" className="jw-btn !min-h-8 text-xs" onClick={keepMine}>احفظ نسختي فوقها</button>
        </div>
      )}
      {readOnly ? (
        <p className="bg-jw-danger/15 px-3 py-2 text-xs">انحذفت ملفات هذا المشروع. التايملاين باقٍ للعرض فقط؛ ابدأ مشروعًا جديدًا لمونتاج جديد.</p>
      ) : null}

      {colorRoom && !big && <ClipStrip tl={tl} assets={assetMap} thumbs={thumbs} selected={selected} onPick={pick} player={player} />}

      {/* Claude (right) · the preview · the left side: a section and its rail (a computer); sheets on a phone */}
      <div className={`flex min-h-0 flex-1 gap-0 lg:gap-2 lg:px-2 ${T.mirror ? "flex-row-reverse" : ""} ${colorRoom && !big ? "lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:grid-rows-[minmax(0,1fr)_minmax(320px,49%)]" : ""}`}>
        {sheet && <button type="button" aria-label="إغلاق" className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSheet(null)} />}
        {/* حيدرة: a small bubble with his face (dragged anywhere, folded to the side); pressed, his conversation pops up
            in his own black-and-lime window over the work, and «صغّر» folds it back to the bubble */}
        {!assisting && !wide && (
          <MovableBubble id="haidara-chat" corner="left" size={52} label="حيدرة: كلّمني وأعدّل لك المونتاج" gradient="linear-gradient(135deg, #c6ff1a, #3f5a00)" onPress={() => openClaude(true)}>
            <RobotFace id="haidara" size={38} />
          </MovableBubble>
        )}

        {assisting && !wide && (
          <aside className={`hd-pop ${chatBig ? "big" : ""}`} ref={sizeChat} aria-label="حيدرة" dir="rtl">
            <div className="flex min-h-0 flex-1 flex-col" style={chatZoom !== 1 ? { zoom: chatZoom } : undefined}>
              <Guard name="حيدرة"><AssistantPanel big={chatBig} onBig={() => setChatBig((v) => !v)} onDock={wide ? () => setChatDock(true) : undefined} mode={chatMode} zoom={chatZoom} onZoom={zoomChat} ask={ask} onAssets={addAssets} onSeparate={separateClip} onSceneCut={(id: string) => sceneCut(id, "normal", () => {}, new AbortController().signal)} onUpscale={readOnly ? undefined : upscale} projectId={project.id} tl={tl} selected={selected} assets={assetMap} player={player} run={run} onUndo={undo} onClose={() => (setChatBig(false), openClaude(false))} readOnly={readOnly} diag={owner ? diagApp : undefined} onLab={readOnly ? undefined : (brief: string, secs: number, clipId?: string | null) => openLab(brief, secs, clipId)} /></Guard>
            </div>
          </aside>
        )}

        <section ref={stageRef} className={`relative flex min-w-0 flex-1 flex-col ${full ? "fixed inset-0 z-[70] bg-black" : ""} ${floatCls("preview")}`} style={full ? undefined : placeStyle("preview")} aria-label="المعاينة">
          {floatBar("preview")}
          <div ref={stageInner} className={`relative flex min-h-0 flex-1 p-2 ${pz === "fit" || full ? "items-center justify-center overflow-hidden" : "jw-scroll overflow-auto"}`}>
            <canvas
              ref={canvas}
              width={tl.width}
              height={tl.height}
              className={`jw-screen rounded-xl ${pz === "fit" || full ? "max-h-full max-w-full" : "m-auto shrink-0"}`}
              style={pz === "fit" || full ? { aspectRatio: `${tl.width} / ${tl.height}` } : { aspectRatio: `${tl.width} / ${tl.height}`, ...sizeOf(previewSize(stageBox.w, stageBox.h, tl.width, tl.height, pz)) }}
            />
            <Guard name="الإمساك"><Handles tl={tl} canvas={canvasEl} selected={colorRoom ? [] : selected} onSelect={pick} assets={assetMap} run={run} readOnly={readOnly} player={player} /></Guard>
            <button
              type="button"
              className={`jw-glass jw-3d absolute end-3 top-3 z-20 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold ${full ? "hidden" : "flex"}`}
              onClick={() => setBig((v) => !v)}
              aria-label={big ? "صغّر الشاشة" : "كبّر الشاشة"}
              title={big ? "رجّع الشاشة لحجمها (Esc)" : "كبّر الشاشة: تختفي الألواح الجانبية مؤقتًا"}
            >
              <Icon name={big ? "shrink" : "expand"} size={16} />
              <span className="hidden sm:inline">{big ? "صغّر الشاشة" : "كبّر الشاشة"}</span>
            </button>
            {!full && (
              <label className="jw-glass absolute end-3 top-14 z-20 hidden items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold lg:flex" title="تكبير المعاينة: الصورة بنسبة من الشاشة؛ أكبر من الشاشة تتحرك فيها بالسحب">
                <span aria-hidden>🔍</span>
                <select className="bg-transparent text-jw-ink focus:outline-none" value={pz} onChange={(e) => pickZoom(readPreviewZoom(e.target.value))} aria-label="تكبير المعاينة">
                  {PREVIEW_ZOOMS.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.ar}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {/* the video alone on the whole screen, with play / pause */}
            <span className="absolute start-3 top-3 z-20 flex items-center gap-1.5">
              <button type="button" className="jw-glass jw-3d flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold" onClick={toggleFull} aria-pressed={full} title={full ? "اطلع من ملء الشاشة (Esc)" : "الفيديو على الشاشة كاملة"}>
                <Icon name={full ? "shrink" : "frames"} size={16} />
                <span className="hidden sm:inline">{full ? "اطلع من ملء الشاشة" : "ملء الشاشة"}</span>
              </button>
              {full && (
                <button type="button" className="jw-glass jw-3d grid h-9 w-9 place-items-center rounded-full" onClick={() => player?.toggle()} aria-label="شغّل / وقّف" title="شغّل / وقّف (مسافة)">
                  <Icon name="play" size={16} />
                </button>
              )}
            </span>
          </div>
          {toast && (
            <div role="status" className={`pointer-events-none absolute inset-x-3 bottom-3 mx-auto w-fit max-w-full rounded-lg px-3 py-2 text-center text-xs shadow-lg ${toast.bad ? "bg-jw-danger text-white" : "bg-jw-surface-3 text-jw-ink"}`}>
              <Coined text={toast.text} />
            </div>
          )}
        </section>

        {colorRoom && !big && (
          <div className="hidden min-h-0 lg:block" style={{ order: 2 }}>
            <ScopesPanel canvas={canvasEl} player={player} tick={tl} />
          </div>
        )}

        {/* «كاب كت»: the left column — the menus as tabs at its top, what each opens under them (حيدرة too); on a phone
            its parts stay the bottom sheets they were (display: contents) */}
        <div className={`cut-left ${colorRoom || big ? "contents" : "contents lg:relative lg:my-2 lg:flex lg:min-h-0 lg:shrink-0 lg:flex-col lg:overflow-hidden lg:rounded-2xl jw-glass-lg"}`} style={wide && !colorRoom && !big ? { order: 3, width: layout.panelW } : undefined}>
          {wide && !big && !colorRoom && railNav("tabs")}
          {wide && assisting && !big && !colorRoom && (
            <div className={`hd-left min-h-0 flex-1 flex-col ${rail === "haidara" ? "flex" : "hidden"}`} aria-label="حيدرة" dir="rtl">
              <Guard name="حيدرة"><AssistantPanel big={false} mode={chatMode} zoom={chatZoom} onZoom={zoomChat} ask={ask} onAssets={addAssets} onSeparate={separateClip} onSceneCut={(id: string) => sceneCut(id, "normal", () => {}, new AbortController().signal)} onUpscale={readOnly ? undefined : upscale} projectId={project.id} tl={tl} selected={selected} assets={assetMap} player={player} run={run} onUndo={undo} onClose={() => openClaude(false)} readOnly={readOnly} diag={owner ? diagApp : undefined} onLab={readOnly ? undefined : (brief: string, secs: number, clipId?: string | null) => openLab(brief, secs, clipId)} /></Guard>
            </div>
          )}
        <aside
          className={`${sheet === "library" ? "fixed inset-x-0 bottom-0 z-50 flex h-[72dvh] rounded-t-2xl shadow-2xl" : "hidden"} flex-col bg-jw-surface lg:relative lg:z-auto ${rail === "media" && !big ? "lg:flex" : "lg:hidden"} jw-glass-lg lg:my-2 lg:h-auto lg:w-80 lg:shrink-0 lg:rounded-2xl ${rail === "media" ? floatCls("panel") : ""}`}
          style={placeStyle("panel", { width: layout.panelW })}
          ref={rail === "media" ? sizePanel : undefined}
          aria-label="الوسائط"
        >
          {rail === "media" && floatBar("panel")}
          {panelEdge}
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
          className={`${sheet === "inspector" ? "fixed inset-x-0 bottom-0 z-50 flex h-[58dvh] rounded-t-2xl shadow-2xl" : "hidden"} flex-col bg-jw-surface lg:relative lg:z-auto ${(rail === "inspector" || rail === "project") && !big ? "lg:flex" : "lg:hidden"} jw-glass-lg lg:my-2 lg:h-auto lg:shrink-0 lg:rounded-2xl ${colorRoom ? "lg:col-span-2 lg:!m-0 lg:min-h-0 lg:!w-auto" : "lg:w-80"} ${rail === "inspector" || rail === "project" ? floatCls("panel") : ""}`}
          style={placeStyle("panel", colorRoom ? {} : bigPage ? { width: "60%", maxWidth: 1240 } : { width: layout.panelW })}
          ref={rail === "inspector" || rail === "project" ? sizePanel : undefined}
          aria-label="الإعدادات"
        >
          {(rail === "inspector" || rail === "project") && floatBar("panel")}
          {panelEdge}
          <SheetGrip onClose={() => setSheet(null)} title={one ? "تعديل المقطع" : "المشروع"} />
          <div className={`jw-scroll min-h-0 flex-1 ${colorRoom && one ? "overflow-hidden" : "overflow-y-auto"}`}>
            {colorRoom && !one && <p className="room-empty p-6 text-center">اختر لقطة من الشريط فوق عشان تلوّنها.</p>}
            <Guard name="الإعدادات"><Inspector page={bigPage} projectId={project.id} onSync={readOnly ? undefined : (ids) => void syncClips(ids)} syncing={syncing} tl={tl} selected={selected} assets={assetMap} run={run} readOnly={readOnly} player={player} tab={tab} onTab={setTab} flash={flash} rail={wide} projectView={wide && rail === "project"} thumbs={thumbs} onSceneCut={sceneCut} onUpscale={readOnly ? undefined : upscale} onExtend={readOnly ? undefined : extendClip} onSeparate={(id) => separateClip(id).catch((e) => flash(e instanceof Error ? e.message : "تعذّر الفصل.", true))} /></Guard>
          </div>
        </aside>

        <aside className={`relative hidden jw-glass flex-col lg:my-2 lg:w-80 lg:shrink-0 lg:rounded-2xl ${rail === "styles" && !big ? "lg:flex" : ""} ${rail === "styles" ? floatCls("panel") : ""}`} style={placeStyle("panel", { width: layout.panelW })} ref={rail === "styles" ? sizePanel : undefined} aria-label="أساليب جاهزة">
          {rail === "styles" && floatBar("panel")}
          {panelEdge}
          <div className="jw-scroll min-h-0 flex-1 overflow-y-auto">
            <PluginTools inline ctx={pluginCtx} run={run} flash={flash} readOnly={readOnly} />
          </div>
        </aside>
        </div>

        {/* «كاب كت»: the right column — an option that needs its own window opens here (the captions, the export) */}
        {wide && !big && !colorRoom && (
          <div ref={setRightEl} className={`cut-right jw-glass-lg my-2 min-h-0 w-[min(380px,30vw)] shrink-0 flex-col overflow-hidden rounded-2xl ${captioning || exporting ? "flex" : "hidden"}`} style={{ order: 1 }} />
        )}

        {/* the rail of sections at the side (the blue and nature looks) */}
        {/* (the menus are the tabs of the left column now) */}
      </div>


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
        <div className="relative hidden items-center gap-0.5 border-s border-jw-line ps-1 lg:flex">
          {quick.filter((t) => tools.includes(t.id)).map((t) => (
            <button key={t.id} type="button" className={`${toolBtn} ${t.accent ? "text-jw-accent" : ""}`} onClick={() => doTool(t.id)} disabled={t.disabled} title={t.title ?? t.label} aria-pressed={t.pressed}>
              <Icon name={t.icon} size={16} /> {t.label}
            </button>
          ))}
          <button type="button" className={`${toolBtn} !px-1.5`} onClick={() => setToolsOpen((v) => !v)} aria-expanded={toolsOpen} title="اختر أزرار هذا الشريط" aria-label="اختر أزرار الشريط">
            <Icon name="settings" size={15} />
          </button>
          {toolsOpen && (
            <div className="absolute bottom-full start-0 z-40 mb-1 w-64 rounded-xl border border-jw-line bg-jw-surface p-1.5 shadow-2xl" role="menu" aria-label="أزرار الشريط">
              <p className="px-1.5 pb-1 text-[11px] text-jw-muted">اضغط على أي زر يظهر أو يختفي من الشريط</p>
              {quick.map((t) => {
                const on = tools.includes(t.id);
                return (
                  <button key={t.id} type="button" role="menuitemcheckbox" aria-checked={on} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-xs hover:bg-jw-surface-2" onClick={() => pickTools(on ? tools.filter((x) => x !== t.id) : [...tools, t.id])}>
                    <span className={`grid h-4 w-4 place-items-center rounded border ${on ? "border-jw-accent bg-jw-accent text-jw-on-accent" : "border-jw-line"}`}>{on && <Icon name="check" size={11} />}</span>
                    <Icon name={t.icon} size={14} />
                    <span className="flex-1">{t.label}</span>
                  </button>
                );
              })}
              <button type="button" className="mt-1 w-full rounded-md px-2 py-1 text-[11px] text-jw-muted hover:text-jw-ink" onClick={() => pickTools(DEFAULT_TOOLS)}>
                رجّع الأزرار الأصلية
              </button>
            </div>
          )}
        </div>
        <Transport player={player} total={total} name={title} />
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
        {tl.magnetic && (
          <button type="button" className={`${toolBtn} hidden lg:flex ${tl.magnetAll ? "text-jw-accent" : ""}`} onClick={() => run({ type: "set_magnet_all", on: !tl.magnetAll })} disabled={readOnly} title="مغناطيس كل المسارات: الحذف يشيل نفس الثواني من كل المسارات (فوق وتحت) ويسحب اللي بعدها" aria-pressed={tl.magnetAll}>
            <Icon name="magnet" size={16} /> كل المسارات
          </button>
        )}
        <button type="button" className={`${toolBtn} flex ${lab ? "text-jw-accent" : ""} ${labMin ? "animate-pulse" : ""}`} onClick={() => openLab()} disabled={readOnly} title="مختبر الموشن: حيدرة يصمم الموشن ويكتبه بالكود، يراجعه كمخرج، وينزله في التايملاين">
          🎬 <span className="hidden sm:inline">مختبر الموشن</span>
        </button>
      </div>

      {false && assisting && chatDock && wide && (
        <aside className="hd-pop dock" ref={sizeChat} aria-label="حيدرة" dir="rtl">
          <div className="flex min-h-0 flex-1 flex-col" style={chatZoom !== 1 ? { zoom: chatZoom } : undefined}>
            <Guard name="حيدرة"><AssistantPanel big={false} docked onDock={() => setChatDock(false)} mode={chatMode} zoom={chatZoom} onZoom={zoomChat} ask={ask} onAssets={addAssets} onSeparate={separateClip} onSceneCut={(id: string) => sceneCut(id, "normal", () => {}, new AbortController().signal)} onUpscale={readOnly ? undefined : upscale} projectId={project.id} tl={tl} selected={selected} assets={assetMap} player={player} run={run} onUndo={undo} onClose={() => openClaude(false)} readOnly={readOnly} diag={owner ? diagApp : undefined} onLab={readOnly ? undefined : (brief: string, secs: number, clipId?: string | null) => openLab(brief, secs, clipId)} /></Guard>
          </div>
        </aside>
      )}
      {!(big && !wide) && <Guard name="التعديل الذكي"><SmartFix projectId={project.id} tl={tl} assets={assetMap} selected={selected} run={run} player={player} onAssets={addAssets} flash={flash} readOnly={readOnly} studioPath={studioPath} /></Guard>}
      <div className={`jw-glass relative mx-2 mb-2 shrink-0 flex-col overflow-hidden rounded-2xl ${big ? (ws ? "hidden lg:flex lg:h-[36%] lg:min-h-[200px]" : "hidden lg:flex lg:h-[16%] lg:min-h-[110px]") : colorRoom ? "hidden" : bigPage ? "hidden lg:flex lg:h-[16%] lg:min-h-[110px]" : "flex h-[42%] min-h-[190px] lg:h-[36%] lg:min-h-[240px]"}`} style={tlH && wide && !big && !bigPage ? { height: tlH, minHeight: 0 } : undefined}>
        {/* its top edge: drag to make the timeline taller or shorter (double-click: the usual height) */}
        {wide && !big && (
          <div role="separator" aria-orientation="horizontal" aria-label="غيّر ارتفاع التايملاين" title="اسحب لتطويل التايملاين أو تقصيره (ضغطتين: الارتفاع الأصلي)" className="absolute inset-x-8 top-0 z-20 h-2 cursor-row-resize rounded-full hover:bg-jw-accent/40" onPointerDown={dragTimeline} onDoubleClick={resetTimeline} />
        )}
        {wide && <SequenceTabs tl={tl} run={run} readOnly={readOnly} />}
        <div className="min-h-0 flex-1">
        <Guard name="التايملاين"><Timeline range={exportRange} tl={tl} assets={assetMap} thumbs={thumbs} waves={waves} selected={selected} onSelect={pick} onSync={readOnly ? undefined : (ids) => void syncClips(ids)} syncing={syncing} run={run} player={player} compact={!wide} readOnly={readOnly} look={tlLook} onMenu={wide ? openMenu : undefined} onDropFiles={(f, at, tr) => dropFiles(f, at, tr)} onDropAsset={dropAsset} onEmpty={() => setSheet("library")} onTransition={(id) => {
          setWantTab("transition");
          pick([id]);
          if (!wide) setSheet("inspector");
        }} /></Guard>
        </div>
      </div>


      {/* the phone's tool bar (CapCut's way): a row of tools; a section or a selected clip brings its own row */}
      <PhoneTools selected={oneKind} hasAudio={!!oneAsset?.hasAudio} total={total} readOnly={readOnly} on={phoneAct} />

      {lab && !readOnly && <MotionLab projectId={project.id} width={tl.width} height={tl.height} assets={assets} initialBrief={lab.brief} initialSeconds={lab.seconds} footageClips={footageClips} initialFootage={lab.clipId ?? null} onFilm={placeFilm} onClose={() => (setLab(null), setLabMin(false))} minimized={labMin} onMinimize={setLabMin} />}
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

      <KeyStudio player={player} canvas={canvasEl} tl={tl} projectId={project.id} run={run} flash={flash} />
      <ShortcutsPage
        open={!!keysOpen}
        first={keysOpen === "first"}
        program={keysFrom ?? "jawad"}
        onPick={(p) => {
          pickKeys(p);
          if (keysOpen === "first") setKeysOpen(false);
        }}
        onClose={() => {
          // closed without choosing on the first ask: ours win, and it isn't asked again
          if (!keysFrom) pickKeys("jawad");
          setKeysOpen(false);
        }}
      />
      <input
        ref={importInput}
        type="file"
        multiple
        hidden
        accept="video/*,image/*,audio/*,.wav,.mp3,.m4a,.mov,.mkv"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length && !readOnly) dropFiles(files, at(), null);
        }}
      />
      <CaptionsPanel dock={rightEl} open={captioning} onClose={() => setCaptioning(false)} projectId={project.id} tl={tl} assets={assetMap} run={run} flash={flash} />
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
      <ExportPanel
        dock={rightEl}
        open={exporting}
        onClose={() => setExporting(false)}
        projectId={project.id}
        kind={project.kind}
        title={title}
        tl={tl}
        assets={assets}
        flush={flush}
        range={exportRange && exportRange.to > exportRange.from ? exportRange : null}
        onRange={(r) => setRangeIO(r ? { from: r.from, to: r.to } : { from: null, to: null })}
        player={player}
        onExported={() => undefined}
        onUpscaleExport={readOnly ? undefined : (file, target, name) => {
          uploads.add([file], [{ at: 0, trackId: null, mode: "one", group: `expup:${target}:${name}`, first: true }]);
          flash("نرفع الفيديو المصدَّر ونرسله لرفع الدقة…");
        }}
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
function Transport({ player, total, name }: { player: Player | null; total: number; name: string }) {
  const [state, setState] = useState({ ms: 0, playing: false, rate: 1 });
  const [saving, setSaving] = useState(false);
  // «احفظ الفريم»: the frame where the video is stopped, as a PNG at the project's size
  const saveFrame = async () => {
    if (!player || saving) return;
    if (player.playing) player.toggle();
    setSaving(true);
    try {
      const blob = await player.frameBlob();
      if (!blob) return alert("ما قدرت أحفظ هذا الفريم. جرّب مرة ثانية.");
      const stamp = formatTime(player.ms).replace(/[:.]/g, "-");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(name || "frame").replace(/[\\/:*?"<>|]/g, "").slice(0, 60)}-${stamp}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } finally {
      setSaving(false);
    }
  };
  useEffect(() => {
    if (!player) return;
    let last = 0;
    return player.subscribe((ms, playing) => {
      const now = performance.now();
      if (playing && now - last < 90) return;
      last = now;
      setState({ ms, playing, rate: player.rate });
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
      {state.playing && state.rate !== 1 && (
        <span className="rounded-full bg-jw-accent/15 px-2 py-0.5 text-[11px] font-bold tabular-nums text-jw-accent" title="سرعة التشغيل (J / K / L)">
          {rateLabel(state.rate)}
        </span>
      )}
      <button type="button" className="ms-1 grid h-8 w-8 place-items-center rounded-full text-jw-muted hover:text-jw-ink disabled:opacity-40" onClick={saveFrame} disabled={!total || saving} aria-label="احفظ الفريم صورة" title="احفظ الفريم صورة (PNG)">
        <Icon name="camera" size={15} />
      </button>
      <QualityPick player={player} />
      <PerfPick />
    </div>
  );
}

/** A size for a style, from the preview's measure. */
const sizeOf = (p: { w: number; h: number }) => ({ width: p.w, height: p.h, maxWidth: "none", maxHeight: "none" });

/**
 * «⚙️ الأداء»: which part of the computer does what — automatic (measured), the graphics card, the processor or the
 * integrated graphics — and how much of it the editor may take; «قيّم جهازي» times the same keying work on both and
 * shows the decision for the timeline and for the export.
 */
function PerfPick() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<PerfPrefs>(() => ({ mode: "auto", share: 100 }));
  const [device, setDevice] = useState<DeviceReport | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPrefs(loadPerf()), 0);
    return () => clearTimeout(t);
  }, []);
  const change = (p: PerfPrefs) => {
    setPrefs(p);
    savePerf(p);
    // the GL contexts are made again with the new power preference on the next frame
    resetKeyGl();
    resetGradeGl();
  };
  const bench = async () => {
    setBusy(true);
    try {
      setDevice(await benchDevice());
    } catch (e) {
      diagNote(`قياس الجهاز ما نجح: ${e instanceof Error ? e.message : String(e)}`);
      setDevice(deviceNow());
    } finally {
      setBusy(false);
    }
  };
  const d = device ?? (open ? deviceNow() : null);
  const plans = open ? [perfPlan("timeline"), perfPlan("render")] : [];
  return (
    <span className="relative">
      <button type="button" className={`ms-1 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${open ? "border-jw-accent text-jw-accent" : "border-jw-line text-jw-muted"}`} onClick={() => setOpen((v) => !v)} aria-expanded={open} title="الأداء: المعالج أو كرت الشاشة، ونسبة الاستخدام">
        <span aria-hidden>⚙️</span>
        <span dir="rtl">{PERF_MODES.find((m) => m.id === prefs.mode)?.ar ?? "الأداء"}</span>
      </button>
      {open && (
        <div className="jw-glass-lg absolute bottom-full end-0 z-40 mb-2 w-[22rem] max-w-[90vw] space-y-2 rounded-2xl p-3 text-start text-xs shadow-2xl" dir="rtl" role="dialog" aria-label="الأداء">
          <div className="flex items-center justify-between">
            <b>⚙️ الأداء</b>
            <button type="button" className="text-jw-muted hover:text-jw-ink" onClick={() => setOpen(false)} aria-label="أغلق">
              ✕
            </button>
          </div>
          <div className="jw-seg flex flex-wrap gap-1" role="radiogroup" aria-label="من يشتغل">
            {PERF_MODES.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={prefs.mode === m.id} title={m.hint} className={`rounded-full border px-2.5 py-1 ${prefs.mode === m.id ? "border-jw-accent bg-jw-accent/15 text-jw-ink" : "border-jw-line text-jw-muted"}`} onClick={() => change({ ...prefs, mode: m.id })}>
                {m.ar}
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-5 text-jw-faint">{PERF_MODES.find((m) => m.id === prefs.mode)?.hint}</p>
          <label className="flex items-center justify-between gap-2">
            <span>نسبة استخدام الجهاز</span>
            <select className="jw-input !min-h-8 w-24 text-xs" value={prefs.share} onChange={(e) => change({ ...prefs, share: Number(e.target.value) })} aria-label="نسبة استخدام الجهاز">
              {PERF_SHARES.map((v) => (
                <option key={v} value={v}>
                  {v}٪
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-1 border-t border-jw-line pt-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-jw-muted">جهازك</span>
              <button type="button" className="jw-btn jw-3d !min-h-7 !px-2 text-[11px]" onClick={bench} disabled={busy}>
                {busy ? "أقيس…" : "🧪 قيّم جهازي"}
              </button>
            </div>
            {d && <p className="text-[11px] leading-5" dir="auto">{describeDevice(d)}</p>}
            {d?.bench && (
              <p className="text-[11px] leading-5 text-jw-muted">
                القياس (٢٤ فريم كي): الكرت {Number.isFinite(d.bench.gpuMs) ? `${Math.round(d.bench.gpuMs)} ملّي ثانية` : "ما اشتغل"} · المعالج {Math.round(d.bench.cpuMs)} ملّي ثانية
              </p>
            )}
            <ul className="list-disc space-y-0.5 ps-4 text-[11px] leading-5">
              {plans.flatMap((p) => p.why).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </span>
  );
}

/** «جودة العرض»: the preview at full size, a half, a quarter or an eighth (kept on this device; the export is full). */
const QUALITIES: [number, string][] = [
  [1, "كاملة"],
  [0.5, "نص"],
  [0.25, "ربع"],
  [0.125, "ثمن"],
];
function QualityPick({ player }: { player: Player | null }) {
  const [q, setQ] = useState(1);
  useEffect(() => {
    let v = 1;
    try {
      v = Number(localStorage.getItem("jw-editor-q")) || 1;
    } catch {
      /* the normal size */
    }
    if (QUALITIES.some(([x]) => x === v) && v !== 1) {
      const t = setTimeout(() => setQ(v), 0);
      player?.setQuality(v);
      return () => clearTimeout(t);
    }
  }, [player]);
  return (
    <label className="ms-1 flex items-center gap-1 rounded-full border border-jw-line px-2 py-0.5 text-[11px] text-jw-muted" title="جودة العرض: أقل = أخف على جهازك. التصدير دايم بالجودة الكاملة.">
      <span dir="rtl">الجودة</span>
      <select
        className="bg-transparent text-jw-ink focus:outline-none"
        value={q}
        onChange={(e) => {
          const v = Number(e.target.value);
          setQ(v);
          player?.setQuality(v);
          try {
            localStorage.setItem("jw-editor-q", String(v));
          } catch {
            /* not kept */
          }
        }}
        aria-label="جودة العرض"
      >
        {QUALITIES.map(([v, ar]) => (
          <option key={v} value={v}>
            {ar}
          </option>
        ))}
      </select>
    </label>
  );
}
