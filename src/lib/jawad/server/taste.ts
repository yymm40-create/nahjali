// «الجواد الذكي!» | JAWAD AI — «ذوقي» (tastes made from the person's pictures) and «هويتي» (their brand kit). Server only.
//
//   make  ─► 3–20 of the person's own checked pictures, a fixed price taken first; Claude looks at them ONCE and writes
//            the look in words; up to 4 pictures are kept, the rest deleted. Any failure gives the price back.
//   use   ─► createJob (jobs.ts) adds the words to the prompt, and the kept pictures as STYLE references only on the
//            generators config/jawad/taste.ts allows; the brand's colours, fonts, voice and (when asked) logo likewise.
//   read  ─► brandKitFor: the kit for other sections' briefs («حيدرة كت»'s motion, «صانع المحتوى»).

import { coinStr } from "@config/coins";
import { randomUUID } from "crypto";
import { shortBalance, UserError } from "@/lib/api";
import { coinBalance } from "@/lib/coins";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaudeJson, type ClaudePart } from "@/lib/film/anthropic";
import { storage } from "@/lib/storage";
import {
  cleanBrand,
  cleanTasteName,
  EMPTY_BRAND,
  lookRefNames,
  ownRowProblem,
  pickLookRefs,
  picturesProblem,
  readTasteAnalysis,
  styleRefRoom,
  TASTE_ANALYSE_COINS,
  TASTE_LIMIT,
  TASTE_SCHEMA,
  TASTE_TASK,
  tasteNameProblem,
  tasteText,
  type BrandKit,
} from "@config/jawad/taste";
import type { GeneratorDef, RefMeta, RefStyle, Settings } from "@config/jawad/types";
import { fileProblem } from "../engine";
import { JAWAD_BUCKET } from "./runtime";
import { tasteMissing } from "./taste-kept";
import { deleteUpload, isUuid, uploadViews, type UploadRow, type UploadView } from "./uploads";

const db = () => createAdminClient();
const LABEL = "JAWAD AI · ذوقي";

export interface TasteRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  summary: string;
  palette: string[];
  ref_upload_ids: string[];
  source_count: number;
  created_at: string;
}
interface BrandRow {
  user_id: string;
  colors: string[];
  logo_upload_id: string | null;
  fonts: string[];
  voice: string;
}

/** A picture of a taste or the logo, as the studio needs it (to show it, and to quote the generation with it). */
export type LookPicture = Pick<UploadView, "id" | "url" | "mime" | "bytes" | "width" | "height">;
export interface TasteView {
  id: string;
  name: string;
  summary: string;
  palette: string[];
  /** the look in words, as the generators read it */
  text: string;
  pictures: LookPicture[];
  sourceCount: number;
  createdAt: string;
}
export interface BrandView extends BrandKit {
  logo: LookPicture | null;
}
export interface LookState {
  /** 0116 has been run */
  migrated: boolean;
  tastes: TasteView[];
  brand: BrandView;
}

const picture = (v: UploadView): LookPicture => ({ id: v.id, url: v.url, mime: v.mime, bytes: v.bytes, width: v.width, height: v.height });

async function tasteRows(userId: string) {
  const { data, error } = await db().from("jawad_tastes").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (tasteMissing(error)) return null;
  if (error) throw error;
  return (data ?? []) as TasteRow[];
}
async function brandRow(userId: string) {
  const { data, error } = await db().from("jawad_brand_kits").select("*").eq("user_id", userId).maybeSingle();
  if (tasteMissing(error)) return undefined;
  if (error) throw error;
  return (data as BrandRow | null) ?? null;
}
const kitOf = (r: BrandRow | null | undefined): BrandKit => (r ? cleanBrand({ colors: r.colors, fonts: r.fonts, voice: r.voice, logoUploadId: r.logo_upload_id }) : EMPTY_BRAND);

/** The person's own ready pictures among these ids (with short-lived links). */
async function ownPictures(userId: string, ids: string[]) {
  if (!ids.length) return new Map<string, UploadView>();
  const { data } = await db().from("jawad_uploads").select("*").in("id", ids).eq("user_id", userId);
  const rows = ((data ?? []) as UploadRow[]).filter((r) => r.kind === "image" && r.status === "ready");
  return new Map((await uploadViews(rows)).map((v) => [v.id, v]));
}

/** The person's tastes and brand kit; before 0116 runs, `migrated: false` and nothing else. */
export async function listLook(userId: string): Promise<LookState> {
  const [tastes, brand] = await Promise.all([tasteRows(userId), brandRow(userId)]);
  if (!tastes || brand === undefined) return { migrated: false, tastes: [], brand: { ...EMPTY_BRAND, logo: null } };
  const kit = kitOf(brand);
  const pics = await ownPictures(userId, [...new Set([...tastes.flatMap((t) => t.ref_upload_ids), ...(kit.logoUploadId ? [kit.logoUploadId] : [])])]);
  return {
    migrated: true,
    tastes: tastes.map((t) => ({
      id: t.id,
      name: t.name,
      summary: t.summary,
      palette: t.palette ?? [],
      text: t.description,
      pictures: t.ref_upload_ids.flatMap((id) => (pics.get(id) ? [picture(pics.get(id)!)] : [])),
      sourceCount: t.source_count,
      createdAt: t.created_at,
    })),
    brand: { ...kit, logo: kit.logoUploadId && pics.get(kit.logoUploadId) ? picture(pics.get(kit.logoUploadId)!) : null },
  };
}

async function requireMigrated(userId: string) {
  const rows = await tasteRows(userId);
  if (!rows) throw new UserError("«ذوقي» و«هويتي» قيد التجهيز (ملف قاعدة البيانات 0116).", 503);
  return rows;
}

async function refund(userId: string, coins: number, ref: string) {
  const { data } = await db().rpc("adjust_smart_coins", { p_user: userId, p_delta: coins, p_reason: "refund", p_ref: ref, p_label: LABEL, p_allow_negative: true });
  return (data as number | null) ?? null;
}

export interface MakeTasteBody {
  key?: unknown;
  name?: unknown;
  uploadIds?: unknown;
  expectedCoins?: unknown;
  model?: unknown;
}
export type MakeTasteResult = { kind: "done"; taste: TasteView; coins: number; balance: number | null } | { kind: "price_changed"; coins: number };

/** «ذوقي»: checks, charges the fixed price, has Claude look at the pictures once, keeps the taste; refunds on any failure. */
export async function makeTaste(user: { id: string }, owner: boolean, b: MakeTasteBody): Promise<MakeTasteResult> {
  const key = String(b.key ?? "");
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(key)) throw new UserError("طلب غير صحيح.", 400);
  const mine = await requireMigrated(user.id);
  const name = cleanTasteName(b.name);
  const nameWhy = tasteNameProblem(name, mine);
  if (nameWhy) throw new UserError(nameWhy, mine.length >= TASTE_LIMIT ? 409 : 400);
  const ids = Array.isArray(b.uploadIds) ? b.uploadIds.filter(isUuid) : [];
  if (Array.isArray(b.uploadIds) && ids.length !== b.uploadIds.length) throw new UserError("صور غير صحيحة.", 400);
  const picsWhy = picturesProblem(ids);
  if (picsWhy) throw new UserError(picsWhy, 400);
  // only the person's own checked pictures
  const pics = await ownPictures(user.id, ids);
  if (pics.size !== ids.length) throw new UserError("إحدى الصور مو لك أو ما اكتمل رفعها أو حُذفت. احذفها وجرّب.", 400);
  if (Number(b.expectedCoins) !== TASTE_ANALYSE_COINS) return { kind: "price_changed", coins: TASTE_ANALYSE_COINS };
  if (!process.env.ANTHROPIC_API_KEY) throw new UserError("تحليل الذوق غير متاح حاليًا.", 503);

  // Charge first (the owner isn't charged). Only the first charge of the same click goes on (double click, retry).
  const coins = TASTE_ANALYSE_COINS;
  const charged = !owner && coins > 0;
  const ref = `taste:${key}:${randomUUID()}`;
  let balance: number | null = null;
  if (charged) {
    const { data, error } = await db().rpc("adjust_smart_coins", { p_user: user.id, p_delta: -coins, p_reason: "reserve", p_ref: ref, p_label: LABEL, p_allow_negative: false });
    if (error) throw error;
    if (data == null) {
      const have = (await coinBalance(user.id)) ?? 0;
      throw shortBalance(coins - Math.min(have, 0), have, "تحليل الذوق");
    }
    balance = data as number;
    const { data: same } = await db().from("smart_coin_ledger").select("ref,created_at").eq("user_id", user.id).like("ref", `taste:${key}:%`).lt("delta", 0).order("created_at").order("ref");
    if (same?.[0]?.ref !== ref) {
      await refund(user.id, coins, ref);
      throw new UserError("هذا الطلب قيد التنفيذ بالفعل.", 409);
    }
  }

  try {
    const { data: rows } = await db().from("jawad_uploads").select("id,storage_path").in("id", ids).eq("user_id", user.id);
    const pathOf = new Map((rows ?? []).map((r) => [r.id as string, r.storage_path as string]));
    const signed = (await storage.from(JAWAD_BUCKET).createSignedUrls(ids.map((id) => pathOf.get(id)!), 600)).data ?? [];
    const parts: ClaudePart[] = [];
    ids.forEach((_, i) => {
      const url = signed[i]?.signedUrl;
      if (url) parts.push({ type: "text", text: `Picture ${i + 1}:` }, { type: "image", url });
    });
    parts.push({ type: "text", text: "Write the shared look of these pictures." });
    const r = await callClaudeJson<unknown>({
      system: TASTE_TASK,
      turns: [{ role: "user", content: parts }],
      schema: TASTE_SCHEMA,
      maxTokens: 1500,
      effort: "low",
      // per-message facts in the turn, never in the system (it stays cached)
      turnNote: `${ids.length} pictures, numbered 1–${ids.length}. Keep: up to 4 of these numbers.`,
      cacheTail: false,
    });
    const a = readTasteAnalysis(r.data, ids.length);
    if (!a) throw new Error("taste analysis said nothing usable");
    const kept = a.keep.map((n) => ids[n - 1]);
    const { data: row, error } = await db()
      .from("jawad_tastes")
      .insert({ user_id: user.id, name, description: tasteText(a), summary: a.summary, palette: a.palette, ref_upload_ids: kept, source_count: ids.length })
      .select("*")
      .single();
    if (error?.code === "23505") throw new UserError(`عندك ذوق باسم «${name}» من قبل؛ اختر اسمًا آخر.`, 409);
    if (error) throw error;
    // the pictures not kept go (each only if nothing else keeps or still needs it)
    for (const id of ids.filter((x) => !kept.includes(x))) await deleteUpload(user.id, id).catch(() => {});
    const t = row as TasteRow;
    console.info("jawad taste", { user: user.id, pictures: ids.length });
    return {
      kind: "done",
      taste: { id: t.id, name: t.name, summary: t.summary, palette: t.palette, text: t.description, pictures: kept.map((id) => picture(pics.get(id)!)), sourceCount: t.source_count, createdAt: t.created_at },
      coins: charged ? coins : 0,
      balance,
    };
  } catch (err) {
    console.error("jawad taste failed", user.id, err);
    if (charged) await refund(user.id, coins, ref);
    if (err instanceof UserError) throw err;
    throw new UserError(`تعذّر تحليل الصور الآن؛ جرّب مرة ثانية.${charged ? ` أعدنا لك ${coinStr(coins)}.` : ""}`, 502);
  }
}

async function ownTaste(userId: string, id: unknown) {
  if (!isUuid(id)) throw new UserError("طلب غير صحيح.", 400);
  const { data, error } = await db().from("jawad_tastes").select("*").eq("id", id).maybeSingle();
  if (tasteMissing(error)) throw new UserError("«ذوقي» قيد التجهيز (ملف قاعدة البيانات 0116).", 503);
  const row = data as TasteRow | null;
  const why = ownRowProblem(userId, row ? { ownerId: row.user_id } : null);
  if (why) throw new UserError(why, 404);
  return row!;
}

export async function renameTaste(userId: string, id: unknown, raw: unknown) {
  const row = await ownTaste(userId, id);
  const name = cleanTasteName(raw);
  const why = tasteNameProblem(name, (await tasteRows(userId)) ?? [], row.id);
  if (why) throw new UserError(why, 400);
  const { error } = await db().from("jawad_tastes").update({ name, updated_at: new Date().toISOString() }).eq("id", row.id).eq("user_id", userId);
  if (error?.code === "23505") throw new UserError(`عندك ذوق باسم «${name}» من قبل.`, 409);
  if (error) throw error;
}

/** Removes a taste and its pictures (works already made keep their own copies). */
export async function deleteTaste(userId: string, id: unknown) {
  const row = await ownTaste(userId, id);
  const { error } = await db().from("jawad_tastes").delete().eq("id", row.id).eq("user_id", userId);
  if (error) throw error;
  for (const up of row.ref_upload_ids) await deleteUpload(userId, up).catch(() => {});
}

/** Saves the brand kit (a new logo must be the person's own checked picture; the one it replaces goes). */
export async function saveBrand(userId: string, raw: unknown): Promise<BrandView> {
  const before = await brandRow(userId);
  if (before === undefined) throw new UserError("«هويتي» قيد التجهيز (ملف قاعدة البيانات 0116).", 503);
  const kit = cleanBrand(raw);
  if (kit.logoUploadId) {
    const pics = await ownPictures(userId, [kit.logoUploadId]);
    if (!pics.size) throw new UserError("الشعار: ارفع صورة PNG اكتمل رفعها.", 400);
  }
  const { error } = await db()
    .from("jawad_brand_kits")
    .upsert({ user_id: userId, colors: kit.colors, fonts: kit.fonts, voice: kit.voice, logo_upload_id: kit.logoUploadId, updated_at: new Date().toISOString() });
  if (error) throw error;
  if (before?.logo_upload_id && before.logo_upload_id !== kit.logoUploadId) await deleteUpload(userId, before.logo_upload_id).catch(() => {});
  return (await listLook(userId)).brand;
}

/**
 * «هويتي» for other sections (the read helper): the person's brand kit, or null when they saved none (or before 0116).
 * Pair with brandBrief (config/jawad/taste.ts) for a few lines to put in a brief.
 */
export async function brandKitFor(userId: string): Promise<BrandKit | null> {
  const row = await brandRow(userId).catch(() => undefined);
  if (!row) return null;
  return kitOf(row);
}

// ───────────────────────────── a generation with a taste and/or the brand ─────────────────────────────

/** What a studio generation asked for: `tasteId`, and `brand` (true, or `{ logo: true }` to put the logo in). */
export interface LookAsk {
  tasteId?: unknown;
  brand?: unknown;
}
export interface Look {
  taste: TasteRow | null;
  brand: BrandKit | null;
  logo: boolean;
  /** every picture of the taste and the logo (never sent as an ordinary reference) */
  ids: Set<string>;
}

/** The taste (the person's own) and the brand kit a generation asked for; null when it asked for neither. */
export async function lookFor(userId: string, b: LookAsk): Promise<Look | null> {
  const wantsBrand = b.brand === true || (Boolean(b.brand) && typeof b.brand === "object");
  const tasteId = typeof b.tasteId === "string" && b.tasteId ? b.tasteId : null;
  if (!tasteId && !wantsBrand) return null;
  const taste = tasteId ? await ownTaste(userId, tasteId) : null;
  const kit = wantsBrand ? kitOf(await brandRow(userId)) : null;
  const logo = Boolean(kit?.logoUploadId && typeof b.brand === "object" && (b.brand as { logo?: unknown }).logo === true);
  return { taste, brand: kit, logo, ids: new Set([...(taste?.ref_upload_ids ?? []), ...(kit?.logoUploadId ? [kit.logoUploadId] : [])]) };
}

/**
 * The extra references of a look (the logo, then the taste's pictures), as far as this generator takes pictures for
 * their look and there is room beside the person's own `meta`. Their ready metadata is read here.
 */
export async function lookRefs(userId: string, def: GeneratorDef, refStyle: RefStyle, settings: Settings, meta: RefMeta[], look: Look) {
  const room = styleRefRoom(def, refStyle, settings, meta.filter((m) => m.kind === "image").length);
  if (!room) return { logo: null as RefMeta | null, taste: [] as RefMeta[] };
  const want = [...(look.logo && look.brand?.logoUploadId ? [look.brand.logoUploadId] : []), ...(look.taste?.ref_upload_ids ?? [])];
  const pics = await ownPictures(userId, want);
  const asMeta = (id: string): RefMeta | null => {
    const v = pics.get(id);
    return v ? { id, kind: "image", role: "reference", mime: v.mime, bytes: v.bytes, width: v.width, height: v.height, status: "ready" } : null;
  };
  const logo = look.logo && look.brand?.logoUploadId ? asMeta(look.brand.logoUploadId) : null;
  const taste = (look.taste?.ref_upload_ids ?? []).map(asMeta).filter((m): m is RefMeta => Boolean(m));
  const picked = pickLookRefs({ room, logo, taste, fits: (r) => !fileProblem(def, r) });
  const names = lookRefNames(meta.map((m) => m.name ?? ""), picked.taste.length, Boolean(picked.logo));
  return {
    logo: picked.logo ? { ...picked.logo, name: names.logo } : null,
    taste: picked.taste.map((m, i) => ({ ...m, name: names.taste[i] })),
  };
}
