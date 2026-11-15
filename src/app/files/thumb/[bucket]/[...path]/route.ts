import sharp from "sharp";
import { storage } from "@/lib/storage";
import { getObject } from "@/lib/storage/r2";
import { THUMB_BUCKETS, THUMB_WIDTHS } from "@/lib/storage/public";

export const runtime = "nodejs";

// «الصفحة الرئيسية أسرع» (14 November 2026, Vercel's React/Next performance rules): the sample pictures of the front page
// and the studio's generator cards were sent whole — PNGs of 1–3 MB behind a signed link that no browser or CDN could
// keep (12 MB for the front page on a phone). Here one is made ONCE into a small WebP of the width asked for and kept by
// Vercel's CDN for a year: a sample's path never changes (a new sample is a new file name), so it can be kept for good.
const MAX_INPUT = 30 * 1024 * 1024;
const IMAGE = /\.(png|jpe?g|webp)$/i;

export async function GET(req: Request, { params }: { params: Promise<{ bucket: string; path: string[] }> }) {
  const { bucket, path: parts } = await params;
  const path = parts.map(decodeURIComponent).join("/");
  const w = Number(new URL(req.url).searchParams.get("w") ?? 480);
  const notFound = () => new Response("Not found", { status: 404, headers: { "cache-control": "public, max-age=60" } });
  if (!(THUMB_BUCKETS as readonly string[]).includes(bucket) || !IMAGE.test(path) || parts.some((p) => p === ".." || p === ".")) return notFound();
  if (!(THUMB_WIDTHS as readonly number[]).includes(w)) return new Response("Bad width", { status: 400 });

  const blob = (await getObject(`${bucket}/${path}`).catch(() => null)) ?? (await storage.from(bucket).download(path)).data;
  if (!blob) return notFound();
  if (blob.size > MAX_INPUT) return new Response("Too large", { status: 413 });
  try {
    const out = await sharp(Buffer.from(await blob.arrayBuffer()), { limitInputPixels: 80_000_000 })
      .rotate()
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 74, effort: 4 })
      .toBuffer();
    return new Response(new Uint8Array(out), {
      headers: { "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable", "cdn-cache-control": "public, max-age=31536000, immutable" },
    });
  } catch (e) {
    console.error("thumb failed", bucket, path, e);
    return notFound();
  }
}
