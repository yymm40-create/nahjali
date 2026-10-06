// «حيدر كات» — what Claude (or a button) can make for the edit and drop on the timeline: a written hook as a
// picture (GPT Image 2, its background taken out), music (ElevenLabs), and a clip's sound split into its talking,
// music and sound effects. Every result is a new file in the project's library. Server only.

import { randomUUID } from "crypto";
import sharp from "sharp";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { openaiImage } from "@/lib/jawad/server/providers/openai";
import { elevenIsolateVoice, elevenMusic, elevenSoundEffect } from "@/lib/jawad/server/providers/elevenlabs";
import { falReady, samSeparate } from "@/lib/jawad/server/providers/fal";
import { ProviderError, providerUserId } from "@/lib/jawad/server/providers/common";
import { charged, type Who } from "./pricing";
import { assetViews, EDITOR_BUCKET, isUuid, stillOpen, type EditorProject } from "./server";

const db = () => createAdminClient();
const storage = () => createAdminClient().storage;

const providerError = (err: unknown): never => {
  if (err instanceof ProviderError) {
    console.error("editor generate", err.detail);
    throw new UserError(err.userMessage, 502);
  }
  throw err;
};

/** A made file stored with the project and listed in its library. */
async function addFile(p: EditorProject, o: { bytes: Buffer; mime: string; ext: string; kind: "image" | "audio"; name: string; durationMs?: number | null; width?: number | null; height?: number | null; meta?: Record<string, unknown> }) {
  const path = `${p.user_id}/${p.id}/gen/${randomUUID()}.${o.ext}`;
  const up = await storage().from(EDITOR_BUCKET).upload(path, o.bytes, { contentType: o.mime, upsert: false });
  if (up.error) throw new UserError("ما قدرنا نحفظ الملف؛ جرّب مرة ثانية.", 500);
  const { data, error } = await db()
    .from("editor_assets")
    .insert({
      project_id: p.id,
      user_id: p.user_id,
      kind: o.kind,
      bucket: EDITOR_BUCKET,
      path,
      name: o.name.slice(0, 200),
      mime: o.mime,
      bytes: o.bytes.length,
      duration_ms: o.durationMs ?? null,
      width: o.width ?? null,
      height: o.height ?? null,
      origin: "generated",
      status: "ready",
      meta: { hasAudio: o.kind === "audio", ...(o.meta ?? {}) },
    })
    .select("id")
    .single();
  if (error || !data) throw new UserError("ما قدرنا نضيف الملف للمكتبة.", 500);
  return (await assetViews(p.id)).find((a) => a.id === data.id)!;
}

// ───────── a written hook, as a picture ─────────

/**
 * Takes a flat pure-green background out of a picture (the hook is drawn on #00FF00), softly at the edges and with
 * the green spill removed from the letters, then crops it to what is left.
 */
export async function keyOutGreen(png: Buffer) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const green = g - Math.max(r, b);
    if (green > 90) data[i + 3] = 0;
    else if (green > 30) {
      data[i + 3] = Math.round((255 * (90 - green)) / 60);
      data[i + 1] = Math.max(r, b);
    } else if (green > 0) data[i + 1] = Math.max(r, b) + Math.round(green / 3);
  }
  const keyed = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png();
  const out = await keyed.toBuffer();
  // cropped to the letters (with a small margin)
  const trimmed = await sharp(out).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 10 }).extend({ top: 12, bottom: 12, left: 12, right: 12, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer({ resolveWithObject: true }).catch(() => null);
  return trimmed ? { bytes: trimmed.data, width: trimmed.info.width, height: trimmed.info.height } : { bytes: out, width: info.width, height: info.height };
}

export async function makeHook(p: EditorProject, who: Who, b: { text?: unknown; style?: unknown; prompt?: unknown; background?: unknown; aspect?: unknown }) {
  stillOpen(p);
  const text = String(b.text ?? "").trim().slice(0, 80);
  if (!text) throw new UserError("اكتب نص الهوك.", 400);
  if (!process.env.OPENAI_API_KEY) throw new UserError("صناعة الصور غير مفعّلة على الخادم.", 503);
  // «نص الهوك»: the designed prompt (Claude's); a cut-out one is drawn on flat green and keyed, a card is kept whole
  if (typeof b.prompt === "string" && b.prompt.trim()) {
    const scene = b.background === "scene";
    const aspect = ["1:1", "3:2", "2:3", "16:9", "9:16"].includes(String(b.aspect)) ? String(b.aspect) : "1:1";
    const designed = [
      b.prompt.trim().slice(0, 3800),
      scene ? "" : "Background: one flat solid pure green colour (#00FF00) filling the whole image around the lettering and its element, perfectly even, no gradient, no texture, no shadow cast on the background, and no green anywhere in the lettering or the element.",
    ].filter(Boolean).join("\n");
    const out = await charged(who, "editor_price_hook", 1, "نص الهوك بالصورة في حيدر كات", () =>
      openaiImage({ model: "gpt-image-2-2026-04-21", prompt: designed, aspect, resolution: "std", quality: "high", count: 1, references: [], user: providerUserId(p.user_id) }).catch(providerError),
    );
    const png = scene ? await sharp(out.images[0]).png().toBuffer({ resolveWithObject: true }).then((r) => ({ bytes: r.data, width: r.info.width, height: r.info.height })) : await keyOutGreen(out.images[0]);
    return addFile(p, { bytes: png.bytes, mime: "image/png", ext: "png", kind: "image", name: `هوك: ${text}`, width: png.width, height: png.height, meta: { made: "hook", text, designed: true } });
  }
  const style = String(b.style ?? "").trim().slice(0, 300) || "bold modern 3D lettering, white letters with a strong yellow highlight on the key word, thick dark outline, a subtle drop shadow on the letters only";
  const prompt = [
    `A title card for a short video: the Arabic text «${text}» written exactly as given, correctly joined Arabic letters, right to left, nothing else written.`,
    `Style: ${style}. Big, punchy, eye-catching, centred, fills most of the width.`,
    "Background: one flat solid pure green colour (#00FF00) filling the whole image, perfectly even, no gradient, no texture, no shadow or glow on the background, and no green anywhere in the lettering.",
  ].join("\n");
  const img = await charged(who, "editor_price_hook", 1, "هوك بالصورة في حيدر كات", () =>
    openaiImage({ model: "gpt-image-2-2026-04-21", prompt, aspect: "3:2", resolution: "std", quality: "medium", count: 1, references: [], user: providerUserId(p.user_id) }).catch(providerError),
  );
  const cut = await keyOutGreen(img.images[0]);
  return addFile(p, { bytes: cut.bytes, mime: "image/png", ext: "png", kind: "image", name: `هوك: ${text}`, width: cut.width, height: cut.height, meta: { made: "hook", text } });
}

// ───────── music ─────────

export async function makeMusic(p: EditorProject, who: Who, b: { prompt?: unknown; lengthMs?: unknown }) {
  stillOpen(p);
  const prompt = String(b.prompt ?? "").trim().slice(0, 1000);
  if (!prompt) throw new UserError("وصف الموسيقى اللي تبيها.", 400);
  if (!process.env.ELEVENLABS_API_KEY) throw new UserError("صناعة الموسيقى غير مفعّلة على الخادم.", 503);
  const lengthMs = Math.round(Math.min(300_000, Math.max(10_000, Number(b.lengthMs) || 30_000)));
  const music = await charged(who, "editor_price_music", Math.ceil(lengthMs / 60_000), "موسيقى في حيدر كات", () =>
    elevenMusic({ prompt, lengthMs, instrumental: true, model: "music_v2_5" }).catch(providerError),
  );
  return addFile(p, { bytes: music.audio, mime: "audio/mpeg", ext: "mp3", kind: "audio", name: `موسيقى: ${prompt.slice(0, 40)}`, durationMs: lengthMs, meta: { made: "music" } });
}

// ───────── a sound effect («نص الهوك»: its entrance and exit) ─────────

export async function makeSfx(p: EditorProject, who: Who, b: { prompt?: unknown; seconds?: unknown; name?: unknown }) {
  stillOpen(p);
  const prompt = String(b.prompt ?? "").trim().slice(0, 450);
  if (!prompt) throw new UserError("وصف المؤثر الصوتي.", 400);
  if (!process.env.ELEVENLABS_API_KEY) throw new UserError("صناعة المؤثرات غير مفعّلة على الخادم.", 503);
  const seconds = Math.min(5, Math.max(0.5, Math.round((Number(b.seconds) || 1) * 10) / 10));
  const audio = await charged(who, "editor_price_sfx", 1, "مؤثر صوتي في حيدر كات", () =>
    elevenSoundEffect({ text: prompt, seconds, loop: false, influence: 0.6 }).catch(providerError),
  );
  return addFile(p, { bytes: audio, mime: "audio/mpeg", ext: "mp3", kind: "audio", name: String(b.name ?? `مؤثر: ${prompt.slice(0, 30)}`).slice(0, 80), durationMs: Math.round(seconds * 1000), meta: { made: "sfx" } });
}

// ───────── talking, music and effects apart ─────────

/**
 * A clip's sound (uploaded by the page as WAV to the project's temporary folder) split into its talking (ElevenLabs
 * voice isolation) and, when fal is set up, its music and its sound effects (SAM-Audio). Each part is a new file of
 * the same length.
 */
export async function separate(p: EditorProject, who: Who, b: { path?: unknown; from?: unknown; to?: unknown; name?: unknown }) {
  stillOpen(p);
  const prefix = `${p.user_id}/${p.id}/tmp/`;
  const path = b.path;
  if (typeof path !== "string" || !path.startsWith(prefix) || path.includes("..") || !isUuid(path.slice(prefix.length).replace(/\.(wav|webm)$/, ""))) throw new UserError("ملف صوت غير صحيح.", 400);
  const durationMs = Math.round(Math.max(0, Number(b.to) - Number(b.from)));
  if (!durationMs || durationMs > 10 * 60_000) throw new UserError("الفصل لمقاطع لين ١٠ دقايق؛ قصّ المقطع أول.", 400);
  if (!process.env.ELEVENLABS_API_KEY) throw new UserError("فصل الأصوات غير مفعّل على الخادم.", 503);
  const name = String(b.name ?? "المقطع").slice(0, 60);
  try {
    const dl = await storage().from(EDITOR_BUCKET).download(path);
    if (dl.error || !dl.data) throw new UserError("ما وصل الصوت؛ جرّب مرة ثانية.", 409);
    const file = Buffer.from(await dl.data.arrayBuffer());
    const mime = path.endsWith(".wav") ? "audio/wav" : "audio/webm";
    const link = (await storage().from(EDITOR_BUCKET).createSignedUrl(path, 3600)).data?.signedUrl ?? null;
    return await charged(who, "editor_price_stems", Math.ceil(durationMs / 60_000), "فصل الأصوات في حيدر كات", async () => {
      const voice = await elevenIsolateVoice({ file, mime, name: path.split("/").pop()! }).catch(providerError);
      const made = [await addFile(p, { bytes: voice, mime: "audio/mpeg", ext: "mp3", kind: "audio", name: `الكلام · ${name}`, durationMs, meta: { made: "stem", stem: "voice" } })];
      if (falReady() && link) {
        const music = await samSeparate(link, "music").catch(providerError);
        const effects = await samSeparate(music.residualUrl, "speech").catch(providerError);
        const ext = (m: string) => (m.includes("mpeg") ? "mp3" : m.includes("ogg") ? "ogg" : "wav");
        made.push(await addFile(p, { bytes: music.target.bytes, mime: music.target.mime, ext: ext(music.target.mime), kind: "audio", name: `الموسيقى · ${name}`, durationMs, meta: { made: "stem", stem: "music" } }));
        made.push(await addFile(p, { bytes: effects.residual.bytes, mime: effects.residual.mime, ext: ext(effects.residual.mime), kind: "audio", name: `المؤثرات · ${name}`, durationMs, meta: { made: "stem", stem: "effects" } }));
      }
      return { assets: made, full: made.length === 3 };
    });
  } finally {
    await storage().from(EDITOR_BUCKET).remove([path]);
  }
}
