// «حيدرة كت» — «بصمة صوتك» from the edit: a recording (the person's own voice from a clip, or recorded at the
// microphone) becomes a voice of their JAWAD AI library, at MiniMax (no limit on the number of voices, Arabic) or
// ElevenLabs. حيدرة can then speak any text with it («اقرأها بصوتي»), and his own replies can use it. Server only.

import { randomUUID } from "crypto";
import { UserError } from "@/lib/api";
import { cloneVoice } from "@/lib/jawad/server/voices";
import { uploadFromBuffer } from "@/lib/jawad/server/uploads";
import { stillOpen, type EditorProject } from "./server";

/** A WAV the page made: a real RIFF/WAVE file of a sensible size (10 s – 3 min at 16–48 kHz mono). */
export function readWav(data: unknown): Buffer {
  if (typeof data !== "string" || !/^[A-Za-z0-9+/]+=*$/.test(data)) throw new UserError("التسجيل غير صالح.", 400);
  const buf = Buffer.from(data, "base64");
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") throw new UserError("التسجيل غير صالح.", 400);
  if (buf.length > 18_000_000) throw new UserError("التسجيل طويل؛ ثلاث دقائق بالكثير.", 400);
  return buf;
}

export async function voiceprint(p: EditorProject, user: { id: string }, owner: boolean, b: { audio?: unknown; name?: unknown; consent?: unknown; provider?: unknown; seconds?: unknown }) {
  stillOpen(p);
  if (b.consent !== true) throw new UserError("أكّد أن الصوت صوتك أو عندك إذن صاحبه.", 400);
  const seconds = Number(b.seconds) || 0;
  // the site's own engine by default (free, no limit); MiniMax or ElevenLabs when asked
  const provider = b.provider === "elevenlabs" ? "elevenlabs" : b.provider === "minimax" ? "minimax" : "jawad";
  if (seconds < (provider === "elevenlabs" ? 3 : 10)) throw new UserError(provider === "elevenlabs" ? "البصمة تحتاج ٣ ثوانٍ على الأقل." : "البصمة تحتاج ١٠ ثوانٍ كلام على الأقل (الأفضل ٣٠–٦٠ ثانية).", 400);
  const wav = readWav(b.audio);
  const up = await uploadFromBuffer(user.id, new Uint8Array(wav), "voiceprint.wav");
  const name = (typeof b.name === "string" && b.name.trim() ? b.name.trim() : "صوتي").slice(0, 40);
  return cloneVoice(user, owner, { key: randomUUID().replace(/-/g, ""), uploadId: up.id, name, consent: true, removeNoise: true, provider });
}
