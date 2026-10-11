// «الكي» on the GPU (WebGL2), like Premiere's Ultra Key and Luma Key: a frame comes back with the keyed parts
// see-through, for the render to draw over what is under the clip (the preview and the export alike).
// Chroma: the formulas of key-math.ts (trained on a thousand shots in tests/editor/key-training.test.ts), line for
// line — the colour evened out over 5 taps, the screen found by its hue, its saturation and its colour strength
// against the screen's (so its shadows still go and a dark shirt stays), the clean-up («تنظيف الخلفية» / «سد
// الفراغات»), the choke, and the despill (the screen's channel limited to the brightest of the other two).
// Luma: the matte from brightness.

import type { Keyer } from "@/lib/editor/model";
import { keyParams } from "@/lib/editor/key-math";

const VS = `#version 300 es
in vec2 p;
out vec2 uv;
void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 o;
uniform sampler2D tex;
uniform int mode;
uniform float keyH, keyS, keyC, hTol, hSoft, sLo, sSoft, cLo, cSoft, clip0, clip1, spill, choke;
uniform int lead;
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
float matte(vec2 at) {
  float a;
  if (mode == 0) {
    vec3 v = hsv(tap(at));
    float dh = abs(v.x - keyH);
    dh = min(dh, 1.0 - dh);
    float hueW = 1.0 - smoothstep(hTol, hTol + hSoft, dh);
    float satW = smoothstep(sLo - sSoft, sLo, v.y / keyS);
    float valW = smoothstep(0.035, 0.09, v.z) * smoothstep(cLo - cSoft, cLo, (v.y * v.z) / keyC);
    a = 1.0 - hueW * satW * valW;
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
  float a = matte(at);
  if (mode == 0 && choke > 0.0) {
    // the edge pulled in: toward the smallest matte around (up to 4 px)
    float r = max(1.0, floor(choke * 4.0 + 0.5));
    float m = min(min(matte(at + vec2(r, 0.0) * px), matte(at - vec2(r, 0.0) * px)), min(matte(at + vec2(0.0, r) * px), matte(at - vec2(0.0, r) * px)));
    a = a + (min(a, m) - a) * min(1.0, choke * 2.0);
  }
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
}
let G: Gl | null = null;
let failed = false;

function setup(): Gl | null {
  if (G || failed || typeof document === "undefined") return G;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, preserveDrawingBuffer: true, alpha: true });
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
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const u: Gl["u"] = {};
    for (const n of ["tex", "mode", "keyH", "keyS", "keyC", "hTol", "hSoft", "sLo", "sSoft", "cLo", "cSoft", "clip0", "clip1", "spill", "choke", "lead", "keyRgb", "soft", "lo", "hi", "inv", "show", "px"]) u[n] = gl.getUniformLocation(prog, n);
    G = { gl, canvas, u, tex };
  } catch (e) {
    console.warn("key-gl", e);
    failed = true;
  }
  return G;
}

const MAX_SIDE = 1920;

/** The frame keyed (a canvas to draw before the next call), or null when the GPU isn't there. */
export function keyFrame(img: CanvasImageSource, sw: number, sh: number, k: Keyer): HTMLCanvasElement | null {
  const g = setup();
  if (!g || !sw || !sh) return null;
  const { gl, canvas, u, tex } = g;
  const s = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * s)),
    h = Math.max(1, Math.round(sh * s));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  gl.viewport(0, 0, w, h);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img as TexImageSource);
  } catch {
    return null;
  }
  const P = keyParams(k);
  gl.uniform1i(u.tex, 0);
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
  gl.uniform1i(u.lead, P.lead);
  gl.uniform3f(u.keyRgb, P.rgb[0], P.rgb[1], P.rgb[2]);
  gl.uniform1f(u.soft, k.soft);
  gl.uniform1f(u.lo, k.low);
  gl.uniform1f(u.hi, k.high);
  gl.uniform1i(u.inv, k.invert ? 1 : 0);
  gl.uniform1i(u.show, k.show ? 1 : 0);
  gl.uniform2f(u.px, 1 / w, 1 / h);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  return canvas;
}
