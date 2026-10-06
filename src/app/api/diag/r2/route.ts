import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import * as r2 from "@/lib/storage/r2";
import { legacyOn, MIGRATED_MARK } from "@/lib/storage";

// TEMPORARY: checks what the browser can do with R2 (CORS) in production (behind a one-off token).
export const dynamic = "force-dynamic";

const ok = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const ORIGIN = "https://nahjali.vercel.app";

export async function GET(req: Request) {
  const want = process.env.DIAG_TOKEN ?? "";
  const got = new URL(req.url).searchParams.get("token") ?? "";
  if (!want || !ok(want, got)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const out: Record<string, unknown> = {};
  const key = `_diag/${Date.now()}.txt`;
  try {
    await r2.putObject(key, "hello", "text/plain");
    out.mark = Boolean(await r2.headObject(MIGRATED_MARK));
    out.legacyOn = await legacyOn();
    const getUrl = await r2.presignGet(key, 300);
    const putUrl = await r2.presignPut(`_diag/${Date.now()}-put.txt`, 300);
    const pick = (r: Response) => Object.fromEntries([...r.headers].filter(([k]) => k.startsWith("access-control")));
    const g = await fetch(getUrl, { headers: { Origin: ORIGIN } });
    out.get = { status: g.status, cors: pick(g) };
    const pre = await fetch(putUrl, { method: "OPTIONS", headers: { Origin: ORIGIN, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type" } });
    out.putPreflight = { status: pre.status, cors: pick(pre) };
    const preGet = await fetch(getUrl, { method: "OPTIONS", headers: { Origin: ORIGIN, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "range" } });
    out.getPreflight = { status: preGet.status, cors: pick(preGet) };
    await r2.deleteObject(key).catch(() => null);
  } catch (e) {
    out.error = String((e as Error)?.message ?? e).slice(0, 400);
  }
  return NextResponse.json(out);
}
