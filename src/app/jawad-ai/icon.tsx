import { logoPng } from "@/lib/jawad/server/logo";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";
// Follows the logo uploaded from the admin page
export const revalidate = 600;

/** JAWAD AI's browser-tab icon (the whole site's too, see src/app/icon.tsx). */
export default async function Icon() {
  return new Response(new Uint8Array(await logoPng(64)), { headers: { "Content-Type": "image/png" } });
}
