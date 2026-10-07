// «حيدرة كت» — what «حيدرة» is taught beyond the basic commands: the colour grading (the model, its numbers and how
// a colourist uses them), the crop, the timelines and Nest. Pure text, built from the editor's own lists so it never
// names a log, a look or a field that doesn't exist.

import { LOGS, LOOKS, NEUTRAL_GRADE, MAX_LAYERS, gradeIsNeutral, type Grade, type Mask, type Wheel } from "./grade";

export const GRADE_COMMANDS = `- COLOUR GRADING («التلوين», pictures/videos and Nest clips): {"type":"update_clip","clipId":ID,"patch":{"grade":{...,"layer":N?}}} merges the fields into grading layer N (0 = the first, up to ${MAX_LAYERS - 1}; a layer past the last is created). Wheels, curves, split, halation, grain and vignette merge field by field (send only what changes). {"grade":null} removes all grading; {"grades":[...]} replaces the whole list of layers (to delete or reorder layers). The layers run in order, each on the result of the one before. Fields:
  on BOOL (layer switched on), name TEXT (Arabic, e.g. «أساسي», «لوك», «البشرة»), amount 0–1 (strength of the whole layer),
  log ID (the camera's log curve, undone first: ${LOGS.map((l) => l.id).join(", ")}), logGamut "camera"|"rec709"|"rec2020" (the gamut the camera recorded in; Canon/Sony/Panasonic let you pick), logRange "video"|"full" (almost always "video"), compress 0–1 (gamut compression: neon/LED colours pulled back softly; 1 = on),
  exposure −5…5 stops, contrast 0.2–3 (1 = none) around pivot 0–1 (0.435 = middle grey), temp −1…1 (+ = warmer), tint −1…1 (+ = magenta, − = green), saturation 0–3 (1 = none), vibrance −1…1 (saturates the dull colours, spares skin), highlights/shadows/whites/blacks −1…1,
  lift/gamma/gain/offset wheels {"rgb":[r,g,b] each −1…1 (small: 0.01–0.1), "y": −1…1 brightness of that range} (lift = shadows, gamma = mid-tones, gain = highlights, offset = everything),
  curves {master,r,g,b: points [{x,y}] 0–1 from (0,0) to (1,1); hueHue,hueSat,hueLum: x = hue 0–1, y 0.5 = unchanged; lumSat: x = brightness; satSat: x = saturation} (only the curves sent change),
  look ID or null (a ready look applied as a starting point; it keeps the log, the window and the secondaries: ${LOOKS.map((l) => l.id).join(", ")}),
  split {shadowHue,highHue 0–1, shadowSat,highSat 0–1, balance −1…1} (split toning), halation {amount,threshold,size}, grain {amount,size}, vignette {amount −1…1 (+ = darker edges), size, soft, round}, sharpen 0–1,
  mask {kind "ellipse"|"rect"|"linear"|"path", x,y (centre, 0–1 of the picture), w,h (size), rotate (degrees), feather 0–1, round, invert BOOL, points [{x,y}] (path), keys [{t: ms from the clip's own start, x, y}] (the window follows a moving subject)} or null: where the layer applies,
  secondaries [{on, name, key {hue 0–1, hueWidth 0–0.5, hueSoft 0–0.5, satLo,satHi,lumLo,lumHi 0–1, soft, invert, grow −1…1, blur 0–1}, mask (as above) or null, hue (degrees −180…180), sat (×, 1 = none), lum (stops), temp, contrast, show false}] (one colour picked and changed alone; the whole list is sent).
  The old "color" patch is the simple filter of the «تعديل» tab; for any real colour work use "grade".
- {"type":"update_clip","clipId":ID,"patch":{"crop":{"l","t","r","b": 0–0.45 each, the part of each side hidden}}} – «القص»; {"crop":null} shows the whole picture again.
- TIMELINES («التسلسلات»): {"type":"seq_new","name"?}, {"type":"seq_open","id"}, {"type":"seq_rename","id","name"}, {"type":"seq_duplicate","id"}, {"type":"seq_delete","id"} (ids from "sequences"). Opening another timeline changes what the other commands work on, so put seq_open last in an answer.
- {"type":"nest","clipIds":[IDs],"name"?} – «Nest»: the clips go into a new timeline that takes their place as one clip (it plays and exports like them; its volume and grading apply to all of them).
- {"type":"remove_key","clipId","at"}, {"type":"clear_keys","clipId"} – motion points; {"type":"close_gaps","trackId"?}; {"type":"remove_track","trackId"}; {"type":"update_track","trackId","patch":{"name"|"color"}}.`;

export const GRADING_KNOW_HOW = `COLOUR GRADING — HOW A COLOURIST WORKS (follow this when asked to colour, fix the colours, make it cinematic, match shots, fix skin, or undo a log):
1. LOOK FIRST. When pictures of the clip are attached, judge them: is it flat and grey (log footage), too dark/bright, too warm/cold/green/magenta, are the blacks lifted or the whites clipped, how does the skin look. Say in one line what you see before the fix. No pictures attached (no clip selected) and the request is about how a clip looks: grade from what you know if the ask is clear («دفّئه», «فك اللوق كانون»), else ask the person to select the clip so you can see it.
2. LOG. Washed-out, grey, low-contrast footage from a cinema or mirrorless camera is usually log: set "log" for that camera (ask the camera only if you can't tell). Canon: C-Log3 = "clog3" (R5, R6 II, R7, R8, C70); its gamut is "camera" (Cinema Gamut) or "rec709" depending on the camera setting. iPhone 15 Pro+ ProRes Log = "applelog"; Sony = "slog3"; DJI = "dlog". After decoding, grey sits at about 41% like DaVinci's CST; then correct exposure. Never use a log on normal (Rec.709 / phone) footage.
3. BALANCE (layer 0, named «أساسي»): neutralise the white balance with temp/tint until white and grey things are neutral; then exposure so faces sit around 55–70% brightness and the scene's middle around 40–45%; then contrast (1.05–1.25 is normal) with whites/blacks to use the full range without clipping; highlights −0.2…−0.5 to bring back a sky; shadows +0.1…+0.3 to open dark faces. Small steps: exposure ±0.1–0.7, temp/tint ±0.05–0.3.
4. COLOUR: saturation 0.9–1.15 and vibrance 0.1–0.3 (vibrance protects skin). Skin is the reference: it should fall on the skin line (orange, hue ≈ 0.05–0.09); if faces go red, green or grey, fix it with a secondary on skin (key hue 0.06, hueWidth 0.06, hueSoft 0.08, satLo 0.1, satHi 0.8) with small hue (±5°), sat (0.85–1.1) and lum changes — or a face window.
5. CREATIVE (a second layer named «لوك»): a look as a starting point with amount 0.4–0.8, or wheels: warm highlights gain rgb ≈ [0.03, 0.01, −0.03], cool shadows lift rgb ≈ [−0.02, 0, 0.03] (teal-orange), split toning for mood, a gentle S-curve on master ([{0,0},{0.25,0.22},{0.75,0.8},{1,1}]). Film finish last and subtle: halation 0.15–0.35 on night lights, grain 0.1–0.25, vignette 0.15–0.3.
6. WINDOWS (masks): to lift a face, an ellipse on it (x,y its centre, w,h about its size, feather 0.4–0.6) on its own layer with exposure +0.2–0.4; to darken the background, the same ellipse with invert true and exposure −0.3; a sky: "linear" from the horizon up. When the subject moves, add "keys" (its centre at a few moments of the clip, ms from the clip's start) so the window follows it.
7. MATCHING: shots of one scene must look alike: balance each clip first (its own layer 0), then the same creative layer on all (same look, same numbers). Compare skin and the brightness of the faces.
8. HUES (0–1): red 0, orange 0.08, yellow 0.16, green 0.33, cyan 0.5, blue 0.66, purple 0.75, magenta 0.83.
9. NEVER overdo: a good grade is mostly invisible. Keep the person's existing layers unless asked: change the layer that does the job, add a layer for a new idea, and say which layer you changed. The before/after compare in the colour tab («قبل» / «قسمة») shows the difference.`;

const r2 = (n: number) => Math.round(n * 1000) / 1000;
const wheelSet = (w: Wheel) => w.y !== 0 || w.rgb.some((x) => x !== 0);
const maskBrief = (m: Mask) => ({ kind: m.kind, x: r2(m.x), y: r2(m.y), w: r2(m.w), h: r2(m.h), ...(m.invert ? { invert: true } : {}), ...(m.keys.length ? { keys: m.keys.length } : {}) });

/** A grading layer as Claude is shown it: only what differs from neutral (a LUT by its name, curves by which changed). */
export function gradeBrief(g: Grade) {
  const out: Record<string, unknown> = {};
  const n = NEUTRAL_GRADE as unknown as Record<string, unknown>;
  const o = g as unknown as Record<string, unknown>;
  for (const k of ["on", "name", "log", "logGamut", "logRange", "compress", "amount", "exposure", "contrast", "pivot", "temp", "tint", "saturation", "vibrance", "highlights", "shadows", "whites", "blacks", "look", "sharpen"]) {
    if (o[k] !== n[k]) out[k] = typeof o[k] === "number" ? r2(o[k] as number) : o[k];
  }
  for (const k of ["lift", "gamma", "gain", "offset"] as const) if (wheelSet(g[k])) out[k] = { rgb: g[k].rgb.map(r2), y: r2(g[k].y) };
  const curves = (Object.keys(g.curves) as (keyof Grade["curves"])[]).filter((k) => JSON.stringify(g.curves[k]) !== JSON.stringify(NEUTRAL_GRADE.curves[k]));
  if (curves.length) out.curves = Object.fromEntries(curves.map((k) => [k, g.curves[k].map((p) => ({ x: r2(p.x), y: r2(p.y) }))]));
  if (g.split.shadowSat || g.split.highSat) out.split = g.split;
  if (g.halation.amount) out.halation = g.halation;
  if (g.grain.amount) out.grain = g.grain;
  if (g.vignette.amount) out.vignette = g.vignette;
  if (g.lut) out.lut = { name: g.lut.name, amount: g.lutAmount };
  if (g.mask) out.mask = maskBrief(g.mask);
  if (g.secondaries.length) out.secondaries = g.secondaries.map((s) => ({ name: s.name, on: s.on, key: { hue: r2(s.key.hue), hueWidth: r2(s.key.hueWidth) }, hue: s.hue, sat: r2(s.sat), lum: r2(s.lum), ...(s.mask ? { mask: maskBrief(s.mask) } : {}) }));
  return gradeIsNeutral(g) && !g.name ? { neutral: true, ...out } : out;
}
