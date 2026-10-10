// «كتيب الجداول الذكي» — the server side: the conversations with «نور» (who designs the tables with the person), and
// starting a booklet — the ready one (the original booklet with the child's picture) or a designed one — as an order of
// the booklet machinery (photo → character → poses → PDF), paid from the wallet at once. Server only.

import { UserError } from "@/lib/api";
import { unlimitedFor } from "@/lib/access";
import { holdCoins, loadPricing } from "@/lib/coins";
import { OPTIONS_RULE } from "@/lib/chat-options";
import { talk, type Turn } from "@/lib/games/claude";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTemplate, type Template } from "@/lib/templates";
import type { Order } from "@/lib/types";
import { coinsFor } from "@config/coins";
import { ATTEMPTS_ALLOWED } from "@config/pricing";
import { isStyle } from "@config/styles";
import { audienceLine, bookletUsd, cleanSpec, legacyGender, NOOR_RULES, posesOf, READY_POSES, readAudience, readSpec, TB, type Audience, type BookletSpec } from "@config/tables-booklet";
import { bookletTemplate } from "./layout";

const db = () => createAdminClient();

/** What an order of this branch keeps besides the old columns. */
export interface OrderSpec {
  audience: Audience;
  design?: BookletSpec;
}
export const specOf = (o: Pick<Order, "id"> & { spec?: unknown }): OrderSpec | null => {
  const s = (o.spec ?? null) as { audience?: unknown; design?: unknown } | null;
  const audience = s ? readAudience(s.audience) : null;
  if (!audience) return null;
  const design = s?.design ? cleanSpec(s.design) : null;
  return { audience, ...(design ? { design } : {}) };
};

/** The booklet an order is drawn from: its design, or a template on disk (the ready booklet). */
export async function templateFor(order: Order & { spec?: unknown }): Promise<Template | null> {
  if (order.template_id === TB.customTemplate) {
    const s = specOf(order);
    return s?.design ? bookletTemplate(s.design) : null;
  }
  return getTemplate(order.template_id);
}

/** Who the pictures are drawn as (a grown-up or a child). */
export const whoOf = (order: Order & { spec?: unknown }) => {
  const a = specOf(order)?.audience;
  return a ? { adult: a.kind === "adult", age: a.age } : undefined;
};

// ───────────────────────────── the conversations with «نور» ─────────────────────────────

export interface BookletChat {
  id: string;
  title: string;
  audience: Audience | null;
  messages: Turn[];
  spec: BookletSpec | null;
  orderId: string | null;
  updatedAt: string;
}

const view = (r: Record<string, unknown>): BookletChat => ({
  id: r.id as string,
  title: String(r.title ?? ""),
  audience: readAudience(r.audience),
  messages: (Array.isArray(r.messages) ? r.messages : []).filter((m): m is Turn => !!m && typeof m === "object" && (m.role === "user" || m.role === "assistant") && typeof m.text === "string"),
  spec: r.spec ? cleanSpec(r.spec) : null,
  orderId: (r.order_id as string | null) ?? null,
  updatedAt: String(r.updated_at ?? ""),
});

function tableMissing(e: { code?: string; message?: string } | null): never {
  if (e && (e.code === "42P01" || e.code === "PGRST205" || /booklet_chats|spec/.test(e.message ?? ""))) throw new UserError("«كتيب الجداول الذكي» قيد التجهيز (قاعدة البيانات). جرّب بعد شوي.", 503);
  throw new Error(e?.message ?? "database error");
}

export async function listChats(userId: string) {
  const { data, error } = await db().from("booklet_chats").select("id,title,updated_at,order_id").eq("user_id", userId).order("updated_at", { ascending: false }).limit(50);
  if (error) tableMissing(error);
  return (data ?? []).map((r) => ({ id: r.id as string, title: String(r.title || "كتيب جديد"), orderId: (r.order_id as string | null) ?? null, updatedAt: String(r.updated_at) }));
}

export async function getChat(userId: string, id: string): Promise<BookletChat | null> {
  const { data, error } = await db().from("booklet_chats").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) tableMissing(error);
  return data ? view(data) : null;
}

export async function deleteChat(userId: string, id: string) {
  await db().from("booklet_chats").delete().eq("id", id).eq("user_id", userId);
}

/** Two of the same role in a row become one turn, and the conversation starts with the person. */
function turnsOf(list: Turn[]): Turn[] {
  const out: Turn[] = [];
  for (const t of list) {
    const last = out[out.length - 1];
    if (last && last.role === t.role) last.text += `\n\n${t.text}`;
    else out.push({ ...t });
  }
  const cut = out.slice(-TB.historyTurns);
  while (cut.length && cut[0].role !== "user") cut.shift();
  return cut;
}

/** The person says something to «نور» (a new conversation when `chatId` is null, with who the booklet is for). */
export async function sayToNoor(user: { id: string; email?: string | null }, chatId: string | null, rawAudience: unknown, message: string): Promise<{ chat: BookletChat; usd: number }> {
  const said = message.trim().slice(0, TB.messageMax);
  if (!said) throw new UserError("اكتب رسالتك.");
  const before = chatId ? await getChat(user.id, chatId) : null;
  if (chatId && !before) throw new UserError("ما لقينا هذي المحادثة.", 404);
  const audience = before?.audience ?? readAudience(rawAudience);
  if (!audience) throw new UserError("اختر لمين الكتيب أول (العمر والاسم).");
  const history: Turn[] = [...(before?.messages ?? []), { role: "user", text: said }];
  const r = await talk({ system: [NOOR_RULES, audienceLine(audience), OPTIONS_RULE].join("\n\n"), turns: turnsOf(history), maxTokens: TB.maxTokens });
  const messages: Turn[] = [...history, { role: "assistant", text: r.text }];
  const spec = readSpec(r.text) ?? before?.spec ?? null;
  const row = { messages, spec, updated_at: new Date().toISOString() };
  if (before) {
    const { data: prev } = await db().from("booklet_chats").select("usd").eq("id", before.id).maybeSingle();
    const { data, error } = await db().from("booklet_chats").update({ ...row, usd: Number(prev?.usd ?? 0) + r.usd }).eq("id", before.id).eq("user_id", user.id).select("*").single();
    if (error) tableMissing(error);
    return { chat: view(data!), usd: r.usd };
  }
  const { data, error } = await db()
    .from("booklet_chats")
    .insert({ ...row, user_id: user.id, title: `كتيب ${audience.name}`, audience, usd: r.usd })
    .select("*")
    .single();
  if (error) tableMissing(error);
  return { chat: view(data!), usd: r.usd };
}

// ───────────────────────────── the price and the start ─────────────────────────────

/** What a booklet costs this person (halalas): its pictures at the site's prices; free for the owner and unlimited accounts. */
export async function bookletPrice(email: string | null | undefined, poses: number): Promise<{ halalas: number; free: boolean }> {
  await loadPricing();
  const usd = bookletUsd(poses);
  const halalas = usd > 0 ? coinsFor(usd) : 0;
  return { halalas, free: await unlimitedFor(email) };
}

export type StartRequest = { kind: "ready"; audience: unknown; style: unknown; message?: unknown } | { kind: "custom"; chatId: unknown };

/** «اصنع الكتيب»: the order made and paid; returns where the person goes next (their photo, or straight to the PDF). */
export async function startBooklet(user: { id: string; email?: string | null }, b: StartRequest): Promise<{ id: string; next: "upload" | "compose" }> {
  let audience: Audience;
  let design: BookletSpec | undefined;
  let style: string;
  let message = "";
  let chatId: string | null = null;
  if (b.kind === "ready") {
    const a = readAudience(b.audience);
    if (!a) throw new UserError("اكتب الاسم والعمر.");
    if (a.kind !== "child") throw new UserError("الكتيب الجاهز للأطفال؛ للكبار صمّم جداولك مع نور.");
    if (!isStyle(b.style)) throw new UserError("اختر الستايل.");
    audience = a;
    style = b.style;
    message = typeof b.message === "string" ? b.message.replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 140) : "";
  } else {
    chatId = typeof b.chatId === "string" && /^[0-9a-f-]{36}$/i.test(b.chatId) ? b.chatId : null;
    const chat = chatId ? await getChat(user.id, chatId) : null;
    if (!chat?.audience) throw new UserError("ما لقينا هذي المحادثة.", 404);
    if (!chat.spec) throw new UserError("كمّل التصميم مع نور أول، لين تكتب لك ملخص الكتيب.");
    audience = chat.audience;
    design = chat.spec;
    style = design.style;
    message = design.message;
  }
  const poses = design ? posesOf(design).length : READY_POSES;
  const price = await bookletPrice(user.email, poses);
  const { data, error } = await db()
    .from("orders")
    .insert({
      user_id: user.id,
      template_id: design ? TB.customTemplate : TB.readyTemplate,
      quality: "medium",
      style,
      child_name: audience.name,
      child_gender: legacyGender(audience),
      parent_message: message || null,
      amount_halalas: Math.max(1, price.halalas),
      attempts_allowed: ATTEMPTS_ALLOWED,
      is_trial: false,
      status: "paid",
      spec: { audience, ...(design ? { design } : {}) },
    })
    .select("id")
    .single();
  if (error) tableMissing(error);
  // paid at once (the owner and unlimited accounts make it free); refused clearly when the balance is short
  if (!price.free && price.halalas > 0) {
    try {
      await holdCoins(user.id, price.halalas, `booklet:${data!.id}`, `📘 ${TB.name}`);
    } catch (e) {
      await db().from("orders").delete().eq("id", data!.id);
      throw e;
    }
  }
  if (chatId) await db().from("booklet_chats").update({ order_id: data!.id }).eq("id", chatId).eq("user_id", user.id);
  return { id: data!.id as string, next: design && !design.photo ? "compose" : "upload" };
}

/** My booklets (the newest first). */
export async function myBooklets(userId: string) {
  const { data } = await db().from("orders").select("id,status,child_name,template_id,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
  return (data ?? []) as { id: string; status: Order["status"]; child_name: string | null; template_id: string; created_at: string }[];
}

/** Where an order of this branch stands, as a page under /jawad-ai/booklet/<id>. */
export function bookletStep(order: Order & { spec?: unknown }): string {
  const at = `${TB.base}/${order.id}`;
  const design = specOf(order)?.design;
  switch (order.status) {
    case "pending_payment":
      return TB.base;
    case "paid":
      // a designed booklet without a picture is drawn at once (its own page); otherwise the photo comes first
      return design && !design.photo ? at : `${at}/upload`;
    case "generating_character":
    case "awaiting_approval":
      return `${at}/character`;
    case "ready":
      return `${at}/download`;
    case "composing":
      return design && !design.photo ? at : `${at}/progress`;
    default:
      return `${at}/progress`;
  }
}
