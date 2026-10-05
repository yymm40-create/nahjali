import { createClient, type User } from "@supabase/supabase-js";

/**
 * Service-role client: bypasses RLS. SERVER ONLY.
 * Every caller must check that the signed-in user owns the data first.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const BUCKETS = { sources: "sources", generated: "generated", booklets: "booklets" } as const;

/** Short-lived signed URL for a private file (default 1 hour). */
export async function signedUrl(bucket: string, path: string, expiresIn = 3600, download?: string) {
  const { data, error } = await createAdminClient()
    .storage.from(bucket)
    .createSignedUrl(path, expiresIn, download ? { download } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

/** Every account (the admin API lists 1000 at a time); for the owner's pages and look-ups by e-mail. */
export async function listAllUsers() {
  const db = createAdminClient();
  const out: User[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    out.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return out;
}
