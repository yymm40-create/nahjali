// JAWAD AI — the logo's bytes for icons and share images: the owner's uploaded logo, or the shipped one. Server only.
import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { loadRuntime } from "./runtime";

export async function logoBytes(): Promise<Buffer> {
  // Never fails: without the database (e.g. while building) the shipped logo is used
  const rt = await loadRuntime().catch(() => null);
  if (rt?.brand.customLogo) {
    const res = await fetch(rt.brand.logoUrl, { cache: "no-store" }).catch(() => null);
    if (res?.ok) return Buffer.from(await res.arrayBuffer());
  }
  return readFile(path.join(process.cwd(), "public/jawad-ai/logo.png"));
}

/** A square PNG of the logo on a transparent background. */
export async function logoPng(size: number) {
  return sharp(await logoBytes())
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}
