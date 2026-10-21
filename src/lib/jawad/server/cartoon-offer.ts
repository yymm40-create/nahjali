// «حولني الى الستايل الكرتوني» · the opening offer (config/jawad/cartoon-offer.ts): whether this account still gets
// its free picture or its free film, and how many places are left. A free job carries `freeOffer` in its plan, so the
// count is of distinct accounts whose free job did not fail. Server only.

import { CARTOON_OFFER, offerLimit, type CartoonOfferKind } from "@config/jawad/cartoon-offer";
import { createAdminClient } from "@/lib/supabase/admin";

/** The accounts that took this free thing since the offer opened (null when it cannot be read: then nobody gets it). */
async function takers(kind: CartoonOfferKind): Promise<Set<string> | null> {
  const { data, error } = await createAdminClient()
    .from("jawad_jobs")
    .select("user_id")
    .like("idempotency_key", "cartoon_%")
    .eq("inputs->cartoon->>freeOffer", kind)
    .neq("status", "failed")
    .gte("created_at", CARTOON_OFFER.startsAt)
    .limit(500);
  if (error) return null;
  return new Set((data ?? []).map((row) => String(row.user_id)));
}

/** Whether `userId` still gets it: places are left and they have not had theirs. */
export async function cartoonFree(userId: string, kind: CartoonOfferKind): Promise<boolean> {
  if (Date.now() < new Date(CARTOON_OFFER.startsAt).getTime()) return false;
  const taken = await takers(kind);
  return !!taken && !taken.has(userId) && taken.size < offerLimit(kind);
}

/** The places left of each (for the page's banner). */
export async function cartoonOfferLeft(): Promise<{ pictures: number; videos: number }> {
  const [pic, video] = await Promise.all([takers("pic"), takers("video")]);
  return { pictures: pic ? Math.max(0, CARTOON_OFFER.pictures - pic.size) : 0, videos: video ? Math.max(0, CARTOON_OFFER.videos - video.size) : 0 };
}
