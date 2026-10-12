// A recording canvas for running scene programs in Node: every call is accepted and logged (so a frame can be
// compared with itself), measureText is estimated from the font size, getImageData returns a filled disc (so
// particle sampling finds points). Used to prove a scene loads, draws at many times and is deterministic.
import vm from "node:vm";
import { SCENE_KIT_JS } from "@/lib/editor/scene/kit";

type Rec = string[];
function fakeCtx(w: number, h: number, rec: { log: Rec }) {
  const log = { push: (x: string) => rec.log.push(x) };
  const canvas: Record<string, unknown> = { width: w, height: h };
  const state: Record<string, unknown> = { font: "700 40px x", globalAlpha: 1, filter: "none" };
  const gradient = () => ({ addColorStop: (o: number, c: string) => log.push(`stop ${o} ${c}`) });
  const target: Record<string, unknown> = {
    canvas,
    measureText: (s: string) => ({ width: String(s).length * (Number(String(state.font).match(/(\d+)px/)?.[1] ?? 40) * 0.55) }),
    createLinearGradient: (...a: number[]) => (log.push(`lg ${a.map((x) => x.toFixed(2))}`), gradient()),
    createRadialGradient: (...a: number[]) => (log.push(`rg ${a.map((x) => x.toFixed(2))}`), gradient()),
    createPattern: () => ({}),
    createImageData: (iw: number, ih: number) => ({ width: iw, height: ih, data: new Uint8ClampedArray(iw * ih * 4) }),
    getImageData: (_x: number, _y: number, iw: number, ih: number) => {
      const d = new Uint8ClampedArray(iw * ih * 4);
      for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) if ((x - iw / 2) ** 2 + (y - ih / 2) ** 2 < (Math.min(iw, ih) * 0.3) ** 2) d[(y * iw + x) * 4 + 3] = 255;
      return { width: iw, height: ih, data: d };
    },
    setLineDash: () => {},
  };
  return new Proxy(target, {
    get(t, k: string) {
      if (k in t) return t[k];
      if (k in state) return state[k];
      return (...a: unknown[]) => {
        log.push(`${k}(${a.map((x) => (typeof x === "number" ? x.toFixed(2) : typeof x === "string" ? x : typeof x)).join(",")})`);
      };
    },
    set(_t, k: string, v) {
      state[k] = v;
      log.push(`${k}=${typeof v === "number" ? v.toFixed(3) : String(v)}`);
      return true;
    },
  });
}

export interface Run {
  duration: number;
  cues: { t: number; sfx: string; vol?: number }[];
  frame: (t: number) => string[];
}

/** Loads the kit and a scene program in a fresh VM context (trusted test code only), runs setup, returns a frame drawer. */
export function runScene(code: string, w = 1080, h = 1920): Run {
  const rec = { log: [] as Rec };
  const mk = (cw: number, ch: number) => {
    const c: Record<string, unknown> = { width: cw, height: ch };
    c.getContext = () => fakeCtx(cw, ch, rec);
    return c;
  };
  const context: Record<string, unknown> = {
    OffscreenCanvas: function (this: Record<string, unknown>, cw: number, ch: number) {
      Object.assign(this, mk(cw, ch));
    },
    document: { createElement: () => mk(w, h) },
    module: { exports: {} },
    Math,
    console,
  };
  vm.createContext(context);
  vm.runInContext(SCENE_KIT_JS, context, { timeout: 2000 });
  const K = (context.module as { exports: Record<string, unknown> }).exports;
  const ctx = fakeCtx(w, h, rec);
  Object.assign(K, { W: w, H: h, ctx, canvas: { width: w, height: h }, glCanvas: {}, fonts: { head: '"Head"', body: '"Body"' }, assets: {}, fps: 30 });
  let def: Record<string, unknown> | null = null;
  context.__scene = (d: Record<string, unknown>) => (def = d);
  context.__K = K;
  context.__code = code;
  vm.runInContext(`new Function("scene","K", __code)(__scene, __K)`, context, { timeout: 2000 });
  if (!def) throw new Error("scene() was not called");
  const d = def as { duration: number; cues?: Run["cues"]; setup?: (k: unknown, c: unknown) => void; draw: (k: unknown, t: number, c: unknown) => void };
  d.setup?.(K, ctx);
  return {
    duration: d.duration,
    cues: d.cues ?? [],
    frame: (t: number) => {
      rec.log = [];
      d.draw(K, t, ctx);
      return rec.log;
    },
  };
}
