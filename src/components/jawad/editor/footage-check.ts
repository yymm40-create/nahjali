// «مختبر الموشن» on the person's video: is the file there at all? A file kept on the computer (haidara-media://) that was
// moved or deleted, or a link that stopped opening, is not a bug in the scene, so حيدرة must not be asked to "fix" it.

/** The video cannot be opened (missing or no longer served); the message says what to do. */
export class FootageUnavailable extends Error {
  constructor(url: string, status?: number) {
    super(
      url.startsWith("haidara-media:")
        ? "ما لقيت فيديوك على جهازك: الملف انتقل أو انحذف من مكانه، أو هذا الفيديو انضاف من جهاز ثاني. أضفه للمكتبة من جديد ثم جرّب."
        : `رابط الفيديو ما عاد يفتح${status ? ` (${status})` : ""}. أعد رفعه للمكتبة ثم جرّب.`,
    );
    this.name = "FootageUnavailable";
  }
}

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
