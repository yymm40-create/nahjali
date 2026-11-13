// «الجواد في كلاود وشات جي بي تي» · the account behind a connector's token. Server only.

import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { revoked } from "./tokens";

/** The person a token made at `iat` belongs to, or null (deleted, banned, or «افصل الربط» pressed since). */
export async function tokenUser(uid: string, iat: number): Promise<User | null> {
  const { data, error } = await createAdminClient().auth.admin.getUserById(uid);
  const user = data?.user;
  if (error || !user) return null;
  if (user.banned_until && new Date(user.banned_until).getTime() > Date.now()) return null;
  if (revoked(iat, user.app_metadata)) return null;
  return user;
}

/** «افصل الربط»: every connector token of this person made until now stops working. */
export async function revokeAll(user: User) {
  const { error } = await createAdminClient().auth.admin.updateUserById(user.id, {
    app_metadata: { ...(user.app_metadata ?? {}), mcp_revoked_at: Math.floor(Date.now() / 1000) },
  });
  if (error) throw error;
}
