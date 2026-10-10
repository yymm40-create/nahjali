// «اشحن رصيدك» on the owner's phone: the same Telegram bot as the course. A buyer's «تم التحويل» sends the order with «✅ أكّد وأضف
// الرصيد» (the balance lands in their wallet at once), «❌ ارفض» and a WhatsApp chat with the buyer. Server only.

import { waLink } from "@config/course";
import { esc, ownerChat, telegramFull, tgSend } from "@/lib/course/telegram";
import type { CreditOrder } from "./orders";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { timeZone: "Asia/Riyadh", dateStyle: "short", timeStyle: "short" }) : "");

export function creditText(o: CreditOrder, state = ""): string {
  return [
    state || "💳 <b>طلب شحن رصيد</b>",
    `👤 ${esc(o.name)}`,
    `📱 <code>${esc(o.phone)}</code>`,
    `✉️ ${esc(o.email)}`,
    `📦 باقة ${esc(o.packName)} — حوّل <b>${o.price} ريال</b> ويوصله رصيد ${o.credit}`,
    `🕒 ${when(o.transferredAt ?? o.createdAt)}`,
  ].join("\n");
}

export const creditButtons = (o: CreditOrder, done: boolean): unknown[][] => [
  ...(done ? [] : [[{ text: "✅ أكّد وأضف الرصيد", callback_data: `cok:${o.id}` }, { text: "❌ ارفض", callback_data: `cno:${o.id}` }]]),
  ...(o.phone ? [[{ text: "💬 واتساب", url: waLink(o.phone, done && o.status === "confirmed" ? `هلا ${o.name} 🌸 انضاف لرصيدك في الجواد الذكي ${o.credit} ✅ بالتوفيق في أعمالك.` : `هلا ${o.name}، وصلنا طلب شحن رصيدك في الجواد الذكي.`) }]] : []),
];

/** Tells the owner a buyer pressed «تم التحويل». False when Telegram is not set up (the dashboard still lists the order). */
export async function notifyCreditTransfer(o: CreditOrder): Promise<boolean> {
  if (!telegramFull()) return false;
  await tgSend(ownerChat(), creditText(o), creditButtons(o, false));
  return true;
}
