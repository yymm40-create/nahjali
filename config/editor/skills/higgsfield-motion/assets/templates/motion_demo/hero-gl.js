/*! hero-gl.js — reference ray-marcher for HFT.three(theme) material params (one rounded slab).
 *
 *  NOT USED by the demo since the 2026-10-08 critique: a blank capsule / metallic slab is not a hero (client:
 *  "максимально непонятна и не impressive"). The demo hero is the 7-bar wave from ../hero-glyph.js, the same glyph as
 *  styleboard frame D. Kept as the three() → shader mapping reference; antialiased; a 'light' reveal must start at
 *  exposure ≥ 0.35 (never a dark box).
 *
 *  Nothing here is style-specific. Every look decision is read from the theme:
 *    geometry  radius.pill (corner) + shape family → capsule (pill / round) or sharp slab (sharp)
 *    material  HFT.three(theme).materials.hero   (colour, roughness, metalness, clearcoat, sheen, envMapIntensity)
 *    light     HFT.three(theme).lights + light.model + light.keyAzimuth  ('flat' = unlit brand fill, ΔL ≤ 0.03)
 *    world     bg.* / fg.primary / accent.core (env, softboxes, sweep colour), renderer.exposure, camera.fov
 *  The choreography (demo.js) only passes a per-frame state: position, scale, rotation, exposure, clip, sweep.
 *  Pure function of that state → deterministic frames.
 */
(function (root) {
  'use strict';

  const VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
  const FS = `
precision highp float;
uniform vec2 uRes; uniform float uCam, uDc, uR, uE, uBound, uBulge;
uniform vec3 uO, uHalf, uS; uniform mat3 uRotInv;
uniform vec3 uAlb, uSheenCol, uSweepCol, uLightCol, uEnvLo, uEnvHi, uSky, uGround, uKey, uRim, uFlatTop, uFlatBot;
uniform float uRough, uMetal, uCoat, uSheen, uEnvInt, uKeyInt, uAmbInt, uRimInt, uWrap, uExpo, uAlpha, uClipY, uSweep, uSweepAmt, uFlat, uExposure;

float sdRR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r; }
vec3 toLocal(vec3 p){ return (uRotInv * (p - uO)) / uS; }
float map(vec3 p){
  vec3 q = toLocal(p);
  float e = uE;
  float d2 = sdRR(q.xy, uHalf.xy - e, max(uR - e, 0.0));
  float bx = clamp(q.x / uHalf.x, -1.0, 1.0);                         // barrel front: a soft cylinder across x
  vec2 w = vec2(d2, abs(q.z) - (uHalf.z - e + uBulge * (1.0 - bx * bx)));
  return (min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - e) * min(uS.x, min(uS.y, uS.z));
}
vec3 nrm(vec3 p){
  vec2 k = vec2(0.6, -0.6);
  return normalize(k.xyy * map(p + k.xyy) + k.yyx * map(p + k.yyx) + k.yxy * map(p + k.yxy) + k.xxx * map(p + k.xxx));
}
vec3 env(vec3 r, float rough){
  // product studio: dark floor → lifted ceiling, one big key softbox front-left, one tall strip front-right
  float w = 0.02 + rough * 0.6;
  vec3 c = mix(uEnvLo, uEnvHi, smoothstep(-0.6, 0.9, r.y));
  float front = smoothstep(-0.2, 0.3, r.z);
  // tall softboxes → vertical satin bands on a barrel front (no hard horizontal cut-offs)
  float k1 = (1.0 - smoothstep(0.15, 0.15 + w, abs(r.x + 0.42))) * (1.0 - smoothstep(0.75, 1.1, abs(r.y - 0.1)));
  float k2 = (1.0 - smoothstep(0.04, 0.04 + w, abs(r.x - 0.62))) * (1.0 - smoothstep(0.7, 1.05, abs(r.y - 0.05)));
  float top = smoothstep(0.55, 1.0, r.y) * 0.35;
  return c + uLightCol * (front * (k1 * 1.2 + k2 * 0.7) + top);
}
vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
void main(){
  vec2 fp = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  fp = (fp - uRes * 0.5) / uCam + uRes * 0.5;                          // camera zoom about the frame centre
  if (fp.y > uClipY || uAlpha <= 0.0) { gl_FragColor = vec4(0.0); return; }
  vec3 ro = vec3(0.0, 0.0, uDc);
  vec3 rd = normalize(vec3(fp.x - uRes.x * 0.5, uRes.y * 0.5 - fp.y, -uDc));
  vec3 oc = ro - uO; float b = dot(oc, rd); float h = b * b - (dot(oc, oc) - uBound * uBound);
  if (h < 0.0) { gl_FragColor = vec4(0.0); return; }
  h = sqrt(h);
  float t = max(-b - h, 0.0), tEnd = -b + h;
  float minD = 1e9, tMin = t; bool hit = false;
  for (int i = 0; i < 110; i++) {
    float d = map(ro + rd * t);
    if (d < minD) { minD = d; tMin = t; }
    if (d < 0.2) { hit = true; break; }
    t += d * 0.82;
    if (t > tEnd) break;
  }
  float ps = (tMin / uDc) / uCam;                                      // world size of one screen pixel
  float cov = hit ? 1.0 : 1.0 - smoothstep(0.0, ps * 1.25, minD);
  if (cov <= 0.0) { gl_FragColor = vec4(0.0); return; }
  vec3 p = ro + rd * tMin; vec3 q = toLocal(p);
  vec3 col;
  float bw = uFlat > 0.5 ? 0.42 : 0.09 + uRough * 0.10;               // a flat fill gets a broad light wash, not a gloss streak
  float band = 1.0 - smoothstep(0.0, bw, abs(q.x / uHalf.x - uSweep + q.y / uHalf.y * 0.28));
  if (uFlat > 0.5) {
    // flat light model: the brand fill itself, a ≤3 % value ramp top → bottom, no shading
    col = mix(uFlatBot, uFlatTop, smoothstep(-1.0, 1.0, q.y / uHalf.y));
    col = mix(col, uSweepCol, band * band * uSweepAmt * 0.7);
    col *= uExpo;
  } else {
    vec3 N = nrm(p), V = -rd;
    float NdV = max(dot(N, V), 1e-3);
    vec3 L = normalize(uKey);
    float NdL = dot(N, L);
    float diff = clamp((NdL + uWrap) / (1.0 + uWrap), 0.0, 1.0);
    vec3 alb = lin(uAlb);
    vec3 F0 = mix(vec3(0.04), alb, uMetal);
    vec3 F = F0 + (1.0 - F0) * pow(1.0 - NdV, 5.0) * (1.0 - uRough) * (1.0 - uRough);
    vec3 R = reflect(rd, N);
    vec3 amb = mix(lin(uGround), lin(uSky), N.y * 0.5 + 0.5) * uAmbInt;
    vec3 Lc = lin(uLightCol);
    col = alb * (1.0 - uMetal) * (Lc * diff * uKeyInt + amb);
    col += lin(env(R, uRough)) * F * uEnvInt * (uMetal + (1.0 - uMetal) * (1.0 - uRough));   // rough dielectrics: blurred, weaker
    vec3 H = normalize(L + V); float NdH = max(dot(N, H), 0.0);
    float a = max(uRough * uRough, 0.03), a2 = a * a, dd = NdH * NdH * (a2 - 1.0) + 1.0;
    col += (a2 / (3.14159 * dd * dd)) * F * max(NdL, 0.0) * uKeyInt * 0.12;
    float Fc = 0.04 + 0.96 * pow(1.0 - NdV, 5.0);
    col += uCoat * Fc * lin(env(R, 0.1)) * 0.8;
    col += uSheen * lin(uSheenCol) * pow(1.0 - NdV, 2.6) * (0.25 + 0.75 * clamp(NdL * 0.5 + 0.5, 0.0, 1.0)) * 0.45;
    vec3 Rm = normalize(uRim);
    col += mix(alb, Lc, uMetal) * uRimInt * pow(1.0 - NdV, 3.0) * smoothstep(-0.3, 0.6, dot(N, Rm)) * 0.55;
    col += lin(uSweepCol) * band * uSweepAmt * mix(0.18, 1.1, uMetal) * (0.35 + 0.65 * NdV);
    col *= uExposure * uExpo;
    float m = max(col.r, max(col.g, col.b));
    col = mix(col, vec3(m), smoothstep(0.9, 2.6, m) * 0.5);              // hot highlights drift to white (no neon gold)
    m = max(col.r, max(col.g, col.b));                                   // then a hue-preserving soft shoulder
    if (m > 0.8) col *= (0.8 + 0.2 * (1.0 - exp(-(m - 0.8) / 0.2))) / m;
    col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  }
  float a = cov * uAlpha;
  gl_FragColor = vec4(col * a, a);
}`;

  const hex3 = (h) => { h = String(h).replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); };
  const dirFromAzEl = (az, el) => { const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180; return [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)]; };
  const dirFromPos = (p) => { const l = Math.hypot(p[0], p[1], p[2]) || 1; return [p[0] / l, p[1] / l, p[2] / l]; };
  const mix3 = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

  /** read the theme once → static uniforms */
  function lookFromTheme(HFT, th) {
    const T = th.tokens, x3 = HFT.three(th), m = x3.materials.hero, dark = th.meta.scheme === 'dark';
    const model = T['light.model'];
    const white = dark ? T['fg.primary'].hex : T['bg.raised'].hex;     // the studio's light colour comes from the theme, not #FFF
    const L = { key: dirFromAzEl(T['light.keyAzimuth'], 45), keyInt: 1, ambInt: 0.35, rimInt: 0, rim: dirFromAzEl(160, 20), wrap: 0.15, envInt: m.envMapIntensity == null ? 1 : m.envMapIntensity, sky: white, ground: T['bg.base'].hex };
    for (const l of x3.lights || []) {
      const role = String(l.role || '');
      if (l.type === 'HemisphereLight') { L.ambInt = l.intensity * 0.45; if (l.skyColor) L.sky = l.skyColor; if (l.groundColor) L.ground = l.groundColor; }
      else if (l.type === 'RectAreaLight') { L.keyInt = l.intensity * 0.3; L.wrap = 0.5; if (l.position) L.key = dirFromPos(l.position); }
      else if (l.type === 'env') { L.envInt *= l.intensity; L.ambInt = Math.max(L.ambInt, 0.12 * l.intensity); }
      else if (l.type === 'DirectionalLight' && /rim/.test(role)) { L.rimInt = l.intensity; L.rim = l.position ? dirFromPos(l.position) : dirFromAzEl(l.azimuthDeg == null ? 160 : l.azimuthDeg, l.elevationDeg == null ? 20 : l.elevationDeg); }
      else if (l.type === 'DirectionalLight') { L.keyInt = l.intensity; L.key = l.position ? dirFromPos(l.position) : dirFromAzEl(l.azimuthDeg == null ? T['light.keyAzimuth'] : l.azimuthDeg, l.elevationDeg == null ? 45 : l.elevationDeg); }
    }
    const alb = hex3(m.color), core = hex3(T['accent.core'].hex);
    return {
      flat: model === 'flat' ? 1 : 0,
      alb, rough: m.roughness, metal: m.metalness, coat: m.clearcoat || 0, sheen: m.sheen || 0,
      sheenCol: hex3(m.sheenColor || T['accent.core'].hex),
      sweepCol: core,
      lightCol: hex3(white),
      envLo: hex3(dark ? T['bg.sunken'].hex : T['bg.base'].hex),
      envHi: hex3(dark ? T['bg.raised'].hex : T['bg.raised'].hex),
      sky: hex3(L.sky), ground: hex3(L.ground), key: L.key, rim: L.rim,
      keyInt: L.keyInt, ambInt: L.ambInt, rimInt: L.rimInt, wrap: L.wrap, envInt: L.envInt,
      exposure: (x3.renderer && x3.renderer.exposure) || 1,
      // flat fill: ±ΔL ≈ 0.03 around the brand colour (material.flat rule)
      flatTop: mix3(alb, core, 0.14), flatBot: alb.map((v) => v * 0.94),
      fov: (x3.camera && x3.camera.fov) || 28,
    };
  }

  function create(canvas, HFT, th) {
    const look = lookFromTheme(HFT, th);
    const W = canvas.width, H = canvas.height;
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: true, alpha: true });
    if (!gl) return fallback2D(canvas, look);
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {}; const u = (n) => (U[n] || (U[n] = gl.getUniformLocation(pr, n)));
    const f1 = (n, v) => gl.uniform1f(u(n), v), f2 = (n, a) => gl.uniform2f(u(n), a[0], a[1]), f3 = (n, a) => gl.uniform3f(u(n), a[0], a[1], a[2]);
    f2('uRes', [W, H]);
    f3('uAlb', look.alb); f3('uSheenCol', look.sheenCol); f3('uSweepCol', look.sweepCol); f3('uLightCol', look.lightCol);
    f3('uEnvLo', look.envLo); f3('uEnvHi', look.envHi); f3('uSky', look.sky); f3('uGround', look.ground);
    f3('uKey', look.key); f3('uRim', look.rim); f3('uFlatTop', look.flatTop); f3('uFlatBot', look.flatBot);
    f1('uRough', look.rough); f1('uMetal', look.metal); f1('uCoat', look.coat); f1('uSheen', look.sheen); f1('uEnvInt', look.envInt);
    f1('uKeyInt', look.keyInt); f1('uAmbInt', look.ambInt); f1('uRimInt', look.rimInt); f1('uWrap', look.wrap); f1('uFlat', look.flat); f1('uExposure', look.exposure);
    const Dc = (H / 2) / Math.tan(((look.fov / 2) * Math.PI) / 180);
    f1('uDc', Dc);
    gl.viewport(0, 0, W, H);

    function render(s) {
      // s: {cam, cx, cy, w, h, d, r, e, sx, sy, sz, rx, ry, rz, expo, alpha, clipY, sweep, sweepAmt}
      const cx = Math.cos(s.rx), sx = Math.sin(s.rx), cy = Math.cos(s.ry), sy = Math.sin(s.ry), cz = Math.cos(s.rz), sz = Math.sin(s.rz);
      // R = Ry * Rx * Rz (object → world); the inverse is its transpose
      const Rz = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]], Rx = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]], Ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]];
      const mm = (A, B) => A.map((r, i) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
      const R = mm(mm(Ry, Rx), Rz);
      // column-major mat3 of R^T: column j = row j of R
      gl.uniformMatrix3fv(u('uRotInv'), false, new Float32Array([R[0][0], R[1][0], R[2][0], R[0][1], R[1][1], R[2][1], R[0][2], R[1][2], R[2][2]]));
      f1('uCam', s.cam); f3('uO', [s.cx - W / 2, H / 2 - s.cy, 0]); f3('uHalf', [s.w / 2, s.h / 2, s.d / 2]); f3('uS', [s.sx, s.sy, s.sz]);
      f1('uR', Math.min(s.r, s.w / 2, s.h / 2)); f1('uE', Math.min(s.e, s.d / 2, Math.max(s.r, s.e)));
      const bulge = s.bulge == null ? 0 : s.bulge;
      f1('uBulge', bulge);
      f1('uBound', Math.hypot((s.w / 2) * s.sx, (s.h / 2) * s.sy, (s.d / 2 + bulge) * s.sz) + 4);
      f1('uExpo', s.expo); f1('uAlpha', s.alpha); f1('uClipY', s.clipY); f1('uSweep', s.sweep); f1('uSweepAmt', s.sweepAmt);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.finish();
    }
    return { render, look, webgl: true };
  }

  /** no WebGL: a 2D silhouette in the material colour (keeps the demo readable) */
  function fallback2D(canvas, look) {
    const g = canvas.getContext('2d');
    const css = (a) => `rgb(${a.map((v) => Math.round(v * 255)).join(',')})`;
    function render(s) {
      g.clearRect(0, 0, canvas.width, canvas.height);
      if (s.alpha <= 0) return;
      g.save(); g.globalAlpha = s.alpha;
      g.translate(canvas.width / 2, canvas.height / 2); g.scale(s.cam, s.cam); g.translate(-canvas.width / 2, -canvas.height / 2);
      g.beginPath(); g.rect(0, 0, canvas.width, s.clipY); g.clip();
      g.translate(s.cx, s.cy); g.rotate(-s.rz); g.scale(s.sx * Math.abs(Math.cos(s.ry)), s.sy);
      const w = s.w, h = s.h, r = Math.min(s.r, w / 2, h / 2);
      g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, r); g.fillStyle = css(look.alb.map((v) => v * s.expo)); g.fill();
      g.restore();
    }
    return { render, look, webgl: false };
  }

  root.HeroGL = { create, lookFromTheme };
})(typeof window !== 'undefined' ? window : globalThis);
