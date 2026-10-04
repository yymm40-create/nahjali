// BROWSER ONLY. Photos and short videos of the community: checked here first (type, size, length), then uploaded
// straight to storage with a one-time link, reporting progress. The server checks everything again.
import { t } from "../i18n";
import { mahdiFetch } from "./fetch";
import { shrinkImage } from "./reading";

export const VIDEO_MAX_SEC = 30;
const MAX_BYTES = 50 * 1024 * 1024;

/** The length of a video file in seconds (0 when the browser cannot read it). */
export function videoSeconds(file: File): Promise<number> {
  return new Promise((res) => {
    const v = document.createElement("video");
    const url = URL.createObjectURL(file);
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      res(Number.isFinite(v.duration) ? v.duration : 0);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      res(0);
    };
    v.src = url;
  });
}

/** A problem with a chosen file, or null. */
export async function checkMediaFile(file: File, kind: "image" | "video"): Promise<string | null> {
  const M = t.social.media;
  if (file.size > MAX_BYTES) return M.tooBig;
  if (kind === "image") return file.type.startsWith("image/") ? null : M.badType;
  if (!/^video\/(mp4|quicktime)$/.test(file.type) && !/\.(mp4|mov)$/i.test(file.name)) return M.badType;
  const sec = await videoSeconds(file);
  return sec > VIDEO_MAX_SEC + 0.5 ? M.tooLong : null;
}

/** Uploads one photo (made smaller as a JPEG first) or video; returns the stored path for the post or story. */
export async function uploadMedia(file: File, kind: "image" | "video", onProgress: (pct: number) => void): Promise<string> {
  const body: Blob = kind === "image" ? await shrinkImage(file, 2000) : file;
  const { path, token } = await mahdiFetch<{ path: string; token: string }>("/api/mahdi/social/media", { method: "POST", json: { kind, size: body.size } });
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/upload/sign/mahdi-media/${path}?token=${encodeURIComponent(token)}`;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
    xhr.setRequestHeader("content-type", kind === "image" ? "image/jpeg" : file.type === "video/quicktime" ? "video/quicktime" : "video/mp4");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(t.social.media.failed)));
    xhr.onerror = () => reject(new Error(t.social.media.failed));
    xhr.send(body);
  });
  return path;
}
