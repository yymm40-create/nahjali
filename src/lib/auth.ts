import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Order } from "@/lib/types";

/** For server pages: returns the signed-in user or redirects to /login. */
export async function requireUser(next = "/") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

/** For server pages: loads an order owned by the signed-in user, or 404. */
export async function requireOrder(orderId: string, next: string): Promise<Order> {
  const user = await requireUser(next);
  const { data } = await createAdminClient().from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!data || data.user_id !== user.id) notFound();
  return data as Order;
}
