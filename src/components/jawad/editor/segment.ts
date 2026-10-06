// «الممنتج الذكي» — the person in a picture, found by MediaPipe's selfie segmenter (Apache-2.0) right in the browser:
// nothing is uploaded and nothing is paid. Its engine (~11 MB) and model (~250 KB) load the first time someone uses
// «عزل الشخص», then the browser keeps them.

import type { ImageSegmenter } from "@mediapipe/tasks-vision";

const VERSION = "1.0.1";
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";
/** The longest side the picture is looked at (the mask is smoothed when it is stretched back). */
const SIZE = 320;

let loading: Promise<ImageSegmenter> | null = null;

/** The segmenter, loaded once per page (the graphics card when the browser allows it, else the processor). */
export function loadSegmenter(): Promise<ImageSegmenter> {
  loading ??= (async () => {
    const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision");
    const files = await FilesetResolver.forVisionTasks(WASM);
    const make = (delegate: "GPU" | "CPU") =>
      ImageSegmenter.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: "IMAGE", outputConfidenceMasks: true, outputCategoryMask: false });
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

/** Turns pictures into person masks (white where the person is, soft at the edges); one per clip at a time. */
export class Masker {
  private seg: ImageSegmenter | null = null;
  private input = document.createElement("canvas");
  private masks = new Map<string, HTMLCanvasElement>();
  failed = false;

  constructor(private onReady?: () => void) {}

  get ready() {
    return !!this.seg;
  }

  /** Starts loading (once); `onReady` runs when it can be used. */
  load() {
    if (this.seg || this.failed) return Promise.resolve(this.seg);
    return loadSegmenter().then(
      (s) => {
        this.seg = s;
        this.onReady?.();
        return s;
      },
      () => {
        this.failed = true;
        return null;
      },
    );
  }

  /** The person mask of a picture (null until the segmenter is ready). */
  maskOf(key: string, img: CanvasImageSource, width: number, height: number): HTMLCanvasElement | null {
    if (!this.seg || !width || !height) return null;
    const k = SIZE / Math.max(width, height);
    const w = Math.max(16, Math.round(width * k));
    const h = Math.max(16, Math.round(height * k));
    if (this.input.width !== w || this.input.height !== h) {
      this.input.width = w;
      this.input.height = h;
    }
    const ictx = this.input.getContext("2d", { willReadFrequently: false })!;
    ictx.drawImage(img, 0, 0, w, h);
    const result = this.seg.segment(this.input);
    try {
      const masks = result.confidenceMasks ?? [];
      if (!masks.length) return null;
      // one mask: the person; several (multiclass models): the first is the background
      const m = masks[0];
      const person = masks.length === 1;
      const data = m.getAsFloat32Array();
      let out = this.masks.get(key);
      if (!out) {
        out = document.createElement("canvas");
        this.masks.set(key, out);
      }
      if (out.width !== m.width || out.height !== m.height) {
        out.width = m.width;
        out.height = m.height;
      }
      const octx = out.getContext("2d")!;
      const img2 = octx.createImageData(m.width, m.height);
      for (let i = 0; i < data.length; i++) {
        const v = person ? data[i] : 1 - data[i];
        // a firm but soft edge
        const a = v <= 0.35 ? 0 : v >= 0.85 ? 1 : (v - 0.35) * 2;
        img2.data[i * 4] = 255;
        img2.data[i * 4 + 1] = 255;
        img2.data[i * 4 + 2] = 255;
        img2.data[i * 4 + 3] = Math.round(a * a * (3 - 2 * a) * 255);
      }
      octx.putImageData(img2, 0, 0);
      return out;
    } finally {
      result.close();
    }
  }

  forget(key: string) {
    this.masks.delete(key);
  }
}
