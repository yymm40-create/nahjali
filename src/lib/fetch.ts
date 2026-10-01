/** POST/GET JSON to our API; throws an Error carrying the Arabic message from the server. */
export async function api<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", ...init });
  } catch {
    throw new Error("تعذّر الاتصال. تأكد من الإنترنت وجرّب مرة ثانية.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "صار خطأ غير متوقع. جرّب مرة ثانية.");
  return body as T;
}

export const postJson = <T = unknown>(url: string, data: unknown = {}) =>
  api<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
