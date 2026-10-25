// «مختبر الموشن» on the person's OWN filmed video — the talking-head motion edit of the viral Claude Opus 5.5 reels: the
// person talks, and the piece is built around them in code: they fill the frame, shrink into a floating card on a
// designed stage, share the screen with an explainer, sit in a corner, or disappear for a few seconds while a
// full-screen motion piece shows what they are saying (a grid of tools drawn in code, a timeline, a curve, a number),
// then come back. Their video plays in sync from the first frame to the last and their voice is the soundtrack; حيدرا ماكس
// decides every frame change from their words (their times come from the transcript) without being told how.
// What the lab sends about the video, read and bounded here, and the texts حيدرا ماكس is given. Pure.

// no ceiling on the video's length (the owner's rule: no limit of the lab's own)
export const FOOTAGE_MAX = Number.POSITIVE_INFINITY;
export const FOOTAGE_MIN = 2;
/** How the person's video sits in each shot (the plan names one per shot). */
export const FRAMES = ["full", "card", "split", "corner", "away", "over"] as const;
export type FootageFrame = (typeof FRAMES)[number];

export interface FootageWord {
  w: string;
  /** seconds from the start of the piece */
  s: number;
  e: number;
}
export interface FootageFace {
  /** seconds from the start of the piece */
  t: number;
  /** the face's centre and size, in fractions of the video's picture */
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface FootageMeta {
  name: string;
  seconds: number;
  /** the video's picture as the scene receives it */
  w: number;
  h: number;
  words: FootageWord[];
  face: FootageFace[];
  /** «قص الشخص»: the person cut out is handed in too (words can go behind their head) */
  person?: boolean;
}

const num = (v: unknown, lo: number, hi: number, d: number) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : d);
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** What the browser says about the video, made safe (null when there is no usable video). */
export function readFootage(raw: unknown): FootageMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const seconds = num(o.seconds, 0, FOOTAGE_MAX, 0);
  if (seconds < FOOTAGE_MIN) return null;
  const words = (Array.isArray(o.words) ? o.words : [])
    .map((x) => {
      const w = (x ?? {}) as Record<string, unknown>;
      // a word outside the piece (before it, after it, or with no time) is dropped, not moved to its edge
      const at = Number(w.s);
      const s = Number.isFinite(at) && at >= 0 && at < seconds ? at : -1;
      return { w: String(w.w ?? "").replace(/\s+/g, " ").trim().slice(0, 40), s: r3(s), e: r3(num(w.e, Math.max(0, s), seconds, Math.max(0, s))) };
    })
    .filter((w) => w.w && w.s >= 0)
    .sort((a, b) => a.s - b.s);
  const face = (Array.isArray(o.face) ? o.face : [])
    .map((x) => {
      const f = (x ?? {}) as Record<string, unknown>;
      return { t: r3(num(f.t, 0, seconds, 0)), x: r3(num(f.x, 0, 1, 0.5)), y: r3(num(f.y, 0, 1, 0.4)), w: r3(num(f.w, 0.02, 1, 0.3)), h: r3(num(f.h, 0.02, 1, 0.3)) };
    })
    .sort((a, b) => a.t - b.t);
  return {
    name: String(o.name ?? "").replace(/\s+/g, " ").trim().slice(0, 120) || "فيديو",
    seconds: r3(seconds),
    w: Math.round(num(o.w, 16, 8192, 1080)),
    h: Math.round(num(o.h, 16, 8192, 1920)),
    words,
    face,
    person: o.person === true,
  };
}

/** The words as spoken lines (a pause, a sentence's end or ten words start a new one), with their times. */
export function footageLines(words: FootageWord[]): { text: string; from: number; to: number }[] {
  const out: { text: string; from: number; to: number }[] = [];
  let cur: FootageWord[] = [];
  const flush = () => {
    if (cur.length) out.push({ text: cur.map((w) => w.w).join(" "), from: cur[0].s, to: cur[cur.length - 1].e });
    cur = [];
  };
  for (const w of words) {
    const last = cur[cur.length - 1];
    if (last && (w.s - last.e > 0.45 || cur.length >= 10)) flush();
    cur.push(w);
    if (/[.!?؟،,؛;:…]$/.test(w.w)) flush();
  }
  flush();
  return out;
}

/** Where the face is over the piece, in a few words (left/centre/right, its size), for the plan. */
function faceSummary(f: FootageFace[]): string {
  if (!f.length) return "the face was not found automatically — look at the frames below; assume it is near the upper middle";
  const mid = (k: "x" | "y" | "w" | "h") => [...f.map((x) => x[k])].sort((a, b) => a - b)[Math.floor(f.length / 2)];
  const x = mid("x"), y = mid("y"), w = mid("w");
  const side = x < 0.4 ? "left of centre" : x > 0.6 ? "right of centre" : "in the middle";
  const size = w > 0.32 ? "a close-up" : w > 0.16 ? "a medium shot" : "a wide shot";
  const moves = Math.max(...f.map((p) => p.x)) - Math.min(...f.map((p) => p.x)) > 0.12 ? ", and it moves across the picture" : ", and it stays put";
  return `the face sits ${side} (centre x ${x.toFixed(2)}, y ${y.toFixed(2)} of the picture), ${size}${moves}`;
}

/** Everything حيدرا ماكس is told about the video in the plan, the code and the review. */
export function footageText(f: FootageMeta): string {
  const lines = footageLines(f.words);
  // numbered, so a moment is chosen by its words (#i … #j) and its time is read from here — never invented
  const timed = f.words.slice(0, 900).map((w, i) => `#${i} ${w.w}@${w.s.toFixed(2)}`).join(" ");
  return `${f.person ? `${FOOTAGE_PERSON_API}\n\n` : ""}THE PERSON'S OWN FILMED VIDEO — «${f.name}», ${f.seconds.toFixed(2)} s, ${f.w}×${f.h}; ${faceSummary(f.face)}.
WHAT THEY SAY (spoken lines with their times, seconds from the start of the piece):
${lines.length ? lines.map((l, i) => `${i + 1}. ${l.from.toFixed(2)}–${l.to.toFixed(2)} s: «${l.text}»`).join("\n") : "(no clear speech was heard — build on what you see in the frames)"}
${timed ? `EVERY WORD, NUMBERED, WITH THE SECOND IT STARTS (pick each moment by its word numbers and take its time from here — never estimate a time; snap a word-timed swap to a frame with K.TQ): ${timed}` : ""}`;
}

/** The craft of the edit (given to the plan, the code and the review when the piece is built on the person's video). */
export const FOOTAGE_SKILL = `THIS PIECE IS BUILT ON THE PERSON'S OWN FILMED VIDEO — the talking-head motion edit of the viral 2026 reels made with Claude (a creator talks to the camera; the edit around them is designed and coded frame by frame). The person did NOT tell you how to cut it: you decide every frame change from their words, like a top editor would. Nobody has to ask for a split screen or icons — you bring them where the words call for them.

THE NON-NEGOTIABLES
1. Their video is the spine. It plays IN SYNC from 0 to the end (K.footage.draw always shows the frame of now — never re-time it, never freeze it, never reverse it): their lips must match their voice. The piece lasts exactly the video's length. Their voice IS the soundtrack (it is mixed in for you, under nothing): never write words to be read aloud, and keep your effects under it.
2. The frame changes WITH THE WORDS. Every change lands on a word boundary from the timed words (a change starts 0.1–0.2 s before the key word, so the picture arrives as the word is said). Never two changes inside 1.2 s; never a hold longer than ~5 s without something new (a push-in, a word typed beside them, a change of frame).
3. Every shot names how their video sits ("frame" in the plan) — and two shots in a row never use the same one:
   • full — they fill the frame (cover, the face kept in), with a slow push-in (zoom 1.00 → 1.06 over the shot) or a punch-in on a key word (zoom 1.25 in 0.25 s, eased).
   • card — their video shrinks into a floating rounded card (radius ≈ 3–4% of the frame, a soft long shadow, kept FLAT — never tilted into 3D to fake depth; depth comes from a motivated camera move) on a DESIGNED STAGE (a soft gradient or paper ground, a grid or a glow — no HUD rows, no corner marks, no labels that are not the content itself), with the key line typed beside or under it.
   • split — the frame is cut in two (portrait: top/bottom; landscape: left/right): they are in one half with the face centred in it, the explainer is drawn in the other; the divide moves in on a spring and leaves on one.
   • corner — they become a small circle or rounded box in a corner (face filling it) while the explainer fills the rest.
   • away — they disappear (the voice goes on) and a FULL-SCREEN motion explainer shows what they are saying: tool icons drawn in code on rounded tiles assembling into a grid, a timeline of clips sliding in, an easing curve drawing itself, a chart growing, a phone UI, a number counting, a before/after. 1.5–3.5 s, then they come back (the card flies back in and grows to full, a zoom through the explainer, a mask wipe on the beat).
   • over — they stay full and kinetic words appear beside them (never on the face: K.footage.draw returns where the face landed; keep text out of that box with a margin).
4. They are seen talking most of the time: at least half of the piece shows their face (full, card, split, corner or over); open on them (or on a hook that cuts to them inside 1.5 s). THE ENDING: their last line on them, then a short clean end card (1.5–2.5 s): the one idea of the piece in their words, centred on the stage, no person, held still (their voice may finish under it).
5. The explainers come FROM THEIR WORDS. When they name a thing (a tool, an app, a place, a number, a list, a step, a before/after), show it — never decoration for its own sake. Generic icons are drawn in code (rounded tiles, line icons, real shapes), never emoji. NEVER draw another company's logo or app icon: a named app or brand is its NAME written in type on a plain labelled tile (with a generic icon for its kind — a camera for a photo app, a play triangle for a video app). Never write computer-vision labels or tracking tags on their real video. A number they say counts up as they say it. A list they say builds item by item on each item's word.
6. On-screen words are THEIR key words, exactly as they said them (Arabic as spoken; another language as spoken) — a headline of 1–5 words per moment, mixing a heavy weight with a light or italic one, typed or masked in on the word. Not full captions.
7. Whenever they are shown, their WHOLE FACE is inside the visible part (K.footage.draw keeps it in by default), never cut by a panel's edge, never under text, never under the platform's buttons (portrait: keep the face above 0.78 of H).
8. Transitions are motion, not cuts: the card scales and slides on K.ease.silk / springs (8–16 frames), the divide sweeps, a blur-to-sharp, a mask wipe; one whoosh / pop on each change, soft under the voice.
9. One designed world for the whole piece: one stage, one palette (3–5 colours, one accent), the same two fonts, the same UI language on every panel — the variety is in the frames and the motion, not in the style.
10. Rhythm by intensity: 1–2 → a change every 4–6 s, mostly full/card; 3 → every 3–4 s; 4–5 → every 2–3 s with "away" explainers on the big words.`;

/** The footage part of the kit, told to حيدرا ماكس only when the piece has a video. */
export const FOOTAGE_KIT_API = `THE PERSON'S VIDEO IN THE KIT — K.footage (null when there is none):
K.footage.draw(ctx, x, y, w, h, { zoom=1 (1 = cover; >1 punches in on the face), radius=0, circle=false, shadow=false|true|px, shadowColor, alpha=1, border=0, borderColor, cx, cy (0..1: crop centre instead of the face), fit:"cover"|"contain" }) → the face's box where it landed {x,y,w,h} in canvas pixels (keep text out of it). It draws the video's frame of NOW (the runtime hands it in for every frame — you never seek it). Draw it inside ctx.save()/transforms like any picture: rotate, skew or scale the ctx around it for a tilted floating card.
K.footage.full(ctx, {zoom, cx, cy}) → the same, filling the frame.
K.footage.faceAt(t) → {x,y,w,h} the face's centre and size in fractions of the video's picture (smoothed between the measured moments).
K.footage.wordAt(t) → {w,s,e} the word being said at t, or null · K.footage.words → every word [{w,s,e}] (seconds) · K.footage.lines → spoken lines [{text,from,to}] · K.footage.w / .h (its picture size) · K.footage.duration.
Draw the video with K.footage.draw — never with K.img or drawImage on K.footage.frame yourself (it would lose the face framing).`;

/** Told only when the person was cut out for this piece. */
export const FOOTAGE_PERSON_API = `THE PERSON IS CUT OUT TOO (K.footage.hasPerson = true): K.footage.draw(ctx, x, y, w, h, { …the same options…, person: true }) draws ONLY the person (hair and all, transparent around them) with exactly the crop the plain draw uses. That is the "words behind the head" look of the viral reels: draw the video (or the stage), then the big key word, then the same draw with person:true on top — the word sits BEHIND them. Use it on 1–3 moments (a hook word, the big idea), never on every shot; on a designed stage you may also drop their room entirely (stage, then the person alone). Keep the face uncovered as always.`;
