"use client";

// «🎬 مختبر الموشن» — حيدرة makes a motion piece in CODE, the way the viral Claude Opus 5.5 films were made: the person
// gives the idea (and, if they like, references, their own pictures and brand colours), PICKS from the gallery what the
// research found (the look, the structure, how shots connect, the feel, the pace, the camera, the type, the finish, the
// ending — every card a live sample drawn in code) → حيدرة writes the plan (idea, hook, look, shot list), bound to those
// picks → approved → he writes the scene program → the browser runs it in a sandbox and catches any bug (sent back to
// him to fix) → contact sheets and stills go to him, he scores them like a harsh director and rewrites what is below the
// bar (up to three rounds) → the final film is rendered here at 30 fps with motion blur and lands on the timeline with
// its sound cues (and, if asked, music from ElevenLabs). The window is a solid studio: five steps, one at a time.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { api, postJson } from "@/lib/fetch";
import { useClaudeModel } from "@/components/robots/claude-model";
import ClaudeModelPicker from "@/components/robots/ClaudeModelPicker";
import { readCues, type Cue, type LabPlan, type Review } from "@/lib/editor/scene/contract";
import { MAX_ROUNDS, PASS, RUBRIC } from "@/lib/editor/scene/skill";
import { FONT_BY_ID } from "@/lib/editor/fonts";
import { LAB_GROUPS, chosenOptions, type ChoiceKey, type LabChoices, type LabGroup } from "@config/editor/lab-options";
import { SceneError, SceneHost, sceneFont, type SceneInfo } from "./scene-host";
import { contactSheet, frameCost, probe, renderVideo, reviewTimes, stills } from "./scene-render";
import { download } from "./export";
import LabVoice, { type LabVoiceTake } from "./LabVoice";
import { mixSoundtrack, SoundPreview } from "./lab-sound";
import { makeMusicAsset } from "./make";
import { drawDemo, STUDIO, type Swatch } from "./lab-demos";
import type { EditorAsset } from "./types";
import "./motion-lab.css";

type Stage = "brief" | "planning" | "plan" | "building" | "reviewing" | "ready" | "rendering";
/** the five steps of the window (what the person is looking at; the stage is what حيدرة is doing) */
type View = "brief" | "style" | "plan" | "build" | "export";
const VIEWS: { id: View; ar: string }[] = [
  { id: "brief", ar: "الفكرة" },
  { id: "style", ar: "الأسلوب" },
  { id: "plan", ar: "الخطة" },
  { id: "build", ar: "البناء" },
  { id: "export", ar: "التصدير" },
];
const REVIEW_MODES = {
  fast: { label: "سريع", rounds: 0, description: "فحص التشغيل فقط، بدون مراجعة جودة. الأسرع." },
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
}
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
const SECONDS = [6, 10, 15, 20, 30, 45, 60];
const INTENSITY: [number, string][] = [[1, "هادئ وفخم"], [3, "متوازن"], [4, "قوي"], [5, "ناري"]];
const FIXES = 2;
/** What a render should fit inside before the lab trims the motion blur to make it (about four minutes). */
const RENDER_BUDGET_MS = 4 * 60_000;
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
}: {
  projectId: string;
  width: number;
  height: number;
  assets: EditorAsset[];
  initialBrief?: string;
  initialSeconds?: number;
  /** the finished film, its cues and whether music is wanted (the editor uploads it and places everything) */
  onFilm: (film: File, cues: Cue[], music: { prompt: string; ms: number } | null) => void;
  onClose: () => void;
  /** folded to the pill — kept by the editor, so its «مختبر الموشن» button can bring the window back */
  minimized: boolean;
  onMinimize: (v: boolean) => void;
}) {
  const [claude] = useClaudeModel();
  const [stage, setStage] = useState<Stage>("brief");
  const [view, setView] = useState<View>("brief");
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
  const [reviewMode, setReviewMode] = useState<ReviewMode>("balanced");
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

  // pictures from the library the scene may use, with short ids حيدرة writes in his code (a1, a2…)
  const images = useMemo(() => assets.filter((a) => a.kind === "image" && a.url && a.status === "ready").slice(0, 24), [assets]);
  const chosen = useMemo(() => picks.map((id, i) => ({ short: `a${i + 1}`, asset: images.find((a) => a.id === id)! })).filter((x) => x.asset), [picks, images]);
  const assetList = chosen.map((c) => ({ id: c.short, name: c.asset.name, w: c.asset.width ?? 0, h: c.asset.height ?? 0 }));
  const chosenCards = useMemo(() => chosenOptions(choices), [choices]);

  // the lab remembers its work on this device (a refresh keeps the plan, the program and the reviews)
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(key(projectId)) ?? "null") as Saved | null;
      if (!s) return;
      const tm = setTimeout(() => {
        if (!initialBrief) setBrief(s.brief);
        if (!initialBrief) setSeconds(s.seconds || 15);
        setIntensity(s.intensity || 4);
        setBrand(s.brand || "");
        setPicks(s.picks || []);
        setChoices(s.choices || {});
        setPlan(s.plan);
        setSay(s.say || "");
        setCode(s.code || "");
        setReviews(s.reviews || []);
        setReviewMode(s.reviewMode === "fast" || s.reviewMode === "precise" ? s.reviewMode : "balanced");
        // «خلفية شفافة» is never remembered: it sends the film out as a separate WebM that does NOT enter the timeline, so a
        // choice left on from before made every later scene come out that way (it is switched on again each time, on purpose)
        setTransparent(false);
        setTransparentCode(Boolean(s.transparentCode));
        setVoiceOn(Boolean(s.voiceOn));
        setMusicMode(s.musicMode === "eleven" || s.musicMode === "none" ? s.musicMode : "code");
        if (s.plan && !initialBrief) {
          setStage(s.code ? "ready" : "plan");
          setView(s.code ? "export" : "plan");
        }
      }, 0);
      return () => clearTimeout(tm);
    } catch {
      /* a fresh start */
    }
  }, [projectId, initialBrief]);
  useEffect(() => {
    try {
      localStorage.setItem(key(projectId), JSON.stringify({ brief, seconds, intensity, brand, picks, choices, plan, say, code, reviews, reviewMode, transparent, transparentCode, voiceOn, musicMode } satisfies Saved));
    } catch {
      /* not kept */
    }
  }, [projectId, brief, seconds, intensity, brand, picks, choices, plan, say, code, reviews, reviewMode, transparent, transparentCode, voiceOn, musicMode]);
  useEffect(() => () => (host.current?.destroy(), abort.current?.abort(), preview.current?.close()), []);

  /** what the server is told about the sound: the voice (its measured lines) and the music */
  const soundBody = () => ({ voice: voiceOn ? "own" : "", musicMode, voice_lines: take ? { seconds: take.seconds, lines: take.lines } : null });
  /** the plan as it is built: never shorter than the voice that narrates it */
  const sized = (p: LabPlan): LabPlan => (take ? { ...p, seconds: Math.max(p.seconds, Math.ceil((take.seconds + 1) * 2) / 2) } : p);

  /** The piece's sound, mixed: the scene's own soundtrack (code), the library's cues, the voice, and the music. */
  const makeSound = async (o: { got: SceneInfo; music?: string | null }) => {
    const h = host.current;
    if (!h) return null;
    setSoundBusy(true);
    try {
      const synth = o.got.sound ? await h.sound().catch((e: unknown) => (say1(`⚠️ صوت المشهد: ${e instanceof Error ? e.message : e}`), null)) : null;
      const links = await libraryLinks();
      const cues = readCues(o.got.cues, o.got.duration).flatMap((c) => (links.get(c.sfx) ? [{ url: links.get(c.sfx)!, t: c.t, vol: c.vol }] : []));
      if (!synth && !cues.length && !take && !o.music) return null;
      const mix = await mixSoundtrack({ duration: o.got.duration, synth, cues, voice: take?.blob ?? null, music: o.music ?? null });
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

  const call = useCallback(async <T,>(action: string, body: Record<string, unknown>) => {
    // no clock of the lab's own (the owner's rule): the only thing that stops a step is «إلغاء»
    const outer = abort.current?.signal;
    const result = await postJson<T & { error?: string }>(`/api/jawad/editor/projects/${projectId}`, { action, model: claude.id, ...body, stream: true }, outer).catch((e: unknown) => {
      if (outer?.aborted) throw new DOMException("cancelled", "AbortError");
      throw e;
    });
    if (result.error) throw new Error(result.error);
    return result;
  }, [projectId, claude.id]);

  /** The scene page with this program, its fonts and its pictures; the probe catches a bug before anything else. */
  const loadCode = async (program: string, p: LabPlan) => {
    host.current?.destroy();
    const h = new SceneHost();
    host.current = h;
    const fonts = [sceneFont("head", p.fonts.head), sceneFont("body", p.fonts.body)].filter((f): f is NonNullable<typeof f> => Boolean(f));
    const bitmaps: { id: string; bitmap: ImageBitmap }[] = [];
    for (const c of chosen) {
      try {
        const blob = await (await fetch(c.asset.url!)).blob();
        bitmaps.push({ id: c.short, bitmap: await createImageBitmap(blob) });
      } catch {
        say1(`ما قدرت أحمّل «${c.asset.name}» للمشهد.`);
      }
    }
    const got = await h.load(program, { w: width, h: height, fps: 30, assets: bitmaps, fonts, voice: take?.lines ?? [] });
    if (!(got.duration > 0)) throw new SceneError("المشهد ما حدد مدته (duration).", "load");
    const bad = await probe(h, got.duration);
    if (bad) throw bad;
    return got;
  };

  /** Writes (or fixes) until the program runs cleanly in the page; returns it with what the scene says. */
  const buildRunning = async (p: LabPlan, previous = "", errors = "") => {
    let program = previous, why = errors;
    for (let attempt = 0; attempt <= FIXES; attempt++) {
      if (!program || why) {
        say1(attempt === 0 && !previous ? "✍️ حيدرة يكتب المشهد بالكود…" : `🛠️ حيدرة يصلّح خطأ في المشهد (${attempt}/${FIXES})…`);
        const r = await call<{ code: string; problems: string[]; notes: string }>("lab_write", { plan: p, seconds: p.seconds, assets: assetList, transparent, ...soundBody(), ...(program ? { code: program, errors: why } : {}) });
        if (r.notes) say1(r.notes);
        program = r.code;
        if (r.problems.length) {
          why = `The program breaks the machine's rules: ${r.problems.join("; ")}`;
          continue;
        }
      }
      try {
        say1("▶️ أشغّل المشهد وأفحص كل لحظة فيه…");
        const got = await loadCode(program, p);
        return { program, got };
      } catch (e) {
        const se = e instanceof SceneError ? e : new SceneError(String(e), "load");
        why = `${se.where === "frame" ? `At t = ${se.t?.toFixed(2)} s the frame threw` : "Loading the scene threw"}: ${se.message}\n${se.stack2}`;
        say1(`⚠️ ${se.message}`);
      }
    }
    throw new Error("المشهد فيه خطأ ما قدر حيدرة يصلحه بعد محاولتين. عدّل الخطة أو جرّب مرة ثانية.");
  };

  const makePlan = async () => {
    setError(null);
    abort.current?.abort();
    abort.current = new AbortController();
    setStage("planning");
    setView("plan");
    setNow(0);
    try {
      const r = await call<{ plan: LabPlan; say: string }>("lab_plan", {
        brief: tweak && plan ? `${brief}\n\nتعديل على الخطة السابقة («${plan.title}»): ${tweak}` : brief,
        seconds,
        intensity,
        brand,
        assets: assetList,
        references: refs,
        choices,
        language: "Arabic (Gulf)",
        ...soundBody(),
      });
      setPlan(r.plan);
      setSay(r.say);
      // a new plan has new lines to read: the old take no longer fits it
      if (take && JSON.stringify(r.plan.narration) !== JSON.stringify(plan?.narration)) setTake(null);
      setTweak("");
      setCode("");
      setReviews([]);
      setStage("plan");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setError(e instanceof Error ? e.message : String(e));
      setStage(plan ? "plan" : "brief");
      if (!plan) setView("brief");
    }
  };

  /** Builds, then the director's rounds: render sheets and stills, he scores and rewrites, until it passes. */
  const build = async () => {
    if (!plan) return;
    if (voiceOn && !take) {
      setError("سجّل صوتك أول (تحت الخطة)، وبعدها حيدرة يبني الحركة على كلامك.");
      setView("plan");
      return;
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
    setView("build");
    setNow(0);
    try {
      let { program, got } = await buildRunning(built, code);
      stop();
      setCode(program);
      setInfo(got);
      setTransparentCode(transparent);
      const rounds = REVIEW_MODES[reviewMode].rounds;
      if (rounds > 0) setStage("reviewing");
      else say1("✅ اجتاز المشهد فحص التشغيل. اخترت السريع؛ لم تُجرَ مراجعة جودة بصرية.");
      const done: Review[] = [];
      for (let round = 1; round <= rounds; round++) {
        const h = host.current!;
        // how heavy this scene is here decides how many frames the review is allowed to draw
        const cost = await frameCost(h, got.duration, 1, abort.current?.signal);
        const perSheet = cost > 400 ? 9 : cost > 150 ? 15 : 24;
        const shotTimes = cost > 400 ? reviewTimes(got.duration).filter((_, i) => i % 2 === 0) : reviewTimes(got.duration);
        say1(`🎬 الجولة ${round} من ${rounds}: أصوّر ${perSheet * 2} لقطة لورقتي التلامس و${shotTimes.length} لقطات كاملة${cost > 150 ? " (خفّفتها لأن المشهد ثقيل على جهازك)" : ""}…`);
        const half = got.duration / 2;
        const sheets = [await contactSheet(h, 0, half, perSheet, 3), await contactSheet(h, half, got.duration, perSheet, 3)];
        const times = shotTimes;
        const shots = await stills(h, times, got.duration);
        say1("🧐 حيدرة يراجع كمخرج قاسي…");
        const r = await call<{ review: Review; code: string; problems: string[] }>("lab_review", { plan: built, seconds: built.seconds, assets: assetList, code: program, sheets, stills: shots, times, round, maxRounds: rounds, reviewOnly: true, ...soundBody() });
        stop();
        done.push(r.review);
        setReviews([...done]);
        say1(`${r.review.pass ? "✅" : "📝"} ${r.review.verdict}`);
        if (r.review.pass) break;
        say1("✍️ أطبّق ملاحظات المخرج على المشهد…");
        const next = await buildRunning(built, program, `Apply this visual review, preserving the approved plan and everything that already works: ${JSON.stringify(r.review)}`);
        stop();
        program = next.program;
        got = next.got;
        setCode(program);
        setInfo(got);
      }
      setStage("ready");
      setView("export");
      void seekTo(Math.min(got.duration * 0.3, 2));
      void refreshSound(got);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") say1("⏹️ أوقفت الشغل.");
      else setError(e instanceof Error ? e.message : String(e));
      setStage(code ? "ready" : "plan");
      if (!code) setView("plan");
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
  const seekTo = async (v: number) => {
    setT(v);
    if (!host.current || !info) return;
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
      void seekTo(Math.min(g.duration * 0.3, 2));
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
      void seekTo(Math.min(got.duration * 0.3, 2));
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
    const signal = abort.current.signal;
    try {
      const frames = Math.max(1, Math.round(info.duration * 30));
      // what one frame really costs on THIS device with THIS scene, measured before committing to hundreds of them
      let sub = info.blur > 0 ? 6 : 1;
      const ms = await frameCost(host.current, info.duration, sub, signal);
      let plannedMs = ms * frames;
      if (info.blur > 0) {
        // a heavy scene with motion blur: fewer sub-frames rather than a render nobody can wait for
        while (plannedMs > RENDER_BUDGET_MS && sub > 1) {
          sub = sub === 6 ? 3 : sub === 3 ? 2 : 1;
          plannedMs = (ms / (info.blur > 0 ? 6 : 1)) * sub * frames;
        }
        if (sub < 6) say1(`⚙️ المشهد ثقيل على جهازك: خفّضت ضبابية الحركة من ٦ لقطات فرعية إلى ${sub} عشان يخلص في وقت معقول.`);
      }
      const makingTransparent = transparent && transparentCode;
      // the film's sound, mixed for it (ElevenLabs' music made now when chosen) and muxed INTO the file
      let audio = soundtrack;
      if (musicMode === "eleven" && plan.music && !makingTransparent) {
        say1("🎵 أصنع الموسيقى على الإيقاع…");
        try {
          const a = await makeMusicAsset(projectId, `${plan.music}. ${plan.bpm} BPM, instrumental, builds to a clear peak and resolves on the last beat.`, Math.max(10_000, Math.round(info.duration * 1000)));
          audio = (await makeSound({ got: info, music: a.url ?? null })) ?? audio;
        } catch (e) {
          say1(`⚠️ الموسيقى: ${e instanceof Error ? e.message : e} — أكمل بدونها.`);
        }
      } else if (!audio) audio = await makeSound({ got: info }).catch(() => null);
      say1(makingTransparent ? `🎞️ أرندر ${frames} إطارًا بخلفية شفافة (WebM) · ${mmss(plannedMs)} تقريبًا على جهازك.` : `🎞️ أرندر ${frames} إطارًا · ${mmss(plannedMs)} تقريبًا على جهازك.`);
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
        say1("✅ نزل ملف WebM بخلفية شفافة على جهازك. ركّبه على أي خلفية في برنامج المونتاج اللي تبيه.");
        return;
      }
      const file = new File([blob], `${stem}.mp4`, { type: "video/mp4" });
      if (alsoDownload) download(blob, `${stem}.mp4`);
      // the sound is already inside the film: nothing placed twice (a silent scene keeps the old way: its cues on tracks)
      onFilm(file, audio ? [] : readCues(info.cues, info.duration), null);
      setStage("ready");
      setRenderAt(null);
      say1(audio ? "✅ نزل المقطع في التايملاين وصوته داخله (المؤثرات" + (take ? " وصوتك" : "") + (musicMode !== "none" ? " والموسيقى" : "") + ")." : "✅ نزل المقطع في التايملاين.");
    } catch (e) {
      setRenderAt(null);
      if (!(e instanceof DOMException && e.name === "AbortError")) setError(e instanceof Error ? e.message : String(e));
      else say1("⏹️ أوقفت الرندر.");
      setStage("ready");
    }
  };

  const busy = stage === "planning" || stage === "building" || stage === "reviewing" || stage === "rendering";
  useEffect(() => {
    if (!busy) return;
    // the clock of the step running now (it restarts with each stage)
    const from = Date.now();
    const tick = setInterval(() => setNow(Date.now() - from), 1000);
    return () => clearInterval(tick);
  }, [busy, stage]);
  const elapsed = busy ? mmss(now) : "";
  const last = reviews[reviews.length - 1];
  const stageAr = stage === "planning" ? "يخطّط" : stage === "building" ? "يكتب الكود" : stage === "reviewing" ? "يراجع" : stage === "rendering" ? "يرندر" : "";

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

  /** which steps the person may open now (a plan needs an idea; the build and the export need a plan / a scene) */
  const canOpen = (v: View) => (v === "brief" || v === "style" ? true : v === "plan" ? Boolean(plan) || stage === "planning" : v === "build" ? Boolean(plan) : Boolean(code));
  const doneStep = (v: View) => (v === "brief" ? brief.trim().length >= 3 : v === "style" ? chosenCards.length > 0 : v === "plan" ? Boolean(plan) : v === "build" ? Boolean(code) : false);

  if (!portalReady) return null;

  if (minimized)
    return createPortal(
      <button type="button" className="jw-btn jw-btn-primary jw-3d mlab-fill !min-h-12 gap-2 !rounded-full !px-4 shadow-2xl" onClick={() => setMinimized(false)} aria-label="رجّع مختبر الموشن">
        {busy ? <span className="jw-spinner" /> : <span aria-hidden>✅</span>}
        🎬 {busy ? `${stageAr}${stage === "rendering" ? ` ${Math.round(progress * 100)}٪${renderAt ? ` · يبقى ${mmss(renderAt.leftMs)}` : ""}` : ` ${elapsed}`}` : "جاهز — افتح المختبر"}
      </button>,
      document.body,
    );

  const pillClass = (on: boolean) => `mlab-pill${on ? "" : ""}`;

  return createPortal(
    <div className="mlab-overlay" role="dialog" aria-modal="true" aria-label="مختبر الموشن" dir="rtl">
      <div className="mlab">
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
            <p className="mlab-tip hidden sm:block">{busy ? "الشغل ماشي. صغّر النافذة وارجع للمونتاج — يكمل في الخلفية، وترجّعه من زر «مختبر الموشن»." : "حيدرة يكتب كل فريم بالكود على مهارات Higgsfield واختياراتك، يشوف النتيجة ويقيّمها كمخرج، ويصلّح لين توصل مستوى الاستوديوهات."}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <ClaudeModelPicker disabled={busy} />
            {busy && (
              <button type="button" className="jw-btn !min-h-10" onClick={cancel} title="يوقف العملية الحالية (الكود المسوّى قبلها يبقى محفوظ)">
                إلغاء
              </button>
            )}
            <button type="button" className="jw-btn jw-btn-primary !min-h-10 whitespace-nowrap" onClick={close} title={busy ? "ارجع للمونتاج ويكمل المختبر شغله في الخلفية" : "اخرج من المختبر وارجع للمونتاج"}>
              ← {busy ? "ارجع والمختبر يكمل" : "رجوع للمونتاج"}
            </button>
          </div>
        </header>

        <nav className="mlab-steps" aria-label="خطوات المختبر">
          {VIEWS.map((v, i) => (
            <button key={v.id} type="button" className={`mlab-step${doneStep(v.id) && view !== v.id ? " done" : ""}`} aria-current={view === v.id ? "step" : undefined} disabled={!canOpen(v.id)} onClick={() => setView(v.id)}>
              <span className="n">{i + 1}</span>
              {v.ar}
              {doneStep(v.id) && view !== v.id && <span aria-hidden>✓</span>}
            </button>
          ))}
        </nav>

        <div className="mlab-body">
          <section className="mlab-main">
            {view === "brief" && (
              <>
                <div className="mlab-card">
                  <label className="mlab-label" htmlFor="mlab-brief">
                    وش الموشن اللي تبيه؟
                  </label>
                  <textarea id="mlab-brief" className="jw-textarea w-full" rows={4} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="مثال: إعلان ١٥ ثانية لتطبيق «نهج علي»: الكلمة تتكوّن من غبار ذهبي، أرقام النمو تطلع على الإيقاع، وفي الآخر الشعار ينبني من جزيئات…" disabled={busy} />
                </div>
                <div className="mlab-card flex flex-col gap-4">
                  <div>
                    <span className="mlab-label">المدة</span>
                    <div className="mlab-pills">
                      {SECONDS.map((s) => (
                        <button key={s} type="button" disabled={busy} className={pillClass(seconds === s)} aria-pressed={seconds === s} onClick={() => setSeconds(s)}>
                          {s} ث
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
                    <span className="mlab-label">ألوان وخطوط العلامة (اختياري)</span>
                    <input className="jw-input w-full" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="#0b3d2e و #d4af37، خط عريض" disabled={busy} />
                  </label>
                  <label className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1.5 h-4 w-4" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} disabled={busy} />
                    <span>
                      <b>🪄 خلفية شفافة</b>
                      <span className="mlab-tip block">يكتب حيدرة العناصر بدون خلفية من الأول، عشان تركّبها على خلفية ثانية. تقدر تفعّلها الحين أو بعد ما يخلص المشهد.</span>
                    </span>
                  </label>
                </div>
                <div className="mlab-card flex flex-col gap-3">
                  <span className="mlab-label">🔊 الصوت (الفيديو يطلع بصوته)</span>
                  <p className="mlab-tip m-0">حيدرة يصمم المؤثرات الصوتية بالكود على حركة المشهد نفسها: ووش على الحركة، ضربة على النزول، تصاعد قبل الكشف.</p>
                  <label className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1.5 h-4 w-4" checked={voiceOn} onChange={(e) => setVoiceOn(e.target.checked)} disabled={busy} />
                    <span>
                      <b>🎙️ بصوتي</b>
                      <span className="mlab-tip block">حيدرة يكتب لك نص قصير، تقرأه وتسجّله، Claude Code ينظّفه، والحركة تنبني على كلامك. صوتك أنت، مب صوت مولّد.</span>
                    </span>
                  </label>
                  <div className="mlab-pills">
                    {MUSIC_MODES.map((m) => (
                      <button key={m.id} type="button" disabled={busy} className="mlab-pill" aria-pressed={musicMode === m.id} title={m.tip} onClick={() => setMusicMode(m.id)}>
                        {m.ar}
                      </button>
                    ))}
                  </div>
                  <p className="mlab-tip m-0">{MUSIC_MODES.find((m) => m.id === musicMode)?.tip}</p>
                </div>
                {!!images.length && (
                  <div className="mlab-card">
                    <span className="mlab-label">صور من مكتبتك يستخدمها في المشهد (شعار، منتج، شخصية…)</span>
                    <div className="flex flex-wrap gap-2">
                      {images.map((a) => {
                        const on = picks.includes(a.id);
                        return (
                          <button key={a.id} type="button" className="mlab-thumb" aria-pressed={on} disabled={busy} onClick={() => setPicks(on ? picks.filter((x) => x !== a.id) : [...picks, a.id].slice(0, 8))} title={a.name}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={a.url!} alt={a.name} />
                            {on && <span className="tag">a{picks.indexOf(a.id) + 1}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="mlab-card">
                  <label className="block">
                    <span className="mlab-label">مراجع: لقطات من ريلز عاجبتك</span>
                    <span className="mlab-tip block mb-2">ياخذ منها الألوان والإيقاع والخطوط، مو المحتوى. حتى ٤ صور.</span>
                    <input type="file" accept="image/*" multiple disabled={busy} onChange={async (e) => setRefs(await Promise.all([...(e.target.files ?? [])].slice(0, 4).map(refOf)))} />
                    {!!refs.length && <span className="block mt-1 font-bold" style={{ color: "var(--jw-ok)" }}>{refs.length} مرجع جاهز</span>}
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="jw-btn jw-btn-primary !min-h-12 !text-base" disabled={busy || brief.trim().length < 3} onClick={() => setView("style")}>
                    التالي: اختر الأسلوب ←
                  </button>
                  <button type="button" className="jw-btn !min-h-12" disabled={busy || brief.trim().length < 3} onClick={makePlan}>
                    🧠 اكتب الخطة مباشرة (حيدرة يختار كل شيء)
                  </button>
                </div>
              </>
            )}

            {view === "style" && (
              <>
                <div className="mlab-card">
                  <h3>اختر من العينات، أو خلّ أي مجموعة لحيدرة</h3>
                  <p className="mlab-tip">
                    كل كرت عينة حيّة مرسومة بالكود من بحث ~١١٠ مصدر (أكثر الأفلام المصنوعة بكلود مشاهدةً، ~٩٠ مهارة مفتوحة، ومهارتا Higgsfield حقّك). اختيارك يدخل خطة حيدرة كقيد ملزم، ويفتح له ملفات المهارة المناسبة.
                  </p>
                  {!!chosenCards.length && (
                    <div className="mlab-chips mt-2">
                      {chosenCards.map(({ group, option }) => (
                        <span key={`${group.id}-${option.id}`} className="mlab-chip">
                          {group.ar}: {option.ar}
                        </span>
                      ))}
                      <button type="button" className="mlab-chip" style={{ background: "rgba(255,255,255,0.1)", color: "var(--jw-ink)" }} disabled={busy} onClick={() => setChoices({})}>
                        ✕ صفّر الكل
                      </button>
                    </div>
                  )}
                </div>
                <Gallery choices={choices} onChange={setChoices} disabled={busy} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="jw-btn jw-btn-primary !min-h-12 !text-base" disabled={busy || brief.trim().length < 3} onClick={makePlan}>
                    {stage === "planning" ? <span className="jw-spinner !border-white/40 !border-t-white" aria-hidden /> : "🧠"} اكتب الخطة
                  </button>
                  <button type="button" className="jw-btn !min-h-12" disabled={busy} onClick={() => setView("brief")}>
                    → رجوع للفكرة
                  </button>
                </div>
              </>
            )}

            {view === "plan" && (
              <>
                {stage === "planning" && !plan && (
                  <div className="mlab-card flex items-center gap-3">
                    <span className="jw-spinner" aria-hidden /> حيدرة يكتب الخطة على اختياراتك… {elapsed}
                  </div>
                )}
                {plan && (
                  <div className="mlab-card flex flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="!text-xl">{plan.title}</h3>
                        <p className="m-0">{plan.idea}</p>
                      </div>
                      <div className="flex gap-1.5" aria-label="الألوان">
                        {Object.values(plan.palette).map((c, i) => (
                          <span key={i} className="h-7 w-7 rounded-full border border-white/20" style={{ background: c }} title={c} />
                        ))}
                      </div>
                    </div>
                    {say && <p className="m-0 font-bold" style={{ color: "var(--jw-accent)" }}>🤖 {say}</p>}
                    <p className="mlab-tip m-0">
                      🎣 الهوك: {plan.hook} · ✨ اللحظة المبهرة: {plan.wow} · 🔤 {FONT_BY_ID.get(plan.fonts.head)?.ar ?? plan.fonts.head} / {FONT_BY_ID.get(plan.fonts.body)?.ar ?? plan.fonts.body} · {plan.seconds} ث · {plan.bpm} BPM
                    </p>
                    {!!chosenOptions(plan.choices).length && (
                      <div className="mlab-chips">
                        {chosenOptions(plan.choices).map(({ group, option }) => (
                          <span key={`${group.id}-${option.id}`} className="mlab-chip">
                            {group.ar}: {option.ar}
                          </span>
                        ))}
                      </div>
                    )}
                    <ol className="mlab-shots">
                      {plan.shots.map((s, i) => (
                        <li key={i}>
                          <b className="tabular-nums" dir="ltr">
                            {s.from.toFixed(1)}–{s.to.toFixed(1)}s
                          </b>{" "}
                          {s.what} {s.text && <span className="font-bold">«{s.text}»</span>} <span className="mlab-tip">· {s.motion} · {s.camera}{s.transition ? ` · ${s.transition}` : ""}</span>
                        </li>
                      ))}
                    </ol>
                    {voiceOn && (stage === "plan" || stage === "ready") && (
                      <LabVoice script={plan.narration.map((n) => n.text)} model={claude.id} value={take} onChange={(v) => (setTake(v), setSoundtrack(null))} disabled={busy} />
                    )}
                    {voiceOn && !plan.narration.length && <p className="mlab-tip m-0">ما فيه نص في هالخطة؛ اضغط «عدّل» واكتب «اكتب لي نص أقرأه»، أو سجّل كلامك بحرّية وحيدرة يبني على مقاطعه.</p>}
                    {(stage === "plan" || stage === "ready") && (
                      <div className="flex flex-col gap-3">
                        <div className="flex gap-2">
                          <input className="jw-input flex-1" value={tweak} onChange={(e) => setTweak(e.target.value)} placeholder="عدّل الخطة: خلّ الهوك أقوى، غيّر الألوان، أضف رقم…" disabled={busy} />
                          <button type="button" className="jw-btn" disabled={busy || !tweak.trim()} onClick={makePlan}>
                            عدّل
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="jw-btn jw-btn-primary !min-h-12 !text-base" disabled={busy || (voiceOn && !take)} onClick={build} title={voiceOn && !take ? "سجّل صوتك أول" : undefined}>
                            🎬 {voiceOn && !take ? "سجّل صوتك أول ↑" : code ? "ابنِ من جديد وراجع" : "اعتمد الخطة وابنِ"}
                          </button>
                          <button type="button" className="jw-btn !min-h-12" disabled={busy} onClick={() => setView("style")}>
                            غيّر الأسلوب
                          </button>
                          <button type="button" className="jw-btn !min-h-12" disabled={busy} onClick={() => setView("brief")}>
                            فكرة جديدة
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {view === "build" && (
              <>
                <fieldset disabled={busy} className="mlab-card">
                  <legend className="mlab-label px-1">مستوى الفحص</legend>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(Object.keys(REVIEW_MODES) as ReviewMode[]).map((mode) => (
                      <label key={mode} className="mlab-opt !p-3" aria-pressed={reviewMode === mode} style={{ cursor: busy ? "not-allowed" : "pointer" }}>
                        <span className="flex items-center gap-2 name">
                          <input type="radio" name="motion-review-mode" value={mode} checked={reviewMode === mode} onChange={() => setReviewMode(mode)} />
                          {REVIEW_MODES[mode].label}
                        </span>
                        <span className="tip">{REVIEW_MODES[mode].description}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {plan && !busy && (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="jw-btn jw-btn-primary !min-h-12 !text-base" onClick={build}>
                      🎬 {code ? "ابنِ من جديد وراجع" : "ابنِ المشهد"}
                    </button>
                    {code && (
                      <button type="button" className="jw-btn !min-h-12" onClick={() => setView("export")}>
                        التصدير ←
                      </button>
                    )}
                  </div>
                )}
                {!!log.length && (
                  <ul className="mlab-log" aria-live="polite">
                    {log.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {view === "export" && (
              <>
                {!info && code && (
                  <button type="button" className="jw-btn jw-btn-primary !min-h-12 w-full" onClick={reopen}>
                    ▶️ شغّل المشهد المحفوظ
                  </button>
                )}
                {info && (
                  <div className="mlab-card flex flex-col gap-3">
                    <h3>التصدير</h3>
                    <p className="m-0 font-bold" role="status">
                      {soundBusy ? "🔊 أجهّز الصوت…" : soundtrack ? `🔊 الصوت جاهز ويطلع مع الفيديو: مؤثرات بالكود${take ? " + صوتك" : ""}${musicMode === "code" ? " + موسيقى بالكود" : musicMode === "eleven" ? " (وموسيقى ElevenLabs تنصنع وقت التصدير)" : ""}. شغّل المعاينة واسمعه.` : "🔇 المشهد ما كتب له صوت. ابنه من جديد ويكتب صوته."}
                    </p>
                    <div className="mlab-pills">
                      {MUSIC_MODES.map((m) => (
                        <button key={m.id} type="button" disabled={stage === "rendering"} className="mlab-pill" aria-pressed={musicMode === m.id} title={m.tip} onClick={() => setMusicMode(m.id)}>
                          {m.ar}
                        </button>
                      ))}
                    </div>
                    {musicMode === "code" && !/drone|beat/.test(code) && <p className="mlab-tip m-0">الموسيقى بالكود تنكتب وقت البناء: ابنِ من جديد عشان يضيفها.</p>}
                    <label className="flex items-start gap-3">
                      <input type="checkbox" className="mt-1.5 h-4 w-4" checked={alsoDownload} onChange={(e) => setAlsoDownload(e.target.checked)} disabled={stage === "rendering"} />
                      <span><b>⬇️ ونزّل نسخة على جهازي</b> <span className="mlab-tip block">MP4 بصوته، جاهز تنشره مباشرة.</span></span>
                    </label>
                    <label className="flex items-start gap-3">
                      <input type="checkbox" className="mt-1.5 h-4 w-4" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} disabled={stage === "rendering"} />
                      <span>
                        <b>🪄 خلفية شفافة</b> <span className="mlab-tip block">يصدّر ملف WebM منفصل بدون خلفية تنزّله وتركّبه بنفسك — ما يدخل التايملاين تلقائيًا.</span>
                      </span>
                    </label>
                    {transparent && !transparentCode && (
                      <button type="button" className="jw-btn w-full !min-h-11" disabled={stage === "rendering"} onClick={stripBackground}>
                        🪄 فرّغ خلفية هذا المشهد الآن
                      </button>
                    )}
                    {transparent && transparentCode && <p className="m-0 font-bold" style={{ color: "var(--jw-ok)" }}>✓ المشهد مكتوب بدون خلفية؛ جاهز يصدّر شفافًا.</p>}
                    <button type="button" className="jw-btn jw-btn-primary !min-h-12 !text-base w-full" disabled={stage === "rendering" || (transparent && !transparentCode)} onClick={exportFilm}>
                      {stage === "rendering"
                        ? `أرندر ${Math.round(progress * 100)}٪${renderAt ? ` · إطار ${renderAt.frame} من ${renderAt.frames} · يبقى ${mmss(renderAt.leftMs)}` : ""}`
                        : transparent
                          ? "⬇️ صدّر الملف الشفاف ونزّله"
                          : "⬇️ صدّره ونزّله في التايملاين"}
                    </button>
                    <p className="mlab-tip m-0">{transparent ? "يتصدّر WebM بقناة شفافية (ألفا) على جهازك وينزل مباشرة، وصوته داخله." : "يتصدّر على جهازك بـ ٣٠ فريم مع ضبابية حركة، ويدخل التايملاين عند مؤشر الوقت وصوته داخله."}</p>
                  </div>
                )}
                {code && !busy && (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="jw-btn !min-h-11" onClick={() => setView("build")}>
                      → ابنِ من جديد / غيّر مستوى الفحص
                    </button>
                    <button type="button" className="jw-btn !min-h-11" onClick={() => setView("plan")}>
                      → عدّل الخطة
                    </button>
                  </div>
                )}
                {!!log.length && (
                  <ul className="mlab-log" aria-live="polite">
                    {log.slice(-6).map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {error && (
              <p role="alert" className="mlab-error m-0">
                {error}
              </p>
            )}
          </section>

          <aside className="mlab-side">
            <div className="mlab-preview aspect-[9/16] max-h-[56vh] w-full lg:aspect-auto lg:h-[56vh]" style={width > height ? { aspectRatio: `${width} / ${height}`, height: "auto" } : undefined}>
              {info ? <canvas ref={viewCanvas} /> : <span className="mlab-tip px-6 text-center">{busy ? `حيدرة ${stageAr}… ${elapsed}` : "المعاينة تطلع هنا بعد ما يبني حيدرة المشهد."}</span>}
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
            {last && (
              <div className="mlab-card flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <b>درجات المخرج — الجولة {reviews.length}</b>
                  <span className="font-bold" style={{ color: last.pass ? "var(--jw-ok)" : "var(--jw-muted)" }}>{last.pass ? `✅ وصل المعيار (كلها ≥ ${PASS})` : `أقل درجة ${last.low}`}</span>
                </div>
                <ul className="mlab-score m-0 list-none p-0">
                  {RUBRIC.map((r) => (
                    <li key={r.id}>
                      <span className="w-20 shrink-0 mlab-tip">{r.ar}</span>
                      <span className="bar">
                        <span className="block h-full rounded-full" style={{ width: `${last.scores[r.id] * 10}%`, background: last.scores[r.id] >= PASS ? "var(--jw-ok)" : "var(--jw-accent)" }} />
                      </span>
                      <b className="w-5 text-end tabular-nums">{last.scores[r.id]}</b>
                    </li>
                  ))}
                </ul>
                {!!last.worst.length && (
                  <ul className="m-0 list-none p-0 flex flex-col gap-1 text-sm mlab-tip">
                    {last.worst.map((w, i) => (
                      <li key={i}>
                        <b dir="ltr" style={{ color: "var(--jw-ink)" }}>{w.t.toFixed(1)}s</b> {w.problem}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {view !== "build" && view !== "export" && !!log.length && (
              <ul className="mlab-log" aria-live="polite">
                {log.slice(-4).map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}
