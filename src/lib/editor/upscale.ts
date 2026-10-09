// «رفع الدقة» (upscale): a video of the project made sharper and bigger — 720p or 1080p to 4K (or to 1080p) — by
// Topaz Video AI on fal (the «Proteus» model: detail recovered, compression and noise cleaned, faces kept natural).
// It runs on fal's queue (minutes for a long clip): the page asks now and then how far it is, and when it is done the
// result is copied into the project's storage in parts (never held whole in memory) as a NEW file of the library —
// the original stays. Its price (per minute of video) is the owner's; without one only the owner can use it.
// Server only; needs FAL_KEY.

import { randomUUID } from "crypto";
import { UserError } from "@/lib/api";
import { sellHalalas } from "@config/coins";
import { coinsRequired, holdCoins, holdTeamCoins, refundTeamCoins, releaseCoins } from "@/lib/coins";
import { getLimit } from "@/lib/film/limits";
import { createAdminClient } from "@/lib/supabase/admin";
import { storage } from "@/lib/storage";
import { assetView, EDITOR_BUCKET, stillOpen, type AssetRow, type EditorProject } from "./server";
import type { Who } from "./pricing";

const MODEL = "fal-ai/topaz/upscale/video";
const QUEUE = "https://queue.fal.run";
/** the long side of each target */
export const UPSCALE_TARGETS = { "4k": 3840, "1080p": 1920 } as const;
export type UpscaleTarget = keyof typeof UPSCALE_TARGETS;
/** fal's published price per second of video, by the output's size (60 fps doubles it; we keep the frame rate) */
export const UPSCALE_USD_PER_SEC = { "4k": 0.08, "1080p": 0.02 } as const;
/** the longest video sent (cost and the copy back) */
export const UPSCALE_MAX_MS = 5 * 60_000;
const PART = 16 * 1024 * 1024;

const db = () => createAdminClient();
const falHeaders = () => ({ Authorization: `Key ${process.env.FAL_KEY}`, "Content-Type": "application/json" });

interface UpscaleMeta {
  from: string;
  target: UpscaleTarget;
  factor: number;
  statusUrl: string;
  responseUrl: string;
  coins: number;
  ref: string;
  team: string | null;
  label: string;
  startedAt: string;
}

/** How much bigger: the long side up to the target's (at most ×4), or null when it is already that big. */
export function upscaleFactor(width: number, height: number, target: UpscaleTarget): number | null {
  const long = Math.max(width, height);
  if (!long) return null;
  const f = UPSCALE_TARGETS[target] / long;
  if (f < 1.05) return null;
  return Math.min(4, Math.round(f * 100) / 100);
}

/** The result's size (even numbers, like the encoder makes them). */
export const upscaledSize = (width: number, height: number, factor: number) => ({ width: Math.round((width * factor) / 2) * 2, height: Math.round((height * factor) / 2) * 2 });

async function sourceRow(p: EditorProject, id: unknown) {
  const { data } = await db().from("editor_assets").select("*").eq("id", String(id ?? "")).eq("project_id", p.id).maybeSingle();
  return data as AssetRow | null;
}

/** Sends a video of the project to be upscaled; the new file waits in the library («pending») until it is done. */
export async function startUpscale(p: EditorProject, who: Who, b: { assetId?: unknown; target?: unknown }) {
  stillOpen(p);
  if (!process.env.FAL_KEY) throw new UserError("رفع الدقة غير مفعّل على الخادم (FAL_KEY).", 503);
  const target: UpscaleTarget = b.target === "1080p" ? "1080p" : "4k";
  const src = await sourceRow(p, b.assetId);
  if (!src || src.kind !== "video" || src.status !== "ready") throw new UserError("اختر فيديو جاهز من المشروع.", 400);
  if (!src.width || !src.height || !src.duration_ms) throw new UserError("ما أعرف مقاس هذا الفيديو أو مدته؛ ارفعه من جديد.", 400);
  if (src.duration_ms > UPSCALE_MAX_MS) throw new UserError(`رفع الدقة لمقطع حتى ${UPSCALE_MAX_MS / 60_000} دقائق؛ قصّه أو قسّمه أول.`, 400);
  const factor = upscaleFactor(src.width, src.height, target);
  if (!factor) throw new UserError(`هذا الفيديو دقته ${src.width}×${src.height}، يعني ${target === "4k" ? "4K" : "1080p"} أو أعلى من قبل.`, 400);

  // the price: per minute of video (rounded up), the owner's; without a price only the owner can use it
  const per = await getLimit("editor_price_upscale");
  if (!who.owner && per <= 0) throw new UserError("رفع الدقة ما انفتح بعد؛ صاحب المنصة يحدد سعره أول.", 403);
  const minutes = Math.ceil(src.duration_ms / 60_000);
  const coins = who.owner || !(await coinsRequired()) ? 0 : sellHalalas(Math.ceil(per * minutes));
  const ref = `editor:editor_price_upscale:${randomUUID()}`;
  const label = `رفع دقة «${src.name.slice(0, 60)}» إلى ${target === "4k" ? "4K" : "1080p"}`;
  if (who.team) await holdTeamCoins(who.team, who, coins, ref, label);
  else await holdCoins(who.id, coins, ref, label);

  const refund = async () => {
    if (who.team) await refundTeamCoins(ref).catch(() => {});
    else await releaseCoins(who.id, coins, ref, label).catch(() => {});
  };
  try {
    const link = await storage.from(src.bucket).createSignedUrl(src.path, 12 * 3600);
    if (link.error || !link.data) throw new Error("source link");
    const sub = await fetch(`${QUEUE}/${MODEL}`, {
      method: "POST",
      headers: falHeaders(),
      // Proteus: the general model; H.264 so every browser plays the result (H.265 doesn't play in Chrome)
      body: JSON.stringify({ video_url: link.data.signedUrl, upscale_factor: factor, model: "Proteus", H264_output: true }),
    });
    if (!sub.ok) throw new UserError(`مزوّد رفع الدقة رفض الطلب (${sub.status}). ما انخصم منك شي.`, 502);
    const q = (await sub.json()) as { status_url: string; response_url: string };
    const size = upscaledSize(src.width, src.height, factor);
    const meta: UpscaleMeta = { from: src.id, target, factor, statusUrl: q.status_url, responseUrl: q.response_url, coins, ref, team: who.team ?? null, label, startedAt: new Date().toISOString() };
    const { data: row, error } = await db()
      .from("editor_assets")
      .insert({
        project_id: p.id,
        user_id: p.user_id,
        kind: "video",
        bucket: EDITOR_BUCKET,
        path: `${p.user_id}/${p.id}/media/${randomUUID()}.mp4`,
        name: `${src.name.replace(/\.[a-z0-9]+$/i, "")} · ${target === "4k" ? "4K" : "1080p"}`.slice(0, 200),
        mime: "video/mp4",
        bytes: 1,
        duration_ms: src.duration_ms,
        width: size.width,
        height: size.height,
        origin: "generated",
        status: "pending",
        meta: { hasAudio: src.meta?.hasAudio !== false, upscale: meta },
      })
      .select("*")
      .single();
    if (error || !row) throw new Error(`asset row: ${error?.message}`);
    return { asset: await assetView(row as AssetRow), usd: +(UPSCALE_USD_PER_SEC[target] * (src.duration_ms / 1000)).toFixed(2), coins };
  } catch (e) {
    await refund();
    if (e instanceof UserError) throw e;
    console.error("upscale start", e);
    throw new UserError("تعذّر إرسال الفيديو لرفع الدقة. ما انخصم منك شي.", 502);
  }
}

/** Copies a finished file from a link into the project's storage, 16 MB at a time. */
async function copyIn(url: string, bucket: string, path: string, mime: string) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`result download ${res.status}`);
  const b = storage.from(bucket);
  const uploadId = await b.createMultipart(path, mime);
  const parts: { part: number; etag: string }[] = [];
  let buf = new Uint8Array(0);
  let total = 0;
  const send = async (chunk: Uint8Array) => {
    const n = parts.length + 1;
    const [{ url: put }] = await b.signParts(path, uploadId, [n]);
    const r = await fetch(put, { method: "PUT", body: chunk as BodyInit });
    if (!r.ok) throw new Error(`part ${n}: ${r.status}`);
    parts.push({ part: n, etag: r.headers.get("etag") ?? "" });
  };
  try {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (value) {
        const next = new Uint8Array(buf.length + value.length);
        next.set(buf);
        next.set(value, buf.length);
        buf = next;
        total += value.length;
        while (buf.length >= PART) {
          await send(buf.slice(0, PART));
          buf = buf.slice(PART);
        }
      }
      if (done) break;
    }
    if (buf.length || !parts.length) await send(buf);
    await b.completeMultipart(path, uploadId, parts);
    return total;
  } catch (e) {
    await b.abortMultipart(path, uploadId).catch(() => {});
    throw e;
  }
}

/**
 * How far an upscale is: waiting or working at fal, or done (copied in, the file ready in the library), or failed
 * (the coins given back, the waiting file removed). Safe to ask again and again.
 */
export async function checkUpscale(p: EditorProject, b: { id?: unknown }) {
  const row = await sourceRow(p, b.id);
  if (!row) throw new UserError("ما لقينا الملف.", 404);
  if (row.status === "ready") return { state: "done" as const, asset: await assetView(row) };
  const m = row.meta?.upscale as UpscaleMeta | undefined;
  if (!m) throw new UserError("هذا الملف مو رفع دقة.", 400);
  const fail = async (message: string) => {
    if (m.team) await refundTeamCoins(m.ref).catch(() => {});
    else await releaseCoins(p.user_id, m.coins, m.ref, m.label).catch(() => {});
    await db().from("editor_assets").delete().eq("id", row.id);
    return { state: "failed" as const, message };
  };
  // a copy already being made by another check (it takes a while for a big file): wait for it
  const copying = typeof row.meta?.copying === "string" && Date.now() - new Date(row.meta.copying as string).getTime() < 4 * 60_000;
  if (copying) return { state: "saving" as const };

  const st = await fetch(m.statusUrl, { headers: falHeaders() }).catch(() => null);
  if (!st?.ok) {
    // fal unreachable for a long time: given up after 2 hours
    if (Date.now() - new Date(m.startedAt).getTime() > 2 * 3600_000) return fail("رفع الدقة ما خلص في وقته. رجعت لك نقودك.");
    return { state: "waiting" as const };
  }
  const s = (await st.json()) as { status: string; queue_position?: number };
  if (s.status === "IN_QUEUE") return { state: "waiting" as const, position: s.queue_position ?? null };
  if (s.status === "IN_PROGRESS") return { state: "working" as const };
  if (s.status !== "COMPLETED") return fail("المزوّد ما قدر يرفع دقة هذا الفيديو. رجعت لك نقودك.");

  const out = await fetch(m.responseUrl, { headers: falHeaders() });
  const body = (await out.json().catch(() => null)) as { video?: { url?: string; file_size?: number } } | null;
  const url = body?.video?.url;
  if (!out.ok || !url) return fail("المزوّد خلص بس ما رجّع الفيديو. رجعت لك نقودك.");

  // one copy at a time: marked before it starts
  await db().from("editor_assets").update({ meta: { ...row.meta, copying: new Date().toISOString() } }).eq("id", row.id).eq("status", "pending");
  try {
    const bytes = await copyIn(url, row.bucket, row.path, "video/mp4");
    const { meta: _drop, ...rest } = row;
    void _drop;
    const update = { status: "ready" as const, bytes, meta: { hasAudio: row.meta?.hasAudio !== false, upscaledFrom: m.from, target: m.target } };
    await db().from("editor_assets").update(update).eq("id", row.id);
    return { state: "done" as const, asset: await assetView({ ...rest, ...update, meta: update.meta } as AssetRow) };
  } catch (e) {
    console.error("upscale copy", e);
    await db().from("editor_assets").update({ meta: { ...row.meta, copying: null } }).eq("id", row.id);
    return { state: "saving" as const };
  }
}
