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
  /** built-in packages the owner deleted on purpose (they are not added back) */
  removed?: string[];
}

/**
 * «المشهد السينمائي» (owner, 17 October 2026; re-priced with the margins of 21 October 2026, and Claude's 60٪ of
 * 26 October 2026): the balance one cinematic scene costs, end to end, at the owner's usual margins (videos 40٪, GPT Image 2
 * pictures 30٪, Claude its real cost + 60٪) —
 * the owner's basis: Seedance 2.0 at its 15-second limit in 480p, ONE take (¤6), 4 sheets with no redraws (¤8), and ONE
 * reply each from the screenwriter, the sheet maker and the director plus the small helpers, at what the film code
 * reserves for each (¤16.20 at 60٪) = ¤30.20, rounded up to the whole riyal (the owner's cap: never above ¤50). The trial is ¤10.
 */
export const SCENE_PACK_SAR = 31;

/**
 * «الطالب الذكي» (owner, 18 October 2026): ¤12 — one PDF of 5–10 pages turned into ONE output (a summary or an
 * explanation, the ready template, no generated pictures). Measured on the site's real student projects: a short one
 * end to end (reading, understanding, plan, writing) came to ¤2.40–¤8 at the owner's margins (Claude its cost + 40٪),
 * so ¤12 makes one comfortably, often two. Paid after use: nothing is held, each step takes what it really cost.
 */
export const STUDENT_PACK_SAR = 12;
/** What one short PDF → one summary costs on average (halalas), for «تقدر تسوي فيها». */
export const STUDENT_SUMMARY_HALALAS = 600;

/** What one of each thing costs now (halalas), for «تقدر تسوي فيها»: a standard picture, a 5-second 720p video, a scene, a study summary. */
export interface UnitPrices {
  image: number;
  video5: number;
  scene: number;
  /** one short PDF (5–10 pages) → one summary in «الطالب الذكي» */
  summary: number;
}
/** How many of each a package's balance makes (each on its own: pictures OR videos OR scenes). */
export function packYield(creditSar: number, u: UnitPrices) {
  const h = creditSar * 100;
  const n = (unit: number) => (unit > 0 ? Math.floor(h / unit) : 0);
  return { images: n(u.image), videos: n(u.video5), scenes: n(u.scene), summaries: n(u.summary) };
}

export const DEFAULT_PACKS: Pack[] = [
  { id: "try", name: "تجربة", price: 10, credit: 10, tag: "", note: "تجرب فيها الأقسام" },
  { id: "scene", name: "المشهد السينمائي", price: SCENE_PACK_SAR, credit: SCENE_PACK_SAR, tag: "", note: "مشهد ١٥ ثانية كامل: سيناريو، ٤ شيتات، فيديو 480p" },
  { id: "student", name: "الطالب الذكي", price: STUDENT_PACK_SAR, credit: STUDENT_PACK_SAR, tag: "", note: "ملخص أو شرح من ملف PDF قصير (٥–١٠ صفحات)" },
  { id: "basic", name: "الأساسية", price: 99, credit: 100, tag: "", note: "للاستخدام الخفيف" },
  { id: "pro", name: "المحترف", price: 119, credit: 140, tag: "الأكثر طلبًا", note: "صور وفيديوهات أسبوعية" },
  { id: "studio", name: "الاستوديو", price: 279, credit: 330, tag: "", note: "لصنّاع المحتوى" },
  { id: "business", name: "الأعمال", price: 549, credit: 660, tag: "أفضل قيمة", note: "للمتاجر والفرق" },
];

/** Built-in packages added after owners had saved their own list: they appear in a saved list too (see readCreditSettings). */
export const LATER_PACKS = ["scene", "student"] as const;

export const DEFAULT_CREDIT_SETTINGS: CreditSettings = { packs: DEFAULT_PACKS, featured: "pro", whatsapp: "" };

export const CREDITS = {
  base: "/jawad-ai/credits",
  /** how many packages at most */
  maxPacks: 9,
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
  const removed = (Array.isArray(o.removed) ? o.removed : []).filter((x): x is string => typeof x === "string").slice(0, 20);
  // packages the owner ordered AFTER the saved list was made (the student's ¤12, the scene): added in their place, unless he deleted them
  if (packs.length) {
    for (const id of LATER_PACKS) {
      if (packs.some((p) => p.id === id) || removed.includes(id) || packs.length >= CREDITS.maxPacks) continue;
      const d = DEFAULT_PACKS.find((p) => p.id === id)!;
      const at = packs.findIndex((p) => p.price > d.price);
      packs.splice(at < 0 ? packs.length : at, 0, { ...d });
    }
  }
  const list = packs.length ? packs : DEFAULT_PACKS;
  const featured = typeof o.featured === "string" && list.some((p) => p.id === o.featured) ? o.featured : list[Math.min(2, list.length - 1)].id;
  return { packs: list, featured, whatsapp: cleanPhone(o.whatsapp) ?? "", removed };
}

/**
 * «بمقدار اللي تحتاجه» (the owner, 26 October 2026): when the wallet runs out, a top-up of exactly what the operation
 * needs — whole riyals (the orders keep riyals), 1 to 1000 — beside the packages. Its id carries the amount: exact-<riyals>.
 */
export const EXACT_MAX_SAR = 1000;
export const exactSar = (halalas: number) => Math.min(EXACT_MAX_SAR, Math.max(1, Math.ceil(Math.max(0, halalas) / 100 - 1e-9)));
export const exactPack = (sar: number): Pack => ({ id: `exact-${sar}`, name: "بمقدار اللي تحتاجه", price: sar, credit: sar, tag: "", note: "شحن بمقدار العملية بس" });
export function exactPackOf(id: unknown): Pack | null {
  const m = typeof id === "string" ? /^exact-(\d{1,4})$/.exec(id) : null;
  const sar = m ? Number(m[1]) : 0;
  return sar >= 1 && sar <= EXACT_MAX_SAR ? exactPack(sar) : null;
}
export const packOf = (s: CreditSettings, id: unknown) => s.packs.find((p) => p.id === id) ?? exactPackOf(id);

/** «طال الوقت؟»: a WhatsApp chat with the owner, the message already written. */
export function supportLink(s: CreditSettings, o: { id: string; packName: string; price: number; email: string }): string {
  if (!s.whatsapp) return "";
  return waLink(s.whatsapp, `السلام عليكم، حوّلت لشحن رصيدي في الجواد الذكي.\nالباقة: ${o.packName} (${o.price})\nالإيميل: ${o.email}\nرقم الطلب: ${o.id.slice(0, 8)}`);
}
