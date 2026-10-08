/** POST/GET JSON to our API; throws an Error carrying the Arabic message from the server. */
export async function api<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", ...init });
  } catch (e) {
    // stopped by the person (an AbortController): said as such, not as a network failure
    if (init?.signal?.aborted || (e instanceof Error && e.name === "AbortError")) throw Object.assign(new Error("⏹️ وقّفت الطلب."), { name: "AbortError" });
    throw new Error("تعذّر الاتصال. تأكد من الإنترنت وجرّب مرة ثانية.");
  }
  const body = await res.json().catch(() => ({}));
  if (init?.signal?.aborted) throw Object.assign(new Error("⏹️ وقّفت الطلب."), { name: "AbortError" });
  if (!res.ok) {
    if (body.error) throw new Error(body.error);
    // no message from us: the server's time ran out, or it couldn't answer (said plainly, with its code)
    if (res.status === 504 || res.status === 408) throw new Error(`العملية أخذت وقت أطول من حد الخادم (${res.status}). جرّب على جزء أقصر.`);
    if (res.status === 413) throw new Error("الملف أكبر من المسموح للخادم (413).");
    throw new Error(`صار خطأ غير متوقع (${res.status}). جرّب مرة ثانية.`);
  }
  return body as T;
}

export const postJson = <T = unknown>(url: string, data: unknown = {}, signal?: AbortSignal) =>
  api<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), ...(signal ? { signal } : {}) });
