// «الكي» on the GPU (WebGL2), like Premiere's Ultra Key and Luma Key: a frame comes back with the keyed parts
// see-through, for the render to draw over what is under the clip (the preview and the export alike).
// Chroma: how far each pixel's colour (its Cb/Cr, so its brightness doesn't matter: shadows on a green screen still
// go) is from the key colour → the matte, softened, then choked (the edge pulled in), and the key colour's glow taken
// off what stays (its share along the key's direction removed, the brightness kept). Luma: the matte from brightness.

import type { Keyer } from "@/lib/editor/model";

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
uniform vec2 keyC;
uniform float tol, soft, spill, choke, lo, hi;
uniform bool inv, show;
uniform vec2 px;

vec3 ycc(vec3 c) {
  float y = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return vec3(y, (c.b - y) / 1.8556, (c.r - y) / 1.5748);
}
vec3 rgb(vec3 v) {
  float r = v.x + 1.5748 * v.z;
  float b = v.x + 1.8556 * v.y;
  float g = (v.x - 0.2126 * r - 0.0722 * b) / 0.7152;
  return vec3(r, g, b);
}
float matte(vec2 at) {
  vec3 c = texture(tex, at).rgb;
  vec3 v = ycc(c);
  float a;
  if (mode == 0) {
    float d = distance(v.yz, keyC);
    float t0 = tol * 0.35;
    a = smoothstep(t0, t0 + soft * 0.25 + 0.0005, d);
  } else {
    float h = max(hi, lo + 0.002);
    float s = soft * 0.15;
    a = smoothstep(lo - s, h + s, v.x);
  }
  return inv ? 1.0 - a : a;
}
void main() {
  vec2 at = vec2(uv.x, 1.0 - uv.y);
  float a = matte(at);
  if (choke > 0.0) {
    // the edge pulled in: the matte is the smallest around (up to 6 px)
    float r = choke * 6.0;
    a = min(a, min(min(matte(at + vec2(r, 0.0) * px), matte(at - vec2(r, 0.0) * px)), min(matte(at + vec2(0.0, r) * px), matte(at - vec2(0.0, r) * px))));
  }
  vec3 c = texture(tex, at).rgb;
  if (mode == 0 && spill > 0.0) {
    // the key colour's glow on what stays: its share along the key's direction taken off, brightness kept
    vec3 v = ycc(c);
    vec2 k = normalize(keyC + 1e-5);
    float along = dot(v.yz, k);
    if (along > 0.0) v.yz -= k * along * spill;
    c = clamp(rgb(v), 0.0, 1.0);
  }
  if (show) { o = vec4(vec3(a), 1.0); return; }
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
    for (const n of ["tex", "mode", "keyC", "tol", "soft", "spill", "choke", "lo", "hi", "inv", "show", "px"]) u[n] = gl.getUniformLocation(prog, n);
    G = { gl, canvas, u, tex };
  } catch (e) {
    console.warn("key-gl", e);
    failed = true;
  }
  return G;
}

/** The key colour's chroma (Cb, Cr) from "#rrggbb". */
export function keyChroma(hex: string): [number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255,
    g = ((n >> 8) & 255) / 255,
    b = (n & 255) / 255;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [(b - y) / 1.8556, (r - y) / 1.5748];
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
  const [cb, cr] = keyChroma(k.color);
  gl.uniform1i(u.tex, 0);
  gl.uniform1i(u.mode, k.kind === "luma" ? 1 : 0);
  gl.uniform2f(u.keyC, cb, cr);
  gl.uniform1f(u.tol, k.tolerance);
  gl.uniform1f(u.soft, k.soft);
  gl.uniform1f(u.spill, k.spill);
  gl.uniform1f(u.choke, k.choke);
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
