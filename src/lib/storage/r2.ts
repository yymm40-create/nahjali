// SERVER ONLY. The site's files live in one Cloudflare R2 bucket (env R2_*), each old Supabase
// bucket as a top folder: «film/abc.png» in Supabase's «film» bucket is «film/abc.png» here.
import { AwsClient } from "aws4fetch";

let client: AwsClient | null = null;

function r2() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) throw new Error("R2 is not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)");
  client ??= new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID.trim(), secretAccessKey: R2_SECRET_ACCESS_KEY.trim(), service: "s3", region: "auto" });
  // R2_ENDPOINT only for tests against a local S3 server
  const endpoint = process.env.R2_ENDPOINT ?? `https://${R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com`;
  return { client, base: `${endpoint}/${encodeURIComponent(R2_BUCKET.trim())}` };
}

const encodeKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");
const objectUrl = (key: string) => `${r2().base}/${encodeKey(key)}`;

export class R2Error extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function send(url: string, init: RequestInit = {}) {
  const res = await r2().client.fetch(url, init);
  if (!res.ok && res.status !== 404) throw new R2Error(`R2 ${init.method ?? "GET"} ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`, res.status);
  return res;
}

export type Body = Blob | ArrayBuffer | ArrayBufferView | string | ReadableStream;

/** Saves one file; with `ifNew` it fails (412) when the key is already taken. */
export async function putObject(key: string, body: Body, contentType?: string, ifNew = false, cacheSeconds?: string) {
  const headers: Record<string, string> = {};
  if (contentType) headers["content-type"] = contentType;
  if (cacheSeconds) headers["cache-control"] = `max-age=${cacheSeconds}`;
  if (ifNew) headers["if-none-match"] = "*";
  const data = body instanceof Blob ? await body.arrayBuffer() : body;
  const res = await send(objectUrl(key), { method: "PUT", headers, body: data as BodyInit });
  if (res.status === 404) throw new R2Error("R2 bucket not found", 404);
}

/** The file, or null when it is not there. */
export async function getObject(key: string): Promise<Blob | null> {
  const res = await send(objectUrl(key));
  if (res.status === 404) return null;
  const type = res.headers.get("content-type") ?? undefined;
  return new Blob([await res.arrayBuffer()], type ? { type } : undefined);
}

export async function headObject(key: string): Promise<{ size: number; mimetype: string; lastModified: string } | null> {
  const res = await send(objectUrl(key), { method: "HEAD" });
  if (res.status === 404) return null;
  return {
    size: Number(res.headers.get("content-length") ?? 0),
    mimetype: res.headers.get("content-type") ?? "application/octet-stream",
    lastModified: new Date(res.headers.get("last-modified") ?? Date.now()).toISOString(),
  };
}

export async function deleteObject(key: string) {
  await send(objectUrl(key), { method: "DELETE" });
}

/** Server-side copy; false when the source is not there. */
export async function copyObject(from: string, to: string) {
  const res = await send(objectUrl(to), { method: "PUT", headers: { "x-amz-copy-source": `/${encodeURIComponent(process.env.R2_BUCKET!.trim())}/${encodeKey(from)}` } });
  return res.status !== 404;
}

export interface ListedObject {
  key: string;
  size: number;
  lastModified: string;
}

const unxml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1];

/** One folder level under `prefix` (which ends with «/»): its files and its sub-folders. */
export async function listObjects(prefix: string, max = 1000): Promise<{ files: ListedObject[]; folders: string[] }> {
  const files: ListedObject[] = [];
  const folders: string[] = [];
  let token: string | undefined;
  do {
    const url = new URL(r2().base);
    url.searchParams.set("list-type", "2");
    url.searchParams.set("prefix", prefix);
    url.searchParams.set("delimiter", "/");
    url.searchParams.set("max-keys", String(Math.min(1000, max - files.length)));
    if (token) url.searchParams.set("continuation-token", token);
    const xml = await (await send(url.toString())).text();
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      files.push({ key: unxml(tag(m[1], "Key") ?? ""), size: Number(tag(m[1], "Size") ?? 0), lastModified: tag(m[1], "LastModified") ?? "" });
    }
    for (const m of xml.matchAll(/<CommonPrefixes>([\s\S]*?)<\/CommonPrefixes>/g)) folders.push(unxml(tag(m[1], "Prefix") ?? ""));
    token = tag(xml, "IsTruncated") === "true" ? unxml(tag(xml, "NextContinuationToken") ?? "") : undefined;
  } while (token && files.length < max);
  return { files, folders };
}

/** A link that reads the file for `expiresIn` seconds (R2 allows up to 7 days). */
export async function presignGet(key: string, expiresIn: number, download?: string | boolean) {
  const url = new URL(objectUrl(key));
  url.searchParams.set("X-Amz-Expires", String(Math.max(1, Math.min(604800, Math.round(expiresIn)))));
  if (download) {
    const name = typeof download === "string" ? download : key.split("/").pop()!;
    url.searchParams.set("response-content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
  }
  return (await r2().client.sign(url.toString(), { method: "GET", aws: { signQuery: true } })).url;
}

/** A link the browser PUTs one file to (2 hours, like Supabase's upload links). */
export async function presignPut(key: string, expiresIn = 7200) {
  const url = new URL(objectUrl(key));
  url.searchParams.set("X-Amz-Expires", String(expiresIn));
  return (await r2().client.sign(url.toString(), { method: "PUT", aws: { signQuery: true } })).url;
}
