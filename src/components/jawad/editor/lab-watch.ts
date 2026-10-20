// «🎬 مختبر الموشن» · watching حيدرة write: a lab step asked with `watch` answers one JSON object a line (NDJSON) —
// `{"w": "…"}` for each piece of his reply as he writes it, `{}` to keep the line open, and last `{"r": result}` — so
// the conversation shows the program growing line by line. Pure helpers plus the reader.

/** Posts a watched step and calls `onPiece` with every piece written; resolves with the step's result. */
export async function postWatch<T>(url: string, body: Record<string, unknown>, onPiece: (piece: string) => void, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, watch: true }), ...(signal ? { signal } : {}) });
  } catch (e) {
    if (signal?.aborted || (e instanceof Error && e.name === "AbortError")) throw Object.assign(new Error("⏹️ وقّفت الطلب."), { name: "AbortError" });
    throw new Error("تعذّر الاتصال. تأكد من الإنترنت وجرّب مرة ثانية.");
  }
  if (!res.ok || !res.body) {
    const b = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(b.error || `صار خطأ غير متوقع (${res.status}). جرّب مرة ثانية.`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let result: T | undefined;
  const line = (raw: string) => {
    const s = raw.trim();
    if (!s) return;
    let o: { w?: unknown; r?: unknown };
    try {
      o = JSON.parse(s) as { w?: unknown; r?: unknown };
    } catch {
      return;
    }
    if (typeof o.w === "string" && o.w) onPiece(o.w);
    if ("r" in o) result = o.r as T;
  };
  for (;;) {
    const { done, value } = await reader.read().catch((e: unknown) => {
      if (signal?.aborted) throw Object.assign(new Error("⏹️ وقّفت الطلب."), { name: "AbortError" });
      throw e;
    });
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let cut: number;
    while ((cut = buf.indexOf("\n")) >= 0) {
      line(buf.slice(0, cut));
      buf = buf.slice(cut + 1);
    }
  }
  line(buf);
  // the platform ended the request before the answer: nothing arrived (said the same way as a plain step)
  return (result ?? ({} as T)) as T;
}

/**
 * The value of one string field of a JSON object that is still being written («{"code":"scene({\n…»): decoded as far
 * as it goes (escapes included), so the page can show the program while it grows. Empty when the field has not started.
 */
export function partialField(raw: string, field: string): string {
  const m = new RegExp(`"${field}"\\s*:\\s*"`).exec(raw);
  if (!m) return "";
  let out = "";
  for (let i = m.index + m[0].length; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"') return out;
    if (c !== "\\") {
      out += c;
      continue;
    }
    const n = raw[i + 1];
    if (n === undefined) return out;
    i++;
    if (n === "n") out += "\n";
    else if (n === "t") out += "\t";
    else if (n === "r") out += "";
    else if (n === "b" || n === "f") out += "";
    else if (n === "u") {
      const hex = raw.slice(i + 1, i + 5);
      if (hex.length < 4) return out;
      out += String.fromCharCode(parseInt(hex, 16) || 32);
      i += 4;
    } else out += n;
  }
  return out;
}
