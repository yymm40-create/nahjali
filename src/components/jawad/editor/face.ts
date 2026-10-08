// «المربع الصغير» and «فوق كلامي ثلاثي الأبعاد»: where the face is in a talking video, found by MediaPipe's face
// detector right in the browser (nothing uploaded, nothing paid; the engine is the one «عزل الشخص» already loads).
// A few moments of the clip are looked at and the middle answer kept, so a turn of the head doesn't move it.

import type { FaceDetector } from "@mediapipe/tasks-vision";
import type { FaceBox } from "@/lib/editor/talk-motion";

const VERSION = "1.0.1";
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite";

let loading: Promise<FaceDetector> | null = null;
function detector(): Promise<FaceDetector> {
  loading ??= (async () => {
    const { FilesetResolver, FaceDetector } = await import("@mediapipe/tasks-vision");
    const files = await FilesetResolver.forVisionTasks(WASM);
    const make = (delegate: "GPU" | "CPU") => FaceDetector.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: "IMAGE", minDetectionConfidence: 0.5 });
    try {
      return await make("GPU");
    } catch {
      return await make("CPU");
    }
  })();
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];

/**
 * The face in a video (fractions of the source picture) at up to five moments between `fromMs` and `toMs` (source
 * time), the biggest face each time, the middle of them kept; with the source's size. Null when no face is found.
 */
export async function faceIn(url: string, fromMs: number, toMs: number): Promise<{ face: FaceBox; width: number; height: number } | null> {
  const det = await detector();
  const v = document.createElement("video");
  v.crossOrigin = "anonymous";
  v.muted = true;
  v.preload = "auto";
  v.playsInline = true;
  v.src = url;
  try {
    await new Promise<void>((ok, bad) => {
      v.onloadeddata = () => ok();
      v.onerror = () => bad(new Error("ما قدرنا نقرأ الفيديو."));
      setTimeout(() => bad(new Error("الفيديو ما فتح.")), 20_000);
    });
    const c = document.createElement("canvas");
    const k = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
    c.width = Math.max(1, Math.round(v.videoWidth * k));
    c.height = Math.max(1, Math.round(v.videoHeight * k));
    const g = c.getContext("2d")!;
    const found: FaceBox[] = [];
    const span = Math.max(0, toMs - fromMs);
    for (let i = 0; i < 5; i++) {
      const t = (fromMs + (span * (i + 0.5)) / 5) / 1000;
      await new Promise<void>((ok) => {
        const done = () => {
          v.removeEventListener("seeked", done);
          ok();
        };
        v.addEventListener("seeked", done);
        v.currentTime = Math.min(Math.max(0, t), Math.max(0, v.duration - 0.05));
        setTimeout(done, 3000);
      });
      g.drawImage(v, 0, 0, c.width, c.height);
      const r = det.detect(c);
      const best = r.detections.map((d) => d.boundingBox).filter((b): b is NonNullable<typeof b> => !!b).sort((a, b) => b.width * b.height - a.width * a.height)[0];
      if (best) found.push({ x: (best.originX + best.width / 2) / c.width, y: (best.originY + best.height / 2) / c.height, w: best.width / c.width, h: best.height / c.height });
    }
    if (!found.length) return null;
    return { face: { x: median(found.map((f) => f.x)), y: median(found.map((f) => f.y)), w: median(found.map((f) => f.w)), h: median(found.map((f) => f.h)) }, width: v.videoWidth, height: v.videoHeight };
  } finally {
    v.removeAttribute("src");
    v.load();
  }
}
