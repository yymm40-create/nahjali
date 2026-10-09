import { NextResponse } from "next/server";
import { confirmOrder, getOrder, rejectOrder } from "@/lib/course/orders";
import { loadSettings } from "@/lib/course/settings";
import { orderButtons, orderText, ownerChat, telegramReady, tgAnswer, tgEdit, tgSend, webhookSecret } from "@/lib/course/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface Update {
  message?: { text?: string; chat?: { id?: number }; from?: { id?: number } };
  callback_query?: { id: string; data?: string; from?: { id?: number }; message?: { message_id?: number; chat?: { id?: number } } };
}

/**
 * Telegram calls this (the bot's webhook). Only Telegram can: every call carries the secret made from the bot's token.
 *  - "/start" from anyone: the bot answers with that chat's own number (the owner puts it in Vercel as TELEGRAM_CHAT_ID);
 *  - a press on «✅ أكّد الدفع» / «❌ ارفض» under an order: only from the owner's chat; the buyer is unlocked (and gets the gift) at once.
 */
export async function POST(req: Request) {
  if (!telegramReady() || req.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret()) return NextResponse.json({ ok: false }, { status: 401 });
  const u = ((await req.json().catch(() => null)) ?? {}) as Update;
  try {
    const m = u.message;
    if (m?.text && /^\/start\b/.test(m.text) && m.chat?.id) {
      const mine = ownerChat() && String(m.chat.id) === ownerChat();
      await tgSend(m.chat.id, mine ? "✅ أنت المالك: التنبيهات توصلك هنا." : `رقم محادثتك: <code>${m.chat.id}</code>\nحطه في Vercel باسم TELEGRAM_CHAT_ID ثم أعد النشر، وبعدها توصلك طلبات التحويل هنا.`);
      return NextResponse.json({ ok: true });
    }
    const q = u.callback_query;
    if (q?.data) {
      const chat = q.message?.chat?.id;
      if (!ownerChat() || String(q.from?.id) !== ownerChat() || String(chat) !== ownerChat()) {
        await tgAnswer(q.id, "هذا الزر للمالك فقط.");
        return NextResponse.json({ ok: true });
      }
      const [act, id] = q.data.split(":");
      if ((act === "ok" || act === "no") && /^[0-9a-f-]{36}$/i.test(id ?? "")) {
        const s = await loadSettings();
        const cur = await getOrder(id);
        if (!cur) {
          await tgAnswer(q.id, "ما لقيت الطلب.");
          return NextResponse.json({ ok: true });
        }
        const edit = async (text: string, done: boolean, o = cur) => {
          if (q.message?.message_id && chat) await tgEdit(chat, q.message.message_id, text, orderButtons(o, s, done));
        };
        if (act === "ok") {
          const r = await confirmOrder(id, "تيليجرام");
          await tgAnswer(q.id, r.already ? "مؤكد من قبل" : "تم التأكيد ✅");
          await edit(orderText(r.order, "✅ <b>تم التأكيد</b>"), true, r.order);
        } else {
          try {
            const o = await rejectOrder(id, "تيليجرام");
            await tgAnswer(q.id, "تم الرفض");
            await edit(orderText(o, "❌ <b>مرفوض</b>"), true, o);
          } catch (e) {
            await tgAnswer(q.id, e instanceof Error ? e.message.slice(0, 150) : "تعذّر الرفض");
          }
        }
      }
    }
  } catch (e) {
    console.error("course telegram", e);
  }
  // always 200: Telegram would retry a failed call again and again
  return NextResponse.json({ ok: true });
}
