import { NextResponse } from "next/server";
import { handle, requireApiUser } from "@/lib/api";
import { cleanContact, saveContact } from "@/lib/contact";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** «الحساب الشخصي»: save the name and WhatsApp number. Body: { name, phone }. */
export const PUT = handle(async (req: Request) => {
  await requireApiUser();
  const c = cleanContact((await req.json().catch(() => ({}))) as { name?: unknown; phone?: unknown });
  await saveContact(await createClient(), c);
  return NextResponse.json({ ok: true, ...c });
});
