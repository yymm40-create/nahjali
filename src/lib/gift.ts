// «هدية التسجيل» (config/gift.ts): given on the person's first visit while the offer is on, once per account — a row
// «gift:<user id>» in jawad_settings is written first (its key is unique), and only the request that wrote it adds the
// balance. Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { grantCoins } from "@/lib/coins";
import { giftOpen, SIGNUP_GIFT } from "@config/gift";

const done = new Set<string>();

/** Gives the gift if it is still on and this account never had it; true when it was given now. */
export async function giveSignupGift(user: { id: string; email?: string | null } | null): Promise<boolean> {
  if (!user || !giftOpen() || done.has(user.id)) return false;
  done.add(user.id);
  try {
    const { error } = await createAdminClient()
      .from("jawad_settings")
      .insert({ key: `gift:${user.id}`, value: { halalas: SIGNUP_GIFT.halalas, email: user.email ?? null }, updated_by: "signup-gift" });
    // already given (the key exists), or the table refused: nothing more
    if (error) return false;
    await grantCoins(user.id, SIGNUP_GIFT.halalas, SIGNUP_GIFT.label);
    return true;
  } catch (e) {
    console.error("signup gift", user.id, e);
    return false;
  }
}
