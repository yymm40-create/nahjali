// «الجواد الذكي!» | JAWAD AI — is an upload kept by «ذوقي» or «هويتي»? Server only. Kept apart from taste.ts so that
// uploads.ts can ask without importing it (taste.ts imports uploads.ts).

import { createAdminClient } from "@/lib/supabase/admin";

/** The tables of 0116 are not there yet (or a column is missing). */
export const tasteMissing = (e: { code?: string; message?: string } | null) =>
  Boolean(e && (e.code === "42P01" || e.code === "42703" || e.code === "PGRST204" || e.code === "PGRST205" || /jawad_tastes|jawad_brand_kits/.test(e.message ?? "")));

/** Is this upload one of a taste's pictures or a brand logo (so it is never deleted with a reference)? */
export async function keptByTaste(uploadId: string) {
  const db = createAdminClient();
  const [t, b] = await Promise.all([
    db.from("jawad_tastes").select("id").contains("ref_upload_ids", [uploadId]).limit(1),
    db.from("jawad_brand_kits").select("user_id").eq("logo_upload_id", uploadId).limit(1),
  ]);
  return (!tasteMissing(t.error) && Boolean(t.data?.length)) || (!tasteMissing(b.error) && Boolean(b.data?.length));
}
