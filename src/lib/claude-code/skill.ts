// «Claude Code» — the one way of working that the site's robots use when they EXECUTE something instead of only
// talking about it, the way «مختبر الموشن» makes motion: Claude writes a program for the task, the person's browser
// runs it in a sandbox (src/lib/claude-code/compute.ts, or the scene page for pictures), any bug goes back to him to
// fix, then he LOOKS at what it produced (the pictures, the timeline after), scores it like a harsh expert and rewrites
// it until it passes, and only then is it applied. Pure text and numbers.

import { EDIT_KIT_API, GRADE_KIT_API, GRADE_LUT_SIZE } from "./compute";

/** Every round of a program: write → run → (fix) → look → score; it is applied only when every score is ≥ PASS. */
export const CODE_PASS = 8;
export const CODE_ROUNDS = 3;
/** Fixes of a program that threw (or broke a rule) before it is looked at. */
export const CODE_FIXES = 2;

export const CLAUDE_CODE_WAY = `THE CLAUDE CODE WAY (how you execute): you do not hand-pick numbers or guess commands one by one — you WRITE A PROGRAM that does the job exactly, the person's browser runs it in a sandbox, you get its errors to fix, then you LOOK at what it made and judge it like a harsh expert. Nothing reaches the person's project until it passes. Write complete, readable, deterministic JavaScript (no network, no DOM, no clocks, no Math.random: a program gives the same answer every time). A bug must throw so you see it; never hide one in try/catch.`;

export const GRADE_RUBRIC = [
  { id: "ask", ar: "الطلب", en: "It is what the person asked for (the look, the mood, the reference) — clearly, not a timid half of it" },
  { id: "skin", ar: "البشرة", en: "Skin stays natural and alive: no orange, grey, green or magenta faces; skin sits on the skin line" },
  { id: "tone", ar: "الإضاءة", en: "Tonal range: deep but not crushed blacks, highlights rolled off not clipped, mids with separation; nothing banded or posterised" },
  { id: "color", ar: "الألوان", en: "Colour discipline: a coherent palette, neutrals neutral (or deliberately tinted), no neon over-saturation, no muddy colours" },
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
  // c = { r, g, b }: one colour of the picture as it is now, each channel 0…1 (display Rec.709)
  // return [r, g, b] (or { r, g, b }) 0…1: the same colour after your grade
}

The page samples grade() at ${GRADE_LUT_SIZE}³ colours into a 3D LUT and puts the LUT on the clip(s) as its own grading layer, so:
- It is a pure function of the colour: no position, no time, no state. A change that must depend on where something is in the frame is not possible here — say so.
- It must be smooth: no hard thresholds (use K.smoothstep and the soft masks), or the LUT bands and posterises.
- Protect skin (K.skin) whenever you push hue or saturation; keep neutrals neutral unless the look tints them on purpose.
- Roll highlights off (K.filmic / a curve shoulder) instead of clipping; never crush blacks to 0 unless asked.
- Build it like a colourist, in this order: balance (temperature/tint, wheels) → contrast (curve/contrast around a pivot) → colour (saturation/vibrance, split tone, hue bands) → finish (a gentle roll-off). Comment each block in one short line.

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
