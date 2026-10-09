"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fmtDuration } from "@config/learn";
import { canPlayCourse, LearnStream, type PlayInfo } from "./stream";
import { Watermark } from "./watermark";
import "./learn.css";

type Phase = "idle" | "loading" | "playing" | "error";
const RATES = [0.75, 1, 1.25, 1.5, 2];

/**
 * The course video: no download button, no file address, a custom control bar, and a name tag over the picture.
 * Everything the browser would offer for saving a video (its menu, its picture-in-picture, a link to the file) is off;
 * the pieces come locked through LearnStream. Read the limits in config/learn.ts.
 */
export default function SecurePlayer({ lessonId, title, onEnd }: { lessonId: string; title: string; onEnd?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const stream = useRef<LearnStream | null>(null);
  const mark = useRef<Watermark | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState("");
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [paused, setPaused] = useState(true);
  const [rate, setRate] = useState(1);
  const [muted, setMuted] = useState(false);
  const [wait, setWait] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [full, setFull] = useState(false);
  const [label, setLabel] = useState("");

  const stop = useCallback(() => {
    mark.current?.stop();
    mark.current = null;
    stream.current?.destroy();
    stream.current = null;
  }, []);
  useEffect(() => stop, [stop]);
  useEffect(() => {
    const f = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);

  const fail = useCallback((m: string) => {
    stop();
    setMsg(m);
    setPhase("error");
    setPaused(true);
  }, [stop]);

  async function begin() {
    if (!canPlayCourse()) return fail("هذا المتصفح ما يقدر يشغّل الدورات. جرّب Chrome أو Safari حديث.");
    setPhase("loading");
    setMsg("");
    try {
      const res = await fetch("/api/learn/play", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lessonId }) });
      const j = (await res.json().catch(() => ({}))) as Partial<PlayInfo> & { error?: string };
      if (!res.ok || !j.session) return fail(j.error ?? "تعذّر بدء المشاهدة.");
      const info = j as PlayInfo;
      setLabel(info.label);
      const v = vid.current!;
      // nothing that lets the page's own video be captured as a stream
      for (const k of ["captureStream", "mozCaptureStream"]) Object.defineProperty(v, k, { value: () => { throw new Error("blocked"); }, configurable: false });
      setDur(info.manifest.duration);
      stop();
      const s = new LearnStream(v, lessonId, info, { onFatal: (_w, m) => fail(m), onWait: setWait });
      stream.current = s;
      const wm = new Watermark(box.current!, info.label, (why) => {
        // the name tag was touched: stop, and tell the site (it closes this viewing and notes it)
        void s.send({ bad: why });
        fail("تم إيقاف المشاهدة لأن علامة الحساب على الفيديو تم العبث بها. أعد تحميل الصفحة للمتابعة.");
      });
      mark.current = wm;
      wm.start();
      await s.start();
      v.muted = muted;
      await v.play().catch(() => null);
      setPhase((p) => (p === "loading" ? "playing" : p));
    } catch {
      fail("تعذّر بدء المشاهدة. جرّب مرة ثانية.");
    }
  }

  const toggle = () => {
    const v = vid.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };
  const seek = (s: number) => {
    const v = vid.current;
    if (v) v.currentTime = Math.max(0, Math.min(dur || v.duration || 0, s));
  };
  const goFull = () => {
    const el = box.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => null);
  };

  const live = phase === "playing";
  return (
    <div
      ref={box}
      className={`lp ${full ? "lp-full" : ""}`}
      tabIndex={0}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (!live) return;
        if (e.key === " " || e.key === "k") { e.preventDefault(); toggle(); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); seek((vid.current?.currentTime ?? 0) + 10); }
        else if (e.key === "ArrowRight") { e.preventDefault(); seek((vid.current?.currentTime ?? 0) - 10); }
        else if (e.key === "f") goFull();
        else if ((e.ctrlKey || e.metaKey) && ["s", "u", "p"].includes(e.key.toLowerCase())) e.preventDefault();
      }}
      dir="ltr"
    >
      <video
        ref={vid}
        className="lp-video"
        playsInline
        disablePictureInPicture
        controlsList="nodownload noremoteplayback noplaybackrate"
        draggable={false}
        preload="none"
        onClick={live ? toggle : undefined}
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onEnded={() => onEnd?.()}
        onDurationChange={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) setDur(d); }}
      />
      {phase !== "playing" && (
        <div className="lp-cover">
          <div className="lp-title" dir="auto">{title}</div>
          {phase === "error" && <p className="lp-msg" dir="rtl">{msg}</p>}
          <button className="lp-big" onClick={() => void begin()} disabled={phase === "loading"} aria-label="تشغيل">
            {phase === "loading" ? "…" : "▶"}
          </button>
          <p className="lp-note" dir="rtl">{phase === "loading" ? "نجهّز المشاهدة…" : "المشاهدة مسجّلة باسم حسابك"}</p>
        </div>
      )}
      {live && (buffering || wait) && <div className="lp-spin" aria-hidden>{wait ? "…نجهّز الجزء التالي" : ""}</div>}
      {live && (
        <div className="lp-bar" dir="ltr">
          <button onClick={toggle} aria-label={paused ? "تشغيل" : "إيقاف"}>{paused ? "▶" : "⏸"}</button>
          <span className="lp-time">{fmtDuration(t)}</span>
          <input type="range" min={0} max={Math.max(1, dur)} step={0.5} value={Math.min(t, dur || t)} onChange={(e) => seek(Number(e.target.value))} aria-label="التقدّم" />
          <span className="lp-time">{fmtDuration(dur)}</span>
          <button onClick={() => { const r = RATES[(RATES.indexOf(rate) + 1) % RATES.length]; setRate(r); if (vid.current) vid.current.playbackRate = r; }} aria-label="السرعة">{rate}×</button>
          <button onClick={() => { const m = !muted; setMuted(m); if (vid.current) vid.current.muted = m; }} aria-label="الصوت">{muted ? "🔇" : "🔊"}</button>
          <button onClick={goFull} aria-label="ملء الشاشة">{full ? "⤓" : "⛶"}</button>
        </div>
      )}
      {live && <span className="sr-only">{label}</span>}
    </div>
  );
}
