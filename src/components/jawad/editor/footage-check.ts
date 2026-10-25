// «مختبر الموشن» on the person's video: is the file there at all? A file kept on the computer (haidara-media://) that was
// moved or deleted, or a link that stopped opening, is not a bug in the scene, so حيدرا ماكس must not be asked to "fix" it.

/** A step of getting the video ready failed: nothing in the scene can fix it, so حيدرا ماكس is not asked to (the message says what to do). */
export class LabSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LabSetupError";
  }
}

/** The video cannot be opened (missing or no longer served). */
export class FootageUnavailable extends LabSetupError {
  constructor(url: string, status?: number) {
    super(
      url.startsWith("haidara-media:")
        ? "ما لقيت فيديوك على جهازك: الملف انتقل أو انحذف من مكانه، أو هذا الفيديو انضاف من جهاز ثاني. أضفه للمكتبة من جديد ثم جرّب."
        : `رابط الفيديو ما عاد يفتح${status ? ` (${status})` : ""}. أعد رفعه للمكتبة ثم جرّب.`,
    );
    this.name = "FootageUnavailable";
  }
}

/**
 * The whole of a file kept on the computer, read the way the decoder reads it: in ranges (one request for the whole
 * file at once fails in the desktop program on a large video — «Failed to fetch»). `onPart` hears how far it is.
 */
export async function readLocalFile(url: string, onPart?: (done: number, total: number) => void, part = 8 * 1024 * 1024): Promise<Blob> {
  const first = await fetch(url, { headers: { Range: "bytes=0-0" } });
  if (!first.ok) throw new FootageUnavailable(url, first.status);
  const total = Number(/\/(\d+)$/.exec(first.headers.get("Content-Range") ?? "")?.[1] ?? first.headers.get("Content-Length") ?? 0);
  const type = first.headers.get("Content-Type")?.split(";")[0] || "video/mp4";
  void first.body?.cancel().catch(() => undefined);
  if (!(total > 0)) throw new Error("ما عرفت حجم الفيديو على الجهاز.");
  const parts: ArrayBuffer[] = [];
  for (let at = 0; at < total; at += part) {
    const end = Math.min(total - 1, at + part - 1);
    let res: Response | null = null;
    for (let tries = 0; tries < 3 && !res; tries++) {
      res = await fetch(url, { headers: { Range: `bytes=${at}-${end}` } }).catch(() => null);
      if (res && !res.ok) res = null;
    }
    if (!res) throw new Error(`ما قدرت أقرأ الجزء ${Math.round(at / 1_048_576)} ميغا من الفيديو على الجهاز.`);
    parts.push(await res.arrayBuffer());
    onPart?.(end + 1, total);
  }
  return new Blob(parts, { type });
}

/** A video kept on the computer by the desktop program (it never reaches the server: no cut-out, no upscale). */
export const onDeviceOnly = (url: string) => url.startsWith("haidara-media:");

/** Asks for the first byte of the file: a missing file is refused here, before anything is planned or written. */
export async function checkFootage(url: string, signal?: AbortSignal): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Range: "bytes=0-0" }, signal });
  } catch (e) {
    // offline or blocked: the steps after this report it in their own words
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    return;
  }
  void res.body?.cancel().catch(() => undefined);
  if (res.status === 404 || res.status === 410 || res.status === 403) throw new FootageUnavailable(url, res.status);
}
