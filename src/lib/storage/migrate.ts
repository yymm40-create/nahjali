// SERVER ONLY. The owner's one-time copy of the old Supabase files to R2 (/admin/storage).
// Safe to run again: a file already in R2 is skipped. Supabase's copies are left as they are.
import { createAdminClient } from "@/lib/supabase/admin";
import { ALL_BUCKETS, MIGRATED_MARK, resetLegacyCache } from ".";
import * as r2 from "./r2";

export interface CopyProgress {
  copied: number;
  skipped: number;
  failed: string[];
  done: boolean;
  finished: boolean;
}

/** Copies what it can within `budgetMs`; call again until `done`. When everything is there it finishes the move. */
export async function copyFromSupabase(budgetMs: number): Promise<CopyProgress> {
  const until = Date.now() + budgetMs;
  const supa = createAdminClient().storage;
  const out: CopyProgress = { copied: 0, skipped: 0, failed: [], done: false, finished: false };

  for (const bucket of ALL_BUCKETS) {
    const dirs = [""];
    while (dirs.length) {
      const dir = dirs.shift()!;
      for (let offset = 0; ; offset += 1000) {
        if (Date.now() > until) return out;
        const { data, error } = await supa.from(bucket).list(dir, { limit: 1000, offset });
        // A bucket that was never made (its SQL file not run) has nothing to copy
        if (error) break;
        for (const f of data ?? []) {
          const path = dir ? `${dir}/${f.name}` : f.name;
          if (!f.id) {
            dirs.push(path);
            continue;
          }
          if (f.name === ".emptyFolderPlaceholder") continue;
          if (Date.now() > until) return out;
          const key = `${bucket}/${path}`;
          try {
            if (await r2.headObject(key)) {
              out.skipped++;
              continue;
            }
            const file = await supa.from(bucket).download(path);
            if (!file.data) throw new Error(file.error?.message ?? "download failed");
            await r2.putObject(key, file.data, String(f.metadata?.mimetype ?? "") || file.data.type || undefined);
            out.copied++;
          } catch {
            out.failed.push(key);
          }
        }
        if ((data ?? []).length < 1000) break;
      }
    }
  }

  out.done = true;
  if (!out.failed.length) {
    await finishMove();
    out.finished = true;
  }
  return out;
}

/** Saved full links to Supabase's public files become the site's own links, then Supabase is not read again. */
async function finishMove() {
  const db = createAdminClient();
  const old = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;
  const rows = [
    { table: "mahdi_shrines", key: "id", column: "image_url" },
    { table: "mahdi_public_profiles", key: "user_id", column: "avatar_url" },
  ];
  for (const r of rows) {
    const { data } = await db.from(r.table).select(`${r.key},${r.column}`).like(r.column, `${old}%`);
    for (const row of (data ?? []) as unknown as Record<string, string>[]) {
      await db.from(r.table).update({ [r.column]: `/files/${row[r.column].slice(old.length)}` }).eq(r.key, row[r.key]);
    }
  }
  await r2.putObject(MIGRATED_MARK, new Date().toISOString(), "text/plain");
  resetLegacyCache();
}
