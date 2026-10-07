// «المسلسل الذكي»: the series' look and its people and places, made once and chosen in every scene. The style picture
// comes first (style, colours and technique only — no characters); every character's and place's picture then follows
// it. سجاد writes each picture's English prompt from the Arabic description; GPT Image 2 draws it. Server only.

import { after } from "next/server";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { storage } from "@/lib/storage";
import { MASTER_STYLE_ONLY } from "@config/film-prompts/sheet-maker";
import { callClaudeJson, claudeCost } from "./anthropic";
import { generateFilmImage, IMAGE_ESTIMATE_USD, IMAGE_SIZES } from "./images";
import { refundSeries, reserveSeries, settleSeries } from "./series-pay";
import { FILM_BUCKET } from "./types";
import type { FilmSeries } from "./series";

const db = () => createAdminClient();

export type CastKind = "style" | "character" | "place";
export const CAST_KINDS: Record<CastKind, string> = { style: "ستايل المسلسل", character: "شخصية", place: "بيئة" };
export const MAX_CAST = 80;
const PROMPT_USD = 0.06;

export interface CastEntry {
  id: string;
  series_id: string;
  kind: CastKind;
  name: string;
  description: string;
  prompt: string;
  storage_path: string | null;
  status: "none" | "generating" | "ready" | "failed";
  error: string | null;
  created_at: string;
  updated_at: string;
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\p{Cc}\p{Cf}]/gu, (c) => (c === "\n" ? c : " ")).trim().slice(0, max) : "");

export async function castOf(seriesId: string): Promise<CastEntry[]> {
  const { data, error } = await db().from("film_series_cast").select("*").eq("series_id", seriesId).order("created_at", { ascending: true });
  if (error) return [];
  // a picture still "generating" long after its request died is marked failed (nothing was taken: it was refunded)
  const rows = (data ?? []) as CastEntry[];
  const stale = rows.filter((r) => r.status === "generating" && Date.now() - new Date(r.updated_at).getTime() > 10 * 60_000);
  if (stale.length) {
    await db().from("film_series_cast").update({ status: "failed", error: "انقطع التوليد؛ جرّب مرة ثانية." }).in("id", stale.map((r) => r.id));
    for (const r of stale) Object.assign(r, { status: "failed", error: "انقطع التوليد؛ جرّب مرة ثانية." });
  }
  return rows;
}

/** Signed links to the pictures (an hour). */
export async function castLinks(rows: CastEntry[]) {
  const ready = rows.filter((r) => r.storage_path);
  const out: Record<string, string> = {};
  if (!ready.length) return out;
  const { data } = await storage.from(FILM_BUCKET).createSignedUrls(ready.map((r) => r.storage_path!), 3600);
  (data ?? []).forEach((d, i) => d.signedUrl && (out[ready[i].id] = d.signedUrl));
  return out;
}

/** Adds an entry, or updates the one of the same kind and name (سجاد and the page both use this). */
export async function upsertCast(series: FilmSeries, b: { kind?: unknown; name?: unknown; description?: unknown }) {
  const kind = (["style", "character", "place"] as const).find((k) => k === b.kind);
  if (!kind) throw new UserError("اختر: شخصية أو بيئة.", 400);
  const name = kind === "style" ? CAST_KINDS.style : clean(b.name, 80).replace(/\s+/g, " ");
  if (!name) throw new UserError("اكتب الاسم.", 400);
  const description = clean(b.description, 6000);
  const rows = await castOf(series.id);
  const same = rows.find((r) => r.kind === kind && r.name === name);
  if (same) {
    if (description && description !== same.description) await db().from("film_series_cast").update({ description, prompt: "" }).eq("id", same.id);
    return same.id;
  }
  if (rows.length >= MAX_CAST) throw new UserError(`وصلت للحد الأقصى (${MAX_CAST}) للشخصيات والبيئات.`, 403);
  const { data, error } = await db().from("film_series_cast").insert({ series_id: series.id, kind, name, description }).select("id").single();
  if (error) throw new UserError("الشخصيات والبيئات تحتاج تجهيز قاعدة البيانات أول (ملف 0034).", 503);
  return data.id as string;
}

export async function editCast(series: FilmSeries, b: { castId?: unknown; name?: unknown; description?: unknown }) {
  const row = await oneCast(series, b.castId);
  const patch: Record<string, string> = {};
  if (b.name !== undefined && row.kind !== "style") {
    const n = clean(b.name, 80).replace(/\s+/g, " ");
    if (!n) throw new UserError("اكتب الاسم.", 400);
    patch.name = n;
  }
  if (b.description !== undefined) {
    patch.description = clean(b.description, 6000);
    // a new description needs a new picture prompt
    if (patch.description !== row.description) patch.prompt = "";
  }
  if (Object.keys(patch).length) await db().from("film_series_cast").update(patch).eq("id", row.id);
  // the style's words are the series' look
  if (row.kind === "style" && patch.description !== undefined) await db().from("film_series").update({ style: patch.description }).eq("id", series.id);
}

export async function removeCast(series: FilmSeries, castId: unknown) {
  const row = await oneCast(series, castId);
  await db().from("film_series_cast").delete().eq("id", row.id);
  if (row.storage_path) await storage.from(FILM_BUCKET).remove([row.storage_path]).catch(() => {});
}

async function oneCast(series: FilmSeries, castId: unknown) {
  const { data } = await db().from("film_series_cast").select("*").eq("id", String(castId)).eq("series_id", series.id).maybeSingle();
  if (!data) throw new UserError("ما لقينا هذي الشخصية أو البيئة.", 404);
  return data as CastEntry;
}

const PROMPT_SCHEMA = { type: "object", additionalProperties: false, required: ["prompt"], properties: { prompt: { type: "string" } } } as const;

const PROMPT_RULES: Record<CastKind, string> = {
  style:
    "a VISUAL STYLE MASTER for the whole series: one wide key-art frame of a typical place of the story, plus a strip of its colour palette swatches and a small note-free study of its rendering technique (lines, shading, texture, lighting). Style only: NO main characters, no faces, no readable text.",
  character:
    "a CHARACTER REFERENCE SHEET on a plain light background: the same character in full body front, three-quarter, side and back views, plus 3–4 facial expressions and close-ups of key costume details and props. Exact consistent proportions, face, hair, costume and colours in every view. No text labels.",
  place:
    "an ENVIRONMENT REFERENCE SHEET: one wide establishing view of the place plus 2–3 other angles (a closer view, a reverse angle, a detail of key props and materials), same time of day and lighting in all. No people unless the description needs them in the background. No text labels.",
};

/** سجاد writes the picture's English prompt from the Arabic description, the series' description and its look. */
async function writePrompt(series: FilmSeries, row: CastEntry) {
  const r = await callClaudeJson<{ prompt: string }>({
    system:
      "You write image prompts for OpenAI GPT Image 2 for an Arabic animated series. Write ONE detailed English prompt (180–320 words) for the requested sheet, faithful to the Arabic description and to the series' world and look. Describe concrete visual facts (shapes, colours, materials, clothing, age, build, era) — never names of real artists, studios or copyrighted characters. Return only the prompt.",
    turns: [
      {
        role: "user",
        content: [
          `What to draw: ${PROMPT_RULES[row.kind]}`,
          `Series: «${series.title}»`,
          series.style ? `The series' look (Arabic): ${series.style}` : "",
          series.bible ? `The series (Arabic, for context): ${series.bible.slice(0, 5000)}` : series.about ? `The series (Arabic): ${series.about}` : "",
          `${CAST_KINDS[row.kind]}: ${row.name}`,
          `Description (Arabic): ${row.description || "(no description: infer from the series)"}`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
    schema: PROMPT_SCHEMA,
    maxTokens: 2000,
    effort: "low",
  });
  return { prompt: r.data.prompt.trim().slice(0, 12000), usd: claudeCost(r.usage) };
}

/**
 * Draws (or redraws) an entry's picture in the background. The style comes first: a character or a place needs the
 * series' style picture (it is their style reference).
 */
export async function generateCast(series: FilmSeries, who: { id: string; email?: string | null }, castId: unknown) {
  const row = await oneCast(series, castId);
  if (row.status === "generating") throw new UserError("صورته تتولد الحين.", 409);
  const rows = await castOf(series.id);
  const style = rows.find((r) => r.kind === "style");
  if (row.kind !== "style" && style?.status !== "ready") throw new UserError("ولّد صورة «ستايل المسلسل» أول؛ هي مرجع الشكل لكل الشخصيات والبيئات.", 409);
  const charge = await reserveSeries(series, who, IMAGE_ESTIMATE_USD.sheet + PROMPT_USD, `صورة ${CAST_KINDS[row.kind]} «${row.name}»`, { attempt: true });
  await db().from("film_series_cast").update({ status: "generating", error: null }).eq("id", row.id);
  after(async () => {
    let usd = 0;
    try {
      let prompt = row.prompt;
      if (!prompt) {
        const w = await writePrompt(series, row);
        prompt = w.prompt;
        usd += w.usd;
        await db().from("film_series_cast").update({ prompt }).eq("id", row.id);
      }
      const refs: Buffer[] = [];
      if (row.kind !== "style" && style?.storage_path) {
        const f = await storage.from(FILM_BUCKET).download(style.storage_path);
        if (f.error) throw f.error;
        refs.push(Buffer.from(await f.data.arrayBuffer()));
        prompt += `\n\n${MASTER_STYLE_ONLY}`;
      }
      const img = await generateFilmImage({ prompt, references: refs, size: IMAGE_SIZES.sheet, quality: "high" });
      usd += img.costUsd ?? IMAGE_ESTIMATE_USD.sheet;
      const path = `${series.user_id}/series/${series.id}/cast/${row.id}-${Date.now()}.png`;
      const up = await storage.from(FILM_BUCKET).upload(path, img.png, { contentType: "image/png", upsert: true });
      if (up.error) throw up.error;
      await db().from("film_series_cast").update({ status: "ready", storage_path: path, error: null }).eq("id", row.id);
      if (row.storage_path) await storage.from(FILM_BUCKET).remove([row.storage_path]).catch(() => {});
      await settleSeries(charge, usd);
    } catch (e) {
      console.error("series cast picture failed", e);
      await db().from("film_series_cast").update({ status: "failed", error: String(e instanceof Error ? e.message : e).slice(0, 300) }).eq("id", row.id);
      await refundSeries(charge);
    }
  });
}
