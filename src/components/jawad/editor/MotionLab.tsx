"use client";

// «🎬 مختبر الموشن» — حيدرة makes a motion piece in CODE, the way the viral Claude Opus 5.5 films were made: the person
// gives the idea (and, if they like, references, their own pictures and brand colours) → حيدرة writes the plan
// (idea, hook, look, shot list) → approved → he writes the scene program → the browser runs it in a sandbox and
// catches any bug (sent back to him to fix) → contact sheets and stills go to him, he scores them like a harsh
// director and rewrites what is below the bar (up to three rounds) → the final film is rendered here at 30 fps with
// motion blur and lands on the timeline with its sound cues (and, if asked, music from ElevenLabs).

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { postJson } from "@/lib/fetch";
import { useClaudeModel } from "@/components/robots/claude-model";
import ClaudeModelPicker from "@/components/robots/ClaudeModelPicker";
import { readCues, type Cue, type LabPlan, type Review } from "@/lib/editor/scene/contract";
import { MAX_ROUNDS, PASS, RUBRIC } from "@/lib/editor/scene/skill";
import { FONT_BY_ID } from "@/lib/editor/fonts";
import { SceneError, SceneHost, sceneFont, type SceneInfo } from "./scene-host";
import { contactSheet, frameCost, probe, renderVideo, reviewTimes, stills } from "./scene-render";
import { download } from "./export";
import type { EditorAsset } from "./types";

type Stage = "brief" | "planning" | "plan" | "building" | "reviewing" | "ready" | "rendering";
const REVIEW_MODES = {
  fast: { label: "سريع", rounds: 0, description: "فحص التشغيل فقط، بدون مراجعة جودة تلقائية. الأسرع." },
  balanced: { label: "متوازن", rounds: 1, description: "مراجعة جودة واحدة وتصحيح عند الحاجة. وقت متوسط." },
  precise: { label: "دقيق", rounds: MAX_ROUNDS, description: "حتى ٣ جولات مراجعة وتحسين، ويتوقف مبكرًا إذا اجتاز الفحص. يأخذ وقتًا أطول." },
} as const;
type ReviewMode = keyof typeof REVIEW_MODES;
interface Saved {
  reviewMode?: ReviewMode;
  brief: string;
  seconds: number;
  intensity: number;
  brand: string;
  picks: string[];
  plan: LabPlan | null;
  say: string;
  code: string;
  reviews: Review[];
  /** خلفية شفافة: الأشخاص/العناصر بدون خلفية، تصدّر WebM منفصل بدل ما تدخل التايملاين مباشرة */
  transparent?: boolean;
  /** هل الكود المحفوظ حاليًا مكتوب فعلًا بدون خلفية (يختلف عن `transparent` لو حطّوه بعد ما بنى المشهد) */
  transparentCode?: boolean;
}
const key = (id: string) => `jw-lab-${id}`;
const SECONDS = [6, 10, 15, 20, 30, 45, 60];
const FIXES = 2;
/** One request to the server never waits longer than this before it is given up on (the route itself allows more). */
const CALL_TIMEOUT_MS = 6 * 60_000;
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
  const [brief, setBrief] = useState(initialBrief);
  const [seconds, setSeconds] = useState(() => SECONDS.reduce((a, b) => (Math.abs(b - (initialSeconds || 15)) < Math.abs(a - (initialSeconds || 15)) ? b : a), 15));
  const [intensity, setIntensity] = useState(4);
  const [brand, setBrand] = useState("");
  const [picks, setPicks] = useState<string[]>([]);
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
  const [music, setMusic] = useState(true);
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
  const view = useRef<HTMLCanvasElement>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const portalReady = useSyncExternalStore(subscribeToClient, () => true, () => false);
  // closed while busy (a build, a review round, the final render): folded to a small pill instead of stopped, so the
  // work keeps going; the person reopens it from the pill OR from the editor's own «مختبر الموشن» button (which is why
  // the fold lives in the editor's state), or presses «إلغاء» inside to really stop it
  const setMinimized = onMinimize;
  const say1 = (s: string) => setLog((l) => [...l.slice(-30), s]);

  // pictures from the library the scene may use, with short ids حيدرة writes in his code (a1, a2…)
  const images = useMemo(() => assets.filter((a) => a.kind === "image" && a.url && a.status === "ready").slice(0, 24), [assets]);
  const chosen = useMemo(() => picks.map((id, i) => ({ short: `a${i + 1}`, asset: images.find((a) => a.id === id)! })).filter((x) => x.asset), [picks, images]);
  const assetList = chosen.map((c) => ({ id: c.short, name: c.asset.name, w: c.asset.width ?? 0, h: c.asset.height ?? 0 }));

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
        setPlan(s.plan);
        setSay(s.say || "");
        setCode(s.code || "");
        setReviews(s.reviews || []);
        setReviewMode(s.reviewMode === "fast" || s.reviewMode === "precise" ? s.reviewMode : "balanced");
        setTransparent(Boolean(s.transparent));
        setTransparentCode(Boolean(s.transparentCode));
        if (s.plan && !initialBrief) setStage(s.code ? "ready" : "plan");
      }, 0);
      return () => clearTimeout(tm);
    } catch {
      /* a fresh start */
    }
  }, [projectId, initialBrief]);
  useEffect(() => {
    try {
      localStorage.setItem(key(projectId), JSON.stringify({ brief, seconds, intensity, brand, picks, plan, say, code, reviews, reviewMode, transparent, transparentCode } satisfies Saved));
    } catch {
      /* not kept */
    }
  }, [projectId, brief, seconds, intensity, brand, picks, plan, say, code, reviews, reviewMode, transparent, transparentCode]);
  useEffect(() => () => (host.current?.destroy(), abort.current?.abort()), []);

  const call = useCallback(async <T,>(action: string, body: Record<string, unknown>) => {
    // «إلغاء» really stops it, and a request that never answers gives up instead of leaving the lab spinning for ever
    const outer = abort.current?.signal;
    const timer = AbortSignal.timeout(CALL_TIMEOUT_MS);
    const signal = outer ? AbortSignal.any([outer, timer]) : timer;
    const result = await postJson<T & { error?: string }>(`/api/jawad/editor/projects/${projectId}`, { action, model: claude.id, ...body, stream: true }, signal).catch((e: unknown) => {
      if (outer?.aborted) throw new DOMException("cancelled", "AbortError");
      if (timer.aborted) throw new Error(`«${action === "lab_plan" ? "الخطة" : action === "lab_write" ? "كتابة المشهد" : "المراجعة"}» أخذت أكثر من ${Math.round(CALL_TIMEOUT_MS / 60_000)} دقائق بدون رد. جرّب مرة ثانية، أو خفّف الطلب (ثواني أقل أو مراجعة «سريع»).`);
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
    const got = await h.load(program, { w: width, h: height, fps: 30, assets: bitmaps, fonts });
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
        const r = await call<{ code: string; problems: string[]; notes: string }>("lab_write", { plan: p, seconds: p.seconds, assets: assetList, transparent, ...(program ? { code: program, errors: why } : {}) });
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
    setNow(0);
    try {
      const r = await call<{ plan: LabPlan; say: string }>("lab_plan", { brief: tweak && plan ? `${brief}\n\nتعديل على الخطة السابقة («${plan.title}»): ${tweak}` : brief, seconds, intensity, brand, assets: assetList, references: refs, language: "Arabic (Gulf)" });
      setPlan(r.plan);
      setSay(r.say);
      setTweak("");
      setCode("");
      setReviews([]);
      setStage("plan");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setError(e instanceof Error ? e.message : String(e));
      setStage(plan ? "plan" : "brief");
    }
  };

  /** Builds, then the director's rounds: render sheets and stills, he scores and rewrites, until it passes. */
  const build = async () => {
    if (!plan) return;
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
    try {
      let { program, got } = await buildRunning(plan, code);
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
        const shotTimes = (cost > 400 ? reviewTimes(got.duration).filter((_, i) => i % 2 === 0) : reviewTimes(got.duration));
        say1(`🎬 الجولة ${round} من ${rounds}: أصوّر ${perSheet * 2} لقطة لورقتي التلامس و${shotTimes.length} لقطات كاملة${cost > 150 ? " (خفّفتها لأن المشهد ثقيل على جهازك)" : ""}…`);
        const half = got.duration / 2;
        const sheets = [await contactSheet(h, 0, half, perSheet, 3), await contactSheet(h, half, got.duration, perSheet, 3)];
        const times = shotTimes;
        const shots = await stills(h, times, got.duration);
        say1("🧐 حيدرة يراجع كمخرج قاسي…");
        const r = await call<{ review: Review; code: string; problems: string[] }>("lab_review", { plan, seconds: plan.seconds, assets: assetList, code: program, sheets, stills: shots, times, round, maxRounds: rounds, reviewOnly: true });
        stop();
        done.push(r.review);
        setReviews([...done]);
        say1(`${r.review.pass ? "✅" : "📝"} ${r.review.verdict}`);
        if (r.review.pass) break;
        say1("✍️ أطبّق ملاحظات المخرج على المشهد…");
        const next = await buildRunning(plan, program, `Apply this visual review, preserving the approved plan and everything that already works: ${JSON.stringify(r.review)}`);
        stop();
        program = next.program;
        got = next.got;
        setCode(program);
        setInfo(got);
      }
      setStage("ready");
      void seekTo(Math.min(got.duration * 0.3, 2));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") say1("⏹️ أوقفت الشغل.");
      else setError(e instanceof Error ? e.message : String(e));
      setStage(code ? "ready" : "plan");
    }
  };

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
          const c = view.current;
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
      const c = view.current;
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
      say1(makingTransparent ? `🎞️ أرندر ${frames} إطارًا بخلفية شفافة (WebM) · ${mmss(plannedMs)} تقريبًا على جهازك.` : `🎞️ أرندر ${frames} إطارًا · ${mmss(plannedMs)} تقريبًا على جهازك.`);
      const started = performance.now();
      const blob = await renderVideo(
        host.current,
        { duration: info.duration, fps: 30, blur: info.blur, sub, transparent: makingTransparent },
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
      onFilm(file, readCues(info.cues, info.duration), music && plan.music ? { prompt: `${plan.music}. ${plan.bpm} BPM, instrumental, builds to a clear peak and resolves on the last beat.`, ms: Math.round(info.duration * 1000) } : null);
      setStage("ready");
      setRenderAt(null);
      say1("✅ نزل المقطع في التايملاين مع أصواته.");
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

  if (!portalReady) return null;

  if (minimized)
    return createPortal(
      <button type="button" className="jw-btn jw-btn-primary jw-3d fixed bottom-4 end-4 z-[1000] !min-h-12 gap-2 !rounded-full !px-4 shadow-2xl" onClick={() => setMinimized(false)} aria-label="رجّع مختبر الموشن" style={{ insetInlineEnd: "max(1rem, env(safe-area-inset-right, 0px))", bottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}>
        {busy ? <span className="jw-spinner" /> : <span aria-hidden>✅</span>}
        🎬 {busy ? `${stageAr}${stage === "rendering" ? ` ${Math.round(progress * 100)}٪${renderAt ? ` · يبقى ${mmss(renderAt.leftMs)}` : ""}` : ` ${elapsed}`}` : "جاهز — افتح المختبر"}
      </button>,
      document.body,
    );

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-stretch justify-center bg-black/70 p-2 sm:p-6" role="dialog" aria-modal="true" aria-label="مختبر الموشن" dir="rtl">
      <div className="jw-glass-lg flex max-h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-jw-surface shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
        <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-2 border-b border-jw-line bg-jw-surface px-3 py-3 sm:px-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-black">
              🎬 مختبر الموشن
              {busy && (
                <span className="rounded-full bg-jw-accent-soft px-2 py-0.5 text-xs font-bold text-jw-accent tabular-nums" role="status" aria-live="polite">
                  {stageAr} · {stage === "rendering" && renderAt ? `إطار ${renderAt.frame}/${renderAt.frames} · يبقى ${mmss(renderAt.leftMs)}` : elapsed}
                </span>
              )}
            </h2>
            <p className="hidden text-xs text-jw-muted sm:block">{busy ? "الشغل ماشي. تقدر تصغّر النافذة وترجع للمونتاج — يكمل في الخلفية، وترجّعه من زر «مختبر الموشن»." : "حيدرة يصمم ويكتب كل فريم بالكود، يشوف النتيجة ويقيّمها كمخرج قاسي، ويصلّح لين يوصل مستوى الاستوديوهات."}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <ClaudeModelPicker disabled={busy} />
            {busy && (
              <button type="button" className="jw-btn jw-btn-quiet !min-h-9" onClick={cancel} title="يوقف العملية الحالية (الكود المسوّى قبلها يبقى محفوظ)">
                إلغاء
              </button>
            )}
            <button type="button" className="jw-btn jw-btn-primary !min-h-9 whitespace-nowrap" onClick={close} title={busy ? "ارجع للمونتاج ويكمل المختبر شغله في الخلفية" : "اخرج من المختبر وارجع للمونتاج"}>
              ← {busy ? "ارجع والمختبر يكمل" : "رجوع للمونتاج"}
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <section className="min-w-0 space-y-4">
            <fieldset disabled={busy} className="space-y-2 rounded-2xl border border-jw-line bg-jw-surface p-3">
              <legend className="px-2 text-sm font-bold">مستوى الفحص</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {(Object.keys(REVIEW_MODES) as ReviewMode[]).map((mode) => (
                  <label key={mode} className={`cursor-pointer rounded-xl border p-3 ${reviewMode === mode ? "border-jw-accent bg-jw-accent/15" : "border-jw-line"} ${busy ? "cursor-not-allowed opacity-60" : ""}`}>
                    <span className="flex items-center gap-2 font-bold"><input type="radio" name="motion-review-mode" value={mode} checked={reviewMode === mode} onChange={() => setReviewMode(mode)} />{REVIEW_MODES[mode].label}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-jw-muted">{REVIEW_MODES[mode].description}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-jw-muted">كل المستويات تفحص أخطاء التشغيل وتصلّحها عند الحاجة. اختيارك محفوظ لهذا المشروع؛ تقدر تغيّره قبل البناء.</p>
            </fieldset>
            {(stage === "brief" || stage === "planning" || !plan) && (
              <div className="space-y-3">
                <label className="block space-y-1">
                  <span className="font-bold">وش الموشن اللي تبيه؟</span>
                  <textarea className="jw-textarea w-full" rows={4} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="مثال: إعلان ١٥ ثانية لتطبيق «نهج علي»: الكلمة تتكوّن من غبار ذهبي، أرقام النمو تطلع على الإيقاع، وفي الآخر الشعار ينبني من جزيئات…" disabled={busy} />
                </label>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-jw-muted">المدة</span>
                  {SECONDS.map((s) => (
                    <button key={s} type="button" disabled={busy} className={`jw-chip !px-3 ${seconds === s ? "!border-jw-accent !bg-jw-accent/15" : ""}`} onClick={() => setSeconds(s)}>
                      {s} ث
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-jw-muted">الحماس</span>
                  {[
                    [1, "هادئ وفخم"],
                    [3, "متوازن"],
                    [4, "قوي"],
                    [5, "ناري"],
                  ].map(([v, ar]) => (
                    <button key={v} type="button" disabled={busy} className={`jw-chip !px-3 ${intensity === v ? "!border-jw-accent !bg-jw-accent/15" : ""}`} onClick={() => setIntensity(Number(v))}>
                      {ar}
                    </button>
                  ))}
                </div>
                <label className="block space-y-1 text-sm">
                  <span className="text-jw-muted">ألوان وخطوط العلامة (اختياري)</span>
                  <input className="jw-input w-full" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="#0b3d2e و #d4af37، خط عريض" disabled={busy} />
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} disabled={busy} />
                  <span>
                    🪄 خلفية شفافة <span className="block text-xs text-jw-muted">يكتب حيدرة الأشخاص/العناصر بدون خلفية من الأول، عشان تركّبه بعدين على خلفية ثانية. تقدر تفعّله الحين أو بعد ما يخلص المشهد.</span>
                  </span>
                </label>
                {!!images.length && (
                  <div className="space-y-1 text-sm">
                    <span className="text-jw-muted">صور من مكتبتك يستخدمها في المشهد (شعار، منتج، شخصية…)</span>
                    <div className="flex flex-wrap gap-2">
                      {images.map((a) => {
                        const on = picks.includes(a.id);
                        return (
                          <button key={a.id} type="button" disabled={busy} onClick={() => setPicks(on ? picks.filter((x) => x !== a.id) : [...picks, a.id].slice(0, 8))} className={`relative h-16 w-16 overflow-hidden rounded-lg border ${on ? "border-jw-accent ring-2 ring-jw-accent/40" : "border-jw-line"}`} title={a.name}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={a.url!} alt={a.name} className="h-full w-full object-cover" />
                            {on && <span className="absolute inset-x-0 bottom-0 bg-jw-accent text-[10px] font-bold text-white">a{picks.indexOf(a.id) + 1}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <label className="block space-y-1 text-sm">
                  <span className="text-jw-muted">مراجع: لقطات من ريلز عاجبتك (ياخذ منها الألوان والإيقاع والخطوط، مو المحتوى)</span>
                  <input type="file" accept="image/*" multiple disabled={busy} onChange={async (e) => setRefs(await Promise.all([...(e.target.files ?? [])].slice(0, 4).map(refOf)))} />
                  {!!refs.length && <span className="text-xs text-jw-ok">{refs.length} مرجع جاهز</span>}
                </label>
                <button type="button" className="jw-btn jw-btn-primary !min-h-11" disabled={busy || brief.trim().length < 3} onClick={makePlan}>
                  {stage === "planning" ? <span className="jw-spinner !border-white/40 !border-t-white" aria-hidden /> : "🧠"} اكتب الخطة
                </button>
              </div>
            )}

            {plan && stage !== "brief" && stage !== "planning" && (
              <div className="space-y-3 rounded-2xl border border-jw-line bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-black">{plan.title}</h3>
                    <p className="text-sm">{plan.idea}</p>
                  </div>
                  <div className="flex gap-1" aria-label="الألوان">
                    {Object.values(plan.palette).map((c, i) => (
                      <span key={i} className="h-6 w-6 rounded-full border border-jw-line" style={{ background: c }} title={c} />
                    ))}
                  </div>
                </div>
                {say && <p className="text-sm text-violet-700">🤖 {say}</p>}
                <p className="text-xs text-jw-muted">
                  🎣 الهوك: {plan.hook} · ✨ اللحظة المبهرة: {plan.wow} · 🔤 {FONT_BY_ID.get(plan.fonts.head)?.ar ?? plan.fonts.head} / {FONT_BY_ID.get(plan.fonts.body)?.ar ?? plan.fonts.body} · {plan.seconds} ث · {plan.bpm} BPM
                </p>
                <ol className="max-h-56 space-y-1 overflow-y-auto text-xs">
                  {plan.shots.map((s, i) => (
                    <li key={i} className="rounded-lg bg-jw-surface-2 px-2 py-1">
                      <b className="tabular-nums" dir="ltr">
                        {s.from.toFixed(1)}–{s.to.toFixed(1)}s
                      </b>{" "}
                      {s.what} {s.text && <span className="font-bold">«{s.text}»</span>} <span className="text-jw-muted">· {s.motion} · {s.camera}</span>
                    </li>
                  ))}
                </ol>
                {(stage === "plan" || stage === "ready") && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="jw-btn jw-btn-primary !min-h-11" disabled={busy} onClick={build}>
                        🎬 {code ? "ابنِ من جديد وراجع" : "اعتمد الخطة وابنِ"}
                      </button>
                      <button type="button" className="jw-btn" disabled={busy} onClick={() => setStage("brief")}>
                        فكرة جديدة
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input className="jw-input flex-1" value={tweak} onChange={(e) => setTweak(e.target.value)} placeholder="عدّل الخطة: خلّ الهوك أقوى، غيّر الألوان، أضف رقم…" disabled={busy} />
                      <button type="button" className="jw-btn" disabled={busy || !tweak.trim()} onClick={makePlan}>
                        عدّل
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!!log.length && (
              <ul className="space-y-1 rounded-xl bg-jw-surface-2 p-3 text-xs" aria-live="polite">
                {log.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            )}
            {error && (
              <p role="alert" className="rounded-lg border border-jw-danger/40 bg-jw-danger/10 px-3 py-2 text-sm text-jw-danger">
                {error}
              </p>
            )}
          </section>

          <aside className="min-w-0 space-y-3">
            <div className="flex aspect-[9/16] max-h-[56vh] w-full items-center justify-center overflow-hidden rounded-2xl bg-[#111] lg:aspect-auto lg:h-[56vh]" style={width > height ? { aspectRatio: `${width} / ${height}`, height: "auto" } : undefined}>
              {info ? <canvas ref={view} className="max-h-full max-w-full" /> : <span className="px-6 text-center text-sm text-white/60">{busy ? "حيدرة يشتغل على المشهد…" : "المعاينة تطلع هنا بعد ما يبني حيدرة المشهد."}</span>}
            </div>
            {info && (
              <div className="flex items-center gap-2" dir="ltr">
                <button type="button" className="jw-btn !min-h-9" disabled={stage === "rendering"} onClick={() => setPlaying((v) => !v)} aria-label={playing ? "وقّف" : "شغّل"}>
                  {playing ? "⏸" : "▶"}
                </button>
                <input type="range" className="flex-1" min={0} max={info.duration} step={0.01} value={t} disabled={playing || stage === "rendering"} onChange={(e) => void seekTo(Number(e.target.value))} aria-label="الوقت" />
                <span className="w-14 text-end text-xs tabular-nums">{t.toFixed(2)}s</span>
              </div>
            )}

            {last && (
              <div className="space-y-2 rounded-2xl border border-jw-line bg-white p-3">
                <div className="flex items-center justify-between text-sm">
                  <b>درجات المخرج — الجولة {reviews.length}</b>
                  <span className={last.pass ? "font-bold text-jw-ok" : "text-jw-muted"}>{last.pass ? `✅ وصل المعيار (كلها ≥ ${PASS})` : `أقل درجة ${last.low}`}</span>
                </div>
                <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  {RUBRIC.map((r) => (
                    <li key={r.id} className="flex items-center gap-2">
                      <span className="w-20 shrink-0 text-jw-muted">{r.ar}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-jw-surface-3">
                        <span className="block h-full rounded-full" style={{ width: `${last.scores[r.id] * 10}%`, background: last.scores[r.id] >= PASS ? "var(--jw-ok, #16a34a)" : "var(--jw-accent)" }} />
                      </span>
                      <b className="w-4 text-end tabular-nums">{last.scores[r.id]}</b>
                    </li>
                  ))}
                </ul>
                {!!last.worst.length && (
                  <ul className="space-y-0.5 text-xs text-jw-muted">
                    {last.worst.map((w, i) => (
                      <li key={i}>
                        <b dir="ltr">{w.t.toFixed(1)}s</b> {w.problem}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {!info && stage === "ready" && code && (
              <button type="button" className="jw-btn w-full" onClick={reopen}>
                ▶️ شغّل المشهد المحفوظ
              </button>
            )}
            {info && (stage === "ready" || stage === "rendering") && (
              <div className="space-y-2 rounded-2xl border border-jw-line bg-white p-3">
                {plan?.music && !transparent && (
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-1" checked={music} onChange={(e) => setMusic(e.target.checked)} disabled={stage === "rendering"} />
                    <span>
                      موسيقى على الإيقاع من ElevenLabs <span className="block text-xs text-jw-muted">{plan.music}</span>
                    </span>
                  </label>
                )}
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} disabled={stage === "rendering"} />
                  <span>
                    🪄 خلفية شفافة <span className="block text-xs text-jw-muted">يصدّر ملف WebM منفصل بدون خلفية تنزّله وتركّبه بنفسك — ما يدخل التايملاين تلقائيًا</span>
                  </span>
                </label>
                {transparent && !transparentCode && (
                  <button type="button" className="jw-btn w-full" disabled={stage === "rendering"} onClick={stripBackground}>
                    🪄 فرّغ خلفية هذا المشهد الآن
                  </button>
                )}
                {transparent && transparentCode && <p className="text-xs text-jw-ok">✓ المشهد مكتوب بدون خلفية؛ جاهز يصدّر شفافًا.</p>}
                <button type="button" className="jw-btn jw-btn-primary !min-h-11 w-full" disabled={stage === "rendering" || (transparent && !transparentCode)} onClick={exportFilm}>
                  {stage === "rendering"
                    ? `أرندر ${Math.round(progress * 100)}٪${renderAt ? ` · إطار ${renderAt.frame} من ${renderAt.frames} · يبقى ${mmss(renderAt.leftMs)}` : ""}`
                    : transparent
                      ? "⬇️ صدّر الملف الشفاف ونزّله"
                      : "⬇️ صدّره ونزّله في التايملاين"}
                </button>
                <p className="text-[11px] text-jw-faint">{transparent ? "يتصدّر WebM بقناة شفافية (ألفا) على جهازك، وينزل مباشرة — لتركيبه في أي برنامج مونتاج يدعم الشفافية." : "يتصدّر على جهازك بـ ٣٠ فريم مع ضبابية حركة، ويدخل التايملاين عند مؤشر الوقت مع مؤثراته الصوتية."}</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}
