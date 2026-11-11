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
  const r = await faceTrack(url, fromMs, toMs, 5);
  const found = r.samples.map((s) => s.face);
  if (!found.length) return null;
  return { face: { x: median(found.map((f) => f.x)), y: median(found.map((f) => f.y)), w: median(found.map((f) => f.w)), h: median(found.map((f) => f.h)) }, width: r.width, height: r.height };
}

/**
 * The face at `n` moments spread over `fromMs`–`toMs` (source time): the biggest face each time, as it moves — what
 * «مختبر الموشن» keeps the face framed with when it builds a piece on the person's video. Moments with no face are left out.
 */
export async function faceTrack(url: string, fromMs: number, toMs: number, n: number): Promise<{ samples: { ms: number; face: FaceBox }[]; width: number; height: number }> {
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
    const samples: { ms: number; face: FaceBox }[] = [];
    const span = Math.max(0, toMs - fromMs);
    for (let i = 0; i < n; i++) {
      const ms = fromMs + (span * (i + 0.5)) / n;
      await new Promise<void>((ok) => {
        const done = () => {
          v.removeEventListener("seeked", done);
          ok();
        };
        v.addEventListener("seeked", done);
        v.currentTime = Math.min(Math.max(0, ms / 1000), Math.max(0, v.duration - 0.05));
        setTimeout(done, 3000);
      });
      g.drawImage(v, 0, 0, c.width, c.height);
      const r = det.detect(c);
      const best = r.detections.map((d) => d.boundingBox).filter((b): b is NonNullable<typeof b> => !!b).sort((a, b) => b.width * b.height - a.width * a.height)[0];
      if (best) samples.push({ ms: Math.round(ms), face: { x: (best.originX + best.width / 2) / c.width, y: (best.originY + best.height / 2) / c.height, w: best.width / c.width, h: best.height / c.height } });
    }
    return { samples, width: v.videoWidth, height: v.videoHeight };
  } finally {
    v.removeAttribute("src");
    v.load();
  }
}

/** The biggest face on each of these pictures (fractions of the picture), or null where there is none. */
export async function facesIn(images: ImageBitmap[]): Promise<(FaceBox | null)[]> {
  if (!images.length) return [];
  const det = await detector();
  return images.map((b) => {
    const r = det.detect(b);
    const best = r.detections.map((d) => d.boundingBox).filter((x): x is NonNullable<typeof x> => !!x).sort((a, c) => c.width * c.height - a.width * a.height)[0];
    return best ? { x: (best.originX + best.width / 2) / b.width, y: (best.originY + best.height / 2) / b.height, w: best.width / b.width, h: best.height / b.height } : null;
  });
}

/**
 * The face in a picture (pixels of that picture), or null — «كاظم»'s ready designs frame a person by his face. The
 * whole picture is looked at first; a face too small for that (a full-body photo, a wide one) is looked for again in
 * overlapping windows, from big to small, and the surest one of the first size that finds any is kept.
 */
export async function faceInPicture(pic: ImageBitmap): Promise<{ x: number; y: number; w: number; h: number } | null> {
  try {
    const det = await detector();
    type Found = { x: number; y: number; w: number; h: number; score: number };
    const read = (src: ImageBitmap | HTMLCanvasElement, ox = 0, oy = 0, k = 1): Found[] =>
      det.detect(src).detections.flatMap((d) => (d.boundingBox ? [{ x: ox + d.boundingBox.originX * k, y: oy + d.boundingBox.originY * k, w: d.boundingBox.width * k, h: d.boundingBox.height * k, score: d.categories[0]?.score ?? 0 }] : []));
    const pick = (list: Found[]) => list.filter((f) => f.score >= 0.5).sort((a, b) => b.score * b.w * b.h - a.score * a.w * a.h)[0] ?? null;
    const whole = pick(read(pic));
    if (whole) return whole;
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const x = c.getContext("2d")!;
    const short = Math.min(pic.width, pic.height);
    for (const share of [1, 0.6, 0.38, 0.24]) {
      const side = short * share, step = side / 2, k = side / 512;
      const found: Found[] = [];
      for (let ty = 0; ty <= pic.height - side + 1; ty += step) {
        for (let tx = 0; tx <= pic.width - side + 1; tx += step) {
          x.clearRect(0, 0, 512, 512);
          x.drawImage(pic, tx, ty, side, side, 0, 0, 512, 512);
          found.push(...read(c, tx, ty, k));
        }
      }
      const best = pick(found.filter((f) => f.score >= 0.6));
      if (best) return best;
    }
    return null;
  } catch {
    return null;
  }
}
