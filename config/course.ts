// «دورة الجواد الذكي» — the owner's course about JAWAD AI itself, sold from one public page (/jawad-ai/course) by bank
// transfer. The price climbs with the HOURS since the owner's reel came out (he starts the clock in /admin/course):
//   first 24 h   ONE offer: the whole course (live + recorded) for a launch price
//   24 h – 48 h  two offers: live (still the launch price) and recorded (higher, with a gift of «زهرات»)
//   after 48 h   live goes up, recorded goes up again, the gift stays
// «زهرة» is the gift's name: 1 زهرة = 1 riyal of free balance in the site. Everything here is a DEFAULT the owner edits;
// the numbers are his words (live was 80, recorded was 150; launch 40; then 80/100). Pure (page and server alike).

import { COIN_MARK } from "./coins";

export const COURSE = {
  base: "/jawad-ai/course",
  name: "دورة الجواد الذكي",
  /** how long the price a person saw at «ادفع الآن» is kept for their transfer (minutes) */
  lockMinutes: 180,
  /** the most orders a person may have open (started, waiting for the owner) at once */
  maxOpen: 4,
} as const;

export type Product = "combo" | "live" | "recorded";
export const PRODUCTS: Product[] = ["combo", "live", "recorded"];
export const isProduct = (v: unknown): v is Product => typeof v === "string" && (PRODUCTS as string[]).includes(v);
export const PRODUCT_LABEL: Record<Product, string> = { combo: "الدورة كاملة (مباشرة + مسجلة)", live: "الدورة المباشرة", recorded: "الدورة المسجلة" };

export type Phase = "soon" | "A" | "B" | "C";

export interface Day {
  title: string;
  points: string[];
}

export interface Bank {
  holder: string;
  iban: string;
  account: string;
  swift: string;
  bank: string;
}

export interface CourseSettings {
  /** when the reel came out: the clock of the three prices (ISO); null = not started (the page says «قريبًا») */
  launchAt: string | null;
  /** hours after launch when the first / second price ends */
  hoursA: number;
  hoursB: number;
  prices: { comboA: number; liveB: number; recordedB: number; liveC: number; recordedC: number };
  /** the usual prices (struck through when the price is lower) */
  was: { live: number; recorded: number };
  /** the gift of زهرات (riyals of balance) that comes with an offer; 0 = none */
  bonus: { comboA: number; recordedB: number; recordedC: number };
  headline: string;
  subhead: string;
  problem: string;
  days: Day[];
  risks: string[];
  /** a file in the public bucket (the owner's reel), or an outside link (YouTube, Instagram, a direct video) */
  videoPath: string | null;
  videoUrl: string;
  posterPath: string | null;
  /** shown only to those whose payment is confirmed */
  groupLink: string;
  recordedLink: string;
  bank: Bank;
}

export const DEFAULT_SETTINGS: CourseSettings = {
  launchAt: null,
  hoursA: 24,
  hoursB: 48,
  prices: { comboA: 40, liveB: 40, recordedB: 80, liveC: 80, recordedC: 100 },
  was: { live: 80, recorded: 150 },
  bonus: { comboA: 0, recordedB: 0, recordedC: 0 },
  headline: "تشتغل على الجواد الذكي بثقة في ٣ أيام: تسوي صورك وفيديوهاتك وتصاميمك بنفسك، وتعرف وين تصرف رصيدك",
  subhead: "دورة عملية عن الجواد الذكي نفسه: الموقع وأقسامه وروبوتاته وعروضه، من أول خطوة لين تسوي شغلك أنت.",
  problem: "تفتح الأدوات الذكية وتضيع بين عشرات الخيارات، وتصرف رصيدك على تجارب ما تطلع لك، وكل مرة تبدأ من الصفر. اللي يعرف الطريق يوصل أسرع بتكلفة أقل.",
  days: [
    { title: "اليوم الأول: تعرّف على الجواد", points: ["الأقسام وكيف تتنقل بينها", "النقود الذكية: كيف تُحسب الأسعار وكيف توفّر", "صناعة الصور والفيديو والصوت خطوة بخطوة"] },
    { title: "اليوم الثاني: الأفلام والمونتاج", points: ["صانع الأفلام: من الفكرة للمشهد", "التعديل الذكي وحيدرة كت", "كيف تتجنب الأخطاء اللي تحرق الرصيد"] },
    { title: "اليوم الثالث: الروبوتات والعروض", points: ["محمد باقر لمحتواك، وكاظم لتصاميمك، وزهراء لتحرير صورك", "التنقل بين الروبوتات وحفظ شغلك", "خطة استخدام تناسبك وعروض الموقع"] },
  ],
  risks: ["الدورة مدى الحياة، مباشرة كانت أو مسجلة", "مجموعة خاصة للمتابعة والأسئلة بعد الدورة", "تواصل مباشر معي لو واجهتك مشكلة"],
  videoPath: null,
  videoUrl: "",
  posterPath: null,
  groupLink: "",
  recordedLink: "",
  bank: { holder: "", iban: "", account: "", swift: "", bank: "" },
};

// ───────────────────────────── reading ─────────────────────────────

const num = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : d;
};
const text = (v: unknown, max: number, d = "") => (typeof v === "string" ? v.trim().slice(0, max) : d);
const link = (v: unknown) => {
  const s = text(v, 500);
  if (!s) return "";
  try {
    const u = new URL(s);
    return u.protocol === "https:" && !/[\s<>"']/.test(s) ? u.toString() : "";
  } catch {
    return "";
  }
};

/** Settings from storage or from the dashboard, checked and filled with the defaults. */
export function readSettings(raw: unknown): CourseSettings {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_SETTINGS;
  const pr = (o.prices && typeof o.prices === "object" ? o.prices : {}) as Record<string, unknown>;
  const wa = (o.was && typeof o.was === "object" ? o.was : {}) as Record<string, unknown>;
  const bo = (o.bonus && typeof o.bonus === "object" ? o.bonus : {}) as Record<string, unknown>;
  const bk = (o.bank && typeof o.bank === "object" ? o.bank : {}) as Record<string, unknown>;
  const launch = typeof o.launchAt === "string" && !Number.isNaN(new Date(o.launchAt).getTime()) ? new Date(o.launchAt).toISOString() : null;
  const hoursA = num(o.hoursA, 1, 720, d.hoursA);
  const days = (Array.isArray(o.days) ? o.days : d.days)
    .map((x) => {
      const y = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
      return { title: text(y.title, 120), points: (Array.isArray(y.points) ? y.points : []).map((p) => text(p, 200)).filter(Boolean).slice(0, 12) };
    })
    .filter((x) => x.title)
    .slice(0, 10);
  return {
    launchAt: launch,
    hoursA,
    hoursB: Math.max(hoursA + 1, num(o.hoursB, 2, 2000, d.hoursB)),
    prices: {
      comboA: num(pr.comboA, 1, 100000, d.prices.comboA),
      liveB: num(pr.liveB, 1, 100000, d.prices.liveB),
      recordedB: num(pr.recordedB, 1, 100000, d.prices.recordedB),
      liveC: num(pr.liveC, 1, 100000, d.prices.liveC),
      recordedC: num(pr.recordedC, 1, 100000, d.prices.recordedC),
    },
    was: { live: num(wa.live, 1, 100000, d.was.live), recorded: num(wa.recorded, 1, 100000, d.was.recorded) },
    bonus: { comboA: num(bo.comboA, 0, 100000, 0), recordedB: num(bo.recordedB, 0, 100000, 0), recordedC: num(bo.recordedC, 0, 100000, 0) },
    headline: text(o.headline, 240, d.headline) || d.headline,
    subhead: text(o.subhead, 400, d.subhead),
    problem: text(o.problem, 800, d.problem),
    days: days.length ? days : d.days,
    risks: (Array.isArray(o.risks) ? o.risks : d.risks).map((r) => text(r, 200)).filter(Boolean).slice(0, 10),
    videoPath: typeof o.videoPath === "string" && /^course\/[0-9a-f-]{36}\.(mp4)$/.test(o.videoPath) ? o.videoPath : null,
    videoUrl: link(o.videoUrl),
    posterPath: typeof o.posterPath === "string" && /^course\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(o.posterPath) ? o.posterPath : null,
    groupLink: link(o.groupLink),
    recordedLink: link(o.recordedLink),
    bank: { holder: text(bk.holder, 120), iban: text(bk.iban, 60).replace(/\s+/g, " "), account: text(bk.account, 60), swift: text(bk.swift, 30), bank: text(bk.bank, 120) },
  };
}

// ───────────────────────────── the prices over time ─────────────────────────────

export interface Offer {
  product: Product;
  label: string;
  price: number;
  /** the usual price; the offer shows it struck through when it is higher than `price` */
  was: number;
  /** the gift (زهرات) that comes with it */
  bonus: number;
}

export interface Offers {
  phase: Phase;
  offers: Offer[];
  /** when the current price ends (ms since the epoch); null when it is the last price or not started */
  endsAt: number | null;
  /** a line about what comes next; its prices are written with the coin's mark (<Coined> draws the logo) */
  next: string;
}

const HOUR = 3_600_000;

/** What is on sale at `now`, and when the price changes. */
export type Clock = Pick<CourseSettings, "launchAt" | "hoursA" | "hoursB" | "prices" | "was" | "bonus">;

export function offersAt(s: Clock, now: number): Offers {
  const start = s.launchAt ? new Date(s.launchAt).getTime() : NaN;
  if (Number.isNaN(start) || now < start) return { phase: "soon", offers: [], endsAt: Number.isNaN(start) ? null : start, next: "" };
  const live = (price: number): Offer => ({ product: "live", label: PRODUCT_LABEL.live, price, was: s.was.live, bonus: 0 });
  const rec = (price: number, bonus: number): Offer => ({ product: "recorded", label: PRODUCT_LABEL.recorded, price, was: s.was.recorded, bonus });
  if (now < start + s.hoursA * HOUR) {
    return {
      phase: "A",
      offers: [{ product: "combo", label: PRODUCT_LABEL.combo, price: s.prices.comboA, was: s.was.live + s.was.recorded, bonus: s.bonus.comboA }],
      endsAt: start + s.hoursA * HOUR,
      next: `بعدها تنقسم الدورة: المباشرة ${COIN_MARK}${s.prices.liveB} والمسجلة ${COIN_MARK}${s.prices.recordedB}`,
    };
  }
  if (now < start + s.hoursB * HOUR) {
    return {
      phase: "B",
      offers: [live(s.prices.liveB), rec(s.prices.recordedB, s.bonus.recordedB)],
      endsAt: start + s.hoursB * HOUR,
      next: `بعدها المباشرة ${COIN_MARK}${s.prices.liveC} والمسجلة ${COIN_MARK}${s.prices.recordedC}`,
    };
  }
  return { phase: "C", offers: [live(s.prices.liveC), rec(s.prices.recordedC, s.bonus.recordedC)], endsAt: null, next: "" };
}

/** The offer for a product right now, or null when it is not on sale in this phase. */
export const offerFor = (s: Clock, product: Product, now: number): Offer | null => offersAt(s, now).offers.find((o) => o.product === product) ?? null;

/** The saving in percent when `was` is higher than `price`. */
export const savingPct = (o: Pick<Offer, "price" | "was">) => (o.was > o.price ? Math.round((1 - o.price / o.was) * 100) : 0);

/** "2:05:09" (hours, minutes, seconds) for a count down; days when over 48 hours. */
export function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const p = (n: number) => String(n).padStart(2, "0");
  return d > 0 ? `${d} يوم ${p(h)}:${p(m)}:${p(s % 60)}` : `${p(h)}:${p(m)}:${p(s % 60)}`;
}

// ───────────────────────────── phone, links, video ─────────────────────────────

const ARABIC_DIGITS = /[٠-٩]/g;
/** A phone number as the transfer form takes it: digits with the country code ("+9665…"), or null when it can't be one. */
export function cleanPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.replace(ARABIC_DIGITS, (c) => String(c.charCodeAt(0) - 1632)).replace(/[\s\-().]/g, "");
  if (!/^\+?\d+$/.test(s)) return null;
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  else if (s.startsWith("05") && s.length === 10) s = `+966${s.slice(1)}`;
  else if (s.startsWith("5") && s.length === 9) s = `+966${s}`;
  else if (!s.startsWith("+")) s = `+${s}`;
  const digits = s.slice(1);
  return digits.length >= 8 && digits.length <= 15 && !digits.startsWith("0") ? s : null;
}

/** A WhatsApp chat link with a ready message. */
export const waLink = (phone: string, message = "") => `https://wa.me/${phone.replace(/\D/g, "")}${message ? `?text=${encodeURIComponent(message)}` : ""}`;

export type VideoEmbed = { kind: "file"; url: string } | { kind: "frame"; url: string } | null;

/** How an outside video link is shown: a direct file in a player, YouTube / Instagram / Vimeo in their embed frame. */
export function embedOf(url: string): VideoEmbed {
  const u = link(url);
  if (!u) return null;
  const x = new URL(u);
  const host = x.hostname.replace(/^www\./, "");
  if (/\.(mp4|webm|mov)$/i.test(x.pathname)) return { kind: "file", url: u };
  if (host === "youtu.be") return { kind: "frame", url: `https://www.youtube.com/embed/${x.pathname.slice(1)}?rel=0` };
  if (host.endsWith("youtube.com")) {
    const id = x.searchParams.get("v") ?? /^\/(?:shorts|embed)\/([\w-]+)/.exec(x.pathname)?.[1];
    return id ? { kind: "frame", url: `https://www.youtube.com/embed/${id}?rel=0` } : null;
  }
  if (host.endsWith("instagram.com")) {
    const m = /^\/(reel|reels|p|tv)\/([\w-]+)/.exec(x.pathname);
    return m ? { kind: "frame", url: `https://www.instagram.com/${m[1] === "reels" ? "reel" : m[1]}/${m[2]}/embed` } : null;
  }
  if (host === "vimeo.com") {
    const id = /^\/(\d+)/.exec(x.pathname)?.[1];
    return id ? { kind: "frame", url: `https://player.vimeo.com/video/${id}` } : null;
  }
  return null;
}
