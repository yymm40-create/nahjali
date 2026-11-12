// «ترجم الكابشن» — the server's part: a caption track's lines translated by Claude, line for line (the page puts them
// back on the same times as a new caption track). Priced per started block of 50 lines (the owner's
// «editor_price_translate»): asked first with `quote` (the page shows the price), then run with the price the person
// agreed; a higher price is asked again (409 «price_changed»), and a failed translation gives the coins back.

import { UserError } from "@/lib/api";
import { coinStr } from "@config/coins";
import { callClaudeJson } from "@/lib/film/anthropic";
import { withClaude } from "@/lib/film/claude-model";
import { charged, priceOf, type Who } from "./pricing";
import { stillOpen, type EditorProject } from "./server";
import { isTranslateLang, langOf, readLines, translateUnits, TRANSLATE_LANGS } from "./caption-translate";

/** Lines sent in one request (a long track goes in a few). */
const BATCH = 120;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["lines"],
  properties: { lines: { type: "array", items: { type: "object", additionalProperties: false, required: ["i", "t"], properties: { i: { type: "integer" }, t: { type: "string" } } } } },
};

// the same for every call (cached): the language of this call is in the turn's note
const SYSTEM = `You translate the captions (subtitles) of a short video. You get numbered lines as JSON [{"i":N,"t":"text"}], in the order they are said. Return EVERY line, with the same "i", translated into the target language named in the note — one translation per line, never merged with or split across another line, never skipped (a line that is only a name, a number or an emoji is copied as it is).
Write as subtitles are written: short, natural and spoken, the meaning and the tone kept (a joke stays a joke, a religious phrase keeps its reverence: «صلى الله عليه وآله» stays in full, never ﷺ), names of people, brands and places kept, numbers as digits. Use the lines around a line for context, but each line's text must match what is said in that line. No notes, no quotes added, no explanations.`;

export async function translateCaptions(p: EditorProject, who: Who, b: { lines?: unknown; to?: unknown; quote?: unknown; expectedCoins?: unknown }) {
  stillOpen(p);
  if (!isTranslateLang(b.to)) throw new UserError(`اختر لغة الترجمة (${TRANSLATE_LANGS.map((l) => l.label).join("، ")}).`, 400);
  const lines = readLines(b.lines);
  if (!lines) throw new UserError("ما وصلت جمل الكابشن؛ اختر مسار كابشن فيه كلام.", 400);
  const units = translateUnits(lines.length);
  const { coins } = await priceOf(who, "editor_price_translate", units);
  if (b.quote) return { coins, lines: lines.length };
  // the price the person saw: a higher one is asked again (a lower one is simply taken)
  const agreed = Number(b.expectedCoins);
  if (!Number.isFinite(agreed) || coins > agreed) throw new UserError(`سعر الترجمة صار ${coinStr(coins)}. أكّد المبلغ الجديد.`, 409, { code: "price_changed", coins });
  const lang = langOf(b.to);
  const texts = await charged(who, "editor_price_translate", units, `ترجمة كابشن إلى ${lang.label} في حيدرة كت`, async () => {
    const out: string[] = new Array(lines.length).fill("");
    for (let k = 0; k < lines.length; k += BATCH) {
      const part = lines.slice(k, k + BATCH);
      const r = await withClaude("claude-sonnet-5-5", () =>
        callClaudeJson<{ lines: { i: number; t: string }[] }>({
          system: SYSTEM,
          turns: [{ role: "user", content: JSON.stringify(part.map((l, j) => ({ i: k + j, t: l.body }))) }],
          turnNote: `Target language: ${lang.name}. ${part.length} lines, numbered ${k}–${k + part.length - 1}.`,
          schema: SCHEMA,
          maxTokens: Math.min(32_000, 800 + part.reduce((n, l) => n + l.body.length, 0) * 4),
          effort: "low",
          fallback: true,
          cacheTail: false,
        }),
      ).catch((e) => {
        console.error("caption translate", e);
        throw new UserError("ما قدرنا نترجم الكابشن الحين؛ ما انخصم منك شي. جرّب بعد شوي.", 502);
      });
      for (const x of r.data.lines ?? []) if (Number.isInteger(x.i) && x.i >= k && x.i < k + part.length && typeof x.t === "string") out[x.i] = x.t.trim();
    }
    // a translation that came back mostly empty is a failure (the coins come back), not a track of the old words
    const done = out.filter(Boolean).length;
    if (done < Math.ceil(lines.length * 0.8)) throw new UserError("الترجمة رجعت ناقصة؛ ما انخصم منك شي. جرّب مرة ثانية.", 502);
    return out;
  });
  return { texts, coins };
}
