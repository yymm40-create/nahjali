// «لامحدود · UNLIMITED» (the owner, 25–26 November 2026): a pass for ONE generator (and, for video, ONE quality) used without a
// limit for 24 hours (or 12 hours at half the price). Inside each 12 hours the pass has a «fast» balance: 130 seconds of video, or
// 20 pictures. After it the generations still go, but slowly: each one waits before it is sent (video 10 → 15 → 20 → 25 minutes
// and stays at 25; pictures 3 → 6 → 9 → 12 and stays at 12). Everything starts again every 12 hours from the payment.
// The person is only told «fast, then slow without a fixed pace»; the exact waits stay here. No refund of any kind on a pass.
// The offer itself is on sale for 72 hours (`startsAt` + `hours`); a pass bought inside them runs its full time.
// Usage is counted from the person's own jobs (src/lib/jawad/server/unlimited.ts); a failed or cancelled job never counts.

export const UNLIMITED = {
  path: "/jawad-ai/unlimited",
  /** the 72 hours the passes can be bought in (Riyadh time) */
  startsAt: "2026-11-26T14:00:00+03:00",
  hours: 72,
  /** one fast/slow cycle */
  cycleHours: 12,
  /** the longest video a pass makes (longer ones are paid as usual) */
  maxVideoSec: 15,
  fast: { video: 130, image: 20 },
  /** minutes a slow generation waits, one after another inside a cycle (the last repeats) */
  holdMinutes: { video: [10, 15, 20, 25], image: [3, 6, 9, 12] },
} as const;

export type UnlimitedKind = "video" | "image";
export type UnlimitedHours = 24 | 12;

export interface UnlimitedPass {
  /** stable id, kept with every purchase and job */
  key: string;
  kind: UnlimitedKind;
  generatorId: string;
  name: string;
  /** the quality the pass is for (video), shown on the page */
  quality?: string;
  /** what the settings must be for a job to fall under the pass */
  match: Record<string, readonly string[]>;
  /** price of the 24-hour pass in riyals (the 12-hour one is half, rounded up) */
  price24: number;
  best?: boolean;
  /** one line under the name */
  line: string;
  /** the settings the page uses to quote the usual price of one generation */
  sample: Record<string, string | number | boolean>;
}

/** The owner's prices (25 November 2026): video per generator and quality, pictures 19 riyals each. */
export const UNLIMITED_PASSES: UnlimitedPass[] = [
  { key: "seedance25-720", kind: "video", generatorId: "byteplus-seedance-2-5", name: "Seedance 2.5", quality: "720p", match: { resolution: ["720p"] }, price24: 249, best: true, line: "أقوى مولّد فيديو سينمائي، بصوت متزامن", sample: { resolution: "720p", duration: 15, ratio: "9:16", audio: true } },
  { key: "seedance25-480", kind: "video", generatorId: "byteplus-seedance-2-5", name: "Seedance 2.5", quality: "480p", match: { resolution: ["480p"] }, price24: 109, line: "نفس القوة بدقة أخف وسعر أقل", sample: { resolution: "480p", duration: 15, ratio: "9:16", audio: true } },
  { key: "realface25-720", kind: "video", generatorId: "seedance-real-face", name: "Seedance وجه واقعي 2.5", quality: "720p", match: { version: ["2.5"], resolution: ["720p"] }, price24: 449, line: "وجهك أنت في الفيديو بشكل واقعي", sample: { version: "2.5", resolution: "720p", duration: 15, ratio: "9:16", audio: true } },
  { key: "realface25-480", kind: "video", generatorId: "seedance-real-face", name: "Seedance وجه واقعي 2.5", quality: "480p", match: { version: ["2.5"], resolution: ["480p"] }, price24: 199, line: "وجهك أنت في الفيديو بشكل واقعي", sample: { version: "2.5", resolution: "480p", duration: 15, ratio: "9:16", audio: true } },
  { key: "seedance20-720", kind: "video", generatorId: "byteplus-seedance-2-0", name: "Seedance 2.0", quality: "720p", match: { resolution: ["720p"] }, price24: 149, line: "حركة قوية وثابتة", sample: { resolution: "720p", duration: 15, ratio: "9:16", audio: true } },
  { key: "seedance20-480", kind: "video", generatorId: "byteplus-seedance-2-0", name: "Seedance 2.0", quality: "480p", match: { resolution: ["480p"] }, price24: 69, line: "حركة قوية بسعر خفيف", sample: { resolution: "480p", duration: 15, ratio: "9:16", audio: true } },
  { key: "realface20-720", kind: "video", generatorId: "seedance-real-face", name: "Seedance وجه واقعي 2.0", quality: "720p", match: { version: ["2.0"], resolution: ["720p"] }, price24: 329, line: "وجهك في الفيديو على 2.0", sample: { version: "2.0", resolution: "720p", duration: 15, ratio: "9:16", audio: true } },
  { key: "realface20-480", kind: "video", generatorId: "seedance-real-face", name: "Seedance وجه واقعي 2.0", quality: "480p", match: { version: ["2.0"], resolution: ["480p"] }, price24: 149, line: "وجهك في الفيديو على 2.0", sample: { version: "2.0", resolution: "480p", duration: 15, ratio: "9:16", audio: true } },
  { key: "wan30-720", kind: "video", generatorId: "wan-3-0", name: "Wan 3.0", quality: "720p", match: { resolution: ["720p"] }, price24: 99, line: "سريع ورخيص، ممتاز للتجارب", sample: { resolution: "720p", duration: 15, ratio: "9:16", audio: true } },
  { key: "wan30-480", kind: "video", generatorId: "wan-3-0", name: "Wan 3.0", quality: "480p", match: { resolution: ["480p"] }, price24: 49, line: "أرخص فيديو لامحدود", sample: { resolution: "480p", duration: 15, ratio: "9:16", audio: true } },
  { key: "gpt26", kind: "image", generatorId: "openai-gpt-image-2-6", name: "GPT Image 2.6", match: { quality: ["low", "medium", "high"] }, price24: 19, best: true, line: "أذكى مولّد صور، والكتابة العربية فيه مضبوطة", sample: { quality: "high", count: 1 } },
  { key: "gpt2", kind: "image", generatorId: "openai-gpt-image-2", name: "GPT Image 2", match: { quality: ["low", "medium"], resolution: ["std"] }, price24: 19, line: "صور دقيقة وسريعة، بجودة متوسطة", sample: { quality: "medium", resolution: "std", count: 1 } },
  { key: "nanopro", kind: "image", generatorId: "google-nano-banana-pro", name: "Nano Banana Pro", match: { resolution: ["1K", "2K"] }, price24: 19, line: "أفضل تعديل للصور وتثبيت الشخصيات (1K و2K)", sample: { resolution: "2K", count: 1 } },
];

export const unlimitedPass = (key: string) => UNLIMITED_PASSES.find((p) => p.key === key) ?? null;
export const passPrice = (p: UnlimitedPass, hours: UnlimitedHours) => (hours === 24 ? p.price24 : Math.ceil(p.price24 / 2));

export const unlimitedStart = () => Date.parse(UNLIMITED.startsAt);
export const unlimitedEnd = () => unlimitedStart() + UNLIMITED.hours * 3600_000;
export function unlimitedPhase(now = Date.now()): "before" | "open" | "over" {
  return now < unlimitedStart() ? "before" : now < unlimitedEnd() ? "open" : "over";
}

/** Does a job with these settings fall under this pass? (generator, its quality, and a video no longer than the pass allows) */
export function passCovers(p: UnlimitedPass, generatorId: string, settings: Record<string, unknown>): boolean {
  if (p.generatorId !== generatorId) return false;
  for (const [k, allowed] of Object.entries(p.match)) if (!allowed.includes(String(settings[k] ?? ""))) return false;
  if (p.kind === "video" && Number(settings.duration ?? 0) > UNLIMITED.maxVideoSec) return false;
  if (String(settings.format ?? "") === "gif") return false;
  return true;
}

/** The wait before a slow generation is sent: the n-th slow one in its cycle (0-based). */
export const holdFor = (kind: UnlimitedKind, n: number) => {
  const list = UNLIMITED.holdMinutes[kind];
  return list[Math.min(n, list.length - 1)] * 60_000;
};

/** How much of the fast balance one job takes: its seconds (video) or its pictures. */
export const fastUnits = (kind: UnlimitedKind, settings: Record<string, unknown>) =>
  kind === "video" ? Math.max(1, Math.round(Number(settings.duration ?? 5) || 5)) : Math.max(1, Math.round(Number(settings.count ?? 1) || 1));
