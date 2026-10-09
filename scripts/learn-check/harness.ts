// Runs INSIDE the browser (bundled by run.mjs): the owner's upload path and the student's player, against a fake site.
import { ingest } from "@/components/learn/ingest";
import { LearnStream } from "@/components/learn/stream";
import { Watermark } from "@/components/learn/watermark";
import { toB64, randomKey } from "@/lib/learn/crypto";

const LESSON = "11111111-2222-3333-4444-555555555555";
const log = (...a: unknown[]) => console.log("[h]", ...a);

declare global {
  interface Window {
    run: (key: string) => Promise<unknown>;
    probe: () => unknown;
    tamper: () => void;
    seekTo: (t: number) => Promise<unknown>;
  }
}

let video: HTMLVideoElement;
let tampered = "";

window.run = async (sessionKey: string) => {
  const contentKey = toB64(randomKey());
  const bytes = new Uint8Array(await (await fetch("/test.mp4")).arrayBuffer());
  const file = new File([bytes as BlobPart], "test.mp4", { type: "video/mp4" });
  await fetch("/__setup", { method: "POST", body: JSON.stringify({ lesson: LESSON, contentKey, sessionKey }) });
  const manifest = await ingest(file, {
    lessonId: LESSON,
    key: contentKey,
    sign: async (ns) => Object.fromEntries(ns.map((n) => [String(n), `/__store/${n}`])),
    onProgress: (p) => { if (p === 1) log("progress done"); },
  });
  log("manifest", manifest.mime, manifest.duration, manifest.segments.length, "segments");

  const box = document.getElementById("box")!;
  video = document.getElementById("v") as HTMLVideoElement;
  const info = { session: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", key: sessionKey, manifest, label: "abd…@example.com · AAAAAA", beatEvery: 5 };
  new Watermark(box, info.label, (why) => { tampered = why; log("TAMPER", why); }).start();
  let fatal = "";
  const stream = new LearnStream(video, LESSON, info, { onFatal: (_w, m) => { fatal = m; log("FATAL", m); } });
  await stream.start();
  video.muted = true;
  await video.play();
  return { mime: manifest.mime, duration: manifest.duration, segs: manifest.segments.map((s) => [s.n, +s.start.toFixed(2), +s.dur.toFixed(2), s.bytes]), fatal };
};

window.probe = () => ({
  t: video.currentTime,
  paused: video.paused,
  ended: video.ended,
  rs: video.readyState,
  dur: video.duration,
  frames: video.getVideoPlaybackQuality().totalVideoFrames,
  dropped: video.getVideoPlaybackQuality().droppedVideoFrames,
  buffered: Array.from({ length: video.buffered.length }, (_, i) => [+video.buffered.start(i).toFixed(2), +video.buffered.end(i).toFixed(2)]),
  src: video.currentSrc,
  tampered,
  err: video.error?.message ?? null,
});
window.tamper = () => document.querySelector<HTMLElement>('[data-wm="layer"]')!.remove();
window.seekTo = async (t: number) => {
  video.currentTime = t;
  await new Promise((r) => video.addEventListener("seeked", r, { once: true }));
  return t;
};
