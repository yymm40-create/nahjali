// «عرض الـ٢٥ ريال» (the owner, 15 November 2026): pay 25 riyals once (first set at 10, raised the same day) and get, from the moment of payment —
//   · Nano Banana Pro without a limit for one day,
//   · 20 GPT Image 2 pictures within two days,
//   · 4 Seedance 2.0 videos at 480p within two days (raised from 3 on 16 Nov: «نرفعها ٤» — a one-minute film).
// The offer itself can be bought for 48 hours only. What one person has used is counted from their own jobs
// (src/lib/jawad/server/offer10.ts); a failed or cancelled job never counts.

export const OFFER10 = {
  path: "/jawad-ai/offer",
  priceSar: 25,
  /** the 48 hours the offer can be bought in (Riyadh time) */
  startsAt: "2026-11-15T18:00:00+03:00",
  hours: 48,
} as const;

export type Offer10Key = "nano" | "gpt" | "seedance";

export interface Offer10Grant {
  key: Offer10Key;
  generatorId: string;
  name: string;
  /** hours after the payment it stays free */
  hours: number;
  /** pictures or videos allowed (null = no limit) */
  cap: number | null;
  /** the only resolution the free use takes (null = any) */
  resolution: string | null;
  /** how it is said on the page */
  line: string;
  unit: string;
}

export const OFFER10_GRANTS: Offer10Grant[] = [
  { key: "nano", generatorId: "google-nano-banana-pro", name: "Nano Banana Pro", hours: 24, cap: null, resolution: "1K", line: "بلا حدود يوم كامل (دقة 1K)", unit: "صورة" },
  { key: "gpt", generatorId: "openai-gpt-image-2", name: "GPT Image 2", hours: 48, cap: 20, resolution: null, line: "٢٠ صورة خلال يومين", unit: "صورة" },
  { key: "seedance", generatorId: "byteplus-seedance-2-0", name: "Seedance 2.0", hours: 48, cap: 4, resolution: "480p", line: "٤ فيديوهات بدقة 480p خلال يومين (فلم دقيقة)", unit: "فيديو" },
];

export const offer10Start = () => Date.parse(OFFER10.startsAt);
export const offer10End = () => offer10Start() + OFFER10.hours * 3600_000;

/** Can the offer be bought now? */
export const offer10Open = (now = Date.now()) => now >= offer10Start() && now < offer10End();

/** Where the offer stands now: not started, can be bought, or over. */
export function offer10Phase(now = Date.now()): "before" | "open" | "over" {
  return now < offer10Start() ? "before" : now < offer10End() ? "open" : "over";
}

export const offer10GrantFor = (generatorId: string) => OFFER10_GRANTS.find((g) => g.generatorId === generatorId) ?? null;
