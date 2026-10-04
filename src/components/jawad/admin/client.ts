// JAWAD AI admin — browser helpers.
import { putWithProgress } from "../studio/upload";

export async function adminPost<T = { ok: true }>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api/jawad/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...data }) });
  } catch {
    throw new Error("تعذّر الاتصال. تأكد من الإنترنت وجرّب مرة ثانية.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "صار خطأ غير متوقع.");
  return body as T;
}

/** Uploads an owner file to the public bucket and returns its path (the server checks it when it is applied). */
export async function uploadPublic(purpose: "logo" | "ad_media" | "ad_poster" | "sample", target: string, file: File | Blob, onProgress?: (p: number) => void) {
  const mime = file.type;
  const { path, signedUrl } = await adminPost<{ path: string; signedUrl: string }>("sign", { purpose, target, mime, bytes: file.size });
  await putWithProgress(signedUrl, file as File, mime, onProgress ?? (() => {}));
  return path;
}

/** A cover picture taken from a video (about one second in), as a JPEG. */
export async function captureFrame(src: string | File, at = 1): Promise<Blob> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  try {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.muted = true;
    v.preload = "auto";
    v.src = url;
    await new Promise<void>((ok, fail) => {
      v.onloadeddata = () => ok();
      v.onerror = () => fail(new Error("تعذّر فتح الفيديو."));
    });
    v.currentTime = Math.min(at, Math.max(0, (v.duration || 1) / 2));
    await new Promise<void>((ok) => (v.onseeked = () => ok()));
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    return await new Promise<Blob>((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("تعذّر التقاط الصورة."))), "image/jpeg", 0.88));
  } finally {
    if (typeof src !== "string") URL.revokeObjectURL(url);
  }
}
