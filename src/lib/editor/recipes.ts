// «أساليب جاهزة» — one-tap editing styles for reels, podcasts and montages. The rules and numbers are adapted from
// majed-video by Majed Alzaabi (MIT, github.com/majedphotos/video-ad-editor): silence cutting, the jump-cut zoom
// cycle, caption placement in the safe zone, beat-cut lengths. Pure: each returns the editor's own commands, so the
// result is checked, saved and undone in one tap like any other change.

import { apply, type Command } from "./commands";
import { clipEnd, findClip, mainTrack, type AssetInfo, type Timeline } from "./model";

/** Silence cutting (majed-video 01_cut_plan): quieter than −32 dB for 0.35 s or more, 0.13 s kept each side. */
export const TIGHT = { quietDb: -32, minSilenceMs: 350, padMs: 130, minKeepMs: 300 } as const;

/**
 * The parts of a sound to cut, in its own time (ms): long quiet stretches (less their padding), and the short
 * pieces left stranded between two cuts. `peaks` is the loudness (0–255) `rate` times a second.
 */
export function silentSpans(peaks: Uint8Array, rate: number, fromMs: number, toMs: number, o: { quietDb: number; minSilenceMs: number; padMs: number; minKeepMs: number } = TIGHT): [number, number][] {
  const a = Math.max(0, Math.floor((fromMs / 1000) * rate));
  const b = Math.min(peaks.length, Math.ceil((toMs / 1000) * rate));
  if (b <= a) return [];
  const part = Array.from(peaks.subarray(a, b)).sort((x, y) => x - y);
  // −32 dB of full scale, or a quarter of the speaker's usual level when the room is noisy
  const limit = Math.max(Math.round(10 ** (o.quietDb / 20) * 255), (part[Math.floor(part.length * 0.6)] ?? 0) * 0.25);
  const ms = (k: number) => (k / rate) * 1000;
  const cuts: [number, number][] = [];
  let start = -1;
  for (let k = a; k <= b; k++) {
    const quiet = k < b && peaks[k] <= limit;
    if (quiet && start < 0) start = k;
    if (!quiet && start >= 0) {
      if (ms(k - start) >= o.minSilenceMs) {
        // the edges of the recording are cut to the edge; inside, some air stays around the words
        const s = start === a ? fromMs : ms(start) + o.padMs;
        const e = k === b ? toMs : ms(k) - o.padMs;
        if (e > s) cuts.push([Math.round(s), Math.round(e)]);
      }
      start = -1;
    }
  }
  // a piece of sound shorter than 0.3 s between two cuts goes too
  const merged: [number, number][] = [];
  for (const c of cuts) {
    const last = merged[merged.length - 1];
    if (last && c[0] - last[1] < o.minKeepMs) last[1] = c[1];
    else merged.push([...c]);
  }
  return merged;
}

/** Source spans of one clip → its timeline spans (only what it plays). */
export function onTimeline(c: { start: number; in: number; out: number; speed: number }, spans: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const [s, e] of spans) {
    const a = Math.max(s, c.in);
    const b = Math.min(e, c.out);
    if (b > a) out.push([Math.round(c.start + (a - c.in) / c.speed), Math.round(c.start + (b - c.in) / c.speed)]);
  }
  return out;
}

/** The jump-cut zoom (majed-video 03_cut_zoom): one scale per piece, the face kept 30 % from the top. */
export const ZOOM_CYCLE = [1, 1.08, 1, 1.06, 1, 1.12, 1.04, 1.14, 1, 1.08, 1, 1.05, 1.1, 1];
/** Calm speakers: lighter and held for at least 4 s. */
export const CALM_CYCLE = [1, 1, 1.04, 1, 1, 1.06, 1, 1.03];

export function jumpZoom(tl: Timeline, calm = false): Command[] {
  const main = mainTrack(tl);
  if (!main) return [];
  const cycle = calm ? CALM_CYCLE : ZOOM_CYCLE;
  const cmds: Command[] = [];
  let step = 0;
  let held = 0;
  for (const c of main.clips) {
    if (c.text || c.keys.length) continue;
    const s = cycle[step % cycle.length];
    // the point 30 % from the top stays where it is while the picture grows around it
    cmds.push({ type: "update_clip", clipId: c.id, patch: { transform: { scale: s, y: 0.3 + 0.2 * s } } });
    held += clipEnd(c) - c.start;
    if (!calm || held >= 4000) {
      step++;
      held = 0;
    }
  }
  return cmds;
}

/** Reel captions: bold, the spoken word lit, low in the frame but clear of the app's buttons (safe zone). */
export function reelCaptions(tl: Timeline): Command[] {
  const cmds: Command[] = [];
  for (const t of tl.tracks) {
    if (t.kind !== "text" || !t.clips.some((c) => c.words.length)) continue;
    cmds.push({ type: "style_track", trackId: t.id, text: { size: 0.052, weight: 900, color: "#ffffff", highlight: "#facc15", box: null }, y: 0.72 });
    for (const c of t.clips) if (!c.own) cmds.push({ type: "update_clip", clipId: c.id, patch: { anim: { in: "rise", inMs: 250 } } });
  }
  return cmds;
}

/** The montage's shot lengths (majed-video montage.md): ×1, 0.82, 1.24, 0.94 of a base length, ends on beats. */
const SHOT_CYCLE = [1, 0.82, 1.24, 0.94];

/**
 * A beat montage from the main track: each shot loses its first third of a second, runs a length from the cycle
 * (two beats long on average) and ends on a beat; every fourth cut gets a quick zoom; music ducks under voices.
 */
export function beatMontage(tl: Timeline, assets: Map<string, AssetInfo>): Command[] {
  const main = mainTrack(tl);
  const beats = [...tl.markers].sort((a, b) => a - b);
  if (!main || beats.length < 4) return [];
  const gaps = beats.slice(1).map((b, i) => b - beats[i]).sort((a, b) => a - b);
  const beat = gaps[Math.floor(gaps.length / 2)];
  const base = Math.min(2000, Math.max(800, beat * 2));
  const cmds: Command[] = [];
  let t = tl;
  const run = (c: Command) => {
    try {
      t = apply(t, c, assets).timeline;
      cmds.push(c);
    } catch {
      /* a shot too short to trim stays as it is */
    }
  };
  const ids = main.clips.filter((c) => !c.text).map((c) => c.id);
  ids.forEach((id, i) => {
    let f = findClip(t, id);
    if (!f) return;
    if (clipEnd(f.clip) - f.clip.start > 1200 && assets.get(f.clip.assetId ?? "")?.kind === "video") run({ type: "trim_clip", clipId: id, edge: "start", to: f.clip.start + 333 });
    f = findClip(t, id);
    if (!f) return;
    const want = f.clip.start + base * SHOT_CYCLE[i % SHOT_CYCLE.length];
    // the beat nearest the wanted end (not making the shot shorter than half of it)
    const near = beats.filter((b) => b > f!.clip.start + base * 0.4).sort((x, y) => Math.abs(x - want) - Math.abs(y - want))[0];
    const end = near ?? want;
    if (end < clipEnd(f.clip)) run({ type: "trim_clip", clipId: id, edge: "end", to: Math.round(end) });
    if (i % 4 === 3) run({ type: "update_clip", clipId: id, patch: { transition: { kind: "zoom", ms: 300 } } });
  });
  for (const tr of t.tracks) if (tr.kind === "audio" && tr.clips.length && !tr.duck) run({ type: "update_track", trackId: tr.id, patch: { duck: true } });
  return cmds;
}

/** A calm explainer: soft dissolves at every cut and a light, slow zoom. */
export function calmExplainer(tl: Timeline): Command[] {
  const main = mainTrack(tl);
  if (!main || main.clips.length < 1) return [];
  const touching = main.clips.some((c, i) => main.clips[i + 1]?.start === clipEnd(c));
  return [...(touching ? [{ type: "transition_all", kind: "fade", ms: 350 } as Command] : []), ...jumpZoom(tl, true)];
}

/**
 * Editing know-how for Claude (vertical reels), distilled from majed-video: only what the editor's commands can do.
 */
export const KNOW_HOW = `EDITING KNOW-HOW (vertical 9:16 reels; adapted from majed-video by Majed Alzaabi, MIT)
- Silence: cut spans quieter than about -32 dB lasting 0.35 s or more; keep 0.13 s of air each side; drop kept pieces shorter than 0.3 s. For calm speakers, recitation or sermons, ask before cutting pauses.
- Jump-cut zoom: vary scale per kept piece in a cycle like 1.00, 1.08, 1.00, 1.06, 1.00, 1.12, 1.04, 1.14, keeping the face about 30% from the top (y = 0.3 + 0.2 × scale). Calm pace: at most 1.06, each zoom held 4 s or more. Never scale below 1.0.
- Hook: the first second must move (a fast smooth zoom-in, e.g. motion points 1.00 → 1.08 in the first second). The first caption shows within 0.5 s. A written hook is 3–8 words, at most 2 lines, from the strongest line (not the first sentence), with a number, contradiction, question or curiosity gap; any number must come from the speech. Show it 0.9 + 0.28 × words seconds (1.6–3.0 s), big and bold with a box.
- Captions: at most 2 lines, about 70% of the frame wide, centred around y 0.72 (never over the face). Light only meaningful words. Keep a number and its unit together. Western digits.
- Safe zones (9:16): no text in the top 8% or the bottom 16% of the frame, nor in the right 12% between 57% and 91% of the height.
- Motion: purposeful only; texts enter in 150–300 ms (rise, pop or fade), never letter by letter (Arabic letters must stay joined).
- Colour: do not grade or filter the person unless asked.
- Beats: put cuts on beat markers; strong beats may get a quick zoom transition, ordinary ones none; never the same effect twice in a row.
- Montage: trim about 0.33 s from each clip's start; strongest shot first; alternate busy and calm shots; shot lengths about 1–1.5 s varied (×1, 0.82, 1.24, 0.94); 20–40 s in total.
- Audio: music under speech ducked (duck on its track); a talking voice usually wants sound {clean: 0.8, enhance: true}.
- Never invent words, numbers or names that are not in the speech.`;
