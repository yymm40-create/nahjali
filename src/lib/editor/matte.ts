// «قص الشخص» for «مختبر الموشن» on the person's own video: the person cut out of their clip with a clean, soft edge
// (hair included) by VEED's video background removal on fal (the fast model, edges refined: $0.012 per 30 frames),
// returned as one WebM (VP9) whose alpha channel is the person — so the scene can draw the stage, then words, then the
// person on top («النص ورا الراس»). Made ONCE per file, kept with it, and asked about now and then while fal works.
// Paid by the minute of the file at the owner's price (a video kind). Server only; needs FAL_KEY.

import { randomUUID } from "crypto";
import { UserError } from "@/lib/api";
import { sellKind } from "@config/coins";
import { coinsRequired, holdCoins, holdTeamCoins, refundTeamCoins, releaseCoins } from "@/lib/coins";
import { getLimit } from "@/lib/film/limits";
import { createAdminClient } from "@/lib/supabase/admin";
import { storage } from "@/lib/storage";
import { falReady, falSubmit, falTask } from "@/lib/jawad/server/providers/fal";
import { EDITOR_BUCKET, stillOpen, type AssetRow, type EditorProject } from "./server";
import type { Who } from "./pricing";

export const MATTE_MODEL = "veed/video-background-removal/fast";
/** the longest file sent (cost and the copy back) */
export const MATTE_MAX_MS = 5 * 60_000;

interface MatteMeta {
  status: "pending" | "ready";
  request?: string;
  path?: string;
  coins?: number;
  ref?: string;
  team?: string | null;
  at?: string;
}

const db = () => createAdminClient();

const linkOf = async (path: string) => {
  const l = await storage.from(EDITOR_BUCKET).createSignedUrl(path, 6 * 3600);
  if (l.error || !l.data) throw new UserError("ما قدرنا نجهّز رابط قص الشخص.", 502);
  return l.data.signedUrl;
};

async function save(row: AssetRow, matte: MatteMeta | null) {
  const meta = { ...(row.meta ?? {}) } as Record<string, unknown>;
  if (matte) meta.matte = matte;
  else delete meta.matte;
  await db().from("editor_assets").update({ meta }).eq("id", row.id);
}

/**
 * `{ assetId }` → `{ url }` when the cut-out is ready, `{ pending: true }` while fal works (asked again a few seconds
 * later). The first ask sends it and holds its price; a failure gives the coins back.
 */
export async function labMatte(p: EditorProject, who: Who, b: { assetId?: unknown }) {
  stillOpen(p);
  if (!falReady()) throw new UserError("قص الشخص غير مفعّل على الخادم (FAL_KEY).", 503);
  const { data } = await db().from("editor_assets").select("*").eq("id", String(b.assetId ?? "")).eq("project_id", p.id).maybeSingle();
  const row = data as AssetRow | null;
  if (!row || row.kind !== "video" || row.status !== "ready") throw new UserError("اختر فيديو جاهز من المشروع.", 400);
  if (row.meta?.local) throw new UserError("هذا الفيديو محفوظ على جهازك بس؛ ارفعه للمشروع من المتصفح أول.", 400);
  const had = (row.meta?.matte ?? null) as MatteMeta | null;
  if (had?.status === "ready" && had.path) return { url: await linkOf(had.path) };

  const refund = async (m: MatteMeta) => {
    if (!m.coins || !m.ref) return;
    if (m.team) await refundTeamCoins(m.ref).catch(() => {});
    else await releaseCoins(who.id, m.coins, m.ref, "قص الشخص في مختبر الموشن").catch(() => {});
  };

  if (had?.status === "pending" && had.request) {
    const task = await falTask(MATTE_MODEL, had.request).catch(() => null);
    if (!task || task.status === "queued" || task.status === "running") return { pending: true };
    if (task.status === "failed" || !task.videoUrl) {
      console.error("lab matte failed", task.error);
      await refund(had);
      await save(row, null);
      throw new UserError("ما قدر المزوّد يقص الشخص من هذا الفيديو. رجعت لك النقود؛ جرّب مرة ثانية.", 502);
    }
    // done: copied into the project's storage, kept with the file
    const res = await fetch(task.videoUrl, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) return { pending: true };
    const path = `${p.user_id}/${p.id}/media/${randomUUID()}-matte.webm`;
    const up = await storage.from(EDITOR_BUCKET).upload(path, new Uint8Array(await res.arrayBuffer()), { contentType: "video/webm", upsert: true });
    if (up.error) return { pending: true };
    await save(row, { status: "ready", path, at: new Date().toISOString() });
    return { url: await linkOf(path) };
  }

  // a new one: the price is the file's minutes at the owner's price; without a price only the owner can use it
  const ms = row.duration_ms ?? 0;
  if (!ms) throw new UserError("ما أعرف مدة هذا الفيديو؛ ارفعه من جديد.", 400);
  if (ms > MATTE_MAX_MS) throw new UserError(`قص الشخص لمقطع حتى ${MATTE_MAX_MS / 60_000} دقائق؛ قصّ الملف أول.`, 400);
  const per = await getLimit("editor_price_matte");
  if (!who.owner && per <= 0) throw new UserError("قص الشخص ما انفتح بعد؛ صاحب المنصة يحدد سعره أول.", 403);
  const coins = who.owner || !(await coinsRequired()) ? 0 : sellKind(Math.ceil(per * Math.ceil(ms / 60_000)), "video");
  const ref = `editor:editor_price_matte:${randomUUID()}`;
  const label = "قص الشخص في مختبر الموشن";
  if (who.team) await holdTeamCoins(who.team, who, coins, ref, label);
  else await holdCoins(who.id, coins, ref, label);
  const m: MatteMeta = { status: "pending", coins, ref, team: who.team ?? null, at: new Date().toISOString() };
  try {
    const src = await storage.from(row.bucket).createSignedUrl(row.path, 12 * 3600);
    if (src.error || !src.data) throw new Error("source link");
    // VP9 with alpha: one file, the person over transparency, the same frames and times as the clip
    m.request = await falSubmit(MATTE_MODEL, { video_url: src.data.signedUrl, output_codec: "vp9", refine_foreground_edges: true, subject_is_person: true });
    await save(row, m);
    return { pending: true, coins };
  } catch (e) {
    await refund(m);
    if (e instanceof UserError) throw e;
    console.error("lab matte start", e);
    throw new UserError("تعذّر إرسال الفيديو لقص الشخص. ما انخصم منك شي.", 502);
  }
}
