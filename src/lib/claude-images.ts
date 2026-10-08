// Pictures for Claude, made to fit. Claude refuses a picture over 5 MB or 8000 px on a side (and looks at no more
// than about 1568 px anyway), and a picture sent by link must be one Anthropic can fetch. So every picture sent by
// link is fetched here first and sent inside the request: as it is when it already fits, otherwise made smaller
// (PNG kept for a picture with transparency, like a cut-out logo). A picture that can't be fetched is left as a link.
// Server only.

import sharp from "sharp";

/** the long side Claude reads at; anything larger is made this size */
const SIDE = 1568;
/** under Claude's 5 MB per picture, with room for base64 */
const BYTES = 3_700_000;
const AS_IS = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

type Block = Record<string, unknown>;

async function fit(url: string): Promise<Block | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const meta = await sharp(buf, { failOn: "none" }).metadata();
    const type = meta.format === "jpeg" ? "image/jpeg" : `image/${meta.format}`;
    const side = Math.max(meta.width ?? 0, meta.height ?? 0);
    if (AS_IS.has(type) && buf.length <= BYTES && side > 0 && side <= SIDE && (meta.pages ?? 1) === 1) {
      return { type: "image", source: { type: "base64", media_type: type, data: buf.toString("base64") } };
    }
    const img = sharp(buf, { failOn: "none" }).rotate().resize({ width: SIDE, height: SIDE, fit: "inside", withoutEnlargement: true });
    let out = meta.hasAlpha ? await img.png({ compressionLevel: 9 }).toBuffer() : await img.jpeg({ quality: 85 }).toBuffer();
    let media = meta.hasAlpha ? "image/png" : "image/jpeg";
    if (out.length > BYTES) {
      out = await sharp(out).flatten({ background: "#ffffff" }).jpeg({ quality: 80 }).toBuffer();
      media = "image/jpeg";
    }
    return { type: "image", source: { type: "base64", media_type: media, data: out.toString("base64") } };
  } catch {
    return null;
  }
}

/** The request's messages with every picture sent by link fetched and made to fit (in place of the link). */
export async function fitImages<M extends { content: unknown }>(messages: M[]): Promise<M[]> {
  const jobs: Promise<void>[] = [];
  for (const m of messages) {
    if (!Array.isArray(m.content)) continue;
    (m.content as Block[]).forEach((b, i, arr) => {
      const src = b.type === "image" ? (b.source as { type?: string; url?: string } | undefined) : undefined;
      if (src?.type !== "url" || !src.url) return;
      jobs.push(
        fit(src.url).then((f) => {
          if (f) arr[i] = { ...f, ...(b.cache_control ? { cache_control: b.cache_control } : {}) };
        }),
      );
    });
  }
  await Promise.all(jobs);
  return messages;
}
