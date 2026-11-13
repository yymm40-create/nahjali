// «الرضا فويس» — the file a mix is saved as. WAV is the studio's own format and is written here directly, always.
// The compressed ones (MP3, M4A, FLAC, OGG) go through the site's media library with whatever encoder the browser
// has — and for MP3 and AAC, one shipped with the site when the browser has none.

import { encodeWav, type WavDepth } from "@/lib/ridha/dsp/wav";

export type Format = "wav" | "mp3" | "m4a" | "flac" | "ogg";
type Codec = "mp3" | "aac" | "flac" | "opus";

export const FORMATS: { id: Format; name: string; ext: string; mime: string; codec: Codec | null; hint: string; lossy: boolean }[] = [
  { id: "wav", name: "WAV", ext: "wav", mime: "audio/wav", codec: null, hint: "بلا ضغط — الأصل للأرشفة والمونتاج والاستوديو", lossy: false },
  { id: "mp3", name: "MP3", ext: "mp3", mime: "audio/mpeg", codec: "mp3", hint: "يشتغل في كل مكان — للإرسال والنشر", lossy: true },
  { id: "m4a", name: "M4A (AAC)", ext: "m4a", mime: "audio/mp4", codec: "aac", hint: "جودة أعلى من MP3 بنفس الحجم — آيفون وواتساب ومنصات البودكاست", lossy: true },
  { id: "flac", name: "FLAC", ext: "flac", mime: "audio/flac", codec: "flac", hint: "بلا فقد بنصف حجم WAV تقريبًا", lossy: false },
  { id: "ogg", name: "OGG (Opus)", ext: "ogg", mime: "audio/ogg", codec: "opus", hint: "أصغر حجم بجودة جيدة — للويب", lossy: true },
];
export const formatById = (id: Format) => FORMATS.find((f) => f.id === id)!;

const added: Partial<Record<Codec, Promise<void>>> = {};
/** Can this browser write the format? (The site's own MP3 and AAC encoders are loaded when the browser has none.) */
export async function canEncode(format: Format, sr: number, kbps: number): Promise<boolean> {
  const f = formatById(format);
  if (!f.codec) return true;
  const { canEncodeAudio } = await import("mediabunny");
  const ask = () => canEncodeAudio(f.codec!, { numberOfChannels: 2, sampleRate: sr, bitrate: kbps * 1000 }).catch(() => false);
  if (await ask()) return true;
  if (f.codec === "mp3") added.mp3 ??= import("@mediabunny/mp3-encoder").then((m) => m.registerMp3Encoder());
  else if (f.codec === "aac") added.aac ??= import("@mediabunny/aac-encoder").then((m) => m.registerAacEncoder());
  else return false;
  try {
    await added[f.codec];
  } catch {
    delete added[f.codec];
    return false;
  }
  return ask();
}

/** Stereo channels as a file of the chosen format. `kbps` is for the lossy formats, `depth` for WAV. */
export async function encodeAudio(channels: Float32Array[], sr: number, format: Format, opts: { kbps?: number; depth?: WavDepth; onProgress?: (p: number) => void } = {}): Promise<Blob> {
  const f = formatById(format);
  if (!f.codec) return encodeWav(channels, sr, opts.depth ?? 24);
  const kbps = opts.kbps ?? 192;
  if (!(await canEncode(format, sr, kbps))) throw new Error(`متصفحك ما يقدر يكتب ${f.name}. اختر WAV (يشتغل دائمًا) أو جرّب Chrome على الكمبيوتر.`);
  const mb = await import("mediabunny");
  const container = format === "mp3" ? new mb.Mp3OutputFormat() : format === "m4a" ? new mb.Mp4OutputFormat({ fastStart: "in-memory" }) : format === "flac" ? new mb.FlacOutputFormat() : new mb.OggOutputFormat();
  const output = new mb.Output({ format: container, target: new mb.BufferTarget() });
  const source = new mb.AudioBufferSource({ codec: f.codec, bitrate: kbps * 1000 });
  output.addAudioTrack(source);
  await output.start();
  // ten seconds at a time: the encoder never holds the whole mix twice
  const len = channels[0].length, step = sr * 10;
  for (let at = 0; at < len; at += step) {
    const n = Math.min(step, len - at);
    const buf = new AudioBuffer({ length: n, numberOfChannels: channels.length, sampleRate: sr });
    channels.forEach((ch, i) => buf.copyToChannel(ch.subarray(at, at + n) as Float32Array<ArrayBuffer>, i));
    await source.add(buf);
    opts.onProgress?.(Math.min(1, (at + n) / len));
  }
  await output.finalize();
  const data = (output.target as InstanceType<typeof mb.BufferTarget>).buffer;
  if (!data) throw new Error("تعذّر كتابة الملف.");
  return new Blob([data], { type: f.mime });
}
