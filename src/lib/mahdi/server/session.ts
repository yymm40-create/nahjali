// SERVER ONLY. The signed-in user of «لأجل المهدي», acting through Row Level Security (never the service role).
import { cache } from "react";
import { createClient as createSupabaseClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { profileFromRow, type ProfileRow } from "./rows";
import type { Profile } from "../types";

export interface MahdiSession {
  supabase: SupabaseClient;
  user: User | null;
  profile: Profile | null;
}

async function withProfile(supabase: SupabaseClient, user: User | null): Promise<MahdiSession> {
  if (!user) return { supabase, user: null, profile: null };
  const { data } = await supabase.from("mahdi_profiles").select("*").eq("user_id", user.id).maybeSingle();
  return { supabase, user, profile: data ? profileFromRow(data as ProfileRow) : null };
}

/** Pages and layouts: the cookie session. Cached for the duration of one request. */
export const getMahdiSession = cache(async (): Promise<MahdiSession> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return withProfile(supabase, user);
});

/**
 * API routes: the cookie session, or a `Authorization: Bearer <access token>` header
 * (so a future native app can call the same routes).
 */
export async function getApiSession(req: Request): Promise<MahdiSession> {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    const supabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    return withProfile(supabase, user);
  }
  return getMahdiSession();
}
