import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, readSettings } from "@config/course";
import type { Order } from "@/lib/course/orders";

// The owner's phone: the message about a transfer (safe HTML, the buttons), the bot's webhook (only Telegram, only the owner can
// confirm), and the first-time setup (/start answers with the chat's own number).
const confirm = vi.fn();
const reject = vi.fn();
const getOrder = vi.fn();
vi.mock("@/lib/course/orders", () => ({ confirmOrder: (...a: unknown[]) => confirm(...a), rejectOrder: (...a: unknown[]) => reject(...a), getOrder: (...a: unknown[]) => getOrder(...a) }));
const settings = readSettings({ ...DEFAULT_SETTINGS, groupLink: "https://chat.whatsapp.com/abc" });
vi.mock("@/lib/course/settings", () => ({ loadSettings: async () => settings }));

const order = (o: Partial<Order> = {}): Order => ({ id: "11111111-1111-4111-8111-111111111111", userId: "u", email: "a@b.com", name: "محمد <b>علي</b>", phone: "+966501234567", product: "recorded", phase: "B", amount: 80, was: 150, bonus: 30, status: "transferred", lockedUntil: "2026-10-10T12:00:00Z", transferredAt: "2026-10-10T10:00:00Z", confirmedAt: null, bonusGrantedAt: null, note: "", createdAt: "2026-10-10T09:00:00Z", ...o });

const calls: { method: string; body: Record<string, unknown> }[] = [];
const OWNER = "777";
beforeEach(() => {
  calls.length = 0;
  process.env.TELEGRAM_BOT_TOKEN = "123:TEST";
  process.env.TELEGRAM_CHAT_ID = OWNER;
  confirm.mockReset();
  reject.mockReset();
  getOrder.mockReset();
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: { body: string }) => {
    calls.push({ method: url.split("/").pop()!, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ ok: true, result: { username: "jawad_bot" } }), { status: 200 });
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
});

const hook = async (update: unknown, secret?: string) => {
  const { POST } = await import("@/app/api/course/telegram/route");
  const { webhookSecret } = await import("@/lib/course/telegram");
  return POST(new Request("https://x.test/api/course/telegram", { method: "POST", headers: { "x-telegram-bot-api-secret-token": secret ?? webhookSecret() }, body: JSON.stringify(update) }));
};

describe("the message about a transfer", () => {
  it("has the buyer's name (safe), phone, e-mail, the product, the price, the value and the gift", async () => {
    const { orderText } = await import("@/lib/course/telegram");
    const t = orderText(order());
    expect(t).toContain("محمد &lt;b&gt;علي&lt;/b&gt;");
    expect(t).not.toContain("<b>علي");
    expect(t).toContain("<code>+966501234567</code>");
    expect(t).toContain("a@b.com");
    expect(t).toContain("الدورة المسجلة");
    expect(t).toContain("<b>80 ريال</b>");
    expect(t).toContain("قيمتها 150");
    expect(t).toContain("30 زهرة");
  });

  it("has confirm / reject / WhatsApp buttons while waiting, and only WhatsApp (with the group link in it) once done", async () => {
    const { orderButtons, welcomeText } = await import("@/lib/course/telegram");
    const wait = orderButtons(order(), settings, false) as { text: string; callback_data?: string; url?: string }[][];
    expect(wait[0].map((b) => b.callback_data)).toEqual([`ok:${order().id}`, `no:${order().id}`]);
    expect(wait[1][0].url).toMatch(/^https:\/\/wa\.me\/966501234567\?text=/);
    const done = orderButtons(order(), settings, true) as { text: string; url?: string }[][];
    expect(done).toHaveLength(1);
    const text = decodeURIComponent(done[0][0].url!.split("?text=")[1]);
    expect(text).toContain("https://chat.whatsapp.com/abc");
    expect(text).toBe(welcomeText(order(), settings));
    expect(welcomeText(order(), settings)).toContain("30 زهرة");
    expect(welcomeText(order({ bonus: 0 }), settings)).not.toContain("زهرة");
  });

  it("is sent to the owner's chat with the buttons — and silently skipped when Telegram isn't set up", async () => {
    const { notifyTransfer } = await import("@/lib/course/telegram");
    expect(await notifyTransfer(order(), settings)).toBe(true);
    expect(calls[0].method).toBe("sendMessage");
    expect(calls[0].body).toMatchObject({ chat_id: OWNER, parse_mode: "HTML" });
    expect((calls[0].body.reply_markup as { inline_keyboard: unknown[] }).inline_keyboard.length).toBeGreaterThan(0);
    delete process.env.TELEGRAM_CHAT_ID;
    calls.length = 0;
    expect(await notifyTransfer(order(), settings)).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe("the bot's webhook", () => {
  it("answers only Telegram: a missing or wrong secret is refused and nothing happens", async () => {
    const q = { callback_query: { id: "c1", data: `ok:${order().id}`, from: { id: Number(OWNER) }, message: { message_id: 5, chat: { id: Number(OWNER) } } } };
    expect((await hook(q, "wrong")).status).toBe(401);
    expect((await hook(q, "")).status).toBe(401);
    expect(confirm).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
    delete process.env.TELEGRAM_BOT_TOKEN;
    expect((await hook(q)).status).toBe(401);
  });

  it("/start gives anyone their own chat number to put in Vercel; the owner is told he is the owner", async () => {
    await hook({ message: { text: "/start", chat: { id: 4242 }, from: { id: 4242 } } });
    expect(calls[0].body).toMatchObject({ chat_id: 4242 });
    expect(String(calls[0].body.text)).toContain("<code>4242</code>");
    expect(String(calls[0].body.text)).toContain("TELEGRAM_CHAT_ID");
    calls.length = 0;
    await hook({ message: { text: "/start", chat: { id: Number(OWNER) } } });
    expect(String(calls[0].body.text)).toContain("المالك");
    expect(String(calls[0].body.text)).not.toContain("TELEGRAM_CHAT_ID");
  });

  it("«✅ أكّد» from the owner confirms, edits the message to «تم التأكيد» and offers the WhatsApp with the group link", async () => {
    getOrder.mockResolvedValue(order());
    confirm.mockResolvedValue({ order: order({ status: "confirmed" }), already: false });
    const res = await hook({ callback_query: { id: "c1", data: `ok:${order().id}`, from: { id: Number(OWNER) }, message: { message_id: 5, chat: { id: Number(OWNER) } } } });
    expect(res.status).toBe(200);
    expect(confirm).toHaveBeenCalledWith(order().id, "تيليجرام");
    expect(calls.map((c) => c.method)).toEqual(["answerCallbackQuery", "editMessageText"]);
    expect(String(calls[1].body.text)).toContain("تم التأكيد");
    const kb = (calls[1].body.reply_markup as { inline_keyboard: { url?: string }[][] }).inline_keyboard;
    expect(kb).toHaveLength(1);
    expect(decodeURIComponent(kb[0][0].url!)).toContain("https://chat.whatsapp.com/abc");
  });

  it("«❌ ارفض» rejects; a refusal that can't happen is told to the owner, not thrown", async () => {
    getOrder.mockResolvedValue(order());
    reject.mockResolvedValueOnce(order({ status: "rejected" }));
    await hook({ callback_query: { id: "c2", data: `no:${order().id}`, from: { id: Number(OWNER) }, message: { message_id: 6, chat: { id: Number(OWNER) } } } });
    expect(reject).toHaveBeenCalledWith(order().id, "تيليجرام");
    expect(String(calls.at(-1)!.body.text)).toContain("مرفوض");
    calls.length = 0;
    reject.mockRejectedValueOnce(new Error("هذا الطلب ما عاد قابل للرفض"));
    const res = await hook({ callback_query: { id: "c3", data: `no:${order().id}`, from: { id: Number(OWNER) }, message: { message_id: 6, chat: { id: Number(OWNER) } } } });
    expect(res.status).toBe(200);
    expect(String(calls[0].body.text)).toContain("ما عاد قابل");
  });

  it("buttons pressed by anyone but the owner (or in another chat) do nothing", async () => {
    getOrder.mockResolvedValue(order());
    await hook({ callback_query: { id: "c4", data: `ok:${order().id}`, from: { id: 999 }, message: { message_id: 7, chat: { id: 999 } } } });
    await hook({ callback_query: { id: "c5", data: `ok:${order().id}`, from: { id: Number(OWNER) }, message: { message_id: 7, chat: { id: 999 } } } });
    expect(confirm).not.toHaveBeenCalled();
    expect(calls.every((c) => c.method === "answerCallbackQuery")).toBe(true);
    delete process.env.TELEGRAM_CHAT_ID;
    calls.length = 0;
    await hook({ callback_query: { id: "c6", data: `ok:${order().id}`, from: { id: Number(OWNER) }, message: { message_id: 7, chat: { id: Number(OWNER) } } } });
    expect(confirm).not.toHaveBeenCalled();
  });

  it("junk ids and broken updates are answered 200 and ignored (Telegram would retry a failure forever)", async () => {
    expect((await hook({ callback_query: { id: "c7", data: "ok:not-an-id", from: { id: Number(OWNER) }, message: { message_id: 1, chat: { id: Number(OWNER) } } } })).status).toBe(200);
    expect((await hook({})).status).toBe(200);
    expect((await hook(null)).status).toBe(200);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("the secret comes from the token alone, and differs per token", async () => {
    const { webhookSecret } = await import("@/lib/course/telegram");
    expect(webhookSecret("a")).toMatch(/^[0-9a-f]{48}$/);
    expect(webhookSecret("a")).toBe(webhookSecret("a"));
    expect(webhookSecret("a")).not.toBe(webhookSecret("b"));
  });
});
