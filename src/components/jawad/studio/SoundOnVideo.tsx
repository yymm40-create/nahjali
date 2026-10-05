"use client";

import { useEffect, useRef, useState } from "react";
import Dialog from "../Dialog";

export interface SoundTrack {
  id: string;
  label: string;
  url: string;
  downloadUrl: string;
}

/**
 * «الفصل الذكي»: the made tracks played under their own video (muted), kept in step whatever the viewer does. Each
 * track can be switched on or off to hear it alone or together with the others.
 */
export default function SoundOnVideo({ uploadId, tracks, open, onClose }: { uploadId: string; tracks: SoundTrack[]; open: boolean; onClose: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [off, setOff] = useState<Record<string, boolean>>({});
  const video = useRef<HTMLVideoElement>(null);
  const audios = useRef(new Map<string, HTMLAudioElement>());

  // A fresh link to the original video (the stored reference)
  useEffect(() => {
    if (!open || src) return;
    let live = true;
    fetch(`/api/jawad/uploads?ids=${uploadId}`)
      .then((r) => r.json())
      .then((b: { uploads?: { url: string | null; status: string }[] }) => {
        if (!live) return;
        const u = b.uploads?.[0];
        if (u?.url && u.status === "ready") setSrc(u.url);
        else setError("الفيديو الأصلي لم يعد موجودًا؛ يمكنك تنزيل المسارات وحدها.");
      })
      .catch(() => live && setError("تعذّر تحميل الفيديو. جرّب مرة ثانية."));
    return () => {
      live = false;
    };
  }, [open, src, uploadId]);

  // The sound follows the picture: play, pause, seek, speed, and any drift
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const each = (f: (a: HTMLAudioElement) => void) => audios.current.forEach(f);
    const sync = () =>
      each((a) => {
        if (Math.abs(a.currentTime - v.currentTime) > 0.15) a.currentTime = v.currentTime;
      });
    const play = () => {
      sync();
      each((a) => void a.play().catch(() => null));
    };
    const pause = () => each((a) => a.pause());
    const rate = () => each((a) => (a.playbackRate = v.playbackRate));
    const on: [string, () => void][] = [["play", play], ["playing", play], ["pause", pause], ["waiting", pause], ["ended", pause], ["seeking", sync], ["seeked", sync], ["timeupdate", sync], ["ratechange", rate]];
    for (const [e, f] of on) v.addEventListener(e, f);
    return () => {
      for (const [e, f] of on) v.removeEventListener(e, f);
    };
  }, [src, open]);

  const close = () => {
    video.current?.pause();
    audios.current.forEach((a) => a.pause());
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} title="المسارات مع الفيديو">
      <div className="space-y-3 p-3">
        {src ? (
          <video ref={video} src={src} controls muted playsInline preload="auto" className="max-h-[60dvh] w-full rounded-lg bg-black object-contain" aria-label="الفيديو مع المسارات المصنوعة" />
        ) : (
          <div className="grid aspect-video place-items-center rounded-lg bg-jw-bg-2 text-sm text-jw-muted">{error || <span className="jw-spinner" />}</div>
        )}
        {tracks.map((t) => (
          <audio
            key={t.id}
            ref={(el) => {
              if (el) audios.current.set(t.id, el);
              else audios.current.delete(t.id);
            }}
            src={t.url}
            muted={Boolean(off[t.id])}
            preload="auto"
            className="hidden"
          />
        ))}
        {tracks.length > 1 && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="المسارات المسموعة">
            {tracks.map((t) => (
              <button key={t.id} type="button" aria-pressed={!off[t.id]} onClick={() => setOff((o) => ({ ...o, [t.id]: !o[t.id] }))} className={`jw-chip !min-h-8 !px-3 ${off[t.id] ? "opacity-50 line-through" : "!border-jw-accent/60 text-jw-accent"}`}>
                {t.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-jw-muted">صوت الفيديو الأصلي مكتوم؛ ما تسمعه هو المسارات {tracks.length > 1 ? "المختارة" : "المصنوعة"} فقط.</p>
          <div className="flex flex-wrap gap-1">
            {tracks.map((t) => (
              <a key={t.id} href={t.downloadUrl} className="jw-btn jw-btn-quiet !min-h-8 !px-2 text-xs" download>
                تنزيل {t.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
