// SERVER ONLY. The files of every section, in Cloudflare R2, behind the same calls the code used with
// Supabase Storage (`storage.from(bucket).upload(...)` and friends, same { data, error } results).
//
// Files saved before the move are still in Supabase until the owner runs the copy in /admin/storage;
// until then a file missing in R2 is read from Supabase. When the copy finishes it writes MIGRATED_MARK
// and Supabase is not asked again.
import { createClient } from "@supabase/supabase-js";
import * as r2 from "./r2";
import { publicFileUrl } from "./public";

export { publicFileUrl };

/** Old public Supabase buckets: their files are served at /files/<bucket>/<path>. */
export const PUBLIC_BUCKETS = ["mahdi-avatars", "mahdi-book-covers", "mahdi-shrines", "jawad-public"] as const;
/** Every bucket the site has used, for the copy from Supabase. */
export const ALL_BUCKETS = ["sources", "generated", "booklets", "film", "jawad", "student", "editor", "mahdi-book-files", "mahdi-media", ...PUBLIC_BUCKETS] as const;
export const MIGRATED_MARK = "_meta/supabase-migrated";

const legacyDb = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }).storage;

let legacy: { on: boolean; at: number } | null = null;
/** True while old files may still be only in Supabase. */
export async function legacyOn() {
  if (legacy && Date.now() - legacy.at < 5 * 60_000) return legacy.on;
  const on = !(await r2.headObject(MIGRATED_MARK).catch(() => null)) && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  legacy = { on, at: Date.now() };
  return on;
}
export function resetLegacyCache() {
  legacy = null;
}

export interface StorageError {
  message: string;
  statusCode?: string;
}
type Result<T> = { data: T; error: null } | { data: null; error: StorageError };

const ok = <T>(data: T): Result<T> => ({ data, error: null });
const fail = (e: unknown, statusCode?: string): { data: null; error: StorageError } => ({
  data: null,
  error: { message: e instanceof Error ? e.message : String(e), statusCode: statusCode ?? (e instanceof r2.R2Error ? String(e.status) : undefined) },
});

const clean = (path: string) => path.replace(/^\/+/, "");

export interface FileObject {
  name: string;
  id: string | null;
  created_at: string | null;
  updated_at: string | null;
  metadata: { size: number; mimetype?: string } | null;
}

interface ListOptions {
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: { column: "name" | "created_at" | "updated_at"; order?: "asc" | "desc" };
}

class Bucket {
  constructor(readonly bucket: string) {}

  private key(path: string) {
    return `${this.bucket}/${clean(path)}`;
  }

  async upload(path: string, body: r2.Body, opts: { contentType?: string; upsert?: boolean; cacheControl?: string } = {}): Promise<Result<{ path: string; id: string; fullPath: string }>> {
    try {
      const contentType = opts.contentType ?? (body instanceof Blob && body.type ? body.type : undefined);
      await r2.putObject(this.key(path), body, contentType, !opts.upsert, opts.cacheControl);
      return ok({ path: clean(path), id: this.key(path), fullPath: this.key(path) });
    } catch (e) {
      // Same answer as Supabase when the name is taken
      if (e instanceof r2.R2Error && e.status === 412) return fail(new Error("The resource already exists"), "409");
      return fail(e);
    }
  }

  async download(path: string): Promise<Result<Blob>> {
    try {
      const blob = await r2.getObject(this.key(path));
      if (blob) return ok(blob);
      if (await legacyOn()) {
        const old = await legacyDb().from(this.bucket).download(clean(path));
        if (old.data) return ok(old.data);
      }
      return fail(new Error("Object not found"), "404");
    } catch (e) {
      return fail(e);
    }
  }

  async remove(paths: string[]): Promise<Result<{ name: string }[]>> {
    try {
      for (let i = 0; i < paths.length; i += 20) await Promise.all(paths.slice(i, i + 20).map((p) => r2.deleteObject(this.key(p))));
      if (paths.length && (await legacyOn())) await legacyDb().from(this.bucket).remove(paths.map(clean)).catch(() => null);
      return ok(paths.map((p) => ({ name: clean(p) })));
    } catch (e) {
      return fail(e);
    }
  }

  async copy(from: string, to: string): Promise<Result<{ path: string }>> {
    try {
      if (!(await r2.copyObject(this.key(from), this.key(to)))) {
        const old = (await legacyOn()) ? await legacyDb().from(this.bucket).download(clean(from)) : null;
        if (!old?.data) return fail(new Error("Object not found"), "404");
        await r2.putObject(this.key(to), old.data, old.data.type || undefined);
      }
      return ok({ path: clean(to) });
    } catch (e) {
      return fail(e);
    }
  }

  /** One folder's files, like Supabase: `search` keeps the names that start with it. */
  async list(dir = "", opts: ListOptions = {}): Promise<Result<FileObject[]>> {
    try {
      const folder = clean(dir).replace(/\/+$/, "");
      const prefix = `${this.bucket}/${folder ? `${folder}/` : ""}`;
      const { files, folders } = await r2.listObjects(prefix + (opts.search ?? ""), 10_000);
      const out: FileObject[] = [
        ...folders.map((f) => ({ name: f.slice(prefix.length).replace(/\/$/, ""), id: null, created_at: null, updated_at: null, metadata: null })),
        ...(await Promise.all(
          files.map(async (f) => ({
            name: f.key.slice(prefix.length),
            id: f.key,
            created_at: f.lastModified,
            updated_at: f.lastModified,
            // R2's list has no content type: look it up for the few files of a search (an upload's check)
            metadata: { size: f.size, mimetype: opts.search && files.length <= 10 ? (await r2.headObject(f.key))?.mimetype : undefined },
          })),
        )),
      ];
      if (await legacyOn()) {
        const old = await legacyDb().from(this.bucket).list(folder, { limit: 1000, search: opts.search });
        const have = new Set(out.map((f) => f.name));
        for (const f of old.data ?? []) if (!have.has(f.name)) out.push({ name: f.name, id: f.id ?? null, created_at: f.created_at ?? null, updated_at: f.updated_at ?? null, metadata: f.metadata ? { size: Number(f.metadata.size ?? 0), mimetype: f.metadata.mimetype } : null });
      }
      const col = opts.sortBy?.column ?? "name";
      const dirn = opts.sortBy?.order === "desc" ? -1 : 1;
      out.sort((a, b) => dirn * String(a[col] ?? "").localeCompare(String(b[col] ?? "")));
      const start = opts.offset ?? 0;
      return ok(out.slice(start, start + (opts.limit ?? 100)));
    } catch (e) {
      return fail(e);
    }
  }

  async createSignedUrl(path: string, expiresIn: number, opts?: { download?: string | boolean }): Promise<Result<{ signedUrl: string }>> {
    try {
      if ((await legacyOn()) && !(await r2.headObject(this.key(path)))) {
        const old = await legacyDb().from(this.bucket).createSignedUrl(clean(path), expiresIn, opts);
        if (old.data) return ok(old.data);
        return fail(new Error("Object not found"), "404");
      }
      return ok({ signedUrl: await r2.presignGet(this.key(path), expiresIn, opts?.download) });
    } catch (e) {
      return fail(e);
    }
  }

  async createSignedUrls(paths: string[], expiresIn: number, opts?: { download?: string | boolean }): Promise<Result<{ path: string; signedUrl: string; error: string | null }[]>> {
    const out: { path: string; signedUrl: string; error: string | null }[] = [];
    for (let i = 0; i < paths.length; i += 25) {
      out.push(
        ...(await Promise.all(
          paths.slice(i, i + 25).map(async (p) => {
            const r = await this.createSignedUrl(p, expiresIn, opts);
            return { path: p, signedUrl: r.data?.signedUrl ?? "", error: r.error?.message ?? null };
          }),
        )),
      );
    }
    return ok(out);
  }

  /** A link the browser PUTs the file to (with its content-type); `token` is the same link. */
  async createSignedUploadUrl(path: string): Promise<Result<{ signedUrl: string; token: string; path: string }>> {
    try {
      const signedUrl = await r2.presignPut(this.key(path));
      return ok({ signedUrl, token: signedUrl, path: clean(path) });
    } catch (e) {
      return fail(e);
    }
  }

  /** Size and type of one file, or null. */
  async info(path: string) {
    const meta = await r2.headObject(this.key(path)).catch(() => null);
    if (meta || !(await legacyOn())) return meta;
    const folder = clean(path).split("/").slice(0, -1).join("/");
    const name = clean(path).split("/").pop()!;
    const { data } = await legacyDb().from(this.bucket).list(folder, { search: name, limit: 5 });
    const f = data?.find((x) => x.name === name);
    return f ? { size: Number(f.metadata?.size ?? 0), mimetype: String(f.metadata?.mimetype ?? ""), lastModified: f.updated_at ?? "" } : null;
  }

  getPublicUrl(path: string) {
    return { data: { publicUrl: publicFileUrl(this.bucket, path) } };
  }
}

export const storage = { from: (bucket: string) => new Bucket(bucket) };
