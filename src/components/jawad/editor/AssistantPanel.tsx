"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { clipEnd, duration, findClip, mainTrack, type Timeline } from "@/lib/editor/model";
import { framesOf } from "./media";
import { watchClip, watchFilm } from "./watch";
import { rememberBackdrops } from "./backdrop-memory";
import { asksToSee, asksToSeeFilm, FILM, WATCH, type Watch } from "@/lib/editor/watch";
import { diagNote, diagReport, previewShot } from "./diag";
import { gradeLayers } from "./grade-gl";
import type { Grade } from "@/lib/editor/grade";
import { scopeOf, type Scope } from "@/lib/editor/scopes";
import { makeHookAsset, makeMusicAsset, makeSfxAsset } from "./make";
import { startMaking } from "./making";
import { smartWindow } from "./track";
import type { MakePlan } from "@/lib/editor/make-any";
import { expandThen, placeHookDesign, placeMusic } from "@/lib/editor/make";
import { captionSources, poemCaptions, spokenCaptions } from "./captions-make";
import { hookAspect } from "@/lib/editor/hook-design";
import type { MakeRequest } from "@/lib/editor/assistant";
import { MAX_CHECKS } from "@/lib/editor/assistant-guide";
import type { Chat } from "@/lib/editor/chat";
import type { Command } from "@/lib/editor/commands";
import { coinStr } from "@config/coins";
import { postJson } from "@/lib/fetch";
import { styleInText } from "@/lib/editor/motion-styles";
import StylePicker from "./StylePicker";
import { MOTION_TEN } from "@/lib/editor/motion-ten";
import { faceOnFrame, type FaceBox } from "@/lib/editor/talk-motion";
import { faceIn } from "./face";
import Icon from "../Icon";
import { blobBase64, canTalk, hear, hush, record, SILENT_PEAK, REPLY_VOICE_KEY, replyVoice, say, wavOf, type RecordingHandle } from "./talk";
import { useUploads } from "./useUploads";
import { extractSound } from "./captions";
import type { Run } from "./Inspector";
import { PEAK_RATE, peaksOf } from "./peaks";
import type { PlayerLike } from "./Timeline";
import type { EditorAsset } from "./types";
import Riyal from "@/components/Riyal";
import Coined from "@/components/Coined";
import ClaudeModelPicker from "@/components/robots/ClaudeModelPicker";
import { useClaudeModel } from "@/components/robots/claude-model";
import { codeEdit, codeGrade, type CodeDeps } from "./claude-code";
import { cleanVoice } from "@/components/claude-code/clean-voice";
import type { AssetInfo } from "@/lib/editor/model";

interface Msg {
  role: "user" | "assistant";
  text: string;
  done?: number;
  suggestions?: { prompt: string; why: string }[];
  /** clickable answers under حيدرا ماكس's last reply (with «✍️ اكتب إجابة مختلفة») */
  quick?: string[];
  options?: { label: string; choices: string[]; multi: boolean }[];
  /** «اصنع لي…» that cost coins: shown with their price, started by a tap */
  plans?: { plan: MakePlan; state: "ask" | "started" | "failed" }[];
  error?: boolean;
}

/** From here a handoff is suggested (same as the server's CHAT_LONG). */
const LONG = { messages: 40, chars: 24_000 };
/** from here the film is too long to be seen well in one go (96 moments): the person is told to split the request */
const LONG_FILM_MS = 180_000;
const localKey = (id: string) => `jw-editor-chat-${id}`;

const QUICK = ["صمّم لي نص هوك", "حط موسيقى تناسب المقطع", "قص السكتات الطويلة", "رتّب المقاطع وحط انتقالات ناعمة", "خلّه ٣٠ ثانية بأحلى اللقطات", "حط عنوان في البداية", "سوّ لي مونتاج كامل من الملفات", "خفّض الموسيقى وقت الكلام"];

/**
 * The silent parts of the clips that have sound (timeline ms), from the files' loudness: Claude uses them for
 * «قص السكتات». A part counts when it stays under a quarter of the clip's usual level for half a second or more.
 */
async function quietParts(tl: Timeline, assets: Map<string, EditorAsset>) {
  const out: { clipId: string; ranges: [number, number][] }[] = [];
  for (const track of tl.tracks) {
    if (track.muted || track.kind === "text") continue;
    for (const c of track.clips) {
      const a = c.assetId ? assets.get(c.assetId) : null;
      if (!a || a.kind === "image" || !a.hasAudio || !a.url) continue;
      const peaks = await peaksOf(a.id, a.url);
      if (!peaks) continue;
      const from = Math.floor((c.in / 1000) * PEAK_RATE);
      const to = Math.min(peaks.length, Math.ceil((c.out / 1000) * PEAK_RATE));
      const part = Array.from(peaks.subarray(from, to)).sort((x, y) => x - y);
      const usual = part[Math.floor(part.length * 0.6)] ?? 0;
      const limit = Math.max(6, usual * 0.25);
      const ranges: [number, number][] = [];
      let start = -1;
      for (let k = from; k <= to; k++) {
        const quiet = k < to && peaks[k] <= limit;
        if (quiet && start < 0) start = k;
        if (!quiet && start >= 0) {
          if (k - start >= PEAK_RATE / 2) {
            const s = ((start / PEAK_RATE) * 1000 - c.in) / c.speed + c.start;
            const e = ((k / PEAK_RATE) * 1000 - c.in) / c.speed + c.start;
            ranges.push([Math.round(s), Math.round(Math.min(e, clipEnd(c)))]);
          }
          start = -1;
        }
      }
      if (ranges.length) out.push({ clipId: c.id, ranges: ranges.slice(0, 100) });
    }
  }
  return out;
}

/** «✨ Claude»: say what you want; Claude edits the timeline (one change, undoable). */
export default function AssistantPanel({
  ask,
  onAssets,
  onSeparate,
  onSceneCut,
  onUpscale,
  projectId,
  tl,
  selected,
  assets,
  player,
  run: runEditor,
  onUndo,
  onClose,
  readOnly,
  diag,
  onLab,
}: {
  /** «🎬 مختبر الموشن»: opens the lab with a brief حيدرا ماكس wrote */
  onLab?: (brief: string, seconds: number, clipId?: string | null) => void;
  /** a request sent from a button (sent once per `n`) */
  ask?: { text: string; n: number } | null;
  /** new library files (made for the edit) */
  onAssets: (a: EditorAsset[]) => void;
  /** splits a clip's sound into talking / music / effects tracks */
  onSeparate: (clipId: string) => Promise<void>;
  /** cuts a video clip at every change of shot */
  onSceneCut: (clipId: string) => Promise<number>;
  /** «رفع الدقة»: the clip's video sent to Topaz (a new file comes back and takes its place when it is ready) */
  onUpscale?: (assetId: string, target: "4k" | "1080p") => Promise<void> | void;
  projectId: string;
  tl: Timeline;
  selected: string[];
  assets: Map<string, EditorAsset>;
  player: PlayerLike | null;
  run: Run;
  onUndo: () => void;
  onClose?: () => void;
  readOnly: boolean;
  /** the conversation over the whole editor (a computer) */
  big?: boolean;
  onBig?: () => void;
  /** حيدرا ماكس's place on a computer: beside the preview, the whole side, or half the screen */
  mode?: "dock" | "tall" | "half";
  onMode?: (m: "dock" | "tall" | "half") => void;
  /** «فوق التايملاين»: he sits over the timeline (docked), and this button puts him there / back to the popup */
  docked?: boolean;
  onDock?: () => void;
  /** its text size (1 = normal) */
  zoom?: number;
  onZoom?: (z: number) => void;
  /** the site's owner: «🩺 تشخيص» (the editor's state, read when asked) */
  diag?: () => Record<string, unknown>;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [claude] = useClaudeModel();
  // «🎬 اختر بالصورة»: the gallery of every motion kind, talking-reel look and feeling, as pictures
  const [gallery, setGallery] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  /** the words of a pick written in the box, the cursor at their end (nothing is sent until the person presses) */
  const writeInBox = (words: string, replace = true) => {
    setText((t) => (replace || !t.trim() ? words : `${t.trim()} ${words}`));
    setTimeout(() => {
      const el = textRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 0);
  };
  const [busy, setBusyState] = useState<string | null>(null);
  // the latest «busy», for code that runs between renders (a voice message's send used to see the old one and drop
  // the words silently: it read «أكتب كلامك…» from the render before the transcript arrived)
  const busyRef = useRef<string | null>(null);
  const setBusy = (v: string | null) => {
    busyRef.current = v;
    setBusyState(v);
  };
  // «📎 مراجع»: files attached to the next message (uploaded to the library, seen by حيدرا ماكس with the message)
  const [pending, setPending] = useState<EditorAsset[]>([]);
  const refUploads = useUploads(projectId, (a) => {
    onAssets([a]);
    setPending((x) => (x.some((y) => y.id === a.id) ? x : [...x, a].slice(-6)));
  });
  const fileRef = useRef<HTMLInputElement>(null);
  // who reads حيدرا ماكس's spoken replies (this device): any provider, or one of the person's own voices
  const [voicePick, setVoicePick] = useState("auto");
  useEffect(() => {
    setVoicePick(replyVoice());
  }, []);
  // the timeline as it is now (what was made arrives after Claude's own steps were applied)
  const tlRef = useRef(tl);
  useEffect(() => {
    tlRef.current = tl;
  }, [tl]);
  // everything حيدرا ماكس applies goes through here: each clip's background and colour key are remembered first, so
  // «↩️ رجّع الخلفية لما كانت» (its backdrop tab) can put them back if they ever come out broken
  const run: Run = (c, o) => {
    rememberBackdrops(tlRef.current);
    return runEditor(c, o);
  };
  // «🩺 تشخيص»: the next message asks حيدرا ماكس to find what went wrong (the owner only)
  const [diagOn, setDiagOn] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs, busy]);

  // ---------- the edit's conversation stays with the project (server; before the migration, this device) ----------
  const [chat, setChat] = useState<{ loaded: boolean; stored: boolean; handoff: string | null; chats: number; spent: number }>({ loaded: false, stored: false, handoff: null, chats: 1, spent: 0 });
  const [showHandoff, setShowHandoff] = useState(false);
  useEffect(() => {
    let live = true;
    postJson<Chat>(`/api/jawad/editor/projects/${projectId}`, { action: "chat" })
      .catch(() => ({ messages: [], handoff: null, chats: 1, stored: false, spentHalalas: 0 }) as Chat)
      .then((c) => {
        if (!live) return;
        let saved: { msgs: Msg[]; handoff: string | null; chats: number } = { msgs: c.messages, handoff: c.handoff, chats: c.chats };
        if (!c.stored) {
          try {
            const raw = JSON.parse(localStorage.getItem(localKey(projectId)) ?? "null");
            if (raw && Array.isArray(raw.msgs)) saved = { msgs: raw.msgs, handoff: raw.handoff ?? null, chats: Number(raw.chats) || 1 };
          } catch {
            /* nothing kept */
          }
        }
        // anything said while it was loading stays after what was kept
        setMsgs((now) => [...saved.msgs, ...now]);
        setChat({ loaded: true, stored: c.stored, handoff: saved.handoff, chats: saved.chats, spent: Math.max(0, Number(c.spentHalalas) || 0) });
      });
    return () => {
      live = false;
    };
  }, [projectId]);
  useEffect(() => {
    if (!chat.loaded || chat.stored) return;
    try {
      localStorage.setItem(localKey(projectId), JSON.stringify({ msgs: msgs.filter((m) => !m.error).slice(-200).map((m) => ({ role: m.role, text: m.text, done: m.done })), handoff: chat.handoff, chats: chat.chats }));
    } catch {
      /* not kept */
    }
  }, [msgs, chat, projectId]);
  const long = msgs.length >= LONG.messages || msgs.reduce((n, m) => n + m.text.length, 0) >= LONG.chars;
  const handOff = async () => {
    if (busy || !msgs.length) return;
    setBusy("حيدرا ماكس يكتب الهاندوف ويبدأ محادثة جديدة…");
    try {
      const c = await postJson<Chat>(`/api/jawad/editor/projects/${projectId}`, { action: "handoff", messages: msgs.filter((m) => !m.error), handoff: chat.handoff, model: claude.id });
      setMsgs([]);
      setChat((x) => ({ ...x, handoff: c.handoff, chats: c.chats, spent: Math.max(0, Number(c.spentHalalas) || 0) }));
      setShowHandoff(true);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "تعذّر.", error: true }]);
    } finally {
      setBusy(null);
    }
  };

  const sent = useRef(0);
  // pictures of clips already looked at (kept while the clip's part stays the same)
  const seenFrames = useRef(new Map<string, { t: number; data: string; scope: Scope | null }[]>());
  /** A clip seen: a few moments as filmed and, when graded, the same after its grading (in `at`, the timeline now), each with its scope. */
  const lookAtClip = async (at: Timeline, clipId: string) => {
    const f = findClip(at, clipId);
    const a = f?.clip.assetId ? assets.get(f.clip.assetId) : null;
    if (!f || !a?.url || a.kind === "audio" || f.track.kind === "audio") return null;
    const c = f.clip;
    const key = `${c.id}:${c.in}:${c.out}:${c.start}`;
    let frames = seenFrames.current.get(key);
    if (!frames) {
      try {
        const n = a.kind === "image" ? 1 : Math.min(6, Math.max(2, Math.round((c.out - c.in) / 2000)));
        const src = await framesOf(a.url, a.kind, c.in, c.out, n);
        // the moments on the timeline (what the person sees)
        frames = await Promise.all(src.map(async (x) => ({ t: Math.round(c.start + (x.t - c.in) / c.speed), data: x.data, scope: await scopeOfJpeg(x.data) })));
        seenFrames.current.set(key, frames);
      } catch {
        return null;
      }
    }
    // graded clips: the same moments after its colour grading too (what the person sees), to judge the grade
    const graded = c.grades.some((g) => g.on) ? await gradedFrames(frames.slice(0, 4), c.grades, (t) => Math.max(0, t - c.start)).catch(() => []) : [];
    return { clipId: c.id, frames: [...frames.slice(0, graded.length ? 4 : 8), ...graded] };
  };
  const lookAt = async () => {
    if (selected.length !== 1) return null;
    if (!seenFrames.current.size) setBusy("حيدرا ماكس يشوف المقطع المحدد…");
    return lookAtClip(tl, selected[0]);
  };
  /** What «Claude Code» needs from the panel: the timeline now, the files, the way to apply, and the eyes. */
  const codeDeps = (signal?: AbortSignal): CodeDeps => ({
    projectId,
    model: claude.id,
    timeline: () => tlRef.current,
    infos: () => new Map([...assets.values()].map((a): [string, AssetInfo] => [a.id, { id: a.id, kind: a.kind, durationMs: a.durationMs, width: a.width, height: a.height, hasAudio: a.hasAudio }])),
    run,
    busy: setBusy,
    signal,
    quiet: () => quietParts(tlRef.current, assets),
    playhead: player?.ms ?? 0,
    selected,
    look: lookAtClip,
    graded: gradedFrames,
  });
  /** «يشيك التلوين»: rounds of look → judge → correct, the result told only when حيدرا ماكس is satisfied (or out of rounds). */
  const checkColour = async (clipId: string, request: string, start: Timeline) => {
    let at = start;
    let steps = 0;
    for (let round = 1; round <= MAX_CHECKS; round++) {
      setBusy(round === 1 ? "حيدرا ماكس يشيك نتيجة التلوين (الصورة والسكوبات)…" : `حيدرا ماكس يعيد يشيك بعد التعديل (جولة ${round})…`);
      const look = await lookAtClip(at, clipId);
      if (!look) return;
      const c = await postJson<{ ok: boolean; verdict: string; commands: Command[] }>(`/api/jawad/editor/projects/${projectId}`, { action: "grade_check", clipId, round, request, timeline: at, look, model: claude.id });
      if (c.ok || !c.commands.length) {
        setMsgs((m) => [...m, { role: "assistant", text: `✅ ${c.verdict}`, done: steps || undefined }]);
        return;
      }
      const applied = run(c.commands, { label: `حيدرا ماكس يضبط التلوين (${round})` });
      if (!applied) return;
      at = (applied as { timeline: Timeline }).timeline;
      steps += c.commands.length;
      if (round === MAX_CHECKS) setMsgs((m) => [...m, { role: "assistant", text: c.verdict, done: steps }]);
    }
  };
  /** Sends a request; resolves with حيدرا ماكس's reply (null when nothing was answered). `spoken`: said by voice. */
  // one request at a time: a second Enter (or a click) before the page shows «busy» used to send it twice
  const sendingRef = useRef(false);
  // «⏹️ وقّف»: the request in flight is dropped (nothing it answers is applied or made)
  const abortRef = useRef<AbortController | null>(null);
  // a request that continues by itself once this one is done (the captions written → the motion on the words)
  const followUp = useRef<string | null>(null);
  /** «👁️»: the clip حيدرا ماكس asked to watch whole before he goes on (his next request carries it) */
  const watchNext = useRef<string | null>(null);
  /** clips already watched whole (kept while the clip's part stays the same) */
  const watched = useRef(new Map<string, Watch>());
  /** A clip watched whole: every frame measured, the frames worth seeing on numbered sheets. */
  const watchWhole = async (at: Timeline, clipId: string, signal: AbortSignal): Promise<Watch | null> => {
    const f = findClip(at, clipId);
    const a = f?.clip.assetId ? assets.get(f.clip.assetId) : null;
    if (!f || !a?.url || a.kind !== "video") return null;
    const c = f.clip;
    const key = `${c.id}:${c.in}:${c.out}:${c.start}:${c.speed}`;
    const kept = watched.current.get(key);
    if (kept) return kept;
    try {
      const w = await watchClip(a.url, { id: c.id, start: c.start, in: c.in, out: c.out, speed: c.speed || 1 }, setBusy, signal);
      if (w.sheets.length) watched.current.set(key, w);
      return w.sheets.length ? w : null;
    } catch {
      return null;
    }
  };
  /** The whole film watched (the composed preview, stepped through): kept while the timeline stays the same. */
  const filmSeen = useRef<{ key: string; w: Watch } | null>(null);
  const watchFilmNow = async (at: Timeline, signal: AbortSignal): Promise<Watch | null> => {
    if (!player) return null;
    const key = JSON.stringify(at);
    if (filmSeen.current?.key === key) return filmSeen.current.w;
    // a long film is seen through only ${WATCH.tiles} moments (and measured over its first 10 minutes): say so, and ask for the request in parts
    if (duration(at) > LONG_FILM_MS) {
      const min = Math.round(duration(at) / 6000) / 10;
      setMsgs((m) => [...m, { role: "assistant", text: `⚠️ فيلمك طويل (${min} دقيقة). أشوف منه ${WATCH.tiles} لقطة بس، يعني لقطة كل ${Math.round(duration(at) / WATCH.tiles / 1000)} ثواني تقريبًا، وممكن تفوتني تفاصيل. الأفضل تجزّئ طلبك: اطلب مني كل جزء لحاله (مثلًا «شوف أول دقيقتين» أو حدد مقطع وقل «شوف هذا المقطع»)، وكل جزء أشوفه بتفصيل أكثر.` }]);
    }
    try {
      const w = await watchFilm(player, duration(at), setBusy, signal);
      if (w) filmSeen.current = { key, w };
      return w;
    } catch {
      return null;
    }
  };
  const [canStop, setCanStop] = useState(false);
  // the person's own voices made here (a voiceprint): offered for حيدرا ماكس's spoken replies
  const [ownVoices, setOwnVoices] = useState<{ value: string; name: string }[]>([]);
  const stop = () => {
    abortRef.current?.abort();
    talkRef.current = false;
    recRef.current?.cancel();
    hush();
  };
  /** «بصمة صوتك»: the person's voice from a clip (or the microphone) → a voice of their library, with their consent. */
  const takeVoiceprint = async (clipId: string, name: string, provider: "jawad" | "elevenlabs") => {
    let source: Blob | null = null;
    const f = clipId ? findClip(tlRef.current, clipId) : null;
    const a = f?.clip.assetId ? assets.get(f.clip.assetId) : null;
    if (f && a?.url && a.kind !== "image") {
      setBusy("أطلّع صوتك من المقطع…");
      source = (await extractSound(a.url, f.clip.in, Math.min(f.clip.out, f.clip.in + 120_000))).blob;
    } else {
      setMsgs((m) => [...m, { role: "assistant", text: "🎙️ تكلّم بصوتك الطبيعي ٣٠–٦٠ ثانية (اقرأ أي فقرة)، واضغط 🎤 لما تخلص." }]);
      setBusy(null);
      const h = await record({ onLevel: setLevel });
      recRef.current = h;
      setRecording(true);
      const r = await h.done;
      recRef.current = null;
      setRecording(false);
      source = r?.blob ?? null;
    }
    if (!source) throw new Error("ما وصلني تسجيل للبصمة.");
    // «Claude Code» cleans the recording first (silences, rumble, hum, level); if it can't, the recording goes as it is
    try {
      const cleaned = await cleanVoice({ blob: source, model: claude.id, from: "editor", purpose: "a voiceprint of the person's own voice", onStep: setBusy, signal: abortRef.current?.signal });
      source = cleaned.blob;
      setMsgs((m) => [...m, { role: "assistant", text: cleaned.line }]);
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      setMsgs((m) => [...m, { role: "assistant", text: `ما قدرت أنظّف التسجيل بـ حيدرا ماكس (${(e as Error).message}) — أخذت البصمة من التسجيل كما هو.`, error: true }]);
    }
    const { wav, seconds } = await wavOf(source);
    if (!window.confirm(`أؤكد إن الصوت في هذا التسجيل (${Math.round(seconds)} ث) صوتي، أو عندي إذن صاحبه أنسخه.`)) throw new Error("ما أخذت البصمة (ما تأكدنا من الإذن).");
    setBusy("آخذ بصمة صوتك…");
    const r = await postJson<{ voice: { name: string; value: string } }>(`/api/jawad/editor/projects/${projectId}`, { action: "voiceprint", audio: await blobBase64(wav), seconds, name, consent: true, provider });
    setOwnVoices((x) => [...x.filter((v) => v.value !== r.voice.value), { value: r.voice.value, name: r.voice.name }]);
    setMsgs((m) => [...m, { role: "assistant", text: `✅ صار عندك صوت «${r.voice.name}» في مكتبتك. قل لي «اقرأ هالنص بصوت ${r.voice.name}»، أو اختره لردودي من 🔊 وقت المكالمة.` }]);
  };
  // «المربع الصغير» / «فوق كلامي»: the face in the talking video (found once per file, here in the browser), the
  // talking clips moved so a crop never cuts it, and its place on the frame sent to حيدرا ماكس (the box follows it, the
  // cues keep off it)
  const faces = useRef(new Map<string, { face: FaceBox; width: number; height: number } | null>());
  const talkFace = async (message: string): Promise<{ face: FaceBox; timeline: Timeline | null } | null> => {
    const talky = !!styleInText(message)?.talk || /على\s*كلام|موشن على|talk\)/.test(message);
    if (!talky) return null;
    const main = mainTrack(tlRef.current);
    const first = main?.clips.find((c) => !c.text && c.assetId && assets.get(c.assetId)?.kind === "video");
    const a = first?.assetId ? assets.get(first.assetId) : null;
    if (!first || !a?.url) return null;
    if (!faces.current.has(a.id)) {
      setBusy("أدوّر على وجهك في الفيديو…");
      faces.current.set(a.id, await faceIn(a.url, first.in, first.out).catch(() => null));
    }
    const found = faces.current.get(a.id);
    if (!found) return null;
    const tl0 = tlRef.current;
    const pans = [];
    let face: FaceBox | null = null;
    for (const c of mainTrack(tl0)?.clips ?? []) {
      if (c.text || c.assetId !== a.id) continue;
      const at = faceOnFrame(c.transform, c.fit, found.width, found.height, tl0.width, tl0.height, found.face);
      face ??= at.face;
      if (at.moved && !c.keys.length) pans.push({ type: "update_clip" as const, clipId: c.id, patch: { transform: { ...c.transform, x: at.x, y: at.y } } });
    }
    const moved = pans.length ? (run(pans, { label: "وسّطت وجهك في الكادر" }) as { timeline: Timeline } | null) : null;
    return face ? { face, timeline: moved?.timeline ?? null } : null;
  };
  const send = async (words = text, spoken = false): Promise<string | null> => {
    const message = words.trim() || (pending.length ? "شوف المراجع اللي أرفقتها" : "");
    if (!message || readOnly) return null;
    if (busyRef.current || sendingRef.current) {
      diagNote(`حيدرا ماكس: طلب ما انرسل لأن طلب ثاني شغّال («${message.slice(0, 40)}»)`, "note");
      return null;
    }
    sendingRef.current = true;
    abortRef.current = new AbortController();
    setCanStop(true);
    try {
      return await sendNow(message, spoken, abortRef.current.signal);
    } finally {
      sendingRef.current = false;
      abortRef.current = null;
      setCanStop(false);
      const next = followUp.current;
      followUp.current = null;
      if (next) setTimeout(() => void sendRef.current(next), 400);
    }
  };
  const sendNow = async (message: string, spoken: boolean, signal: AbortSignal): Promise<string | null> => {
    let reply: string | null = null;
    setText("");
    const history = msgs.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }));
    setMsgs((m) => [...m, { role: "user", text: `${diag && diagOn ? `🩺 ${message}` : message}${pending.length ? `\n📎 ${pending.map((a) => a.name).join("، ")}` : ""}` }]);
    if (diag && diagOn) {
      try {
        setBusy("حيدرا ماكس يفحص المحرر والملفات والسجل…");
        const report = await diagReport(diag());
        const r = await postJson<{ reply: string; commands?: Command[] }>(`/api/jawad/editor/projects/${projectId}`, { action: "diagnose", message, report, timeline: tl, selected, playhead: player?.ms ?? 0, shot: previewShot() }, signal);
        // what he diagnosed in the timeline, he fixes now
        if (r.commands?.length) run(r.commands, { label: "حيدرا ماكس يعالج" });
        setMsgs((m) => [...m, { role: "assistant", text: r.reply }]);
        reply = r.reply;
      } catch (e) {
        setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "تعذّر.", error: true }]);
      } finally {
        setBusy(null);
      }
      return reply;
    }
    try {
      setBusy("نسمع الصوت ونلقى السكتات…");
      const quiet = await quietParts(tl, assets);
      // the clip the person chose: watched whole when the request is about what happens in it (or حيدرا ماكس asked to),
      // else a few of its moments
      const toWatch = watchNext.current ?? (asksToSeeFilm(message) ? FILM : selected.length === 1 && asksToSee(message) ? selected[0] : null);
      watchNext.current = null;
      const watch = toWatch === FILM ? await watchFilmNow(tl, signal) : toWatch ? await watchWhole(tl, toWatch, signal) : null;
      const look = watch ? null : await lookAt();
      if (signal.aborted) throw Object.assign(new Error("⏹️ وقّفت الطلب."), { name: "AbortError" });
      // the attached videos: a few of their moments, so حيدرا ماكس sees what is in them (pictures go as they are)
      const refLooks: { id: string; frames: { t: number; data: string }[] }[] = [];
      // (a picture kept on this computer by the desktop program — haidara-media://… — is seen here and sent as pixels: the
      // server can't open that link and Claude only takes https ones)
      for (const a of pending.filter((x) => (x.kind === "video" || (x.kind === "image" && !/^https:\/\//.test(x.url ?? ""))) && x.url)) {
        setBusy(`حيدرا ماكس يشوف المرجع «${a.name}»…`);
        const frames = await framesOf(a.url!, a.kind === "image" ? "image" : "video", 0, a.durationMs ?? 3000, a.kind === "image" ? 1 : 3, a.kind === "image" ? 768 : 360).catch(() => []);
        if (frames.length) refLooks.push({ id: a.id, frames: frames.map((f) => ({ t: f.t, data: f.data })) });
      }
      const found = await talkFace(message).catch(() => null);
      setBusy("حيدرا ماكس يشتغل على التايملاين…");
      const r = await postJson<{ reply: string; commands: Command[]; suggestions: { prompt: string; why: string }[]; quick?: string[]; options?: { label: string; choices: string[]; multi: boolean }[]; requests?: MakeRequest[]; checkClipId?: string | null; assets?: EditorAsset[]; spent?: number }>(`/api/jawad/editor/projects/${projectId}`, {
        action: "assistant",
        model: claude.id,
        message,
        history,
        handoff: chat.handoff,
        // (the talking clips moved to keep the face in view, when they were)
        timeline: found?.timeline ?? tl,
        playhead: player?.ms ?? 0,
        selected,
        quiet,
        look,
        watch,
        spoken,
        refs: pending.map((a) => a.id),
        refLooks,
        face: found?.face ?? null,
      }, signal);
      setPending([]);
      setChat((x) => ({ ...x, spent: Math.max(0, Number(r.spent) || 0) }));
      reply = r.reply;
      let done = 0;
      let now = found?.timeline ?? tl;
      // the art a motion piece drew for itself: in the library before the commands that place it
      if (r.assets?.length) onAssets(r.assets);
      if (r.commands.length) {
        const applied = run(r.commands, { label: `حيدرا ماكس: ${message.slice(0, 40)}` });
        done = applied ? r.commands.length : 0;
        if (applied) now = (applied as { timeline: Timeline }).timeline;
      }
      setMsgs((m) => [...m, { role: "assistant", text: r.reply?.trim() || (done ? `تم ✓ نفذت ${done} خطوة.` : "ما وصلني رد هالمرة؛ أعد رسالتك وأنا أكمل."), done, suggestions: r.suggestions, ...(r.quick?.length ? { quick: r.quick } : {}), ...(r.options?.length ? { options: r.options } : {}) }]);
      // a colour change: حيدرا ماكس looks at the result (pictures and scopes) and corrects it until it is right
      if (r.checkClipId && done) await checkColour(r.checkClipId, message, now);
      // what Claude asked to be made: made one by one, then placed (each its own undo)
      for (const q of r.requests ?? []) {
        if (signal.aborted) break;
        try {
          if (q.kind === "hook_design" && q.design) {
            // «نص الهوك»: the picture, then the two sounds, then everything placed and timed (one undo)
            const d = q.design;
            setBusy(`نصنع صورة الهوك «${q.text}»…`);
            const img = await makeHookAsset(projectId, q.text, "", { prompt: d.imagePrompt, background: d.background, aspect: hookAspect(d, q.orientation ?? "vertical") });
            onAssets([img]);
            setBusy("نصنع مؤثر الدخول والخروج…");
            const sfx = await Promise.all(
              [d.sfxIn, d.sfxOut].map((x, i) => makeSfxAsset(projectId, x.prompt, x.seconds, `${i ? "خروج" : "دخول"} الهوك · ${q.text}`).catch(() => null)),
            );
            onAssets(sfx.filter((a): a is EditorAsset => !!a));
            run(placeHookDesign(d, { image: img.id, sfxIn: sfx[0]?.id ?? null, sfxOut: sfx[1]?.id ?? null }, q.at, q.orientation ?? "vertical"), { label: `نص الهوك: ${q.text.slice(0, 30)}` });
            if (sfx.some((a) => !a)) setMsgs((m) => [...m, { role: "assistant", text: "ما قدرت أصنع أحد المؤثرين الصوتيين؛ الهوك انحط بدونه، وأمره مكتوب فوق.", error: true }]);
          } else if (q.kind === "music") {
            setBusy("نصنع الموسيقى…");
            const a = await makeMusicAsset(projectId, q.prompt, q.lengthMs || 30_000);
            onAssets([a]);
            run(placeMusic(a.id, q.at), { label: "موسيقى" });
          } else if (q.kind === "make" && q.plan) {
            const plan = q.plan;
            // حيدرا ماكس → جواد: what the robot asks جواد to make is made at once, with no permission step (the price is
            // told after). Only what the person asks جواد for directly, in his own form, waits for their «توليد».
            setBusy(`أبدأ أصنع «${plan.name}»…`);
            await startMaking(projectId, plan);
            setMsgs((m) => [...m, { role: "assistant", text: `سلّمت الطلب لجواد وبدأ يصنع «${plan.name}» بـ ${plan.generatorName}${plan.free ? "" : ` (${coinStr(plan.coins)})`}${plan.kind === "video" ? " (الفيديو ياخذ كم دقيقة)" : ""}؛ ينحط على التايملاين لحاله أول ما يخلص، ويظهر في «أعمالي».` }]);
          } else if (q.kind === "smart_mask") {
            // the subject's exact outline (followed through the clip), as a grading layer's window
            const f = findClip(tl, q.clipId);
            const a = f?.clip.assetId ? assets.get(f.clip.assetId) : null;
            if (f && a?.url && (a.kind === "video" || a.kind === "image")) {
              const layer = Math.max(0, Math.min(3, Math.round(q.layer ?? 0)));
              const mask = await smartWindow({ projectId, url: a.url, kind: a.kind, clip: f.clip, words: q.prompt, atT: Math.max(0, (player?.ms ?? f.clip.start) - f.clip.start), track: !!q.track && a.kind === "video", near: null, onStep: setBusy });
              // the clip as it is now (the commands may have added the layer)
              const now = findClip(tlRef.current, q.clipId)?.clip;
              const invert = now?.grades[layer]?.mask?.invert ?? false;
              run([{ type: "update_clip", clipId: q.clipId, patch: { grade: { layer, mask: { ...mask, invert } } } }], { label: `ماسك ذكي: ${q.prompt.slice(0, 30)}` });
            }
          } else if (q.kind === "captions") {
            // listened to and written here, then حيدرا ماكس's own follow-ups (font, place, entrance…) on the new captions
            const now = tlRef.current;
            const all = captionSources(now, assets);
            const sources = q.clipId ? all.filter((x) => x.clip.id === q.clipId) : all;
            if (!sources.length) throw new Error("ما فيه مقاطع فيها كلام أكتبه.");
            const items = q.poem?.trim() ? await poemCaptions(projectId, sources[0], q.poem, setBusy) : (await spokenCaptions(projectId, now, sources, q.lang ?? "ar", setBusy)).items;
            const before = new Set(now.tracks.map((t) => t.id));
            const style = (["karaoke", "classic", "box", "neon", "poem"] as const).find((k) => k === q.captionStyle) ?? (q.poem?.trim() ? "poem" : "karaoke");
            const made = run({ type: "add_captions", items, style, name: q.poem?.trim() ? "الأبيات" : "كابشن" }, { label: `كابشن من حيدرا ماكس (${items.length})` }) as { timeline: Timeline } | null;
            const track = made?.timeline.tracks.find((t) => t.kind === "text" && !before.has(t.id));
            const more = track ? expandThen(q.then ?? [], track.id, track.clips.map((c) => c.id)) : [];
            // all together (one undo); if one of them can't run, the others still do, one by one
            if (track && more.length && !run(more, { label: "حيدرا ماكس يكمّل على الكابشن" })) for (const c of more) run(c, { label: "حيدرا ماكس يكمّل على الكابشن" });
          } else if (q.kind === "code_edit" || q.kind === "code_grade") {
            // «Claude Code»: حيدرا ماكس's program runs here, he checks what it did, and only then is it applied
            const out = q.kind === "code_edit" ? await codeEdit(codeDeps(signal), q.prompt) : await codeGrade(codeDeps(signal), q.prompt, q.clipId.split(",").map((x) => x.trim()).filter(Boolean));
            setMsgs((m) => [...m, { role: "assistant", text: out.text, done: out.done }]);
          } else if (q.kind === "motion_lab") {
            // «🎬 مختبر الموشن»: the lab opens on its conversation with حيدرا ماكس's brief and writes the scenario by itself, on their filmed clip when he named one
            const onClip = q.clipId && findClip(tlRef.current, q.clipId) ? q.clipId : null;
            onLab?.(q.prompt, Number(q.seconds) || 15, onClip);
          } else if (q.kind === "watch") {
            // «👁️»: he needs to see the clip whole — it is watched, and he is asked again with it, by itself
            watchNext.current = q.clipId === FILM || findClip(tlRef.current, q.clipId) ? q.clipId : null;
            followUp.current = `👁️ شفت المقطع كامل الحين. كمّل طلبي: ${message}`;
          } else if (q.kind === "talk_motion") {
            // the words with their times first (the captions of the talking video), then حيدرا ماكس is asked again by itself
            const now = tlRef.current;
            const f = findClip(now, q.clipId);
            const sources = captionSources(now, assets).filter((x) => !f?.clip.assetId || x.clip.assetId === f.clip.assetId);
            if (!sources.length) throw new Error("ما لقيت كلام في المقطع أركّب عليه الموشن.");
            const items = (await spokenCaptions(projectId, now, sources, "ar", setBusy)).items;
            run({ type: "add_captions", items, style: "karaoke", name: "كابشن" }, { label: `كابشن (${items.length})` });
            followUp.current = "كمّل: الحين كلامي مكتوب بتوقيته — ركّب الموشن على كلامي (talk) بأسلوب ماجد.";
          } else if (q.kind === "voiceprint") {
            await takeVoiceprint(q.clipId, q.name || q.text || "صوتي", q.voice === "elevenlabs" ? "elevenlabs" : "jawad");
          } else if (q.kind === "separate") {
            setBusy("نفصل الكلام والموسيقى والمؤثرات…");
            await onSeparate(q.clipId);
          } else if (q.kind === "scene_cut") {
            setBusy("أقرأ المشاهد وأقطّع عند كل تغيّر…");
            await onSceneCut(q.clipId);
          } else if (q.kind === "upscale") {
            // «رفع الدقة»: the clip's own file is sent; it is paid by the second, so the reasons it can't run are said plainly
            if (!onUpscale) throw new Error("رفع الدقة مو متاح في هذا المشروع.");
            const f = findClip(tlRef.current, q.clipId);
            const a = f?.clip.assetId ? assets.get(f.clip.assetId) : null;
            if (!f || !a || a.kind !== "video") throw new Error("رفع الدقة للفيديو فقط — اختر مقطع فيديو.");
            if (a.status !== "ready") throw new Error(`الملف «${a.name}» ما خلص رفع بعد؛ انتظر شوي وأعد الطلب.`);
            if (a.width && a.height && Math.max(a.width, a.height) >= 3800) throw new Error(`«${a.name}» دقته ${a.width}×${a.height} — هذا 4K أصلًا، رفع الدقة ما يضيف له شي.`);
            setBusy("أرسل المقطع لرفع الدقة…");
            await onUpscale(a.id, q.quality === "1080p" && (!a.width || !a.height || Math.max(a.width, a.height) < 1800) ? "1080p" : "4k");
          }
        } catch (e) {
          setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "تعذّر.", error: true }]);
        }
      }
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "تعذّر.", error: true }]);
    } finally {
      setBusy(null);
    }
    return reply;
  };

  // ───────── talking with حيدرا ماكس ─────────
  const [recording, setRecording] = useState(false);
  const [talk, setTalk] = useState<null | "listening" | "hearing" | "thinking" | "speaking">(null);
  const [level, setLevel] = useState(0);
  // the microphone buttons only where the browser can record (decided in the browser, never on the server)
  const talkable = useSyncExternalStore(noSubscribe, canTalk, () => false);
  const recRef = useRef<RecordingHandle | null>(null);
  const talkRef = useRef(false);
  // the voice turns run for minutes: they always send with the latest timeline, selection and conversation
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });
  const voiceError = (e: unknown) => setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "تعذّر.", error: true }]);
  useEffect(
    () => () => {
      talkRef.current = false;
      recRef.current?.cancel();
      hush();
    },
    [],
  );
  /** 🎤 a voice message: press to talk, press again — the words are WRITTEN IN THE BOX to read, fix and send. */
  const voiceMessage = async () => {
    if (recRef.current) return recRef.current.stop();
    try {
      const h = await record({ onLevel: setLevel });
      recRef.current = h;
      setRecording(true);
      const r = await h.done;
      recRef.current = null;
      setRecording(false);
      if (!r) {
        diagNote("🎤 رسالة صوتية: ما فيه تسجيل (أقصر من 0.6 ث أو انلغى)", "note");
        return voiceError(new Error("ما وصلني صوت من المايك (التسجيل قصير أو المايك صامت). تأكد إن المايك الصحيح مختار، وسجّل ثانيتين على الأقل."));
      }
      diagNote(`🎤 رسالة صوتية: ${r.seconds.toFixed(1)} ث · ${Math.round(r.blob.size / 1024)} KB · ${r.mime} · أعلى مستوى ${r.peak.toFixed(3)}${r.meter ? "" : " (المقياس ما اشتغل)"}`);
      if (r.meter && r.peak < SILENT_PEAK) {
        diagNote("🎤 رسالة صوتية: المايك صامت — ما انرسل شي", "note");
        return voiceError(new Error("التسجيل صامت تمامًا — المايك ما التقط صوت. اختر المايك الصحيح من إعدادات الجهاز (على الماك: إعدادات النظام ← الصوت ← الإدخال) أو من أيقونة المايك في شريط عنوان Chrome، وجرّب مرة ثانية."));
      }
      setBusy("أكتب كلامك…");
      const said = await hear(projectId, r).finally(() => setBusy(null));
      diagNote(`🎤 رسالة صوتية: انكتب ${said.length} حرف${said ? ` «${said.slice(0, 60)}»` : ""}`);
      if (!said) return voiceError(new Error("سجّلت بس ما فهمت كلام في التسجيل. قرّب من المايك وجرّب مرة ثانية."));
      // nothing is sent by itself: the words are added to whatever is written, and the person presses «أرسل» when ready
      writeInBox(said, false);
    } catch (e) {
      recRef.current = null;
      setRecording(false);
      setBusy(null);
      diagNote(`🎤 رسالة صوتية: ${e instanceof Error ? e.message : String(e)}`, "error");
      voiceError(e);
    }
  };
  /** 🎧 a conversation: حيدرا ماكس listens, does it, answers aloud, and listens again — until it is turned off. */
  const conversation = async () => {
    if (talkRef.current) {
      talkRef.current = false;
      recRef.current?.cancel();
      hush();
      setTalk(null);
      return;
    }
    talkRef.current = true;
    try {
      while (talkRef.current) {
        setTalk("listening");
        const h = await record({ untilQuiet: true, onLevel: setLevel });
        recRef.current = h;
        const r = await h.done;
        recRef.current = null;
        if (!talkRef.current) break;
        if (!r) continue;
        setTalk("hearing");
        const said = await hear(projectId, r);
        if (!talkRef.current) break;
        if (!said) {
          voiceError(new Error("ما فهمت كلام في آخر تسجيل؛ أسمعك من جديد."));
          continue;
        }
        setTalk("thinking");
        const answer = await sendRef.current(said, true);
        if (!answer || !talkRef.current) continue;
        setTalk("speaking");
        await say(projectId, answer);
      }
    } catch (e) {
      voiceError(e);
    } finally {
      talkRef.current = false;
      recRef.current = null;
      setTalk(null);
    }
  };

  useEffect(() => {
    if (!ask || ask.n === sent.current || busy) return;
    const t = setTimeout(() => {
      // marked as sent only when it really goes (a render in between cancels the wait, not the request)
      sent.current = ask.n;
      void send(ask.text);
    }, 0);
    return () => clearTimeout(t);
  });

  // ───────── the conversation, laid out like Claude's chat (the owner, 2 November 2026: «نفس شات كلاود بالضبط، باسم حيدرا ماكس») ─────────
  const seen = (() => {
    const f = selected.length === 1 ? findClip(tl, selected[0]) : null;
    const as = f?.clip.assetId ? assets.get(f.clip.assetId) : null;
    return as && as.kind !== "audio" && f!.track.kind !== "audio" ? as : null;
  })();
  const attach = (a: EditorAsset) => setPending((x) => (x.some((y) => y.id === a.id) ? x.filter((y) => y.id !== a.id) : [...x, a].slice(-6)));
  const canSend = (!!text.trim() || pending.length > 0) && !busy && !readOnly;
  return (
    <div className="hm flex h-full min-h-0 flex-col bg-jw-surface" dir="rtl">
      <header className="flex items-center gap-2 px-3 py-2">
        <span className="jw-orb h-7 w-7 shrink-0" data-busy={!!busy} aria-hidden />
        <b className="min-w-0 flex-1 truncate text-[15px]">حيدرا ماكس</b>
        {msgs.length > 0 && (
          <button type="button" className="hm-icon" disabled={!!busy || readOnly} onClick={handOff} title="محادثة جديدة (حيدرا ماكس يلخّص اللي قبلها ويكمل منها)" aria-label="محادثة جديدة">
            <Icon name="plus" size={18} />
          </button>
        )}
        {onClose && (
          <button type="button" className="hm-icon" onClick={onClose} aria-label="إغلاق المحادثة" title="إغلاق">
            <Icon name="x" size={18} />
          </button>
        )}
      </header>

      <div className="jw-scroll min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        <div className="mx-auto flex w-full max-w-[46rem] flex-col gap-6 px-4 pb-6 pt-2">
          {chat.handoff && (
            <button type="button" className="self-center rounded-full border border-jw-line px-3 py-1 text-[12px] text-jw-muted hover:text-jw-ink" onClick={() => setShowHandoff((v) => !v)} aria-expanded={showHandoff}>
              المحادثة {chat.chats} · تكمل من ملخص اللي قبلها {showHandoff ? "▴" : "▾"}
            </button>
          )}
          {chat.handoff && showHandoff && <p className="jw-select-text whitespace-pre-wrap rounded-2xl bg-jw-surface-2 p-3 text-[13px] leading-6 text-jw-muted" dir="auto">{chat.handoff}</p>}

          {!msgs.length && chat.loaded && (
            <div className="flex flex-col items-center gap-5 pt-[12vh] text-center">
              <span className="jw-orb h-12 w-12" aria-hidden />
              <h2 className="text-2xl font-bold leading-snug">وش نسوي في المونتاج اليوم؟</h2>
              <div className="flex max-w-xl flex-wrap justify-center gap-2">
                {QUICK.slice(0, 6).map((q) => (
                  <button key={q} type="button" disabled={readOnly || !!busy} className="hm-chip" onClick={() => send(q)}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {msgs.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="jw-select-text max-w-[85%] self-start whitespace-pre-wrap rounded-3xl bg-jw-surface-3 px-4 py-2.5 text-[15px] leading-7" dir="auto">
                {m.text}
              </div>
            ) : (
              <div key={i} className={`hm-reply jw-select-text text-[15px] leading-7 ${m.error ? "text-jw-danger" : ""}`} dir="auto">
                <MsgText text={m.text} />
                {m.suggestions?.length ? (
                  <div className="mt-3 space-y-1.5">
                    {m.suggestions.map((s) => (
                      <a key={s.prompt} href={`/jawad-ai?kind=video&idea=${encodeURIComponent(s.prompt.slice(0, 500))}`} target="_blank" rel="noreferrer" className="block rounded-2xl border border-jw-line p-3 text-[13px] hover:border-jw-accent">
                        🎬 {s.why}
                        <span className="mt-1 block text-[11px] text-jw-faint" dir="ltr">{s.prompt}</span>
                      </a>
                    ))}
                  </div>
                ) : null}
                {m.options?.length && i === msgs.length - 1 && !busy ? <OptionGroups groups={m.options} disabled={readOnly} onSend={(words) => void send(words)} /> : null}
                {m.quick?.length && i === msgs.length - 1 && !busy ? (
                  <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="اختر إجابة">
                    {m.quick.map((q) => (
                      <button key={q} type="button" disabled={readOnly} className="hm-chip" onClick={() => send(q)}>
                        {q}
                      </button>
                    ))}
                  </div>
                ) : null}
                {m.plans?.map((x, k) => (
                  <div key={k} className="mt-3 rounded-2xl border border-jw-line p-3 text-[13px]">
                    <p className="text-jw-muted" dir="auto">{x.plan.prompt.slice(0, 200)}</p>
                    {x.state === "ask" ? (
                      <button
                        type="button"
                        className="jw-btn jw-btn-primary mt-2 !min-h-9 w-full text-[13px]"
                        disabled={readOnly || !!busy}
                        onClick={async () => {
                          const mark = (state: "started" | "failed") => setMsgs((all) => all.map((mm, j) => (j === i ? { ...mm, plans: mm.plans?.map((pp, kk) => (kk === k ? { ...pp, state } : pp)) } : mm)));
                          try {
                            await startMaking(projectId, x.plan);
                            mark("started");
                          } catch (e) {
                            mark("failed");
                            setMsgs((all) => [...all, { role: "assistant", text: e instanceof Error ? e.message : "تعذّر.", error: true }]);
                          }
                        }}
                      >
                        اصنعه (<Riyal halalas={x.plan.coins} size={13} />)
                      </button>
                    ) : (
                      <p className="mt-1.5 text-[12px] text-jw-ok">{x.state === "started" ? "بدأ الصنع ✓ ينحط على التايملاين لحاله" : "ما بدأ"}</p>
                    )}
                  </div>
                ))}
                {!m.error && <ReplyActions text={m.text} done={m.done} onUndo={i === msgs.length - 1 && m.done ? onUndo : undefined} />}
              </div>
            ),
          )}

          {busy && (
            <div className="flex items-center gap-2.5 text-[14px] text-jw-muted" role="status">
              <span className="jw-orb h-5 w-5 shrink-0" data-busy aria-hidden />
              <span className="hm-shimmer">{busy}</span>
            </div>
          )}
          {long && !busy && (
            <button type="button" className="self-center rounded-full border border-jw-line px-3 py-1.5 text-[12px] text-jw-muted hover:text-jw-ink" disabled={readOnly} onClick={handOff}>
              المحادثة طوّلت — ابدأ محادثة جديدة من ملخصها (أرخص وأسرع)
            </button>
          )}
          <div ref={end} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[46rem] px-3 pb-2">
        {(talk || recording) && (
          <div className="mb-2 flex items-center gap-2 rounded-2xl bg-jw-accent/10 px-3 py-2 text-[13px]" role="status" aria-live="polite">
            <span className="flex h-4 w-10 items-end gap-0.5" aria-hidden>
              {[0.5, 1, 0.7, 0.9].map((k, i) => (
                <span key={i} className="w-1.5 rounded-full bg-jw-accent transition-all" style={{ height: `${Math.max(15, Math.min(100, level * 100 * k))}%` }} />
              ))}
            </span>
            <span className="flex-1 font-semibold">{recording ? "أسجّل… اضغط 🎤 مرة ثانية لما تخلص" : talk === "listening" ? "🎧 أسمعك…" : talk === "hearing" ? "أكتب كلامك…" : talk === "thinking" ? "حيدرا ماكس يشتغل…" : "🔊 حيدرا ماكس يتكلم…"}</span>
            {talk === "speaking" && (
              <button type="button" className="hm-chip !py-0.5" onClick={hush}>
                قاطعه
              </button>
            )}
            <select
              className="rounded-full border border-jw-line bg-transparent px-2 py-0.5 text-[12px]"
              value={voicePick}
              aria-label="صوت ردود حيدرا ماكس"
              onChange={(e) => {
                setVoicePick(e.target.value);
                try {
                  localStorage.setItem(REPLY_VOICE_KEY, e.target.value);
                } catch {
                  /* this time only */
                }
              }}
            >
              <option value="auto">🔊 تلقائي</option>
              <option value="device">🖥️ صوت الجهاز</option>
              <option value="openai">OpenAI</option>
              <option value="elevenlabs">ElevenLabs</option>
              <option value="jawad">🧬 صوت الجواد</option>
              {[...ownVoices, ...(voicePick.startsWith("v:") && !ownVoices.some((v) => v.value === voicePick) ? [{ value: voicePick, name: "صوتي" }] : [])].map((v) => (
                <option key={v.value} value={v.value}>
                  🧬 {v.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <form
          className="hm-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          {(pending.length > 0 || refUploads.items.length > 0 || seen) && (
            <div className="flex flex-wrap items-center gap-1.5 px-3 pt-3">
              {seen && !pending.some((p) => p.id === seen.id) && (
                <span className="inline-flex items-center gap-1 rounded-xl border border-dashed border-jw-line px-2 py-1 text-[12px] text-jw-muted" title="حيدرا ماكس يشوف المقطع المحدد مع رسالتك">
                  <Icon name="eye" size={12} /> {seen.name.slice(0, 22)}
                </span>
              )}
              {pending.map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1.5 rounded-xl bg-jw-surface-3 py-1 pe-1 ps-1.5 text-[12px]">
                  <Thumb a={a} size={26} />
                  <span className="max-w-[9rem] truncate">{a.name}</span>
                  <button type="button" className="grid h-5 w-5 place-items-center rounded-full text-jw-muted hover:text-jw-ink" aria-label={`شيل ${a.name}`} onClick={() => attach(a)}>
                    ✕
                  </button>
                </span>
              ))}
              {refUploads.items.map((u) => (
                <span key={u.key} className={`inline-flex items-center gap-1 rounded-xl px-2 py-1 text-[12px] ${u.error ? "bg-jw-danger/15 text-jw-danger" : "bg-jw-surface-3"}`}>
                  {u.error ? `⚠️ ${u.name.slice(0, 18)}: ${u.error}` : `⏫ ${u.name.slice(0, 18)} ${Math.round(u.progress * 100)}٪`}
                  {u.error && (
                    <button type="button" aria-label="أخفِ" onClick={() => refUploads.dismiss(u.key)}>
                      ✕
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
          <textarea
            ref={textRef}
            className="hm-input"
            rows={1}
            dir="auto"
            value={text}
            disabled={readOnly}
            placeholder={diag && diagOn ? "🩺 وش صار؟ مثلًا: ليش التصدير وقف؟" : "اكتب لحيدرا ماكس…"}
            onChange={(e) => {
              setText(e.target.value);
              const el = e.target;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <input
            ref={fileRef}
            type="file"
            hidden
            multiple
            accept="image/*,video/*,audio/*"
            onChange={(e) => {
              if (e.target.files?.length) refUploads.add(e.target.files);
              e.target.value = "";
            }}
          />
          <div className="flex items-center gap-1 px-2 pb-2">
            <PlusMenu
              disabled={readOnly}
              onFile={() => fileRef.current?.click()}
              onStyles={() => setGallery(true)}
              diag={diag ? { on: diagOn, toggle: () => setDiagOn((v) => !v) } : undefined}
            />
            <ClaudeModelPicker menu disabled={!!busy} spent={chat.spent} />
            <span className="flex-1" />
            {talkable && (
              <>
                <button type="button" className={`hm-icon ${recording ? "!text-jw-danger" : ""}`} disabled={readOnly || !!talk || (!!busy && !recording)} onClick={() => void voiceMessage()} aria-pressed={recording} aria-label={recording ? "أوقف التسجيل" : "سجّل بصوتك"} title="🎤 سجّل بصوتك ويُكتب كلامك">
                  <Icon name="mic" size={18} />
                </button>
                <button type="button" className={`hm-icon ${talk ? "!text-jw-accent" : ""}`} disabled={readOnly || recording || (!!busy && !talk)} onClick={() => void conversation()} aria-pressed={!!talk} aria-label={talk ? "أنهِ المكالمة" : "كلّم حيدرا ماكس بالصوت"} title="🎧 كلّمه بالصوت">
                  {talk ? <Icon name="stop" size={18} /> : <span aria-hidden>🎧</span>}
                </button>
              </>
            )}
            {busy && canStop ? (
              <button type="button" className="hm-send" onClick={stop} aria-label="وقّف الطلب" title="وقّف: ما ينفّذ شي من رده">
                <Icon name="stop" size={16} />
              </button>
            ) : (
              <button type="submit" className="hm-send" disabled={!canSend} aria-label="أرسل">
                <Icon name="chevronUp" size={20} />
              </button>
            )}
          </div>
        </form>

        <MediaStrip assets={assets} picked={pending} onPick={attach} disabled={readOnly} />
      </div>
      <StylePicker open={gallery} disabled={readOnly || !!busy} onClose={() => setGallery(false)} onSend={(words) => void send(words)} />
    </div>
  );
}

/** Under a reply, like Claude's: copy, and — when it changed the timeline — what it did and its undo. */
function ReplyActions({ text, done, onUndo }: { text: string; done?: number; onUndo?: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 flex items-center gap-1 text-[12px] text-jw-muted">
      <button
        type="button"
        className="hm-icon !h-7 !w-7"
        aria-label="انسخ الرد"
        title={copied ? "انتسخ" : "انسخ"}
        onClick={() =>
          navigator.clipboard
            .writeText(text)
            .then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
            .catch(() => {})
        }
      >
        <Icon name={copied ? "check" : "copy"} size={14} />
      </button>
      {done ? (
        <span className="ms-1 inline-flex items-center gap-1 text-jw-ok">
          <Icon name="check" size={12} /> نفّذت {done === 1 ? "خطوة" : done === 2 ? "خطوتين" : `${done} خطوات`}
        </span>
      ) : null}
      {onUndo && (
        <button type="button" className="ms-2 rounded-full px-2 py-0.5 hover:bg-jw-surface-2 hover:text-jw-ink" onClick={onUndo}>
          ↩︎ تراجع
        </button>
      )}
    </div>
  );
}

/** «＋» in the composer: attach files, the motion styles, and (the owner) the diagnosis mode. */
function PlusMenu({ disabled, onFile, onStyles, diag }: { disabled?: boolean; onFile: () => void; onStyles: () => void; diag?: { on: boolean; toggle: () => void } }) {
  const [open, setOpen] = useState(false);
  const item = "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-start text-[14px] hover:bg-jw-surface-3";
  return (
    <span className="relative">
      <button type="button" className={`hm-icon ${diag?.on ? "!text-jw-accent" : ""}`} disabled={disabled} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="إضافة">
        <Icon name="plus" size={18} />
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-10 cursor-default" aria-label="إغلاق" onClick={() => setOpen(false)} />
          <span className="hm-pop absolute bottom-full start-0 z-20 mb-2 w-60">
            <button type="button" className={item} onClick={() => (setOpen(false), onFile())}>
              📎 <span>أرفق صور أو فيديو أو صوت</span>
            </button>
            <button type="button" className={item} onClick={() => (setOpen(false), onStyles())}>
              🎬 <span>أساليب الموشن ({MOTION_TEN.length})</span>
            </button>
            {diag && (
              <button type="button" className={item} onClick={() => (setOpen(false), diag.toggle())} aria-pressed={diag.on}>
                🩺 <span>{diag.on ? "أوقف التشخيص" : "تشخيص (لك بس)"}</span>
              </button>
            )}
          </span>
        </>
      )}
    </span>
  );
}

/** A file's little picture: its first frame or the image itself (sound: a note). */
function Thumb({ a, size }: { a: EditorAsset; size: number }) {
  const box = { width: size, height: size };
  if (a.kind === "image" && a.url) return <img src={a.url} alt="" style={box} className="shrink-0 rounded-lg object-cover" loading="lazy" />;
  if (a.kind === "video" && a.url) return <video src={`${a.url}#t=0.5`} muted playsInline preload="metadata" style={box} className="pointer-events-none shrink-0 rounded-lg bg-black object-cover" />;
  return (
    <span style={box} className="grid shrink-0 place-items-center rounded-lg bg-jw-surface-3 text-[14px]" aria-hidden>
      {a.kind === "audio" ? "🎵" : "📄"}
    </span>
  );
}

/** The project's media under the composer: a small strip scrolled sideways; a tap attaches a file to the message. */
function MediaStrip({ assets, picked, onPick, disabled }: { assets: Map<string, EditorAsset>; picked: EditorAsset[]; onPick: (a: EditorAsset) => void; disabled?: boolean }) {
  const list = [...assets.values()].filter((a) => a.status === "ready" && a.url).reverse();
  if (!list.length) return null;
  return (
    <div className="hm-strip mt-2" role="group" aria-label="وسائط المشروع: اضغط ملف عشان ترفقه برسالتك">
      {list.map((a) => {
        const on = picked.some((p) => p.id === a.id);
        return (
          <button key={a.id} type="button" disabled={disabled} onClick={() => onPick(a)} aria-pressed={on} title={a.name} className={`hm-strip-item ${on ? "on" : ""}`}>
            <Thumb a={a} size={52} />
            {on && <span className="hm-strip-check" aria-hidden>✓</span>}
          </button>
        );
      })}
    </div>
  );
}

const noSubscribe = () => () => {};

/** A reply as written: **bold**, and ```blocks``` (the designer's prompts) shown as copyable English blocks. */
/**
 * «الخيارات» — the groups حيدرا ماكس asks with: each a short question and its choices as buttons (several at once when it
 * says so). The person's picks go back as ONE message, so a whole brief is answered with presses, not typing.
 */
function OptionGroups({ groups, disabled, onSend }: { groups: { label: string; choices: string[]; multi: boolean }[]; disabled?: boolean; onSend: (words: string) => void }) {
  const [picked, setPicked] = useState<Record<number, string[]>>({});
  const toggle = (gi: number, c: string, multi: boolean) =>
    setPicked((p) => {
      const now = p[gi] ?? [];
      if (!multi) return { ...p, [gi]: now[0] === c ? [] : [c] };
      return { ...p, [gi]: now.includes(c) ? now.filter((x) => x !== c) : [...now, c] };
    });
  const answered = groups.filter((_, gi) => (picked[gi] ?? []).length).length;
  const words = groups
    .map((g, gi) => ((picked[gi] ?? []).length ? `${g.label.replace(/[:؟?]\s*$/, "")}: ${(picked[gi] ?? []).join("، ")}` : ""))
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="mt-2 space-y-2 border-t border-jw-line pt-2">
      {groups.map((g, gi) => (
        <div key={gi} className="space-y-1">
          <p className="text-[11px] font-semibold text-jw-ink">
            {g.label}
            {g.multi && <span className="ms-1 font-normal text-jw-faint">(أكثر من واحد)</span>}
          </p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={g.label}>
            {g.choices.map((c) => {
              const on = (picked[gi] ?? []).includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  disabled={disabled}
                  className={`jw-chip !px-2.5 !py-1 !text-xs ${on ? "!border-jw-accent !bg-jw-accent/15 !text-jw-ink" : ""}`}
                  onClick={() => toggle(gi, c, g.multi)}
                >
                  {on ? "✓ " : ""}
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <button type="button" className="jw-btn jw-btn-primary !min-h-8 text-xs" disabled={disabled || !answered} onClick={() => onSend(words)}>
          أرسل إجاباتي {answered ? `(${answered}/${groups.length})` : ""}
        </button>
        <button type="button" className="jw-chip !px-2.5 !py-1 !text-xs !border-dashed" disabled={disabled} onClick={() => onSend("اختر أنت كل شي وكمّل")}>
          اختر أنت وكمّل
        </button>
      </div>
    </div>
  );
}

function MsgText({ text }: { text: string }) {
  const parts = text.split(/```\n?([\s\S]*?)\n?```/g);
  return (
    <div className="space-y-1.5">
      {parts.map((part, i) =>
        i % 2 ? (
          <CodeBlock key={i} code={part} />
        ) : part.trim() ? (
          <p key={i} className="whitespace-pre-wrap">
            {part.replace(/^\n+|\n+$/g, "").split(/\*\*(.+?)\*\*/g).map((x, j) => (j % 2 ? <b key={j}><Coined text={x} /></b> : <Coined key={j} text={x} />))}
          </p>
        ) : null,
      )}
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative rounded-lg border border-jw-line bg-jw-bg-2">
      <button
        type="button"
        className="absolute end-1 top-1 rounded px-1.5 py-0.5 text-[10px] text-jw-muted hover:text-jw-ink"
        onClick={() =>
          navigator.clipboard
            .writeText(code)
            .then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
            .catch(() => {})
        }
      >
        {copied ? "انتسخ ✓" : "انسخ"}
      </button>
      <pre className="jw-scroll max-h-48 overflow-auto whitespace-pre-wrap p-2 pt-5 text-[11px] leading-5" dir="ltr">
        {code}
      </pre>
    </div>
  );
}

/** Pictures of a clip (JPEG, base64) passed through its grading layers, as the export draws them. */
/** A JPEG's scope (the numbers a colourist reads). */
async function scopeOfJpeg(data: string): Promise<Scope | null> {
  try {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${data}`;
    await img.decode();
    return scopeOfCanvas(img, img.naturalWidth, img.naturalHeight);
  } catch {
    return null;
  }
}
function scopeOfCanvas(src: CanvasImageSource, w: number, h: number) {
  const k = Math.min(1, 320 / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(src, 0, 0, c.width, c.height);
  return scopeOf(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
}

async function gradedFrames(frames: { t: number; data: string }[], layers: Grade[], own: (t: number) => number) {
  const out: { t: number; data: string; graded: true; scope: Scope }[] = [];
  for (const f of frames) {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${f.data}`;
    await img.decode();
    const g = gradeLayers(img, img.naturalWidth, img.naturalHeight, layers, own(f.t), true);
    if (!g) continue;
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext("2d")!.drawImage(g.img, 0, 0, c.width, c.height);
    out.push({ t: f.t, data: c.toDataURL("image/jpeg", 0.72).split(",")[1], graded: true, scope: scopeOfCanvas(c, c.width, c.height) });
  }
  return out;
}
