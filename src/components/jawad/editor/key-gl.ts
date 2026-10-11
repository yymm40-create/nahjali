// «الكي» on the GPU (WebGL2), like Premiere's Ultra Key and Luma Key: a frame comes back with the keyed parts
// see-through, for the render to draw over what is under the clip (the preview and the export alike).
// Chroma: the formulas of key-math.ts (trained on a thousand shots in tests/editor/key-training.test.ts), line for
// line — the colour evened out over 5 taps, the screen found by its hue, its saturation and its colour strength
// against the screen's (so its shadows still go and a dark shirt stays), the hair edge from the colour difference
// («حواف الشعر»), the clean-up («تنظيف الخلفية» / «سد الفراغات»), the choke, and the despill (the screen's channel
// limited to the brightest of the other two). Luma: the matte from brightness.
// Two passes: the matte is drawn first into a texture — pulled toward the clip's previous frame's matte where the
// change is small («ثبات ضد الرجفة», the previous matte kept per clip, ping-pong) — then the picture is composited
// with it onto the canvas.

import type { Keyer } from "@/lib/editor/model";
import { keyParams } from "@/lib/editor/key-math";
import { glPower } from "./perf-bench";

const VS = `#version 300 es
in vec2 p;
out vec2 uv;
void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 o;
uniform sampler2D tex;
uniform sampler2D mat;
uniform sampler2D prev;
uniform int pass;
uniform int mode;
uniform float keyH, keyS, keyC, hTol, hSoft, sLo, sSoft, cLo, cSoft, clip0, clip1, spill, choke, hair, diff, steady;
uniform int lead;
uniform bool hasPrev;
uniform vec3 keyRgb;
uniform float soft, lo, hi;
uniform bool inv, show;
uniform vec2 px;

vec3 hsv(vec3 c) {
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float d = mx - mn;
  float h = 0.0;
  if (d > 1e-6) {
    if (mx == c.r) h = mod((c.g - c.b) / d, 6.0);
    else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
    h /= 6.0;
    if (h < 0.0) h += 1.0;
  }
  return vec3(h, mx > 1e-6 ? d / mx : 0.0, mx);
}
vec3 tap(vec2 at) {
  return texture(tex, at).rgb * 0.4 + (texture(tex, at + vec2(px.x, 0.0)).rgb + texture(tex, at - vec2(px.x, 0.0)).rgb + texture(tex, at + vec2(0.0, px.y)).rgb + texture(tex, at - vec2(0.0, px.y)).rgb) * 0.15;
}
float hairAlpha(vec3 c, vec3 v) {
  if (hair <= 0.0) return 0.0;
  float other = lead == 0 ? max(c.g, c.b) : lead == 1 ? max(c.r, c.b) : max(c.r, c.g);
  float ld = (lead == 0 ? c.r : lead == 1 ? c.g : c.b) - other;
  float cd = clamp(1.0 - ld / diff, 0.0, 1.0);
  float drop = smoothstep(0.04, 0.25, 1.0 - v.y / keyS);
  return cd * drop * smoothstep(0.035, 0.09, v.z);
}
float matte(vec2 at) {
  float a;
  if (mode == 0) {
    vec3 c = tap(at);
    vec3 v = hsv(c);
    float dh = abs(v.x - keyH);
    dh = min(dh, 1.0 - dh);
    float hueW = 1.0 - smoothstep(hTol, hTol + hSoft, dh);
    float satW = smoothstep(sLo - sSoft, sLo, v.y / keyS);
    float valW = smoothstep(0.035, 0.09, v.z) * smoothstep(cLo - cSoft, cLo, (v.y * v.z) / keyC);
    float core = 1.0 - hueW * satW * valW;
    a = (hair > 0.0 && core < 0.98) ? core + (max(core, hairAlpha(c, v)) - core) * hair : core;
    a = clamp((a - clip0) / max(0.02, clip1 - clip0), 0.0, 1.0);
  } else {
    float y = dot(texture(tex, at).rgb, vec3(0.2126, 0.7152, 0.0722));
    float h = max(hi, lo + 0.002);
    float s = soft * 0.15;
    a = smoothstep(lo - s, h + s, y);
    if (inv) a = 1.0 - a;
  }
  return a;
}
vec3 despill(vec3 c) {
  if (spill <= 0.0) return c;
  if (lead >= 0) {
    float limit = lead == 0 ? max(c.g, c.b) : lead == 1 ? max(c.r, c.b) : max(c.r, c.g);
    float v = lead == 0 ? c.r : lead == 1 ? c.g : c.b;
    float over = v - limit;
    if (over > 0.0) {
      v -= over * spill;
      if (lead == 0) c.r = v; else if (lead == 1) c.g = v; else c.b = v;
    }
    return c;
  }
  float y = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float ky = dot(keyRgb, vec3(0.2126, 0.7152, 0.0722));
  vec2 k = vec2((keyRgb.b - ky) / 1.8556, (keyRgb.r - ky) / 1.5748);
  if (length(k) < 0.02) return c;
  k = normalize(k);
  vec2 cc = vec2((c.b - y) / 1.8556, (c.r - y) / 1.5748);
  float along = dot(cc, k);
  if (along <= 0.0) return c;
  cc -= k * along * spill;
  float r = y + 1.5748 * cc.y;
  float b = y + 1.8556 * cc.x;
  float g = (y - 0.2126 * r - 0.0722 * b) / 0.7152;
  return clamp(vec3(r, g, b), 0.0, 1.0);
}
void main() {
  vec2 at = vec2(uv.x, 1.0 - uv.y);
  if (pass == 0) {
    // the matte, into its texture (the same orientation as the picture)
    float a = matte(at);
    if (mode == 0 && choke > 0.0) {
      // the edge pulled in: toward the smallest matte around (up to 4 px)
      float r = max(1.0, floor(choke * 4.0 + 0.5));
      float m = min(min(matte(at + vec2(r, 0.0) * px), matte(at - vec2(r, 0.0) * px)), min(matte(at + vec2(0.0, r) * px), matte(at - vec2(0.0, r) * px)));
      a = a + (min(a, m) - a) * min(1.0, choke * 2.0);
    }
    if (hasPrev && steady > 0.0) {
      // «ثبات»: toward the previous frame's matte where the change is small (noise), untouched where it is big (a move)
      float d = texture(prev, at).r - a;
      float ad = abs(d);
      if (ad < 0.45) a += d * steady * 0.8 * (1.0 - smoothstep(0.12, 0.45, ad));
    }
    o = vec4(a, 0.0, 0.0, 1.0);
    return;
  }
  float a = texture(mat, at).r;
  if (show) { o = vec4(vec3(a), 1.0); return; }
  vec3 c = texture(tex, at).rgb;
  if (mode == 0) c = despill(c);
  o = vec4(c * a, a);
}`;

interface Gl {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  u: Record<string, WebGLUniformLocation | null>;
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  /** a matte texture not owned by any clip (the pass-0 target when the clip keeps none, and the swap partner) */
  spare: Tex;
}
interface Tex {
  tex: WebGLTexture;
  w: number;
  h: number;
}
/** each clip's last matte (its texture, its size, the moment it was for) */
interface Kept extends Tex {
  ms: number;
  used: number;
}
let G: Gl | null = null;
let failed = false;
const kept = new Map<string, Kept>();
const KEEP_CLIPS = 6;
/** frames further apart than this (a seek, another clip) are not «the previous frame» */
const CONTINUOUS_MS = 130;

function makeTex(gl: WebGL2RenderingContext): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
function size(gl: WebGL2RenderingContext, t: Tex, w: number, h: number) {
  if (t.w === w && t.h === h) return;
  gl.bindTexture(gl.TEXTURE_2D, t.tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  t.w = w;
  t.h = h;
}

function setup(): Gl | null {
  if (G || failed || typeof document === "undefined") return G;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, preserveDrawingBuffer: true, alpha: true, powerPreference: glPower() });
    if (!gl) throw new Error("no webgl2");
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link");
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = makeTex(gl);
    const u: Gl["u"] = {};
    for (const n of ["tex", "mat", "prev", "pass", "mode", "keyH", "keyS", "keyC", "hTol", "hSoft", "sLo", "sSoft", "cLo", "cSoft", "clip0", "clip1", "spill", "choke", "hair", "diff", "steady", "lead", "hasPrev", "keyRgb", "soft", "lo", "hi", "inv", "show", "px"]) u[n] = gl.getUniformLocation(prog, n);
    gl.uniform1i(u.tex, 0);
    gl.uniform1i(u.mat, 1);
    gl.uniform1i(u.prev, 2);
    const fbo = gl.createFramebuffer()!;
    G = { gl, canvas, u, tex, fbo, spare: { tex: makeTex(gl), w: 0, h: 0 } };
  } catch (e) {
    console.warn("key-gl", e);
    failed = true;
  }
  return G;
}

/** Forgets the context (after the performance choice changed): the next frame makes a new one with the new power. */
export function resetKeyGl() {
  if (G) {
    try {
      G.gl.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      /* gone */
    }
  }
  G = null;
  failed = false;
  kept.clear();
}

const MAX_SIDE = 1920;

/**
 * The frame keyed (a canvas to draw before the next call), or null when the GPU isn't there. `cont` names the clip
 * and the moment, so the matte can lean on the clip's previous frame («ثبات»): without it, or after a jump, the
 * frame stands alone. `maxSide` caps the working size (the preview under a lower «الأداء» share).
 */
export function keyFrame(img: CanvasImageSource, sw: number, sh: number, k: Keyer, cont?: { id: string; ms: number } | null, maxSide = MAX_SIDE): HTMLCanvasElement | null {
  const g = setup();
  if (!g || !sw || !sh) return null;
  const { gl, canvas, u, tex, fbo } = g;
  const s = Math.min(1, Math.min(MAX_SIDE, maxSide) / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * s)),
    h = Math.max(1, Math.round(sh * s));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img as TexImageSource);
  } catch {
    return null;
  }
  const P = keyParams(k);
  gl.uniform1i(u.mode, k.kind === "luma" ? 1 : 0);
  gl.uniform1f(u.keyH, P.hue);
  gl.uniform1f(u.keyS, P.sat);
  gl.uniform1f(u.keyC, P.chroma);
  gl.uniform1f(u.hTol, P.hTol);
  gl.uniform1f(u.hSoft, P.hSoft);
  gl.uniform1f(u.sLo, P.sLo);
  gl.uniform1f(u.sSoft, P.sSoft);
  gl.uniform1f(u.cLo, P.cLo);
  gl.uniform1f(u.cSoft, P.cSoft);
  gl.uniform1f(u.clip0, P.clip0);
  gl.uniform1f(u.clip1, P.clip1);
  gl.uniform1f(u.spill, P.spill);
  gl.uniform1f(u.choke, P.choke);
  gl.uniform1f(u.hair, P.hair);
  gl.uniform1f(u.diff, P.diff);
  gl.uniform1f(u.steady, P.steady);
  gl.uniform1i(u.lead, P.lead);
  gl.uniform3f(u.keyRgb, P.rgb[0], P.rgb[1], P.rgb[2]);
  gl.uniform1f(u.soft, k.soft);
  gl.uniform1f(u.lo, k.low);
  gl.uniform1f(u.hi, k.high);
  gl.uniform1i(u.inv, k.invert ? 1 : 0);
  gl.uniform1i(u.show, k.show ? 1 : 0);
  gl.uniform2f(u.px, 1 / w, 1 / h);

  // the previous matte of this clip, when this is the frame after it
  const now = performance.now();
  const had = cont ? kept.get(cont.id) : undefined;
  const prev = had && had.w === w && had.h === h && Math.abs(cont!.ms - had.ms) <= CONTINUOUS_MS && cont!.ms !== had.ms ? had : null;
  // pass 0: the matte into a texture (the spare one, so the previous matte can still be read)
  const target = g.spare;
  size(gl, target, w, h);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.tex, 0);
  gl.viewport(0, 0, w, h);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, (prev ?? target).tex);
  gl.uniform1i(u.hasPrev, prev ? 1 : 0);
  gl.uniform1i(u.pass, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  // pass 1: the picture with the matte, onto the canvas
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, w, h);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, target.tex);
  gl.uniform1i(u.pass, 1);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.activeTexture(gl.TEXTURE0);

  // the matte just made becomes the clip's kept one; the clip's old texture (or a fresh one) becomes the spare
  if (cont) {
    if (had) {
      g.spare = { tex: had.tex, w: had.w, h: had.h };
      kept.set(cont.id, { tex: target.tex, w, h, ms: cont.ms, used: now });
    } else {
      if (kept.size >= KEEP_CLIPS) {
        let oldest: [string, Kept] | null = null;
        for (const e of kept) if (!oldest || e[1].used < oldest[1].used) oldest = e;
        if (oldest) {
          kept.delete(oldest[0]);
          g.spare = { tex: oldest[1].tex, w: oldest[1].w, h: oldest[1].h };
        }
      } else g.spare = { tex: makeTex(gl), w: 0, h: 0 };
      kept.set(cont.id, { tex: target.tex, w, h, ms: cont.ms, used: now });
    }
  }
  return canvas;
}
