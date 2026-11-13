// «الجواد في كلاود وشات جي بي تي» · bringing a file in from a link (a file the person gave ChatGPT, or any public link).
// Server only. Only public addresses on the internet: never the server's own network (localhost, private ranges, the
// cloud's metadata address), checked again at every redirect.

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { UserError } from "@/lib/api";

/** What a connector may bring in at once (a big video is better uploaded on the page). */
export const LINK_MAX_BYTES = 100 * 1024 * 1024;

export function privateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x.startsWith("::ffff:")) return privateAddress(x.slice(7));
    return x === "::" || x === "::1" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe8") || x.startsWith("fe9") || x.startsWith("fea") || x.startsWith("feb") || x.startsWith("ff");
  }
  return true;
}

async function checkHost(u: URL) {
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new UserError("الرابط لازم يبدأ بـ https.", 400);
  if (u.username || u.password) throw new UserError("رابط غير مقبول.", 400);
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new UserError("ما قدرنا نوصل لهذا الرابط.", 400);
  if (addrs.some((a) => privateAddress(a.address))) throw new UserError("رابط غير مقبول.", 400);
}

/** The bytes at `url` (up to LINK_MAX_BYTES), and a file name for them. */
export async function downloadPublic(url: string, signal?: AbortSignal): Promise<{ bytes: Uint8Array; name: string }> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new UserError("الرابط غير صحيح.", 400);
  }
  let res: Response | null = null;
  for (let hop = 0; hop < 4; hop++) {
    await checkHost(u);
    res = await fetch(u, { redirect: "manual", signal: signal ?? AbortSignal.timeout(120_000), headers: { "user-agent": "JAWAD-AI-connector/1.0" } }).catch(() => null);
    if (!res) throw new UserError("ما قدرنا نحمّل الملف من الرابط.", 400);
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      u = new URL(res.headers.get("location")!, u);
      continue;
    }
    break;
  }
  if (!res || !res.ok || !res.body) throw new UserError(`الرابط ما رجّع ملف (${res?.status ?? "?"}).`, 400);
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > LINK_MAX_BYTES) throw new UserError("الملف أكبر من ١٠٠ ميجا: ارفعه من صفحة الرفع بدل الرابط.", 400);
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > LINK_MAX_BYTES) {
      await reader.cancel().catch(() => {});
      throw new UserError("الملف أكبر من ١٠٠ ميجا: ارفعه من صفحة الرفع بدل الرابط.", 400);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.length;
  }
  const fromHeader = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(res.headers.get("content-disposition") ?? "")?.[1];
  const raw = fromHeader ?? u.pathname.split("/").pop() ?? "";
  let name = raw;
  try {
    name = decodeURIComponent(raw);
  } catch {
    // a malformed name: kept as it came
  }
  name ||= "ملف";
  return { bytes, name: name.slice(0, 200) };
}
