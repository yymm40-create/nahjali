"use client";

// «قص المرجع»: any video reference, in any generator, can be cut to the part wanted (start and end, to the hundredth
// of a second) or give one frame as a picture. Done in the browser (the cut is decoded and encoded again, so it starts
// and ends exactly there); the result goes in as a new reference and is checked by the server like any other file.

import { useEffect, useMemo, useRef, useState } from "react";
import Dialog from "../Dialog";
import Icon from "../Icon";
import { cutClip } from "./continuity";

/** A cut that takes longer than this has hung in the browser's encoder (seen in one Chrome): say so instead of spinning. */
const CUT_TIMEOUT_MS = 90_000;

/** The end set by default when a video is too long: this much under the limit, so a re-encoded cut never ends up a hair over it. */
const UNDER_LIMIT_S = 0.1;

const fmt = (s: number) => `${(Math.round(s * 100) / 100).toFixed(2)} ث`;

interface Props {
  /** The video: a file of the device or a link to a stored one. */
  src: File | string;
  name: string;
  /** This generator's length limits for a video (ms); none when it takes no video. */
  minMs?: number;
  maxMs?: number;
  /** Cutting is offered (the generator takes videos). */
  canClip: boolean;
  /** Taking a frame is offered (the generator, or this slot, takes pictures). */
  canFrame: boolean;
  /** Why the window opened by itself (e.g. the video is longer than allowed). */
  reason?: string;
  /** The video as it is fits: offer it without cutting. */
  onKeep?: () => void;
  onClip: (file: File) => void;
  onFrame: (file: File) => void;
  onClose: () => void;
}

export default function VideoTrim({ src, name, minMs, maxMs, canClip, canFrame, reason, onKeep, onClip, onFrame, onClose }: Props) {
  // A stored video is read once into memory: the player, the cut and the frame then all work on the same bytes. It is
  // fetched past the browser's cache, because the preview may have kept a copy without the storage's CORS headers
  // (then any cross-origin read of it fails).
  const [data, setData] = useState<Blob | null>(typeof src === "string" ? null : src);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    if (typeof src !== "string") return;
    let live = true;
    fetch(src, { cache: "no-store" })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => live && setData(b))
      .catch(() => live && setLoadError("تعذّر تحميل الفيديو؛ احذفه وأضفه من جديد، أو نزّله وارفعه من جهازك."));
    return () => {
      live = false;
    };
  }, [src]);
  const url = useMemo(() => (data ? URL.createObjectURL(data) : null), [data]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  const video = useRef<HTMLVideoElement>(null);
  const [dur, setDur] = useState(0);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState<"clip" | "frame" | null>(null);
  const [error, setError] = useState("");

  const max = maxMs ? maxMs / 1000 : Infinity;
  const min = minMs ? minMs / 1000 : 0;
  const [from, to] = range;
  const len = to - from;
  const tooLong = len > max + 1e-6;
  const tooShort = len < min - 1e-6;
  const base = name.replace(/\.[a-z0-9]+$/i, "") || "مرجع";

  function loaded() {
    const v = video.current;
    if (!v || !Number.isFinite(v.duration)) return;
    setDur(v.duration);
    // A video over the limit starts with its first allowed seconds chosen
    setRange([0, v.duration > max ? Math.max(min, max - UNDER_LIMIT_S) : v.duration]);
  }

  const seek = (t: number) => {
    const v = video.current;
    if (v) v.currentTime = Math.max(0, Math.min(dur, t));
  };
  const setFrom = (t: number) => setRange(([, b]) => [Math.max(0, Math.min(t, b - 0.1)), b]);
  const setTo = (t: number) => setRange(([a]) => [a, Math.min(dur, Math.max(t, a + 0.1))]);

  async function clip() {
    setBusy("clip");
    setError("");
    try {
      if (!data) return;
      const blob = await Promise.race([
        cutClip(data, from, to),
        new Promise<never>((_, fail) => setTimeout(() => fail(new Error("القص علّق في متصفحك. سكّر المتصفح كله وافتحه من جديد، أو جرّب متصفح ثاني.")), CUT_TIMEOUT_MS)),
      ]);
      onClip(new File([blob], `${base}-قص.mp4`, { type: "video/mp4" }));
    } catch (e) {
      setError((e as Error).message || "تعذّر قص المقطع.");
      setBusy(null);
    }
  }

  async function frame() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    setBusy("frame");
    setError("");
    try {
      v.pause();
      const c = document.createElement("canvas");
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
      const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.95));
      if (!blob) throw new Error("تعذّر أخذ الفريم.");
      onFrame(new File([blob], `${base}-فريم-${Math.round(v.currentTime * 100) / 100}.jpg`, { type: "image/jpeg" }));
    } catch (e) {
      setError((e as Error).message || "تعذّر أخذ الفريم.");
      setBusy(null);
    }
  }

  return (
    <Dialog open onClose={onClose} title={canClip ? "قص المرجع أو خذ منه فريم" : "خذ فريم من الفيديو"} wide>
      <div className="space-y-3 p-4">
        {reason && <p className="flex items-start gap-2 rounded-lg bg-jw-accent-soft px-3 py-2 text-sm"><Icon name="info" size={16} className="mt-0.5 shrink-0" /> {reason}</p>}
        <div className="grid min-h-40 place-items-center overflow-hidden rounded-lg bg-black">
          {!url && !loadError && <span className="jw-spinner" role="status" aria-label="يحمّل الفيديو" />}
          {loadError && <p className="p-6 text-sm text-jw-danger" role="alert">{loadError}</p>}
          {url && (
          <video
            ref={video}
            src={url}
            controls
            playsInline
            preload="auto"
            onLoadedMetadata={loaded}
            onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
            onSeeked={(e) => setNow(e.currentTarget.currentTime)}
            className="max-h-[45dvh] w-full object-contain"
          />
          )}
        </div>

        {dur > 0 && canClip && (
          <div className="space-y-2">
            <Bar dur={dur} from={from} to={to} now={now} bad={tooLong || tooShort} />
            <div className="grid gap-2 sm:grid-cols-2">
              <Edge label="البداية" value={from} max={dur} onChange={(t) => (setFrom(t), seek(t))} onHere={() => setFrom(now)} />
              <Edge label="النهاية" value={to} max={dur} onChange={(t) => (setTo(t), seek(t))} onHere={() => setTo(now)} />
            </div>
            <p className={`text-xs ${tooLong || tooShort ? "text-jw-danger" : "text-jw-muted"}`}>
              الطول المختار: <span dir="ltr">{fmt(len)}</span> من <span dir="ltr">{fmt(dur)}</span>
              {Number.isFinite(max) && <> · المسموح هنا {min ? <>من <span dir="ltr">{fmt(min)}</span> </> : ""}حتى <span dir="ltr">{fmt(max)}</span></>}
            </p>
          </div>
        )}

        {canFrame && <p className="text-xs text-jw-muted">للفريم: وقّف الفيديو على اللقطة اللي تبيها (الوقت الحالي <span dir="ltr">{fmt(now)}</span>) واضغط «خذ هذا الفريم».</p>}
        {error && <p className="error-box text-sm" role="alert">{error}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          {canFrame && (
            <button type="button" className="jw-btn" disabled={Boolean(busy) || !dur} onClick={frame}>
              {busy === "frame" ? <span className="jw-spinner" /> : <Icon name="camera" size={16} />} خذ هذا الفريم كصورة
            </button>
          )}
          {canClip && onKeep && dur > 0 && dur <= max + 1e-6 && dur >= min - 1e-6 && from < 0.01 && to > dur - 0.01 && (
            <button type="button" className="jw-btn" disabled={Boolean(busy)} onClick={onKeep}>
              <Icon name="check" size={16} /> استخدمه كامل
            </button>
          )}
          {canClip && (
            <button type="button" className="jw-btn jw-btn-primary" disabled={Boolean(busy) || !dur || tooLong || tooShort} onClick={clip}>
              {busy === "clip" ? <span className="jw-spinner" /> : <Icon name="scissors" size={16} />} {busy === "clip" ? "يقص…" : "قص واستخدم"}
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}

/** The whole video as a bar: the chosen part, and where the player is. */
function Bar({ dur, from, to, now, bad }: { dur: number; from: number; to: number; now: number; bad: boolean }) {
  const pct = (t: number) => `${(t / dur) * 100}%`;
  return (
    <div className="relative h-3 overflow-hidden rounded-full bg-jw-bg-2" dir="ltr" aria-hidden>
      <span className={`absolute inset-y-0 ${bad ? "bg-jw-danger/60" : "bg-jw-accent/60"}`} style={{ left: pct(from), width: pct(to - from) }} />
      <span className="absolute inset-y-0 w-0.5 bg-jw-ink" style={{ left: pct(now) }} />
    </div>
  );
}

function Edge({ label, value, max, onChange, onHere }: { label: string; value: number; max: number; onChange: (t: number) => void; onHere: () => void }) {
  return (
    <div className="space-y-1 rounded-lg border border-jw-line p-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold">{label}</span>
        <span className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={Math.floor(max * 100) / 100}
            step={0.01}
            value={Math.round(value * 100) / 100}
            onChange={(e) => onChange(Number(e.target.value) || 0)}
            className="jw-input !h-7 w-20 !px-1.5 text-center text-xs"
            dir="ltr"
            aria-label={`${label} بالثواني`}
          />
          ث
        </span>
      </div>
      <input type="range" min={0} max={max} step={0.01} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" dir="ltr" aria-label={label} />
      <button type="button" onClick={onHere} className="text-[11px] text-jw-muted underline hover:text-jw-ink">حطها عند الوقت الحالي</button>
    </div>
  );
}
