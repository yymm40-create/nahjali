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

export class SceneHost {
  private frameEl: HTMLIFrameElement;
  private booted: Promise<void>;
  private waits = new Map<number, { ok: (v: ImageBitmap) => void; no: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private loading: { ok: (v: SceneInfo) => void; no: (e: Error) => void } | null = null;
  private seq = 0;
  private listener: (e: MessageEvent) => void;
  w = 0;
  h = 0;
  fps = 30;

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
      const m = (e.data ?? {}) as { type?: string; id?: number; bitmap?: ImageBitmap; message?: string; where?: string; t?: number; stack?: string } & Partial<SceneInfo>;
      if (m.type === "boot") return boot();
      if (m.type === "ready" && this.loading) {
        this.loading.ok({ duration: Number(m.duration) || 0, cues: m.cues ?? [], blur: Number(m.blur) || 0, bpm: Number(m.bpm) || 0, title: String(m.title ?? "") });
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
        if (m.id !== undefined && this.waits.has(m.id)) {
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
  async load(code: string, o: { w: number; h: number; fps?: number; assets?: { id: string; bitmap: ImageBitmap }[]; fonts?: SceneFont[] }): Promise<SceneInfo> {
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
      this.post({ type: "load", code, w: o.w, h: o.h, fps: this.fps, assets: o.assets ?? [], fonts: o.fonts ?? [] });
    });
  }

  /** The frame at t seconds (scale ≤ 1 for previews; sub sub-frames across the shutter for motion blur). */
  frame(t: number, o: { scale?: number; sub?: number; shutter?: number } = {}): Promise<ImageBitmap> {
    const id = ++this.seq;
    return new Promise<ImageBitmap>((ok, no) => {
      const timer = setTimeout(() => {
        this.waits.delete(id);
        no(new SceneError(`الفريم عند ${t.toFixed(2)} ث أخذ أكثر من ٢٠ ثانية (المشهد ثقيل جدًا).`, "frame", t));
      }, 20_000);
      this.waits.set(id, { ok, no, timer });
      this.post({ type: "frame", id, t, scale: o.scale ?? 1, sub: o.sub ?? 1, shutter: o.shutter ?? 0, fps: this.fps });
    });
  }

  destroy() {
    window.removeEventListener("message", this.listener);
    for (const w of this.waits.values()) clearTimeout(w.timer);
    this.waits.clear();
    this.frameEl.remove();
  }
}
