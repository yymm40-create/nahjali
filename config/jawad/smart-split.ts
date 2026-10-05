// «الجواد الذكي!» | JAWAD AI — «الفصل الذكي»: a video in, its sound out as three separate tracks, each with the video's
// exact length. Shared by the studio and the server. Pure.
//
//   الحوار     ─► separated from the video's own sound (ElevenLabs Voice Isolator).
//   الموسيقى   ─► made anew in the background: Claude watches the video and plans sections that follow its scenes;
//                 Eleven Music composes them to those exact lengths.
//   المؤثرات   ─► made anew in the background: Claude times each sound to its moment; ElevenLabs makes each one;
//                 they are mixed at their moments with one background for the place.

import type { Settings } from "./types";

export const SMART_SPLIT_ID = "elevenlabs-smart-split";
export const SMART_SPLIT_MODE = "smart_split";

/** The tracks, in the order they are kept and shown. */
export const STEMS = ["dialogue", "music", "sfx"] as const;
export type Stem = (typeof STEMS)[number];
export const STEM_LABEL: Record<Stem, string> = { dialogue: "الحوار", music: "الموسيقى", sfx: "المؤثرات" };
export const isStem = (s: unknown): s is Stem => typeof s === "string" && (STEMS as readonly string[]).includes(s);

/** The tracks asked for (their settings are on/off switches). */
export const stemsOf = (s: Settings): Stem[] => STEMS.filter((k) => s[k] === true);
/** Claude watches the video (its frames) for the music and the effects; the dialogue needs only the video's sound. */
export const needsFrames = (s: Settings) => s.music === true || s.sfx === true;

export const VIDEO_SFX = {
  /** The video's length (ms): every track is made at exactly this length. 30.5 s lets a "30 s" export through. */
  minMs: 1_000,
  maxMs: 30_499,
  /** Frames Claude looks at: 4 a second for short videos, spread over at most 60 for longer ones. */
  framesPerSec: 4,
  framesMax: 60,
  /** Longest side of a frame (px): enough to see what makes a sound, small enough to keep the request light. */
  frameSide: 512,
  frameQuality: 0.62,
  /** Timed effects in one track (each 0.5–10 s), and their seconds in total (the provider bills per second made). */
  eventsMax: 24,
  eventMinSec: 0.5,
  eventMaxSec: 10,
  eventsTotalSec: 60,
  /** Eleven Music: the shortest piece and the shortest section of a composition plan (ms). */
  musicMinMs: 3_000,
  musicSectionsMax: 10,
} as const;

/** The seconds a video is charged for (rounded, at least 1). */
export const videoSfxSeconds = (durationMs: number) => Math.max(1, Math.round(durationMs / 1000));

/** When the frames are taken: evenly from the first moment to just before the end. */
export function sfxFrameTimes(durationSec: number): number[] {
  const n = Math.max(2, Math.min(VIDEO_SFX.framesMax, Math.round(durationSec * VIDEO_SFX.framesPerSec)));
  const last = Math.max(0, durationSec - 0.05);
  return Array.from({ length: n }, (_, i) => Math.round(((last * i) / (n - 1)) * 100) / 100);
}
