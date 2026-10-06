import { PUBLIC_BUCKETS, storage } from "@/lib/storage";
import { getObject } from "@/lib/storage/r2";

// Small pictures (avatars, covers, shrines) are sent from here and kept by Vercel's CDN;
// «jawad-public» (ads, voice samples, logos; some are videos) goes straight to R2 with a signed link.
const STREAMED = new Set<string>(["mahdi-avatars", "mahdi-book-covers", "mahdi-shrines"]);

/** The files of the old public Supabase buckets, at /files/<bucket>/<path>. */
export async function GET(_req: Request, { params }: { params: Promise<{ bucket: string; path: string[] }> }) {
  const { bucket, path: parts } = await params;
  const path = parts.map(decodeURIComponent).join("/");
  if (!(PUBLIC_BUCKETS as readonly string[]).includes(bucket) || !path || parts.some((p) => p === ".." || p === ".")) return new Response("Not found", { status: 404 });
  const key = `${bucket}/${path}`;

  if (!STREAMED.has(bucket)) {
    const { data } = await storage.from(bucket).createSignedUrl(path, 7 * 24 * 3600);
    if (!data) return new Response("Not found", { status: 404 });
    return new Response(null, { status: 302, headers: { location: data.signedUrl, "cache-control": "public, max-age=3600" } });
  }

  const blob = (await getObject(key).catch(() => null)) ?? (await storage.from(bucket).download(path)).data;
  if (!blob) return new Response("Not found", { status: 404, headers: { "cache-control": "public, max-age=60" } });
  return new Response(blob, {
    headers: { "content-type": blob.type || "application/octet-stream", "cache-control": "public, max-age=86400, s-maxage=604800" },
  });
}
