// «الجواد الذكي!» | JAWAD AI — the voice library (ElevenLabs). Server only.
//
//   design ─► coins held (the owner's «تصميم صوت» price) → three spoken previews (eleven_ttv_v3, optionally leaning
//             on a reference recording: «يستوحي» or «يتعلّم») → saved privately; a failure gives the coins back.
//   save   ─► the chosen preview becomes a voice in the site's ElevenLabs account and a row in the person's library.
//   clone  ─► «يستخدمه نفسه»: a voice copied from a recording the person has the right to (they confirm it).
//   delete ─► removed from ElevenLabs (frees the slot) and from the library.
// Eleven v4 speech and the film maker take a voice as «p:<id>» (ElevenLabs' ready voices) or «v:<uuid>» (the library).

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { holdCoins, releaseCoins } from "@/lib/coins";
import { generatorById, MINIMAX_CLONE_KEY, MINIMAX_DESIGN_KEY, VOICE_CLONE_KEY, VOICE_DESIGN_KEY } from "@config/jawad/generators";
import { MINIMAX_READY_VOICES, minimaxCloneVoice, minimaxDesignVoice, minimaxReady } from "./providers/minimax";
import { JAWAD_VOICE_LIMIT } from "@config/jawad/brand";
import { probe, sniff } from "../media";
import { JAWAD_BUCKET, loadRuntime } from "./runtime";
import { isUuid, refsFor } from "./uploads";
import { ProviderError } from "./providers/common";
import { elevenCloneVoice, elevenDeleteVoice, elevenDesignVoice, elevenPremadeVoices, elevenSaveDesigned } from "./providers/elevenlabs";

import { libraryAccess, libraryOpenFor, requireLibrary } from "./library-access";
import { storage } from "@/lib/storage";
const db = () => createAdminClient();
/** ElevenLabs' long-standing default voices, shown when the key may not read the voice list. */
const FALLBACK_VOICES = [
  ["JBFqnCBsd6RMkjVDRZzb", "George", "male"],
  ["21m00Tcm4TlvDq8ikWAM", "Rachel", "female"],
  ["EXAVITQu4vr4xnSDxMaL", "Sarah", "female"],
  ["nPczCjzI2devNBz1zQrb", "Brian", "male"],
  ["onwK4e9ZLuTAKqWW03F9", "Daniel", "male"],
  ["XrExE9yKIg1WjnnlVkGX", "Matilda", "female"],
].map(([voiceId, name, gender]) => ({ voiceId, name, category: "premade", labels: { gender } as Record<string, string>, previewUrl: null as string | null }));
const V4 = "elevenlabs-eleven-v4";
const MINIMAX_ID = "minimax-speech-2-8";
const LABEL = "JAWAD AI · مكتبة الأصوات";
/** How a reference recording shapes a designed voice: prompt_strength near 0 follows the recording, near 1 the words. */
const REF_STRENGTH = { inspire: 0.7, learn: 0.25 } as const;

export type VoiceProvider = "elevenlabs" | "minimax";

export interface VoiceView {
  id: string;
  value: string;
  name: string;
  description: string;
  origin: "design" | "clone" | "ready";
  previewUrl: string | null;
  labels?: Record<string, string>;
  /** where the voice lives (speech must go to the same provider) */
  provider: VoiceProvider;
}

interface VoiceRow {
  id: string;
  user_id: string;
  provider: VoiceProvider;
  provider_voice_id: string;
  name: string;
  description: string;
  origin: "design" | "clone";
  preview_path: string | null;
  created_at: string;
}

const missing = (e: { code?: string; message?: string } | null) => Boolean(e && (e.code === "42P01" || e.code === "PGRST205" || /jawad_voice/.test(e.message ?? "")));
const notReady = () => new UserError("مكتبة الأصوات قيد التجهيز (ملف قاعدة البيانات 0023).", 503);

/** The generator's gate (live for everyone, or the owner trying it with the key set) and its price table. */
async function gate(owner: boolean) {
  const rt = await loadRuntime();
  const g = rt.generators.find((x) => x.id === V4);
  if (!g || !(g.live || (owner && g.keyConfigured && rt.migrated))) throw new UserError("أصوات ElevenLabs غير متاحة حاليًا.", 403);
  return rt.prices[V4] ?? {};
}

async function signed(paths: (string | null)[]) {
  const list = paths.filter((p): p is string => Boolean(p));
  if (!list.length) return new Map<string, string>();
  const { data } = await storage.from(JAWAD_BUCKET).createSignedUrls(list, 3600);
  return new Map((data ?? []).flatMap((x) => (x.path && x.signedUrl ? [[x.path, x.signedUrl] as const] : [])));
}

/** The person's own voices, then ElevenLabs' ready voices (when the key works). */
export async function listVoices(userId: string, owner: boolean): Promise<{ mine: VoiceView[]; ready: VoiceView[]; minimax: VoiceView[]; readyError: string | null; limit: number; migrated: boolean; library: { active: boolean; migrated: boolean }; providers: Record<VoiceProvider, boolean> }> {
  await gate(owner);
  const lib = await libraryAccess(userId, owner);
  const { data, error } = await db().from("jawad_voices").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  const rows = (data ?? []) as VoiceRow[];
  const links = await signed(rows.map((r) => r.preview_path));
  const mine = rows.map((r) => ({ id: r.id, value: `v:${r.id}`, name: r.name, description: r.description, origin: r.origin, previewUrl: r.preview_path ? links.get(r.preview_path) ?? null : null, provider: (r.provider ?? "elevenlabs") as VoiceProvider }));
  let ready: VoiceView[] = [];
  let readyError: string | null = null;
  try {
    const list = await elevenPremadeVoices().catch(() => [] as Awaited<ReturnType<typeof elevenPremadeVoices>>);
    ready = (list.length ? list : FALLBACK_VOICES).map((v) => ({ id: v.voiceId, value: `p:${v.voiceId}`, name: v.name, description: [v.labels.gender, v.labels.accent, v.labels.age, v.labels.descriptive ?? v.labels.description].filter(Boolean).join(" · "), origin: "ready" as const, previewUrl: v.previewUrl, labels: v.labels, provider: "elevenlabs" as const }));
  } catch (e) {
    readyError = e instanceof ProviderError ? e.userMessage : "تعذّر جلب أصوات ElevenLabs الجاهزة.";
  }
  // MiniMax's ready voices (a fixed list; no key needed to list them)
  const minimax: VoiceView[] = minimaxReady() ? MINIMAX_READY_VOICES.map((v) => ({ id: v.id, value: `x:${v.id}`, name: v.name, description: v.gender === "male" ? "رجل" : "امرأة", origin: "ready" as const, previewUrl: null, provider: "minimax" as const })) : [];
  return { mine, ready, minimax, readyError, limit: JAWAD_VOICE_LIMIT, migrated: !missing(error), library: { active: lib.active, migrated: lib.migrated }, providers: { elevenlabs: true, minimax: minimaxReady() } };
}

/** The ElevenLabs voice id behind a request's voice, checked: one of the ready voices, or one of the person's own. */
export async function resolveVoice(userId: string, value: string): Promise<{ ok: true; voiceId: string; provider: VoiceProvider } | { ok: false; reason: string }> {
  if (value.startsWith("v:")) {
    const id = value.slice(2);
    if (!isUuid(id)) return { ok: false, reason: "الصوت غير صحيح." };
    const { data, error } = await db().from("jawad_voices").select("provider,provider_voice_id").eq("id", id).eq("user_id", userId).maybeSingle();
    if (missing(error)) return { ok: false, reason: "مكتبة الأصوات قيد التجهيز." };
    // A saved voice is part of «المكتبة»: used while the add-on runs (the owner always)
    if (data && !(await libraryOpenFor(userId))) return { ok: false, reason: "صوتك محفوظ في «المكتبة»، وهي مقفلة الآن. فعّل اشتراك المكتبة لتستخدمه، أو اختر صوتًا جاهزًا." };
    return data ? { ok: true, voiceId: data.provider_voice_id as string, provider: ((data.provider as VoiceProvider | null) ?? "elevenlabs") } : { ok: false, reason: "هذا الصوت لم يعد في مكتبتك. اختر صوتًا آخر." };
  }
  if (value.startsWith("x:")) {
    // one of MiniMax's ready voices
    const id = value.slice(2);
    if (!MINIMAX_READY_VOICES.some((v) => v.id === id)) return { ok: false, reason: "هذا الصوت غير متاح. اختر صوتًا آخر." };
    return { ok: true, voiceId: id, provider: "minimax" };
  }
  if (value.startsWith("p:")) {
    // A ready voice: sent as is (a key without permission to read the voice list must not block speech);
    // an unknown id is refused by ElevenLabs and the coins come back
    const id = value.slice(2);
    if (!/^[A-Za-z0-9]{16,32}$/.test(id)) return { ok: false, reason: "الصوت غير صحيح." };
    const list = await elevenPremadeVoices().catch(() => null);
    if (list && list.length && !list.some((v) => v.voiceId === id) && !FALLBACK_VOICES.some((v) => v.voiceId === id)) return { ok: false, reason: "هذا الصوت غير متاح. اختر صوتًا آخر." };
    return { ok: true, voiceId: id, provider: "elevenlabs" };
  }
  return { ok: false, reason: "اختر صوتًا." };
}

async function countVoices(userId: string) {
  const { count, error } = await db().from("jawad_voices").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (missing(error)) throw notReady();
  return count ?? 0;
}

/** A reference recording of the person's (an audio upload that passed the server's check). */
async function recording(userId: string, uploadId: unknown, maxMs: number) {
  if (!isUuid(uploadId)) throw new UserError("الملف الصوتي غير صحيح.", 400);
  const { rows } = await refsFor(userId, [{ uploadId, role: "reference" }]);
  const r = rows[0];
  if (r.kind !== "audio" || r.status !== "ready") throw new UserError("اختر تسجيلًا صوتيًا (MP3 أو WAV) اكتمل رفعه.", 400);
  if ((r.duration_ms ?? 0) > maxMs) throw new UserError(`التسجيل أطول من ${Math.round(maxMs / 1000)} ثانية؛ قصّه ثم ارفعه.`, 400);
  if ((r.duration_ms ?? 0) < 3000) throw new UserError("التسجيل قصير جدًا؛ ارفع ٣ ثوانٍ على الأقل.", 400);
  const { data, error } = await storage.from(JAWAD_BUCKET).download(r.storage_path);
  if (error || !data) throw new UserError("تعذّر قراءة التسجيل.", 500);
  return { bytes: Buffer.from(await data.arrayBuffer()), mime: r.mime ?? "audio/mpeg", ms: r.duration_ms ?? 0 };
}

const cleanName = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 40) : "");

export interface DraftView {
  id: string;
  status: string;
  previews: { index: number; url: string | null; durationSec: number | null }[];
  coins: number;
}

/** Three previews of a voice described in words (and, if given, leaning on a reference recording). */
export async function designVoice(user: { id: string }, owner: boolean, b: { key?: unknown; description?: unknown; text?: unknown; referenceId?: unknown; referenceUse?: unknown }): Promise<DraftView> {
  const prices = await gate(owner);
  await requireLibrary(user.id, owner);
  const key = String(b.key ?? "");
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(key)) throw new UserError("طلب غير صحيح.", 400);
  const description = typeof b.description === "string" ? b.description.trim() : "";
  if (description.length < 20 || description.length > 1000) throw new UserError("صف الصوت في ٢٠ إلى ١٠٠٠ حرف (الجنس، العمر، اللهجة، النبرة، الإيقاع…).", 400);
  const text = typeof b.text === "string" ? b.text.trim() : "";
  if (text && (text.length < 100 || text.length > 1000)) throw new UserError("نص العينة من ١٠٠ إلى ١٠٠٠ حرف، أو اتركه فارغًا ليكتبه المولد.", 400);
  const use = b.referenceUse === "learn" ? "learn" : "inspire";

  const old = await db().from("jawad_voice_drafts").select("*").eq("user_id", user.id).eq("idempotency_key", key).maybeSingle();
  if (missing(old.error)) throw notReady();
  if (old.data) return draftView(old.data);

  const coins = owner ? 0 : prices[VOICE_DESIGN_KEY] == null ? null : Math.ceil(prices[VOICE_DESIGN_KEY]! / 100 - 1e-9);
  if (coins === null) throw new UserError("سعر تصميم الأصوات لم يُحدد بعد.", 400);
  const reference = b.referenceId ? await recording(user.id, b.referenceId, 60_000) : null;

  const ins = await db().from("jawad_voice_drafts").insert({ user_id: user.id, idempotency_key: key, description, price_coins: coins }).select("*").single();
  if (ins.error) {
    if (ins.error.code === "23505") return draftView((await db().from("jawad_voice_drafts").select("*").eq("user_id", user.id).eq("idempotency_key", key).single()).data);
    throw ins.error;
  }
  const draft = ins.data as { id: string };
  const ref = `voice-design:${draft.id}`;
  try {
    await holdCoins(user.id, coins, ref, LABEL);
  } catch (e) {
    await db().from("jawad_voice_drafts").delete().eq("id", draft.id);
    throw e;
  }
  try {
    const res = await elevenDesignVoice({ description, text: text || undefined, reference: reference?.bytes, promptStrength: reference ? REF_STRENGTH[use] : undefined });
    const previews = [];
    for (const [i, p] of res.previews.entries()) {
      const path = `${user.id}/voice-drafts/${draft.id}/${i}.mp3`;
      const up = await storage.from(JAWAD_BUCKET).upload(path, p.audio, { contentType: "audio/mpeg", upsert: true });
      if (up.error) throw new Error(`storage: ${up.error.message}`);
      previews.push({ generatedVoiceId: p.generatedVoiceId, path, durationSec: p.durationSec });
    }
    const { data } = await db().from("jawad_voice_drafts").update({ status: "ready", previews }).eq("id", draft.id).select("*").single();
    return draftView(data);
  } catch (e) {
    await releaseCoins(user.id, coins, ref, LABEL);
    const msg = e instanceof ProviderError ? e.userMessage : "تعذّر تصميم الصوت الآن. أُعيدت لك نقودك.";
    await db().from("jawad_voice_drafts").update({ status: "failed", error: (e instanceof ProviderError ? e.detail : String(e)).slice(0, 900) }).eq("id", draft.id);
    console.error("jawad voice design failed", draft.id, e);
    throw new UserError(msg, 502);
  }
}

async function draftView(row: { id: string; status: string; previews: { path: string; durationSec: number | null }[]; price_coins: number } | null): Promise<DraftView> {
  if (!row) throw new UserError("ما لقينا هذا التصميم.", 404);
  const links = await signed(row.previews.map((p) => p.path));
  return { id: row.id, status: row.status, coins: row.price_coins, previews: row.previews.map((p, index) => ({ index, url: links.get(p.path) ?? null, durationSec: p.durationSec })) };
}

/** Keeps one preview of a design as a voice in the person's library. */
export async function saveDesigned(user: { id: string }, owner: boolean, b: { draftId?: unknown; index?: unknown; name?: unknown }): Promise<VoiceView> {
  await gate(owner);
  await requireLibrary(user.id, owner);
  if (!isUuid(b.draftId)) throw new UserError("طلب غير صحيح.", 400);
  const name = cleanName(b.name);
  if (!name) throw new UserError("سمِّ الصوت.", 400);
  const { data: d } = await db().from("jawad_voice_drafts").select("*").eq("id", b.draftId).eq("user_id", user.id).maybeSingle();
  if (!d || d.status !== "ready") throw new UserError("هذا التصميم غير متاح؛ صمّم الصوت من جديد.", 404);
  const p = (d.previews as { generatedVoiceId: string; path: string }[])[Number(b.index)];
  if (!p) throw new UserError("اختر إحدى العينات.", 400);
  if (!owner && (await countVoices(user.id)) >= JAWAD_VOICE_LIMIT) throw new UserError(`مكتبتك فيها ${JAWAD_VOICE_LIMIT} أصوات (الحد). احذف صوتًا لتضيف غيره.`, 409);

  let voiceId: string;
  try {
    voiceId = await elevenSaveDesigned({ generatedVoiceId: p.generatedVoiceId, name: `${name} · JAWAD`, description: d.description });
  } catch (e) {
    throw new UserError(e instanceof ProviderError ? e.userMessage : "تعذّر حفظ الصوت الآن.", 502);
  }
  const row = await insertVoice(user.id, { voiceId, name, description: d.description, origin: "design", sample: p.path, coins: d.price_coins });
  await db().from("jawad_voice_drafts").update({ status: "used" }).eq("id", d.id);
  return row;
}

/** «يستخدمه نفسه»: a voice copied from a recording the person has the right to use. */
export async function cloneVoice(user: { id: string }, owner: boolean, b: { key?: unknown; uploadId?: unknown; name?: unknown; consent?: unknown; removeNoise?: unknown; provider?: unknown }): Promise<VoiceView> {
  if (b.provider === "minimax") return cloneMinimax(user, owner, b);
  const prices = await gate(owner);
  await requireLibrary(user.id, owner);
  const key = String(b.key ?? "");
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(key)) throw new UserError("طلب غير صحيح.", 400);
  if (b.consent !== true) throw new UserError("أكّد أن الصوت صوتك أو أن لديك إذن صاحبه.", 400);
  const name = cleanName(b.name);
  if (!name) throw new UserError("سمِّ الصوت.", 400);
  if (!owner && (await countVoices(user.id)) >= JAWAD_VOICE_LIMIT) throw new UserError(`مكتبتك فيها ${JAWAD_VOICE_LIMIT} أصوات (الحد). احذف صوتًا لتضيف غيره.`, 409);
  const coins = owner ? 0 : prices[VOICE_CLONE_KEY] == null ? null : Math.ceil(prices[VOICE_CLONE_KEY]! / 100 - 1e-9);
  if (coins === null) throw new UserError("سعر نسخ الأصوات لم يُحدد بعد.", 400);
  const rec = await recording(user.id, b.uploadId, 180_000);
  const ref = `voice-clone:${user.id}:${key}`;
  // A repeat of the same click: nothing new
  const seen = await db().from("smart_coin_ledger").select("id").eq("ref", ref).limit(1);
  if (seen.data?.length) throw new UserError("هذا الطلب نُفّذ من قبل.", 409);
  await holdCoins(user.id, coins, ref, LABEL);
  try {
    const voiceId = await elevenCloneVoice({ name: `${name} · JAWAD`, description: "Instant voice clone from the user's own recording (consent confirmed).", file: rec.bytes, mime: rec.mime, removeNoise: b.removeNoise === true });
    // The first 15 seconds or so of the recording are the sample to listen to
    const path = `${user.id}/voices/clone-${Date.now()}.${rec.mime === "audio/wav" ? "wav" : "mp3"}`;
    await storage.from(JAWAD_BUCKET).upload(path, rec.bytes, { contentType: rec.mime, upsert: true });
    return await insertVoice(user.id, { voiceId, name, description: "", origin: "clone", sample: path, coins, copy: false });
  } catch (e) {
    await releaseCoins(user.id, coins, ref, LABEL);
    if (e instanceof UserError) throw e;
    throw new UserError(e instanceof ProviderError ? e.userMessage : "تعذّر نسخ الصوت الآن. أُعيدت لك نقودك.", 502);
  }
}

async function insertVoice(userId: string, v: { voiceId: string; name: string; description: string; origin: "design" | "clone"; sample: string; coins: number; copy?: boolean; provider?: VoiceProvider }): Promise<VoiceView> {
  const provider: VoiceProvider = v.provider ?? "elevenlabs";
  let preview: string | null = v.sample || null;
  if (v.copy !== false) {
    // The kept sample, apart from the draft (drafts can be cleared)
    preview = `${userId}/voices/${v.voiceId}.mp3`;
    await storage.from(JAWAD_BUCKET).copy(v.sample, preview).catch(() => null);
  }
  const { data, error } = await db()
    .from("jawad_voices")
    .insert({ user_id: userId, provider, provider_voice_id: v.voiceId, name: v.name, description: v.description, origin: v.origin, preview_path: preview, price_coins: v.coins })
    .select("*")
    .single();
  if (error) {
    if (provider === "elevenlabs") await elevenDeleteVoice(v.voiceId).catch(() => null);
    if (missing(error)) throw notReady();
    throw error;
  }
  const r = data as VoiceRow;
  const links = await signed([r.preview_path]);
  return { id: r.id, value: `v:${r.id}`, name: r.name, description: r.description, origin: r.origin, previewUrl: r.preview_path ? links.get(r.preview_path) ?? null : null, provider };
}

/**
 * «صمّم بالوصف» at MiniMax: one voice from the description, kept at once in the person's library (no slot limit),
 * with its spoken sample. If they don't like it they design another (and may delete this one).
 */
export async function designMinimax(user: { id: string }, owner: boolean, b: { key?: unknown; description?: unknown; text?: unknown; name?: unknown }): Promise<VoiceView> {
  if (!minimaxReady()) throw new UserError("MiniMax غير مفعّل على الخادم (FAL_KEY).", 503);
  await requireLibrary(user.id, owner);
  const key = String(b.key ?? "");
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(key)) throw new UserError("طلب غير صحيح.", 400);
  const description = typeof b.description === "string" ? b.description.trim() : "";
  if (description.length < 20 || description.length > 1000) throw new UserError("صف الصوت في ٢٠ إلى ١٠٠٠ حرف (الجنس، العمر، اللهجة، النبرة، الإيقاع…).", 400);
  const name = cleanName(b.name) || "صوت مصمّم";
  const sample = (typeof b.text === "string" && b.text.trim() ? b.text.trim() : "مرحبًا، هذا صوتي الجديد. أتمنى أن يعجبك، وبإمكانك الآن استخدامه في أي نص تريده.").slice(0, 500);
  const rt = await loadRuntime();
  const table = rt.prices[MINIMAX_ID] ?? {};
  const coins = owner ? 0 : table[MINIMAX_DESIGN_KEY] == null ? null : Math.ceil(table[MINIMAX_DESIGN_KEY]! / 100 - 1e-9);
  if (coins === null) throw new UserError("سعر تصميم الأصوات (MiniMax) لم يُحدد بعد.", 400);
  const ref = `voice-design-mm:${user.id}:${key}`;
  const seen = await db().from("smart_coin_ledger").select("id").eq("ref", ref).limit(1);
  if (seen.data?.length) throw new UserError("هذا الطلب نُفّذ من قبل.", 409);
  await holdCoins(user.id, coins, ref, LABEL);
  try {
    const made = await minimaxDesignVoice({ prompt: description, previewText: sample });
    const path = `${user.id}/voices/mm-design-${Date.now()}.mp3`;
    if (made.preview) await storage.from(JAWAD_BUCKET).upload(path, made.preview, { contentType: "audio/mpeg", upsert: true });
    return await insertVoice(user.id, { voiceId: made.voiceId, name, description, origin: "design", sample: made.preview ? path : "", coins, copy: false, provider: "minimax" });
  } catch (e) {
    await releaseCoins(user.id, coins, ref, LABEL);
    if (e instanceof UserError) throw e;
    throw new UserError(e instanceof ProviderError ? e.userMessage : "تعذّر تصميم الصوت الآن. أُعيدت لك نقودك.", 502);
  }
}

/** «بصمة صوتك» at MiniMax: no slot limit there; the recording (10 s or more) is sent by a short-lived link. */
async function cloneMinimax(user: { id: string }, owner: boolean, b: { key?: unknown; uploadId?: unknown; name?: unknown; consent?: unknown; removeNoise?: unknown }): Promise<VoiceView> {
  if (!minimaxReady()) throw new UserError("MiniMax غير مفعّل على الخادم (FAL_KEY).", 503);
  await requireLibrary(user.id, owner);
  const key = String(b.key ?? "");
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(key)) throw new UserError("طلب غير صحيح.", 400);
  if (b.consent !== true) throw new UserError("أكّد أن الصوت صوتك أو أن لديك إذن صاحبه.", 400);
  const name = cleanName(b.name);
  if (!name) throw new UserError("سمِّ الصوت.", 400);
  const rt = await loadRuntime();
  const table = rt.prices[MINIMAX_ID] ?? {};
  const coins = owner ? 0 : table[MINIMAX_CLONE_KEY] == null ? null : Math.ceil(table[MINIMAX_CLONE_KEY]! / 100 - 1e-9);
  if (coins === null) throw new UserError("سعر نسخ الأصوات (MiniMax) لم يُحدد بعد.", 400);
  if (!isUuid(b.uploadId)) throw new UserError("الملف الصوتي غير صحيح.", 400);
  const { rows } = await refsFor(user.id, [{ uploadId: b.uploadId, role: "reference" }]);
  const r = rows[0];
  if (r.kind !== "audio" || r.status !== "ready") throw new UserError("اختر تسجيلًا صوتيًا (MP3 أو WAV) اكتمل رفعه.", 400);
  if ((r.duration_ms ?? 0) < 10_000) throw new UserError("MiniMax يحتاج تسجيل ١٠ ثوانٍ على الأقل.", 400);
  if ((r.duration_ms ?? 0) > 300_000) throw new UserError("التسجيل أطول من ٥ دقائق؛ قصّه ثم ارفعه.", 400);
  const link = (await storage.from(JAWAD_BUCKET).createSignedUrl(r.storage_path, 1800)).data?.signedUrl;
  if (!link) throw new UserError("تعذّر قراءة التسجيل.", 500);
  const ref = `voice-clone:${user.id}:${key}`;
  const seen = await db().from("smart_coin_ledger").select("id").eq("ref", ref).limit(1);
  if (seen.data?.length) throw new UserError("هذا الطلب نُفّذ من قبل.", 409);
  await holdCoins(user.id, coins, ref, LABEL);
  try {
    // spoken at once in Arabic: the voice is then used (MiniMax keeps it) and the sample is what the person hears
    const made = await minimaxCloneVoice({ audioUrl: link, previewText: "مرحبًا، هذا صوتي بعد نسخه. أتمنى أن يعجبك، وبإمكانك الآن استخدامه في أي نص تريده.", removeNoise: b.removeNoise === true });
    const path = `${user.id}/voices/mm-${Date.now()}.mp3`;
    const sample = made.preview ?? (await storage.from(JAWAD_BUCKET).download(r.storage_path).then((d) => (d.data ? Buffer.from(d.data as unknown as ArrayBuffer) : null)).catch(() => null));
    if (sample) await storage.from(JAWAD_BUCKET).upload(path, sample, { contentType: "audio/mpeg", upsert: true });
    return await insertVoice(user.id, { voiceId: made.voiceId, name, description: "", origin: "clone", sample: path, coins, copy: false, provider: "minimax" });
  } catch (e) {
    await releaseCoins(user.id, coins, ref, LABEL);
    if (e instanceof UserError) throw e;
    throw new UserError(e instanceof ProviderError ? e.userMessage : "تعذّر نسخ الصوت الآن. أُعيدت لك نقودك.", 502);
  }
}

export async function renameVoice(userId: string, id: unknown, name: unknown) {
  const n = cleanName(name);
  if (!isUuid(id) || !n) throw new UserError("طلب غير صحيح.", 400);
  const { data } = await db().from("jawad_voices").update({ name: n }).eq("id", id).eq("user_id", userId).select("id");
  if (!data?.length) throw new UserError("ما لقينا هذا الصوت.", 404);
}

/** Deletes a voice from ElevenLabs (frees its slot) and from the library. */
export async function deleteVoice(userId: string, id: unknown) {
  if (!isUuid(id)) throw new UserError("طلب غير صحيح.", 400);
  const { data } = await db().from("jawad_voices").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  if (!data) throw new UserError("ما لقينا هذا الصوت.", 404);
  const r = data as VoiceRow;
  try {
    // (a MiniMax voice has no slot to free: dropped from the library only)
    if ((r.provider ?? "elevenlabs") === "elevenlabs") await elevenDeleteVoice(r.provider_voice_id);
  } catch (e) {
    throw new UserError(e instanceof ProviderError ? e.userMessage : "تعذّر حذف الصوت الآن.", 502);
  }
  await db().from("jawad_voices").delete().eq("id", r.id);
  if (r.preview_path) await storage.from(JAWAD_BUCKET).remove([r.preview_path]).catch(() => null);
}

/** Duration of a stored sound (for outputs). */
export function audioDurationMs(buf: Buffer) {
  const bytes = new Uint8Array(buf);
  const sn = sniff(bytes);
  return sn ? probe(bytes, sn).durationMs : undefined;
}

export const ELEVEN_GENERATOR_IDS = ["elevenlabs-eleven-v4", "elevenlabs-sfx-v2", "elevenlabs-music-v2-5"];
export const isElevenGenerator = (id: string) => generatorById(id)?.provider.id === "elevenlabs";
