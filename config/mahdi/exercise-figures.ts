// «الصحة العلوية»: the technique drawing of every exercise of the plan (src/lib/mahdi/health/plan.ts → EXERCISES).
// Each one is its key positions (joint angles: 0 = forward/right, 90 = down, 180 = back/left, -90 = up), its equipment,
// and the joint whose path gets the arrow. Drawn by src/lib/mahdi/health/figure.ts; a test checks every exercise has one.
import type { FigureDef, SideFrame } from "@/lib/mahdi/health/figure";

const Y = 133; // the ankle's height when the foot is flat on the floor
const FLOOR = 131; // a body part lying on the floor

/** Standing tall, arms down, the ankle at x. */
const stand = (x: number, more: Partial<SideFrame> = {}): SideFrame => ({ at: [x, Y], anchor: "ankle", thigh: 90, shin: 90, torso: -90, arm: 90, fore: 90, ...more });
/** Sitting on a seat (hip at the point), thighs forward, shins down. */
const sit = (x: number, y: number, more: Partial<SideFrame> = {}): SideFrame => ({ at: [x, y], anchor: "hip", thigh: 0, shin: 90, torso: -92, arm: 90, fore: 90, ...more });

export const FIGURES: Record<string, FigureDef> = {
  // ── الفخذ الأمامي ──
  "back-squat": {
    frames: [stand(100, { arm: 130, fore: -60 }), stand(100, { thigh: 12, shin: 118, torso: -58, arm: 162, fore: -28 })],
    hold: "barbell",
    holdAt: "shoulder",
    track: "hip",
  },
  "leg-press": {
    frames: [
      { at: [72, 104], anchor: "hip", thigh: -75, shin: 12, foot: -135, torso: -140, arm: 110, fore: 60 },
      { at: [72, 104], anchor: "hip", thigh: -50, shin: -40, foot: -135, torso: -140, arm: 110, fore: 60 },
    ],
    props: [
      { t: "bench", a: [64, 112], b: [44, 88], legs: false },
      { t: "bench", a: [60, 111], b: [86, 111] },
      { t: "plate", at: "toe", angle: -135, len: 26 },
    ],
    track: "ankle",
  },
  "goblet-squat": {
    frames: [stand(100, { arm: 70, fore: -80 }), stand(100, { thigh: 12, shin: 118, torso: -66, arm: 94, fore: -56 })],
    hold: "dumbbell",
    track: "hip",
  },
  "bw-squat": {
    frames: [stand(100, { arm: 0, fore: 0 }), stand(100, { thigh: 10, shin: 120, torso: -60, arm: -5, fore: -5 })],
    track: "hip",
  },
  "box-squat": {
    frames: [stand(110, { arm: 0, fore: 0 }), stand(110, { thigh: 0, shin: 112, torso: -62, arm: -5, fore: -5 })],
    props: [{ t: "under", joint: "hip", frame: 1, w: 30, dx: -6, gap: 6, kind: "chair" }],
    track: "hip",
  },
  "split-squat": {
    frames: [
      { at: [122, Y], anchor: "ankle", thigh: 72, shin: 96, thigh2: 116, shin2: 108, foot2: 40, torso: -90, arm: 90, fore: 90 },
      { at: [122, Y], anchor: "ankle", thigh: 6, shin: 98, thigh2: 98, shin2: 172, foot2: 8, torso: -90, arm: 90, fore: 90 },
    ],
    track: "hip",
  },
  bulgarian: {
    frames: [
      { at: [128, Y], anchor: "ankle", thigh: 66, shin: 98, thigh2: 122, shin2: 150, foot2: 175, torso: -88, arm: 90, fore: 90 },
      { at: [128, Y], anchor: "ankle", thigh: 8, shin: 104, thigh2: 100, shin2: 178, foot2: 175, torso: -82, arm: 90, fore: 90 },
    ],
    props: [{ t: "under", joint: "ankle2", frame: 0, w: 44, dx: -8, gap: 4, kind: "box" }],
    track: "hip",
  },
  "leg-ext": {
    frames: [sit(78, 100, { torso: -98, arm: 100, fore: 60 }), sit(78, 100, { torso: -98, shin: 4, foot: -86, arm: 100, fore: 60 })],
    props: [
      { t: "under", joint: "hip", frame: 0, w: 36, dx: 8, gap: 5, kind: "bench" },
      { t: "bench", a: [72, 104], b: [66, 64], legs: false },
      { t: "pad", at: "ankle", dx: 3, dy: 0 },
    ],
    track: "ankle",
  },

  // ── الخلفية والورك ──
  rdl: {
    frames: [stand(100, { thigh: 88, shin: 94 }), stand(100, { thigh: 76, shin: 96, torso: -12, arm: 90, fore: 90 })],
    hold: "barbell",
    track: "hip",
  },
  deadlift: {
    frames: [stand(100, { thigh: 25, shin: 108, torso: -38, arm: 90, fore: 90 }), stand(100)],
    hold: "barbell",
    track: "hip",
  },
  "hip-hinge-band": {
    frames: [stand(100, { thigh: 88, shin: 94 }), stand(100, { thigh: 76, shin: 96, torso: -28 })],
    props: [{ t: "band", from: [104, 133], to: "wrist" }],
    track: "hip",
  },
  "sl-rdl": {
    frames: [stand(100, { thigh2: 98, shin2: 96, foot2: 40 }), stand(100, { thigh: 84, shin: 94, torso: -6, thigh2: 178, shin2: 178, foot2: 100 })],
    track: "ankle2",
  },
  "good-morning": {
    frames: [stand(100, { thigh: 88, shin: 94, arm: -60, fore: -160 }), stand(100, { thigh: 76, shin: 96, torso: -14, arm: 16, fore: -84 })],
    track: "head",
  },

  // ── المؤخرة ──
  "hip-thrust": {
    frames: [
      { at: [132, Y], anchor: "ankle", thigh: -22, shin: 75, torso: -168, arm: 20, fore: -10 },
      { at: [132, Y], anchor: "ankle", thigh: 0, shin: 90, torso: 180, arm: 8, fore: -8 },
    ],
    props: [{ t: "under", joint: "shoulder", frame: 1, w: 34, dx: -6, gap: 5, kind: "bench" }],
    hold: "barbell",
    holdAt: "hip",
    track: "hip",
  },
  "glute-bridge": {
    frames: [
      { at: [124, Y], anchor: "ankle", thigh: -32, shin: 64, torso: 180, arm: 6, fore: 2 },
      { at: [124, Y], anchor: "ankle", thigh: -6, shin: 82, torso: 164, arm: 22, fore: 14 },
    ],
    track: "hip",
  },
  "cable-kickback": {
    frames: [
      { at: [100, Y], anchor: "ankle2", thigh: 92, shin: 94, thigh2: 90, shin2: 90, torso: -76, arm: 4, fore: -8 },
      { at: [100, Y], anchor: "ankle2", thigh: 150, shin: 158, foot: 110, thigh2: 90, shin2: 90, foot2: 0, torso: -72, arm: 4, fore: -8 },
    ],
    props: [
      { t: "post", x: 152, top: 30 },
      { t: "cable", from: [148, 128], to: "ankle" },
    ],
    track: "ankle",
  },
  "step-up": {
    frames: [
      { at: [120, 107], anchor: "ankle", thigh: -18, shin: 96, thigh2: 108, shin2: 96, foot2: 0, torso: -80, arm: 90, fore: 90 },
      { at: [120, 107], anchor: "ankle", thigh: 90, shin: 90, thigh2: 70, shin2: 118, foot2: 40, torso: -90, arm: 90, fore: 90 },
    ],
    props: [{ t: "box", x: 104, y: 111, w: 44 }],
    track: "hip",
  },
  "side-clam": {
    frames: [
      { view: "front", at: [116, 117], rot: -90, armR: 96, foreR: 92, armL: -96, foreL: -40, thighR: 92, shinR: 88, thighL: 92, shinL: 88, legReach: 0.7 },
      { view: "front", at: [116, 117], rot: -90, armR: 96, foreR: 92, armL: -96, foreL: -40, thighR: 42, shinR: 128, thighL: 92, shinL: 88, legReach: 0.7 },
    ],
    track: "kneeR",
  },

  // ── الفخذ الخلفي ──
  "leg-curl": {
    frames: [sit(80, 100, { torso: -98, shin: 6, foot: -84, arm: 100, fore: 60 }), sit(80, 100, { torso: -98, shin: 118, foot: 28, arm: 100, fore: 60 })],
    props: [
      { t: "under", joint: "hip", frame: 0, w: 36, dx: 8, gap: 5, kind: "bench" },
      { t: "bench", a: [74, 104], b: [68, 64], legs: false },
      { t: "pad", at: "ankle", dx: 0, dy: 5 },
      { t: "pad", at: "knee", dx: -6, dy: -6 },
    ],
    track: "ankle",
  },
  "db-leg-curl": {
    frames: [
      { at: [100, 124], anchor: "hip", thigh: 180, shin: 180, foot: 180, torso: 0, arm: 120, fore: 0 },
      { at: [100, 124], anchor: "hip", thigh: 180, shin: 278, foot: 180, torso: 0, arm: 120, fore: 0 },
    ],
    props: [{ t: "bench", a: [56, 129], b: [150, 129] }],
    hold: "dumbbell",
    holdAt: "ankle",
    track: "ankle",
  },
  "ham-slide": {
    frames: [
      { at: [52, FLOOR], anchor: "shoulder", thigh: -24, shin: 68, torso: 166, arm: 10, fore: 4 },
      { at: [52, FLOOR], anchor: "shoulder", thigh: 6, shin: 10, foot: -80, torso: 174, arm: 10, fore: 4 },
    ],
    props: [{ t: "pad", at: "ankle", dx: 0, dy: 3 }],
    track: "ankle",
  },

  // ── السمانة ──
  "calf-raise": {
    frames: [
      { at: [118, 111], anchor: "toe", thigh: 90, shin: 90, foot: -22, torso: -90, arm: 90, fore: 90 },
      { at: [118, 111], anchor: "toe", thigh: 90, shin: 90, foot: 38, torso: -90, arm: 90, fore: 90 },
    ],
    props: [{ t: "box", x: 112, y: 113, w: 40 }],
    track: "ankle",
  },

  // ── الصدر ──
  bench: {
    frames: [
      { at: [112, 98], anchor: "hip", thigh: 28, shin: 96, torso: 180, arm: -90, fore: -90 },
      { at: [112, 98], anchor: "hip", thigh: 28, shin: 96, torso: 180, arm: 64, fore: -104 },
    ],
    props: [{ t: "bench", a: [58, 103], b: [120, 103] }],
    hold: "barbell",
    track: "wrist",
  },
  "incline-db": {
    frames: [
      { at: [112, 104], anchor: "hip", thigh: 14, shin: 96, torso: -148, arm: -96, fore: -96 },
      { at: [112, 104], anchor: "hip", thigh: 14, shin: 96, torso: -148, arm: 56, fore: -112 },
    ],
    props: [
      { t: "bench", a: [117, 109], b: [86, 89] },
      { t: "bench", a: [102, 110], b: [122, 110] },
    ],
    hold: "dumbbell",
    track: "wrist",
  },
  "chest-press": {
    frames: [sit(86, 100, { arm: 150, fore: 0, torso: -94 }), sit(86, 100, { arm: 2, fore: 0, torso: -94 })],
    props: [
      { t: "under", joint: "hip", frame: 0, w: 32, dx: 6, gap: 5, kind: "chair" },
      { t: "bench", a: [80, 102], b: [78, 62], legs: false },
      { t: "post", x: 58, top: 40 },
    ],
    hold: "handle",
    track: "wrist",
  },
  pushup: {
    frames: [
      { at: [40, Y], anchor: "toe", thigh: 156, shin: 156, foot: 110, torso: -24, arm: 92, fore: 90 },
      { at: [40, Y], anchor: "toe", thigh: 174, shin: 174, foot: 100, torso: -6, arm: -146, fore: 70 },
    ],
    track: "shoulder",
  },
  "incline-pushup": {
    frames: [
      { at: [48, Y], anchor: "toe", thigh: 140, shin: 140, foot: 95, torso: -40, arm: 52, fore: 52 },
      { at: [48, Y], anchor: "toe", thigh: 146, shin: 146, foot: 95, torso: -34, arm: 128, fore: 8 },
    ],
    props: [{ t: "under", joint: "wrist", frame: 0, w: 40, dx: 6, gap: 3, kind: "bench" }],
    track: "shoulder",
  },
  "decline-pushup": {
    frames: [
      { at: [44, 96], anchor: "toe", thigh: -176, shin: -176, foot: 100, torso: 4, arm: 92, fore: 90 },
      { at: [44, 96], anchor: "toe", thigh: -160, shin: -160, foot: 100, torso: 20, arm: -150, fore: 74 },
    ],
    props: [{ t: "box", x: 14, y: 99, w: 40 }],
    track: "shoulder",
  },
  "cable-fly": {
    frames: [
      { view: "front", at: [100, 85], armR: -8, foreR: 4 },
      { view: "front", at: [100, 85], armR: 150, foreR: 175, reach: 0.55 },
    ],
    props: [
      { t: "post", x: 18, top: 16 },
      { t: "post", x: 182, top: 16 },
      { t: "cable", from: [24, 30], to: "wristL" },
      { t: "cable", from: [176, 30], to: "wristR" },
    ],
    track: "wristR",
  },
  "db-fly": {
    frames: [
      { view: "front", at: [100, 92], armR: -100, foreR: -90 },
      { view: "front", at: [100, 92], armR: 8, foreR: -6 },
    ],
    hold: "dumbbell",
    track: "wristR",
  },

  // ── الظهر (عرض) ──
  pulldown: {
    frames: [sit(84, 104, { torso: -100, arm: -82, fore: -86 }), sit(84, 104, { torso: -104, arm: 96, fore: -58 })],
    props: [
      { t: "under", joint: "hip", frame: 0, w: 32, dx: 6, gap: 5, kind: "chair" },
      { t: "pad", at: "knee", dx: 0, dy: -6 },
      { t: "post", x: 128, top: 6 },
      { t: "cable", from: [92, 10], to: "wrist" },
    ],
    hold: "handle",
    track: "wrist",
  },
  pullup: {
    frames: [
      { at: [100, 22], anchor: "wrist", thigh: 96, shin: 112, torso: -92, arm: -90, fore: -90 },
      { at: [100, 22], anchor: "wrist", thigh: 96, shin: 112, torso: -94, arm: 118, fore: -76 },
    ],
    props: [{ t: "bar", at: [100, 22] }],
    track: "head",
    floor: false,
  },
  "band-pulldown": {
    frames: [
      { at: [96, FLOOR + 1], anchor: "knee", thigh: 90, shin: 180, foot: 100, torso: -92, arm: -82, fore: -86 },
      { at: [96, FLOOR + 1], anchor: "knee", thigh: 90, shin: 180, foot: 100, torso: -96, arm: 96, fore: -58 },
    ],
    props: [
      { t: "wall", x: 150, top: 4 },
      { t: "band", from: [148, 10], to: "wrist" },
    ],
    track: "wrist",
  },
  "towel-pulldown": {
    frames: [
      { view: "front", at: [100, 92], armR: -62, foreR: -80 },
      { view: "front", at: [100, 92], armR: 18, foreR: -92 },
    ],
    props: [{ t: "towel", from: { joint: "wristL" }, to: "wristR" }],
    track: "wristR",
  },
  superman: {
    frames: [
      { at: [96, 126], anchor: "hip", thigh: 180, shin: 180, foot: 180, torso: 0, arm: 0, fore: 0 },
      { at: [96, 126], anchor: "hip", thigh: -168, shin: -166, foot: -166, torso: -12, arm: -18, fore: -18 },
    ],
    track: "wrist",
  },

  // ── الظهر (سماكة) ──
  "seated-row": {
    frames: [
      { at: [70, 110], anchor: "hip", thigh: -6, shin: 18, foot: -90, torso: -76, arm: 6, fore: 6 },
      { at: [70, 110], anchor: "hip", thigh: -6, shin: 18, foot: -90, torso: -94, arm: 128, fore: 14 },
    ],
    props: [
      { t: "under", joint: "hip", frame: 0, w: 40, dx: 0, gap: 5, kind: "bench" },
      { t: "post", x: 168, top: 90 },
      { t: "cable", from: [164, 104], to: "wrist" },
      { t: "plate", at: "toe", angle: 90, len: 20 },
    ],
    hold: "handle",
    track: "wrist",
  },
  "db-row": {
    frames: [
      { at: [82, 86], anchor: "hip", thigh: 100, shin: 92, thigh2: 90, shin2: 178, foot2: 180, torso: -4, arm: 90, fore: 90, arm2: 92, fore2: 88 },
      { at: [82, 86], anchor: "hip", thigh: 100, shin: 92, thigh2: 90, shin2: 178, foot2: 180, torso: -4, arm: -152, fore: 92, arm2: 92, fore2: 88 },
    ],
    props: [{ t: "bench", a: [52, 116], b: [126, 116] }],
    hold: "dumbbell",
    track: "wrist",
  },
  "band-row": {
    frames: [
      { at: [70, 126], anchor: "hip", thigh: -2, shin: 4, foot: -90, torso: -76, arm: 4, fore: 4 },
      { at: [70, 126], anchor: "hip", thigh: -2, shin: 4, foot: -90, torso: -94, arm: 128, fore: 14 },
    ],
    props: [{ t: "band", from: { joint: "toe" }, to: "wrist" }],
    track: "wrist",
  },
  "barbell-row": {
    frames: [stand(100, { thigh: 74, shin: 98, torso: -38, arm: 90, fore: 90 }), stand(100, { thigh: 74, shin: 98, torso: -38, arm: -172, fore: 60 })],
    hold: "barbell",
    track: "wrist",
  },
  "table-row": {
    frames: [
      { at: [38, Y], anchor: "ankle", thigh: 166, shin: 166, foot: -80, torso: -14, arm: -84, fore: -84 },
      { at: [38, Y], anchor: "ankle", thigh: 156, shin: 156, foot: -80, torso: -24, arm: 132, fore: -42 },
    ],
    props: [{ t: "under", joint: "wrist", frame: 0, w: 70, dx: 4, gap: -6, kind: "bench" }],
    track: "shoulder",
  },
  "door-row": {
    frames: [
      { at: [118, Y], anchor: "ankle", thigh: 66, shin: 70, torso: -116, arm: -14, fore: -14 },
      { at: [118, Y], anchor: "ankle", thigh: 82, shin: 82, torso: -96, arm: 130, fore: -10 },
    ],
    props: [
      { t: "wall", x: 156, top: 6 },
      { t: "towel", from: [154, 78], to: "wrist" },
    ],
    track: "shoulder",
  },

  // ── الكتف ──
  ohp: {
    frames: [stand(100, { arm: 74, fore: -92 }), stand(100, { arm: -88, fore: -90 })],
    hold: "barbell",
    track: "wrist",
  },
  "seated-db-press": {
    frames: [sit(84, 102, { arm: 96, fore: -86 }), sit(84, 102, { arm: -90, fore: -90 })],
    props: [
      { t: "under", joint: "hip", frame: 0, w: 32, dx: 6, gap: 5, kind: "chair" },
      { t: "bench", a: [78, 104], b: [76, 58], legs: false },
    ],
    hold: "dumbbell",
    track: "wrist",
  },
  "pike-pushup": {
    frames: [
      { at: [138, FLOOR], anchor: "wrist", thigh: 125, shin: 125, foot: 100, torso: 37, arm: 47, fore: 47 },
      { at: [138, FLOOR], anchor: "wrist", thigh: 118, shin: 118, foot: 100, torso: 64, arm: 118, fore: 40 },
    ],
    track: "head",
  },
  "wall-press": {
    frames: [stand(100, { torso: -96, arm: 74, fore: -92 }), stand(100, { torso: -96, arm: -92, fore: -92 })],
    props: [{ t: "wall", x: 82, top: 4 }],
    track: "wrist",
  },
  "lateral-raise": {
    frames: [
      { view: "front", at: [100, 86], armR: 82, foreR: 78 },
      { view: "front", at: [100, 86], armR: 2, foreR: -4 },
    ],
    hold: "dumbbell",
    track: "wristR",
  },
  "bottle-raise": {
    frames: [
      { view: "front", at: [100, 86], armR: 82, foreR: 78 },
      { view: "front", at: [100, 86], armR: 2, foreR: -4 },
    ],
    hold: "bottle",
    track: "wristR",
  },
  "face-pull": {
    frames: [stand(96, { arm: -14, fore: -10 }), stand(96, { arm: -176, fore: -52 })],
    props: [
      { t: "post", x: 172, top: 20 },
      { t: "cable", from: [168, 44], to: "wrist" },
    ],
    hold: "handle",
    track: "wrist",
  },
  "band-pull-apart": {
    frames: [
      { view: "front", at: [100, 88], armR: -2, foreR: -2, reach: 0.18 },
      { view: "front", at: [100, 88], armR: -2, foreR: -2, reach: 1 },
    ],
    props: [{ t: "band", from: { joint: "wristL" }, to: "wristR" }],
    track: "wristR",
  },
  "rear-fly": {
    frames: [
      { view: "front", at: [100, 104], armR: 92, foreR: 90, torsoScale: 0.55, thighR: 60, shinR: 100, legReach: 0.6 },
      { view: "front", at: [100, 104], armR: 4, foreR: 0, torsoScale: 0.55, thighR: 60, shinR: 100, legReach: 0.6 },
    ],
    props: [{ t: "bench", a: [76, 108], b: [124, 108] }],
    hold: "dumbbell",
    track: "wristR",
  },
  ytw: {
    frames: [
      { view: "front", at: [96, 74], rot: 90, armR: -55, foreR: -55 },
      { view: "front", at: [96, 74], rot: 90, armR: 0, foreR: 0 },
      { view: "front", at: [96, 74], rot: 90, armR: 32, foreR: -58 },
    ],
    props: [{ t: "panel", x: 6, y: 34, w: 188, h: 80 }],
    track: "wristR",
    floor: false,
  },
  "wall-angel": {
    frames: [
      { view: "front", at: [100, 88], armR: 12, foreR: -90 },
      { view: "front", at: [100, 88], armR: -52, foreR: -62 },
    ],
    props: [{ t: "panel", x: 50, y: 6, w: 100, h: 128 }],
    track: "wristR",
  },

  // ── الذراع ──
  "db-curl": { frames: [stand(100), stand(100, { fore: -62 })], hold: "dumbbell", track: "wrist" },
  "cable-curl": {
    frames: [stand(96), stand(96, { fore: -62 })],
    props: [
      { t: "post", x: 158, top: 40 },
      { t: "cable", from: [154, 128], to: "wrist" },
    ],
    hold: "handle",
    track: "wrist",
  },
  "hammer-curl": { frames: [stand(100), stand(100, { fore: -62 })], hold: "handle", track: "wrist" },
  "towel-curl": {
    frames: [sit(84, 100, { shin: 92, foot: 0 }), sit(84, 100, { shin: 72, foot: -16, fore: -60 })],
    props: [
      { t: "under", joint: "hip", frame: 0, w: 32, dx: 2, gap: 5, kind: "chair" },
      { t: "towel", from: { joint: "toe" }, to: "wrist" },
    ],
    track: "wrist",
  },
  "bag-curl": { frames: [stand(100), stand(100, { fore: -62 })], hold: "bag", track: "wrist" },
  pushdown: {
    frames: [stand(98, { torso: -84, arm: 96, fore: -26 }), stand(98, { torso: -84, arm: 96, fore: 94 })],
    props: [
      { t: "post", x: 140, top: 8 },
      { t: "cable", from: [136, 14], to: "wrist" },
    ],
    hold: "handle",
    track: "wrist",
  },
  "overhead-ext": {
    frames: [sit(84, 102, { arm: -82, fore: 140 }), sit(84, 102, { arm: -82, fore: -86 })],
    props: [
      { t: "under", joint: "hip", frame: 0, w: 32, dx: 6, gap: 5, kind: "chair" },
      { t: "bench", a: [78, 104], b: [76, 58], legs: false },
    ],
    hold: "dumbbell",
    track: "wrist",
  },
  "bench-dip": {
    frames: [
      { at: [64, 96], anchor: "wrist", thigh: -4, shin: 70, foot: -20, torso: -88, arm: 104, fore: 100 },
      { at: [64, 96], anchor: "wrist", thigh: 14, shin: 64, foot: -26, torso: -84, arm: 152, fore: 62 },
    ],
    props: [{ t: "under", joint: "wrist", frame: 0, w: 34, dx: -10, gap: 3, kind: "chair" }],
    track: "shoulder",
  },
  "diamond-pushup": {
    frames: [
      { at: [40, Y], anchor: "toe", thigh: 156, shin: 156, foot: 110, torso: -24, arm: 92, fore: 90 },
      { at: [40, Y], anchor: "toe", thigh: 174, shin: 174, foot: 100, torso: -6, arm: -164, fore: 64 },
    ],
    track: "shoulder",
  },
  "wall-tri": {
    frames: [
      { at: [104, Y], anchor: "ankle", thigh: 112, shin: 112, torso: -66, arm: -6, fore: -90 },
      { at: [104, Y], anchor: "ankle", thigh: 104, shin: 104, torso: -76, arm: -14, fore: -14 },
    ],
    props: [{ t: "wall", x: 158, top: 4 }],
    track: "shoulder",
  },

  // ── البطن والثبات ──
  plank: {
    frames: [{ at: [40, Y], anchor: "toe", thigh: 168, shin: 168, foot: 104, torso: -12, arm: 90, fore: 0 }],
    pulse: "hip",
  },
  pallof: {
    frames: [
      { view: "front", top: true, at: [96, 56], armR: 120, foreR: 160, reach: 0.5 },
      { view: "front", top: true, at: [96, 56], armR: 110, foreR: 110, reach: 1 },
    ],
    props: [
      { t: "post", x: 188, top: 6 },
      { t: "cable", from: [184, 70], to: "wristR" },
    ],
    track: "wristR",
    floor: false,
  },
  "dead-bug": {
    frames: [
      { at: [104, 128], anchor: "hip", thigh: -90, shin: 0, torso: 180, arm: -90, fore: -90, thigh2: -90, shin2: 0, arm2: -90, fore2: -90 },
      { at: [104, 128], anchor: "hip", thigh: -12, shin: -8, foot: -80, torso: 180, arm: -176, fore: -178, thigh2: -90, shin2: 0, arm2: -90, fore2: -90 },
    ],
    track: "wrist",
  },
  "bird-dog": {
    frames: [
      { at: [84, FLOOR + 1], anchor: "knee", thigh: 90, shin: 180, foot: 180, thigh2: 90, shin2: 180, foot2: 180, torso: -14, arm: 90, fore: 90, arm2: 90, fore2: 90 },
      { at: [84, FLOOR + 1], anchor: "knee", thigh: 90, shin: 180, foot: 180, thigh2: 186, shin2: 186, foot2: 186, torso: -14, arm: -6, fore: -6, arm2: 90, fore2: 90 },
    ],
    track: "wrist",
  },
  "side-plank-knee": {
    frames: [
      { at: [62, FLOOR + 1], anchor: "knee", thigh: 176, shin: 205, torso: -24, arm: 92, fore: 0, foreScale: 0.4, arm2: 40, fore2: 70 },
      { at: [62, FLOOR + 1], anchor: "knee", thigh: 166, shin: 205, torso: -14, arm: 92, fore: 0, foreScale: 0.4, arm2: 40, fore2: 70 },
    ],
    pulse: "hip",
  },
  kegel: {
    frames: [{ at: [104, 126], anchor: "hip", thigh: -40, shin: 62, torso: 180, arm: 6, fore: 2 }],
    pulse: "hip",
  },
};
