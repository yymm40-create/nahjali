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
import { contactSheet, probe, renderVideo, reviewTimes, stills } from "./scene-render";
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
}
const key = (id: string) => `jw-lab-${id}`;
const SECONDS = [6, 10, 15, 20, 30, 45, 60];
const FIXES = 2;
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
  const [progress, setProgress] = useState(0);
  const host = useRef<SceneHost | null>(null);
  const abort = useRef<AbortController | null>(null);
  const view = useRef<HTMLCanvasElement>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const portalReady = useSyncExternalStore(subscribeToClient, () => true, () => false);
  // closed while busy (a build, a review round, the final render): folded to a small pill instead of stopped, so the
  // work keeps going; the person reopens it from the pill, or presses «إلغاء» inside to really stop it
  const [minimized, setMinimized] = useState(false);
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
        if (s.plan && !initialBrief) setStage(s.code ? "ready" : "plan");
      }, 0);
      return () => clearTimeout(tm);
    } catch {
      /* a fresh start */
    }
  }, [projectId, initialBrief]);
  useEffect(() => {
    try {
      localStorage.setItem(key(projectId), JSON.stringify({ brief, seconds, intensity, brand, picks, plan, say, code, reviews, reviewMode } satisfies Saved));
    } catch {
      /* not kept */
    }
  }, [projectId, brief, seconds, intensity, brand, picks, plan, say, code, reviews, reviewMode]);
  useEffect(() => () => (host.current?.destroy(), abort.current?.abort()), []);

  const call = useCallback(async <T,>(action: string, body: Record<string, unknown>) => {
    const result = await postJson<T & { error?: string }>(`/api/jawad/editor/projects/${projectId}`, { action, model: claude.id, ...body, stream: true });
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
        const r = await call<{ code: string; problems: string[]; notes: string }>("lab_write", { plan: p, seconds: p.seconds, assets: assetList, ...(program ? { code: program, errors: why } : {}) });
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
    setStage("planning");
    try {
      const r = await call<{ plan: LabPlan; say: string }>("lab_plan", { brief: tweak && plan ? `${brief}\n\nتعديل على الخطة السابقة («${plan.title}»): ${tweak}` : brief, seconds, intensity, brand, assets: assetList, references: refs, language: "Arabic (Gulf)" });
      setPlan(r.plan);
      setSay(r.say);
      setTweak("");
      setCode("");
      setReviews([]);
      setStage("plan");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage(plan ? "plan" : "brief");
    }
  };

  /** Builds, then the director's rounds: render sheets and stills, he scores and rewrites, until it passes. */
  const build = async () => {
    if (!plan) return;
    setError(null);
    setLog([]);
    setReviews([]);
    setStage("building");
    try {
      let { program, got } = await buildRunning(plan, code);
      setCode(program);
      setInfo(got);
      const rounds = REVIEW_MODES[reviewMode].rounds;
      if (rounds > 0) setStage("reviewing");
      else say1("✅ اجتاز المشهد فحص التشغيل. اخترت السريع؛ لم تُجرَ مراجعة جودة بصرية.");
      const done: Review[] = [];
      for (let round = 1; round <= rounds; round++) {
        say1(`🎬 الجولة ${round} من ${rounds}: أصوّر أوراق التلامس واللقطات لحيدرة…`);
        const h = host.current!;
        const half = got.duration / 2;
        const sheets = [await contactSheet(h, 0, half, 24), await contactSheet(h, half, got.duration, 24)];
        const times = reviewTimes(got.duration);
        const shots = await stills(h, times, got.duration);
        say1("🧐 حيدرة يراجع كمخرج قاسي…");
        const r = await call<{ review: Review; code: string; problems: string[] }>("lab_review", { plan, seconds: plan.seconds, assets: assetList, code: program, sheets, stills: shots, times, round, maxRounds: rounds, reviewOnly: true });
        done.push(r.review);
        setReviews([...done]);
        say1(`${r.review.pass ? "✅" : "📝"} ${r.review.verdict}`);
        if (r.review.pass) break;
        say1("✍️ أطبّق ملاحظات المخرج على المشهد…");
        const next = await buildRunning(plan, program, `Apply this visual review, preserving the approved plan and everything that already works: ${JSON.stringify(r.review)}`);
        program = next.program;
        got = next.got;
        setCode(program);
        setInfo(got);
      }
      setStage("ready");
      void seekTo(Math.min(got.duration * 0.3, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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

  const exportFilm = async () => {
    if (!host.current || !info || !plan) return;
    setError(null);
    setPlaying(false);
    setStage("rendering");
    abort.current = new AbortController();
    try {
      const blob = await renderVideo(host.current, { duration: info.duration, fps: 30, blur: info.blur }, setProgress, abort.current.signal);
      const file = new File([blob], `${(plan.title || "motion").replace(/[\\/:*?"<>|]/g, "").slice(0, 50)}.mp4`, { type: "video/mp4" });
      onFilm(file, readCues(info.cues, info.duration), music && plan.music ? { prompt: `${plan.music}. ${plan.bpm} BPM, instrumental, builds to a clear peak and resolves on the last beat.`, ms: Math.round(info.duration * 1000) } : null);
      setStage("ready");
      say1("✅ نزل المقطع في التايملاين مع أصواته.");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setError(e instanceof Error ? e.message : String(e));
      setStage("ready");
    }
  };

  const busy = stage === "planning" || stage === "building" || stage === "reviewing" || stage === "rendering";
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
    abort.current?.abort();
    setStage(code ? "ready" : plan ? "plan" : "brief");
    setMinimized(false);
  };

  if (!portalReady) return null;

  if (minimized)
    return createPortal(
      <button type="button" className="jw-btn jw-btn-primary jw-3d fixed bottom-4 end-4 z-[1000] !min-h-12 gap-2 !rounded-full !px-4 shadow-2xl" onClick={() => setMinimized(false)} aria-label="رجّع مختبر الموشن">
        <span className="jw-spinner" />
        🎬 {stageAr}{stage === "rendering" ? ` ${Math.round(progress * 100)}٪` : "…"}
      </button>,
      document.body,
    );

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-stretch justify-center bg-black/70 p-2 sm:p-6" role="dialog" aria-modal="true" aria-label="مختبر الموشن" dir="rtl">
      <div className="jw-glass-lg flex max-h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-jw-surface shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
        <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-2 border-b border-jw-line bg-jw-surface px-3 py-3 sm:px-4">
          <div className="min-w-0">
            <h2 className="text-lg font-black">🎬 مختبر الموشن</h2>
            <p className="hidden text-xs text-jw-muted sm:block">حيدرة يصمم ويكتب كل فريم بالكود، يشوف النتيجة ويقيّمها كمخرج قاسي، ويصلّح لين يوصل مستوى الاستوديوهات.</p>
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
                {plan?.music && (
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-1" checked={music} onChange={(e) => setMusic(e.target.checked)} disabled={stage === "rendering"} />
                    <span>
                      موسيقى على الإيقاع من ElevenLabs <span className="block text-xs text-jw-muted">{plan.music}</span>
                    </span>
                  </label>
                )}
                <button type="button" className="jw-btn jw-btn-primary !min-h-11 w-full" disabled={stage === "rendering"} onClick={exportFilm}>
                  {stage === "rendering" ? `أرندر ${Math.round(progress * 100)}٪…` : "⬇️ صدّره ونزّله في التايملاين"}
                </button>
                <p className="text-[11px] text-jw-faint">يتصدّر على جهازك بـ ٣٠ فريم مع ضبابية حركة، ويدخل التايملاين عند مؤشر الوقت مع مؤثراته الصوتية.</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}
