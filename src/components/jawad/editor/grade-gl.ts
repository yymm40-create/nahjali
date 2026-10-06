// «التلوين» on the GPU (WebGL2): one shader runs a clip's whole grade on a frame, in this order (the same order the
// grading programs use): the camera's log undone and its gamut brought to Rec.709 → exposure, warmth and tint in
// linear light → filmic tone map (log sources) → display gamma → lift / gamma / gain / offset → contrast around a
// pivot → highlights, shadows, whites, blacks → saturation and vibrance → RGB curves → hue / sat / luma curves →
// secondaries (each colour-keyed, with its own window) → the 3D LUT → split toning → halation → vignette → grain →
// sharpen, then the primary window and the overall amount. The result is drawn back onto the 2D canvas, so the
// preview and the export see the same picture.

import { gamutToRec709, gradeIsNeutral, lutBytes, maskAt, sampleCurve, type Grade, type LogId, type Mask, type Secondary } from "@/lib/editor/grade";

const LOG_CODE: Record<LogId, number> = { none: 0, slog3: 1, slog2: 2, clog: 3, clog2: 4, clog3: 5, vlog: 6, logc3: 7, logc4: 8, nlog: 9, dlog: 10, flog: 11, flog2: 12, bmd5: 13, applelog: 14, redlog3g10: 15, hlg: 16, generic: 17 };
const CURVE_N = 256;
/** rows of the curves texture */
const ROWS = ["master", "r", "g", "b", "hueHue", "hueSat", "hueLum", "lumSat", "satSat"] as const;
const MAX_SEC = 4;
const MAX_SIDE = 1920;

const VS = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float; precision highp sampler3D;
in vec2 uv; out vec4 o;
uniform sampler2D img; uniform sampler2D curves; uniform sampler3D lut; uniform sampler2D maskTex[5];
uniform vec2 res; uniform float time;
uniform int logKind; uniform mat3 gamut; uniform float exposure, temp, tint;
uniform vec3 lift, gammaW, gain, offsetW; uniform float contrast, pivot, highlights, shadows, whites, blacks, saturation, vibrance;
uniform float lutOn, lutAmount, lutSize; uniform vec4 split; uniform float splitBal;
uniform vec3 halation; uniform vec2 grain; uniform vec4 vignette; uniform float sharpen, amount;
// masks: 0 = the primary's, 1..4 = the secondaries'. kind: 0 none, 1 ellipse, 2 rect, 3 linear, 4 path(texture)
uniform int maskKind[5]; uniform vec4 maskA[5]; uniform vec4 maskB[5]; uniform float maskInv[5];
uniform int secN; uniform int secOn[4]; uniform vec4 secKeyA[4]; uniform vec4 secKeyB[4]; uniform vec4 secKeyC[4]; uniform vec4 secAdj[4]; uniform float secCon[4];
uniform int showKey;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
float luma(vec3 c){ return dot(c, LUMA); }
vec3 srgbDec(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 srgbEnc(vec3 c){ c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }

float logLin(int k, float x){
  if (k == 1) { return x >= 171.2102946929/1023.0 ? pow(10.0, (x*1023.0 - 420.0)/261.5) * 0.19 - 0.01 : (x*1023.0 - 95.0) * 0.01125 / (171.2102946929 - 95.0); }
  if (k == 2) { float y = (x*1023.0 - 64.0)/876.0; float cut = 0.030001222851889303; float k = 0.9*219.0/155.0; return y >= cut ? k*(pow(10.0, (y - 0.616596 - 0.03)/0.432699) - 0.037584) : k*(y - cut)/3.53881278538813; }
  if (k == 3) { return 0.9*(x >= 0.0730597 ? (pow(10.0, (x - 0.0730597)/0.529136) - 1.0)/10.1596 : -(pow(10.0, (0.0730597 - x)/0.529136) - 1.0)/10.1596); }
  if (k == 4) { return 0.9*(x >= 0.092864125 ? (pow(10.0, (x - 0.092864125)/0.24136077) - 1.0)/87.099375 : -(pow(10.0, (0.092864125 - x)/0.24136077) - 1.0)/87.099375); }
  if (k == 5) { if (x >= 0.097465473) return 0.9*(pow(10.0, (x - 0.069886632)/0.42889912) - 1.0)/14.98325; if (x < 0.069886632) return -0.9*(pow(10.0, (0.069886632 - x)/0.42889912) - 1.0)/14.98325; return 0.9*(x - 0.073059361)/2.3069815; }
  if (k == 6) { return x < 0.181 ? (x - 0.125)/5.6 : pow(10.0, (x - 0.598206)/0.241514) - 0.00873; }
  if (k == 7) { return x > 5.367655*0.010591 + 0.092809 ? (pow(10.0, (x - 0.385537)/0.24719) - 0.052272)/5.555556 : (x - 0.092809)/5.367655; }
  if (k == 8) { float a = (262144.0 - 16.0)/117.45; float b = 928.0/1023.0; float c = 95.0/1023.0; float s = 7.0*log(2.0)*exp2(7.0 - 14.0*c/b)/(a*b); float t = (exp2(14.0*(-c/b) + 6.0) - 64.0)/a; return x < 0.0 ? x*s + t : (exp2(14.0*((x - c)/b) + 6.0) - 64.0)/a; }
  if (k == 9) { return x < 452.0/1023.0 ? pow(x*1023.0/650.0, 3.0) - 0.0075 : exp((x*1023.0 - 619.0)/150.0); }
  if (k == 10) { return x <= 0.14 ? (x - 0.0929)/6.025 : (pow(10.0, (x - 0.584555)/0.256663) - 0.0108)/0.9892; }
  if (k == 11) { return x < 0.100537775223865 ? (x - 0.092864)/8.735631 : (pow(10.0, (x - 0.790453)/0.344676) - 0.009468)/0.555556; }
  if (k == 12) { return x < 0.100686685370811 ? (x - 0.092864)/8.799461 : (pow(10.0, (x - 0.384316)/0.245281) - 0.064829)/5.555556; }
  if (k == 13) { float cut = 8.283605932402494*0.005 + 0.09246575342465753; return x < cut ? (x - 0.09246575342465753)/8.283605932402494 : exp((x - 0.5300133392291939)/0.08692876065491224) - 0.005494072432257808; }
  if (k == 14) { float R0 = -0.05641; float c = 47.28711236; float Pt = c*(0.01 - R0)*(0.01 - R0); if (x < 0.0) return R0; return x < Pt ? sqrt(x/c) + R0 : exp2((x - 0.69336945)/0.08550479) - 0.00964052; }
  if (k == 15) { return x < 0.0 ? x/15.1927 - 0.01 : (pow(10.0, x/0.224282) - 1.0)/155.975327 - 0.01; }
  if (k == 16) { return x <= 0.5 ? x*x/3.0 : (exp((x - 0.55991073)/0.17883277) + 0.28466892)/12.0; }
  if (k == 17) { return 0.18*exp2((x - 0.4)*13.0) - 0.18*exp2(-5.2); }
  return x;
}
// filmic tone map (ACES fit), 0.18 lands near 0.18 after the gamma
vec3 tonemap(vec3 x){ x *= 0.8; return clamp((x*(2.51*x + 0.03))/(x*(2.43*x + 0.59) + 0.14), 0.0, 1.0); }

vec3 rgb2hsv(vec3 c){ vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g)); vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r)); float d = q.x - min(q.w, q.y); float e = 1.0e-10; return vec3(abs(q.z + (q.w - q.y)/(6.0*d + e)), d/(q.x + e), q.x); }
vec3 hsv2rgb(vec3 c){ vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0); vec3 p = abs(fract(c.xxx + K.xyz)*6.0 - K.www); return c.z*mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y); }
float curve(int row, float x){ return texture(curves, vec2(clamp(x, 0.0, 1.0), (float(row) + 0.5)/9.0)).r; }
float hueDist(float a, float b){ float d = abs(a - b); return min(d, 1.0 - d); }

// (a sampler array can only be indexed by a constant)
float maskSample(int i, vec2 p){
  if (i == 0) return texture(maskTex[0], p).r; if (i == 1) return texture(maskTex[1], p).r; if (i == 2) return texture(maskTex[2], p).r;
  if (i == 3) return texture(maskTex[3], p).r; return texture(maskTex[4], p).r;
}
// a window's alpha at uv (the picture's 0…1 coordinates, y down)
float window(int i, vec2 p){
  int k = maskKind[i]; if (k == 0) return 1.0;
  float a;
  if (k == 4) { a = maskSample(i, p); }
  else {
    vec4 A = maskA[i]; vec4 B = maskB[i]; // A: cx, cy, w, h  B: cos, sin, feather, round
    vec2 d = p - A.xy; d = vec2(d.x*B.x + d.y*B.y, -d.x*B.y + d.y*B.x);
    if (k == 1) { float r = length(d / (A.zw*0.5)); a = 1.0 - smoothstep(1.0 - B.z, 1.0 + B.z*0.35, r); }
    else if (k == 2) { vec2 hs = A.zw*0.5; float rr = B.w*min(hs.x, hs.y); vec2 q = abs(d) - hs + rr; float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rr; float f = B.z*min(hs.x, hs.y) + 0.002; a = 1.0 - smoothstep(-f, f, sd); }
    else { vec2 dir = A.zw; float len = max(length(dir), 1e-4); float t = dot(p - A.xy, dir/len)/len; a = smoothstep(0.0, max(B.z, 0.02), t); }
  }
  return mix(a, 1.0 - a, maskInv[i]);
}

vec3 primary(vec3 c){
  // linear light: the log undone, the gamut, exposure, warmth
  vec3 lin = logKind == 0 ? srgbDec(c) : gamut * vec3(logLin(logKind, c.r), logLin(logKind, c.g), logLin(logKind, c.b));
  lin = max(lin, 0.0) * exp2(exposure);
  lin *= vec3(1.0 + 0.22*temp - 0.08*tint, 1.0 - 0.06*abs(temp) + 0.14*tint, 1.0 - 0.22*temp - 0.08*tint);
  c = logKind == 0 ? srgbEnc(lin) : srgbEnc(tonemap(lin));
  // wheels: lift (blacks), gamma (mids), gain (whites), offset (all)
  vec3 L = lift*0.5; vec3 G = 1.0 + gain*0.5; vec3 M = 1.0 + gammaW*0.6;
  c = G*(c + L*(1.0 - c)); c = pow(max(c, 0.0), 1.0/max(M, 0.05)) + offsetW*0.3;
  // contrast around the pivot
  c = (c - pivot)*contrast + pivot;
  // tone: highlights, shadows, whites, blacks
  float y = luma(clamp(c, 0.0, 1.0));
  float ms = 1.0 - smoothstep(0.0, 0.6, y); float mh = smoothstep(0.35, 1.0, y);
  c += shadows*0.35*ms*(1.0 - c)*(c + 0.1);
  c += highlights*0.35*mh*(1.0 - c);
  c += blacks*0.15*(1.0 - smoothstep(0.0, 0.5, y));
  c += whites*0.2*smoothstep(0.4, 1.0, y);
  // saturation and vibrance (vibrance lifts the weak colours more, and skin less)
  y = luma(c); vec3 hsv = rgb2hsv(clamp(c, 0.0, 1.0));
  float skin = 1.0 - smoothstep(0.03, 0.09, hueDist(hsv.x, 0.07));
  float v = 1.0 + vibrance*(1.0 - hsv.y)*(1.0 - 0.6*skin);
  c = y + (c - y)*saturation*v;
  // RGB curves
  c = clamp(c, 0.0, 1.0);
  c = vec3(curve(0, c.r), curve(0, c.g), curve(0, c.b));
  c = vec3(curve(1, c.r), curve(2, c.g), curve(3, c.b));
  // hue curves
  hsv = rgb2hsv(c);
  float hh = (curve(4, hsv.x) - 0.5); float hs = curve(5, hsv.x)*2.0; float hl = (curve(6, hsv.x) - 0.5); float ls = curve(7, luma(c))*2.0; float ss = curve(8, hsv.y)*2.0;
  hsv.x = fract(hsv.x + hh*0.5); hsv.y = clamp(hsv.y*hs*ls*ss, 0.0, 1.0); hsv.z = clamp(hsv.z*(1.0 + hl*0.8), 0.0, 1.0);
  return hsv2rgb(hsv);
}

float keyOf(int i, vec3 c){
  vec3 hsv = rgb2hsv(c); float y = luma(c);
  vec4 A = secKeyA[i]; vec4 B = secKeyB[i]; vec4 C = secKeyC[i]; // A: hue, width, soft, invert  B: satLo, satHi, lumLo, lumHi  C: soft, grow
  float kh = 1.0 - smoothstep(A.y, A.y + A.z + 1e-4, hueDist(hsv.x, A.x));
  float s = C.x + 1e-4;
  float ks = smoothstep(B.x - s, B.x + s, hsv.y)*(1.0 - smoothstep(B.y - s, B.y + s, hsv.y));
  float kl = smoothstep(B.z - s, B.z + s, y)*(1.0 - smoothstep(B.w - s, B.w + s, y));
  float k = kh*ks*kl;
  k = clamp(k + C.y*0.5, 0.0, 1.0); k = smoothstep(0.0, 1.0, k);
  return mix(k, 1.0 - k, A.w);
}

vec3 secondary(int i, vec3 c){
  vec4 J = secAdj[i]; // hue (turns), sat, lum (stops), temp
  vec3 hsv = rgb2hsv(clamp(c, 0.0, 1.0));
  hsv.x = fract(hsv.x + J.x); hsv.y = clamp(hsv.y*J.y, 0.0, 1.0);
  c = hsv2rgb(hsv)*exp2(J.z);
  c *= vec3(1.0 + 0.2*J.w, 1.0, 1.0 - 0.2*J.w);
  c = (c - 0.435)*secCon[i] + 0.435;
  return clamp(c, 0.0, 1.0);
}

vec3 lut3d(vec3 c){
  // tetrahedral interpolation (what the grading programs do; smoother than trilinear)
  float n = lutSize - 1.0; vec3 p = clamp(c, 0.0, 1.0)*n; vec3 i0 = floor(min(p, n - 1.0)); vec3 f = p - i0;
  vec3 s = vec3(1.0/lutSize); vec3 base = (i0 + 0.5)*s;
  #define L(dx,dy,dz) texture(lut, base + vec3(dx,dy,dz)*s).rgb
  vec3 c000 = L(0.,0.,0.); vec3 c111 = L(1.,1.,1.); vec3 r;
  if (f.r >= f.g) { if (f.g >= f.b) { r = (1.0-f.r)*c000 + (f.r-f.g)*L(1.,0.,0.) + (f.g-f.b)*L(1.,1.,0.) + f.b*c111; }
    else if (f.r >= f.b) { r = (1.0-f.r)*c000 + (f.r-f.b)*L(1.,0.,0.) + (f.b-f.g)*L(1.,0.,1.) + f.g*c111; }
    else { r = (1.0-f.b)*c000 + (f.b-f.r)*L(0.,0.,1.) + (f.r-f.g)*L(1.,0.,1.) + f.g*c111; } }
  else { if (f.b >= f.g) { r = (1.0-f.b)*c000 + (f.b-f.g)*L(0.,0.,1.) + (f.g-f.r)*L(0.,1.,1.) + f.r*c111; }
    else if (f.b >= f.r) { r = (1.0-f.g)*c000 + (f.g-f.b)*L(0.,1.,0.) + (f.b-f.r)*L(0.,1.,1.) + f.r*c111; }
    else { r = (1.0-f.g)*c000 + (f.g-f.r)*L(0.,1.,0.) + (f.r-f.b)*L(1.,1.,0.) + f.b*c111; } }
  return r;
}

float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y)*p3.z); }

void main(){
  vec3 src = texture(img, uv).rgb;
  vec3 c = primary(src);
  // secondaries
  for (int i = 0; i < 4; i++) {
    if (i >= secN || secOn[i] == 0) continue;
    float k = keyOf(i, c)*window(i + 1, uv);
    if (showKey == i + 1) { o = vec4(vec3(k), 1.0); return; }
    c = mix(c, secondary(i, c), k);
  }
  // the LUT
  if (lutOn > 0.5) c = mix(c, lut3d(c), lutAmount);
  // split toning: a colour in the shadows, another in the highlights
  float y = luma(clamp(c, 0.0, 1.0)); float bal = 0.5 + splitBal*0.4;
  float wS = 1.0 - smoothstep(0.0, bal + 0.25, y); float wH = smoothstep(bal - 0.25, 1.0, y);
  c += (hsv2rgb(vec3(split.x, 1.0, 1.0)) - 0.5)*split.y*0.35*wS;
  c += (hsv2rgb(vec3(split.z, 1.0, 1.0)) - 0.5)*split.w*0.35*wH;
  // halation: the bright parts bleed warm around them (film)
  if (halation.x > 0.0) {
    vec3 glow = vec3(0.0); float rad = (0.004 + halation.z*0.02); vec2 px = rad*vec2(res.y/res.x, 1.0);
    for (int j = 0; j < 12; j++) { float a = float(j)*0.5236; vec3 s = primary(texture(img, uv + vec2(cos(a), sin(a))*px).rgb); glow += max(s - halation.y, 0.0); }
    for (int j = 0; j < 8; j++) { float a = float(j)*0.7854 + 0.3; vec3 s = primary(texture(img, uv + vec2(cos(a), sin(a))*px*0.5).rgb); glow += max(s - halation.y, 0.0); }
    float g = luma(glow)/20.0/(1.0 - halation.y + 1e-3);
    c += vec3(1.0, 0.38, 0.12)*g*halation.x*0.9;
  }
  // vignette
  if (abs(vignette.x) > 0.0) {
    vec2 d = (uv - 0.5)*vec2(mix(1.0, res.x/res.y, vignette.w), 1.0)*2.0; float r = length(d)/max(vignette.y, 0.05);
    float v = smoothstep(1.0 - vignette.z, 1.0 + vignette.z*0.5, r);
    c = vignette.x > 0.0 ? c*(1.0 - vignette.x*0.9*v) : c + (1.0 - c)*(-vignette.x)*0.6*v;
  }
  // grain (more in the mids, like film)
  if (grain.x > 0.0) {
    vec2 g = floor(uv*res/(1.0 + grain.y*3.0)); float n = hash(g + fract(time*7.31)) + hash(g*1.7 + fract(time*3.17)) - 1.0;
    float ym = luma(clamp(c, 0.0, 1.0)); c += n*grain.x*0.22*(1.0 - abs(2.0*ym - 1.0)*0.7);
  }
  // sharpen (unsharp)
  if (sharpen > 0.0) {
    vec2 px = 1.0/res; vec3 b = (primary(texture(img, uv + vec2(px.x, 0)).rgb) + primary(texture(img, uv - vec2(px.x, 0)).rgb) + primary(texture(img, uv + vec2(0, px.y)).rgb) + primary(texture(img, uv - vec2(0, px.y)).rgb))*0.25;
    c += (c - b)*sharpen*1.2;
  }
  c = clamp(c, 0.0, 1.0);
  // the primary window and the amount
  float w = window(0, uv)*amount;
  o = vec4(mix(src, c, w), 1.0);
}`;

interface Gl {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  gl: WebGL2RenderingContext;
  prog: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
  img: WebGLTexture;
  curves: WebGLTexture;
  lut: WebGLTexture;
  masks: WebGLTexture[];
  curvesKey: string;
  lutKey: string;
  maskKeys: string[];
}

let ctx: Gl | null | undefined;
let failed = false;

function setup(): Gl | null {
  if (ctx !== undefined) return ctx;
  try {
    const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(16, 16) : document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false }) as WebGL2RenderingContext | null;
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
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const p = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(p);
    gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
    const u: Gl["u"] = {};
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(prog, i)!;
      const name = info.name.replace(/\[0\]$/, "");
      u[name] = gl.getUniformLocation(prog, info.name);
      // arrays: each element has its own location in some drivers
      if (info.size > 1) for (let k = 0; k < info.size; k++) u[`${name}[${k}]`] = gl.getUniformLocation(prog, `${name}[${k}]`);
    }
    const tex2 = (unit: number) => {
      const t = gl.createTexture()!;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
      return t;
    };
    const img = tex2(0);
    const curves = tex2(1);
    const lut = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_3D, lut);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB8, 2, 2, 2, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255, 0, 255, 255, 0, 0, 0, 255, 255, 0, 255, 0, 255, 255, 255, 255, 255]));
    const masks = [3, 4, 5, 6, 7].map(tex2);
    gl.uniform1i(u.img, 0);
    gl.uniform1i(u.curves, 1);
    gl.uniform1i(u.lut, 2);
    for (let i = 0; i < 5; i++) gl.uniform1i(u[`maskTex[${i}]`] ?? u.maskTex, 3 + i);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    ctx = { canvas, gl, prog, u, img, curves, lut, masks, curvesKey: "", lutKey: "", maskKeys: ["", "", "", "", ""] };
  } catch (e) {
    // (the reason is worth seeing in the console: a driver without WebGL2, or a shader the driver refused)
    console.warn("grade-gl: no GPU grading:", e instanceof Error ? e.message : e);
    ctx = null;
    failed = true;
  }
  return ctx;
}

/** Can this browser grade on the GPU? */
export const gradeReady = () => !!setup() && !failed;

// a mask drawn as a path: rasterized with a soft edge (a blur), kept per mask
let maskCanvas: HTMLCanvasElement | null = null;
function pathMask(m: Mask, cx: number, cy: number): HTMLCanvasElement {
  const S = 512;
  const c = (maskCanvas ??= document.createElement("canvas"));
  c.width = S;
  c.height = S;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, S, S);
  g.fillStyle = "#000";
  g.fillRect(0, 0, S, S);
  if (m.points.length >= 3) {
    g.save();
    g.filter = m.feather > 0 ? `blur(${(m.feather * 40).toFixed(1)}px)` : "none";
    g.fillStyle = "#fff";
    g.beginPath();
    const dx = cx - m.x;
    const dy = cy - m.y;
    m.points.forEach((p, i) => (i ? g.lineTo((p.x + dx) * S, (p.y + dy) * S) : g.moveTo((p.x + dx) * S, (p.y + dy) * S)));
    g.closePath();
    g.fill();
    g.restore();
  }
  return c;
}

function setMask(G: Gl, i: number, m: Mask | null, t: number) {
  const { gl, u } = G;
  const kind = !m ? 0 : m.kind === "ellipse" ? 1 : m.kind === "rect" ? 2 : m.kind === "linear" ? 3 : 4;
  gl.uniform1i(u[`maskKind[${i}]`] ?? u.maskKind, kind);
  if (!m) return;
  const { x, y } = maskAt(m, t);
  const a = (m.rotate * Math.PI) / 180;
  if (m.kind === "linear") {
    gl.uniform4f(u[`maskA[${i}]`] ?? u.maskA, x, y, m.w * Math.cos(a), m.w * Math.sin(a));
    gl.uniform4f(u[`maskB[${i}]`] ?? u.maskB, 1, 0, m.feather, 0);
  } else {
    gl.uniform4f(u[`maskA[${i}]`] ?? u.maskA, x, y, m.w, m.h);
    gl.uniform4f(u[`maskB[${i}]`] ?? u.maskB, Math.cos(a), Math.sin(a), m.feather, m.round);
  }
  gl.uniform1f(u[`maskInv[${i}]`] ?? u.maskInv, m.invert ? 1 : 0);
  if (m.kind === "path") {
    const key = `${JSON.stringify(m.points)}|${m.feather}|${x.toFixed(4)}|${y.toFixed(4)}`;
    if (G.maskKeys[i] !== key) {
      G.maskKeys[i] = key;
      gl.activeTexture(gl.TEXTURE3 + i);
      gl.bindTexture(gl.TEXTURE_2D, G.masks[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pathMask(m, x, y));
    }
  }
}

/**
 * The frame with the grade on it, as a canvas to draw (the same canvas each time: draw it before the next call).
 * `t` is the clip's own time in ms (for masks that move and the grain). null when the GPU isn't there.
 */
export function gradeFrame(img: CanvasImageSource, sw: number, sh: number, g: Grade, t: number, showKey = 0): CanvasImageSource | null {
  if (gradeIsNeutral(g) && !showKey && !g.mask) return null;
  const G = setup();
  if (!G) return null;
  const { gl, u } = G;
  const k = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * k));
  const h = Math.max(1, Math.round(sh * k));
  if (G.canvas.width !== w || G.canvas.height !== h) {
    G.canvas.width = w;
    G.canvas.height = h;
  }
  gl.viewport(0, 0, w, h);
  gl.useProgram(G.prog);

  // the picture
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, G.img);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img as TexImageSource);
  } catch {
    return null;
  }
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  // the curves (9 rows × 256), only when they change
  const ck = JSON.stringify(g.curves);
  if (G.curvesKey !== ck) {
    G.curvesKey = ck;
    const data = new Uint8Array(CURVE_N * ROWS.length * 4);
    ROWS.forEach((row, r) => {
      const s = sampleCurve(g.curves[row], CURVE_N, row.startsWith("hue"));
      for (let i = 0; i < CURVE_N; i++) {
        const v = Math.round(s[i] * 255);
        const o = (r * CURVE_N + i) * 4;
        data[o] = v;
        data[o + 1] = v;
        data[o + 2] = v;
        data[o + 3] = 255;
      }
    });
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, G.curves);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, CURVE_N, ROWS.length, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  }
  // the LUT, only when it changes
  const lk = g.lut ? `${g.lut.size}|${g.lut.data.length}|${g.lut.data.slice(0, 64)}|${g.lut.name}` : "";
  if (G.lutKey !== lk) {
    G.lutKey = lk;
    if (g.lut) {
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_3D, G.lut);
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB8, g.lut.size, g.lut.size, g.lut.size, 0, gl.RGB, gl.UNSIGNED_BYTE, lutBytes(g.lut));
    }
  }

  gl.uniform2f(u.res, w, h);
  gl.uniform1f(u.time, (t % 100000) / 1000);
  gl.uniform1i(u.logKind, LOG_CODE[g.log] ?? 0);
  const m = gamutToRec709(g.log);
  gl.uniformMatrix3fv(u.gamut, true, new Float32Array(m));
  gl.uniform1f(u.exposure, g.exposure);
  gl.uniform1f(u.temp, g.temp);
  gl.uniform1f(u.tint, g.tint);
  const wheel = (wh: Grade["lift"]) => [wh.rgb[0] + wh.y, wh.rgb[1] + wh.y, wh.rgb[2] + wh.y] as const;
  gl.uniform3fv(u.lift, wheel(g.lift));
  gl.uniform3fv(u.gammaW, wheel(g.gamma));
  gl.uniform3fv(u.gain, wheel(g.gain));
  gl.uniform3fv(u.offsetW, wheel(g.offset));
  gl.uniform1f(u.contrast, g.contrast);
  gl.uniform1f(u.pivot, g.pivot);
  gl.uniform1f(u.highlights, g.highlights);
  gl.uniform1f(u.shadows, g.shadows);
  gl.uniform1f(u.whites, g.whites);
  gl.uniform1f(u.blacks, g.blacks);
  gl.uniform1f(u.saturation, g.saturation);
  gl.uniform1f(u.vibrance, g.vibrance);
  gl.uniform1f(u.lutOn, g.lut ? 1 : 0);
  gl.uniform1f(u.lutAmount, g.lutAmount);
  gl.uniform1f(u.lutSize, g.lut?.size ?? 2);
  gl.uniform4f(u.split, g.split.shadowHue, g.split.shadowSat, g.split.highHue, g.split.highSat);
  gl.uniform1f(u.splitBal, g.split.balance);
  gl.uniform3f(u.halation, g.halation.amount, g.halation.threshold, g.halation.size);
  gl.uniform2f(u.grain, g.grain.amount, g.grain.size);
  gl.uniform4f(u.vignette, g.vignette.amount, g.vignette.size, g.vignette.soft, g.vignette.round);
  gl.uniform1f(u.sharpen, g.sharpen);
  gl.uniform1f(u.amount, g.amount);
  gl.uniform1i(u.showKey, showKey);

  setMask(G, 0, g.mask, t);
  const secs = g.secondaries.slice(0, MAX_SEC);
  gl.uniform1i(u.secN, secs.length);
  secs.forEach((s: Secondary, i) => {
    gl.uniform1i(u[`secOn[${i}]`] ?? u.secOn, s.on ? 1 : 0);
    gl.uniform4f(u[`secKeyA[${i}]`] ?? u.secKeyA, s.key.hue, s.key.hueWidth, s.key.hueSoft, s.key.invert ? 1 : 0);
    gl.uniform4f(u[`secKeyB[${i}]`] ?? u.secKeyB, s.key.satLo, s.key.satHi, s.key.lumLo, s.key.lumHi);
    gl.uniform4f(u[`secKeyC[${i}]`] ?? u.secKeyC, s.key.soft, s.key.grow, s.key.blur, 0);
    gl.uniform4f(u[`secAdj[${i}]`] ?? u.secAdj, s.hue / 360, s.sat, s.lum, s.temp);
    gl.uniform1f(u[`secCon[${i}]`] ?? u.secCon, s.contrast);
    setMask(G, i + 1, s.mask, t);
  });
  for (let i = secs.length; i < MAX_SEC; i++) setMask(G, i + 1, null, t);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return G.canvas as unknown as CanvasImageSource;
}

/**
 * The grade baked into a 3D LUT (its colour part: no windows, grain, vignette or halation), as RGB bytes
 * (size³ × 3, red fastest), to save as a .cube for Premiere, DaVinci or CapCut.
 */
export function bakeLut(g: Grade, size = 33): Uint8Array | null {
  const G = setup();
  if (!G) return null;
  // the identity as a picture: size² wide, size tall (blue down the rows)
  const w = size * size;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = size;
  const d = c.getContext("2d")!;
  const im = d.createImageData(w, size);
  for (let b = 0; b < size; b++)
    for (let gg = 0; gg < size; gg++)
      for (let r = 0; r < size; r++) {
        const o = (b * w + gg * size + r) * 4;
        im.data[o] = Math.round((r / (size - 1)) * 255);
        im.data[o + 1] = Math.round((gg / (size - 1)) * 255);
        im.data[o + 2] = Math.round((b / (size - 1)) * 255);
        im.data[o + 3] = 255;
      }
  d.putImageData(im, 0, 0);
  const flat: Grade = { ...g, mask: null, amount: 1, grain: { ...g.grain, amount: 0 }, vignette: { ...g.vignette, amount: 0 }, halation: { ...g.halation, amount: 0 }, sharpen: 0, secondaries: g.secondaries.map((s) => ({ ...s, mask: null, show: false })) };
  const out = gradeFrame(c, w, size, flat, 0);
  if (!out) return null;
  const { gl } = G;
  const px = new Uint8Array(w * size * 4);
  gl.readPixels(0, 0, w, size, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const bytes = new Uint8Array(size * size * size * 3);
  for (let b = 0; b < size; b++)
    for (let gg = 0; gg < size; gg++)
      for (let r = 0; r < size; r++) {
        // readPixels is bottom-up
        const o = ((size - 1 - b) * w + gg * size + r) * 4;
        const k = (r + gg * size + b * size * size) * 3;
        bytes[k] = px[o];
        bytes[k + 1] = px[o + 1];
        bytes[k + 2] = px[o + 2];
      }
  return bytes;
}
