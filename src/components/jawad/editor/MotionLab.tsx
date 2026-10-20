"use client";

// «🎬 مختبر الموشن» — حيدرة makes a motion piece in CODE, and the lab is ONE CONVERSATION (the owner's way, the way his
// own reels were made): the person says what they want → the SCENARIO comes as a card (idea, hook, look, the shot table)
// and waits for «اعتمد وابنِ» → the pictures it needs that nobody gave are made by GPT Image 2 (no writing in them) →
// حيدرا ماكس writes the program while the person watches it being written → the browser runs it in a sandbox and every
// bug goes back to him → (if asked) he looks at contact sheets and scores them like a harsh director → each build is a
// VERSION with its own draft video in the conversation, never written over → a note changes only what it names → the
// final film is rendered here with motion blur and lands on the timeline → the cover is designed in code by the owner's
// cover skill. Every conversation is kept on the server (migration 0087) and a project has as many as the person opens.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { api, postJson } from "@/lib/fetch";
import { useClaudeModel } from "@/components/robots/claude-model";
import ClaudeModelPicker from "@/components/robots/ClaudeModelPicker";
import { readCues, type Cue, type LabPlan, type Review } from "@/lib/editor/scene/contract";
import { storeOf } from "./lab-tabs";
import { partialField, postWatch } from "./lab-watch";
import { COVER_PASS, COVER_ROUNDS, COVER_RUBRIC, type CoverRubricId } from "@/lib/editor/scene/cover-rubric";
import { lowerEffort } from "@/lib/editor/scene/resume";
import { LabSetupError, onDeviceOnly, readLocalFile } from "./footage-check";
import { MAX_ROUNDS, PASS, RUBRIC } from "@/lib/editor/scene/skill";
import { FONT_BY_ID } from "@/lib/editor/fonts";
import { LAB_GROUPS, chosenOptions, type ChoiceKey, type LabChoices, type LabGroup } from "@config/editor/lab-options";
import { SceneError, SceneHost, sceneFont, type SceneInfo, type ScenePar } from "./scene-host";
import { canExport, contactSheet, cutTimes, frameCost, sheetAt, probe, renderVideo, reviewTimes, stills } from "./scene-render";
import { download } from "./export";
import LabVoice, { type LabVoiceTake } from "./LabVoice";
import { mixSoundtrack, SoundPreview } from "./lab-sound";
import { makeMusicAsset } from "./make";
import { drawDemo, STUDIO, type Swatch } from "./lab-demos";
import type { EditorAsset } from "./types";
import { checkFootage, footageFrames, footageMatte, footageSeconds, footageSound, FootageSet, footageTotal, prepareFootage, type FootageInfo, type FootageSource } from "./lab-footage";
import { footageLines, type FootageFrame, type FootageMeta } from "@/lib/editor/scene/footage";
import "./motion-lab.css";

type Stage = "brief" | "planning" | "plan" | "building" | "reviewing" | "ready" | "rendering";
const REVIEW_MODES = {
  fast: { label: "بدون مراجعة", rounds: 0, description: "فحص التشغيل فقط، بدون مراجعة جودة. الأسرع والأرخص (الافتراضي)." },
  balanced: { label: "متوازن", rounds: 1, description: "مراجعة جودة واحدة وتصحيح عند الحاجة." },
  precise: { label: "دقيق", rounds: MAX_ROUNDS, description: `حتى ${MAX_ROUNDS} جولات، ويتوقف مبكرًا إذا اجتاز. أطول.` },
} as const;
type ReviewMode = keyof typeof REVIEW_MODES;
interface Saved {
  reviewMode?: ReviewMode;
  brief: string;
  seconds: number;
  intensity: number;
  brand: string;
  picks: string[];
  choices?: LabChoices;
  plan: LabPlan | null;
  say: string;
  code: string;
  reviews: Review[];
  /** خلفية شفافة: الأشخاص/العناصر بدون خلفية، تصدّر WebM منفصل بدل ما تدخل التايملاين مباشرة */
  transparent?: boolean;
  /** هل الكود المحفوظ حاليًا مكتوب فعلًا بدون خلفية (يختلف عن `transparent` لو حطّوه بعد ما بنى المشهد) */
  transparentCode?: boolean;
  /** «🎙️ بصوتي»: the person records the narration in their own voice */
  voiceOn?: boolean;
  /** the music: made in code (free), by ElevenLabs, or none */
  musicMode?: MusicMode;
  /** «🎥 على فيديوك»: the timeline clip the piece is built on, and what was learnt about it (words, face) */
  footId?: string | null;
  /** several clips, joined in the order chosen */
  footIds?: string[];
  footMeta?: FootageMeta | null;
  /** «✂️ الكلام ورا الراس»: the person cut out for the piece */
  personOn?: boolean;
  chat?: ChatMsg[];
  params?: Record<string, string>;
  /** every build the person has seen, by number (never written over; the last few are kept) */
  versions?: Version[];
  /** the pictures GPT Image 2 made for this conversation (by the request's fingerprint → the library's id) */
  made?: Record<string, string>;
  /** the cover designed for the piece (its program and headline; the picture itself is in the library) */
  cover?: { code: string; headline: string; assetId: string | null; review: CoverScores | null } | null;
  /** a conversation another robot opened with a brief (محمد باقر's motion piece): the scenario is written by itself */
  autoPlan?: boolean;
}
/** One build the person has seen: what it was made from (a note never writes over it). */
interface Version {
  n: number;
  at: number;
  plan: LabPlan;
  code: string;
  params: Record<string, string>;
}
interface CoverScores {
  scores: Record<CoverRubricId, number>;
  problems: string[];
  verdict: string;
  pass: boolean;
  low: number;
}
/** What a turn of the conversation shows besides its words: the lab's steps as cards. */
type Card =
  | { k: "plan"; plan: LabPlan; say?: string }
  | { k: "work"; title: string; lines: string[]; chars?: number }
  | { k: "pictures"; items: { name: string; assetId: string | null; error?: string }[] }
  | { k: "version"; n: number; title: string }
  | { k: "review"; review: Review; round: number }
  | { k: "cover"; assetId: string | null; headline: string; review: CoverScores | null };
/** one turn of the lab's conversation */
interface ChatMsg {
  role: "user" | "assistant";
  text: string;
  card?: Card;
  /** short replies the person can press (the last assistant turn's are shown) */
  options?: string[];
}
/** The most versions a conversation keeps (each holds its whole program). */
const KEEP_VERSIONS = 6;
/** The scene a finished film was made from, kept with the film (so it stays editable on the timeline). */
export interface LabSource {
  v: 1;
  plan: LabPlan;
  code: string;
  params: Record<string, string>;
  /** the scene's editable values as it declared them */
  fields?: ScenePar[];
  picks: string[];
  choices: LabChoices;
  musicMode: MusicMode;
  brief: string;
  /** the clip(s) it was built on, in order (one object in films made before several clips could be chosen) */
  footage: FootageSource[] | FootageSource | null;
  footMeta: FootageMeta | null;
  personOn: boolean;
  chat: ChatMsg[];
}
/** how the person's video sits in a shot, in the plan's list */
const FRAME_AR: Record<FootageFrame, string> = { full: "🧍 ملء الشاشة", card: "🪟 بطاقة عائمة", split: "◧ شاشة مقسومة", corner: "⭕ بالزاوية", away: "✨ موشن كامل", over: "🔤 كلام بجنبك" };
type MusicMode = "code" | "eleven" | "none";
const MUSIC_MODES: { id: MusicMode; ar: string; tip: string }[] = [
  { id: "code", ar: "🎹 موسيقى بالكود", tip: "حيدرة يكتبها بالكود على إيقاع المشهد (مجانًا)" },
  { id: "eleven", ar: "🎵 موسيقى ElevenLabs", tip: "تنصنع وقت التصدير وتنحسب بسعرها" },
  { id: "none", ar: "🔇 بدون موسيقى", tip: "مؤثرات (وصوتك) فقط" },
];
/** the library's sounds (their links), read once for the preview and the mix */
let sfxLinks: Promise<Map<string, string>> | null = null;
const libraryLinks = () =>
  (sfxLinks ??= api<{ items: { id: string; url: string | null }[] }>("/api/jawad/editor/sfx-library")
    .then((r) => new Map(r.items.filter((i) => i.url).map((i) => [i.id, i.url!])))
    .catch(() => {
      sfxLinks = null;
      return new Map<string, string>();
    }));
const key = (id: string) => `jw-lab-${id}`;
/** The library copy of a video that lives only on the computer, kept so it is never put up twice. */
const readServerCopy = (projectId: string, localAssetId: string): string => {
  try {
    const v = JSON.parse(localStorage.getItem(`jw-lab-up-${projectId}`) ?? "{}") as Record<string, unknown>;
    return typeof v[localAssetId] === "string" ? (v[localAssetId] as string) : "";
  } catch {
    return "";
  }
};
const saveServerCopy = (projectId: string, localAssetId: string, copyId: string) => {
  try {
    const v = JSON.parse(localStorage.getItem(`jw-lab-up-${projectId}`) ?? "{}") as Record<string, unknown>;
    localStorage.setItem(`jw-lab-up-${projectId}`, JSON.stringify({ ...v, [localAssetId]: copyId }));
  } catch {
    /* not kept */
  }
};

/** A short fingerprint of a text (to tell whether a kept half-written program belongs to this very request). */
const hashOf = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
};
/** The half-written program kept on the device for this project's current writing request (empty when none). */
const readPart = (id: string, sig: string): string => {
  try {
    const v = JSON.parse(localStorage.getItem(`jw-lab-part-${id}`) ?? "null") as { sig?: string; partial?: string } | null;
    return v && v.sig === sig && typeof v.partial === "string" ? v.partial : "";
  } catch {
    return "";
  }
};
const savePart = (id: string, sig: string, partial: string) => {
  try {
    if (partial) localStorage.setItem(`jw-lab-part-${id}`, JSON.stringify({ sig, partial }));
    else localStorage.removeItem(`jw-lab-part-${id}`);
  } catch {
    /* not kept */
  }
};
const SECONDS = [6, 10, 15, 20, 30, 45, 60];
const INTENSITY: [number, string][] = [[1, "هادئ وفخم"], [3, "متوازن"], [4, "قوي"], [5, "ناري"]];
/** Milliseconds as «٢:٣٠» (minutes and seconds), for a wait a person is watching. */
const mmss = (ms: number) => `${Math.floor(Math.max(0, ms) / 60_000)}:${String(Math.round((Math.max(0, ms) % 60_000) / 1000)).padStart(2, "0")}`;
const subscribeToClient = () => () => undefined;

/** A picture from the device, made small for حيدرة's eyes (long side 768, JPEG). */
async function refOf(file: File): Promise<string> {
  const bm = await createImageBitmap(file);
  const s = Math.min(1, 768 / Math.max(bm.width, bm.height));
  const c = new OffscreenCanvas(Math.round(bm.width * s), Math.round(bm.height * s));
  c.getContext("2d")!.drawImage(bm, 0, 0, c.width, c.height);
  bm.close();
  const b = new Uint8Array(await (await c.convertToBlob({ type: "image/jpeg", quality: 0.84 })).arrayBuffer());
  let str = "";
  for (let i = 0; i < b.length; i += 0x8000) str += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(str);
}

/** A picture as base64 JPEG (for حيدرة's eyes), drawn from a part of a bitmap at a given width. */
async function jpegOf(bm: ImageBitmap, sx: number, sy: number, sw: number, sh: number, w: number, quality = 0.86): Promise<string> {
  const c = new OffscreenCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round((w * sh) / sw)));
  const x = c.getContext("2d")!;
  x.imageSmoothingQuality = "high";
  x.drawImage(bm, sx, sy, sw, sh, 0, 0, c.width, c.height);
  const b = new Uint8Array(await (await c.convertToBlob({ type: "image/jpeg", quality })).arrayBuffer());
  let str = "";
  for (let i = 0; i < b.length; i += 0x8000) str += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(str);
}
/** What حيدرة looks at to judge a cover: full size, the SAME cover at the profile grid's 12 % (the cover skill's
 * number), and its 1:1 and 3:4 crops from the centre (a landscape thumbnail: full and its small side-bar size). */
async function coverViews(bm: ImageBitmap, w: number, h: number): Promise<string[]> {
  const full = await jpegOf(bm, 0, 0, w, h, Math.min(w, 1080));
  if (w > h) return [full, await jpegOf(bm, 0, 0, w, h, Math.round(w * 0.17))];
  const sq = Math.min(w, h), y34 = Math.round((h - (w * 4) / 3) / 2);
  return [full, await jpegOf(bm, 0, 0, w, h, Math.round(w * 0.12)), await jpegOf(bm, 0, Math.round((h - sq) / 2), sq, sq, 540), await jpegOf(bm, 0, Math.max(0, y34), w, Math.min(h, Math.round((w * 4) / 3)), 540)];
}
/** A bitmap as a PNG file's bytes. */
async function bitmapPng(bm: ImageBitmap): Promise<Blob> {
  const c = new OffscreenCanvas(bm.width, bm.height);
  c.getContext("2d")!.drawImage(bm, 0, 0);
  return c.convertToBlob({ type: "image/png" });
}

/** One live sample of the gallery: a small canvas looping its drawing (about 24 frames a second, only while shown). */
function Demo({ kind, swatch }: { kind: string; swatch: Swatch }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let raf = 0, last = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 40) return;
      last = now;
      drawDemo(kind, ctx, c.width, c.height, (now - t0) / 1000, swatch);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [kind, swatch]);
  return <canvas ref={ref} width={200} height={150} aria-hidden />;
}

/** The gallery: the nine groups, one open at a time; each card a live sample; «خلّه لحيدرة» leaves the group to him. */
function Gallery({ choices, onChange, disabled }: { choices: LabChoices; onChange: (c: LabChoices) => void; disabled: boolean }) {
  const [open, setOpen] = useState<ChoiceKey>("look");
  const toggle = (g: LabGroup, id: string) => {
    const now = choices[g.id] ?? [];
    let next: string[];
    if (g.multi) next = now.includes(id) ? now.filter((x) => x !== id) : [...now, id].slice(-(g.max ?? 3));
    else next = now[0] === id ? [] : [id];
    const c = { ...choices };
    if (next.length) c[g.id] = next;
    else delete c[g.id];
    onChange(c);
  };
  return (
    <div className="flex flex-col gap-3">
      {LAB_GROUPS.map((g) => {
        const picked = (choices[g.id] ?? []).map((id) => g.options.find((o) => o.id === id)?.ar).filter(Boolean);
        return (
          <details key={g.id} className="mlab-group" open={open === g.id} onToggle={(e) => (e.target as HTMLDetailsElement).open && setOpen(g.id)}>
            <summary>
              <span>
                {g.ar} <span className="mlab-tip">· {g.hint}</span>
              </span>
              {picked.length ? <span className="picked">✓ {picked.join(" · ")}</span> : <span className="free">خلّه لحيدرة</span>}
            </summary>
            {open === g.id && (
              <div className="mlab-grid">
                <button type="button" className="mlab-opt free" aria-pressed={!picked.length} disabled={disabled} onClick={() => onChange(Object.fromEntries(Object.entries(choices).filter(([k]) => k !== g.id)) as LabChoices)}>
                  <span className="name">خلّه لحيدرة</span>
                  <span className="tip">يختار من الفكرة</span>
                </button>
                {g.options.map((o) => (
                  <button key={o.id} type="button" className="mlab-opt" aria-pressed={(choices[g.id] ?? []).includes(o.id)} disabled={disabled} onClick={() => toggle(g, o.id)} title={o.en}>
                    <Demo kind={o.demo} swatch={o.swatch ?? STUDIO} />
                    <span className="name">{o.ar}</span>
                    <span className="tip">{o.tip}</span>
                    <span className="from">{o.from}</span>
                  </button>
                ))}
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}

export default function MotionLab({
  projectId,
  width,
  height,
  assets,
  initialBrief = "",
  initialSeconds,
  onFilm,
  onClose,
  minimized,
  onMinimize,
  tabId = "main",
  active = true,
  tabBar = null,
  onStatus,
  onTitle,
  footageClips = [],
  initialFootage = null,
  initialSource = null,
  onUpload,
  chatId = null,
  onChatId,
}: {
  projectId: string;
  width: number;
  height: number;
  assets: EditorAsset[];
  initialBrief?: string;
  initialSeconds?: number;
  /** the finished film, its cues and whether music is wanted (the editor uploads it and places everything) */
  onFilm: (film: File, cues: Cue[], music: { prompt: string; ms: number } | null, place?: { at: number; muteClipIds: string[] }, lab?: { source: LabSource; replaceAssetId: string | null }) => void;
  onClose: () => void;
  /** folded to the pill — kept by the editor, so its «مختبر الموشن» button can bring the window back */
  minimized: boolean;
  onMinimize: (v: boolean) => void;
  /** which tab of the lab this is: its work is kept apart from the other tabs' (the first tab keeps the lab's old key) */
  tabId?: string;
  /** the tab on show; the others stay mounted (their work goes on) but hidden */
  active?: boolean;
  /** the strip of tabs, drawn at the top of the window */
  tabBar?: ReactNode;
  /** what this tab is doing, for the folded pill and the tab strip */
  onStatus?: (s: { busy: boolean; label: string; work: boolean }) => void;
  /** the tab's name: its plan's title, or the start of its idea */
  onTitle?: (t: string) => void;
  /** «🎥 على فيديوك»: the video clips on the timeline the piece can be built on */
  footageClips?: FootageSource[];
  /** opened by حيدرة on one of them */
  initialFootage?: string | null;
  /** a film of the timeline opened again: its scene, the values to apply, and whether to render it straight away */
  initialSource?: { assetId: string; source: LabSource; params?: Record<string, string>; auto?: boolean } | null;
  /** a picture from the device, attached in the conversation: up to the library, then usable in the scene */
  onUpload?: (file: File, onProgress?: (p: number) => void) => Promise<EditorAsset>;
  /** the conversation kept on the server this tab shows (opened from the list), or null for a new one */
  chatId?: string | null;
  /** the server's id of this tab's conversation, once it is first kept */
  onChatId?: (id: string) => void;
}) {
  const [claude] = useClaudeModel();
  const store = storeOf(projectId, tabId);
  const [stage, setStage] = useState<Stage>("brief");
  // the lab IS the conversation; «⚙️ التجهيزات» (the clip, the length, the voice, the music, the pictures, the look) opens
  // above the box for whoever wants to set things by hand
  const [drawer, setDrawer] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  // the draft videos of this session (by version): made on this device, played in the conversation
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [draftAt, setDraftAt] = useState<{ n: number; p: number } | null>(null);
  // the program as حيدرا ماكس writes it (shown live in the conversation while he writes)
  const [liveCode, setLiveCode] = useState("");
  const [made, setMade] = useState<Record<string, string>>({});
  const [cover, setCover] = useState<Saved["cover"]>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  // the conversation on the server: its id once kept, and whether the server can keep it at all (migration 0087)
  const [serverId, setServerId] = useState<string | null>(chatId);
  const [serverMissing, setServerMissing] = useState(false);
  const [chatText, setChatText] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  // pictures attached in the conversation from the device: in the library now, until the editor's list has them
  const [extra, setExtra] = useState<EditorAsset[]>([]);
  // «✏️ النصوص والألوان»: the person's own values over the scene's (shown text and main colours)
  const [params, setParams] = useState<Record<string, string>>({});
  const chatEnd = useRef<HTMLDivElement>(null);
  // «♻️ طبّق» from the timeline renders once
  const autoDone = useRef(false);
  const [brief, setBrief] = useState(initialBrief);
  const [seconds, setSeconds] = useState(() => SECONDS.reduce((a, b) => (Math.abs(b - (initialSeconds || 15)) < Math.abs(a - (initialSeconds || 15)) ? b : a), 15));
  const [intensity, setIntensity] = useState(4);
  const [brand, setBrand] = useState("");
  const [picks, setPicks] = useState<string[]>([]);
  const [choices, setChoices] = useState<LabChoices>({});
  const [refs, setRefs] = useState<string[]>([]);
  const [plan, setPlan] = useState<LabPlan | null>(null);
  const [say, setSay] = useState("");
  const [tweak, setTweak] = useState("");
  const [code, setCode] = useState("");
  const [info, setInfo] = useState<SceneInfo | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  // the owner's choice: no visual review unless the person asks for it before building (it takes longer and costs more)
  const [reviewMode, setReviewMode] = useState<ReviewMode>("fast");
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // the sound: the person's own voice (recorded, cleaned by Claude Code), the music, and the mix heard with the picture
  const [voiceOn, setVoiceOn] = useState(false);
  const [musicMode, setMusicMode] = useState<MusicMode>("code");
  const [take, setTake] = useState<LabVoiceTake | null>(null);
  const [soundtrack, setSoundtrack] = useState<AudioBuffer | null>(null);
  const [soundBusy, setSoundBusy] = useState(false);
  const [alsoDownload, setAlsoDownload] = useState(false);
  const preview = useRef<SoundPreview | null>(null);
  // «🎥 على فيديوك»: the clip chosen, what was learnt about it, its frames' reader and its own sound
  // the clips the piece is built on, in the order the person chose them (joined one after another)
  const [footIds, setFootIds] = useState<string[]>(initialFootage ? [initialFootage] : []);
  const [foot, setFoot] = useState<FootageInfo | null>(null);
  const reader = useRef<{ key: string; r: FootageSet } | null>(null);
  // can this browser make the film at all? (Safari on iPhone often cannot encode) — asked once, before any paid step
  const [encodes, setEncodes] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    void canExport(width, height).then((ok) => live && setEncodes(ok));
    return () => {
      live = false;
    };
  }, [width, height]);
  // «✂️ الكلام ورا الراس»: the person cut out of the clip (made once on the server), and its reader
  const [personOn, setPersonOn] = useState(false);
  const matte = useRef<{ key: string; urls: Map<string, string>; r: FootageSet | null }>({ key: "", urls: new Map(), r: null });
  const footVoice = useRef<{ key: string; parts: { blob: Blob; at: number }[] } | null>(null);
  // «خلفية شفافة»: الطلب نفسه (تقدر تشيله قبل ما تبني، أو بعد ما يخلص)، وهل الكود المحفوظ يطابقه فعلًا
  const [transparent, setTransparent] = useState(false);
  const [transparentCode, setTransparentCode] = useState(false);
  const [progress, setProgress] = useState(0);
  /** the render as it really runs on this device: which frame, how many, and the seconds left by the measured rate */
  const [renderAt, setRenderAt] = useState<{ frame: number; frames: number; leftMs: number } | null>(null);
  /** how long the step running now has taken (a long wait is honest, a silent one looks broken) */
  const [now, setNow] = useState(0);
  const host = useRef<SceneHost | null>(null);
  const abort = useRef<AbortController | null>(null);
  const viewCanvas = useRef<HTMLCanvasElement>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const portalReady = useSyncExternalStore(subscribeToClient, () => true, () => false);
  const setMinimized = onMinimize;
  const say1 = (s: string) => setLog((l) => [...l.slice(-30), s]);
  /** a line for the log and for the conversation's live work card */
  const tell = (s: string) => (say1(s), workLine(s));
  /** a line that keeps changing (a percentage): it takes the place of the one before it when that is a ⬆️ line */
  const sayLive = (s: string) => setLog((l) => (l.length && l[l.length - 1].startsWith("⬆️") ? [...l.slice(0, -1), s] : [...l.slice(-30), s]));

  // pictures from the library the scene may use, with short ids حيدرة writes in his code (a1, a2…)
  const images = useMemo(() => {
    const all = [...extra.filter((x) => !assets.some((a) => a.id === x.id)), ...assets];
    return all.filter((a) => a.kind === "image" && a.url && a.status === "ready").slice(0, 40);
  }, [assets, extra]);
  const chosen = useMemo(() => picks.map((id, i) => ({ short: `a${i + 1}`, asset: images.find((a) => a.id === id)! })).filter((x) => x.asset), [picks, images]);
  const assetList = chosen.map((c) => ({ id: c.short, name: c.asset.name, w: c.asset.width ?? 0, h: c.asset.height ?? 0 }));
  const chosenCards = useMemo(() => chosenOptions(choices), [choices]);
  // the clip the piece is built on (only while it is still on the timeline as it was)
  // (a film opened again from the timeline keeps the clip it was built on, even if that clip has moved since)
  const [savedFoots, setSavedFoots] = useState<FootageSource[]>([]);
  const sources = useMemo(() => footIds.map((id) => footageClips.find((c) => c.clipId === id) ?? savedFoots.find((c) => c.clipId === id)).filter((c): c is FootageSource => Boolean(c)), [footageClips, footIds, savedFoots]);
  // the first one: where the piece goes on the timeline (and «is there a video at all»)
  const source = sources[0] ?? null;
  const sourceKey = sources.map((c) => `${c.clipId}:${c.assetId}:${c.in}:${c.out}`).join("|");
  const footMeta = source && foot && Math.abs(foot.meta.seconds - footageTotal(sources)) < 0.05 ? { ...foot.meta, person: personOn } : null;

  /** Puts a conversation's kept work back (from this device or from the server). */
  const restore = (s: Saved) => {
    if (!initialBrief) setBrief(s.brief || "");
    if (!initialBrief) setSeconds(s.seconds || 15);
    setIntensity(s.intensity || 4);
    setBrand(s.brand || "");
    setPicks(s.picks || []);
    setChoices(s.choices || {});
    setPlan(s.plan ?? null);
    setSay(s.say || "");
    setCode(s.code || "");
    setReviews(s.reviews || []);
    // «خلفية شفافة» is never remembered: it sends the film out as a separate WebM that does NOT enter the timeline, so a
    // choice left on from before made every later scene come out that way (it is switched on again each time, on purpose)
    setTransparent(false);
    setTransparentCode(Boolean(s.transparentCode));
    setVoiceOn(Boolean(s.voiceOn));
    setMusicMode(s.musicMode === "eleven" || s.musicMode === "none" ? s.musicMode : "code");
    setReviewMode(s.reviewMode === "balanced" || s.reviewMode === "precise" ? s.reviewMode : "fast");
    const ids = s.footIds ?? (s.footId ? [s.footId] : []);
    if (!initialFootage && ids.length) {
      setFootIds(ids);
      if (s.footMeta) setFoot({ meta: s.footMeta, frames: [] });
      setPersonOn(Boolean(s.personOn));
    }
    if (!initialSource) {
      setChat(Array.isArray(s.chat) ? s.chat.slice(-80) : []);
      setParams(s.params && typeof s.params === "object" ? s.params : {});
    }
    setVersions(Array.isArray(s.versions) ? s.versions.slice(-KEEP_VERSIONS) : []);
    setMade(s.made && typeof s.made === "object" ? s.made : {});
    setCover(s.cover ?? null);
    if (s.plan && !initialBrief) setStage(s.code ? "ready" : "plan");
    // handed over with a brief and nothing made yet: the scenario comes by itself (scenario first, then «اعتمد وابنِ»)
    if (s.autoPlan && !s.plan && s.brief) setAutoBrief(s.brief);
  };
  const [autoBrief, setAutoBrief] = useState("");
  useEffect(() => {
    if (!autoBrief) return;
    const tm = setTimeout(() => {
      setAutoBrief("");
      void makePlan({ brief: autoBrief });
    }, 300);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoBrief]);

  // the lab remembers its work on this device AND on the server (a refresh, another device: the conversation is there)
  useEffect(() => {
    // a film of the timeline opened again: its own scene, not the lab's last work
    if (initialSource) {
      const src = initialSource.source;
      const tm = setTimeout(() => {
        setPlan(src.plan);
        setCode(src.code);
        setBrief(src.brief || "");
        setPicks(src.picks || []);
        setChoices(src.choices || {});
        setMusicMode(src.musicMode || "code");
        setParams({ ...(src.params || {}), ...(initialSource.params || {}) });
        setChat(src.chat || []);
        setReviews([]);
        const list = Array.isArray(src.footage) ? src.footage : src.footage ? [src.footage] : [];
        if (list.length) {
          setSavedFoots(list);
          setFootIds(list.map((c) => c.clipId));
          if (src.footMeta) setFoot({ meta: src.footMeta, frames: [] });
          setPersonOn(Boolean(src.personOn));
        }
        setStage("ready");
        autoDone.current = false;
      }, 0);
      return () => clearTimeout(tm);
    }
    let local: (Saved & { serverId?: string | null }) | null = null;
    try {
      local = JSON.parse(localStorage.getItem(key(store)) ?? "null") as (Saved & { serverId?: string | null }) | null;
    } catch {
      local = null;
    }
    // the device's copy when it is this very conversation (or no server conversation was asked for)
    if (local && (!chatId || local.serverId === chatId)) {
      const tm = setTimeout(() => {
        restore(local!);
        if (local!.serverId) setServerId(local!.serverId);
      }, 0);
      return () => clearTimeout(tm);
    }
    if (!chatId) return;
    // a conversation opened from the list: brought from the server
    let live = true;
    void postJson<{ chat: { id: string; title: string; state: Saved } | null; missing: boolean }>(`/api/jawad/editor/projects/${projectId}`, { action: "lab_chat_get", id: chatId })
      .then((r) => {
        if (!live) return;
        if (r.missing) return setServerMissing(true);
        if (r.chat) {
          restore(r.chat.state);
          setServerId(r.chat.id);
        }
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, initialBrief, initialFootage, initialSource, chatId]);
  const saved = (): Saved => ({ brief, seconds, intensity, brand, picks, choices, plan, say, code, reviews, reviewMode, transparent, transparentCode, voiceOn, musicMode, footIds, footMeta: foot?.meta ?? null, personOn, chat: chat.slice(-80), params, versions: versions.slice(-KEEP_VERSIONS), made, cover });
  useEffect(() => {
    try {
      localStorage.setItem(key(store), JSON.stringify({ ...saved(), serverId }));
    } catch {
      /* not kept */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, brief, seconds, intensity, brand, picks, choices, plan, say, code, reviews, reviewMode, transparent, transparentCode, voiceOn, musicMode, footIds, foot, personOn, chat, params, versions, made, cover, serverId]);
  // …and on the server, a moment after the last change (one save at a time; the first one makes the conversation)
  const saving = useRef<Promise<unknown> | null>(null);
  useEffect(() => {
    if (serverMissing || initialSource || (!chat.length && !plan && !code)) return;
    const tm = setTimeout(() => {
      const state = saved();
      const title = plan?.title || chat.find((m) => m.role === "user")?.text.slice(0, 60) || brief.slice(0, 60) || "موشن جديد";
      const run = async () => {
        await saving.current?.catch(() => undefined);
        const r = await postJson<{ id: string; missing: boolean }>(`/api/jawad/editor/projects/${projectId}`, { action: "lab_chat_put", id: serverIdRef.current ?? undefined, title, state });
        if (r.missing) return setServerMissing(true);
        if (r.id && r.id !== serverIdRef.current) {
          serverIdRef.current = r.id;
          setServerId(r.id);
          onChatId?.(r.id);
        }
      };
      saving.current = run().catch(() => undefined);
    }, 1500);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat, plan, code, versions, params, picks, choices, cover, made, serverMissing]);
  const serverIdRef = useRef<string | null>(chatId);
  useEffect(() => {
    serverIdRef.current = serverId;
  }, [serverId]);
  useEffect(() => () => (host.current?.destroy(), abort.current?.abort(), preview.current?.close(), reader.current?.r.close(), matte.current?.r?.close()), []);
  // حيدرة opened the lab (again) on one of the person's clips: that clip is the one, learnt afresh
  useEffect(() => {
    if (!initialFootage) return;
    const tm = setTimeout(() => {
      setFootIds([initialFootage]);
      setFoot((f) => (f && footIds.length === 1 && footIds[0] === initialFootage ? f : null));
    }, 0);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFootage]);

  /** what the server is told about the sound: the voice (its measured lines) and the music */
  // on the person's video their voice is the video's own sound (no recording), and what was learnt about it rides along
  const soundBody = () => ({ voice: voiceOn && !source ? "own" : "", musicMode, voice_lines: take && !source ? { seconds: take.seconds, lines: take.lines } : null, ...(source && footMeta ? { footage: footMeta } : {}) });
  /** the plan as it is built: never shorter than the voice that narrates it; on the person's video, exactly its length */
  const sized = (p: LabPlan): LabPlan => (source && footMeta ? { ...p, seconds: footMeta.seconds } : take ? { ...p, seconds: Math.max(p.seconds, Math.ceil((take.seconds + 1) * 2) / 2) } : p);
  /** the video's own sound (the person's voice), cut once for the mix */
  const footSound = async () => {
    if (!sources.length) return [];
    if (footVoice.current?.key !== sourceKey) footVoice.current = { key: sourceKey, parts: await footageSound(sources) };
    return footVoice.current.parts;
  };
  /** The video kept only on the computer, put up to the library (once) so the server can work on it; returns its asset's id. */
  const serverCopy = async (s: FootageSource) => {
    if (!onUpload) throw new LabSetupError("ما أقدر أرفع الفيديو من هنا؛ ارفعه للمكتبة من المتصفح وجرّب.");
    const name = s.name.slice(0, 30);
    say1(`⬆️ جاري قراءة «${name}» من جهازك… (بدون ما تسوي شي)`);
    const blob = await readLocalFile(s.url, (done, total) => sayLive(`⬆️ جاري قراءة «${name}» من جهازك: ${Math.round((done / total) * 100)}٪ من ${Math.max(1, Math.round(total / 1_048_576))} ميغا…`));
    const mb = Math.max(1, Math.round(blob.size / 1_048_576));
    const live = (p: number) => sayLive(`⬆️ جاري رفع «${name}» تلقائيًا لمكتبة المشروع: ${Math.round(p * 100)}٪ من ${mb} ميغا. القص يحتاج الفيديو على الخادم، وهذا يصير مرة وحدة بس. تقدر تصغّر النافذة.`);
    live(0);
    const asset = await onUpload(new File([blob], /\.[a-z0-9]{2,5}$/i.test(s.name) ? s.name : `${s.name}.mp4`, { type: blob.type || "video/mp4" }), live);
    return asset.id;
  };
  /** «✂️ الكلام ورا الراس»: the person cut out (asked of the server once per file, then kept), opened as a reader */
  const personReader = async () => {
    if (!sources.length) return null;
    const m = matte.current;
    for (const s of sources)
      if (!m.urls.has(s.assetId)) {
        // a video that lives only on the computer is put up to the library first (once): the cut-out is made on the server
        const cut = async (assetId: string) => {
          say1(`✂️ أقص الشخص من «${s.name.slice(0, 30)}» بجودة عالية (مرة وحدة للملف)…`);
          return footageMatte(projectId, assetId, say1, abort.current?.signal);
        };
        const stop = (e: unknown) => abort.current?.signal.aborted || (e instanceof DOMException && e.name === "AbortError");
        try {
          if (!onDeviceOnly(s.url)) m.urls.set(s.assetId, await cut(s.assetId));
          else {
            const had = readServerCopy(projectId, s.assetId);
            try {
              if (!had) throw new Error("none");
              m.urls.set(s.assetId, await cut(had));
            } catch (e) {
              // only a copy that is gone from the library is put up again; any other failure is the cut-out's own
              if (stop(e) || (had && !(e instanceof Error && /اختر فيديو جاهز/.test(e.message)))) throw e;
              const copy = await serverCopy(s);
              saveServerCopy(projectId, s.assetId, copy);
              m.urls.set(s.assetId, await cut(copy));
            }
          }
        } catch (e) {
          // the cut-out failed (not the scene): said as it is, and حيدرة is not asked to fix a scene for it
          if (stop(e) || e instanceof LabSetupError) throw e;
          throw new LabSetupError(`قص الشخص ما تم: ${e instanceof Error ? e.message : e}`);
        }
      }
    if (m.key !== sourceKey || !m.r) {
      m.r?.close();
      m.r = await FootageSet.open(sources.map((s) => ({ ...s, url: m.urls.get(s.assetId)! })), Math.max(width, height), true);
      m.key = sourceKey;
    }
    return m.r;
  };
  /** the reader of the video's frames, opened once for this clip */
  const footReader = async () => {
    if (!sources.length) return null;
    if (reader.current?.key !== sourceKey) {
      reader.current?.r.close();
      reader.current = { key: sourceKey, r: await FootageSet.open(sources, Math.max(width, height)) };
    }
    return reader.current.r;
  };

  /** The piece's sound, mixed: the scene's own soundtrack (code), the library's cues, the voice, and the music. */
  const makeSound = async (o: { got: SceneInfo; music?: string | null }) => {
    const h = host.current;
    if (!h) return null;
    setSoundBusy(true);
    try {
      const synth = o.got.sound ? await h.sound().catch((e: unknown) => (say1(`⚠️ صوت المشهد: ${e instanceof Error ? e.message : e}`), null)) : null;
      const links = await libraryLinks();
      const cues = readCues(o.got.cues, o.got.duration).flatMap((c) => (links.get(c.sfx) ? [{ url: links.get(c.sfx)!, t: c.t, vol: c.vol }] : []));
      // the voice that leads the mix: the person's video's own sound, or their recorded narration
      const parts = source ? await footSound() : [];
      const voice = source ? null : (take?.blob ?? null);
      if (!synth && !cues.length && !voice && !parts.length && !o.music) return null;
      const mix = await mixSoundtrack({ duration: o.got.duration, synth, cues, voice, voiceParts: parts, music: o.music ?? null });
      return mix;
    } finally {
      setSoundBusy(false);
    }
  };
  const refreshSound = async (got: SceneInfo) => {
    preview.current?.stop();
    setSoundtrack(null);
    try {
      setSoundtrack(await makeSound({ got }));
    } catch (e) {
      say1(`⚠️ ما قدرت أجهّز الصوت: ${e instanceof Error ? e.message : e}`);
    }
  };

  const call = useCallback(async <T,>(action: string, body: Record<string, unknown>, watch?: (written: string) => void) => {
    // no clock of the lab's own (the owner's rule): the only thing that stops a step is «إلغاء»
    const outer = abort.current?.signal;
    // a step the platform's request time cannot hold is continued in the next request from where it stopped: what was
    // written so far is kept here and on the device (a closed tab loses nothing), and a request that went by in thought
    // alone makes the next one think less
    const sig = hashOf(JSON.stringify({ action, body }));
    let partialRaw = readPart(store, sig), cap: string | undefined, stuck = 0;
    for (;;) {
      if (partialRaw) say1(`⏳ انتهى وقت الطلب عند المنصة قبل ما يكمل حيدرة؛ أكمل من نفس النقطة (وصل ${Math.round(partialRaw.length / 1000)} ألف حرف) — ما أبدأ من جديد.`);
      const url = `/api/jawad/editor/projects/${projectId}`;
      const payload = { action, model: claude.id, ...body, stream: true, ...(partialRaw ? { partialRaw } : {}), ...(cap ? { effortCap: cap } : {}) };
      // watched: every piece he writes reaches the page as he writes it (the program grows in the conversation)
      let written = partialRaw;
      const asked = watch ? postWatch<T & { error?: string; partialRaw?: string; noProgress?: boolean; effortUsed?: string }>(url, payload, (piece) => watch((written += piece)), outer) : postJson<T & { error?: string; partialRaw?: string; noProgress?: boolean; effortUsed?: string }>(url, payload, outer);
      const result = await asked.catch((e: unknown) => {
        if (outer?.aborted) throw new DOMException("cancelled", "AbortError");
        throw e;
      });
      if (result.error) throw new Error(result.error);
      // the server's answer is written as it is made: when the platform ends the request first, what arrives is empty
      if (!result || Object.keys(result).length === 0) throw new Error("انقطع رد الخادم قبل ما يكتمل (الخطوة أخذت أطول من وقت الطلب عند المنصة). جرّب مرة ثانية.");
      if (typeof result.partialRaw !== "string") {
        savePart(store, "", "");
        return result;
      }
      stuck = result.partialRaw.length > partialRaw.length ? 0 : stuck + 1;
      if (result.noProgress) cap = lowerEffort(result.effortUsed ?? cap ?? "high");
      if (stuck >= 3) throw new Error("حيدرة ما تقدّم في آخر ثلاث طلبات (كل طلب انقضى وقته بدون ما يكتب). جرّب مرة ثانية.");
      partialRaw = result.partialRaw;
      savePart(store, sig, partialRaw);
    }
  }, [projectId, claude.id, store]);

  /** A card in the conversation from حيدرة (the lab's steps are told there, one card each). */
  const post = (card: Card, text = "", options?: string[]) => setChat((c) => [...c, { role: "assistant", text, card, ...(options?.length ? { options } : {}) }]);
  /** The live card of the work running now: its lines (the last card of that kind is the one that grows). */
  const workLine = (line: string) =>
    setChat((c) => {
      for (let i = c.length - 1; i >= 0; i--) {
        const m = c[i];
        if (m.card?.k === "work") return [...c.slice(0, i), { ...m, card: { ...m.card, lines: [...m.card.lines.slice(-14), line] } }, ...c.slice(i + 1)];
        if (m.role === "user") break;
      }
      return [...c, { role: "assistant", text: "", card: { k: "work", title: "الشغل", lines: [line] } }];
    });
  /** The pictures the scene may draw (library picks, plus any made just now), with the short ids حيدرة writes. */
  type Chosen = { short: string; asset: EditorAsset };
  const listOf = (use: Chosen[]) => use.map((c) => ({ id: c.short, name: c.asset.name, w: c.asset.width ?? 0, h: c.asset.height ?? 0 }));

  /** The scene page with this program, its fonts and its pictures; the probe catches a bug before anything else. */
  const loadCode = async (program: string, p: LabPlan, values: Record<string, string> = params, use: Chosen[] = chosen) => {
    host.current?.destroy();
    const h = new SceneHost();
    host.current = h;
    const fonts = [sceneFont("head", p.fonts.head), sceneFont("body", p.fonts.body)].filter((f): f is NonNullable<typeof f> => Boolean(f));
    const bitmaps: { id: string; bitmap: ImageBitmap }[] = [];
    for (const c of use) {
      try {
        const blob = await (await fetch(c.asset.url!)).blob();
        bitmaps.push({ id: c.short, bitmap: await createImageBitmap(blob) });
      } catch {
        say1(`ما قدرت أحمّل «${c.asset.name}» للمشهد.`);
      }
    }
    // the person's video: its frames are read here and handed to the page with every frame it draws
    const rd = source && footMeta ? await footReader() : null;
    if (rd) h.video = (t, scale) => rd.at(t, scale);
    // «✂️ الكلام ورا الراس»: the cut-out person, read with the same times (it covers the whole file)
    const pr = rd && source && personOn ? await personReader() : null;
    if (pr) h.person = (t, scale) => pr.at(t, scale);
    const footage = rd && footMeta ? { w: rd.w, h: rd.h, duration: footMeta.seconds, words: footMeta.words, lines: footageLines(footMeta.words), face: footMeta.face, person: Boolean(pr) } : null;
    const got = await h.load(program, { w: width, h: height, fps: 30, assets: bitmaps, fonts, voice: source ? [] : (take?.lines ?? []), footage, params: values });
    if (!(got.duration > 0)) throw new SceneError("المشهد ما حدد مدته (duration).", "load");
    const bad = await probe(h, got.duration);
    if (bad) throw bad;
    return got;
  };

  /** Writes (or fixes) until the program runs cleanly in the page; returns it with what the scene says. The person
   * watches it being written: the program grows in the conversation's work card as حيدرا ماكس writes it. */
  const buildRunning = async (p: LabPlan, previous = "", errors = "", use: Chosen[] = chosen) => {
    let program = previous, why = errors;
    // no count of its own (the owner's rule): حيدرة fixes until the scene runs, and «إلغاء» is what stops it
    for (let attempt = 0; ; attempt++) {
      if (!program || why) {
        const line = attempt === 0 && !previous ? "✍️ حيدرا ماكس يكتب المشهد بالكود…" : `🛠️ يصلّح خطأ في المشهد (المحاولة ${attempt})…`;
        say1(line);
        workLine(line);
        setLiveCode("");
        const r = await call<{ code: string; problems: string[]; notes: string }>("lab_write", { plan: p, seconds: p.seconds, assets: listOf(use), transparent, ...soundBody(), ...(program ? { code: program, errors: why } : {}) }, (raw) => setLiveCode(partialField(raw, "code")));
        setLiveCode("");
        if (r.notes) {
          say1(r.notes);
          workLine(`📝 ${r.notes}`);
        }
        program = r.code;
        workLine(`📄 ${program.split("\n").length} سطر · ${Math.round(program.length / 1000)} ألف حرف`);
        if (r.problems.length) {
          why = `The program breaks the machine's rules: ${r.problems.join("; ")}`;
          workLine(`⚠️ ${r.problems.join("، ")}`);
          continue;
        }
      }
      try {
        say1("▶️ أشغّل المشهد وأفحص كل لحظة فيه…");
        workLine("▶️ أشغّل المشهد وأفحص كل لحظة فيه…");
        const got = await loadCode(program, p, params, use);
        return { program, got };
      } catch (e) {
        // the person's video is gone: no change to the scene can bring it back, so حيدرة is not asked to fix it
        if (e instanceof LabSetupError) throw e;
        const se = e instanceof SceneError ? e : new SceneError(String(e), "load");
        why = `${se.where === "frame" ? `At t = ${se.t?.toFixed(2)} s the frame threw` : "Loading the scene threw"}: ${se.message}\n${se.stack2}`;
        say1(`⚠️ ${se.message}`);
        workLine(`⚠️ خطأ في التشغيل: ${se.message.slice(0, 160)}`);
      }
    }
  };

  /** The scenario (from the conversation's brief, or the drawer's): it comes as a card and waits for «اعتمد وابنِ». */
  const makePlan = async (o: { brief?: string; quiet?: boolean } = {}): Promise<LabPlan | null> => {
    setError(null);
    abort.current?.abort();
    abort.current = new AbortController();
    setStage("planning");
    setNow(0);
    try {
      // the person's video: what they say (with every word's time), where the face is, and a few frames — learnt once
      let meta: FootageMeta | null = footMeta, frames = foot?.frames ?? [];
      if (source && !meta) {
        for (const s of sources) await checkFootage(s.url, abort.current?.signal);
        say1(sources.length > 1 ? `🎥 أجهّز مقاطعك الـ${sources.length} لحيدرة (ورا بعض بالترتيب)…` : "🎥 أجهّز فيديوك لحيدرة…");
        const info = await prepareFootage(projectId, sources, [...extra, ...assets], say1);
        setFoot(info);
        meta = { ...info.meta, person: personOn };
        frames = info.frames;
      } else if (source && !frames.length) {
        frames = await footageFrames(sources);
        setFoot((f) => (f ? { ...f, frames } : f));
      }
      const r = await call<{ plan: LabPlan; say: string }>("lab_plan", {
        brief: o.brief ?? (tweak && plan ? `${brief}\n\nتعديل على الخطة السابقة («${plan.title}»): ${tweak}` : brief),
        seconds,
        intensity,
        brand,
        assets: assetList,
        references: refs,
        choices,
        language: "Arabic (Gulf)",
        ...soundBody(),
        ...(source && meta ? { footage: meta, footage_frames: frames } : {}),
      });
      setPlan(r.plan);
      setSay(r.say);
      // a new plan has new lines to read: the old take no longer fits it
      if (take && JSON.stringify(r.plan.narration) !== JSON.stringify(plan?.narration)) setTake(null);
      setTweak("");
      setCode("");
      setInfo(null);
      setReviews([]);
      setStage("plan");
      if (o.brief) setBrief(o.brief);
      post({ k: "plan", plan: r.plan, say: r.say }, "", ["اعتمد وابنِ", "غيّر الهوك", "أقصر شوي"]);
      return r.plan;
    } catch (e) {
      if (o.quiet) throw e;
      if (!(e instanceof DOMException && e.name === "AbortError")) setError(e instanceof Error ? e.message : String(e));
      setStage(plan ? "plan" : "brief");
      return null;
    }
  };

  /** The pictures the scenario asked GPT Image 2 for (no writing in them), made once each and kept in the library. */
  const makePictures = async (p: LabPlan): Promise<Chosen[]> => {
    const asked = p.pictures ?? [];
    let use: Chosen[] = chosen;
    if (!asked.length) return use;
    const items: { name: string; assetId: string | null; error?: string }[] = [];
    const got: EditorAsset[] = [];
    workLine(`🖼️ GPT Image 2 يرسم ${asked.length === 1 ? "صورة" : `${asked.length} صور`} للمشهد (بدون أي كتابة فيها)…`);
    for (const q of asked) {
      const sig = hashOf(`${q.prompt}|${q.aspect}`);
      const had = made[sig] ? [...extra, ...assets].find((a) => a.id === made[sig] && a.url) : undefined;
      if (had) {
        got.push(had);
        items.push({ name: q.name || had.name, assetId: had.id });
        continue;
      }
      try {
        const r = await postJson<{ asset: EditorAsset; coins: number; free: boolean }>(`/api/jawad/editor/projects/${projectId}`, { action: "lab_picture", prompt: q.prompt, name: q.name, aspect: q.aspect, key: `${serverIdRef.current ?? store}-${sig}`.slice(0, 60) }, abort.current?.signal);
        got.push(r.asset);
        setMade((m) => ({ ...m, [sig]: r.asset.id }));
        items.push({ name: q.name || r.asset.name, assetId: r.asset.id });
        workLine(`✅ «${q.name}» جاهزة${r.free ? "" : ` (${r.coins} من رصيدك)`}`);
      } catch (e) {
        if (abort.current?.signal.aborted) throw new DOMException("cancelled", "AbortError");
        items.push({ name: q.name, assetId: null, error: e instanceof Error ? e.message : String(e) });
        workLine(`⚠️ «${q.name}»: ${e instanceof Error ? e.message : e}`);
      }
    }
    post({ k: "pictures", items });
    if (!got.length) return use;
    // the new pictures join the scene's pictures (after the ones already picked), with their short ids
    setExtra((x) => [...got.filter((a) => !x.some((y) => y.id === a.id)), ...x]);
    const ids = [...picks.filter((id) => !got.some((a) => a.id === id)), ...got.map((a) => a.id)].slice(-12);
    setPicks(ids);
    const pool = [...got, ...images];
    use = ids.map((id, i) => ({ short: `a${i + 1}`, asset: pool.find((a) => a.id === id)! })).filter((x) => x.asset);
    return use;
  };

  /** One build becomes a version (never written over; the last few are kept) and gets its draft video. */
  const keepVersion = (p: LabPlan, program: string, values: Record<string, string>) => {
    const n = (versions[versions.length - 1]?.n ?? 0) + 1;
    setVersions((v) => [...v, { n, at: Date.now(), plan: p, code: program, params: values }].slice(-KEEP_VERSIONS));
    post({ k: "version", n, title: p.title }, "", ["صدّره للتايملاين", "صمّم الكفر"]);
    return n;
  };

  /** Builds, then the director's rounds: render sheets and stills, he scores and rewrites, until it passes. */
  const planNow = plan;
  const build = async (given?: LabPlan, o: { quiet?: boolean; fresh?: boolean; previous?: string; errors?: string; title?: string } = {}): Promise<boolean> => {
    const plan = given ?? planNow;
    if (!plan) return false;
    if (voiceOn && !take && !source) {
      setError("سجّل صوتك أول (في بطاقة السيناريو)، وبعدها حيدرة يبني الحركة على كلامك.");
      return false;
    }
    const built = sized(plan);
    if (built.seconds !== plan.seconds) setPlan(built);
    setError(null);
    abort.current?.abort();
    abort.current = new AbortController();
    const mine = abort.current.signal;
    const stop = () => {
      if (mine.aborted) throw new DOMException("cancelled", "AbortError");
    };
    setLog([]);
    setReviews([]);
    setStage("building");
    setNow(0);
    post({ k: "work", title: o.title ?? (code ? "🔧 أعدّل المشهد" : "🎬 أبني المشهد"), lines: [] });
    try {
      const use = o.previous ? chosen : await makePictures(built);
      stop();
      let { program, got } = await buildRunning(built, o.previous ?? (o.fresh ? "" : code), o.errors ?? "", use);
      stop();
      setCode(program);
      setInfo(got);
      setTransparentCode(transparent);
      const rounds = REVIEW_MODES[reviewMode].rounds;
      if (rounds > 0) setStage("reviewing");
      else workLine("✅ اجتاز فحص التشغيل.");
      const done: Review[] = [];
      for (let round = 1; round <= rounds; round++) {
        const h = host.current!;
        // how heavy this scene is here decides how many frames the review is allowed to draw
        const cost = await frameCost(h, got.duration, 1, abort.current?.signal);
        const perSheet = cost > 400 ? 9 : cost > 150 ? 15 : 24;
        const shotTimes = cost > 400 ? reviewTimes(got.duration).filter((_, i) => i % 2 === 0) : reviewTimes(got.duration);
        workLine(`🎬 الجولة ${round} من ${rounds}: أصوّر أوراق التلامس واللقطات…`);
        const half = got.duration / 2;
        const sheets = [await contactSheet(h, 0, half, perSheet, 3), await contactSheet(h, half, got.duration, perSheet, 3)];
        // the third sheet: every shot change seen one frame before, on, and after the cut
        const cuts = cutTimes(built.shots.map((x) => x.from), got.duration, 30, cost > 400 ? 3 : 5);
        if (cuts.length) sheets.push(await sheetAt(h, cuts, 3));
        const times = shotTimes;
        const shots = await stills(h, times, got.duration);
        workLine("🧐 حيدرة يراجع كمخرج قاسي…");
        const r = await call<{ review: Review; code: string; problems: string[] }>("lab_review", { plan: built, seconds: built.seconds, assets: listOf(use), code: program, sheets, stills: shots, times, round, maxRounds: rounds, reviewOnly: true, ...soundBody() });
        stop();
        done.push(r.review);
        setReviews([...done]);
        post({ k: "review", review: r.review, round }, r.review.verdict);
        if (r.review.pass) break;
        post({ k: "work", title: "✍️ أطبّق ملاحظات المخرج", lines: [] });
        const next = await buildRunning(built, program, `Apply this visual review, preserving the approved plan and everything that already works: ${JSON.stringify(r.review)}`, use);
        stop();
        program = next.program;
        got = next.got;
        setCode(program);
        setInfo(got);
      }
      setStage("ready");
      void seekTo(Math.min(got.duration * 0.3, 2), got);
      void refreshSound(got);
      const n = keepVersion(built, program, params);
      // the draft video comes by itself: quick, without motion blur, with its sound — watched right in the conversation
      void renderDraft(n, got);
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") tell("⏹️ أوقفت الشغل.");
      else {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        workLine(`⚠️ ${msg}`);
      }
      setStage(code ? "ready" : "plan");
      return false;
    } finally {
      setLiveCode("");
    }
  };

  /** «🎞️ المسودة»: the version rendered fast (no motion blur, its sound mixed in) and played in the conversation. */
  const renderDraft = async (n: number, got: SceneInfo | null = info) => {
    const h = host.current;
    if (!h || !got || encodes === false) return;
    try {
      setDraftAt({ n, p: 0 });
      const audio = await makeSound({ got }).catch(() => null);
      const blob = await renderVideo(h, { duration: got.duration, fps: 30, blur: 0, sub: 1, audio }, (pp) => setDraftAt({ n, p: pp }), abort.current?.signal);
      const url = URL.createObjectURL(blob);
      pageLinks.current.push(url);
      setDrafts((d) => ({ ...d, [n]: url }));
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) workLine(`⚠️ المسودة: ${e instanceof Error ? e.message : e}`);
    } finally {
      setDraftAt(null);
    }
  };
  // the draft videos and the cover live as links on this page: let go of them only when the lab itself goes
  const pageLinks = useRef<string[]>([]);
  useEffect(() => () => pageLinks.current.forEach((u) => URL.revokeObjectURL(u)), []);

  /** «↩️ رجّع لهالنسخة»: an earlier version back on the page (nothing is lost: the newer ones stay in the list). */
  const backTo = async (v: Version) => {
    setError(null);
    try {
      setPlan(v.plan);
      setCode(v.code);
      setParams(v.params);
      const g = await loadCode(v.code, v.plan, v.params);
      setInfo(g);
      setStage("ready");
      void seekTo(Math.min(g.duration * 0.3, 2), g);
      void refreshSound(g);
      post({ k: "version", n: v.n, title: v.plan.title }, `↩️ رجّعت النسخة ${v.n}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  /** «🖼️ الكفر»: designed in code by the owner's cover skill from the film's own frames, looked at full size and at the
   * profile grid's 12 %, scored and fixed; the finished picture goes to the library (and can be downloaded). */
  const makeCover = async (wish = "") => {
    const h = host.current;
    if (!h || !info || !plan) return;
    setError(null);
    abort.current?.abort();
    abort.current = new AbortController();
    const mine = abort.current.signal;
    setStage("building");
    setNow(0);
    post({ k: "work", title: "🖼️ أصمم الكفر", lines: [] });
    const coverHost = new SceneHost();
    try {
      // three frames of the film (the hook, the middle, the payoff) — the person's face comes from these, never redrawn
      const at = [Math.min(info.duration * 0.12, 1.2), info.duration * 0.5, Math.max(0, info.duration - 1.2)];
      const frames = await stills(h, at, info.duration);
      const bitmaps: { id: string; bitmap: ImageBitmap }[] = [];
      for (const [i, d] of frames.entries()) bitmaps.push({ id: `f${i + 1}`, bitmap: await createImageBitmap(await (await fetch(`data:image/jpeg;base64,${d}`)).blob()) });
      const fonts = [sceneFont("head", plan.fonts.head), sceneFont("body", plan.fonts.body)].filter((f): f is NonNullable<typeof f> => Boolean(f));
      const body = { plan, wish };
      let program = "", why = "", headline = "", last: CoverScores | null = null;
      const draw = async (code: string) => {
        await coverHost.load(code, { w: width, h: height, fps: 30, assets: bitmaps, fonts, params: {} });
        return coverHost.frame(0, { scale: 1 });
      };
      for (let round = 1; ; round++) {
        // write (or fix) until it draws
        for (let attempt = 0; attempt < 3; attempt++) {
          if (!program || why) {
            workLine(attempt === 0 && !program ? "✍️ حيدرا ماكس يكتب الكفر بالكود…" : "🛠️ يصلّح الكفر…");
            const r = await call<{ code: string; problems: string[]; headline: string; notes: string }>("lab_cover_write", { ...body, frames, ...(program ? { code: program, errors: why } : {}) }, (raw) => setLiveCode(partialField(raw, "code")));
            setLiveCode("");
            program = r.code;
            headline = r.headline || headline;
            if (r.notes) workLine(`📝 ${r.notes}`);
            if (r.problems.length) {
              why = `The program breaks the machine's rules: ${r.problems.join("; ")}`;
              continue;
            }
          }
          try {
            (await draw(program)).close();
            why = "";
            break;
          } catch (e) {
            why = `Drawing the cover threw: ${e instanceof Error ? e.message : e}`;
            workLine(`⚠️ ${e instanceof Error ? e.message.slice(0, 160) : e}`);
          }
        }
        if (why) throw new Error("ما قدر حيدرة يرسم الكفر بدون خطأ. جرّب مرة ثانية.");
        if (mine.aborted) throw new DOMException("cancelled", "AbortError");
        // what he looks at: the cover full size, at the grid's 12 % and in its crops
        const bm = await draw(program);
        const views = await coverViews(bm, width, height);
        bm.close();
        workLine(`🧐 يشوف الكفر بحجمه وبحجم شبكة البروفايل (الجولة ${round})…`);
        const r = await call<{ review: CoverScores; code: string; problems: string[] }>("lab_cover_review", { ...body, code: program, views, round });
        last = r.review;
        if (r.review.pass || round >= COVER_ROUNDS || !r.code) break;
        program = r.code;
        why = r.problems.length ? `The program breaks the machine's rules: ${r.problems.join("; ")}` : "";
      }
      // the finished cover: a PNG of the project's size, into the library (and kept with the conversation)
      const final = await draw(program);
      const png = await bitmapPng(final);
      final.close();
      const file = new File([png], `كفر - ${(plan.title || "موشن").replace(/[\\/:*?"<>|]/g, "").slice(0, 40)}.png`, { type: "image/png" });
      let assetId: string | null = null;
      if (onUpload) {
        try {
          assetId = (await onUpload(file)).id;
        } catch (e) {
          workLine(`⚠️ ما انحفظ في المكتبة: ${e instanceof Error ? e.message : e}`);
        }
      }
      const link = URL.createObjectURL(png);
      pageLinks.current.push(link);
      setCoverUrl(link);
      setCover({ code: program, headline, assetId, review: last });
      post({ k: "cover", assetId, headline, review: last }, last?.verdict ?? "", ["نزّل الكفر", "غيّر العنوان"]);
      setStage("ready");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") workLine("⏹️ أوقفت الشغل.");
      else {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        workLine(`⚠️ ${msg}`);
      }
      setStage("ready");
    } finally {
      coverHost.destroy();
      setLiveCode("");
    }
  };

  // the sound plays with the preview, from where the picture is
  useEffect(() => {
    if (!playing || !soundtrack) return;
    preview.current ??= new SoundPreview();
    preview.current.play(soundtrack, t);
    return () => preview.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, soundtrack]);
  // the preview: frames from the page, as fast as it draws them
  useEffect(() => {
    if (!playing || !host.current || !info) return;
    let stop = false;
    const start = performance.now() - t * 1000;
    (async () => {
      while (!stop) {
        const now = ((performance.now() - start) / 1000) % info.duration;
        try {
          const bm = await host.current!.frame(now, { scale: Math.min(1, 540 / Math.max(width, height)) });
          const c = viewCanvas.current;
          if (c) {
            c.width = bm.width;
            c.height = bm.height;
            c.getContext("2d")!.drawImage(bm, 0, 0);
          }
          bm.close();
          setT(now);
        } catch {
          stop = true;
          setPlaying(false);
        }
      }
    })();
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, info]);
  const seekTo = async (v: number, got: SceneInfo | null = info) => {
    setT(v);
    if (!host.current || !got) return;
    try {
      const bm = await host.current.frame(v, { scale: Math.min(1, 540 / Math.max(width, height)) });
      const c = viewCanvas.current;
      if (c) {
        c.width = bm.width;
        c.height = bm.height;
        c.getContext("2d")!.drawImage(bm, 0, 0);
      }
      bm.close();
    } catch {
      /* shown in the log */
    }
  };
  // a scene restored from this device: loaded again (without a new review) to be watched and exported
  const reopen = async () => {
    if (!code || !plan) return;
    setError(null);
    try {
      const g = await loadCode(code, plan);
      setInfo(g);
      void seekTo(Math.min(g.duration * 0.3, 2), g);
      void refreshSound(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  /** «فرّغ الخلفية الآن»: the scene is already built with an opaque background — rewritten to drop it, keeping everything else. */
  const stripBackground = async () => {
    if (!plan || !code) return;
    setError(null);
    abort.current?.abort();
    abort.current = new AbortController();
    const mine = abort.current.signal;
    setStage("building");
    setNow(0);
    try {
      const { program, got } = await buildRunning(plan, code, "The person asked for a transparent background AFTER this scene was already built. Rewrite it to drop every full-frame background fill, backdrop shape, gradient or vignette that covers the whole canvas — the canvas must stay transparent where nothing is drawn (never call scene({ background: … }) with a colour, never fillRect the whole frame). Keep the subject, its motion, timing, type and sound cues exactly as they are; only the backdrop goes.");
      if (mine.aborted) throw new DOMException("cancelled", "AbortError");
      setCode(program);
      setInfo(got);
      setTransparentCode(true);
      setStage("ready");
      void refreshSound(got);
      void seekTo(Math.min(got.duration * 0.3, 2), got);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") say1("⏹️ أوقفت الشغل.");
      else setError(e instanceof Error ? e.message : String(e));
      setStage("ready");
    }
  };

  const exportFilm = async () => {
    if (!host.current || !info || !plan) return;
    setError(null);
    setPlaying(false);
    setStage("rendering");
    setNow(0);
    setProgress(0);
    setRenderAt(null);
    abort.current = new AbortController();
    post({ k: "work", title: "⬇️ الرندر النهائي بضبابية الحركة", lines: [] });
    const signal = abort.current.signal;
    try {
      const frames = Math.max(1, Math.round(info.duration * 30));
      // what one frame really costs on THIS device with THIS scene, measured before committing to hundreds of them
      const sub = info.blur > 0 ? 6 : 1;
      const ms = await frameCost(host.current, info.duration, sub, signal);
      const plannedMs = ms * frames;
      const makingTransparent = transparent && transparentCode && !source;
      // the film's sound, mixed for it (ElevenLabs' music made now when chosen) and muxed INTO the file
      let audio = soundtrack;
      if (musicMode === "eleven" && plan.music && !makingTransparent) {
        tell("🎵 أصنع الموسيقى على الإيقاع…");
        try {
          const a = await makeMusicAsset(projectId, `${plan.music}. ${plan.bpm} BPM, instrumental, builds to a clear peak and resolves on the last beat.`, Math.max(10_000, Math.round(info.duration * 1000)));
          audio = (await makeSound({ got: info, music: a.url ?? null })) ?? audio;
        } catch (e) {
          tell(`⚠️ الموسيقى: ${e instanceof Error ? e.message : e} — أكمل بدونها.`);
        }
      } else if (!audio) audio = await makeSound({ got: info }).catch(() => null);
      tell(makingTransparent ? `🎞️ أرندر ${frames} إطارًا بخلفية شفافة (WebM) · ${mmss(plannedMs)} تقريبًا على جهازك.` : `🎞️ أرندر ${frames} إطارًا · ${mmss(plannedMs)} تقريبًا على جهازك.`);
      const started = performance.now();
      const blob = await renderVideo(
        host.current,
        { duration: info.duration, fps: 30, blur: info.blur, sub, transparent: makingTransparent, audio },
        (p: number, frame: number, total: number) => {
          setProgress(p);
          const spent = performance.now() - started;
          setRenderAt({ frame, frames: total, leftMs: frame > 0 ? (spent / frame) * (total - frame) : plannedMs });
        },
        signal,
      );
      const stem = (plan.title || "motion").replace(/[\\/:*?"<>|]/g, "").slice(0, 50);
      if (makingTransparent) {
        // ملف شفاف منفصل (مو للتايملاين — ما فيه خلفية أصلًا يركّب عليها الصوت والموسيقى): ينزل على الجهاز لتركيبه بعدين
        download(blob, `${stem}-شفاف.webm`);
        setStage("ready");
        setRenderAt(null);
        tell("✅ نزل ملف WebM بخلفية شفافة على جهازك. ركّبه على أي خلفية في برنامج المونتاج اللي تبيه.");
        return;
      }
      const file = new File([blob], `${stem}.mp4`, { type: "video/mp4" });
      if (alsoDownload) download(blob, `${stem}.mp4`);
      // the sound is already inside the film: nothing placed twice (a silent scene keeps the old way: its cues on tracks)
      // on the person's video the piece takes the clip's place: it lands where the clip starts, and the clip is muted
      // the scene goes with the film, so it stays editable on the timeline (a film opened again replaces its old one)
      const lab: LabSource = { v: 1, plan, code, params, fields: info.params ?? [], picks, choices, musicMode, brief, footage: sources.length ? sources : null, footMeta: foot?.meta ?? null, personOn, chat: chat.slice(-30) };
      const replacing = initialSource?.assetId ?? null;
      onFilm(file, audio ? [] : readCues(info.cues, info.duration), null, source && !replacing ? { at: source.start, muteClipIds: sources.map((c) => c.clipId) } : undefined, { source: lab, replaceAssetId: replacing });
      setStage("ready");
      setRenderAt(null);
      tell(audio ? "✅ نزل المقطع في التايملاين وصوته داخله (المؤثرات" + (take || source ? " وصوتك" : "") + (musicMode !== "none" ? " والموسيقى" : "") + ")." : "✅ نزل المقطع في التايملاين.");
    } catch (e) {
      setRenderAt(null);
      if (!(e instanceof DOMException && e.name === "AbortError")) setError(e instanceof Error ? e.message : String(e));
      else tell("⏹️ أوقفت الرندر.");
      setStage("ready");
    }
  };

  /** «✏️ النصوص والألوان»: the scene loaded again with the person's values (the preview shows them; the export uses them) */
  const applyParams = async (values: Record<string, string>) => {
    if (!code || !plan) return;
    setError(null);
    try {
      const g = await loadCode(code, plan, values);
      setInfo(g);
      void seekTo(t, g);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const say2 = (text: string, options?: string[]) => setChat((c) => [...c, { role: "assistant", text, ...(options?.length ? { options } : {}) }]);
  /** The quick replies that are the lab's own buttons (pressed: the step runs here, no question to حيدرة needed). */
  const direct = (message: string): (() => Promise<unknown>) | null => {
    if (/^اعتمد( الخطة)?( و)?ابن/.test(message) && plan && !busy) return () => build(plan, { fresh: true });
    if (/^صدّ?ره|^رندر|^نزّ?له في التايملاين/.test(message) && info && !busy) return exportFilm;
    if (/^صمّ?م الكفر$/.test(message) && info && !busy) return () => makeCover();
    if (/^نزّ?ل الكفر$/.test(message) && coverUrl) return async () => download(await (await fetch(coverUrl)).blob(), `كفر - ${(plan?.title || "موشن").slice(0, 40)}.png`);
    return null;
  };
  /** «💬»: one message of the conversation — حيدرة answers and decides: the scenario, a change (a new version), the
   * cover or the final render. */
  const send = async (raw?: string) => {
    const message = (raw ?? chatText).trim();
    if (!message || busy) return;
    setChatText("");
    const history = chat.filter((m) => m.text).slice(-20).map((m) => ({ role: m.role, text: m.text }));
    setChat((c) => [...c, { role: "user", text: message }]);
    setError(null);
    const own = direct(message);
    if (own) return void (await own());
    abort.current?.abort();
    abort.current = new AbortController();
    setStage("planning");
    setNow(0);
    try {
      const r = await call<{ reply: string; action: "none" | "plan" | "code" | "cover" | "render"; brief: string; code: string; problems: string[]; options?: string[] }>("lab_chat", {
        message,
        history,
        plan,
        code,
        params,
        seconds: plan?.seconds ?? seconds,
        assets: assetList,
        ...soundBody(),
      });
      say2(r.reply, r.action === "none" ? r.options : undefined);
      if (r.action === "plan") {
        // the scenario first: it comes as a card and waits for «اعتمد وابنِ» (the owner's skills: never build before it)
        const p = await makePlan({ brief: r.brief, quiet: true });
        if (!p) throw new Error("ما قدرت أكتب السيناريو.");
      } else if (r.action === "code" && plan) {
        // a note: only what was named changes, and it is a NEW version (the one they saw stays in the list)
        setStage("ready");
        await build(plan, { previous: r.code, errors: r.problems.length ? `The program breaks the machine's rules: ${r.problems.join("; ")}` : "", title: "🔧 أطبّق ملاحظتك" });
      } else if (r.action === "cover") {
        setStage("ready");
        await makeCover(r.brief);
      } else if (r.action === "render") {
        setStage("ready");
        await exportFilm();
      } else setStage(code ? "ready" : plan ? "plan" : "brief");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") say2("⏹️ وقفت.");
      else say2(`⚠️ ${e instanceof Error ? e.message : String(e)}`);
      setStage(code ? "ready" : plan ? "plan" : "brief");
    }
  };

  // opened by حيدرة (or the editor) with a brief: it is the person's first message, and the scenario is written by itself
  // (scenario first: nothing is built before «اعتمد وابنِ»)
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !initialBrief.trim() || initialSource) return;
    opened.current = true;
    const tm = setTimeout(() => {
      setChat((c) => [...c, { role: "user", text: initialBrief }]);
      void makePlan({ brief: initialBrief });
    }, 300);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBrief, initialSource]);

  /** 📎 a picture from the device: up to the library, then the scene can draw it (a logo, a product…) */
  const attachFiles = async (files: File[]) => {
    if (!onUpload) return;
    for (const f of files.slice(0, 4)) {
      try {
        say2(`⏫ أرفع «${f.name}»…`);
        const a = await onUpload(f);
        setExtra((x) => [...x, a]);
        setPicks((p) => [...p.filter((id) => id !== a.id), a.id].slice(-12));
        say2(`📎 وصلت «${a.name}». قل لي وين تبيها (مثلًا: «حط الشعار في النهاية كبير»).`);
      } catch (e) {
        say2(`⚠️ ما قدرت أرفع «${f.name}»: ${e instanceof Error ? e.message : e}`);
      }
    }
  };
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: "end" });
  }, [chat.length]);

  // a film opened from the timeline with new values and «طبّق»: loaded, then rendered straight away (the pill shows it)
  useEffect(() => {
    if (!initialSource?.auto || autoDone.current || !code || !plan) return;
    const tm = setTimeout(() => {
      if (!info) {
        if (stage === "ready") void reopen();
        return;
      }
      autoDone.current = true;
      void exportFilm();
    }, 0);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSource, code, plan, info, stage]);

  const busy = stage === "planning" || stage === "building" || stage === "reviewing" || stage === "rendering";
  useEffect(() => {
    if (!busy) return;
    // the clock of the step running now (it restarts with each stage)
    const from = Date.now();
    const tick = setInterval(() => setNow(Date.now() - from), 1000);
    return () => clearInterval(tick);
  }, [busy, stage]);
  const elapsed = busy ? mmss(now) : "";
  // folded, or another tab on show: the window is hidden, never taken apart — the work in it goes on
  const hidden = minimized || !active;
  const stageAr = stage === "planning" ? "يخطّط" : stage === "building" ? "يكتب الكود" : stage === "reviewing" ? "يراجع" : stage === "rendering" ? "يرندر" : "";
  // what this tab is doing, told to the tab strip and the folded pill (the pill belongs to the strip: it speaks for every tab)
  const statusLabel = busy ? `${stageAr}${stage === "rendering" ? ` ${Math.round(progress * 100)}٪${renderAt ? ` · يبقى ${mmss(renderAt.leftMs)}` : ""}` : ` ${elapsed}`}` : "جاهز";
  const hasWork = Boolean(plan || code || chat.length);
  useEffect(() => onStatus?.({ busy, label: statusLabel, work: hasWork }), [onStatus, busy, statusLabel, hasWork]);
  const tabTitle = plan?.title || brief.trim().slice(0, 28);
  useEffect(() => onTitle?.(tabTitle), [onTitle, tabTitle]);

  // don't lose a build, a review round or a render to an accidental tab close
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  const close = () => {
    // busy: keep working, just fold the window (إلغاء inside really stops it); idle: nothing to lose, close for good
    if (busy) setMinimized(true);
    else {
      abort.current?.abort();
      onClose();
    }
  };
  const cancel = () => {
    // this really stops the work now: the request in flight is dropped and the loop breaks at its next step
    abort.current?.abort();
    setStage(code ? "ready" : plan ? "plan" : "brief");
    setMinimized(false);
  };

  if (!portalReady) return null;

  const pillClass = (on: boolean) => `mlab-pill${on ? "" : ""}`;
  const lastOptions = (() => {
    const m = [...chat].reverse().find((x) => x.role === "assistant");
    return !busy && m?.options?.length ? m.options : [];
  })();
  const lastWork = (() => {
    for (let i = chat.length - 1; i >= 0; i--) if (chat[i].card?.k === "work") return i;
    return -1;
  })();
  const urlOf = (id: string | null) => (id ? ([...extra, ...assets].find((a) => a.id === id)?.url ?? null) : null);
  const currentN = versions.find((v) => v.code === code)?.n ?? null;

  /** One card of the conversation: the lab's steps (the scenario, the work, the pictures, a version, a review, the cover). */
  const cardView = (card: Card, i: number): ReactNode => {
    switch (card.k) {
      case "plan": {
        const p = card.plan;
        const isCurrent = plan?.title === p.title && JSON.stringify(plan?.shots) === JSON.stringify(p.shots);
        return (
          <div className="mlab-card flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="mlab-label">📝 السيناريو</span>
                <h3 className="!text-xl">{p.title}</h3>
                <p className="m-0">{p.idea}</p>
              </div>
              <div className="flex gap-1.5" aria-label="الألوان">
                {Object.values(p.palette).map((c, k) => (
                  <span key={k} className="h-7 w-7 rounded-full border border-white/20" style={{ background: c }} title={c} />
                ))}
              </div>
            </div>
            {card.say && <p className="m-0 font-bold" style={{ color: "var(--jw-accent)" }}>🤖 {card.say}</p>}
            <p className="mlab-tip m-0">
              🎣 الهوك: {p.hook} · ✨ اللحظة المبهرة: {p.wow} · 🔤 {FONT_BY_ID.get(p.fonts.head)?.ar ?? p.fonts.head} / {FONT_BY_ID.get(p.fonts.body)?.ar ?? p.fonts.body} · {p.seconds} ث · {p.bpm} BPM
            </p>
            {!!chosenOptions(p.choices).length && (
              <div className="mlab-chips">
                {chosenOptions(p.choices).map(({ group, option }) => (
                  <span key={`${group.id}-${option.id}`} className="mlab-chip">
                    {group.ar}: {option.ar}
                  </span>
                ))}
              </div>
            )}
            <ol className="mlab-shots">
              {p.shots.map((x, k) => (
                <li key={k}>
                  <b className="tabular-nums" dir="ltr">
                    {x.from.toFixed(1)}–{x.to.toFixed(1)}s
                  </b>{" "}
                  {x.frame && <span className="mlab-chip">{FRAME_AR[x.frame]}</span>} {x.what} {x.text && <span className="font-bold">«{x.text}»</span>} <span className="mlab-tip">· {x.motion} · {x.camera}{x.transition ? ` · ${x.transition}` : ""}</span>
                </li>
              ))}
            </ol>
            {!!p.pictures?.length && (
              <p className="mlab-tip m-0">🖼️ يرسمها GPT Image 2 قبل الكود (بدون كتابة فيها): {p.pictures.map((q) => `«${q.name}»`).join("، ")}</p>
            )}
            {isCurrent && voiceOn && !source && (stage === "plan" || stage === "ready") && <LabVoice script={p.narration.map((n) => n.text)} model={claude.id} value={take} onChange={(v) => (setTake(v), setSoundtrack(null))} disabled={busy} />}
            {isCurrent && !code && (stage === "plan" || stage === "ready") && (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="jw-btn jw-btn-primary !min-h-12 !text-base" disabled={busy || (voiceOn && !take && !source)} onClick={() => void build(p, { fresh: true })}>
                  🎬 {voiceOn && !take && !source ? "سجّل صوتك أول ↑" : "اعتمد وابنِ"}
                </button>
                <label className="mlab-tip flex items-center gap-2">
                  🔍 المراجعة
                  <select className="jw-input !min-h-10 !py-1" value={reviewMode} disabled={busy} onChange={(e) => setReviewMode(e.target.value as ReviewMode)}>
                    {(Object.keys(REVIEW_MODES) as ReviewMode[]).map((m) => (
                      <option key={m} value={m}>
                        {REVIEW_MODES[m].label}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="jw-btn !min-h-12" disabled={busy} onClick={() => setChatText("عدّل السيناريو: ")}>
                  ✏️ عدّل
                </button>
              </div>
            )}
          </div>
        );
      }
      case "work": {
        const live = i === lastWork && busy;
        const lines = liveCode.split("\n");
        return (
          <div className="mlab-card flex flex-col gap-2">
            <b className="flex items-center gap-2">
              {live && <span className="jw-spinner !h-3.5 !w-3.5" aria-hidden />} {card.title} {live && <span className="mlab-tip tabular-nums">{elapsed}</span>}
            </b>
            {!!card.lines.length && (
              <ul className="mlab-log m-0">
                {card.lines.map((l, k) => (
                  <li key={k}>{l}</li>
                ))}
              </ul>
            )}
            {live && liveCode && (
              <div className="flex flex-col gap-1">
                <span className="mlab-tip">🧑‍💻 حيدرا ماكس يكتب الحين · {lines.length} سطر</span>
                <pre className="mlab-code" dir="ltr">{lines.slice(-36).join("\n")}</pre>
              </div>
            )}
          </div>
        );
      }
      case "pictures":
        return (
          <div className="mlab-card flex flex-col gap-2">
            <b>🖼️ صور المشهد من GPT Image 2</b>
            <div className="flex flex-wrap gap-2">
              {card.items.map((it, k) => {
                const u = urlOf(it.assetId);
                return (
                  <figure key={k} className="m-0 flex w-24 flex-col items-center gap-1 text-center text-xs">
                    {u ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u} alt={it.name} className="h-24 w-24 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-24 w-24 items-center justify-center rounded-lg bg-white/5">{it.error ? "⚠️" : "🖼️"}</span>
                    )}
                    <figcaption className="mlab-tip">{it.error ? it.error.slice(0, 60) : it.name}</figcaption>
                  </figure>
                );
              })}
            </div>
          </div>
        );
      case "version": {
        const v = versions.find((x) => x.n === card.n);
        const isNow = currentN === card.n;
        const url = drafts[card.n];
        return (
          <div className="mlab-card flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <b>🎞️ النسخة {card.n} · {card.title}</b>
              {isNow ? <span className="mlab-chip">المعروضة الحين</span> : v && <button type="button" className="jw-btn !min-h-9" disabled={busy} onClick={() => void backTo(v)}>↩️ رجّع لهالنسخة</button>}
            </div>
            {url ? (
              <video src={url} controls playsInline className="max-h-[52vh] w-full rounded-xl bg-black" style={{ aspectRatio: `${width} / ${height}` }} />
            ) : draftAt?.n === card.n ? (
              <p className="m-0 font-bold">🎞️ أجهّز المسودة… {Math.round(draftAt.p * 100)}٪</p>
            ) : isNow && info ? (
              <button type="button" className="jw-btn !min-h-10" disabled={busy || encodes === false} onClick={() => void renderDraft(card.n)}>
                🎞️ اعرض مسودة فيديو
              </button>
            ) : (
              !v && <p className="mlab-tip m-0">نسخة قديمة (ما عادت محفوظة).</p>
            )}
            {isNow && info && !busy && (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="jw-btn jw-btn-primary !min-h-11" onClick={() => void exportFilm()}>
                  ⬇️ الرندر النهائي ← التايملاين
                </button>
                <button type="button" className="jw-btn !min-h-11" onClick={() => void makeCover()}>
                  🖼️ صمّم الكفر
                </button>
              </div>
            )}
          </div>
        );
      }
      case "review":
        return (
          <div className="mlab-card flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <b>🧐 درجات المخرج — الجولة {card.round}</b>
              <span className="font-bold" style={{ color: card.review.pass ? "var(--jw-ok)" : "var(--jw-muted)" }}>{card.review.pass ? `✅ وصل المعيار (كلها ≥ ${PASS})` : `أقل درجة ${card.review.low}`}</span>
            </div>
            <ul className="mlab-score m-0 list-none p-0">
              {RUBRIC.map((r) => (
                <li key={r.id}>
                  <span className="w-20 shrink-0 mlab-tip">{r.ar}</span>
                  <span className="bar">
                    <span className="block h-full rounded-full" style={{ width: `${card.review.scores[r.id] * 10}%`, background: card.review.scores[r.id] >= PASS ? "var(--jw-ok)" : "var(--jw-accent)" }} />
                  </span>
                  <b className="w-5 text-end tabular-nums">{card.review.scores[r.id]}</b>
                </li>
              ))}
            </ul>
          </div>
        );
      case "cover": {
        const u = (cover && cover.assetId === card.assetId && coverUrl) || urlOf(card.assetId);
        return (
          <div className="mlab-card flex flex-col gap-2">
            <b>🖼️ الكفر{card.headline ? ` · «${card.headline}»` : ""}</b>
            {u && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={u} alt="الكفر" className="max-h-[52vh] w-auto self-start rounded-xl" />
            )}
            {card.review && (
              <ul className="mlab-score m-0 list-none p-0">
                {COVER_RUBRIC.map((r) => (
                  <li key={r.id}>
                    <span className="w-20 shrink-0 mlab-tip">{r.ar}</span>
                    <span className="bar">
                      <span className="block h-full rounded-full" style={{ width: `${card.review!.scores[r.id] * 10}%`, background: card.review!.scores[r.id] >= COVER_PASS ? "var(--jw-ok)" : "var(--jw-accent)" }} />
                    </span>
                    <b className="w-5 text-end tabular-nums">{card.review!.scores[r.id]}</b>
                  </li>
                ))}
              </ul>
            )}
            <p className="mlab-tip m-0">{card.assetId ? "انحفظ في مكتبة المشروع. " : ""}ارفعه غلاف للريل من إنستقرام (تعديل الغلاف ← من الألبوم).</p>
            {u && (
              <button type="button" className="jw-btn !min-h-10 self-start" onClick={async () => download(await (await fetch(u)).blob(), `كفر - ${(plan?.title || "موشن").slice(0, 40)}.png`)}>
                ⬇️ نزّل الكفر
              </button>
            )}
          </div>
        );
      }
    }
  };

  return createPortal(
    <div className="mlab-overlay" role="dialog" aria-modal="true" aria-label="مختبر الموشن" dir="rtl" style={hidden ? { display: "none" } : undefined}>
      <div className="mlab">
        {tabBar}
        <header className="mlab-head">
          <div className="min-w-0">
            <h2 className="mlab-title">
              🎬 مختبر الموشن
              {busy && (
                <span className="mlab-status" role="status" aria-live="polite">
                  <span className="jw-spinner !h-3.5 !w-3.5 !border-black/30 !border-t-black" aria-hidden />
                  {stageAr} · {stage === "rendering" && renderAt ? `إطار ${renderAt.frame}/${renderAt.frames} · يبقى ${mmss(renderAt.leftMs)}` : elapsed}
                </span>
              )}
            </h2>
            <p className="mlab-tip hidden sm:block">{busy ? "الشغل ماشي. صغّر النافذة وارجع للمونتاج — يكمل في الخلفية، وترجّعه من زر «مختبر الموشن»." : "قل لحيدرة وش تبي: يكتب لك السيناريو، يبنيه بالكود قدامك، يرسل لك مسودة فيديو، يعدّل على ملاحظاتك، ويصمم الكفر."}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <ClaudeModelPicker disabled={busy} />
            {busy && (
              <button type="button" className="jw-btn !min-h-10" onClick={cancel} title="يوقف العملية الحالية (اللي انسوّى قبلها يبقى محفوظ)">
                إلغاء
              </button>
            )}
            <button type="button" className="jw-btn jw-btn-primary !min-h-10 whitespace-nowrap" onClick={close} title={busy ? "ارجع للمونتاج ويكمل المختبر شغله في الخلفية" : "اخرج من المختبر وارجع للمونتاج"}>
              ← {busy ? "ارجع والمختبر يكمل" : "رجوع للمونتاج"}
            </button>
          </div>
        </header>

        {encodes === false && (
          <p role="alert" className="mlab-error m-0">
            ⚠️ متصفحك ما يقدر يصدّر فيديو بمقاس {width}×{height} (غالبًا Safari على الآيفون أو الآيباد). تقدر تتكلم مع حيدرة وتشوف المعاينة، لكن المسودة والتصدير يحتاجون Chrome أو Edge على كمبيوتر.
          </p>
        )}
        {serverMissing && <p className="mlab-tip m-0 px-4">ℹ️ المحادثات تنحفظ على هالجهاز بس لين يتحدّث الموقع (ملف 0087).</p>}
        <div className="mlab-body">
          <section className="mlab-main">
            <div className="mlab-card mlab-chat flex flex-col gap-3">
              <div className="mlab-chat-log flex max-h-[64vh] min-h-[300px] flex-col gap-2 overflow-y-auto" aria-live="polite">
                {!chat.length && (
                  <div className="mlab-tip">
                    <p className="m-0 font-bold" style={{ color: "var(--jw-ink)" }}>🤖 هلا! قل لي وش الموشن اللي تبيه.</p>
                    <p className="m-0 mt-1">أكتب لك السيناريو أول، وإذا اعتمدته أبنيه بالكود قدامك، وأرسل لك مسودة فيديو، وأعدّل على ملاحظاتك، وأصمم لك الكفر.</p>
                    <p className="m-0 mt-1">مثلًا: «إعلان ١٠ ثواني لتطبيقي، الكلمة تنبني من غبار ذهبي، وفي الآخر الشعار». ولو عندك شعار أو صورة، ارفقها بـ📎{footageClips.length ? "، وتقدر تبنيه على فيديو تتكلم فيه من ⚙️" : ""}.</p>
                  </div>
                )}
                {chat.map((m, i) => (
                  <div key={i} className={`flex flex-col gap-2 ${m.role === "user" ? "items-start" : "items-stretch"}`}>
                    {m.text && <div className={`mlab-bubble ${m.role === "user" ? "me" : "him"}`}>{m.text}</div>}
                    {m.card && cardView(m.card, i)}
                  </div>
                ))}
                {busy && lastWork < 0 && (
                  <div className="mlab-bubble him flex items-center gap-2">
                    <span className="jw-spinner !h-3.5 !w-3.5" aria-hidden /> {log[log.length - 1] ?? `حيدرة ${stageAr}…`} {elapsed}
                  </div>
                )}
                <div ref={chatEnd} />
              </div>
              {!!lastOptions.length && (
                <div className="mlab-chips">
                  {lastOptions.map((o) => (
                    <button key={o} type="button" className="mlab-chip" onClick={() => void send(o)}>
                      {o}
                    </button>
                  ))}
                </div>
              )}
              {!!chosen.length && (
                <div className="mlab-chips">
                  {chosen.map((c) => (
                    <span key={c.asset.id} className="mlab-chip">
                      📎 {c.short}: {c.asset.name.slice(0, 20)}
                    </span>
                  ))}
                </div>
              )}
              {drawer && (
                <div className="flex flex-col gap-3 rounded-xl border border-white/10 p-3">
                  <b>⚙️ التجهيزات (اختيارية — حيدرة يفهم كل هذا من كلامك بعد)</b>
                  {!!footageClips.length && (
                    <div className="flex flex-col gap-2">
                      <span className="mlab-label">🎥 على فيديوك</span>
                      <div className="mlab-pills">
                        <button type="button" className="mlab-pill" aria-pressed={!source} disabled={busy} onClick={() => (setFootIds([]), setFoot(null))}>
                          بدون فيديو
                        </button>
                        {footageClips.map((c) => {
                          const n = footIds.indexOf(c.clipId);
                          return (
                            <button key={c.clipId} type="button" className="mlab-pill" aria-pressed={n >= 0} disabled={busy} title={c.name} onClick={() => (setFootIds((ids) => (ids.includes(c.clipId) ? ids.filter((x) => x !== c.clipId) : [...ids, c.clipId])), setFoot(null), setVoiceOn(false), setTransparent(false))}>
                              {n >= 0 ? `${n + 1} ✓` : "🎥"} {c.name.slice(0, 24)} · {Math.round(footageSeconds(c))} ث
                            </button>
                          );
                        })}
                      </div>
                      {source && (
                        <label className="flex items-start gap-3">
                          <input type="checkbox" className="mt-1.5 h-4 w-4" checked={personOn} onChange={(e) => setPersonOn(e.target.checked)} disabled={busy} />
                          <span>
                            <b>✂️ الكلام ورا الراس</b> <span className="mlab-tip block">يقص الشخص من الفيديو مرة وحدة للمقطع، عشان الكلمة الكبيرة تنحط وراك.</span>
                          </span>
                        </label>
                      )}
                      {source && <p className="m-0 font-bold" style={{ color: "var(--jw-ok)" }}>✓ المشهد بطول {sources.length > 1 ? `مقاطعك الـ${sources.length}` : "مقطعك"} ({footageTotal(sources).toFixed(1)} ث) وبصوتك الأصلي.</p>}
                    </div>
                  )}
                  <div hidden={!!source}>
                    <span className="mlab-label">المدة</span>
                    <div className="mlab-pills">
                      {SECONDS.map((x) => (
                        <button key={x} type="button" disabled={busy} className={pillClass(seconds === x)} aria-pressed={seconds === x} onClick={() => setSeconds(x)}>
                          {x} ث
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="mlab-label">الحماس</span>
                    <div className="mlab-pills">
                      {INTENSITY.map(([v, ar]) => (
                        <button key={v} type="button" disabled={busy} className={pillClass(intensity === v)} aria-pressed={intensity === v} onClick={() => setIntensity(v)}>
                          {ar}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="block">
                    <span className="mlab-label">ألوان وخطوط العلامة</span>
                    <input className="jw-input w-full" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="#0b3d2e و #d4af37، خط عريض" disabled={busy} />
                  </label>
                  <div className="flex flex-col gap-2">
                    <span className="mlab-label">🔊 الصوت</span>
                    <label className="flex items-start gap-3" hidden={!!source}>
                      <input type="checkbox" className="mt-1.5 h-4 w-4" checked={voiceOn} onChange={(e) => setVoiceOn(e.target.checked)} disabled={busy} />
                      <span>
                        <b>🎙️ بصوتي</b> <span className="mlab-tip block">حيدرة يكتب لك نص قصير في السيناريو، تسجّله، حيدرا ماكس ينظّفه، والحركة تنبني على كلامك.</span>
                      </span>
                    </label>
                    <div className="mlab-pills">
                      {MUSIC_MODES.map((m) => (
                        <button key={m.id} type="button" disabled={busy} className="mlab-pill" aria-pressed={musicMode === m.id} title={m.tip} onClick={() => setMusicMode(m.id)}>
                          {m.ar}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center gap-2">
                    <span className="mlab-label !m-0">🔍 مراجعة المخرج</span>
                    <select className="jw-input !min-h-10 !py-1" value={reviewMode} disabled={busy} onChange={(e) => setReviewMode(e.target.value as ReviewMode)}>
                      {(Object.keys(REVIEW_MODES) as ReviewMode[]).map((m) => (
                        <option key={m} value={m}>
                          {REVIEW_MODES[m].label} — {REVIEW_MODES[m].description}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mlab-label">مراجع: لقطات من ريلز عاجبتك (حتى ٤)</span>
                    <input type="file" accept="image/*" multiple disabled={busy} onChange={async (e) => setRefs(await Promise.all([...(e.target.files ?? [])].slice(0, 4).map(refOf)))} />
                    {!!refs.length && <span className="block mt-1 font-bold" style={{ color: "var(--jw-ok)" }}>{refs.length} مرجع جاهز</span>}
                  </label>
                  <details className="mlab-group">
                    <summary>
                      <span>🎨 الأسلوب من العينات</span>
                      {chosenCards.length ? <span className="picked">✓ {chosenCards.length}</span> : <span className="free">خلّه لحيدرة</span>}
                    </summary>
                    <div className="mt-2">
                      <Gallery choices={choices} onChange={setChoices} disabled={busy} />
                    </div>
                  </details>
                </div>
              )}
              {attachOpen && (
                <div className="flex flex-col gap-2 rounded-xl border border-white/10 p-2">
                  {onUpload && (
                    <label className="jw-btn !min-h-10 cursor-pointer">
                      ⏫ ارفع صورة من جهازك (شعار، منتج…)
                      <input type="file" accept="image/*" multiple hidden disabled={busy} onChange={(e) => (void attachFiles([...(e.target.files ?? [])]), setAttachOpen(false))} />
                    </label>
                  )}
                  {!!images.length && (
                    <div className="flex flex-wrap gap-2">
                      {images.map((a) => {
                        const on = picks.includes(a.id);
                        return (
                          <button key={a.id} type="button" className="mlab-thumb" aria-pressed={on} disabled={busy} onClick={() => setPicks(on ? picks.filter((x) => x !== a.id) : [...picks, a.id].slice(0, 12))} title={a.name}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={a.url!} alt={a.name} />
                            {on && <span className="tag">a{picks.indexOf(a.id) + 1}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-end gap-2">
                <button type="button" className="jw-btn !min-h-12 !px-3" aria-label="التجهيزات" title="التجهيزات: الفيديو، المدة، الصوت، الأسلوب…" aria-pressed={drawer} disabled={busy} onClick={() => setDrawer((v) => !v)}>
                  ⚙️
                </button>
                <button type="button" className="jw-btn !min-h-12 !px-3" aria-label="ارفق صورة" title="ارفق صورة (شعار، منتج…)" disabled={busy} onClick={() => setAttachOpen((v) => !v)}>
                  📎
                </button>
                <textarea
                  className="jw-textarea flex-1"
                  rows={2}
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  placeholder={code ? "ملاحظتك: «خلّ اللون ذهبي»، «حط الشعار في النهاية»، «أسرع شوي»… (يغيّر اللي تقوله بس)" : "وش الموشن اللي تبيه؟"}
                  disabled={busy}
                />
                {busy ? (
                  <button type="button" className="jw-btn !min-h-12" onClick={cancel}>
                    إيقاف
                  </button>
                ) : (
                  <button type="button" className="jw-btn jw-btn-primary !min-h-12" disabled={!chatText.trim()} onClick={() => void send()}>
                    إرسال
                  </button>
                )}
              </div>
            </div>
            {error && (
              <p role="alert" className="mlab-error m-0">
                {error}
              </p>
            )}
          </section>

          <aside className="mlab-side">
            <div className="mlab-preview aspect-[9/16] max-h-[56vh] w-full lg:aspect-auto lg:h-[56vh]" style={width > height ? { aspectRatio: `${width} / ${height}`, height: "auto" } : undefined}>
              {info ? <canvas ref={viewCanvas} /> : <span className="mlab-tip px-6 text-center">{busy ? `حيدرة ${stageAr}… ${elapsed}` : code ? "اضغط «شغّل المشهد المحفوظ» تحت." : "المعاينة تطلع هنا بعد ما يبني حيدرة المشهد."}</span>}
            </div>
            {info && (
              <div className="flex items-center gap-2" dir="ltr">
                <button type="button" className="jw-btn !min-h-10" disabled={stage === "rendering"} onClick={() => setPlaying((v) => !v)} aria-label={playing ? "وقّف" : "شغّل"}>
                  {playing ? "⏸" : "▶"}
                </button>
                <input type="range" className="flex-1" min={0} max={info.duration} step={0.01} value={t} disabled={playing || stage === "rendering"} onChange={(e) => void seekTo(Number(e.target.value))} aria-label="الوقت" />
                <span className="w-16 text-end tabular-nums text-sm">{t.toFixed(2)}s</span>
              </div>
            )}
            {!info && code && !busy && (
              <button type="button" className="jw-btn jw-btn-primary !min-h-12 w-full" onClick={reopen}>
                ▶️ شغّل المشهد المحفوظ
              </button>
            )}
            {info && !!info.params?.length && (
              <details className="mlab-card">
                <summary className="cursor-pointer font-bold">✏️ النصوص والألوان</summary>
                <div className="mt-2 flex flex-col gap-3">
                  <p className="mlab-tip m-0">عدّل أي نص أو لون، واضغط «طبّق». ينحفظ مع المقطع، وتعدّله بعدين من التايملاين بعد.</p>
                  {info.params.map((f) => (
                    <label key={f.id} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 text-sm font-bold">{f.label}</span>
                      {f.type === "color" ? (
                        <input type="color" className="h-9 w-14" value={/^#[0-9a-f]{6}$/i.test(params[f.id] ?? f.value) ? (params[f.id] ?? f.value) : "#000000"} disabled={busy} onChange={(e) => setParams((p) => ({ ...p, [f.id]: e.target.value }))} />
                      ) : (
                        <input className="jw-input flex-1" value={params[f.id] ?? f.value} disabled={busy} onChange={(e) => setParams((p) => ({ ...p, [f.id]: e.target.value }))} />
                      )}
                    </label>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="jw-btn jw-btn-primary !min-h-11" disabled={busy} onClick={() => void applyParams(params)}>
                      ♻️ طبّق في المعاينة
                    </button>
                    <button type="button" className="jw-btn !min-h-11" disabled={busy || !Object.keys(params).length} onClick={() => (setParams({}), void applyParams({}))}>
                      ↺ رجّع الأصل
                    </button>
                  </div>
                </div>
              </details>
            )}
            {info && (
              <div className="mlab-card flex flex-col gap-3">
                <h3>⬇️ الرندر النهائي</h3>
                <p className="m-0 font-bold" role="status">
                  {soundBusy ? "🔊 أجهّز الصوت…" : soundtrack ? `🔊 الصوت يطلع مع الفيديو: مؤثرات بالكود${source ? " + صوتك من الفيديو" : take ? " + صوتك" : ""}${musicMode === "code" ? " + موسيقى بالكود" : musicMode === "eleven" ? " (وموسيقى ElevenLabs تنصنع وقت التصدير)" : ""}.` : "🔇 المشهد ما كتب له صوت. قل لحيدرة «أضف صوت»."}
                </p>
                <div className="mlab-pills">
                  {MUSIC_MODES.map((m) => (
                    <button key={m.id} type="button" disabled={stage === "rendering"} className="mlab-pill" aria-pressed={musicMode === m.id} title={m.tip} onClick={() => setMusicMode(m.id)}>
                      {m.ar}
                    </button>
                  ))}
                </div>
                <label className="flex items-start gap-3">
                  <input type="checkbox" className="mt-1.5 h-4 w-4" checked={alsoDownload} onChange={(e) => setAlsoDownload(e.target.checked)} disabled={stage === "rendering"} />
                  <span>
                    <b>⬇️ ونزّل نسخة على جهازي</b> <span className="mlab-tip block">MP4 بصوته، جاهز تنشره مباشرة.</span>
                  </span>
                </label>
                <label className="flex items-start gap-3" hidden={!!source}>
                  <input type="checkbox" className="mt-1.5 h-4 w-4" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} disabled={stage === "rendering"} />
                  <span>
                    <b>🪄 خلفية شفافة</b> <span className="mlab-tip block">يصدّر WebM منفصل بدون خلفية تنزّله وتركّبه بنفسك — ما يدخل التايملاين.</span>
                  </span>
                </label>
                {transparent && !source && !transparentCode && (
                  <button type="button" className="jw-btn w-full !min-h-11" disabled={busy} onClick={stripBackground}>
                    🪄 فرّغ خلفية هذا المشهد الآن
                  </button>
                )}
                <button type="button" className="jw-btn jw-btn-primary !min-h-12 !text-base w-full" disabled={busy || (transparent && !source && !transparentCode)} onClick={() => void exportFilm()}>
                  {stage === "rendering"
                    ? `أرندر ${Math.round(progress * 100)}٪${renderAt ? ` · إطار ${renderAt.frame} من ${renderAt.frames} · يبقى ${mmss(renderAt.leftMs)}` : ""}`
                    : transparent && !source
                      ? "⬇️ صدّر الملف الشفاف ونزّله"
                      : initialSource
                        ? "♻️ صدّره وبدّل المقطع اللي في التايملاين"
                        : "⬇️ صدّره ونزّله في التايملاين"}
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}
