// «صانع المحتوى» — the example bank «محمد باقر» learns the six kinds of work from: a thousand worked examples for
// each (a request as people write it → what he should read from it, what he still has to ask, and the shape of the
// deliverable), made deterministically from seed lists so they cost nothing to keep and the tests can check every
// one of them. At each turn the closest examples to the person's message are shown to him (few-shot), so he answers
// the way the examples do. Pure. The site's rule holds in every example: no real women, ever.

import { CONTENT_KINDS, type ContentKind } from "./content";

export interface ContentExample {
  id: string;
  kind: ContentKind;
  /** The request, as a person writes it (Gulf Arabic). */
  ask: string;
  /** What is already known from the request alone. */
  brief: { platform: string; goal: string; audience: string; tone: string; policy: "as_is" | "develop" | "unknown" };
  /** What he still has to ask (grouped in one message), in order. */
  missing: string[];
  /** The deliverable's skeleton for this request (a cover and slide titles, a hook and beats, scenes…). */
  outline: string[];
}

export const EXAMPLES_PER_KIND = 1000;

// ───────────────────────────── seed lists ─────────────────────────────

const TOPICS = [
  "التسويق بالمحتوى", "إدارة الوقت", "الاستثمار للمبتدئين", "القهوة المختصة", "تربية الأطفال", "الصحة النفسية", "تعلّم البرمجة", "الذكاء الاصطناعي في العمل", "ريادة الأعمال", "التجارة الإلكترونية",
  "التصوير بالجوال", "النوم الصحي", "الادخار الشهري", "كتابة السيرة الذاتية", "مقابلات العمل", "الرياضة في البيت", "التغذية", "السفر الاقتصادي", "العقار", "القراءة",
  "التعليم عن بعد", "الأمن السيبراني", "خدمة العملاء", "إدارة المشاريع", "التصميم الجرافيكي", "البودكاست", "التصميم الداخلي", "السيارات الكهربائية", "الزراعة المنزلية", "الطبخ السريع",
  "الحج والعمرة", "رمضان", "اليوم الوطني", "العودة للمدارس", "التخرج", "الزواج والميزانية", "الطفل الرضيع", "كبار السن", "ذوي الإعاقة", "العمل الحر",
  "البيع على أمازون", "متجر سلة", "التسويق عبر واتساب", "الإعلانات الممولة", "السيو", "اليوتيوب", "تيك توك", "لينكدإن", "البث المباشر", "التسويق بالمؤثرين",
];
const PLATFORMS = ["انستغرام", "لينكدإن", "تيك توك", "سناب", "إكس", "يوتيوب شورتس", "فيسبوك", "موقعي"];
const AUDIENCES = ["المبتدئين", "أصحاب المشاريع الصغيرة", "الموظفين", "الطلاب", "الأمهات والآباء", "المدراء", "المستقلين", "المراهقين", "الجمهور العام", "المختصين"];
const GOALS = ["تعليم", "توعية", "بيع", "جذب متابعين", "بناء ثقة", "إطلاق منتج", "تحفيز", "شرح خدمة", "تصحيح مفهوم خاطئ", "ترويج فعالية"];
const TONES = ["جادة", "مرحة", "هادئة", "تحفيزية", "رسمية", "قريبة من الناس", "مباشرة", "قصصية"];
const DIALECTS = ["فصحى", "خليجي", "سعودي", "فصحى مبسطة", "مصري", "شامي"];
const COLORS = ["كحلي وذهبي", "أبيض وأسود", "أخضر وبيج", "بنفسجي ونيون", "برتقالي وكحلي", "أزرق سماوي وأبيض", "عنابي وذهبي", "رمادي وأصفر"];
const STRUCTURES = ["خطوات", "قائمة", "قصة", "مقارنة", "تعليم", "تحليل", "أخطاء شائعة", "أسئلة وأجوبة", "قبل وبعد", "عرض منتج"];
const DURATIONS = [15, 20, 30, 45, 60, 90];
const SLIDES = [5, 6, 7, 8, 9, 10, 12];
const MOTION_STYLES = ["مسطح بسيط", "علمي", "فخم", "تقني", "مرح", "سينمائي", "صحفي", "روحاني"];
const MOTION_SUBJECTS = ["شرح الخدمة", "إنفوجرافيك أرقام", "عرض المزايا", "خطوات التسجيل", "انترو للقناة", "إعلان عرض", "تايبوغرافي لاقتباس", "مقارنة باقات", "شرح كيف يعمل التطبيق", "ملخص تقرير"];
const ASSETS = ["عندي لقطات مصوّرة بالجوال", "عندي فيديو كلام للكاميرا", "عندي صور للمنتج", "ما عندي أي ملفات", "عندي شعار وألوان", "عندي صوت مسجّل", "عندي لقطات من المتجر", "عندي فيديو قديم أبي أعيد استخدامه"];
const SOURCES = ["مقال كتبته", "منشور طويل", "حلقة بودكاست", "ورقة عمل", "تغريدات", "فيديو يوتيوب", "محاضرة", "دراسة حالة", "صفحة من كتابي", "عرض تقديمي"];
const CTAS = ["احفظ المنشور", "شاركه مع صديق", "اكتب رأيك", "تابعنا", "اطلب الآن", "سجّل من الرابط", "راسلنا", "جرّبها اليوم"];

/** A small deterministic generator (the same seed gives the same bank on every machine). */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }
  next() {
    // xorshift32
    let x = this.s;
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    this.s = x;
    return x / 4294967296;
  }
  pick<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.next() * xs.length)];
  }
  int(min: number, max: number) {
    return min + Math.floor(this.next() * (max - min + 1));
  }
}

type Draft = Omit<ContentExample, "id" | "kind">;

const policyOf = (r: Rng): { text: string; policy: Draft["brief"]["policy"] } =>
  r.pick([
    { text: "", policy: "unknown" },
    { text: " خلّه مثل ما هو بس رتّبه", policy: "as_is" },
    { text: " وطوّره وقوّي صياغته", policy: "develop" },
    { text: " واختصره", policy: "develop" },
    { text: " بدون ما تغيّر المعلومات", policy: "as_is" },
    { text: " وأضف أمثلة", policy: "develop" },
  ]);

const slideTitles = (topic: string, structure: string, n: number): string[] => {
  const body = Array.from({ length: Math.max(1, n - 2) }, (_, i) => {
    switch (structure) {
      case "خطوات": return `الخطوة ${i + 1} في ${topic}`;
      case "أخطاء شائعة": return `الخطأ ${i + 1}: ما يفعله الأغلب في ${topic}`;
      case "أسئلة وأجوبة": return `سؤال ${i + 1} عن ${topic}`;
      case "مقارنة": return i % 2 ? `الخيار الثاني في ${topic}` : `الخيار الأول في ${topic}`;
      case "قصة": return `المشهد ${i + 1}`;
      case "قبل وبعد": return i % 2 ? "بعد" : "قبل";
      default: return `النقطة ${i + 1} في ${topic}`;
    }
  });
  return [`الغلاف: هوك عن ${topic}`, ...body, "الخاتمة: الدعوة للتفاعل"];
};

const MAKERS: Record<ContentKind, (r: Rng) => Draft> = {
  carousel: (r) => {
    const topic = r.pick(TOPICS);
    const platform = r.pick(PLATFORMS);
    const audience = r.pick(AUDIENCES);
    const goal = r.pick(GOALS);
    const n = r.pick(SLIDES);
    const structure = r.pick(STRUCTURES);
    const colors = r.pick(COLORS);
    const pol = policyOf(r);
    const form = r.int(0, 5);
    const ask =
      form === 0 ? `أبي كاروسيل عن ${topic} لـ${platform} لـ${audience}.${pol.text}`
      : form === 1 ? `سوّ لي كاروسيل ${n} شرائح عن ${topic} بأسلوب ${structure}.${pol.text}`
      : form === 2 ? `عندي ${r.pick(SOURCES)} عن ${topic} وأبيه كاروسيل لـ${platform}.${pol.text}`
      : form === 3 ? `كاروسيل بألوان ${colors} عن ${topic}، الهدف ${goal}.${pol.text}`
      : form === 4 ? `صمّم لي شرائح كاروسيل لـ${audience} عن ${topic} على ${platform}، ونبرة ${r.pick(TONES)}.${pol.text}`
      : `أبي كاروسيل قصير عن ${topic}.${pol.text}`;
    const known = { platform: form === 1 || form === 3 || form === 5 ? "" : platform, goal: form === 3 ? goal : "", audience: form === 0 || form === 4 ? audience : "", tone: form === 4 ? r.pick(TONES) : "", policy: pol.policy };
    const missing = [
      ...(known.platform ? [] : ["المنصة والمقاس"]),
      ...(known.goal ? [] : ["الهدف"]),
      ...(known.audience ? [] : ["الجمهور"]),
      "كثافة النص (قليلة / متوسطة / مرتفعة)",
      ...(form === 1 ? [] : ["عدد الشرائح أو تفويضي باقتراحه"]),
      ...(form === 3 ? [] : ["الألوان والخط والشعار، أو تفويضي بلوحة"]),
      ...(pol.policy === "unknown" ? ["الحفاظ على المحتوى كما هو أم تطويره"] : []),
    ];
    return { ask, brief: known, missing, outline: slideTitles(topic, structure, n) };
  },
  reel_script: (r) => {
    const topic = r.pick(TOPICS);
    const platform = r.pick(PLATFORMS);
    const audience = r.pick(AUDIENCES);
    const sec = r.pick(DURATIONS);
    const dialect = r.pick(DIALECTS);
    const tone = r.pick(TONES);
    const pol = policyOf(r);
    const form = r.int(0, 5);
    const ask =
      form === 0 ? `اكتب لي سكربت ريل عن ${topic} مدته ${sec} ثانية.${pol.text}`
      : form === 1 ? `أبي سكربت ريل بلهجة ${dialect} عن ${topic} لـ${audience}.${pol.text}`
      : form === 2 ? `عندي ${r.pick(SOURCES)} عن ${topic}، حوّله سكربت ريل لـ${platform}.${pol.text}`
      : form === 3 ? `سكربت ريل بهوك قوي عن ${topic}، نبرة ${tone}.${pol.text}`
      : form === 4 ? `أبي سكربت تعليق صوتي لريل عن ${topic} على ${platform}.${pol.text}`
      : `سكربت ريل قصير أقوله للكاميرا عن ${topic}.${pol.text}`;
    const known = { platform: form === 2 || form === 4 ? platform : "", goal: "", audience: form === 1 ? audience : "", tone: form === 3 ? tone : "", policy: pol.policy };
    const missing = [
      ...(form === 0 ? [] : ["المدة"]),
      ...(known.platform ? [] : ["المنصة"]),
      ...(known.audience ? [] : ["الجمهور"]),
      ...(form === 1 ? [] : ["لغة النص ولهجته"]),
      ...(form === 4 || form === 5 ? [] : ["متحدث أمام الكاميرا أم تعليق صوتي"]),
      "الهدف من الريل",
      ...(pol.policy === "unknown" && form === 2 ? ["الالتزام بالنص الأصلي أم تطويره"] : []),
    ];
    const beats = Math.max(2, Math.round(sec / 12));
    return { ask, brief: known, missing, outline: [`الهوك (٠–٣ ث): سؤال أو ادعاء عن ${topic}`, ...Array.from({ length: beats }, (_, i) => `الفكرة ${i + 1}`), `الخاتمة: ${r.pick(CTAS)}`] };
  },
  reel_produced: (r) => {
    const topic = r.pick(TOPICS);
    const platform = r.pick(PLATFORMS);
    const assets = r.pick(ASSETS);
    const sec = r.pick(DURATIONS);
    const pol = policyOf(r);
    const form = r.int(0, 4);
    const ask =
      form === 0 ? `أبي ريل منتج جاهز عن ${topic}، ${assets}.${pol.text}`
      : form === 1 ? `منتج لي ريل من مقاطعي عن ${topic} لـ${platform} مدته ${sec} ثانية.${pol.text}`
      : form === 2 ? `سوّ لي مونتاج ريل كامل عن ${topic} مع كابشن وموسيقى، ${assets}.${pol.text}`
      : form === 3 ? `أبي ريل منتج بالموشن داخل الفيديو عن ${topic}.${pol.text}`
      : `ريل جاهز للنشر عن ${topic} على ${platform}، ${assets}.${pol.text}`;
    const known = { platform: form === 1 || form === 4 ? platform : "", goal: "", audience: "", tone: "", policy: pol.policy };
    const missing = [
      ...(form === 1 ? [] : ["المدة"]),
      ...(known.platform ? [] : ["المنصة والمقاس"]),
      "الجمهور والهدف",
      ...(form === 0 || form === 2 || form === 4 ? ["ارفع المواد هنا (الفيديو والصور والصوت)"] : ["المواد المتاحة: ارفعها هنا"]),
      "إيقاع المونتاج (هادئ / متوسط / سريع)",
      "الكابشن والنصوص الظاهرة",
      ...(form === 2 ? [] : ["الموسيقى والمؤثرات أو بدونها"]),
    ];
    return { ask, brief: known, missing, outline: ["السكربت المعتمد", "اللقطات من مواد العميل بالترتيب", "النصوص الظاهرة والكابشن", "مواضع الموشن", "الموسيقى والمؤثرات", `التسليم إلى حيدرة: ${platform === "يوتيوب شورتس" || platform === "تيك توك" ? "9:16" : "9:16"}`] };
  },
  motion: (r) => {
    const subject = r.pick(MOTION_SUBJECTS);
    const topic = r.pick(TOPICS);
    const style = r.pick(MOTION_STYLES);
    const sec = r.pick([10, 15, 20, 30, 45, 60]);
    const colors = r.pick(COLORS);
    const form = r.int(0, 4);
    const ask =
      form === 0 ? `أبي موشن جرافيكس ${subject} عن ${topic}.`
      : form === 1 ? `سوّ لي موشن ${style} مدته ${sec} ثانية: ${subject} لـ${topic}.`
      : form === 2 ? `فيديو موشن جرافيكس بألوان ${colors} يشرح ${topic}.`
      : form === 3 ? `أبي انترو موشن لقناتي عن ${topic} بأسلوب ${style}.`
      : `موشن جرافيكس تايبوغرافي عن ${topic} بتعليق صوتي.`;
    const known = { platform: "", goal: "", audience: "", tone: form === 1 || form === 3 ? style : "", policy: "unknown" as const };
    const missing = [
      ...(form === 1 ? [] : ["المدة"]),
      "المقاس (طولي 9:16 أم عرضي 16:9)",
      ...(form === 1 || form === 3 ? [] : ["الأسلوب البصري"]),
      ...(form === 2 ? [] : ["لوحة الألوان والخطوط أو تفويضي"]),
      "النص الكامل الذي يظهر أو يُقال",
      ...(form === 4 ? [] : ["تعليق صوتي أم نص فقط"]),
      "الموسيقى والمؤثرات أو بدونها",
    ];
    const scenes = Math.max(3, Math.round(sec / 6));
    return { ask, brief: known, missing, outline: ["المشهد ١: العنوان", ...Array.from({ length: scenes - 2 }, (_, i) => `المشهد ${i + 2}: ${subject}`), `المشهد ${scenes}: الخاتمة والدعوة`] };
  },
  titles: (r) => {
    const topic = r.pick(TOPICS);
    const platform = r.pick(PLATFORMS);
    const audience = r.pick(AUDIENCES);
    const tone = r.pick(TONES);
    const form = r.int(0, 4);
    const ask =
      form === 0 ? `اكتب لي عنوان غلاف وكابشن لمنشور عن ${topic} على ${platform}.`
      : form === 1 ? `أبي ٥ عناوين هوك لفيديو عن ${topic} لـ${audience}.`
      : form === 2 ? `كابشن قصير بدعوة للتفاعل لريل عن ${topic}، نبرة ${tone}.`
      : form === 3 ? `عناوين أغلفة لمنشورات عن ${topic}، بدون مبالغة.`
      : `اكتب لي كابشن لمنشور ${platform} عن ${topic} مع هاشتاقات.`;
    const known = { platform: form === 0 || form === 4 ? platform : "", goal: "", audience: form === 1 ? audience : "", tone: form === 2 ? tone : "", policy: "unknown" as const };
    const missing = [
      ...(known.platform ? [] : ["المنصة"]),
      ...(known.audience ? [] : ["الجمهور"]),
      "الفكرة أو النص الذي يصف المحتوى (حتى لا يَعِد العنوان بما ليس فيه)",
      ...(known.tone ? [] : ["النبرة واللهجة"]),
    ];
    return { ask, brief: known, missing, outline: ["٣–٥ عناوين صادقة", `كابشن: سطر أول جاذب، ثم القيمة، ثم ${r.pick(CTAS)}`, "هاشتاقات قليلة ومناسبة"] };
  },
  repurpose: (r) => {
    const topic = r.pick(TOPICS);
    const source = r.pick(SOURCES);
    const platform = r.pick(PLATFORMS);
    const pol = policyOf(r);
    const form = r.int(0, 3);
    const ask =
      form === 0 ? `عندي ${source} عن ${topic}، أبي أعيد توظيفه في كاروسيل وسكربت ريل وكابشن.${pol.text}`
      : form === 1 ? `حوّل لي ${source} عن ${topic} إلى عدة مخرجات لـ${platform}.${pol.text}`
      : form === 2 ? `أبي من ${source} عن ${topic}: كاروسيل + ريل + عناوين، كلها مترابطة.${pol.text}`
      : `أعد توظيف ${source} عن ${topic} في أكثر من مخرج.${pol.text}`;
    const known = { platform: form === 1 ? platform : "", goal: "", audience: "", tone: "", policy: pol.policy };
    const missing = [
      "ارفع المحتوى الأصلي هنا أو الصقه",
      ...(form === 0 || form === 2 ? [] : ["المخرجات المطلوبة بالضبط"]),
      ...(known.platform ? [] : ["المنصة لكل مخرج"]),
      "الجمهور والهدف",
      ...(pol.policy === "unknown" ? ["الحفاظ على المحتوى كما هو أم تطويره"] : []),
    ];
    return { ask, brief: known, missing, outline: ["الفكرة المحورية الواحدة", "كاروسيل: الغلاف والشرائح", "سكربت ريل: الهوك والفكرة والخاتمة", "كابشن وعناوين", "العلاقة بين المخرجات (ترتيب النشر)"] };
  },
};

// ───────────────────────────── recognising the kind ─────────────────────────────

/** Words that point at a kind; the longest hit wins, so «ريل منتج» beats «ريل». */
const TRIGGERS: Record<ContentKind, string[]> = {
  carousel: ["كاروسيل", "كروسيل", "شرائح", "carousel", "slides"],
  reel_script: ["سكربت", "script", "تعليق صوتي", "أقوله للكاميرا"],
  reel_produced: ["ريل منتج", "منتج لي ريل", "مونتاج ريل", "ريل جاهز", "ريل كامل", "منتج جاهز", "produced reel", "مونتاج"],
  motion: ["موشن جرافيكس", "موشن", "motion graphics", "motion", "انترو", "تايبوغرافي", "إنفوجرافيك متحرك"],
  titles: ["عنوان", "عناوين", "كابشن", "caption", "هاشتاق", "هوك لفيديو", "عناوين هوك"],
  repurpose: ["أعيد توظيفه", "أعد توظيف", "إعادة توظيف", "عدة مخرجات", "أكثر من مخرج", "كلها مترابطة", "repurpose"],
};

const norm = (s: string) => s.toLowerCase().normalize("NFC").replace(/[ً-ْٰـ]/g, "").replace(/[إأآ]/g, "ا");

/** The kind of work a message asks for (null when none is clear). */
export function detectContentKind(message: string): ContentKind | null {
  const m = norm(message);
  let best: { kind: ContentKind; len: number } | null = null;
  for (const k of CONTENT_KINDS) {
    for (const t of TRIGGERS[k.id]) {
      const w = norm(t);
      if (m.includes(w) && (!best || w.length > best.len)) best = { kind: k.id, len: w.length };
    }
  }
  return best?.kind ?? null;
}

// ───────────────────────────── the bank ─────────────────────────────

const banks = new Map<string, ContentExample[]>();

/** A thousand examples of one kind of work (the same every time). */
export function contentExamplesFor(kind: ContentKind, count = EXAMPLES_PER_KIND): ContentExample[] {
  const key = `${kind}:${count}`;
  const hit = banks.get(key);
  if (hit) return hit;
  const make = MAKERS[kind];
  const r = new Rng(CONTENT_KINDS.findIndex((k) => k.id === kind) * 104729 + 31);
  const out: ContentExample[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (out.length < count && guard++ < count * 40) {
    const e = make(r);
    const sig = `${e.ask}|${e.outline.join("|")}|${e.missing.join("|")}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({ id: `${kind}-${out.length + 1}`, kind, ...e });
  }
  banks.set(key, out);
  return out;
}

export const allContentExamples = () => CONTENT_KINDS.flatMap((k) => contentExamplesFor(k.id));

const tokens = (s: string) =>
  new Set(
    norm(s)
      .replace(/ة/g, "ه")
      .split(/[^\p{L}\p{N}]+/u)
      .map((w) => w.replace(/^(ال|لل|بال|وال|ل|ب|و)(?=.{3})/, ""))
      .filter((w) => w.length >= 2),
  );

/**
 * The closest examples to a message, for the kind of work it asks (or all kinds when none is clear): the ones whose
 * request shares the most words with it.
 */
export function nearestContentExamples(message: string, k = 3): ContentExample[] {
  const kind = detectContentKind(message);
  const pool = kind ? contentExamplesFor(kind) : allContentExamples();
  const q = tokens(message);
  const seenAsk = new Set<string>();
  const scored = pool.flatMap((e) => {
    if (seenAsk.has(e.ask)) return [];
    seenAsk.add(e.ask);
    const t = tokens(e.ask);
    let score = e.ask === message ? 100 : 0;
    for (const w of q) if (t.has(w)) score += w.length >= 4 ? 2 : 1;
    return [{ e, score }];
  });
  scored.sort((a, b) => b.score - a.score || a.e.id.localeCompare(b.e.id));
  return scored.slice(0, k).map((x) => x.e);
}

const POLICY_AR = { as_is: "كما هو", develop: "تطوير", unknown: "غير محدد (يُسأل)" } as const;

/** The examples as «محمد باقر» sees them in a turn. */
export function contentExamplesBrief(list: ContentExample[]) {
  if (!list.length) return "";
  return `أمثلة مرجعية لطلبات تشبه هذا الطلب وما يُقرأ منها (اتبع شكلها، وكيّف المضمون لما يريده هذا العميل؛ لا تذكرها له):\n${list
    .map((e, i) => {
      const k = CONTENT_KINDS.find((x) => x.id === e.kind)!;
      const known = [e.brief.platform && `المنصة: ${e.brief.platform}`, e.brief.goal && `الهدف: ${e.brief.goal}`, e.brief.audience && `الجمهور: ${e.brief.audience}`, e.brief.tone && `النبرة: ${e.brief.tone}`, `سياسة المحتوى: ${POLICY_AR[e.brief.policy]}`].filter(Boolean).join("، ");
      return `${i + 1}. الطلب: «${e.ask}»\n   النوع: ${k.name} · المعروف: ${known}\n   يُسأل عنه دفعة واحدة: ${e.missing.join("؛ ")}\n   هيكل المخرج: ${e.outline.join(" ← ")}`;
    })
    .join("\n")}`;
}
