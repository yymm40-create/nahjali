// «ماسك ذكي»: the person (or «حيدرة») names what to select — «الوجه», «السماء», «الشخص اللي يمين» — and Meta's SAM 3
// (on fal) finds it in a few moments of the clip. Claude turns the Arabic words into the short English name SAM
// understands; each moment comes back as small black-and-white masks (every match), which the page turns into the
// outline it tracks. Server only.

import sharp from "sharp";
import { UserError } from "@/lib/api";
import { callClaudeJson } from "@/lib/film/anthropic";
import { falReady, falRun } from "@/lib/jawad/server/providers/fal";
import { ProviderError } from "@/lib/jawad/server/providers/common";
import { charged, type Who } from "./pricing";
import { stillOpen, type EditorProject } from "./server";

/** Moments sent in one request (the page sends more in turns). */
export const MASK_BATCH = 8;
/** The masks' side sent back (small: the outline needs no more). */
const SIDE = 160;

const CONCEPT_SCHEMA = { type: "object", additionalProperties: false, required: ["concept"], properties: { concept: { type: "string" } } };

/** The words as SAM understands them: a short English noun phrase («الشخص اللي يمين» → "person on the right"). */
async function concept(words: string) {
  if (/^[\x20-\x7e]+$/.test(words)) return words.slice(0, 80);
  const r = await callClaudeJson<{ concept: string }>({
    system: "Turn the user's description of what to select in a video frame into a short English noun phrase for an open-vocabulary segmentation model (SAM 3), e.g. «الوجه» → \"face\", «السماء» → \"sky\", «الشخص اللي يمين» → \"person on the right\", «الثوب الأبيض» → \"white robe\". Only the phrase.",
    turns: [{ role: "user", content: words }],
    schema: CONCEPT_SCHEMA,
    maxTokens: 400,
    effort: "low",
    fallback: true,
  });
  return r.data.concept.trim().slice(0, 80) || words;
}

type SamOut = { masks?: { url?: string }[]; scores?: number[] };

/** One moment: every mask SAM finds, as small grey pictures (raw, one byte a pixel). */
async function samFrame(jpeg: string, what: string) {
  const out = await falRun<SamOut>("fal-ai/sam-3/image", { image_url: `data:image/jpeg;base64,${jpeg}`, prompt: what, apply_mask: false, return_multiple_masks: true, max_masks: 4, include_scores: true, output_format: "png" }, 90_000);
  const masks: { w: number; h: number; data: string; score: number | null }[] = [];
  for (const [i, m] of (out.masks ?? []).entries()) {
    if (!m.url) continue;
    const r = await fetch(m.url);
    if (!r.ok) continue;
    const { data, info } = await sharp(Buffer.from(await r.arrayBuffer()))
      .flatten({ background: "#000" })
      .resize(SIDE, SIDE, { fit: "inside" })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    masks.push({ w: info.width, h: info.height, data: data.toString("base64"), score: out.scores?.[i] ?? null });
  }
  return masks;
}

export async function smartMask(p: EditorProject, who: Who, b: { prompt?: unknown; concept?: unknown; frames?: unknown }) {
  stillOpen(p);
  const words = String(b.prompt ?? "").trim().slice(0, 200);
  if (!words) throw new UserError("اكتب وش تبي تحدد (مثلًا: الوجه).", 400);
  if (!falReady()) throw new UserError("الماسك الذكي غير مفعّل على الخادم.", 503);
  const frames = (Array.isArray(b.frames) ? b.frames : []).slice(0, MASK_BATCH).filter((f): f is string => typeof f === "string" && f.length < 500_000 && /^[A-Za-z0-9+/]+=*$/.test(f));
  if (!frames.length) throw new UserError("ما وصلت صور المقطع.", 400);
  return charged(who, "editor_price_claude", 1, "ماسك ذكي في حيدرة كت", async () => {
    const what = typeof b.concept === "string" && b.concept.trim() ? b.concept.trim().slice(0, 80) : await concept(words).catch(() => words);
    try {
      const masks = await Promise.all(frames.map((f) => samFrame(f, what).catch((e) => (e instanceof ProviderError ? null : Promise.reject(e)))));
      return { concept: what, masks };
    } catch (e) {
      console.error("smart mask", e);
      throw new UserError("تعذّر تحديد الماسك الحين؛ جرّب مرة ثانية.", 502);
    }
  });
}
