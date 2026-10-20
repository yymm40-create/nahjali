// «مختبر الموشن» in the browser — the scene page in a sandboxed iframe (scripts only, no same-origin: the code
// حيدرة writes can't reach the site, the account or its storage; the page's content policy blocks the network but
// three.js and the fonts). The host loads a program with its pictures and fonts, and asks for any frame: the page
// draws it (with motion blur when asked) and hands back an ImageBitmap.

import { FONT_BY_ID } from "@/lib/editor/fonts";
import { sceneDoc } from "@/lib/editor/scene/runtime";

export interface SceneInfo {
  duration: number;
  cues: unknown[];
  blur: number;
  bpm: number;
  title: string;
  /** the scene writes its own soundtrack in code (sound(K, S)) */
  sound?: boolean;
  /** the editable values (every shown text and the main colours), with the scene's own value of each */
  params?: ScenePar[];
}
export interface ScenePar {
  id: string;
  label: string;
  type: "text" | "color";
  value: string;
}
export interface SceneFont {
  role: string;
  family: string;
  files: { url: string; weight: number; range?: string }[];
}
export class SceneError extends Error {
  constructor(
    message: string,
    public where: string,
    public t?: number,
    public stack2 = "",
  ) {
    super(message);
  }
}

const AR_RANGE = "U+0600-06FF, U+0750-077F, U+0870-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200C-200F";
const LATIN_RANGE = "U+0000-00FF, U+0131, U+0152-0153, U+2000-206F, U+20AC, U+2122, U+2190-2199";

/** A catalogue font as the scene page loads it: its Arabic files, and the Latin subset next to them. */
export function sceneFont(role: string, id: string): SceneFont | null {
  const f = FONT_BY_ID.get(id);
  if (!f) return null;
  const files = Object.entries(f.files).flatMap(([w, url]) => {
    const weight = Number(w);
    const out = [{ url: url!, weight, range: AR_RANGE }];
    if (url!.includes("/arabic-")) out.push({ url: url!.replace("/arabic-", "/latin-"), weight, range: LATIN_RANGE });
    return out;
  });
  return { role, family: `lab-${role}-${id}`, files };
}

/**
 * The owner's Higgsfield skill code, given to a scene that uses it (K.HFT = hf-tokens.js, K.HF = hf-motion.js): fetched
 * once from this site (public/editor/skills/, copied verbatim from config/editor/skills/higgsfield-motion/scripts/) and
 * run inside the sandboxed scene page before the program.
 */
let hfText: Promise<string[]> | null = null;
export function hfLibs(code: string): Promise<string[]> {
  if (!/\bK\.HFT?\b/.test(code)) return Promise.resolve([]);
  hfText ??= Promise.all(["/editor/skills/hf-tokens.js", "/editor/skills/hf-motion.js"].map((u) => fetch(u).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${u} ${r.status}`))))));
  return hfText.catch((e) => { hfText = null; throw e; });
}

export class SceneHost {
  private frameEl: HTMLIFrameElement;
  private booted: Promise<void>;
  private waits = new Map<number, { ok: (v: ImageBitmap) => void; no: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private loading: { ok: (v: SceneInfo) => void; no: (e: Error) => void } | null = null;
  private sounds = new Map<number, { ok: (v: { L: Float32Array; R: Float32Array } | null) => void; no: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private seq = 0;
  private listener: (e: MessageEvent) => void;
  w = 0;
  h = 0;
  fps = 30;
  /** the person's video, when the piece is built on it: its frame at t (decoded here, handed to the page with each frame) */
  video: ((t: number, scale: number) => Promise<ImageBitmap | null>) | null = null;
  /** «قص الشخص»: the person alone (alpha) at t, handed in with the frame too */
  person: ((t: number, scale: number) => Promise<ImageBitmap | null>) | null = null;

  constructor() {
    const el = document.createElement("iframe");
    el.setAttribute("sandbox", "allow-scripts");
    el.setAttribute("aria-hidden", "true");
    el.title = "مشهد الموشن";
    el.style.cssText = "position:fixed;left:-20000px;top:0;width:8px;height:8px;border:0;opacity:0;pointer-events:none";
    let boot: () => void = () => {};
    this.booted = new Promise((r) => (boot = r));
    this.listener = (e: MessageEvent) => {
      if (e.source !== el.contentWindow) return;
      const m = (e.data ?? {}) as { type?: string; id?: number; bitmap?: ImageBitmap; message?: string; where?: string; t?: number; stack?: string; none?: boolean; L?: Float32Array; R?: Float32Array } & Omit<Partial<SceneInfo>, "sound"> & { sound?: boolean; params?: ScenePar[] };
      if (m.type === "sound" && m.id !== undefined) {
        const w = this.sounds.get(m.id);
        if (w) {
          clearTimeout(w.timer);
          this.sounds.delete(m.id);
          w.ok(m.none || !m.L || !m.R ? null : { L: m.L, R: m.R });
        }
        return;
      }
      if (m.type === "boot") return boot();
      if (m.type === "ready" && this.loading) {
        this.loading.ok({ duration: Number(m.duration) || 0, cues: m.cues ?? [], blur: Number(m.blur) || 0, bpm: Number(m.bpm) || 0, title: String(m.title ?? ""), sound: Boolean(m.sound), params: Array.isArray(m.params) ? (m.params as ScenePar[]).slice(0, 16) : [] });
        this.loading = null;
        return;
      }
      if (m.type === "frame" && m.id !== undefined) {
        const w = this.waits.get(m.id);
        if (w && m.bitmap) {
          clearTimeout(w.timer);
          this.waits.delete(m.id);
          w.ok(m.bitmap);
        }
        return;
      }
      if (m.type === "error") {
        const err = new SceneError(String(m.message ?? "خطأ في المشهد"), String(m.where ?? ""), m.t, String(m.stack ?? ""));
        if (m.id !== undefined && this.sounds.has(m.id)) {
          const w = this.sounds.get(m.id)!;
          clearTimeout(w.timer);
          this.sounds.delete(m.id);
          w.no(err);
        } else if (m.id !== undefined && this.waits.has(m.id)) {
          const w = this.waits.get(m.id)!;
          clearTimeout(w.timer);
          this.waits.delete(m.id);
          w.no(err);
        } else if (this.loading) {
          this.loading.no(err);
          this.loading = null;
        } else
          for (const [id, w] of this.waits) {
            clearTimeout(w.timer);
            this.waits.delete(id);
            w.no(err);
          }
      }
    };
    window.addEventListener("message", this.listener);
    el.srcdoc = sceneDoc();
    document.body.appendChild(el);
    this.frameEl = el;
  }

  private post(m: Record<string, unknown>, transfer: Transferable[] = []) {
    this.frameEl.contentWindow?.postMessage(m, "*", transfer);
  }

  /** Loads a program (its pictures as bitmaps, its fonts by URL); resolves with what the scene says about itself. */
  async load(code: string, o: { w: number; h: number; fps?: number; assets?: { id: string; bitmap: ImageBitmap }[]; fonts?: SceneFont[]; voice?: { text: string; from: number; to: number }[]; footage?: Record<string, unknown> | null; params?: Record<string, string> }): Promise<SceneInfo> {
    await this.booted;
    this.w = o.w;
    this.h = o.h;
    this.fps = o.fps ?? 30;
    return new Promise<SceneInfo>((ok, no) => {
      const timer = setTimeout(() => {
        if (this.loading) {
          this.loading = null;
          no(new SceneError("المشهد ما جهز خلال دقيقة (setup ثقيل جدًا أو معلّق).", "load"));
        }
      }, 60_000);
      this.loading = { ok: (v) => (clearTimeout(timer), ok(v)), no: (e) => (clearTimeout(timer), no(e)) };
      // the bitmaps are copied (not transferred): the host keeps them for the next load
      void hfLibs(code)
        .then((libs) => this.post({ type: "load", code, w: o.w, h: o.h, fps: this.fps, assets: o.assets ?? [], fonts: o.fonts ?? [], libs, voice: o.voice ?? [], footage: o.footage ?? null, params: o.params ?? {} }))
        .catch((e) => this.loading?.no(new SceneError(`ما قدرت أحمّل أدوات مهارة Higgsfield (${e instanceof Error ? e.message : e}).`, "load")));
    });
  }

  /** The frame at t seconds (scale ≤ 1 for previews; sub sub-frames across the shutter for motion blur). */
  async frame(t: number, o: { scale?: number; sub?: number; shutter?: number } = {}): Promise<ImageBitmap> {
    const id = ++this.seq;
    // the person's video at this moment goes in with the request (transferred: the page closes the one before)
    const video = this.video ? await this.video(t, o.scale ?? 1).catch(() => null) : null;
    const person = this.person ? await this.person(t, o.scale ?? 1).catch(() => null) : null;
    return new Promise<ImageBitmap>((ok, no) => {
      const timer = setTimeout(() => {
        this.waits.delete(id);
        no(new SceneError(`الفريم عند ${t.toFixed(2)} ث أخذ أكثر من ٢٠ ثانية (المشهد ثقيل جدًا).`, "frame", t));
      }, 20_000);
      this.waits.set(id, { ok, no, timer });
      this.post({ type: "frame", id, t, scale: o.scale ?? 1, sub: o.sub ?? 1, shutter: o.shutter ?? 0, fps: this.fps, video, person }, [video, person].filter((x): x is ImageBitmap => Boolean(x)));
    });
  }

  /** The soundtrack the scene writes in code (48 kHz stereo), or null when it writes none. */
  sound(rate = 48000): Promise<{ L: Float32Array; R: Float32Array } | null> {
    const id = ++this.seq;
    return new Promise((ok, no) => {
      const timer = setTimeout(() => {
        this.sounds.delete(id);
        no(new SceneError("صوت المشهد أخذ أكثر من دقيقة.", "sound"));
      }, 60_000);
      this.sounds.set(id, { ok, no, timer });
      this.post({ type: "sound", id, rate });
    });
  }

  destroy() {
    window.removeEventListener("message", this.listener);
    for (const w of this.waits.values()) clearTimeout(w.timer);
    this.waits.clear();
    for (const w of this.sounds.values()) clearTimeout(w.timer);
    this.sounds.clear();
    this.frameEl.remove();
  }
}
