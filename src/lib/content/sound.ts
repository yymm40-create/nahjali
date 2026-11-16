// «صانع المحتوى» · the conversation's SOUND goes into the motion (the owner, 15 Nov 2026: «الصوت اللي يستخرج من الفيديو
// او يرسل كصوت او محمل من اليوتيوب … ينحط في الموشن كاروسيل او في الموشن جرافيكس، وينتقل كصوت في حركات»):
//   - the sound is the latest one the person gave: a sound file, else a video (its sound), else a YouTube download's MP3;
//   - with speech, its phrases (heard by ElevenLabs, with their times) lead the motion: a motion carousel's slides share
//     the sound in order (each slide is as long as its part and moves on its own phrases), and «مختبر الموشن» takes it
//     as the piece's voice; without speech it is music under the slides / the piece.
// Server only for chatSound; splitSound is pure (tested).

import { fileHeardKey, heardParts } from "@/lib/link-listen";
import { youtubeOf } from "./youtube";
import type { Turn } from "./chats";

export interface Phrase {
  text: string;
  from: number;
  to: number;
}

export interface ChatSound {
  /** the person's upload that holds the sound (a sound file, a video, or a YouTube download's MP3) */
  uploadId: string;
  name: string;
  kind: "audio" | "video";
  seconds: number;
  /** what is said, in phrases with their times (empty: music or no words) */
  phrases: Phrase[];
}

/** The sound of the conversation (the latest the person gave), with what is said in it; null when there is none. */
export async function chatSound(userId: string, turns: Turn[]): Promise<ChatSound | null> {
  const files = turns.filter((t) => t.role === "user").flatMap((t) => t.files ?? []);
  // a YouTube download brings its video and its MP3: the MP3 is the sound, the video is skipped
  const tagged = await Promise.all(files.map(async (f) => ({ f, yt: f.kind === "audio" || f.kind === "video" ? await youtubeOf(userId, f.id).catch(() => null) : null })));
  const pick = [...tagged].reverse().find(({ f, yt }) => f.kind === "audio" || (f.kind === "video" && !tagged.some((o) => o.yt?.key && o.yt.key === yt?.key && o.f.kind === "audio")));
  if (!pick) return null;
  const { f, yt } = pick;
  const heard = await heardParts(yt ? yt.key : fileHeardKey(f.id)).catch(() => null);
  const seconds = Math.max(heard?.seconds ?? 0, (f.durationMs ?? 0) / 1000);
  if (!seconds) return null;
  return { uploadId: f.id, name: f.name, kind: f.kind as "audio" | "video", seconds: Math.round(seconds * 100) / 100, phrases: heard?.parts ?? [] };
}

export interface SoundSlice {
  from: number;
  to: number;
  /** the phrases said in this slide, their times from the slide's own start */
  lines: Phrase[];
}

/**
 * The sound shared by `n` slides, in order and without a gap (the reel plays it continuously). With speech each cut
 * falls at the end of a phrase, nearest an even share of the length; without speech the slides keep their planned
 * length (`seconds` each), one after another, while the sound lasts.
 */
export function splitSound(s: Pick<ChatSound, "seconds" | "phrases">, n: number, seconds: number): SoundSlice[] {
  const total = Math.max(0.5, s.seconds);
  if (n <= 0) return [];
  const ph = s.phrases.filter((p) => p.to > p.from);
  if (!ph.length) {
    // music: the planned length each, shortened evenly when the sound is shorter than the carousel
    const each = Math.min(Math.max(1, seconds), total / n);
    return Array.from({ length: n }, (_, i) => ({ from: Math.round(i * each * 100) / 100, to: Math.round((i + 1) * each * 100) / 100, lines: [] }));
  }
  // the end of the last word (with a short tail) closes the last slide
  const end = Math.min(total, ph[ph.length - 1].to + 0.6) || total;
  const cuts: number[] = [];
  let k = 0;
  for (let i = 1; i < n; i++) {
    const target = (end * i) / n;
    // the phrase ends left for the slides still to come (each keeps at least one phrase when there are enough)
    const room = ph.length - (n - i);
    let best = -1;
    for (let j = k; j < Math.max(k + 1, room); j++) {
      if (j >= ph.length - 1) break;
      if (best < 0 || Math.abs(ph[j].to - target) < Math.abs(ph[best].to - target)) best = j;
    }
    if (best < 0) {
      cuts.push(Math.min(end, Math.max(cuts[cuts.length - 1] ?? 0, target)));
      continue;
    }
    // the cut sits in the pause after the phrase
    const next = ph[best + 1]?.from ?? ph[best].to;
    cuts.push(Math.round(((ph[best].to + Math.max(ph[best].to, next)) / 2) * 100) / 100);
    k = best + 1;
  }
  const edges = [0, ...cuts, end];
  return Array.from({ length: n }, (_, i) => {
    const from = edges[i];
    const to = Math.max(from + 0.5, edges[i + 1]);
    const lines = ph.filter((p) => p.from >= from - 0.05 && p.from < to).map((p) => ({ text: p.text, from: Math.round((p.from - from) * 100) / 100, to: Math.round((Math.min(p.to, to) - from) * 100) / 100 }));
    return { from, to, lines };
  });
}

/** The words of a slide's part for the scene writer: when each phrase is said, so the motion lands on it. */
export function sliceNote(slice: SoundSlice, speech: boolean): string {
  const len = (slice.to - slice.from).toFixed(1);
  if (!speech || !slice.lines.length)
    return `SOUND: this slide plays over the person's own sound (music, no words) for exactly ${len} s — make the scene last exactly ${len} s and let its motion breathe with it.`;
  return [
    `SOUND: this slide plays over the person's own voice for exactly ${len} s — make the scene last exactly ${len} s. Time the motion to the words: each phrase's key words appear (or its idea moves) when it is said, and nothing important lands in the silence between phrases. The phrases (seconds from the slide's start):`,
    ...slice.lines.map((l) => `[${l.from.toFixed(1)}–${l.to.toFixed(1)}] «${l.text}»`),
  ].join("\n");
}
