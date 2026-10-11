// «مكتبة المؤثرات» of «حيدرة كت» — the server side: which of the ready sound effects (config/jawad/sfx-library.ts)
// are made, the owner making the missing ones (ElevenLabs, a few at a time), and putting chosen ones in a project.
// The files live once in the JAWAD bucket; a project only points at them (never copied, never deleted with it).

import { UserError } from "@/lib/api";
import { storage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { elevenSoundEffect } from "@/lib/jawad/server/providers/elevenlabs";
import { SFX_LIBRARY, SFX_LIBRARY_DIR, sfxById, sfxCostUsd, sfxPath } from "@config/jawad/sfx-library";

const BUCKET = "jawad";
const LINK_SECONDS = 3600;
/** How many are made in one request (side by side), so a request ends well inside its time. */
export const SFX_BATCH = 8;

/** The ids already made. */
async function made(): Promise<Set<string>> {
  const { data } = await storage.from(BUCKET).list(SFX_LIBRARY_DIR, { limit: 1000 });
  return new Set((data ?? []).map((f) => f.name.replace(/\.mp3$/, "")).filter((id) => sfxById(id)));
}

export interface SfxView {
  id: string;
  cat: string;
  name: string;
  seconds: number;
  loop: boolean;
  /** a short-lived link to listen to it (null until it is made) */
  url: string | null;
}

/** The library as a person sees it: every effect, with a link to the ones made. */
export async function sfxLibrary(): Promise<{ items: SfxView[]; ready: number; total: number; missingUsd: number }> {
  const ready = await made();
  const list = SFX_LIBRARY.filter((s) => ready.has(s.id));
  const links = new Map<string, string>();
  for (let i = 0; i < list.length; i += 100) {
    const part = list.slice(i, i + 100);
    const { data } = await storage.from(BUCKET).createSignedUrls(part.map((s) => sfxPath(s.id)), LINK_SECONDS);
    (data ?? []).forEach((d, j) => d.signedUrl && links.set(part[j].id, d.signedUrl));
  }
  return {
    items: SFX_LIBRARY.map((s) => ({ id: s.id, cat: s.cat, name: s.name, seconds: s.seconds, loop: Boolean(s.loop), url: links.get(s.id) ?? null })),
    ready: ready.size,
    total: SFX_LIBRARY.length,
    missingUsd: sfxCostUsd(SFX_LIBRARY.filter((s) => !ready.has(s.id))),
  };
}

/**
 * The owner makes the next missing effects (up to SFX_BATCH, side by side); `redo` makes given ones again. Returns
 * what was made, what failed (with why) and how many are left — the page asks again until none are.
 */
export async function makeSfx(o: { redo?: string[] } = {}) {
  if (!process.env.ELEVENLABS_API_KEY) throw new UserError("مفتاح ElevenLabs غير موجود في إعدادات الخادم (ELEVENLABS_API_KEY).", 503);
  const ready = await made();
  const redo = (o.redo ?? []).map((id) => sfxById(id)).filter((s): s is NonNullable<typeof s> => Boolean(s));
  const todo = (redo.length ? redo : SFX_LIBRARY.filter((s) => !ready.has(s.id))).slice(0, SFX_BATCH);
  const failed: { id: string; why: string }[] = [];
  const done: string[] = [];
  await Promise.all(
    todo.map(async (s) => {
      try {
        // the generator takes 0.5–30 s
        const audio = await elevenSoundEffect({ text: s.prompt, seconds: Math.min(30, Math.max(0.5, s.seconds)), loop: Boolean(s.loop), influence: 0.6 });
        const up = await storage.from(BUCKET).upload(sfxPath(s.id), audio, { contentType: "audio/mpeg", upsert: true, cacheControl: "31536000" });
        if (up.error) throw up.error;
        done.push(s.id);
      } catch (e) {
        failed.push({ id: s.id, why: (e instanceof Error ? e.message : String(e)).slice(0, 200) });
      }
    }),
  );
  const left = SFX_LIBRARY.length - (await made()).size;
  return { done, failed, left };
}

/** Chosen effects put in a project's library (they point at the shared files). */
export async function importSfx(p: { id: string; user_id: string }, b: { ids?: unknown }) {
  const ids = [...new Set((Array.isArray(b.ids) ? b.ids : []).filter((x): x is string => typeof x === "string"))].slice(0, 40);
  const ready = await made();
  const picks = ids.map((id) => sfxById(id)).filter((s): s is NonNullable<typeof s> => Boolean(s && ready.has(s.id)));
  if (!picks.length) throw new UserError("اختر مؤثرًا جاهزًا.", 400);
  const rows = picks.map((s) => ({
    project_id: p.id,
    user_id: p.user_id,
    kind: "audio",
    bucket: BUCKET,
    path: sfxPath(s.id),
    name: `🔊 ${s.name}`,
    mime: "audio/mpeg",
    duration_ms: Math.round(Math.max(0.5, s.seconds) * 1000),
    origin: "generated",
    status: "ready",
    meta: { hasAudio: true, made: "sfx", library: s.id },
  }));
  const { data, error } = await createAdminClient().from("editor_assets").insert(rows).select("id");
  if (error) throw new UserError("ما قدرنا نضيف المؤثرات؛ جرّب مرة ثانية.", 503);
  return (data ?? []).map((r) => r.id as string);
}
