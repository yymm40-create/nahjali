import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import * as r2 from "@/lib/storage/r2";

// TEMPORARY: checks the server's own writes to R2 in production (behind a one-off token set by the owner's helper).
export const dynamic = "force-dynamic";

const ok = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function GET(req: Request) {
  const want = process.env.DIAG_TOKEN ?? "";
  const got = new URL(req.url).searchParams.get("token") ?? "";
  if (!want || !ok(want, got)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const key = `_diag/${Date.now()}`;
  // what the keys can see (bucket names are not secrets; the account id is shown masked)
  const env = (n: string) => (process.env[n] ?? "").trim();
  const acct = env("R2_ACCOUNT_ID");
  const bucket = process.env.R2_BUCKET ?? "";
  const { AwsClient } = await import("aws4fetch");
  const aws = new AwsClient({ accessKeyId: env("R2_ACCESS_KEY_ID"), secretAccessKey: env("R2_SECRET_ACCESS_KEY"), service: "s3", region: "auto" });
  const list = await aws.fetch(`https://${acct}.r2.cloudflarestorage.com/`).catch((e) => e as Error);
  const listed = list instanceof Response ? { status: list.status, buckets: [...(await list.text()).matchAll(/<Name>([^<]*)<\/Name>/g)].map((m) => m[1]) } : { error: String(list) };
  const out: Record<string, unknown> = {
    node: process.version,
    bucket: JSON.stringify(bucket),
    bucketLength: bucket.length,
    account: acct ? `${acct.slice(0, 4)}…${acct.slice(-4)} (${acct.length})` : "missing",
    accountHasSpaces: (process.env.R2_ACCOUNT_ID ?? "") !== acct,
    listed,
  };
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      out[name] = { ok: true, value: await fn() };
    } catch (e) {
      out[name] = { ok: false, error: String((e as Error)?.message ?? e).slice(0, 600) };
    }
  };
  await step("putBuffer", () => r2.putObject(`${key}-a.png`, Buffer.from([137, 80, 78, 71, 1, 2, 3]), "image/png"));
  await step("putBufferIfNew", () => r2.putObject(`${key}-b.png`, Buffer.from([1, 2, 3]), "image/png", true));
  await step("putUint8", () => r2.putObject(`${key}-c.bin`, new Uint8Array([1, 2, 3]), "application/octet-stream"));
  await step("putString", () => r2.putObject(`${key}-d.txt`, "hello", "text/plain"));
  await step("putBlob", () => r2.putObject(`${key}-e.bin`, new Blob([new Uint8Array([4, 5])]), "application/octet-stream"));
  await step("head", () => r2.headObject(`${key}-a.png`));
  for (const s of ["a.png", "b.png", "c.bin", "d.txt", "e.bin"]) await r2.deleteObject(`${key}-${s}`).catch(() => null);
  return NextResponse.json(out);
}
