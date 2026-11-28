// «نسخة GPT Image» (the owner, 28 November 2026): wherever the site paints with GPT Image, the person picks GPT Image 2, or
// GPT Image 2.6 — the newer, more developed one, at about the same price — in ITS two models: Sunburst (the finer and
// steadier) or Flare (the faster). The person's choice, never ours. Pure (pages and server alike).

import { GPT_IMAGE_26_ID, GPT_IMAGE_26_MODELS, GPT_IMAGE_2_ID } from "./generators";

export type GptImagePick = "2" | "sunburst" | "flare";

export const GPT_IMAGE_PICKS: { value: GptImagePick; label: string; hint: string }[] = [
  { value: "2", label: "GPT Image 2", hint: "المعتاد" },
  { value: "sunburst", label: "GPT Image 2.6 Sunburst", hint: "الأحدث: الأدق والأثبت" },
  { value: "flare", label: "GPT Image 2.6 Flare", hint: "الأحدث: الأسرع" },
];

export const isGptImagePick = (v: unknown): v is GptImagePick => v === "2" || v === "sunburst" || v === "flare";

/** GPT Image 2's dated model id (the one the site's direct calls use). */
export const GPT_IMAGE_2_MODEL = "gpt-image-2-2026-04-21";

/** The OpenAI model of a pick (`two`: the id a caller already used for GPT Image 2). */
export const gptImageModel = (p: GptImagePick | null | undefined, two: string = GPT_IMAGE_2_MODEL) => (p === "sunburst" || p === "flare" ? GPT_IMAGE_26_MODELS[p] : two);

/** The studio generator of a pick: what «لامحدود» passes are counted against (GPT Image 2's pass, or 2.6's with both its models). */
export const gptImageGenerator = (p: GptImagePick | null | undefined) => (p === "sunburst" || p === "flare" ? GPT_IMAGE_26_ID : GPT_IMAGE_2_ID);

/** As the person reads it. */
export const gptImageName = (p: GptImagePick | null | undefined) => GPT_IMAGE_PICKS.find((x) => x.value === (p ?? "2"))!.label;
