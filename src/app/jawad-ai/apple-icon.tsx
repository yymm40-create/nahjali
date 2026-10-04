import sharp from "sharp";
import { logoBytes } from "@/lib/jawad/server/logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const revalidate = 600;

/** Home-screen icon: the logo on JAWAD AI's charcoal (iOS does not keep transparency). */
export default async function AppleIcon() {
  const logo = await sharp(await logoBytes()).resize(150, 150, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const png = await sharp({ create: { width: 180, height: 180, channels: 4, background: "#0b0c0f" } })
    .composite([{ input: logo, left: 15, top: 15 }])
    .png()
    .toBuffer();
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } });
}
