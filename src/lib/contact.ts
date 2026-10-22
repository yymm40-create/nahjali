// SERVER ONLY. The account's contact for payments and support: the full name and a WhatsApp number, kept in the account's own
// metadata (no table, no migration). Asked once at the first sign-in (/jawad-ai/account?first=1) and editable there any time;
// the payment no longer asks for them.

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { UserError } from "@/lib/api";
import { cleanPhone } from "@config/course";

export interface Contact {
  name: string;
  phone: string;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** What the account has (empty strings when not set). The Google name stands in for a name never typed. */
export function contactOf(user: Pick<User, "user_metadata">): Contact {
  const m = user.user_metadata ?? {};
  return { name: str(m.jw_name) || str(m.full_name) || str(m.name), phone: str(m.jw_phone) };
}

/** Both a name and a valid number. */
export const contactComplete = (c: Contact) => c.name.length >= 2 && !!cleanPhone(c.phone);

/** Checks and cleans what the person typed. */
export function cleanContact(b: { name?: unknown; phone?: unknown }): Contact {
  const name = str(b.name).replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) throw new UserError("اكتب اسمك الكامل.", 400);
  const phone = cleanPhone(b.phone);
  if (!phone) throw new UserError("رقم الجوال غير صحيح؛ اكتبه مع المفتاح أو بصيغة 05xxxxxxxx.", 400);
  return { name, phone };
}

/** Saves the contact on the account (through the person's own session). */
export async function saveContact(supabase: SupabaseClient, c: Contact): Promise<void> {
  const { error } = await supabase.auth.updateUser({ data: { jw_name: c.name, jw_phone: c.phone } });
  if (error) throw new UserError("تعذّر الحفظ. جرّب مرة ثانية.", 500);
}
