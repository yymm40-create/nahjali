// «صانع المحتوى» — the pictures of the carousel templates shown in the gallery: one sample cover per template, drawn
// once by GPT Image 2 (the owner presses a button in /admin/content), checked like any slide, and kept in the public
// bucket — so the same picture is shown to everyone, in every conversation. Until a template has its picture the
// gallery shows its palette instead. Server only.

import { UserError } from "@/lib/api";
import { openaiImage } from "@/lib/jawad/server/providers/openai";
import { ProviderError, providerUserId } from "@/lib/jawad/server/providers/common";
import { JAWAD_PUBLIC_BUCKET, publicUrl } from "@/lib/jawad/server/runtime";
import { storage } from "@/lib/storage";
import { gptImage2OutputTokens } from "@config/jawad/generators";
import { CAROUSEL_TEMPLATES, findTemplate, THUMB_TEXT, thumbPrompt } from "@config/content-templates";
import { checkSlide, fixNote } from "./verify";

export const TEMPLATE_DIR = "content-templates";
const MODEL = "gpt-image-2-2026-04-21";
const QUALITY = "medium" as const;
const path = (id: string) => `${TEMPLATE_DIR}/${id}.png`;

/** About what drawing every template's picture costs once (a 1024×1024 picture at medium quality, plus the check), in dollars. */
export const TEMPLATE_PICTURE_USD = (gptImage2OutputTokens(1024, 1024, QUALITY) * 30) / 1e6 + 0.01;

/** The templates that already have a picture, with its address (the time it was made in the address, so a new one shows). */
export async function templateImages(): Promise<Record<string, string>> {
  const { data } = await storage.from(JAWAD_PUBLIC_BUCKET).list(TEMPLATE_DIR, { limit: 200 });
  const out: Record<string, string> = {};
  for (const f of data ?? []) {
    const id = f.name.replace(/\.png$/, "");
    if (f.name.endsWith(".png") && findTemplate(id)) out[id] = `${publicUrl(path(id))}?v=${new Date(f.updated_at ?? 0).getTime() || 1}`;
  }
  return out;
}

/** Draws and keeps the picture of one template (once more if the check finds a mistake in the Arabic). */
export async function makeTemplateImage(id: string): Promise<{ id: string; usd: number; flag: string | null }> {
  const t = findTemplate(id);
  if (!t) throw new UserError("قالب غير معروف.", 400);
  if (!process.env.OPENAI_API_KEY) throw new UserError("صناعة الصور غير مفعّلة على الخادم.", 503);
  const user = providerUserId("content-templates");
  let usd = 0;
  let fix = "";
  let best: { png: Buffer; problems: string[] } | null = null;
  const t0 = Date.now();
  for (let attempt = 1; attempt <= 2; attempt++) {
    // the call has 300 s: a second try only starts early enough to finish (the picture and its check)
    if (attempt > 1 && Date.now() - t0 > 90_000) break;
    let png: Buffer;
    try {
      const r = await openaiImage({ model: MODEL, prompt: `${thumbPrompt(t)}${fix ? `\n\n${fix}` : ""}`, aspect: "1:1", resolution: "std", quality: QUALITY, count: 1, references: [], user, timeoutMs: 110_000 });
      usd += r.costUsd ?? 0;
      png = r.images[0];
    } catch (e) {
      if (best) break;
      throw new UserError(e instanceof ProviderError ? e.userMessage : "تعذّر رسم صورة القالب.", 502);
    }
    const check = await checkSlide(png, THUMB_TEXT);
    usd += check.usd;
    best = { png, problems: check.ok ? [] : check.problems };
    if (check.ok) break;
    fix = fixNote(check, THUMB_TEXT);
  }
  const up = await storage.from(JAWAD_PUBLIC_BUCKET).upload(path(id), best!.png, { contentType: "image/png", upsert: true, cacheControl: "public, max-age=86400" });
  if (up.error) throw new UserError("ما قدرنا نحفظ صورة القالب.", 500);
  return { id, usd: Math.round(usd * 10000) / 10000, flag: best!.problems.length ? best!.problems.join("، ") : null };
}

/** For the admin page: every template, whether its picture exists. */
export async function templateImageStatus() {
  const have = await templateImages();
  return CAROUSEL_TEMPLATES.map((t) => ({ id: t.id, name: t.name, group: t.group, image: have[t.id] ?? null }));
}
