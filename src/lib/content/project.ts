// «صانع المحتوى» — every conversation is a PROJECT (the owner, 23 Nov 2026: «يفتح مشروع لكل… مو بس مجرد محادثة»), like
// «صانع الأفلام»:
//  - a carousel GPT Image 2 makes whole (the picture and its writing at once) is one chat;
//  - a carousel «حيدرا ماكس» takes part in (GPT Image 2's pictures and his writing, his code alone, any motion carousel)
//    is TWO chats: the pictures are made and approved in the first («🖼️ الصور»), then the site writes a delivery message
//    («رسالة التسليم») from what was approved and the writing and the motion are made in the second («✍️ الكتابة
//    والموشن»). The person can go back to the first, change a picture, and it is handed on again.
//  - «خزان المراجع والثوابت»: what the project fixed, what the person removed, their written recommendations and the
//    references they liked. «محمد باقر» reads it before every turn and «حيدرا ماكس» with every slide.
// Both chats live in the same content_chats row (their turns are marked), so the slides, the files and the pending
// carousel stay where they are; the store is kept in content_kv by the chat's id. Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { findCarouselStyle } from "@config/content-carousel-styles";
import { findContentFont } from "@config/content-fonts";
import { findPalette } from "@config/content-palettes";
import { findMotionCarouselStyle, MOTION_ROUTES } from "@config/content-motion-carousel";
import type { Chat, PendingProduce, SlidesBlock, Turn } from "./chats";
import { stripMarks } from "./marks";

const db = () => createAdminClient();

// ───────── the two chats ─────────

export type Thread = "pictures" | "design";

/** The chat a turn belongs to. */
export const threadOf = (t: Turn): Thread => (t.thread === "design" ? "design" : "pictures");

/** Whether the project has its second chat already. */
export const hasDesign = (messages: Turn[]) => messages.some((t) => t.thread === "design");

/**
 * Which carousels are made in two chats: GPT Image 2's pictures with «حيدرا ماكس»'s writing, and every motion carousel.
 * One GPT Image 2 paints whole stays one chat, and so does a still one «حيدرا ماكس» makes alone, pictures and writing
 * at once (the owner, 23 Nov 2026: «حيدرة ماكس خله فالكاروسيل الصور والكتابة… محادثة وحدة»).
 */
export const twoChats = (p: Pick<PendingProduce, "maker" | "mix" | "motion">) => p.maker === "code" && (!!p.mix || !!p.motion);

/**
 * The turns «محمد باقر» is given in one chat: the first chat sees only its own talk; the second starts from the delivery
 * message (said to him as the person's, at the head of their first message there) and goes on with its own talk.
 */
export function threadTurns(history: Turn[], thread: Thread): Turn[] {
  if (!hasDesign(history)) return history;
  if (thread === "pictures") return history.filter((t) => t.thread !== "design");
  const out: Turn[] = [];
  let carry = "";
  for (const t of history) {
    if (t.thread !== "design") continue;
    if (t.handoff) {
      carry += `${carry ? "\n\n" : ""}📨 ${HANDOFF_FOR_HIM}\n${t.text}`;
      continue;
    }
    if (t.role === "user" && carry) {
      out.push({ ...t, text: `${carry}\n\n---\n${t.text}` });
      carry = "";
      continue;
    }
    if (t.role === "assistant" && !out.length) continue;
    out.push(t);
  }
  // nothing said in the second chat yet past the delivery: it is all he is given
  if (carry) out.push({ role: "user", text: carry, thread: "design" });
  return out;
}

const HANDOFF_FOR_HIM = "رسالة التسليم من محادثة الصور (كتبها الموقع مما اعتمده العميل؛ أنت الآن في المحادثة الثانية للمشروع: الكتابة والموشن. الصور معتمدة ولا تُرسم من جديد هنا إلا إذا طلب العميل ذلك صراحة):";

// ───────── «خزان المراجع والثوابت» ─────────

export interface StoreRef {
  /** the person's upload (jawad_uploads id) */
  id: string;
  name: string;
  note: string;
}

export interface ProjectStore {
  /** what the person fixed («ثبّته»): kept in every slide */
  approved: string[];
  /** what they do not want («شيله»): never used again */
  removed: string[];
  /** recommendations they wrote */
  notes: string[];
  /** references they liked (pictures) */
  refs: StoreRef[];
}

export const EMPTY_STORE: ProjectStore = { approved: [], removed: [], notes: [], refs: [] };
const LINES = 40;
const LINE = 400;

const storeKey = (chatId: string) => `content-store:${chatId}`;

const lines = (v: unknown) =>
  (Array.isArray(v) ? v : [])
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.replace(/\s+/g, " ").trim().slice(0, LINE))
    .filter(Boolean)
    .filter((x, i, a) => a.indexOf(x) === i)
    .slice(0, LINES);

/** A store from the page or from storage, checked. */
export function readStore(v: unknown): ProjectStore {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const refs = (Array.isArray(o.refs) ? o.refs : [])
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object" && typeof (r as { id?: unknown }).id === "string" && /^[0-9a-f-]{36}$/i.test(String((r as { id: string }).id)))
    .map((r) => ({ id: String(r.id), name: String(r.name ?? "").slice(0, 120), note: String(r.note ?? "").replace(/\s+/g, " ").trim().slice(0, LINE) }))
    .filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i)
    .slice(0, 12);
  return { approved: lines(o.approved), removed: lines(o.removed), notes: lines(o.notes), refs };
}

export async function getStore(chatId: string): Promise<ProjectStore> {
  const { data } = await db().from("content_kv").select("value").eq("key", storeKey(chatId)).maybeSingle();
  if (!data?.value) return { ...EMPTY_STORE };
  try {
    return readStore(JSON.parse(String(data.value)));
  } catch {
    return { ...EMPTY_STORE };
  }
}

export async function saveStore(chatId: string, store: ProjectStore): Promise<ProjectStore> {
  const clean = readStore(store);
  const { error } = await db().from("content_kv").upsert({ key: storeKey(chatId), value: JSON.stringify(clean), updated_at: new Date().toISOString() });
  if (error) throw error;
  return clean;
}

export async function deleteStore(chatId: string) {
  await db().from("content_kv").delete().eq("key", storeKey(chatId));
}

/** Lines «محمد باقر» added to the store in his answer (what the person fixed, removed or recommended, said in words). */
export function addToStore(store: ProjectStore, adds: unknown): { store: ProjectStore; changed: boolean } {
  const next: ProjectStore = { ...store, approved: [...store.approved], removed: [...store.removed], notes: [...store.notes] };
  let changed = false;
  for (const a of Array.isArray(adds) ? adds : []) {
    if (!a || typeof a !== "object") continue;
    const kind = (a as { kind?: unknown }).kind;
    const text = String((a as { text?: unknown }).text ?? "").replace(/\s+/g, " ").trim().slice(0, LINE);
    if (!text) continue;
    const list = kind === "approved" ? next.approved : kind === "removed" ? next.removed : kind === "note" ? next.notes : null;
    if (!list || list.includes(text) || list.length >= LINES) continue;
    list.push(text);
    // something removed is no longer fixed (and the other way round)
    if (kind === "removed") next.approved = next.approved.filter((x) => x !== text);
    if (kind === "approved") next.removed = next.removed.filter((x) => x !== text);
    changed = true;
  }
  return { store: next, changed };
}

/** What the site fixed by itself from the choices (the look), shown in the store and handed on. */
export function lookLines(b: Pick<SlidesBlock, "carouselId" | "paletteId" | "fontId" | "motion" | "maker" | "mix"> | null): string[] {
  if (!b) return [];
  const car = b.carouselId ? findCarouselStyle(b.carouselId) : null;
  const pal = b.paletteId ? findPalette(b.paletteId) : null;
  const font = b.fontId ? findContentFont(b.fontId) : null;
  const ms = b.motion ? (b.motion.styleId === "own" ? null : findMotionCarouselStyle(b.motion.styleId)) : null;
  const route = b.motion ? MOTION_ROUTES.find((r) => r.id === b.motion!.route) : null;
  return [
    car ? `ستايل الكاروسيل: ${car.name}` : "",
    car ? `الألوان: ${pal ? pal.name : "ألوان الستايل نفسه"}` : "",
    font ? `الخط: ${font.name}` : "",
    b.motion ? `موشن كاروسيل: ${ms ? ms.name : "حركة خاصة"}${route ? ` · ${route.label}` : ""}` : car ? "كاروسيل ثابت" : "",
    b.maker === "code" ? (b.mix ? "التصميم: GPT Image 2 للصور + حيدرا ماكس للكتابة" : b.motion ? "" : "التصميم: حيدرا ماكس بالكود") : car ? "التصميم: GPT Image 2 يرسم الشريحة كاملة" : "",
  ].filter(Boolean);
}

/** The store as «محمد باقر» reads it at the head of every turn ("" when it is empty). */
export function storeNote(store: ProjectStore, look: string[]): string {
  const has = store.approved.length || store.removed.length || store.notes.length || store.refs.length;
  if (!has && !look.length) return "";
  const list = (xs: string[]) => xs.map((x) => `- ${x}`).join("\n");
  return [
    "[خزان المراجع والثوابت لهذا المشروع: اقرأه قبل أي تصنيع والتزم به في كل شريحة ونص وصورة. لا تخالف المعتمد، ولا ترجع أبدًا لشيء من المشال. إذا ثبّت العميل شيئًا أو قال إنه لا يريد شيئًا أو أعطى توصية عامة للمشروع، أضفه في store.]",
    look.length ? `ثبّته الموقع من اختياراته:\n${list(look)}` : "",
    store.approved.length ? `المعتمد (ثابت):\n${list(store.approved)}` : "",
    store.removed.length ? `المشال (لا يُستخدم أبدًا):\n${list(store.removed)}` : "",
    store.notes.length ? `توصيات العميل المكتوبة:\n${list(store.notes)}` : "",
    store.refs.length ? `مراجع عجبته (صور مرفقة معك للإلهام في الشكل فقط، لا تنسخ محتواها):\n${list(store.refs.map((r) => `${r.name}${r.note ? `: ${r.note}` : ""}`))}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** The store as «حيدرا ماكس» and GPT Image 2 are told it with every slide ("" when nothing). */
export function storeBrief(store: ProjectStore): string {
  const parts = [
    store.approved.length ? `FIXED BY THE PERSON (keep it in this slide): ${store.approved.join(" | ")}` : "",
    store.removed.length ? `REMOVED BY THE PERSON (never use any of it): ${store.removed.join(" | ")}` : "",
    store.notes.length ? `THE PERSON'S RECOMMENDATIONS: ${store.notes.join(" | ")}` : "",
  ].filter(Boolean);
  return parts.length ? `THE PROJECT'S STORE OF REFERENCES AND CONSTANTS (the person's own rules for every slide):\n${parts.join("\n")}` : "";
}

// ───────── the delivery message (رسالة التسليم) ─────────

const ar = (n: number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

/** The block of the pictures waiting in the first chat (the last block of the first chat), or -1. */
export function picturesAt(messages: Turn[]): number {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].thread !== "design" && messages[i].slides) return i;
  return -1;
}

/** The last block of the second chat, or -1. */
export function designAt(messages: Turn[]): number {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].thread === "design" && messages[i].slides) return i;
  return -1;
}

/**
 * The pictures are approved in a two-chat carousel: the site writes the delivery message from what was approved (no
 * model call) and opens the second chat with it — or, when it is open already (a picture was changed), hands on the
 * update. The carousel goes on being made there: `p.at` moves to the new message. Returns the new messages.
 */
export function handOff(chat: Pick<Chat, "title" | "record">, messages: Turn[], p: PendingProduce, store: ProjectStore): Turn[] {
  const out = [...messages];
  const at = Math.min(p.at, out.length - 1);
  const block = out[at]?.slides;
  if (!block) return out;
  // the pictures' block in the first chat: approved, handed on
  if (out[at].thread !== "design") out[at] = { ...out[at], slides: { ...block, approved: true, running: false, phase: undefined } };
  // (a NEW carousel ordered in the first chat gets its own delivery message)
  const again = hasDesign(out) && p.mode === "fix";
  const ns = p.slides.map((s) => s.n).sort((a, b) => a - b);
  const look = lookLines({ ...block, maker: p.maker, mix: p.mix, motion: p.motion, carouselId: p.carouselId, paletteId: p.paletteId, fontId: p.fontId });
  let text: string;
  let slides: SlidesBlock;
  if (again) {
    // an update of pictures already handed on: the second chat's carousel, those slides made again over their new pictures
    const d = designAt(out);
    const last = d >= 0 ? out[d].slides! : block;
    text = [
      `📨 **تحديث من محادثة الصور**`,
      `اعتمدت صورة ${ns.length === 1 ? `الشريحة ${ar(ns[0])}` : `الشرائح (${ns.map(ar).join("، ")})`} من جديد، فحيدرا ماكس يعيد ${p.motion ? "تصميمها وتحريكها" : "تصميمها"} الحين فوق الصورة الجديدة. باقي الشرائح كما هي.`,
    ].join("\n\n");
    slides = { ...last, todo: ns, running: true, report: undefined, approved: undefined, phase: undefined };
  } else {
    const record = stripMarks(chat.record || "").trim();
    text = [
      `📨 **رسالة التسليم من محادثة الصور**`,
      `**المشروع:** ${chat.title || "كاروسيل"}`,
      record ? `**الملخص:** ${record.length > 700 ? `${record.slice(0, 700)}…` : record}` : "",
      look.length ? `**الشكل المعتمد:**\n${look.map((x) => `- ${x}`).join("\n")}` : "",
      `**الصور المعتمدة:** ${ar(ns.length)} ${ns.length === 1 ? "صورة" : "صور"} ✅`,
      `**نصوص الشرائح:**\n${p.slides.map((s) => `${ar(s.n)}. ${s.text.replace(/\s+/g, " ").trim().slice(0, 300) || "—"}`).join("\n")}`,
      store.approved.length || store.removed.length || store.notes.length
        ? `**من خزان المراجع والثوابت:**\n${[...store.approved.map((x) => `- ثابت: ${x}`), ...store.removed.map((x) => `- مشال: ${x}`), ...store.notes.map((x) => `- توصية: ${x}`)].join("\n")}`
        : "",
      `حيدرا ماكس يبدأ الحين ${p.motion ? "يكتب ويحرّك" : "يكتب ويصمّم"} كل شريحة فوق صورتها المعتمدة. تبي تغيّر صورة؟ ارجع لمحادثة «🖼️ الصور» وعدّلها، والتعديل يوصل هنا.`,
    ]
      .filter(Boolean)
      .join("\n\n");
    slides = { ...block, items: [...block.items], todo: ns, running: true, report: undefined, approved: undefined, phase: undefined };
  }
  out.push({ role: "assistant", text, thread: "design", handoff: true, slides });
  p.at = out.length - 1;
  p.picturesOk = true;
  return out;
}
