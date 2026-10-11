// A thousand made-up keying shots for «الكي»'s training: a green (or blue, or another colour) screen lit unevenly,
// with a shadow, video noise and the screen's glow on the person's edges; a person (skin, hair, a shirt of a colour
// far from the screen's) whose edge pixels are a mix of the two, as a camera sees them. Each shot knows the truth:
// which pixels are screen, which are the person's body, and which are the mixed edge.

export interface Scene {
  w: number;
  h: number;
  px: Uint8ClampedArray;
  /** 0 = screen, 1 = the person's body, 2 = the mixed edge */
  truth: Uint8Array;
  screen: [number, number, number];
  seed: number;
  kind: string;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}
function fromHsv(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s),
    q = v * (1 - f * s),
    t = v * (1 - (1 - f) * s);
  return ([[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]] as const)[((i % 6) + 6) % 6].slice() as [number, number, number];
}

const SKINS: [number, number, number][] = [
  [0.96, 0.8, 0.69],
  [0.89, 0.67, 0.53],
  [0.78, 0.56, 0.42],
  [0.62, 0.42, 0.3],
  [0.45, 0.3, 0.2],
  [0.3, 0.2, 0.14],
];

export function makeScene(seed: number, size = 96): Scene {
  const R = rng(seed * 2654435761);
  const w = size,
    h = size;
  // the screen: mostly green, some blue, a few other colours (a coloured wall)
  const roll = R();
  const kind = roll < 0.6 ? "green" : roll < 0.88 ? "blue" : "other";
  const hue = kind === "green" ? 0.29 + R() * 0.14 : kind === "blue" ? 0.56 + R() * 0.1 : [0.5, 0.75, 0.83, 0.47][Math.floor(R() * 4)] + R() * 0.03;
  const sat = 0.45 + R() * 0.5;
  const val = 0.45 + R() * 0.5;
  const screen = fromHsv(hue % 1, sat, val);
  // uneven light: a gradient across the screen, a soft shadow beside the person, noise
  const gx = (R() - 0.5) * 0.7,
    gy = (R() - 0.5) * 0.5;
  const shX = 0.25 + R() * 0.5,
    shY = 0.5 + R() * 0.4,
    shR = 0.15 + R() * 0.2,
    shD = 0.15 + R() * 0.3;
  const noise = R() * 0.05;
  // the person: a head and a body, skin, a shirt whose colour is far from the screen's (or plain black/white/grey)
  const skin = SKINS[Math.floor(R() * SKINS.length)];
  let shirt: [number, number, number];
  const sr = R();
  if (sr < 0.35) shirt = [0.08, 0.08, 0.09].map((x) => x + R() * 0.1) as [number, number, number];
  else if (sr < 0.55) shirt = [0.9, 0.9, 0.92].map((x) => x - R() * 0.15) as [number, number, number];
  else {
    let sh = R();
    while (Math.min(Math.abs(sh - hue), 1 - Math.abs(sh - hue)) < 0.22) sh = R();
    shirt = fromHsv(sh, 0.3 + R() * 0.6, 0.3 + R() * 0.6);
  }
  const hair: [number, number, number] = R() < 0.7 ? [0.1 + R() * 0.15, 0.07 + R() * 0.1, 0.05 + R() * 0.08] : [0.55, 0.4, 0.25];
  const cx = 0.4 + R() * 0.2;
  const headR = 0.12 + R() * 0.05;
  const headY = 0.3 + R() * 0.05;
  const spill = R() * 0.35;
  const px = new Uint8ClampedArray(w * h * 4);
  const truth = new Uint8Array(w * h);
  const S = 4; // supersampling: the edge pixels are a true mix
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let fg = 0;
      const col = [0, 0, 0];
      for (let sy = 0; sy < S; sy++)
        for (let sx = 0; sx < S; sx++) {
          const u = (x + (sx + 0.5) / S) / w,
            v = (y + (sy + 0.5) / S) / h;
          const head = Math.hypot((u - cx) / headR, (v - headY) / (headR * 1.2)) < 1;
          const hairCap = head && v < headY - headR * 0.35;
          const strands = !head && Math.abs(v - (headY - headR * 1.15)) < 0.012 && Math.abs(u - cx) < headR * 0.9 && Math.sin(u * 220) > 0.2;
          const body = v > headY + headR * 1.05 && Math.abs(u - cx) < 0.12 + (v - headY) * 0.35 && v < 1.01;
          let c: [number, number, number] | null = null;
          if (strands) c = hair;
          else if (hairCap) c = hair;
          else if (head) c = skin;
          else if (body) c = shirt;
          if (c) {
            fg++;
            col[0] += c[0];
            col[1] += c[1];
            col[2] += c[2];
          }
        }
      const n = S * S;
      const a = fg / n;
      const u = (x + 0.5) / w,
        v = (y + 0.5) / h;
      const light = Math.min(1.25, Math.max(0.45, 1 + gx * (u - 0.5) * 2 + gy * (v - 0.5) * 2)) * (1 - shD * Math.max(0, 1 - Math.hypot(u - shX, v - shY) / shR));
      const bg = screen.map((c) => c * light);
      const fgc = a > 0 ? col.map((c) => c / fg) : [0, 0, 0];
      // the screen's glow on the person's edge
      const glow = a > 0 && a < 1 ? spill : spill * 0.1;
      const out = [0, 1, 2].map((i) => {
        const f = fgc[i] * (1 - glow) + screen[i] * glow * 0.8;
        return f * a + bg[i] * (1 - a) + (R() - 0.5) * 2 * noise;
      });
      const o = (y * w + x) * 4;
      px[o] = Math.round(Math.min(1, Math.max(0, out[0])) * 255);
      px[o + 1] = Math.round(Math.min(1, Math.max(0, out[1])) * 255);
      px[o + 2] = Math.round(Math.min(1, Math.max(0, out[2])) * 255);
      px[o + 3] = 255;
      truth[y * w + x] = a === 0 ? 0 : a === 1 ? 1 : 2;
    }
  return { w, h, px, truth, screen, seed, kind };
}

/** How well a keyed picture (its alpha channel) matches the truth. */
export function score(s: Scene, keyed: Uint8ClampedArray) {
  let bg = 0,
    bgGone = 0,
    body = 0,
    bodyKept = 0;
  // the body's own edge ring is judged with the edge (a choke may thin it by a pixel)
  for (let i = 0; i < s.w * s.h; i++) {
    const a = keyed[i * 4 + 3] / 255;
    const t = s.truth[i];
    if (t === 0) {
      // the screen right next to the person may keep a faint edge
      bg++;
      if (a < 0.25) bgGone++;
    } else if (t === 1) {
      const x = i % s.w,
        y = Math.floor(i / s.w);
      const inner = [-2, 2].every((d) => s.truth[Math.min(s.h - 1, Math.max(0, y + d)) * s.w + x] === 1 && s.truth[y * s.w + Math.min(s.w - 1, Math.max(0, x + d))] === 1);
      if (!inner) continue;
      body++;
      if (a > 0.8) bodyKept++;
    }
  }
  return { removed: bg ? bgGone / bg : 1, kept: body ? bodyKept / body : 1 };
}
