"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { clipEnd, findClip, mainTrack, type Timeline } from "@/lib/editor/model";
import { framesOf } from "./media";
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
import { postJson } from "@/lib/fetch";
import { MOODS, MOTION_STYLES, styleInText } from "@/lib/editor/motion-styles";
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

interface Msg {
  role: "user" | "assistant";
  text: string;
  done?: number;
  suggestions?: { prompt: string; why: string }[];
  /** clickable answers under حيدرة's last reply (with «✍️ اكتب إجابة مختلفة») */
  quick?: string[];
  /** «اصنع لي…» that cost coins: shown with their price, started by a tap */
  plans?: { plan: MakePlan; state: "ask" | "started" | "failed" }[];
  error?: boolean;
}

/** From here a handoff is suggested (same as the server's CHAT_LONG). */
const LONG = { messages: 40, chars: 24_000 };
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
  projectId,
  tl,
  selected,
  assets,
  player,
  run,
  onUndo,
  onClose,
  readOnly,
  big,
  onBig,
  mode = "dock",
  onMode,
  zoom,
  onZoom,
  diag,
}: {
  /** a request sent from a button (sent once per `n`) */
  ask?: { text: string; n: number } | null;
  /** new library files (made for the edit) */
  onAssets: (a: EditorAsset[]) => void;
  /** splits a clip's sound into talking / music / effects tracks */
  onSeparate: (clipId: string) => Promise<void>;
  /** cuts a video clip at every change of shot */
  onSceneCut: (clipId: string) => Promise<number>;
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
  /** حيدرة's place on a computer: beside the preview, the whole side, or half the screen */
  mode?: "dock" | "tall" | "half";
  onMode?: (m: "dock" | "tall" | "half") => void;
  /** its text size (1 = normal) */
  zoom?: number;
  onZoom?: (z: number) => void;
  /** the site's owner: «🩺 تشخيص» (the editor's state, read when asked) */
  diag?: () => Record<string, unknown>;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  // «🎬 مهارات الموشن»: the named motion skills as chips (one press writes the start of the request)
  const [showSkills, setShowSkills] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  // «🎭 المشاعر»: the feeling of the piece, added to what is written (or the start of a request)
  const pickMood = (ar: string) => {
    setText((t) => (t.trim() ? `${t.replace(/\s*بمزاج «[^»]*»/, "")} بمزاج «${ar}»` : `موشن جرافيكس بمزاج «${ar}» عن: `));
    setTimeout(() => textRef.current?.focus(), 0);
  };
  const pickSkill = (ar: string) => {
    const talk = MOTION_STYLES.find((m) => m.ar === ar)?.talk;
    setText(talk ? `ركّب موشن على كلامي بمهارة «${ar}»` : `موشن جرافيكس بمهارة «${ar}» عن: `);
    setShowSkills(false);
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
  // «📎 مراجع»: files attached to the next message (uploaded to the library, seen by حيدرة with the message)
  const [pending, setPending] = useState<EditorAsset[]>([]);
  const refUploads = useUploads(projectId, (a) => {
    onAssets([a]);
    setPending((x) => (x.some((y) => y.id === a.id) ? x : [...x, a].slice(-6)));
  });
  const fileRef = useRef<HTMLInputElement>(null);
  // who reads حيدرة's spoken replies (this device): any provider, or one of the person's own voices
  const [voicePick, setVoicePick] = useState("auto");
  useEffect(() => setVoicePick(replyVoice()), []);
  // the timeline as it is now (what was made arrives after Claude's own steps were applied)
  const tlRef = useRef(tl);
  useEffect(() => {
    tlRef.current = tl;
  }, [tl]);
  // «🩺 تشخيص»: the next message asks حيدرة to find what went wrong (the owner only)
  const [diagOn, setDiagOn] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [msgs, busy]);

  // ---------- the edit's conversation stays with the project (server; before the migration, this device) ----------
  const [chat, setChat] = useState<{ loaded: boolean; stored: boolean; handoff: string | null; chats: number }>({ loaded: false, stored: false, handoff: null, chats: 1 });
  const [showHandoff, setShowHandoff] = useState(false);
  useEffect(() => {
    let live = true;
    postJson<Chat>(`/api/jawad/editor/projects/${projectId}`, { action: "chat" })
      .catch(() => ({ messages: [], handoff: null, chats: 1, stored: false }) as Chat)
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
        setChat({ loaded: true, stored: c.stored, handoff: saved.handoff, chats: saved.chats });
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
    setBusy("حيدرة يكتب الهاندوف ويبدأ محادثة جديدة…");
    try {
      const c = await postJson<Chat>(`/api/jawad/editor/projects/${projectId}`, { action: "handoff", messages: msgs.filter((m) => !m.error), handoff: chat.handoff });
      setMsgs([]);
      setChat((x) => ({ ...x, handoff: c.handoff, chats: c.chats }));
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
    if (!seenFrames.current.size) setBusy("حيدرة يشوف المقطع المحدد…");
    return lookAtClip(tl, selected[0]);
  };
  /** «يشيك التلوين»: rounds of look → judge → correct, the result told only when حيدرة is satisfied (or out of rounds). */
  const checkColour = async (clipId: string, request: string, start: Timeline) => {
    let at = start;
    let steps = 0;
    for (let round = 1; round <= MAX_CHECKS; round++) {
      setBusy(round === 1 ? "حيدرة يشيك نتيجة التلوين (الصورة والسكوبات)…" : `حيدرة يعيد يشيك بعد التعديل (جولة ${round})…`);
      const look = await lookAtClip(at, clipId);
      if (!look) return;
      const c = await postJson<{ ok: boolean; verdict: string; commands: Command[] }>(`/api/jawad/editor/projects/${projectId}`, { action: "grade_check", clipId, round, request, timeline: at, look });
      if (c.ok || !c.commands.length) {
        setMsgs((m) => [...m, { role: "assistant", text: `✅ ${c.verdict}`, done: steps || undefined }]);
        return;
      }
      const applied = run(c.commands, { label: `حيدرة يضبط التلوين (${round})` });
      if (!applied) return;
      at = (applied as { timeline: Timeline }).timeline;
      steps += c.commands.length;
      if (round === MAX_CHECKS) setMsgs((m) => [...m, { role: "assistant", text: c.verdict, done: steps }]);
    }
  };
  /** Sends a request; resolves with حيدرة's reply (null when nothing was answered). `spoken`: said by voice. */
  // one request at a time: a second Enter (or a click) before the page shows «busy» used to send it twice
  const sendingRef = useRef(false);
  // «⏹️ وقّف»: the request in flight is dropped (nothing it answers is applied or made)
  const abortRef = useRef<AbortController | null>(null);
  // a request that continues by itself once this one is done (the captions written → the motion on the words)
  const followUp = useRef<string | null>(null);
  const [canStop, setCanStop] = useState(false);
  // the person's own voices made here (a voiceprint): offered for حيدرة's spoken replies
  const [ownVoices, setOwnVoices] = useState<{ value: string; name: string }[]>([]);
  const stop = () => {
    abortRef.current?.abort();
    talkRef.current = false;
    recRef.current?.cancel();
    hush();
  };
  /** «بصمة صوتك»: the person's voice from a clip (or the microphone) → a voice of their library, with their consent. */
  const takeVoiceprint = async (clipId: string, name: string, provider: "jawad" | "minimax" | "elevenlabs") => {
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
    const { wav, seconds } = await wavOf(source);
    if (!window.confirm(`أؤكد إن الصوت في هذا التسجيل (${Math.round(seconds)} ث) صوتي، أو عندي إذن صاحبه أنسخه.`)) throw new Error("ما أخذت البصمة (ما تأكدنا من الإذن).");
    setBusy("آخذ بصمة صوتك…");
    const r = await postJson<{ voice: { name: string; value: string } }>(`/api/jawad/editor/projects/${projectId}`, { action: "voiceprint", audio: await blobBase64(wav), seconds, name, consent: true, provider });
    setOwnVoices((x) => [...x.filter((v) => v.value !== r.voice.value), { value: r.voice.value, name: r.voice.name }]);
    setMsgs((m) => [...m, { role: "assistant", text: `✅ صار عندك صوت «${r.voice.name}» في مكتبتك. قل لي «اقرأ هالنص بصوت ${r.voice.name}»، أو اختره لردودي من 🔊 وقت المكالمة.` }]);
  };
  // «المربع الصغير» / «فوق كلامي»: the face in the talking video (found once per file, here in the browser), the
  // talking clips moved so a crop never cuts it, and its place on the frame sent to حيدرة (the box follows it, the
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
      diagNote(`حيدرة: طلب ما انرسل لأن طلب ثاني شغّال («${message.slice(0, 40)}»)`, "note");
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
        setBusy("حيدرة يفحص المحرر والملفات والسجل…");
        const report = await diagReport(diag());
        const r = await postJson<{ reply: string; commands?: Command[] }>(`/api/jawad/editor/projects/${projectId}`, { action: "diagnose", message, report, timeline: tl, selected, playhead: player?.ms ?? 0, shot: previewShot() }, signal);
        // what he diagnosed in the timeline, he fixes now
        if (r.commands?.length) run(r.commands, { label: "حيدرة يعالج" });
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
      // the clip the person chose: Claude looks at a few of its moments to know what is in it
      const look = await lookAt();
      if (signal.aborted) throw Object.assign(new Error("⏹️ وقّفت الطلب."), { name: "AbortError" });
      // the attached videos: a few of their moments, so حيدرة sees what is in them (pictures go as they are)
      const refLooks: { id: string; frames: { t: number; data: string }[] }[] = [];
      for (const a of pending.filter((x) => x.kind === "video" && x.url)) {
        setBusy(`حيدرة يشوف المرجع «${a.name}»…`);
        const frames = await framesOf(a.url!, "video", 0, a.durationMs ?? 3000, 3).catch(() => []);
        if (frames.length) refLooks.push({ id: a.id, frames: frames.map((f) => ({ t: f.t, data: f.data })) });
      }
      const found = await talkFace(message).catch(() => null);
      setBusy("حيدرة يشتغل على التايملاين…");
      const r = await postJson<{ reply: string; commands: Command[]; suggestions: { prompt: string; why: string }[]; quick?: string[]; requests?: MakeRequest[]; checkClipId?: string | null; assets?: EditorAsset[] }>(`/api/jawad/editor/projects/${projectId}`, {
        action: "assistant",
        message,
        history,
        handoff: chat.handoff,
        // (the talking clips moved to keep the face in view, when they were)
        timeline: found?.timeline ?? tl,
        playhead: player?.ms ?? 0,
        selected,
        quiet,
        look,
        spoken,
        refs: pending.map((a) => a.id),
        refLooks,
        face: found?.face ?? null,
      }, signal);
      setPending([]);
      reply = r.reply;
      let done = 0;
      let now = found?.timeline ?? tl;
      // the art a motion piece drew for itself: in the library before the commands that place it
      if (r.assets?.length) onAssets(r.assets);
      if (r.commands.length) {
        const applied = run(r.commands, { label: `حيدرة: ${message.slice(0, 40)}` });
        done = applied ? r.commands.length : 0;
        if (applied) now = (applied as { timeline: Timeline }).timeline;
      }
      setMsgs((m) => [...m, { role: "assistant", text: r.reply, done, suggestions: r.suggestions, ...(r.quick?.length ? { quick: r.quick } : {}) }]);
      // a colour change: حيدرة looks at the result (pictures and scopes) and corrects it until it is right
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
            // حيدرة → جواد: what the robot asks جواد to make is made at once, with no permission step (the price is
            // told after). Only what the person asks جواد for directly, in his own form, waits for their «توليد».
            setBusy(`أبدأ أصنع «${plan.name}»…`);
            await startMaking(projectId, plan);
            setMsgs((m) => [...m, { role: "assistant", text: `سلّمت الطلب لجواد وبدأ يصنع «${plan.name}» بـ ${plan.generatorName}${plan.free ? "" : ` (${plan.coins} نقدة)`}${plan.kind === "video" ? " (الفيديو ياخذ كم دقيقة)" : ""}؛ ينحط على التايملاين لحاله أول ما يخلص، ويظهر في «أعمالي».` }]);
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
            // listened to and written here, then حيدرة's own follow-ups (font, place, entrance…) on the new captions
            const now = tlRef.current;
            const all = captionSources(now, assets);
            const sources = q.clipId ? all.filter((x) => x.clip.id === q.clipId) : all;
            if (!sources.length) throw new Error("ما فيه مقاطع فيها كلام أكتبه.");
            const items = q.poem?.trim() ? await poemCaptions(projectId, sources[0], q.poem, setBusy) : (await spokenCaptions(projectId, now, sources, q.lang ?? "ar", setBusy)).items;
            const before = new Set(now.tracks.map((t) => t.id));
            const style = (["karaoke", "classic", "box", "neon", "poem"] as const).find((k) => k === q.captionStyle) ?? (q.poem?.trim() ? "poem" : "karaoke");
            const made = run({ type: "add_captions", items, style, name: q.poem?.trim() ? "الأبيات" : "كابشن" }, { label: `كابشن من حيدرة (${items.length})` }) as { timeline: Timeline } | null;
            const track = made?.timeline.tracks.find((t) => t.kind === "text" && !before.has(t.id));
            const more = track ? expandThen(q.then ?? [], track.id, track.clips.map((c) => c.id)) : [];
            // all together (one undo); if one of them can't run, the others still do, one by one
            if (track && more.length && !run(more, { label: "حيدرة يكمّل على الكابشن" })) for (const c of more) run(c, { label: "حيدرة يكمّل على الكابشن" });
          } else if (q.kind === "talk_motion") {
            // the words with their times first (the captions of the talking video), then حيدرة is asked again by itself
            const now = tlRef.current;
            const f = findClip(now, q.clipId);
            const sources = captionSources(now, assets).filter((x) => !f?.clip.assetId || x.clip.assetId === f.clip.assetId);
            if (!sources.length) throw new Error("ما لقيت كلام في المقطع أركّب عليه الموشن.");
            const items = (await spokenCaptions(projectId, now, sources, "ar", setBusy)).items;
            run({ type: "add_captions", items, style: "karaoke", name: "كابشن" }, { label: `كابشن (${items.length})` });
            followUp.current = "كمّل: الحين كلامي مكتوب بتوقيته — ركّب الموشن على كلامي (talk) بأسلوب ماجد.";
          } else if (q.kind === "voiceprint") {
            await takeVoiceprint(q.clipId, q.name || q.text || "صوتي", q.voice === "elevenlabs" ? "elevenlabs" : q.voice === "minimax" ? "minimax" : "jawad");
          } else if (q.kind === "separate") {
            setBusy("نفصل الكلام والموسيقى والمؤثرات…");
            await onSeparate(q.clipId);
          } else if (q.kind === "scene_cut") {
            setBusy("أقرأ المشاهد وأقطّع عند كل تغيّر…");
            await onSceneCut(q.clipId);
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

  // ───────── talking with حيدرة ─────────
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
  /** 🎤 a voice message: press to talk, press again to send. */
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
      // the words go into the conversation even if something stops them being sent (so they are never lost)
      const answer = await sendRef.current(said);
      if (answer === null && !sendingRef.current) setText(said);
    } catch (e) {
      recRef.current = null;
      setRecording(false);
      setBusy(null);
      diagNote(`🎤 رسالة صوتية: ${e instanceof Error ? e.message : String(e)}`, "error");
      voiceError(e);
    }
  };
  /** 🎧 a conversation: حيدرة listens, does it, answers aloud, and listens again — until it is turned off. */
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2.5 border-b border-jw-line px-3 py-2.5">
        <span className="jw-orb h-9 w-9 shrink-0" data-busy={!!busy} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">حيدرة · مساعدك في المونتاج</span>
          <span className="flex items-center gap-1 text-[11px] text-jw-muted" aria-live="polite">
            <span className={`h-1.5 w-1.5 rounded-full ${busy ? "animate-pulse bg-jw-warn" : "bg-jw-ok"}`} />
            {busy ? "يشتغل…" : "جاهز يخدمك"}
          </span>
        </span>
        {msgs.length > 0 && (
          <button type="button" className={`jw-btn !min-h-8 !px-2 text-[11px] ${long ? "!border-jw-accent/60 text-jw-accent" : "jw-btn-quiet"}`} disabled={!!busy || readOnly} onClick={handOff} title="حيدرة يلخّص المحادثة (هاندوف) ويبدأ محادثة جديدة منها">
            <Icon name="retry" size={13} /> محادثة جديدة
          </button>
        )}
        {onZoom && zoom != null && (
          <span className="flex items-center rounded-full border border-jw-line" role="group" aria-label="حجم الكلام">
            <button type="button" className="grid h-8 w-8 place-items-center rounded-full text-jw-muted hover:text-jw-ink disabled:opacity-40" disabled={zoom <= 0.85} onClick={() => onZoom(Math.round((zoom - 0.15) * 100) / 100)} aria-label="صغّر الكلام" title="صغّر الكلام">
              <Icon name="zoomOut" size={15} />
            </button>
            <button type="button" className="grid h-8 w-8 place-items-center rounded-full text-jw-muted hover:text-jw-ink disabled:opacity-40" disabled={zoom >= 1.6} onClick={() => onZoom(Math.round((zoom + 0.15) * 100) / 100)} aria-label="كبّر الكلام" title="كبّر الكلام">
              <Icon name="zoomIn" size={15} />
            </button>
          </span>
        )}
        {onMode && !big && (
          <span className="hidden items-center rounded-full border border-jw-line p-0.5 lg:flex" role="radiogroup" aria-label="مكان حيدرة">
            {(
              [
                ["dock", "عادي", "جنب المعاينة"],
                ["tall", "طول كامل", "الجهة كاملة من فوق لتحت"],
                ["half", "نص الشاشة", "نص الشاشة من فوق لتحت"],
              ] as const
            ).map(([m, label, title]) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} title={title} onClick={() => onMode(m)} className={`rounded-full px-2 py-1 text-[11px] ${mode === m ? "bg-jw-accent text-jw-on-accent" : "text-jw-muted hover:text-jw-ink"}`}>
                {label}
              </button>
            ))}
          </span>
        )}
        {onBig && (
          <span className="hidden lg:contents">
            <button type="button" className={`jw-btn !min-h-8 !px-2 text-[11px] ${big ? "!border-jw-accent/60 text-jw-accent" : "jw-btn-quiet"}`} onClick={onBig} aria-pressed={!!big} title={big ? "رجّع المحادثة لمكانها (Esc)" : "كبّر المحادثة على الشاشة كلها"}>
              <Icon name={big ? "shrink" : "expand"} size={14} /> {big ? "تصغير" : "تكبير"}
            </button>
          </span>
        )}
        {onClose && (
          <>
            {/* a phone: the conversation fills the screen, and this brings the timeline back */}
            <span className="contents lg:hidden">
              <button type="button" className="jw-btn jw-btn-primary !min-h-9 !px-3 text-xs" onClick={onClose} aria-label="صغّر المحادثة وارجع للتايملاين">
                <Icon name="shrink" size={15} /> تصغير
              </button>
            </span>
            <span className="hidden lg:contents">
              <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon" onClick={onClose} aria-label="إغلاق">
                <Icon name="x" />
              </button>
            </span>
          </>
        )}
      </div>
      <div className="jw-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
        {chat.handoff && (
          <div className="rounded-xl border border-jw-accent/30 bg-jw-accent/5 p-2.5 text-xs">
            <button type="button" className="flex w-full items-center gap-1.5 font-semibold text-jw-accent" onClick={() => setShowHandoff((v) => !v)} aria-expanded={showHandoff}>
              <Icon name="check" size={12} /> المحادثة {chat.chats} · تبدأ من هاندوف اللي قبلها
              <span className="ms-auto text-jw-muted">{showHandoff ? "إخفاء" : "عرض"}</span>
            </button>
            {showHandoff && <p className="mt-2 whitespace-pre-wrap leading-6 text-jw-muted" dir="auto">{chat.handoff}</p>}
          </div>
        )}
        {!msgs.length && chat.loaded && (
          <div className="space-y-3">
            <div className="max-w-[92%] rounded-2xl rounded-ss-sm bg-jw-surface-2 px-3 py-2 text-sm leading-6">
              هلا! أنا حيدرة، مساعدك في المونتاج 👋
              <span className="mt-1 block text-xs leading-6 text-jw-muted">قل لي وش تبي بكلامك وأنا أعدّل التايملاين: أقص السكتات، أرتّب، أحط انتقالات ونصوص وكابشن، وأنظّف الصوت. كل اللي أسويه تتراجع عنه بضغطة.</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK.map((q) => (
                <button key={q} type="button" disabled={readOnly || !!busy} className="jw-chip !px-2.5 !py-1 !text-xs" onClick={() => send(q)}>
                  {q}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-jw-muted">🎬 موشن جرافيكس بمهارة جاهزة:</p>
            <div className="flex flex-wrap gap-1.5">
              {MOTION_STYLES.slice(0, 6).map((m) => (
                <button key={m.id} type="button" disabled={readOnly || !!busy} className="jw-chip !px-2.5 !py-1 !text-xs" title={m.hint} onClick={() => pickSkill(m.ar)}>
                  {m.icon} {m.ar}
                </button>
              ))}
              <button type="button" disabled={readOnly} className="jw-chip !px-2.5 !py-1 !text-xs" onClick={() => setShowSkills(true)}>
                كل المهارات ({MOTION_STYLES.length})
              </button>
            </div>
            <p className="text-[11px] text-jw-muted">🎭 بأي شعور؟</p>
            <div className="flex flex-wrap gap-1.5">
              {MOODS.map((m) => (
                <button key={m.id} type="button" disabled={readOnly || !!busy} className="jw-chip !px-2.5 !py-1 !text-xs" title={m.hint} onClick={() => pickMood(m.ar)}>
                  {m.icon} {m.ar}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-6 ${m.role === "user" ? "ms-auto bg-jw-accent/15" : m.error ? "bg-jw-danger/15 text-jw-danger" : "bg-jw-surface-2"}`} dir="auto">
            <MsgText text={m.text} />
            {m.done ? (
              <p className="mt-1.5 flex items-center gap-2 text-[11px] text-jw-ok">
                <Icon name="check" size={12} /> نفّذت {m.done === 1 ? "خطوة وحدة" : m.done === 2 ? "خطوتين" : `${m.done} خطوات`}
                {i === msgs.length - 1 && (
                  <button type="button" className="text-jw-muted underline" onClick={onUndo}>
                    تراجع
                  </button>
                )}
              </p>
            ) : null}
            {m.suggestions?.length ? (
              <div className="mt-2 space-y-1.5 border-t border-jw-line pt-2">
                <p className="text-[11px] text-jw-muted">لقطات تكمّل الفيديو:</p>
                {m.suggestions.map((s) => (
                  <a key={s.prompt} href={`/jawad-ai?kind=video&idea=${encodeURIComponent(s.prompt.slice(0, 500))}`} target="_blank" rel="noreferrer" className="block rounded-lg border border-jw-line p-2 text-xs hover:border-jw-accent">
                    🎬 {s.why}
                    <span className="block text-[10px] text-jw-faint" dir="ltr">{s.prompt}</span>
                  </a>
                ))}
              </div>
            ) : null}
            {m.quick?.length && i === msgs.length - 1 && !busy ? (
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="اختر إجابة">
                {m.quick.map((q) => (
                  <button key={q} type="button" disabled={readOnly} className="jw-chip !px-2.5 !py-1 !text-xs" onClick={() => send(q)}>
                    {q}
                  </button>
                ))}
                <button type="button" disabled={readOnly} className="jw-chip !px-2.5 !py-1 !text-xs !border-dashed" onClick={() => textRef.current?.focus()}>
                  ✍️ اكتب إجابة مختلفة
                </button>
              </div>
            ) : null}
            {m.plans?.map((x, k) => (
              <div key={k} className="mt-2 rounded-lg border border-jw-line p-2 text-xs">
                <p className="text-jw-muted" dir="auto">{x.plan.prompt.slice(0, 200)}</p>
                {x.state === "ask" ? (
                  <button
                    type="button"
                    className="jw-btn jw-btn-primary mt-2 !min-h-8 w-full text-xs"
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
                    اصنعه ({x.plan.coins} نقدة)
                  </button>
                ) : (
                  <p className="mt-1.5 text-[11px] text-jw-ok">{x.state === "started" ? "بدأ الصنع ✓ ينحط على التايملاين لحاله" : "ما بدأ"}</p>
                )}
              </div>
            ))}
          </div>
        ))}
        {long && !busy && (
          <div className="rounded-xl border border-jw-warn/40 bg-jw-warn/10 p-2.5 text-xs">
            المحادثة طوّلت. خلّ حيدرة يكتب هاندوف لكل اللي اتفقنا عليه ويبدأ محادثة جديدة منه — يتذكّر ذوقك وقراراتك ويرد أسرع.
            <button type="button" className="jw-btn jw-btn-primary mt-2 !min-h-8 w-full text-xs" disabled={readOnly} onClick={handOff}>
              سوّ هاندوف وابدأ محادثة جديدة
            </button>
          </div>
        )}
        {busy && (
          <p className="flex items-center gap-2 text-xs text-jw-muted">
            <span className="jw-spinner" /> {busy}
          </p>
        )}
        <div ref={end} />
      </div>
      {(() => {
        const f = selected.length === 1 ? findClip(tl, selected[0]) : null;
        const as = f?.clip.assetId ? assets.get(f.clip.assetId) : null;
        return as && as.kind !== "audio" && f!.track.kind !== "audio" ? (
          <p className="flex items-center gap-1.5 border-t border-jw-line px-3 pt-1.5 text-[11px] text-jw-muted">
            <Icon name="eye" size={13} className="text-jw-accent" /> حيدرة بيشوف المقطع المحدد «{as.name}» مع رسالتك
          </p>
        ) : null;
      })()}
      {(talk || recording) && (
        <div className="flex items-center gap-2 border-t border-jw-line bg-jw-accent/10 px-3 py-2 text-xs" role="status" aria-live="polite">
          <span className="flex h-4 w-10 items-end gap-0.5" aria-hidden>
            {[0.5, 1, 0.7, 0.9].map((k, i) => (
              <span key={i} className="w-1.5 rounded-full bg-jw-accent transition-all" style={{ height: `${Math.max(15, Math.min(100, level * 100 * k))}%` }} />
            ))}
          </span>
          <span className="flex-1 font-semibold">
            {recording
              ? "أسجّل… اضغط 🎤 مرة ثانية لما تخلص"
              : talk === "listening"
                ? "🎧 أسمعك… تكلّم، وأفهم لحالي لما تسكت"
                : talk === "hearing"
                  ? "أكتب كلامك…"
                  : talk === "thinking"
                    ? "حيدرة يشتغل…"
                    : "🔊 حيدرة يتكلم…"}
          </span>
          {talk === "speaking" && (
            <button type="button" className="jw-btn jw-btn-quiet !min-h-7 !px-2 text-[11px]" onClick={hush}>
              قاطعه
            </button>
          )}
          <select
            className="jw-select !min-h-7 !py-0 text-[11px]"
            value={voicePick}
            aria-label="صوت ردود حيدرة"
            title="🔊 مين يقرأ ردود حيدرة (كلاود يكتب الرد، ومزوّد الصوت يقرأه)"
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
            <option value="device">🖥️ صوت الجهاز (مجاني)</option>
            <option value="openai">OpenAI</option>
            <option value="minimax">MiniMax</option>
            <option value="elevenlabs">ElevenLabs</option>
            <option value="jawad">🧬 صوت الجواد (بصمتي)</option>
            {[...ownVoices, ...(voicePick.startsWith("v:") && !ownVoices.some((v) => v.value === voicePick) ? [{ value: voicePick, name: "صوتي" }] : [])].map((v) => (
              <option key={v.value} value={v.value}>
                🧬 {v.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {(pending.length > 0 || refUploads.items.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-jw-line px-2 pt-2 text-[11px]">
          {pending.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-jw-accent/15 px-2 py-1 font-semibold">
              📎 {a.kind === "image" ? "🖼️" : a.kind === "video" ? "🎬" : "🎵"} {a.name.slice(0, 24)}
              <button type="button" className="text-jw-muted" aria-label={`شيل ${a.name}`} onClick={() => setPending((x) => x.filter((y) => y.id !== a.id))}>
                ✕
              </button>
            </span>
          ))}
          {refUploads.items.map((u) => (
            <span key={u.key} className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${u.error ? "bg-jw-danger/15 text-jw-danger" : "bg-jw-line/40"}`}>
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
      <div className="border-t border-jw-line px-2 pt-1.5">
        <button type="button" className="text-[11px] font-semibold text-jw-accent" onClick={() => setShowSkills((v) => !v)} aria-expanded={showSkills} disabled={readOnly}>
          🎬 مهارات الموشن {showSkills ? "▴" : "▾"}
        </button>
        {showSkills && (
          <div className="mt-1.5 space-y-1.5 pb-1">
            <p className="text-[11px] leading-5 text-jw-muted">اختر مهارة واكتب موضوعك، أو اكتب اسمها في أي طلب. وأي شي تطلبه زيادة (لون، سرعة، بدون أصوات…) يمشي على المهارة.</p>
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {MOTION_STYLES.map((m) => (
                <button key={m.id} type="button" disabled={readOnly || !!busy} className="jw-chip !px-2.5 !py-1 !text-xs" title={m.hint} onClick={() => pickSkill(m.ar)}>
                  {m.icon} {m.ar}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <form
        className="flex items-end gap-2 border-t border-jw-line p-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
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
        <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon shrink-0" disabled={readOnly} onClick={() => fileRef.current?.click()} aria-label="أرفق مراجع" title="📎 أرفق صور أو فيديو أو صوت مع رسالتك: حيدرة يشوفها ويستخدمها">
          📎
        </button>
        <textarea
          ref={textRef}
          className="jw-textarea max-h-32 min-h-11 min-w-0 flex-1 resize-none text-sm"
          rows={1}
          dir="auto"
          value={text}
          disabled={readOnly}
          placeholder={diag && diagOn ? "🩺 وش صار؟ مثلًا: ليش التصدير وقف؟" : "مثلًا: قص السكتات وحط كابشن"}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
        />
        {talkable && (
          <>
            <button
              type="button"
              className={`jw-btn jw-btn-icon shrink-0 ${recording ? "!border-jw-danger bg-jw-danger/15 text-jw-danger" : "jw-btn-quiet"}`}
              disabled={readOnly || !!talk || (!!busy && !recording)}
              onClick={() => void voiceMessage()}
              aria-pressed={recording}
              aria-label={recording ? "أرسل التسجيل" : "سجّل رسالة صوتية"}
              title="🎤 رسالة صوتية: اضغط وتكلّم، واضغط مرة ثانية للإرسال"
            >
              <Icon name="mic" />
            </button>
            <button
              type="button"
              className={`jw-btn jw-btn-icon shrink-0 ${talk ? "!border-jw-accent bg-jw-accent/15 text-jw-accent" : "jw-btn-quiet"}`}
              disabled={readOnly || recording || (!!busy && !talk)}
              onClick={() => void conversation()}
              aria-pressed={!!talk}
              aria-label={talk ? "أنهِ المكالمة" : "كلّم حيدرة بالصوت"}
              title="🎧 كلّم حيدرة: تتكلم ويرد عليك بصوته وينفذ طلبك، لين توقفه"
            >
              {talk ? <Icon name="stop" /> : <span aria-hidden>🎧</span>}
            </button>
          </>
        )}
        {diag && (
          <button type="button" className={`jw-btn jw-btn-icon shrink-0 ${diagOn ? "!border-jw-accent bg-jw-accent/15 text-jw-accent" : "jw-btn-quiet"}`} onClick={() => setDiagOn((v) => !v)} aria-pressed={diagOn} aria-label="تشخيص" title="🩺 تشخيص (لك بس): حيدرة يفحص السجل والملفات والجهاز ويقول وش المشكلة، ويكتب رسالة للمطوّر">
            🩺
          </button>
        )}
        {busy && canStop ? (
          <button type="button" className="jw-btn jw-btn-icon shrink-0 !border-jw-danger bg-jw-danger/15 text-jw-danger" onClick={stop} aria-label="وقّف الطلب" title="⏹️ وقّف الطلب: ما ينفّذ شي من رده">
            <Icon name="stop" />
          </button>
        ) : (
          <button type="submit" className="jw-btn jw-btn-primary jw-btn-icon shrink-0" disabled={(!text.trim() && !pending.length) || !!busy || readOnly} aria-label="أرسل">
            <Icon name="chevronLeft" />
          </button>
        )}
      </form>
    </div>
  );
}

const noSubscribe = () => () => {};

/** A reply as written: **bold**, and ```blocks``` (the designer's prompts) shown as copyable English blocks. */
function MsgText({ text }: { text: string }) {
  const parts = text.split(/```\n?([\s\S]*?)\n?```/g);
  return (
    <div className="space-y-1.5">
      {parts.map((part, i) =>
        i % 2 ? (
          <CodeBlock key={i} code={part} />
        ) : part.trim() ? (
          <p key={i} className="whitespace-pre-wrap">
            {part.replace(/^\n+|\n+$/g, "").split(/\*\*(.+?)\*\*/g).map((x, j) => (j % 2 ? <b key={j}>{x}</b> : x))}
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
