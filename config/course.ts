// «دورة الجواد الذكي» — the owner's course about JAWAD AI itself, sold from one public page (/jawad-ai/course) by bank
// transfer. The price climbs with the HOURS since the owner's reel came out (he starts the clock in /admin/course):
//   first 24 h   ONE offer: the whole course (live + recorded) for a launch price
//   24 h – 48 h  two offers: live (still the launch price) and recorded (higher, with a gift of «زهرات»)
//   after 48 h   live goes up, recorded goes up again, the gift stays
// «زهرة» is the gift's name: 1 زهرة = 1 riyal of free balance in the site. Everything here is a DEFAULT the owner edits;
// the numbers are his words (live was 80, recorded was 150; launch 40; then 80/100). Pure (page and server alike).
// Since 29 October 2026 the clock drives ONE course again (`ladderCourseId`, «دورة صانع المحتوى»): day one the whole course
// 49.99, day two live 49 or the whole 100, then live 80 and recorded 150. Every other course keeps its one recorded price.

export const COURSE = {
  base: "/jawad-ai/course",
  name: "دورة الجواد الذكاء الاصطناعي المسجلة",
  /** the one price on sale: the recorded course, in riyals */
  price: 60,
  schedule: {
    short: "الخميس ١٥ · الجمعة ١٦ · السبت ١٧ أكتوبر ٢٠٢٦",
    days: ["الخميس ١٥ أكتوبر ٢٠٢٦", "الجمعة ١٦ أكتوبر ٢٠٢٦", "السبت ١٧ أكتوبر ٢٠٢٦"],
  },
  /** how long the price a person saw at «ادفع الآن» is kept for their transfer (minutes) */
  lockMinutes: 180,
  /** the most orders a person may have open (started, waiting for the owner) at once */
  maxOpen: 4,
} as const;

export type Product = "combo" | "live" | "recorded";
export const PRODUCTS: Product[] = ["combo", "live", "recorded"];
export const isProduct = (v: unknown): v is Product => typeof v === "string" && (PRODUCTS as string[]).includes(v);
export const PRODUCT_LABEL: Record<Product, string> = { combo: "الدورة كاملة (مباشرة + مسجلة)", live: "الدورة المباشرة", recorded: "الدورة المسجلة" };
/** Keep access promises beside the product itself so a live-only ad can never inherit the recorded course's lifetime access. */
export const PRODUCT_ACCESS: Record<Product, string> = {
  combo: "حضور مباشر + تسجيل الدورة مدى الحياة",
  live: "حضور مباشر فقط",
  recorded: "الدورة المسجلة متاحة لك مدى الحياة",
};
export const hasLifetimeAccess = (product: Product) => product !== "live";

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
  /** riyals, to the halala (49.99); 0 = not on sale in that phase (the first day's whole course is always on sale) */
  prices: { comboA: number; liveB: number; recordedB: number; comboB: number; liveC: number; recordedC: number };
  /** the usual prices (struck through when the price is lower) */
  was: { live: number; recorded: number };
  /** the gift of زهرات (riyals of balance) that comes with an offer; 0 = none */
  bonus: { comboA: number; recordedB: number; recordedC: number };
  headline: string;
  subhead: string;
  problem: string;
  days: Day[];
  risks: string[];
  /**
   * the course whose prices follow the clock (a learn_courses id): its page sells the live, recorded and whole course at the
   * phase's prices and shows the words above (headline, problem, days); every other course keeps its one price. "" = none.
   */
  ladderCourseId: string;
  /** what removes the risk on the clock course's page (the other courses keep `risks`) */
  ladderRisks: string[];
  /** the clock course's terms, shown on its page and before paying (the owner's words) */
  terms: string;
  /** when the clock course's live session is (free text: the day now, the hour once the owner sets it) */
  liveWhen: string;
  /** a file in the public bucket (the owner's reel), or an outside link (YouTube, Instagram, a direct video) */
  videoPath: string | null;
  videoUrl: string;
  posterPath: string | null;
  /** the WhatsApp group: shown after «تم التحويل» (the owner approves each join request there); the recorded course only once confirmed */
  groupLink: string;
  recordedLink: string;
  /** the lesson-place course (learn_courses id) this page sells: a confirmed buyer gets THAT course only, never a later one */
  learnCourseId: string;
  bank: Bank;
}

export const DEFAULT_SETTINGS: CourseSettings = {
  launchAt: null,
  hoursA: 24,
  hoursB: 48,
  // the owner's ladder (29 October 2026): day one the whole course 49.99; day two live 49 or the whole 100; then live 80, recorded 150
  prices: { comboA: 49.99, liveB: 49, recordedB: 0, comboB: 100, liveC: 80, recordedC: 150 },
  was: { live: 80, recorded: 150 },
  bonus: { comboA: 0, recordedB: 0, recordedC: 0 },
  headline: "تعلّم الجواد الذكاء الاصطناعي بفيديوهات مسجلة تشوفها وقت ما تبي",
  subhead: "دورة مسجلة تمشي فيها على الجواد الذكي خطوة بخطوة: الموقع وأقسامه وروبوتاته، وصناعة الصور والفيديو والأفلام، تشوفها في حسابك وقت ما تبي، من أي جهاز.",
  problem: "تفتح الأدوات الذكية وتضيع بين عشرات الخيارات، وتصرف رصيدك على تجارب ما تطلع لك. في الدورة تشوف الطريق الصحيح مسجلًا، وتعيد أي درس لين تفهمه.",
  days: [
    { title: "تعرّف على الجواد الذكي", points: ["جولة في الموقع وأقسامه وروبوتاته", "وين تصرف رصيدك وكيف توفّره"] },
    { title: "اصنع بالذكاء الاصطناعي", points: ["الصور والفيديو والصوت خطوة بخطوة", "صناعة الفيلم والمشهد السينمائي والمونتاج"] },
  ],
  risks: ["الدورة المسجلة تظهر في حسابك في «دوراتي» مدى الحياة", "تشوفها من أي جهاز وقت ما تبي", "تواصل مباشر معي لو واجهتك مشكلة"],
  ladderCourseId: "",
  ladderRisks: [],
  terms: "",
  // the owner, 29 October 2026: «الخميس القادم ٥ نوفمبر، والساعة تتحدد لاحقًا»
  liveWhen: "الخميس ٥ نوفمبر ٢٠٢٦ · الساعة تتحدد قريبًا",
  videoPath: null,
  videoUrl: "",
  posterPath: null,
  // the course's WhatsApp group: joining needs the owner's approval in WhatsApp, so the link may be shown right after «تم التحويل»
  groupLink: "",
  recordedLink: "",
  learnCourseId: "",
  bank: { holder: "", iban: "", account: "", swift: "", bank: "" },
};

// ───────────────────────────── reading ─────────────────────────────

/**
 * The words the course shipped with before (the dashboard saves the WHOLE settings, so a copy of an old default may sit in
 * storage though the owner never wrote it): read as «not written», they give way to today's defaults. What the owner wrote
 * himself is never touched.
 */
const OLD_DEFAULTS = {
  headline: [
    "اصنع فيلمك السينمائي من الفكرة إلى المشهد النهائي",
    "تشتغل على الجواد الذكي بثقة في ٣ أيام: تسوي صورك وفيديوهاتك وتصاميمك بنفسك، وتعرف وين تصرف رصيدك",
    "اصنع فيلمك الأقوى بأقل الأسعار وأسهل الطرق والتقنيات (وأعلى جودة)",
  ],
  subhead: [
    "دورة عملية الخميس والجمعة والسبت (١٥–١٧ أكتوبر ٢٠٢٦): نمشي داخل فرع صناعة الأفلام في الجواد الذكي، سواء اخترت فيلمًا سينمائيًا كاملًا أو مشهدًا قصيرًا، من السيناريست إلى صانع الشيت والمخرج والأصوات ثم المونتاج.",
    "دورة عملية عن الجواد الذكي نفسه: الموقع وأقسامه وروبوتاته وعروضه، من أول خطوة لين تسوي شغلك أنت.",
    "دورة عملية في ٣ أيام: يومين نمشي فيهم على صناعة الفيلم السينمائي خطوة بخطوة بالجواد الذكي، واليوم الثالث تدريب تسوي فيه فيلمك أنت بنفسك.",
  ],
  problem: [
    "عندك فكرة فيلم أو مشهد، لكن تضيع بين كتابة السيناريو، تثبيت شكل الشخصيات والأماكن، إخراج اللقطات، توليد الفيديو والصوت، ثم جمعها في عمل واحد. في الدورة تمشي على المسار الحقيقي داخل الجواد الذكي خطوة بخطوة، وتعرف كيف تحصل على نتيجة سينمائية بأقل تجارب مهدرة.",
    "تفتح الأدوات الذكية وتضيع بين عشرات الخيارات، وتصرف رصيدك على تجارب ما تطلع لك، وكل مرة تبدأ من الصفر. اللي يعرف الطريق يوصل أسرع بتكلفة أقل.",
    "تبي تسوي فيلم، لكن الطرق كثيرة والأدوات غالية، وتصرف رصيدك على تجارب ما تطلع لك، وكل مرة تبدأ من الصفر. اللي يعرف الطريق يوصل لأقوى نتيجة بأقل تكلفة وأسهل خطوات.",
  ],
  /** the first day's title of the old three days */
  day1: ["اليوم الأول: تعرّف على الجواد", "اليوم الأول: صناعة الفيلم السينمائي (١)", "الخميس ١٥ أكتوبر: القصة والسيناريو"],
  risks: ["الدورة مدى الحياة، مباشرة كانت أو مسجلة"],
} as const;

const num = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : d;
};
/** riyals kept to the halala */
const money = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n * 100) / 100)) : d;
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
      comboA: money(pr.comboA, 1, 100000, d.prices.comboA),
      liveB: money(pr.liveB, 0, 100000, d.prices.liveB),
      recordedB: money(pr.recordedB, 0, 100000, d.prices.recordedB),
      comboB: money(pr.comboB, 0, 100000, d.prices.comboB),
      liveC: money(pr.liveC, 0, 100000, d.prices.liveC),
      recordedC: money(pr.recordedC, 0, 100000, d.prices.recordedC),
    },
    was: { live: money(wa.live, 1, 100000, d.was.live), recorded: money(wa.recorded, 1, 100000, d.was.recorded) },
    bonus: { comboA: num(bo.comboA, 0, 100000, 0), recordedB: num(bo.recordedB, 0, 100000, 0), recordedC: num(bo.recordedC, 0, 100000, 0) },
    headline: ((t) => (!t || (OLD_DEFAULTS.headline as readonly string[]).includes(t) ? d.headline : t))(text(o.headline, 240)),
    subhead: ((t) => (!t || (OLD_DEFAULTS.subhead as readonly string[]).includes(t) ? d.subhead : t))(text(o.subhead, 400)),
    problem: ((t) => (!t || (OLD_DEFAULTS.problem as readonly string[]).includes(t) ? d.problem : t))(text(o.problem, 800)),
    days: days.length && !(OLD_DEFAULTS.day1 as readonly string[]).includes(days[0].title) ? days : d.days,
    risks: (Array.isArray(o.risks) ? o.risks : d.risks)
      .map((r) => text(r, 200))
      .map((r) => ((OLD_DEFAULTS.risks as readonly string[]).includes(r) ? d.risks[0] : r))
      .filter(Boolean)
      .slice(0, 10),
    ladderCourseId: typeof o.ladderCourseId === "string" && /^[0-9a-f-]{36}$/i.test(o.ladderCourseId) ? o.ladderCourseId.toLowerCase() : "",
    ladderRisks: (Array.isArray(o.ladderRisks) ? o.ladderRisks : d.ladderRisks).map((r) => text(r, 200)).filter(Boolean).slice(0, 10),
    terms: text(o.terms, 800),
    // (absent = the default; an empty one the owner saved stays empty)
    liveWhen: o.liveWhen === undefined ? d.liveWhen : text(o.liveWhen, 200),
    videoPath: typeof o.videoPath === "string" && /^course\/[0-9a-f-]{36}\.(mp4)$/.test(o.videoPath) ? o.videoPath : null,
    videoUrl: link(o.videoUrl),
    posterPath: typeof o.posterPath === "string" && /^course\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(o.posterPath) ? o.posterPath : null,
    // (absent = the default; an empty one the owner saved stays empty)
    groupLink: o.groupLink === undefined ? d.groupLink : link(o.groupLink),
    recordedLink: link(o.recordedLink),
    learnCourseId: typeof o.learnCourseId === "string" && /^[0-9a-f-]{36}$/i.test(o.learnCourseId) ? o.learnCourseId : "",
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

/** What is on sale at `now`, and when the price changes. */
export type Clock = Pick<CourseSettings, "launchAt" | "hoursA" | "hoursB" | "prices" | "was" | "bonus" | "ladderCourseId">;

/** Is this the course whose prices follow the clock? */
export const isLadder = (s: Pick<CourseSettings, "ladderCourseId">, courseId?: string | null) => !!courseId && !!s.ladderCourseId && courseId.toLowerCase() === s.ladderCourseId;

/** The clock course's offers: one phase's products (a price of 0 = not on sale), the usual price struck (the whole = live + recorded). */
function ladderAt(s: Clock, now: number): Offers {
  const at = s.launchAt ? new Date(s.launchAt).getTime() : NaN;
  if (!Number.isFinite(at) || now < at) return { phase: "soon", offers: [], endsAt: null, next: "" };
  const was: Record<Product, number> = { live: s.was.live, recorded: s.was.recorded, combo: Math.round((s.was.live + s.was.recorded) * 100) / 100 };
  const p = s.prices;
  const list = (xs: [Product, number][]): Offer[] => xs.filter(([, price]) => price > 0).map(([product, price]) => ({ product, label: PRODUCT_LABEL[product], price, was: Math.max(was[product], price), bonus: 0 }));
  const say = (xs: [Product, number][]) => xs.filter(([, n]) => n > 0).map(([k, n]) => `${k === "combo" ? "الكاملة" : k === "live" ? "المباشرة" : "المسجلة"} ¤${n}`).join(" و");
  const h = (now - at) / 3_600_000;
  const B: [Product, number][] = [["combo", p.comboB], ["live", p.liveB], ["recorded", p.recordedB]];
  const C: [Product, number][] = [["recorded", p.recordedC], ["live", p.liveC]];
  if (h < s.hoursA) return { phase: "A", offers: list([["combo", p.comboA]]), endsAt: at + s.hoursA * 3_600_000, next: `بعدها: ${say(B)}` };
  if (h < s.hoursB) return { phase: "B", offers: list(B), endsAt: at + s.hoursB * 3_600_000, next: `بعدها: ${say(C)}` };
  return { phase: "C", offers: list(C), endsAt: null, next: "" };
}

/** What is on sale at `now`: the clock course follows its phases; every other course sells its recorded course at its one price. */
export function offersAt(s: Clock, now: number, price: number = COURSE.price, was: number = price, courseId?: string | null): Offers {
  if (isLadder(s, courseId)) return ladderAt(s, now);
  // one thing on sale, always: the recorded course at its one price (no clock, no phases, no live offer)
  return { phase: "C", offers: [{ product: "recorded", label: PRODUCT_LABEL.recorded, price, was: Math.max(was, price), bonus: 0 }], endsAt: null, next: "" };
}

/** The offer for a product right now, or null when it is not on sale in this phase. */
export const offerFor = (s: Clock, product: Product, now: number, price?: number, was?: number, courseId?: string | null): Offer | null => offersAt(s, now, price, was, courseId).offers.find((o) => o.product === product) ?? null;

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
