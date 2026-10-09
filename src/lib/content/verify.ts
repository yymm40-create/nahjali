// «صانع المحتوى» — the check after a slide is drawn: Claude looks at the picture and compares the Arabic on it with the
// approved text (spelling, joined letters, right-to-left, cropping, extra words) and, if a woman is drawn, whether
// she is in the allowed dress (a plain fully black abaya, only face and hands). An automatic check: it is told to
// the person as that, never as a guarantee. Server only.

import sharp from "sharp";
import { callClaudeJson, claudeCost } from "@/lib/film/anthropic";

export interface SlideCheck {
  /** the picture passed every point (or could not be checked: see `checked`) */
  ok: boolean;
  /** false when the check itself could not run (the picture is kept and said to be unchecked) */
  checked: boolean;
  problems: string[];
  woman: "none" | "covered_ok" | "violation";
  /** what Claude read on the picture */
  read: string;
  usd: number;
}

interface Verdict {
  read_text: string;
  text_matches: boolean;
  letters_joined: boolean;
  direction_ok: boolean;
  cropped: boolean;
  extra_text: boolean;
  woman: "none" | "covered_ok" | "violation";
  problems: string[];
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["read_text", "text_matches", "letters_joined", "direction_ok", "cropped", "extra_text", "woman", "problems"],
  properties: {
    read_text: { type: "string", description: "All the text you can read on the picture, line by line." },
    text_matches: { type: "boolean", description: "Every expected word is on the picture, spelled exactly as expected (ignore diacritics)." },
    letters_joined: { type: "boolean", description: "The Arabic letters are properly joined into words (no separated, broken, mirrored or garbled letters)." },
    direction_ok: { type: "boolean", description: "The Arabic reads right-to-left in the correct word order." },
    cropped: { type: "boolean", description: "Some text is cut off by the edge or hidden." },
    extra_text: { type: "boolean", description: "There are words or letters that are not in the expected text (fake text, gibberish, a watermark)." },
    woman: { type: "string", enum: ["none", "covered_ok", "violation"] },
    problems: { type: "array", items: { type: "string" }, description: "Each real problem in one short Arabic sentence (which word or where). Empty when there is none." },
  },
} as const;

const SYSTEM = `You inspect ONE generated slide of an Arabic carousel and report facts. You are given the EXPECTED on-slide text (the approved copy) and the picture.
- Read the picture's text yourself first, then compare it with EXPECTED letter by letter (ignore diacritics; Arabic-Indic and Western digits are interchangeable).
- text_matches is false if any expected word is missing, misspelled, or replaced. If EXPECTED is empty, text_matches is true.
- letters_joined is false when letters inside a word are separated, reversed, mirrored, doubled or turned into nonsense shapes.
- direction_ok is false when the words run left-to-right or their order is reversed.
- cropped is true when any text touches or crosses the edge or is covered. extra_text is true for any word or letter not in EXPECTED (purely decorative shapes are fine).
- woman: "none" when no woman or girl is visible (a man, a boy, an animal or an object is "none"); "covered_ok" when a woman is visible wearing a plain, fully black abaya that covers the whole body, with no ornament, pattern, colour or accessory, showing only her face and hands (no visible hair, neck, arms, legs or feet); "violation" for any other depiction of a woman.
- problems: list only what is really wrong, in short Arabic. Do not praise. Do not invent problems.`;

const withTimeout = <T>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("check timed out")), ms))]);

/** Checks one slide picture against its approved text. Never throws: a failed check comes back `checked: false`. */
export async function checkSlide(png: Buffer, expected: string): Promise<SlideCheck> {
  try {
    const jpeg = await sharp(png).resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 82 }).toBuffer();
    const r = await withTimeout(
      callClaudeJson<Verdict>({
        system: SYSTEM,
        turns: [{ role: "user", content: [{ type: "text", text: `EXPECTED on-slide text (exactly):\n${expected.trim() || "(none)"}` }, { type: "image64", data: jpeg.toString("base64"), mediaType: "image/jpeg" }] }],
        schema: SCHEMA,
        maxTokens: 1200,
        effort: "low",
      }),
      35_000,
    );
    const v = r.data;
    const problems = (Array.isArray(v.problems) ? v.problems : []).map((x) => String(x).slice(0, 200)).filter(Boolean).slice(0, 5);
    const ok = v.text_matches && v.letters_joined && v.direction_ok && !v.cropped && !v.extra_text && v.woman !== "violation";
    if (!ok && !problems.length) {
      if (!v.text_matches) problems.push("النص على الشريحة لا يطابق النص المعتمد");
      if (!v.letters_joined) problems.push("حروف عربية غير متصلة أو مشوّهة");
      if (!v.direction_ok) problems.push("اتجاه الكتابة أو ترتيب الكلمات خاطئ");
      if (v.cropped) problems.push("نص مقطوع عند الحافة");
      if (v.extra_text) problems.push("كلمات أو حروف زائدة على الشريحة");
      if (v.woman === "violation") problems.push("امرأة بلباس غير مسموح (ليست عباية سوداء سادة تكشف الوجه والكفين فقط)");
    }
    return { ok, checked: true, problems, woman: v.woman, read: String(v.read_text ?? "").slice(0, 600), usd: claudeCost(r.usage) };
  } catch (e) {
    console.error("slide check", e instanceof Error ? e.message : e);
    return { ok: true, checked: false, problems: [], woman: "none", read: "", usd: 0 };
  }
}

/** The note added to a slide's prompt for its next attempt, from what the check found. */
export function fixNote(c: SlideCheck, expected: string): string {
  const parts = [`The previous attempt had these problems — fix every one of them: ${c.problems.join("; ") || "the text did not match"}.`];
  if (expected.trim()) parts.push(`The Arabic text on the slide must read exactly, once, right-to-left, with joined letters, fully inside the slide: "${expected.trim()}". No other text at all.`);
  if (c.woman === "violation") parts.push("If a woman is shown she must wear a plain fully black abaya with no ornament, only her face and hands visible — otherwise show no woman.");
  return parts.join(" ");
}
