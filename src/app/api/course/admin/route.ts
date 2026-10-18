import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { checkPublicFile, signPublicUpload, type Purpose } from "@/lib/jawad/server/admin";
import { confirmOrder, listOrders, rejectOrder, type Status } from "@/lib/course/orders";
import { loadSettings, saveSettings } from "@/lib/course/settings";
import { ownerChat, setupWebhook, telegramFull, telegramReady, tgSend } from "@/lib/course/telegram";
import { offersAt } from "@config/course";
import { isAdmin } from "@config/site";
import { storage } from "@/lib/storage";
import { JAWAD_PUBLIC_BUCKET } from "@/lib/jawad/server/runtime";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function owner() {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("غير مسموح.", 404);
  return user;
}

const STATUSES: Status[] = ["started", "transferred", "confirmed", "rejected"];

/** The dashboard's view: the settings, the clock's phase, Telegram's state, the orders. */
export const GET = handle(async (req: Request) => {
  await owner();
  const status = new URL(req.url).searchParams.get("status");
  const [settings, orders] = await Promise.all([loadSettings(), listOrders(STATUSES.includes(status as Status) ? (status as Status) : undefined)]);
  return NextResponse.json({
    settings,
    now: Date.now(),
    phase: offersAt(settings, Date.now()).phase,
    orders,
    telegram: { token: telegramReady(), chat: !!ownerChat(), ready: telegramFull() },
  });
});

/**
 * One action of the dashboard:
 *   save { settings }          start_now · stop      the clock of the prices (the reel just came out)
 *   sign { purpose: course_video|course_poster, mime, bytes } → one-time upload URL ·  file { which: video|poster, path | null }
 *   confirm { id } · reject { id }                     an order
 *   telegram_setup · telegram_test
 */
export const POST = handle(async (req: Request) => {
  const user = await owner();
  const by = user.email ?? user.id;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const origin = new URL(req.url).origin;
  switch (b.action) {
    case "save":
      return NextResponse.json({ settings: await saveSettings((b.settings && typeof b.settings === "object" ? b.settings : {}) as Record<string, unknown>) });
    case "start_now":
      return NextResponse.json({ settings: await saveSettings({ launchAt: new Date().toISOString() }) });
    case "stop":
      return NextResponse.json({ settings: await saveSettings({ launchAt: null }) });
    case "sign": {
      const purpose = b.purpose === "course_poster" ? "course_poster" : "course_video";
      return NextResponse.json(await signPublicUpload(purpose as Purpose, "course", String(b.mime ?? ""), Number(b.bytes)));
    }
    case "file": {
      const which = b.which === "poster" ? "poster" : "video";
      const path = typeof b.path === "string" && b.path ? b.path : null;
      const cur = await loadSettings();
      if (path) await checkPublicFile(which === "poster" ? "course_poster" : "course_video", path);
      const old = which === "poster" ? cur.posterPath : cur.videoPath;
      const s = await saveSettings(which === "poster" ? { posterPath: path } : { videoPath: path });
      if (old && old !== path) await storage.from(JAWAD_PUBLIC_BUCKET).remove([old]).catch(() => null);
      return NextResponse.json({ settings: s });
    }
    case "confirm": {
      if (typeof b.id !== "string") throw new UserError("طلب غير صحيح.", 400);
      return NextResponse.json(await confirmOrder(b.id, by));
    }
    case "reject": {
      if (typeof b.id !== "string") throw new UserError("طلب غير صحيح.", 400);
      return NextResponse.json({ order: await rejectOrder(b.id, by, typeof b.note === "string" ? b.note : "") });
    }
    case "telegram_setup": {
      if (!telegramReady()) throw new UserError("أضف TELEGRAM_BOT_TOKEN في Vercel أول (من BotFather) ثم أعد النشر.", 400);
      try {
        return NextResponse.json(await setupWebhook(origin));
      } catch (e) {
        throw new UserError(`تعذّر ربط البوت: ${e instanceof Error ? e.message.slice(0, 160) : "خطأ"}`, 502);
      }
    }
    case "telegram_test": {
      if (!telegramFull()) throw new UserError("ينقص TELEGRAM_BOT_TOKEN أو TELEGRAM_CHAT_ID في Vercel.", 400);
      try {
        await tgSend(ownerChat(), "✅ تجربة: التنبيهات تصلك هنا.");
      } catch (e) {
        throw new UserError(`ما وصلت الرسالة: ${e instanceof Error ? e.message.slice(0, 160) : "خطأ"}`, 502);
      }
      return NextResponse.json({ ok: true });
    }
    default:
      throw new UserError("طلب غير معروف.", 400);
  }
});
