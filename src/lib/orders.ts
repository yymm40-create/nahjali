import { BUCKETS, createAdminClient } from "@/lib/supabase/admin";
import type { Character, Order, OrderStatus } from "@/lib/types";

/** A "working" status older than this is treated as crashed and can be claimed again. */
export const STALE_MS = 6 * 60_000;

export const staleBefore = () => new Date(Date.now() - STALE_MS).toISOString();

/**
 * Atomically moves an order from one of `from` to `to`.
 * Also reclaims the order if it has been stuck in `to` (a crashed request) for STALE_MS.
 * Returns the updated order, or null if another request got there first.
 */
export async function claimOrder(orderId: string, from: OrderStatus[], to: OrderStatus): Promise<Order | null> {
  const { data } = await createAdminClient()
    .from("orders")
    .update({ status: to })
    .eq("id", orderId)
    .or(`status.in.(${from.join(",")}),and(status.eq.${to},updated_at.lt.${staleBefore()})`)
    .select()
    .maybeSingle();
  return (data as Order) ?? null;
}

export async function setOrderStatus(orderId: string, status: OrderStatus, extra: Partial<Order> = {}) {
  const { error } = await createAdminClient()
    .from("orders")
    .update({ status, ...extra })
    .eq("id", orderId);
  if (error) throw error;
}

export async function getCharacters(orderId: string): Promise<Character[]> {
  const { data } = await createAdminClient()
    .from("characters")
    .select("*")
    .eq("order_id", orderId)
    .order("attempt_number", { ascending: true });
  return (data ?? []) as Character[];
}

export async function getApprovedCharacter(orderId: string): Promise<Character | null> {
  const { data } = await createAdminClient()
    .from("characters")
    .select("*")
    .eq("order_id", orderId)
    .eq("is_approved", true)
    .maybeSingle();
  return (data as Character) ?? null;
}

export const sourcePath = (o: Pick<Order, "user_id" | "id">) => `${o.user_id}/${o.id}/source.png`;

/** Unapproved photos are deleted after this long (see /privacy). */
export const SOURCE_PHOTO_MAX_AGE_MS = 24 * 3600_000;

/** Deletes the customer's original photo. Safe to call when it is already gone. */
export async function deleteSourcePhoto(o: Pick<Order, "user_id" | "id">) {
  const { error } = await createAdminClient().storage.from(BUCKETS.sources).remove([sourcePath(o)]);
  if (error) console.error("failed to delete source photo", o.id, error);
}

/**
 * Deletes original photos of orders older than SOURCE_PHOTO_MAX_AGE_MS that were never approved
 * (approved ones are deleted at approval). Looks back 7 days so a missed run is caught up.
 */
export async function deleteExpiredSourcePhotos() {
  const db = createAdminClient();
  const olderThan = new Date(Date.now() - SOURCE_PHOTO_MAX_AGE_MS).toISOString();
  const since = new Date(Date.now() - SOURCE_PHOTO_MAX_AGE_MS - 7 * 24 * 3600_000).toISOString();
  const { data } = await db
    .from("orders")
    .select("id,user_id")
    .lt("created_at", olderThan)
    .gte("created_at", since);
  // the order may be old while its photo is new (uploaded again today): only photos older than the limit go
  const candidates = (data ?? []) as Pick<Order, "id" | "user_id">[];
  const paths: string[] = [];
  for (const o of candidates) {
    const dir = sourcePath(o).split("/").slice(0, -1).join("/");
    const { data: files } = await db.storage.from(BUCKETS.sources).list(dir, { search: "source.png" });
    const f = files?.find((x) => x.name === "source.png");
    if (f && new Date(f.created_at ?? f.updated_at ?? 0).toISOString() < olderThan) paths.push(sourcePath(o));
  }
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await db.storage.from(BUCKETS.sources).remove(paths.slice(i, i + 100));
    if (error) console.error("cleanup failed", error);
  }
  return paths.length;
}
