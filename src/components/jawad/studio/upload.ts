// JAWAD AI — browser side of a reference upload: check the bytes, ask for a one-time URL, upload with progress,
// then let the server check the stored file (the check that counts).
import type { RefKind } from "@config/jawad/types";
import { MAX_UPLOAD_BYTES, sniff, UPLOAD_MIMES } from "@/lib/jawad/media";

export interface LocalProbe {
  mime: string;
  kind: RefKind;
  width: number | null;
  height: number | null;
  durationMs: number | null;
}

const KIND_AR: Record<RefKind, string> = { image: "صورة", video: "فيديو", audio: "صوت" };

/** Reads what the file really is (first bytes) and its pixels / duration from the browser's own decoder. */
export async function probeFile(file: File, expected?: RefKind): Promise<LocalProbe> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("حجم الملف أكبر من ٥٠ ميجا.");
  const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const s = sniff(head);
  if (!s || !UPLOAD_MIMES[s.mime]) throw new Error("نوع الملف غير مقبول (المقبول: PNG/JPG/WEBP، MP4/MOV، MP3/WAV).");
  if (expected && s.kind !== expected) throw new Error(`هذا الملف ${KIND_AR[s.kind]} وليس ${KIND_AR[expected]}.`);
  const url = URL.createObjectURL(file);
  try {
    if (s.kind === "image") {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { mime: s.mime, kind: s.kind, width: img.naturalWidth, height: img.naturalHeight, durationMs: null };
    }
    const el = document.createElement(s.kind === "video" ? "video" : "audio");
    el.preload = "metadata";
    el.muted = true;
    el.src = url;
    await new Promise<void>((ok, fail) => {
      el.onloadedmetadata = () => ok();
      el.onerror = () => fail(new Error("تعذّر قراءة الملف؛ قد يكون تالفًا أو بترميز غير مدعوم في المتصفح."));
      setTimeout(() => fail(new Error("تعذّر قراءة الملف في الوقت المتوقع.")), 15_000);
    });
    const v = el as HTMLVideoElement;
    return {
      mime: s.mime,
      kind: s.kind,
      width: s.kind === "video" ? v.videoWidth || null : null,
      height: s.kind === "video" ? v.videoHeight || null : null,
      durationMs: Number.isFinite(el.duration) ? Math.round(el.duration * 1000) : null,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** PUT to the one-time URL with progress (0–1). */
export function putWithProgress(signedUrl: string, file: File, mime: string, onProgress: (p: number) => void) {
  return new Promise<void>((ok, fail) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("content-type", mime);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? ok() : fail(new Error(`تعذّر رفع الملف (${xhr.status}).`)));
    xhr.onerror = () => fail(new Error("انقطع الاتصال أثناء الرفع."));
    xhr.send(file);
  });
}

/** An image (a picture the person made in the browser, or chose) stored as a checked reference of theirs. */
export async function uploadImage(file: File): Promise<import("./types").UploadView> {
  const probe = await probeFile(file, "image");
  const post = async <T,>(url: string, data: unknown) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), cache: "no-store" });
    return { ok: res.ok, body: (await res.json().catch(() => ({}))) as T & { error?: string } };
  };
  const signed = await post<{ id: string; signedUrl: string }>("/api/jawad/uploads", { kind: "image", mime: probe.mime, bytes: file.size, fileName: file.name });
  if (!signed.ok) throw new Error(signed.body.error ?? "تعذّر بدء الرفع.");
  await putWithProgress(signed.body.signedUrl, file, probe.mime, () => {});
  const conf = await post<{ upload: import("./types").UploadView }>("/api/jawad/uploads/confirm", { id: signed.body.id });
  if (!conf.ok || conf.body.upload?.status !== "ready") throw new Error(conf.body.error ?? conf.body.upload?.error ?? "تعذّر فحص الصورة.");
  return conf.body.upload;
}
