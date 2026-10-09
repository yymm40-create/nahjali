// «دورة الجواد الذكي» — the owner's phone: when a buyer presses «تم التحويل», a Telegram bot messages him the buyer's name, phone and
// e-mail with buttons: «✅ أكّد» (the buyer is unlocked and gets the gift at once), «❌ ارفض», and WhatsApp (a chat with the buyer, the
// group link already written in). The bot's token and the owner's chat number are set in Vercel (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID),
// never in the code. Server only.

import { createHash } from "crypto";
import { COURSE, PRODUCT_LABEL, waLink, type CourseSettings } from "@config/course";
import type { Order } from "./orders";

const token = () => process.env.TELEGRAM_BOT_TOKEN ?? "";
export const ownerChat = () => process.env.TELEGRAM_CHAT_ID ?? "";
export const telegramReady = () => !!token();
export const telegramFull = () => !!token() && !!ownerChat();

/** The secret Telegram sends back with every update, so only Telegram can call our webhook (made from the token, nothing to store). */
export const webhookSecret = (t = token()) => createHash("sha256").update(`jawad-course:${t}`).digest("hex").slice(0, 48);

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type Json = Record<string, unknown>;

async function call<T = Json>(method: string, body: Json): Promise<T> {
  const t = token();
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  const res = await fetch(`https://api.telegram.org/bot${t}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
  if (!res.ok || !j.ok) throw new Error(`Telegram ${method}: ${j.description ?? res.status}`);
  return j.result as T;
}

export const tgSend = (chat: string | number, text: string, keyboard?: unknown[][]) =>
  call("sendMessage", { chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true, ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}) });
export const tgEdit = (chat: string | number, messageId: number, text: string, keyboard?: unknown[][]) =>
  call("editMessageText", { chat_id: chat, message_id: messageId, text, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: { inline_keyboard: keyboard ?? [] } });
export const tgAnswer = (id: string, text: string) => call("answerCallbackQuery", { callback_query_id: id, text, show_alert: false });

/** Points the bot at our webhook (with the secret) and returns the bot's name. */
export async function setupWebhook(origin: string): Promise<{ bot: string; url: string }> {
  const me = await call<{ username?: string }>("getMe", {});
  const url = `${origin}/api/course/telegram`;
  await call("setWebhook", { url, secret_token: webhookSecret(), allowed_updates: ["message", "callback_query"], drop_pending_updates: true });
  return { bot: me.username ?? "", url };
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { timeZone: "Asia/Riyadh", dateStyle: "short", timeStyle: "short" }) : "");

/** The message about one order (HTML for Telegram). */
export function orderText(o: Order, state = ""): string {
  return [
    state || "💰 <b>طلب تحويل جديد</b>",
    `👤 ${esc(o.name)}`,
    `📱 <code>${esc(o.phone)}</code>`,
    `✉️ ${esc(o.email)}`,
    `📦 ${esc(PRODUCT_LABEL[o.product])} — <b>${o.amount} ريال</b>${o.was > o.amount ? ` (قيمتها ${o.was})` : ""}${o.bonus ? ` + ${o.bonus} زهرة هدية` : ""}`,
    `🕒 ${when(o.transferredAt ?? o.createdAt)}`,
  ].join("\n");
}

/** What the owner sends the buyer after confirming: the welcome with the group link. */
export const welcomeText = (o: Order, s: CourseSettings) =>
  `هلا ${o.name} 🌸 تم تأكيد اشتراكك في ${COURSE.name} ✅${s.groupLink ? `\nرابط المجموعة: ${s.groupLink}` : ""}${o.bonus ? `\nوانضاف لرصيدك في الجواد ${o.bonus} زهرة هدية 🎁` : ""}`;

const rows = (o: Order, s: CourseSettings, done: boolean): unknown[][] => [
  ...(done ? [] : [[{ text: "✅ أكّد الدفع", callback_data: `ok:${o.id}` }, { text: "❌ ارفض", callback_data: `no:${o.id}` }]]),
  ...(o.phone ? [[{ text: done ? "💬 أرسل له رابط المجموعة" : "💬 واتساب", url: waLink(o.phone, done ? welcomeText(o, s) : `هلا ${o.name}، وصلنا تحويلك لـ${COURSE.name}.`) }]] : []),
];
export { rows as orderButtons };

/** Tells the owner a buyer pressed «تم التحويل». Returns false when Telegram is not set up (the dashboard still lists the order). */
export async function notifyTransfer(o: Order, s: CourseSettings): Promise<boolean> {
  if (!telegramFull()) return false;
  await tgSend(ownerChat(), orderText(o), rows(o, s, false));
  return true;
}
