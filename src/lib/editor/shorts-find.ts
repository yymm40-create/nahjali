// «طلّع مقاطع قصيرة» — the server's part: a long file's kept transcript (speech.ts, already paid for) read by Claude as
// numbered sentences, and the standalone moments it finds checked, fitted and snapped (shorts.ts). Priced per started
// 10 minutes of the file (the owner's «editor_price_shorts»): asked first with `quote` (the page shows the price), then
// run with the price the person agreed (a higher one is asked again, 409 «price_changed»); a failed or empty answer
// gives the coins back. The last moments found are kept with the file, so opening the window again costs nothing.

import { UserError } from "@/lib/api";
import { coinStr } from "@config/coins";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaudeJson } from "@/lib/film/anthropic";
import { withClaude } from "@/lib/film/claude-model";
import { charged, priceOf, type Who } from "./pricing";
import { isUuid, stillOpen, type AssetRow, type EditorProject } from "./server";
import { covered, mergeTranscripts, type TWord } from "./transcript";
import { planMoments, readCount, readKeptMoments, readLengths, readMoments, sentenceLines, sentences, SHORTS_MAX_MS, SHORTS_SCHEMA, shortsUnits, type Moment } from "./shorts";

const db = () => createAdminClient();

// the same for every call (cached): the file's length, the range and the count are in the turn's note
const SYSTEM = `You are a short-form video editor (the OpusClip / Reels / Shorts way). You get the transcript of a long video (a talk, a podcast, a lesson, a vlog) as numbered sentences: "[N] start (length) text". Find the moments that work as a short ON THEIR OWN — someone who never saw the long video understands it and gets something from it.
Each moment is a run of whole sentences, from sentence "from" to sentence "to" (both included), inside the length range the note gives (sum the lengths). Prefer moments that:
- open with a hook in the first 3 seconds (a bold claim, a question, a surprising fact, a strong feeling) — never "as I said", "and then", a greeting or a reference to something earlier;
- are complete: a clear start, a point, and an ending that lands (an answer, a punchline, a lesson), with no "this" or "he" whose meaning is outside the clip;
- carry value or emotion (a useful idea, a story, humour, awe, faith, a strong opinion);
- keep a lively pace (little rambling, few long pauses).
Never overlap two moments. Prefer the best moments to many weak ones; spread them over the video when the quality is equal.
For each: "title" — a short catchy title in the video's own language (plain words, no hashtags or emoji, at most 8 words); "score" — 0 to 99, how likely it is to do well as a short (be honest: an average moment is 50–65, only a rare one is above 85); "reasons" — 2 or 3, each {kind, text}: kind is "hook" (its opening), "complete" (does it stand alone), "value" (value or emotion) or "pace", and text is ONE short phrase in the language the note asks for; "tip" — ONE short concrete way to make this clip better (a hook text on screen, cutting a slow sentence, a zoom on the punchline, a caption style…), in that language.
Religious phrases keep their full form («صلى الله عليه وآله», never ﷺ). Names are kept as said.`;

async function fileOf(p: EditorProject, id: unknown) {
  if (!isUuid(id)) throw new UserError("اختر ملف الفيديو.", 400);
  const { data } = await db().from("editor_assets").select("*").eq("id", id).eq("project_id", p.id).maybeSingle();
  const row = data as AssetRow | null;
  if (!row || row.status !== "ready") throw new UserError("ما لقينا الملف.", 404);
  if (row.kind === "image") throw new UserError("الصور ما فيها كلام.", 400);
  return row;
}

/** The file's words, how long it is, and whether (nearly) all of it was written. */
function speechOf(row: AssetRow) {
  const speech = mergeTranscripts(row.meta?.transcripts as Record<string, TWord[]> | undefined);
  const durationMs = row.duration_ms ?? (speech.words.length ? speech.words[speech.words.length - 1].e : 0);
  return { words: speech.words, durationMs, written: speech.words.length > 0 && covered(speech.spans, 0, durationMs) >= 0.9 };
}

interface Kept {
  at: string;
  min: number;
  max: number;
  moments: Moment[];
}

const keptOf = (row: AssetRow): Kept | null => {
  const k = row.meta?.shorts as Partial<Kept> | undefined;
  if (!k || !Array.isArray(k.moments)) return null;
  return { at: String(k.at ?? ""), min: Number(k.min) || 0, max: Number(k.max) || 0, moments: readKeptMoments(k.moments) };
};

/**
 * `{ assetId, min, max, count, lang, quote?, expectedCoins? }`. With `quote`: the price, the file's minutes, whether
 * its words are written (`need: "transcript"` when not), and the moments last found in it. Without: the moments (the
 * coins taken only when at least one usable moment came back).
 */
export async function findShorts(p: EditorProject, who: Who, b: { assetId?: unknown; min?: unknown; max?: unknown; count?: unknown; lang?: unknown; quote?: unknown; expectedCoins?: unknown }) {
  stillOpen(p);
  const row = await fileOf(p, b.assetId);
  const { words, durationMs, written } = speechOf(row);
  const kept = keptOf(row);
  const units = shortsUnits(durationMs);
  const { coins } = await priceOf(who, "editor_price_shorts", units);
  const minutes = Math.max(1, Math.ceil(durationMs / 60_000));
  if (b.quote) return { coins, minutes, need: written ? null : ("transcript" as const), kept };
  if (!written) throw new UserError("كلام هذا الملف ما انكتب كامل بعد؛ اكتبه أول (بسعر الكابشن) وبعدين طلّع المقاطع.", 409, { code: "need_transcript" });
  if (durationMs > SHORTS_MAX_MS) throw new UserError("الملف أطول من ٣ ساعات؛ قسّمه وطلّع المقاطع من كل جزء.", 400);
  const len = readLengths(b.min, b.max);
  const count = readCount(b.count);
  if (durationMs < len.min * 1000 * 2) throw new UserError(`الفيديو قصير (${Math.round(durationMs / 1000)} ثانية)؛ المقاطع القصيرة تطلع من فيديو طويل.`, 400);
  const agreed = Number(b.expectedCoins);
  if (!Number.isFinite(agreed) || coins > agreed) throw new UserError(`السعر صار ${coinStr(coins)}. أكّد المبلغ الجديد.`, 409, { code: "price_changed", coins });
  const sents = sentences(words);
  const arabic = /[؀-ۿ]/.test(words.slice(0, 200).map((w) => w.w).join(""));
  const lang = b.lang === "en" ? "English" : arabic || b.lang === "ar" ? "plain, simple Arabic (Gulf-friendly, no hard words)" : "the video's own language";
  const moments = await charged(who, "editor_price_shorts", units, "مقاطع قصيرة في حيدرة كت", async () => {
    const r = await withClaude("claude-sonnet-5-5", () =>
      callClaudeJson<unknown>({
        system: SYSTEM,
        turns: [{ role: "user", content: sentenceLines(words, sents) }],
        turnNote: `The video is ${Math.round(durationMs / 60_000)} minutes long, ${sents.length} sentences (numbered 0–${sents.length - 1}). Find between 3 and ${count} moments (fewer only if the video truly has fewer good ones), each lasting between ${len.min} and ${len.max} seconds. Write the reasons and the tips in ${lang}.`,
        schema: SHORTS_SCHEMA,
        maxTokens: 8000,
        effort: "low",
        fallback: true,
        cacheTail: false,
      }),
    ).catch((e) => {
      console.error("editor shorts", e);
      throw new UserError("ما قدرنا نقرأ الفيديو الحين؛ ما انخصم منك شي. جرّب بعد شوي.", 502);
    });
    const plan = planMoments(readMoments(r.data, sents.length), words, sents, { assetId: row.id, minMs: len.min * 1000, maxMs: len.max * 1000, count, durationMs });
    // nothing usable: a failure (the coins come back), not an empty list that was paid for
    if (!plan.length) throw new UserError("ما لقينا لحظات تصلح مقاطع لحالها بهذا الطول؛ ما انخصم منك شي. جرّب مدى طول ثاني.", 422);
    return plan;
  });
  // kept with the file (its newest record, so a transcript written meanwhile isn't lost)
  const { data: fresh } = await db().from("editor_assets").select("meta").eq("id", row.id).maybeSingle();
  const meta = ((fresh as { meta?: Record<string, unknown> } | null)?.meta ?? row.meta ?? {}) as Record<string, unknown>;
  await db()
    .from("editor_assets")
    .update({ meta: { ...meta, shorts: { at: new Date().toISOString(), min: len.min, max: len.max, moments } } })
    .eq("id", row.id);
  return { moments, coins };
}
