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

export const DEFAULT_PACKS: Pack[] = [
  { id: "try", name: "تجربة", price: 19, credit: 19, tag: "", note: "تجرب فيها الأقسام" },
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
