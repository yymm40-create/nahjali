// «اشحن رصيدك» — the packages of balance sold by bank transfer (like the course: the buyer transfers and presses «تم التحويل», the
// owner's Telegram buzzes, his «✅» adds the balance to the buyer's wallet at once). Pure: the defaults and the checks of what the
// owner sets in /admin/credits (stored in jawad_settings under "credits").
//
// The ladder follows how the big AI studios price their credits (Higgsfield, OpenArt: a cheap way in, the tiers growing with more
// credit per riyal, one highlighted «most popular» in the middle). No package gives extra balance (the owner, 1 November 2026):
// every riyal transferred is exactly one riyal of balance — every riyal of balance already carries the site's margin, and an
// extra on top ate it (on Claude's work a +18٪ left ~26٪ instead of 37.5٪).

import { cleanPhone, waLink } from "./course";

export interface Pack {
  id: string;
  name: string;
  /** what the buyer transfers (riyals) */
  price: number;
  /** what lands in the wallet (riyals): always the price — no package gives extra balance */
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
  /** «كود خصم» on a top-up: the owner's codes (each a percent off the price, until a moment); never sent to the browser */
  codes?: TopupCode[];
}

/**
 * «كود خصم الشحن» (the owner, 12 November 2026: «عطهم خصم ١٥٪ إذا سجّلوا خلال ٢٤ ساعة»): a code takes `pct` percent off what is
 * paid for a top-up, while the balance stays the package's full one. It works until `until`, once per account (a confirmed order
 * carries the code in its package name). The price is whole riyals (the orders keep riyals), rounded DOWN — in the buyer's favour.
 */
export interface TopupCode {
  code: string;
  /** percent off, 1–90 */
  pct: number;
  /** ISO moment it stops working */
  until: string;
}
export const TOPUP_CODE_RE = /^[A-Z0-9_-]{3,24}$/;
export const cleanCode = (raw: unknown) => String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
/** The price after a code: whole riyals, rounded down, at least one. */
export const discounted = (price: number, pct: number) => Math.max(1, Math.floor((price * (100 - pct)) / 100 + 1e-9));
/** The words a code leaves in the order's package name (how «once per account» is checked). */
export const codeMark = (code: string) => `كود ${code}`;
/** The code that works now for what the person typed, or null. */
export function activeCode(s: Pick<CreditSettings, "codes">, raw: unknown, now = Date.now()): TopupCode | null {
  const code = cleanCode(raw);
  if (!TOPUP_CODE_RE.test(code)) return null;
  const c = (s.codes ?? []).find((x) => x.code === code);
  return c && Date.parse(c.until) > now ? c : null;
}
function readCodes(v: unknown): TopupCode[] {
  const out: TopupCode[] = [];
  for (const x of Array.isArray(v) ? v : []) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const code = cleanCode(o.code);
    const pct = Math.round(Number(o.pct));
    const until = typeof o.until === "string" && Number.isFinite(Date.parse(o.until)) ? new Date(o.until).toISOString() : "";
    if (!TOPUP_CODE_RE.test(code) || !(pct >= 1 && pct <= 90) || !until || out.some((c) => c.code === code)) continue;
    out.push({ code, pct, until });
    if (out.length >= 30) break;
  }
  return out;
}

/**
 * «المشهد السينمائي» (owner, 17 October 2026; re-priced with the margins of 13 November 2026: 60٪ on everything, Claude
 * its real cost + 30٪): the balance one cinematic scene costs, end to end —
 * the owner's basis: Seedance 2.0 at its 15-second limit in 480p, ONE take, 4 sheets with no redraws, and ONE reply
 * each from the screenwriter, the sheet maker and the director plus the small helpers, at what the film code reserves
 * for each = ¤29.68, rounded up to the whole riyal (the owner's cap: never above ¤50). The trial is ¤10.
 */
export const SCENE_PACK_SAR = 30;

/**
 * «الطالب الذكي» (owner, 18 October 2026): ¤12 — one PDF of 5–10 pages turned into ONE output (a summary or an
 * explanation, the ready template, no generated pictures). Measured on the site's real student projects: a short one
 * end to end (reading, understanding, plan, writing) came to ¤2.40–¤8 at the owner's margins of then (Claude its cost + 40٪; cheaper now at + 30٪),
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
  { id: "basic", name: "الأساسية", price: 99, credit: 99, tag: "", note: "للاستخدام الخفيف" },
  { id: "pro", name: "المحترف", price: 119, credit: 119, tag: "الأكثر طلبًا", note: "صور وفيديوهات أسبوعية" },
  { id: "studio", name: "الاستوديو", price: 279, credit: 279, tag: "", note: "لصنّاع المحتوى" },
  { id: "business", name: "الأعمال", price: 549, credit: 549, tag: "أفضل قيمة", note: "للمتاجر والفرق" },
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
    const name = text(p.name, 30);
    if (!id || seen.has(id) || !price || !name) continue;
    seen.add(id);
    // no extra balance, even in a list saved while packages still had one: the balance is the price
    packs.push({ id, name, price, credit: price, tag: text(p.tag, 20), note: text(p.note, 60) });
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
  return { packs: list, featured, whatsapp: cleanPhone(o.whatsapp) ?? "", removed, codes: readCodes(o.codes) };
}

/**
 * «بمقدار اللي تحتاجه» (the owner, 26 October 2026): when the wallet runs out, a top-up of exactly what the operation
 * needs — whole riyals (the orders keep riyals), 3 to 1000 — beside the packages. Its id carries the amount: exact-<riyals>.
 */
// the smallest is 3 riyals (the owner, 28 October 2026): the payment gateway takes a fixed fee on every transaction
export const EXACT_MIN_SAR = 3;
/** «اختر الرصيد اللي تبي تدفعه» (the owner, 4 November 2026: «لو اختار ١ يجيه ١»): any whole riyals from 1, the same exact-<riyals> order. */
export const CUSTOM_MIN_SAR = 1;
export const EXACT_MAX_SAR = 1000;
export const exactSar = (halalas: number) => Math.min(EXACT_MAX_SAR, Math.max(EXACT_MIN_SAR, Math.ceil(Math.max(0, halalas) / 100 - 1e-9)));
export const exactPack = (sar: number): Pack => ({ id: `exact-${sar}`, name: "بمقدار اللي تحتاجه", price: sar, credit: sar, tag: "", note: "شحن بمقدار العملية بس" });
export function exactPackOf(id: unknown): Pack | null {
  const m = typeof id === "string" ? /^exact-(\d{1,4})$/.exec(id) : null;
  const sar = m ? Number(m[1]) : 0;
  return sar >= CUSTOM_MIN_SAR && sar <= EXACT_MAX_SAR ? exactPack(sar) : null;
}
export const packOf = (s: CreditSettings, id: unknown) => s.packs.find((p) => p.id === id) ?? exactPackOf(id);

/** «طال الوقت؟»: a WhatsApp chat with the owner, the message already written. */
export function supportLink(s: CreditSettings, o: { id: string; packName: string; price: number; email: string }): string {
  if (!s.whatsapp) return "";
  return waLink(s.whatsapp, `السلام عليكم، حوّلت لشحن رصيدي في الجواد الذكي.\nالباقة: ${o.packName} (${o.price})\nالإيميل: ${o.email}\nرقم الطلب: ${o.id.slice(0, 8)}`);
}
