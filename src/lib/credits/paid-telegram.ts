// Every card payment on the owner's phone: the moment a payment on our checkout page (src/lib/credits/checkout.ts) is READ from Moyasar
// as paid, the same Telegram bot as the course and the transfers tells the owner what was bought, for how much and by whom — once per
// payment, however many times the return and the webhook settle it. Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { esc, ownerChat, telegramFull, tgSend } from "@/lib/course/telegram";
import type { CheckoutKind } from "./checkout";
import type { Payment } from "./moyasar";

const KIND: Record<CheckoutKind, string> = {
  credits: "💳 شحن رصيد",
  course: "🎓 دورة",
  offer10: "🎁 عرض الـ٢٥ ريال",
  unlim: "⚡ لامحدود",
  pay: "💸 دفعة بالمبلغ اللي يبيه",
};

const when = () => new Date().toLocaleString("ar-SA-u-ca-gregory-nu-latn", { timeZone: "Asia/Riyadh", dateStyle: "short", timeStyle: "short" });

/** The account behind a ref that starts with it («لامحدود», the offer). */
async function emailOf(userId: string): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return "";
  const { data } = await createAdminClient().auth.admin.getUserById(userId).catch(() => ({ data: null }));
  return data?.user?.email ?? "";
}

/** Tells the owner about a paid card payment (once per payment). Never throws: a missed message never blocks a purchase. */
export async function notifyPaid(kind: CheckoutKind, p: Payment, buyer: { email?: string | null; name?: string | null } = {}) {
  try {
    if (!telegramFull() || p.status !== "paid") return;
    // the first settle claims the payment; the return and the webhook both arrive, only one message goes
    const { error } = await createAdminClient().from("jawad_settings").insert({ key: `tgpaid:${p.id}`.slice(0, 64), value: { kind, at: new Date().toISOString() }, updated_by: "telegram" });
    if (error) return;
    const ref = p.metadata.ref ?? "";
    const email = buyer.email || (kind === "unlim" || kind === "offer10" ? await emailOf(ref.split("|")[0]) : "");
    const lines = [
      `🛒 <b>عملية شراء جديدة</b> · ${KIND[kind] ?? esc(kind)}`,
      `💰 <b>${(p.amount / 100).toLocaleString("en", { maximumFractionDigits: 2 })} ريال</b>`,
      ...(p.description ? [`📦 ${esc(p.description)}`] : []),
      ...(buyer.name ? [`👤 ${esc(buyer.name)}`] : []),
      ...(email ? [`✉️ ${esc(email)}`] : []),
      `🕒 ${when()}`,
    ];
    await tgSend(ownerChat(), lines.join("\n"));
  } catch (e) {
    console.error("paid telegram", p.id, e);
  }
}
