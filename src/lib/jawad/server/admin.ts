// «الجواد الذكي!» | JAWAD AI — the owner's settings: identity, ads, sections, generators and prices. Server only;
// every function here is called after requireJawadOwner(). Capabilities can never be added from here: generators,
// options and price units come from the code registry (config/jawad).

import { randomUUID } from "crypto";
import sharp from "sharp";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { GENERATORS, generatorById } from "@config/jawad/generators";
import { cleanAccent } from "@config/jawad/brand";
import { DEFAULT_SECTIONS, FIXED_IMPLEMENTATIONS, isImplementation, RESERVED_SECTION_IDS, SECTION_ICONS, SECTION_IMPLEMENTATIONS } from "@config/jawad/sections";
import { probe, sniff } from "../media";
import { AD_SLOTS, cleanAdHref, emptyAd, type AdContent, type AdRow, type AdSlot } from "./ads";
import { JAWAD_PUBLIC_BUCKET, loadRuntime } from "./runtime";

import { storage } from "@/lib/storage";
const db = () => createAdminClient();
const NOT_MIGRATED = "جداول JAWAD AI غير موجودة بعد: شغّل ملف SQL رقم 0017 في Supabase.";
const must = (error: { message?: string } | null) => {
  if (error) throw new UserError(/relation|does not exist|schema cache/i.test(error.message ?? "") ? NOT_MIGRATED : "تعذّر الحفظ. جرّب مرة ثانية.", 500);
};

// ───────────── public files (logo, ads, generator samples) ─────────────

export type Purpose = "logo" | "ad_media" | "ad_poster" | "sample";
const LIMITS: Record<Purpose, { kinds: ("image" | "video")[]; maxBytes: number }> = {
  logo: { kinds: ["image"], maxBytes: 5 * 1024 * 1024 },
  ad_media: { kinds: ["image", "video"], maxBytes: 50 * 1024 * 1024 },
  ad_poster: { kinds: ["image"], maxBytes: 8 * 1024 * 1024 },
  sample: { kinds: ["image"], maxBytes: 8 * 1024 * 1024 },
};
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "video/mp4": "mp4" };

/** A one-time upload URL into the public bucket, under a folder of its purpose. */
export async function signPublicUpload(purpose: Purpose, target: string, mime: string, bytes: number) {
  const lim = LIMITS[purpose];
  if (!lim) throw new UserError("طلب غير صحيح.", 400);
  if (!EXT[mime] || !lim.kinds.includes(mime.startsWith("video/") ? "video" : "image")) throw new UserError("نوع الملف غير مقبول هنا.", 400);
  if (!(bytes > 0 && bytes <= lim.maxBytes)) throw new UserError(`حجم الملف أكبر من ${Math.round(lim.maxBytes / 1024 / 1024)}MB.`, 400);
  const folder = purpose === "logo" ? "brand" : purpose === "sample" ? `samples/${target}` : `ads/${target}`;
  const path = `${folder}/${randomUUID()}.${EXT[mime]}`;
  const { data, error } = await storage.from(JAWAD_PUBLIC_BUCKET).createSignedUploadUrl(path);
  if (error) throw new UserError("تعذّر تجهيز الرفع (تأكد من تشغيل ملف SQL رقم 0017).", 500);
  return { path, signedUrl: data.signedUrl };
}

/** Reads an uploaded public file and checks it is what it claims (bytes, size, pixels). Deletes it otherwise. */
async function checkPublicFile(purpose: Purpose, path: string) {
  if (!/^(brand|samples\/[\w-]+|ads\/[0-9a-f-]{36})\/[0-9a-f-]{36}\.(png|jpg|webp|mp4)$/.test(path)) throw new UserError("ملف غير صحيح.", 400);
  const { data, error } = await storage.from(JAWAD_PUBLIC_BUCKET).download(path);
  if (error || !data) throw new UserError("ما وصل الملف؛ جرّب الرفع مرة ثانية.", 409);
  const buf = new Uint8Array(await data.arrayBuffer());
  const fail = async (msg: string): Promise<never> => {
    await storage.from(JAWAD_PUBLIC_BUCKET).remove([path]);
    throw new UserError(msg, 400);
  };
  const s = sniff(buf);
  if (!s || !LIMITS[purpose].kinds.includes(s.kind as "image" | "video") || (s.kind === "video" && s.mime !== "video/mp4")) return fail("محتوى الملف غير مقبول (المقبول: PNG/JPG/WEBP، وفيديو MP4 للإعلانات).");
  if (buf.length > LIMITS[purpose].maxBytes) return fail("حجم الملف أكبر من المسموح.");
  if (s.kind === "image") {
    const m = await sharp(Buffer.from(buf)).metadata().catch(() => null);
    if (!m?.width || !m.height) return fail("تعذّر قراءة الصورة.");
    if (Math.min(m.width, m.height) < 64) return fail("الصورة صغيرة جدًا.");
    return { type: "image" as const, mime: s.mime, width: m.width, height: m.height };
  }
  const p = probe(buf, s);
  if (!p.durationMs) return fail("تعذّر قراءة الفيديو.");
  return { type: "video" as const, mime: s.mime, width: p.width ?? null, height: p.height ?? null };
}

const removePublic = async (path: string | null | undefined) => {
  if (path) await storage.from(JAWAD_PUBLIC_BUCKET).remove([path]);
};

// ───────────── identity ─────────────

async function brand() {
  const { data } = await db().from("jawad_settings").select("value").eq("key", "brand").maybeSingle();
  return (data?.value ?? {}) as { logoPath?: string; accent?: string };
}
async function saveBrand(value: Record<string, unknown>, by: string) {
  const { error } = await db().from("jawad_settings").upsert({ key: "brand", value, updated_at: new Date().toISOString(), updated_by: by });
  must(error);
}

export async function setAccent(accent: unknown, by: string) {
  if (typeof accent !== "string" || !/^#[0-9a-f]{6}$/i.test(accent)) throw new UserError("اكتب لونًا بصيغة ‎#RRGGBB.", 400);
  await saveBrand({ ...(await brand()), accent: cleanAccent(accent) }, by);
}

export async function setLogo(path: string | null, by: string) {
  const b = await brand();
  if (path) await checkPublicFile("logo", path);
  if (b.logoPath && b.logoPath !== path) await removePublic(b.logoPath);
  await saveBrand({ ...b, logoPath: path ?? undefined }, by);
}

// ───────────── ads ─────────────

async function adById(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new UserError("إعلان غير صحيح.", 400);
  const { data, error } = await db().from("jawad_ads").select("*").eq("id", id).maybeSingle();
  must(error);
  if (!data) throw new UserError("ما لقينا الإعلان.", 404);
  return data as AdRow;
}

export async function createAd() {
  const { count } = await db().from("jawad_ads").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= 12) throw new UserError("وصلت لحد ١٢ إعلانًا؛ احذف القديم أولًا.", 400);
  const used = new Set(((await db().from("jawad_ads").select("draft")).data ?? []).map((r) => (r.draft as AdContent).slot));
  const slot = AD_SLOTS.find((s) => !used.has(s)) ?? "main";
  const { data, error } = await db().from("jawad_ads").insert({ draft: emptyAd(slot) }).select("id").single();
  must(error);
  return data!.id as string;
}

export async function updateAdDraft(id: string, b: { title?: unknown; href?: unknown; slot?: unknown; enabled?: unknown }) {
  const ad = await adById(id);
  const draft = { ...emptyAd(), ...ad.draft };
  if (b.title !== undefined) {
    const t = String(b.title).replace(/\s+/g, " ").trim();
    if (t.length > 120) throw new UserError("العنوان طويل (١٢٠ حرفًا كحد أقصى).", 400);
    draft.title = t;
  }
  if (b.href !== undefined) {
    const h = cleanAdHref(b.href);
    if (h === null) throw new UserError("الرابط لازم يكون مسارًا داخل الموقع يبدأ بـ / أو عنوان https كاملًا.", 400);
    draft.href = h;
  }
  if (b.slot !== undefined) {
    if (!AD_SLOTS.includes(b.slot as AdSlot)) throw new UserError("خانة غير صحيحة.", 400);
    draft.slot = b.slot as AdSlot;
  }
  if (b.enabled !== undefined) draft.enabled = Boolean(b.enabled);
  const { error } = await db().from("jawad_ads").update({ draft, updated_at: new Date().toISOString() }).eq("id", id);
  must(error);
}

/** Sets (or clears) the ad's picture/video or its cover picture in the draft. Files no longer used are deleted. */
export async function setAdFile(id: string, which: "media" | "poster", path: string | null) {
  const ad = await adById(id);
  const draft = { ...emptyAd(), ...ad.draft };
  const old = which === "media" ? draft.media?.path : draft.poster?.path;
  if (path) {
    if (!path.startsWith(`ads/${id}/`)) throw new UserError("ملف غير صحيح.", 400);
    const f = await checkPublicFile(which === "media" ? "ad_media" : "ad_poster", path);
    if (which === "media") draft.media = { path, type: f.type, mime: f.mime, width: f.width, height: f.height };
    else draft.poster = { path };
  } else if (which === "media") draft.media = null;
  else draft.poster = null;
  const { error } = await db().from("jawad_ads").update({ draft, updated_at: new Date().toISOString() }).eq("id", id);
  must(error);
  // The published copy may still use the old file: keep it until it is no longer referenced
  const live = ad.live;
  if (old && old !== path && live?.media?.path !== old && live?.poster?.path !== old) await removePublic(old);
}

export async function publishAd(id: string) {
  const ad = await adById(id);
  const d = { ...emptyAd(), ...ad.draft };
  if (!d.media) throw new UserError("أضف صورة أو فيديو للإعلان قبل النشر.", 400);
  if (!d.title) throw new UserError("اكتب عنوان الإعلان قبل النشر.", 400);
  if (cleanAdHref(d.href) === null) throw new UserError("الرابط غير صالح.", 400);
  if (d.enabled) {
    const { data } = await db().from("jawad_ads").select("id,live").neq("id", id);
    const taken = ((data ?? []) as Pick<AdRow, "id" | "live">[]).find((r) => r.live?.enabled && r.live.slot === d.slot);
    if (taken) throw new UserError("هذه الخانة فيها إعلان منشور آخر. أخفِه أو انقله لخانة أخرى أولًا.", 409);
  }
  const old = ad.live;
  const { error } = await db().from("jawad_ads").update({ live: d, published_at: new Date().toISOString() }).eq("id", id);
  must(error);
  // Files only the previous published copy used
  for (const p of [old?.media?.path, old?.poster?.path]) if (p && p !== d.media?.path && p !== d.poster?.path) await removePublic(p);
}

export async function unpublishAd(id: string) {
  await adById(id);
  const { error } = await db().from("jawad_ads").update({ live: null, published_at: null }).eq("id", id);
  must(error);
}

export async function deleteAd(id: string) {
  const ad = await adById(id);
  const paths = [ad.draft?.media?.path, ad.draft?.poster?.path, ad.live?.media?.path, ad.live?.poster?.path].filter((p): p is string => Boolean(p));
  const { error } = await db().from("jawad_ads").delete().eq("id", id);
  must(error);
  if (paths.length) await storage.from(JAWAD_PUBLIC_BUCKET).remove([...new Set(paths)]);
}

// ───────────── sections ─────────────

export async function saveSection(b: { id?: unknown; name?: unknown; icon?: unknown; implementation?: unknown; sort?: unknown; enabled?: unknown; isNew?: unknown }) {
  const id = String(b.id ?? "").trim().toLowerCase();
  const builtIn = DEFAULT_SECTIONS.find((s) => s.id === id);
  if (!/^[a-z][a-z0-9-]{1,31}$/.test(id)) throw new UserError("المعرّف: حروف إنجليزية صغيرة وأرقام و- (٢–٣٢)، ويبدأ بحرف.", 400);
  if (b.isNew) {
    if (builtIn || RESERVED_SECTION_IDS.includes(id)) throw new UserError("هذا المعرّف محجوز.", 400);
    const rt = await loadRuntime();
    if (rt.sections.some((s) => s.id === id)) throw new UserError("يوجد قسم بهذا المعرّف.", 400);
  }
  const name = String(b.name ?? "").replace(/\s+/g, " ").trim();
  if (!name || name.length > 40) throw new UserError("اكتب اسم القسم (٤٠ حرفًا كحد أقصى).", 400);
  const icon = String(b.icon ?? "");
  if (!(SECTION_ICONS as readonly string[]).includes(icon)) throw new UserError("اختر أيقونة من القائمة.", 400);
  // A built-in section keeps its component; a new one must use an implemented studio (the film maker has one place)
  const implementation = builtIn ? builtIn.implementation : String(b.implementation ?? "");
  if (!isImplementation(implementation) || (!builtIn && FIXED_IMPLEMENTATIONS.includes(implementation))) throw new UserError("اربط القسم بمكوّن منفّذ.", 400);
  const sort = Math.round(Number(b.sort));
  if (!Number.isFinite(sort) || sort < 0 || sort > 10000) throw new UserError("الترتيب رقم من ٠ إلى ١٠٠٠٠.", 400);
  const { error } = await db().from("jawad_sections").upsert({ id, name, icon, implementation, sort, enabled: Boolean(b.enabled), updated_at: new Date().toISOString() });
  must(error);
}

/** A built-in section goes back to its defaults; an added one is removed (its generators return to their default section). */
export async function deleteSection(id: string) {
  const { error } = await db().from("jawad_sections").delete().eq("id", id);
  must(error);
}

// ───────────── generators ─────────────

export async function saveGenerator(b: { id?: unknown; displayName?: unknown; sectionId?: unknown; sort?: unknown; enabled?: unknown }) {
  const def = generatorById(String(b.id ?? ""));
  if (!def) throw new UserError("مولد غير معروف (المولدات الجديدة تحتاج برمجة).", 400);
  const rt = await loadRuntime();
  const name = String(b.displayName ?? "").replace(/\s+/g, " ").trim();
  if (name.length > 60) throw new UserError("الاسم طويل.", 400);
  const sectionId = String(b.sectionId ?? def.defaultSection);
  if (!rt.sections.some((s) => s.id === sectionId && s.output === def.output)) throw new UserError("اختر قسمًا من نفس نوع المخرجات.", 400);
  const sort = Math.round(Number(b.sort ?? 100));
  if (!Number.isFinite(sort) || sort < 0 || sort > 10000) throw new UserError("الترتيب رقم من ٠ إلى ١٠٠٠٠.", 400);
  const { data: cur } = await db().from("jawad_generators").select("sample_path").eq("id", def.id).maybeSingle();
  const { error } = await db()
    .from("jawad_generators")
    .upsert({ id: def.id, display_name: name || null, section_id: sectionId, sort, enabled: Boolean(b.enabled), sample_path: cur?.sample_path ?? null, updated_at: new Date().toISOString() });
  must(error);
}

export async function setGeneratorSample(id: string, path: string | null) {
  const def = generatorById(id);
  if (!def) throw new UserError("مولد غير معروف.", 400);
  if (path) {
    if (!path.startsWith(`samples/${def.id}/`)) throw new UserError("ملف غير صحيح.", 400);
    await checkPublicFile("sample", path);
  }
  const { data: cur } = await db().from("jawad_generators").select("*").eq("id", def.id).maybeSingle();
  const { error } = await db()
    .from("jawad_generators")
    .upsert({ id: def.id, display_name: cur?.display_name ?? null, section_id: cur?.section_id ?? def.defaultSection, sort: cur?.sort ?? 100, enabled: cur?.enabled ?? false, sample_path: path, updated_at: new Date().toISOString() });
  must(error);
  if (cur?.sample_path && cur.sample_path !== path) await removePublic(cur.sample_path);
}

// ───────────── prices ─────────────

/** Sets one supported price (in coins, up to 2 decimals) or returns it to the code default (null). Logged. */
export async function setPrice(generatorId: string, key: string, coins: unknown, by: string) {
  const def = generatorById(generatorId);
  const pk = def?.priceKeys.find((k) => k.key === key);
  if (!def || !pk) throw new UserError("هذا البند غير مدعوم في تسعير هذا المولد.", 400);
  let centi: number | null = null;
  if (coins !== null && coins !== "") {
    const n = Number(coins);
    if (!Number.isFinite(n) || n <= 0 || n > 100000 || Math.abs(Math.round(n * 100) - n * 100) > 1e-6) throw new UserError("اكتب سعرًا موجبًا بخانتين عشريتين كحد أقصى.", 400);
    centi = Math.round(n * 100);
  }
  const { data: cur, error: e0 } = await db().from("jawad_price_rules").select("centicoins").eq("generator_id", def.id).eq("price_key", key).maybeSingle();
  must(e0);
  const old = (cur?.centicoins as number | undefined) ?? null;
  if (old === centi) return;
  const { error } =
    centi === null
      ? await db().from("jawad_price_rules").delete().eq("generator_id", def.id).eq("price_key", key)
      : await db().from("jawad_price_rules").upsert({ generator_id: def.id, price_key: key, centicoins: centi, updated_at: new Date().toISOString(), updated_by: by });
  must(error);
  await db().from("jawad_price_log").insert({ generator_id: def.id, price_key: key, old_centicoins: old, new_centicoins: centi, changed_by: by });
}

export const ADMIN_LISTS = {
  generators: GENERATORS,
  implementations: SECTION_IMPLEMENTATIONS,
  icons: SECTION_ICONS,
};
