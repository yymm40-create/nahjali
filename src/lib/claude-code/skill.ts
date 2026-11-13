// «Claude Code» — the one way of working that the site's robots use when they EXECUTE something instead of only
// talking about it, the way «مختبر الموشن» makes motion: Claude writes a program for the task, the person's browser
// runs it in a sandbox (src/lib/claude-code/compute.ts, or the scene page for pictures), any bug goes back to him to
// fix, then he LOOKS at what it produced (the pictures, the timeline after), scores it like a harsh expert and rewrites
// it until it passes, and only then is it applied. Pure text and numbers.

import { AUDIO_KIT_API, EDIT_KIT_API, GRADE_KIT_API, GRADE_LUT_SIZE, LAYOUT_KIT_API } from "./compute";

/** Every round of a program: write → run → (fix) → look → score; it is applied only when every score is ≥ PASS. */
export const CODE_PASS = 8;
/** One review and at most one rewrite (the owner, 2 November 2026: a grade must not cost 6 riyals) */
export const CODE_ROUNDS = 2;
/**
 * What one program job (write + its reviews and fixes) may spend, in halalas the person pays: once a job has spent this
 * the page stops asking for more rounds and applies the best it has. Shown with the result.
 */
export const CODE_BUDGET_HALALAS = 150;

/**
 * The last review round's instruction: nothing runs after it, so no rewritten program is asked for (it was written in
 * full, with its thinking, and then thrown away by the page — the most expensive part of the round).
 */
export const lastRound = (round: number) => (round >= CODE_ROUNDS ? " THIS IS THE LAST ROUND: score and judge only — return code as an empty string (no rewrite runs after this round)." : "");
/** Fixes of a program that threw (or broke a rule) before it is looked at. */
export const CODE_FIXES = 2;

export const CLAUDE_CODE_WAY = `THE CLAUDE CODE WAY (how you execute): you do not hand-pick numbers or guess commands one by one — you WRITE A PROGRAM that does the job exactly, the person's browser runs it in a sandbox, you get its errors to fix, then you LOOK at what it made and judge it like a harsh expert. Nothing reaches the person's project until it passes. Write complete, readable, deterministic JavaScript (no network, no DOM, no clocks, no Math.random: a program gives the same answer every time). A bug must throw so you see it; never hide one in try/catch.`;

export const GRADE_RUBRIC = [
  { id: "ask", ar: "الطلب", en: "It is what the person asked for (the look, the mood, the reference) — clearly, not a timid half of it" },
  { id: "skin", ar: "البشرة", en: "Skin stays natural and alive: no orange, grey, green or magenta faces; skin sits on the skin line" },
  { id: "tone", ar: "الإضاءة", en: "Tonal range: clean, deep blacks (not lifted or faded unless a fade was asked) but not crushed, highlights rolled off to white (never clipped, never pink or orange on skin), mids with separation; nothing banded or posterised" },
  { id: "color", ar: "الألوان", en: "Colour discipline: a coherent palette, vivid where wanted but never «فاقع» (no clipped channels, no neon chroma) and never washed out, neutrals and near-whites neutral or deliberately tinted (a white wall not peach, pink or green)" },
  { id: "match", ar: "التطابق", en: "Every graded clip looks like the same film (shot to shot), and the grade holds across the moments of each clip" },
  { id: "finish", ar: "اللمسة", en: "The finish of a paid colourist: depth, separation of subject and background, a look a viewer would call cinematic" },
] as const;

export const EDIT_RUBRIC = [
  { id: "ask", ar: "الطلب", en: "It does exactly what the person asked — all of it, nothing they did not ask for" },
  { id: "flow", ar: "الانسياب", en: "The cut flows: no word cut in half, no breath or jump left on a cut, ~0.1–0.2 s of air kept around speech" },
  { id: "story", ar: "الترتيب", en: "The order makes sense (story, then energy); the strongest part first when it fits; nothing important lost" },
  { id: "pace", ar: "الإيقاع", en: "Pace fits the piece: no dead stretches, no frantic cuts, the length the person wanted" },
  { id: "clean", ar: "النظافة", en: "Technically clean: no gaps on the main track, no tiny leftover slivers (< 0.2 s), nothing overlapping by mistake, music and sound still where they belong" },
] as const;

export const GRADE_CONTRACT = `THE GRADE PROGRAM YOU WRITE — one JavaScript program (no HTML, no imports) that defines:

function grade(c, K) {
  // c = { r, g, b }: one colour of the picture as it is now, each channel 0…1 (what the screen shows: display values)
  // return [r, g, b] (or { r, g, b }) 0…1: the same colour after your grade (display values: K.encode gives them)
}
// optional — only what a LUT cannot hold (it depends on where a pixel is in the frame), put on the same layer:
function finish(K) { return { vignette: { amount: 0.15 }, halation: { amount: 0, threshold: 0.8, size: 0.5 }, grain: { amount: 0, size: 0.5 }, sharpen: 0 }; }

The page samples grade() at ${GRADE_LUT_SIZE}³ colours into a 3D LUT and puts the LUT on the clip(s) as its own grading layer, so:
- It is a pure function of the colour: no position, no time, no state. Anything that depends on where a pixel is goes in finish(K) (vignette, halation, grain, sharpen) or is not possible here — say so.
- It must be smooth: no hard thresholds (K.smoothstep, K.hueBand and the soft keys), or the LUT bands and posterises.

THE COLOURIST'S METHOD — measure, then light, then colour (this is how you grade; follow it step by step and comment each block in one short line):
0. MEASURE FIRST. Every picture comes with its scope and its Oklab line (the same units as K.oklch). Before writing a number, read them and write what you found as a comment at the top of the program:
   - Is it undecoded log? («LOOKS LIKE UNDECODED LOG», or p2 ≥ ~10 IRE with p98 ≤ ~92 and chroma mean < 0.03.) Do the clip's own layers already undo a log (its "grades now" show log)? Which camera (the person's words, the file name, the picture)?
   - THIS skin: its Oklab h (usually 40–65°), C and L, and the skin-coloured light at the top of the range (burning faces, or sun on a warm wall: look which). On undecoded log the skin h is the flat picture's: after decoding it moves (often to ~48–58°) — key it wide (width 26–30) and correct the centre from the AFTER numbers.
   - The greens (foliage is often olive, h ≈ 90–100°), the bright near-whites (a wall at h 50–65° turns peach-pink when colour is added), the cast numbers, how colourful the frame is (chroma mean / p95), clipped channels.
   Your key centres, gains and amounts come from THESE numbers, not from habit.
1. LIGHT, IN SCENE TERMS. Undecoded log → K.scene(c, { log, gamut, range }) with the camera's log (Canon R5/R6 II/R7/R8/C70 → "clog3", Cinema Gamut = "camera"; Sony → "slog3"; iPhone → "applelog"; DJI → "dlog"…; not sure → the likeliest, and say it in notes). A display picture (phone, Rec.709, or a clip whose layers already undo its log) → K.scene(c) (log "none"). Exposure in stops and the white balance as PRINTER LIGHTS: per-channel gains on scene light (like a film lab's R/G/B points) — neutralise the measured cast with its inverse; a warm afternoon sun ≈ [1.06, 1, 0.88]. Balance is done on light, before any curve.
2. TONE ON LUMINANCE ONLY. From log/scene light: K.display(lin, { grey, contrast, peak, toe, black, white }) — grey 0.10–0.115 (where the scene's middle lands), contrast 1.45–1.65; clean blacks (toe ≤ 0.004, black ≈ 0.004 takes the flare out) unless a faded/matte look is asked (toe 0.01–0.02); the path to white keeps faces from burning pink. Lower exposure until no FACE burns (the skin-coloured light at the top is a face's, not a sunlit wall's — look). From a display picture (already toned): don't tone-map again — shape contrast gently on Oklab L around ~0.6 (L += k·(L − 0.6)·bell), never per channel.
3. COLOUR, IN OKLAB (o = K.oklch(display light)):
   a. SKIN IS THE REFERENCE: skin = K.skinKey(o, the measured skin h). Pull its hue ~30% toward ~54° (onto the skin line, an even, healthy face); change its chroma only a little (−6…+10%). Everything else moves around it.
   b. QUALIFY what you change, away from skin (× (1 − skin), and only where C > ~0.01): greens K.hueBand(h, ~115, 34) with the olive side (~92, 14): rotate +6…+10° toward a verdant green and raise chroma; reds K.hueBand(h, 25, 22): +2–3° toward orange (never toward magenta); bright warm near-whites (L > 0.72, C < 0.06, h 25–85): rotate +12…+16° toward a golden cream BEFORE adding colour, or they go peach.
   c. SATURATION IS VIBRANCE, never a flat multiply: C = K.vibrant(C, amount) (0.3–0.5 natural, 0.6–0.75 vivid; skin gets ~⅓ of it), then K.ceiling(C, ~0.24; reds ~0.20, greens ~0.26): vivid, never neon. «فاقع» is a clipped channel or neon chroma; «باهت / فيد» is lifted blacks or flat chroma — avoid both unless the person asks for one.
   d. SUBTRACTIVE DENSITY: L *= 1 − k·min(C, 0.3)·(1 − 0.7·skin) with k 0.28 (clean vivid) … 0.55 (film): colourful things sit deeper, like film dyes — rich, not fluorescent.
   e. SPLIT TONE, tiny, in a/b: highlights b +0.006…+0.016, deep shadows b −0.004…−0.01 (a −0.002…−0.006): colour contrast, not a tint.
4. STAY IN GAMUT: return K.encode(K.inGamut({ L, C, h })). Never clamp a channel you pushed out yourself (that is what makes colours jump and look loud).
5. FINISH (finish(K), optional): cinematic — halation 0.15–0.3 (threshold 0.8), grain 0.1–0.2, vignette 0.15–0.25; clean and vivid — vignette ≤ 0.12, no halation, grain ≤ 0.05.
6. LOOK AGAIN (the review): the AFTER pictures come with the same numbers — compare them with BEFORE and with the targets: blacks p2 ≈ 2–6 IRE (unless a fade was asked), no face burning (the skin-coloured light at the top: is it on a face?), clipped channels ≤ ~1% (sun on a white wall may be more), skin Oklab h within ~45–62°, chroma up or down as the request says, near-whites not peach (h < 45° with C > 0.03) or green; then judge with your eyes: the faces, the greens, the whites, the depth. Fix what the numbers and the eyes show.

THE SHAPE (log footage, a vivid natural look — every number here must come from YOUR measurements):
function grade(c, K) {
  // measured: C-Log3 (flat, p2 22 IRE), skin h 51° C 0.05 burning 0%, greens olive h 96°, wall h 58° C 0.02
  var lin = K.scene(c, { log: "clog3", gamut: "camera", exposure: -1.4, printer: [1.065, 1, 0.885] }); // light + balance
  var o = K.oklch(K.display(lin, { grey: 0.108, contrast: 1.68, toe: 0.003, black: 0.0045 }));        // tone on luminance
  var skin = K.skinKey(o, 51), h = o.h + (54 - o.h) * 0.3 * skin;                                      // skin onto its line
  var green = Math.max(K.hueBand(h, 115, 34), 0.7 * K.hueBand(h, 92, 14)) * (1 - skin) * K.smoothstep(0.01, 0.03, o.C);
  var red = K.hueBand(h, 25, 22) * (1 - skin);
  var cream = K.hueBand(h, 55, 30) * K.smoothstep(0.72, 0.85, o.L) * (1 - K.smoothstep(0.03, 0.06, o.C));
  h += 9 * green + 2 * red + 16 * cream;                                                               // verdant, never magenta, golden walls
  var C = K.vibrant(o.C, 0.72 + 0.6 * green - 0.55 * skin);                                            // vibrance, not saturation
  C = K.ceiling(C, 0.24 - 0.04 * red + 0.02 * green);                                                  // vivid, never neon
  var L = o.L * (1 - 0.28 * Math.min(C, 0.3) * (1 - 0.8 * skin));                                      // dye density
  return K.encode(K.inGamut({ L: L, C: C, h: h }));                                                    // inside the display
}

${GRADE_KIT_API}`;

export const EDIT_CONTRACT = `THE EDIT PROGRAM YOU WRITE — one JavaScript program (no HTML, no imports) that defines:

function edit(T, K) {
  // T = the timeline exactly as you are shown it (tracks → clips with ids and times, library, quiet spans, speech with times)
  // return [ command, … ]: the editor's own commands as OBJECTS (the same commands you know, e.g. { type: "remove_ranges", ranges: [[a, b]] })
}

The page runs edit(T, K), checks every command against the timeline on a copy, and shows you the timeline AFTER, before anything is applied. So:
- Compute from the facts in T (quiet spans, the words with their times, clip lengths): never type a time you did not compute.
- Use only ids that are in T. Prefer one remove_ranges for many cuts (it keeps everything in sync); for reordering use move_clip; for trims trim_clip; split then delete when a part goes.
- Cuts on speech: never inside a word; keep ~120–200 ms of air before and after; join cuts nearer than ~250 ms.
- Return the whole job in one array (commands run in order, each on the result of the last).

${EDIT_KIT_API}`;

export const VOICE_RUBRIC = [
  { id: "pauses", ar: "السكتات", en: "Pauses: no dead air — every pause between phrases ≤ ~0.45 s, the silence before the first word and after the last ~0.1–0.25 s" },
  { id: "words", ar: "الكلام", en: "Nothing of the voice lost: no word, breath-start or ending cut (the speech time barely changed except the removed silence)" },
  { id: "level", ar: "التوزين", en: "Level: speech around −20…−16 dBFS RMS, steady across the recording; peaks under −1 dBFS; nothing clipped" },
  { id: "clean", ar: "النظافة", en: "Clean: no mains hum, no rumble, the room at least 35–40 dB under the voice, no DC" },
  { id: "natural", ar: "الطبيعية", en: "Natural: no pumping, no chopped or gated-sounding gaps, no thin over-filtered voice — a voiceprint must still sound like the person" },
] as const;

export const VOICE_CONTRACT = `THE CLEANING PROGRAM YOU WRITE — one JavaScript program (no HTML, no imports) that defines:

function clean(A, K) {
  // A = { rate, samples, seconds }: the person's recording, mono Float32Array −1…1
  // return a Float32Array: the cleaned recording (same rate)
}

What it is for: the recording becomes a VOICEPRINT (the voice engine learns the person's voice from it) or the reference for one reading. So it must stay the person's own natural voice — cleaned, never processed into something else. You cannot hear it: you get its measurements and a picture of its waveform; after your program runs you get the same for the result.
Build it like a dialogue editor, in this order, each step one short commented line, every threshold COMPUTED from this recording (its own noise floor and speech level), never a guessed constant:
1. K.A.dc → K.A.highpass (70–90 Hz: rumble, desk thumps) → K.A.dehum when K.A.humHz finds 50/60 Hz.
2. Silences: K.A.trim (≈150 ms kept at both ends), then K.A.removeSilences (pauses over ~450 ms shortened to ~180–250 ms of air; threshold ≈ noise floor + 6…10 dB). Never cut inside speech.
3. A gentle K.A.gate between words only if the room is loud (floorDb −12…−18, never full silence), then a light K.A.compress (ratio 2–3) only if the level swings a lot.
4. K.A.normalizeSpeech to about −18 dBFS, then K.A.limit at −1.5 dBFS, then K.A.fade (10 ms in, 30 ms out).

${AUDIO_KIT_API}`;

export const LAYOUT_RUBRIC = [
  { id: "ask", ar: "الطلب", en: "It does exactly what the person asked — every photo placed, every word written or changed as given, nothing they did not ask for" },
  { id: "composition", ar: "التكوين", en: "One clear hero and reading order, balanced margins, nothing cut by the edge, related things grouped, deliberate negative space" },
  { id: "faces", ar: "الوجوه", en: "Every face and every word is visible and uncovered (no text or shape over a face, nothing hiding a word)" },
  { id: "type", ar: "الخط", en: "Arabic text readable at phone size: clear hierarchy (size and weight), ≤ 2 families, contrast with what is behind it, aligned" },
  { id: "finish", ar: "اللمسة", en: "It looks designed: consistent spacing and sizes, frames and shapes that serve the content, a professional finish" },
] as const;

export const LAYOUT_CONTRACT = `THE LAYOUT PROGRAM YOU WRITE — one JavaScript program (no HTML, no imports) that defines:

function layout(D, K) {
  // D = the design as it is now: { width, height (px), bg, base: { w, h } | null, layers: [ { id, kind: "text"|"image"|"shape", x, y, w, h (%), … } ],
  //     files: [ { id, w, h, name } ] (the project's pictures you may place), fonts: [ ids ] }
  // return [ command, … ]: the editor's own commands as OBJECTS (the same commands «زهراء» writes: add_text, add_image, add_shape, update, move, order, align, delete, duplicate, bg, crop, crop_ratio, canvas, use_as_base …)
}

The page runs layout(D, K), applies the commands to a COPY of the design, renders it and shows you before and after; nothing reaches the person's project until it passes. So:
- Compute every position and size from the facts in D (the canvas, each picture's real shape from D.files, the layers' boxes): never type a number you did not compute. Keep pictures in their own shape (K.imageW), never stretched.
- Use only ids that are in D (layers, files, fonts). To CHANGE a word use update with its id; to WRITE new words use add_text; to PLACE a photo use add_image with its file id, then update it for its frame, size and opacity.
- Never put text or a shape over a face; give text a calm area or a dim shape behind it (add_shape before add_text, so it sits under).
- Arabic is written exactly as the person gave it. Return the whole job in one array (commands run in order, each on the result of the last).

${LAYOUT_KIT_API}`;
