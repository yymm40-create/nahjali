import { createAdminClient } from "@/lib/supabase/admin";
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
