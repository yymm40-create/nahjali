// «الجواد الذكي!» | JAWAD AI — «مؤثرات من فيديو»: the limits shared by the studio and the server. Pure.
//
//   studio ─► takes small frames of the uploaded video (with their times) and sends them with the request.
//   server ─► Claude watches the frames and plans the sounds (each with its moment, length and loudness, plus one
//             background for the whole video); ElevenLabs makes each sound; they are mixed into ONE track that has
//             the video's exact length.

export const VIDEO_SFX = {
  /** The video's length (ms): the sound track is made at exactly this length. 30.5 s lets a "30 s" export through. */
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
} as const;

/** The seconds a video is charged for (rounded, at least 1). */
export const videoSfxSeconds = (durationMs: number) => Math.max(1, Math.round(durationMs / 1000));

/** When the frames are taken: evenly from the first moment to just before the end. */
export function sfxFrameTimes(durationSec: number): number[] {
  const n = Math.max(2, Math.min(VIDEO_SFX.framesMax, Math.round(durationSec * VIDEO_SFX.framesPerSec)));
  const last = Math.max(0, durationSec - 0.05);
  return Array.from({ length: n }, (_, i) => Math.round(((last * i) / (n - 1)) * 100) / 100);
}
