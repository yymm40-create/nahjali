// The feeling of a spoken line, as each speech provider takes it. Pure (pages and server alike).
//   ElevenLabs (Eleven v4): any word between [ ] at the start of the line ([whispers], [excited]…).
//   MiniMax (Speech 2.8): an `emotion` from a fixed list, and a few sounds written in the text as (laughs), (sighs)….
//   It has no whisper or shout: those are left out rather than read aloud.

/** MiniMax's emotions (fal's schema for speech-2.8). */
export const MINIMAX_EMOTIONS = ["happy", "sad", "angry", "fearful", "disgusted", "surprised", "neutral"] as const;
export type MinimaxEmotion = (typeof MINIMAX_EMOTIONS)[number];
/** MiniMax's sounds, written in the text where they happen. */
export const MINIMAX_SOUNDS = ["laughs", "sighs", "coughs", "clears throat", "gasps", "sniffs", "groans", "yawns"] as const;

/** The choices shown for a MiniMax voice: [value, Arabic label]; a sound is written "(laughs)". */
export const MINIMAX_FEELINGS: [string, string][] = [
  ["", "بدون"],
  ["happy", "سعيد"],
  ["sad", "حزين"],
  ["angry", "غاضب"],
  ["fearful", "خائف"],
  ["surprised", "متفاجئ"],
  ["disgusted", "مشمئز"],
  ["neutral", "محايد"],
  ["(laughs)", "😂 ضحكة"],
  ["(sighs)", "😮‍💨 تنهيدة"],
  ["(gasps)", "😲 شهقة"],
  ["(sniffs)", "🥲 شهقة بكاء"],
  ["(groans)", "😣 أنين"],
  ["(coughs)", "🤧 كحة"],
  ["(clears throat)", "تنحنح"],
  ["(yawns)", "🥱 تثاؤب"],
];

/** ElevenLabs' words → the nearest MiniMax emotion (a line chosen before the voice was changed keeps its sense). */
const FROM_ELEVEN: Record<string, { emotion?: MinimaxEmotion; sound?: string }> = {
  calm: { emotion: "neutral" },
  serious: { emotion: "neutral" },
  cheerful: { emotion: "happy" },
  excited: { emotion: "happy" },
  happy: { emotion: "happy" },
  sad: { emotion: "sad" },
  crying: { emotion: "sad", sound: "sniffs" },
  angry: { emotion: "angry" },
  shouts: { emotion: "angry" },
  fearful: { emotion: "fearful" },
  scared: { emotion: "fearful" },
  surprised: { emotion: "surprised" },
  laughs: { emotion: "happy", sound: "laughs" },
  sighs: { sound: "sighs" },
};

/** A feeling (either provider's word) as MiniMax takes it: its emotion and the text with the sound written in. */
export function minimaxFeeling(feeling: string, text: string): { emotion?: MinimaxEmotion; text: string } {
  const f = feeling.trim().toLowerCase();
  const clean = text.replace(/^\s*\[[^\]]*\]\s*/, "");
  if (!f) return { text: clean };
  const sound = /^\((.+)\)$/.exec(f)?.[1];
  if (sound && (MINIMAX_SOUNDS as readonly string[]).includes(sound)) return { text: `(${sound}) ${clean}` };
  if ((MINIMAX_EMOTIONS as readonly string[]).includes(f)) return { emotion: f as MinimaxEmotion, text: clean };
  if ((MINIMAX_SOUNDS as readonly string[]).includes(f)) return { text: `(${f}) ${clean}` };
  const m = FROM_ELEVEN[f];
  return { ...(m?.emotion ? { emotion: m.emotion } : {}), text: m?.sound ? `(${m.sound}) ${clean}` : clean };
}
