// «الرضا فويس» — the engineer's advice, free and instant: from what was measured in a recording and what it is
// for (a podcast, a solo singer, a choir, a mourning or a celebration piece), which cleaning to run, which ready
// chain to start from, how to nudge its equalizer toward a reference voice, and how loud to leave it. The same
// rules «الرضا ماكس» is trained on (config/ridha-training.ts), applied without a conversation.

import type { CleanOptions } from "./dsp/clean";
import type { Listening } from "./dsp/listen";
import type { EqBand } from "./model";

export type Use = "podcast" | "lesson" | "solo" | "choir" | "aza" | "mawlid" | "phone";
export const USES: { id: Use; name: string; icon: string; hint: string; chain: string; speech: boolean }[] = [
  { id: "podcast", name: "بودكاست", icon: "🎙️", hint: "صوت قريب للكلام", chain: "podcast", speech: true },
  { id: "lesson", name: "درس / محاضرة", icon: "📖", hint: "قاعة أو مجلس", chain: "lesson", speech: true },
  { id: "phone", name: "تسجيل جوال", icon: "📱", hint: "مايك بعيد وضجيج", chain: "podcast", speech: true },
  { id: "solo", name: "سولو", icon: "🎤", hint: "منشد منفرد", chain: "solo", speech: false },
  { id: "aza", name: "عزاء", icon: "🏴", hint: "رادود — لون الاستوديو", chain: "radood", speech: false },
  { id: "mawlid", name: "مولد وفرح", icon: "🎉", hint: "منشد — لون المواليد", chain: "mawlid", speech: false },
  { id: "choir", name: "كورال / ردّة", icon: "👥", hint: "أصوات جماعية", chain: "choir", speech: false },
];
export const usageById = (id: Use) => USES.find((u) => u.id === id)!;

/**
 * Where a close voice's energy sits per octave band against its own 500 Hz–2 kHz middle (dB): under 60, 60–120,
 * 120–250, 250–500, the middle, 2–4k, 4–8k, 8–16k. A man's voice, well recorded; a choir is thinner below and softer
 * on top. A reference to lean toward, not a law.
 */
const REFERENCE: Record<"voice" | "choir", number[]> = {
  voice: [-42, -24, -8, -2.5, 0, -9, -16, -26],
  choir: [-46, -30, -13, -4, 0, -8, -17, -28],
};

export interface Advice {
  clean: CleanOptions;
  chain: string;
  /** dB to add to the gain of the chain's equalizer bands (by band index), nudging the tone toward the reference */
  eq: Record<number, number>;
  /** LUFS to leave the cleaned clip at */
  level: number;
  /** what was found and why each decision was taken, in the order of work */
  notes: string[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

export function advise(h: Listening, use: Use): Advice {
  const u = usageById(use);
  const notes: string[] = [];
  const floor = h.noiseDb;
  const noisy = floor == null ? 1 : floor > -45 ? 3 : floor > -55 ? 2 : floor > -65 ? 1 : 0;
  let noise = [0.15, 0.4, 0.62, 0.85][noisy];
  // singing is cleaned gently: a hard spectral gate eats the tails of held notes
  if (!u.speech) noise = Math.min(noise, use === "choir" ? 0.45 : 0.6);
  notes.push(
    floor == null ? "التسجيل متواصل بلا فواصل صمت، فما أقدر أقيس الضجيج تحته بدقة: تخفيض خفيف احتياطًا."
      : noisy === 0 ? `الضجيج تحت الصوت منخفض (${floor} dB): تنظيف خفيف فقط حتى لا يتأذى الصوت.`
      : `الضجيج تحت الصوت عند ${floor} dB (${["", "خفيف", "واضح", "عالٍ"][noisy]}): تخفيض ${noisy === 3 ? "قوي" : noisy === 2 ? "متوسط" : "خفيف"}${u.speech ? "" : " وبحذر لأنه غناء"}.`,
  );
  const ai = u.speech && noisy >= 2;
  if (ai) notes.push("ضجيج متغيّر مع كلام: تُضاف الشبكة العصبية (مدرّبة على الكلام).");
  else if (!u.speech && noisy >= 2) notes.push("الشبكة العصبية مطفأة: هي مدرّبة على الكلام وتأكل النغمات الممدودة.");
  if (h.hum) notes.push(`طنين كهرباء ${h.hum} هرتز موجود: يُقصّ هو وتوافقياته.`);
  const rumbleHz = use === "choir" ? 130 : use === "phone" ? 120 : use === "lesson" || use === "mawlid" ? 100 : use === "aza" || use === "solo" ? 90 : 80;
  const ringy = h.ringMs > 450;
  const reverb = ringy ? (u.speech ? 0.6 : 0.3) : h.ringMs > 320 && u.speech ? 0.3 : 0;
  if (reverb) notes.push(`الغرفة ترنّ (${h.ringMs} مللي ثانية): تخفيف الصدى${u.speech ? "" : " قليلًا، والباقي يغطيه ريفيرب نظيف"}.`);
  const deEss = h.sibilance > -6 ? 0.7 : h.sibilance > -12 ? 0.5 : 0.3;
  if (h.sibilance > -6) notes.push("السين والشين حادّة: دي-إسر قوي.");
  const gate = u.speech && noisy >= 1 && use !== "lesson";
  if (gate) notes.push("كلام بفواصل: بوابة تسكّت ما بين الجمل.");

  // tone: lean the chain's equalizer toward the reference where the measurement is clearly off
  const ref = REFERENCE[use === "choir" ? "choir" : "voice"];
  const off = h.tilt.map((v, i) => v - ref[i]);
  const eq: Record<number, number> = {};
  const nudge = (band: number, diff: number, label: string) => {
    if (Math.abs(diff) < 3) return;
    const by = r1(clamp(-diff * 0.5, -4, 4));
    eq[band] = by;
    notes.push(`${label} ${diff > 0 ? "أعلى" : "أقل"} من المرجع بـ ${r1(Math.abs(diff))} dB: ${by > 0 ? "رفع" : "قص"} ${Math.abs(by)} dB.`);
  };
  nudge(1, off[2], "الجسم (120–250 هرتز)");
  nudge(2, off[3], "منطقة الطين (250–500 هرتز)");
  nudge(4, off[5], "الحضور (2–4 كيلو)");
  nudge(6, (off[6] + off[7]) / 2, "اللمعة (فوق 4 كيلو)");
  if (Math.abs(off[3]) > 10 || Math.abs(off[5]) > 12) notes.push("الفرق عن المرجع كبير جدًا: الإكولايزر يحسّن، لكن الأصل في المايك أو مكان التسجيل.");

  const level = use === "podcast" || use === "lesson" || use === "phone" ? -16 : -18;
  notes.push(level === -16 ? "الجهارة تُضبط على −16 LUFS (معيار البودكاست)." : "المستوى يُترك عند −18 LUFS: مساحة للمكس، والجهارة النهائية في التصدير.");
  return { clean: { noise, ai, rumbleHz, hum: h.hum !== 0, clicks: use !== "choir", deEss: use === "choir" ? 0.3 : deEss, reverb, gate }, chain: u.chain, eq, level, notes };
}

/** A chain's equalizer bands with the advice's nudges added to their gains. */
export function nudgeBands(bands: EqBand[], eq: Advice["eq"]): EqBand[] {
  return bands.map((b, i) => {
    const d = eq[i];
    return d ? { ...b, on: true, gain: r1(clamp(b.gain + d, -12, 12)) } : b;
  });
}
