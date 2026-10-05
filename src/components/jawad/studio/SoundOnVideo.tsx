"use client";

import { useEffect, useRef, useState } from "react";
import Dialog from "../Dialog";

/** «مؤثرات من فيديو»: the made track played under its own video (muted), kept in step whatever the viewer does. */
export default function SoundOnVideo({ uploadId, audioUrl, downloadUrl, open, onClose }: { uploadId: string; audioUrl: string; downloadUrl: string; open: boolean; onClose: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const audio = useRef<HTMLAudioElement>(null);

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
        else setError("الفيديو الأصلي لم يعد موجودًا؛ يمكنك تنزيل الصوت وحده.");
      })
      .catch(() => live && setError("تعذّر تحميل الفيديو. جرّب مرة ثانية."));
    return () => {
      live = false;
    };
  }, [open, src, uploadId]);

  // The sound follows the picture: play, pause, seek, speed, and any drift
  useEffect(() => {
    const v = video.current;
    const a = audio.current;
    if (!v || !a) return;
    const sync = () => {
      if (Math.abs(a.currentTime - v.currentTime) > 0.15) a.currentTime = v.currentTime;
    };
    const play = () => {
      sync();
      a.play().catch(() => null);
    };
    const pause = () => a.pause();
    const rate = () => {
      a.playbackRate = v.playbackRate;
    };
    const on: [string, () => void][] = [["play", play], ["playing", play], ["pause", pause], ["waiting", pause], ["ended", pause], ["seeking", sync], ["seeked", sync], ["timeupdate", sync], ["ratechange", rate]];
    for (const [e, f] of on) v.addEventListener(e, f);
    return () => {
      for (const [e, f] of on) v.removeEventListener(e, f);
    };
  }, [src, open]);

  const close = () => {
    video.current?.pause();
    audio.current?.pause();
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} title="المؤثرات مع الفيديو">
      <div className="space-y-3 p-3">
        {src ? (
          <video ref={video} src={src} controls muted playsInline preload="auto" className="max-h-[65dvh] w-full rounded-lg bg-black object-contain" aria-label="الفيديو مع المؤثرات المصنوعة" />
        ) : (
          <div className="grid aspect-video place-items-center rounded-lg bg-jw-bg-2 text-sm text-jw-muted">{error || <span className="jw-spinner" />}</div>
        )}
        <audio ref={audio} src={audioUrl} preload="auto" className="hidden" />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-jw-muted">صوت الفيديو الأصلي مكتوم؛ ما تسمعه هو المؤثرات المصنوعة فقط.</p>
          <a href={downloadUrl} className="jw-btn jw-btn-primary shrink-0" download>تنزيل الصوت</a>
        </div>
      </div>
    </Dialog>
  );
}
