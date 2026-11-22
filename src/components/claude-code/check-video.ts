"use client";

// The check every finished slide video passes in the person's browser BEFORE it is shown and saved (the owner, 17 Nov
// 2026: «لازم نمنع هالأخطاء تصير للعملاء» — a slide came out silent, and nothing noticed): its length is the length it
// was made for, and a slide over the person's own sound really carries that sound. Free: nothing is asked of any model.

/** How quiet a slide's sound may be (RMS, dB) before it counts as silent: a voice sits near −20 dB, true silence at −90. */
export const SILENT_DB = -50;

/** The loudness of a stretch of sound (RMS over every 8th sample of the first channel), in dB. */
export function loudnessDb(samples: Float32Array): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < samples.length; i += 8) {
    sum += samples[i] * samples[i];
    n++;
  }
  return n ? 20 * Math.log10(Math.sqrt(sum / n) + 1e-9) : -120;
}

/** What is wrong with a finished slide (in the person's words), or null when it is sound. Pure. */
export function slideProblem(o: { n: number; seconds: number; wantSeconds: number; wantSound: boolean; soundDb: number | null }): string | null {
  if (!(o.seconds > 0)) return `فيديو الشريحة ${o.n} طلع فاضي.`;
  if (Math.abs(o.seconds - o.wantSeconds) > Math.max(0.6, o.wantSeconds * 0.08)) return `فيديو الشريحة ${o.n} طوله ${o.seconds.toFixed(1)} ث بدل ${o.wantSeconds.toFixed(1)} ث.`;
  if (o.wantSound && (o.soundDb == null || o.soundDb < SILENT_DB)) return `الشريحة ${o.n} طلعت بدون صوت مع إن صوتك لازم يكون فيها.`;
  return null;
}

/** Reads the finished MP4 back (its sound decoded) and checks it; throws the problem so the slide is not shown as made. */
export async function checkSlideVideo(video: Blob, o: { n: number; wantSeconds: number; wantSound: boolean }): Promise<void> {
  let seconds = 0;
  let soundDb: number | null = null;
  try {
    const sound = await new OfflineAudioContext(1, 1, 48000).decodeAudioData(await video.arrayBuffer());
    seconds = sound.duration;
    soundDb = loudnessDb(sound.getChannelData(0));
  } catch {
    // no sound track at all: its length is read from the video itself
    seconds = await new Promise<number>((ok) => {
      const v = document.createElement("video");
      const url = URL.createObjectURL(video);
      v.preload = "metadata";
      v.onloadedmetadata = () => (URL.revokeObjectURL(url), ok(Number.isFinite(v.duration) ? v.duration : 0));
      v.onerror = () => (URL.revokeObjectURL(url), ok(0));
      v.src = url;
    });
  }
  const problem = slideProblem({ n: o.n, seconds, wantSeconds: o.wantSeconds, wantSound: o.wantSound, soundDb });
  if (problem) throw new Error(`${problem} ما انحسبت عليك الشريحة كجاهزة؛ اضغط «أعد المحاولة».`);
}
