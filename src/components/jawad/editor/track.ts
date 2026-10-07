// «تتبّع الماسك» and «ماسك ذكي» in the browser. The tracker follows what is inside a circle or rectangle window from
// the playhead to the clip's end — small grey frames, the patch under the window looked for around where it was
// (sum of differences), the patch slowly updated as the subject turns — and writes a motion point every 0.1 s; free,
// nothing leaves the device. The smart mask sends a few moments of the clip to SAM 3 (on the server) with the words
// of what to select, and turns each answer into an outline that changes shape from moment to moment.

import { postJson } from "@/lib/fetch";
import { alignTo, maskOutline } from "@/lib/editor/contour";
import { maskAt, NEW_MASK, SHAPE_POINTS, MAX_MASK_KEYS, type Mask, type Pt } from "@/lib/editor/grade";
import type { Clip } from "@/lib/editor/model";

const STEP_MS = 100;

/** A video's frames at given moments (source ms), each handed over drawn at `side` (longest side). */
async function eachFrame(url: string, times: number[], side: number, onFrame: (c: HTMLCanvasElement, i: number) => void | Promise<void>, signal?: AbortSignal) {
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
    const k = Math.min(1, side / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(v.videoWidth * k));
    c.height = Math.max(1, Math.round(v.videoHeight * k));
    const g = c.getContext("2d", { willReadFrequently: true })!;
    for (const [i, t] of times.entries()) {
      if (signal?.aborted) throw new DOMException("stopped", "AbortError");
      await new Promise<void>((ok) => {
        const done = () => {
          v.removeEventListener("seeked", done);
          ok();
        };
        v.addEventListener("seeked", done);
        v.currentTime = Math.max(0, t / 1000);
        setTimeout(done, 3000);
      });
      g.drawImage(v, 0, 0, c.width, c.height);
      await onFrame(c, i);
    }
  } finally {
    v.removeAttribute("src");
    v.load();
  }
}

/** A picture's or a video's single frame (pictures have one). */
async function imageCanvas(url: string, side: number) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  const k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

const grey = (c: HTMLCanvasElement) => {
  const d = c.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height).data;
  const out = new Float32Array(c.width * c.height);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114;
  return out;
};

/**
 * The window's subject followed from `fromT` (the clip's own ms) to the clip's end: motion points every 0.1 s.
 * `onStep` gets 0…1.
 */
export async function trackWindow(url: string, clip: Pick<Clip, "in" | "out" | "speed">, m: Mask, fromT: number, onStep: (f: number) => void, signal?: AbortSignal) {
  const len = (clip.out - clip.in) / clip.speed;
  const times: number[] = [];
  for (let t = Math.max(0, fromT); t <= len && times.length < MAX_MASK_KEYS; t += STEP_MS) times.push(Math.round(t));
  const SIDE = 240;
  let W = 0,
    H = 0;
  let tpl: Float32Array | null = null;
  let tw = 0,
    th = 0;
  let px = 0,
    py = 0;
  const keys: Mask["keys"] = [];
  await eachFrame(
    url,
    times.map((t) => clip.in + t * clip.speed),
    SIDE,
    (c, i) => {
      const f = grey(c);
      if (!tpl) {
        W = c.width;
        H = c.height;
        // the middle of the window (its edges are mostly background), 8–48 px
        tw = Math.round(Math.min(48, Math.max(8, m.w * W * 0.6)));
        th = Math.round(Math.min(48, Math.max(8, m.h * H * 0.6)));
        const at = maskAt(m, times[0]);
        const cx = at.x * W,
          cy = at.y * H;
        px = Math.round(cx - tw / 2);
        py = Math.round(cy - th / 2);
        tpl = new Float32Array(tw * th);
        for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) tpl[y * tw + x] = f[Math.min(H - 1, Math.max(0, py + y)) * W + Math.min(W - 1, Math.max(0, px + x))];
      } else {
        // looked for around where it was
        const R = Math.round(Math.max(6, Math.min(24, Math.max(tw, th) * 0.6)));
        let best = Infinity,
          bx = px,
          by = py;
        for (let dy = -R; dy <= R; dy++)
          for (let dx = -R; dx <= R; dx++) {
            const ox = px + dx,
              oy = py + dy;
            if (ox < 0 || oy < 0 || ox + tw > W || oy + th > H) continue;
            let s = 0;
            for (let y = 0; y < th && s < best; y += 2) for (let x = 0; x < tw; x += 2) s += Math.abs(f[(oy + y) * W + ox + x] - tpl[y * tw + x]);
            // a small pull to stay put (no jumping to a look-alike)
            s += (dx * dx + dy * dy) * 0.5;
            if (s < best) {
              best = s;
              bx = ox;
              by = oy;
            }
          }
        px = bx;
        py = by;
        // the subject turns and its light changes: the patch follows slowly
        for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) tpl[y * tw + x] = tpl[y * tw + x] * 0.85 + f[(py + y) * W + px + x] * 0.15;
      }
      keys.push({ t: times[i], x: +((px + tw / 2) / W).toFixed(4), y: +((py + th / 2) / H).toFixed(4) });
      onStep((i + 1) / times.length);
    },
    signal,
  );
  return keys;
}

/** The person's words → a window that is the subject's own outline (followed through the clip when `track`). */
export async function smartWindow(o: { projectId: string; url: string; kind: "video" | "image"; clip: Pick<Clip, "in" | "out" | "speed">; words: string; atT: number; track: boolean; near: Pt | null; onStep: (text: string) => void; signal?: AbortSignal }): Promise<Mask> {
  const len = (o.clip.out - o.clip.in) / o.clip.speed;
  // the moments: the playhead's alone, or across the clip (every 0.5 s, up to 40; more often in short clips)
  const times: number[] = [];
  if (!o.track || o.kind === "image") times.push(Math.round(Math.min(len, Math.max(0, o.atT))));
  else {
    const n = Math.min(40, Math.max(2, Math.ceil(len / 500) + 1));
    for (let i = 0; i < n; i++) times.push(Math.round((len * i) / (n - 1)));
  }
  const jpegs: string[] = [];
  o.onStep("أقرأ لقطات المقطع…");
  if (o.kind === "image") jpegs.push((await imageCanvas(o.url, 512)).toDataURL("image/jpeg", 0.85).split(",")[1]);
  else await eachFrame(o.url, times.map((t) => o.clip.in + t * o.clip.speed), 512, (c) => void jpegs.push(c.toDataURL("image/jpeg", 0.85).split(",")[1]), o.signal);

  const shapes: Mask["shapes"] = [];
  let concept = "";
  let near = o.near;
  for (let i = 0; i < jpegs.length; i += 8) {
    if (o.signal?.aborted) throw new DOMException("stopped", "AbortError");
    o.onStep(jpegs.length > 1 ? `أحدد «${o.words}» ${Math.round((i / jpegs.length) * 100)}٪…` : `أحدد «${o.words}»…`);
    const r = await postJson<{ concept: string; masks: ({ w: number; h: number; data: string; score: number | null }[] | null)[] }>(`/api/jawad/editor/projects/${o.projectId}`, { action: "smart_mask", prompt: o.words, concept, frames: jpegs.slice(i, i + 8) });
    concept = r.concept;
    r.masks.forEach((list, j) => {
      // every match SAM found: the one nearest the subject a moment before (the first: the biggest)
      let pick: ReturnType<typeof maskOutline> = null;
      for (const mk of list ?? []) {
        const bytes = Uint8Array.from(atob(mk.data), (ch) => ch.charCodeAt(0));
        const out = maskOutline(bytes, mk.w, mk.h, SHAPE_POINTS, near);
        if (!out) continue;
        const d = (x: NonNullable<typeof out>) => (near ? Math.hypot(x.centre.x - near.x, x.centre.y - near.y) : -x.area);
        if (!pick || d(out) < d(pick)) pick = out;
      }
      if (!pick) return;
      const prev = shapes[shapes.length - 1]?.points;
      shapes.push({ t: times[i + j] ?? times[0], points: prev ? alignTo(pick.points, prev) : pick.points });
      near = pick.centre;
    });
  }
  if (!shapes.length) throw new Error(`ما لقيت «${o.words}» في المقطع. جرّب كلمة ثانية أو أوضح.`);
  const first = shapes[0].points;
  const cx = first.reduce((s, p) => s + p.x, 0) / first.length;
  const cy = first.reduce((s, p) => s + p.y, 0) / first.length;
  return { ...NEW_MASK, kind: "path", x: cx, y: cy, feather: 0.12, points: first, shapes: shapes.length > 1 ? shapes : [] };
}
