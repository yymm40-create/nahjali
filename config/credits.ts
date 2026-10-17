// «اشحن رصيدك» — the packages of balance sold by bank transfer (like the course: the buyer transfers and presses «تم التحويل», the
// owner's Telegram buzzes, his «✅» adds the balance to the buyer's wallet at once). Pure: the defaults and the checks of what the
// owner sets in /admin/credits (stored in jawad_settings under "credits").
//
// The ladder follows how the big AI studios price their credits (Higgsfield, OpenArt: a cheap way in, the tiers growing with more
// credit per riyal, one highlighted «most popular» in the middle), with the owner's push to the next package: the first very cheap
// (a try), the second high with almost no extra, the third only a little dearer than the second but with much more — so the second
// makes the third look obvious. The extra balance stays modest: every riyal of balance already carries the site's margin, so a
// bonus above ~25% would sell under cost.

import { cleanPhone, waLink } from "./course";

export interface Pack {
  id: string;
  name: string;
  /** what the buyer transfers (riyals) */
  price: number;
  /** what lands in the wallet (riyals) */
  credit: number;
  /** a small badge («الأكثر طلبًا», «أفضل قيمة»), or "" */
  tag: string;
  /** one short line under the name, or "" */
  note: string;
}

export interface CreditSettings {
  packs: Pack[];
  /** the package drawn bigger in the middle */
  featured: string;
  /** the owner's WhatsApp number for «طال الوقت؟ راسلنا» (empty: the link is not shown) */
  whatsapp: string;
}

/**
 * «المشهد السينمائي» (owner, 17 October 2026): the balance one cinematic scene costs, end to end, at the owner's
 * margins (videos 40٪, pictures 60٪, Claude its real cost + 10٪) — Seedance 2.0 at its 15-second limit in 720p with
 * one redo (2 takes, ¤24.50), 4 sheets with 2 redraws and 2 style tests (¤16), and the robots' replies at what the film
 * code reserves for each (screenwriter 4, sheet maker 5, director 3, small helpers: ¤40.02) = ¤80.52, rounded up to the
 * whole riyal. (480p would be ¤67.52, 1080p ¤115.52.) The trial is ¤10 (the ¤19 one is gone).
 */
export const SCENE_PACK_SAR = 81;

/** What one of each thing costs now (halalas), for «تقدر تسوي فيها»: a standard picture, a 5-second 720p video, a scene. */
export interface UnitPrices {
  image: number;
  video5: number;
  scene: number;
}
/** How many of each a package's balance makes (each on its own: pictures OR videos OR scenes). */
export function packYield(creditSar: number, u: UnitPrices) {
  const h = creditSar * 100;
  const n = (unit: number) => (unit > 0 ? Math.floor(h / unit) : 0);
  return { images: n(u.image), videos: n(u.video5), scenes: n(u.scene) };
}

export const DEFAULT_PACKS: Pack[] = [
  { id: "try", name: "تجربة", price: 10, credit: 10, tag: "", note: "تجرب فيها الأقسام" },
  { id: "scene", name: "المشهد السينمائي", price: SCENE_PACK_SAR, credit: SCENE_PACK_SAR, tag: "", note: "مشهد ١٥ ثانية كامل: سيناريو، ٤ شيتات، فيديو 720p مع إعادة" },
  { id: "basic", name: "الأساسية", price: 99, credit: 100, tag: "", note: "للاستخدام الخفيف" },
  { id: "pro", name: "المحترف", price: 119, credit: 140, tag: "الأكثر طلبًا", note: "صور وفيديوهات أسبوعية" },
  { id: "studio", name: "الاستوديو", price: 279, credit: 330, tag: "", note: "لصنّاع المحتوى" },
  { id: "business", name: "الأعمال", price: 549, credit: 660, tag: "أفضل قيمة", note: "للمتاجر والفرق" },
];

export const DEFAULT_CREDIT_SETTINGS: CreditSettings = { packs: DEFAULT_PACKS, featured: "pro", whatsapp: "" };

export const CREDITS = {
  base: "/jawad-ai/credits",
  /** how many packages at most */
  maxPacks: 6,
  /** open orders (not confirmed nor rejected) one person may have */
  maxOpen: 4,
} as const;

/** The extra balance in percent («+18٪ مجانًا»). */
export const bonusPct = (p: Pick<Pack, "price" | "credit">) => (p.credit > p.price && p.price > 0 ? Math.round((p.credit / p.price - 1) * 100) : 0);

const int = (v: unknown, lo: number, hi: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
};
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** What the owner saved (or nothing), checked and filled with the defaults. */
export function readCreditSettings(raw: unknown): CreditSettings {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const seen = new Set<string>();
  const packs: Pack[] = [];
  for (const x of Array.isArray(o.packs) ? o.packs : []) {
    if (!x || typeof x !== "object") continue;
    const p = x as Record<string, unknown>;
    const id = text(p.id, 24).toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const price = int(p.price, 1, 100_000);
    const credit = int(p.credit, 1, 200_000);
    const name = text(p.name, 30);
    if (!id || seen.has(id) || !price || !credit || !name) continue;
    seen.add(id);
    packs.push({ id, name, price, credit, tag: text(p.tag, 20), note: text(p.note, 60) });
    if (packs.length >= CREDITS.maxPacks) break;
  }
  const list = packs.length ? packs : DEFAULT_PACKS;
  const featured = typeof o.featured === "string" && list.some((p) => p.id === o.featured) ? o.featured : list[Math.min(2, list.length - 1)].id;
  return { packs: list, featured, whatsapp: cleanPhone(o.whatsapp) ?? "" };
}

export const packOf = (s: CreditSettings, id: unknown) => s.packs.find((p) => p.id === id) ?? null;

/** «طال الوقت؟»: a WhatsApp chat with the owner, the message already written. */
export function supportLink(s: CreditSettings, o: { id: string; packName: string; price: number; email: string }): string {
  if (!s.whatsapp) return "";
  return waLink(s.whatsapp, `السلام عليكم، حوّلت لشحن رصيدي في الجواد الذكي.\nالباقة: ${o.packName} (${o.price})\nالإيميل: ${o.email}\nرقم الطلب: ${o.id.slice(0, 8)}`);
}
