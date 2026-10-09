// «صانع المحتوى» — the worked carousels «محمد باقر» follows the shape of: 125 for each of the 24 templates (3,000 in
// all), each a complete plan — the request as people write it, the structure and palette, the slides with their
// Arabic copy (short, one idea each) and the full cover and body prompts with the template's design system, exactly
// as they go to GPT Image 2. Made deterministically from seed lists, so they cost nothing to keep and the tests can
// check every one of them. The copy is the SHAPE of good slides (short titles, one short line), not content to reuse.
// At each turn the closest ones to the person's message (and to the template they chose) are shown to him. Pure.

import { Rng } from "./content-examples";
import { ARABIC_TEXT_RULES, CAROUSEL_TEMPLATES, designSystem, findTemplate, structureName, type StructureId } from "./content-templates";

export const TEMPLATE_EXAMPLES_PER = 125;

export interface TemplateExample {
  id: string;
  template: string;
  /** The request, as a person writes it (Gulf Arabic). */
  ask: string;
  structure: StructureId;
  palette: number;
  slides: { n: number; role: "cover" | "body" | "closing"; title: string; line: string }[];
  /** The full prompt of slide 1 and of a middle slide, as they go to the image generator. */
  coverPrompt: string;
  bodyPrompt: string;
}

const TOPICS = [
  "إدارة الوقت", "التسويق بالمحتوى", "الادخار الشهري", "القهوة المختصة", "تربية الأطفال", "الصحة النفسية", "تعلّم البرمجة", "الذكاء الاصطناعي في العمل", "ريادة الأعمال", "المتجر الإلكتروني",
  "التصوير بالجوال", "النوم الصحي", "السيرة الذاتية", "مقابلات العمل", "الرياضة في البيت", "التغذية المتوازنة", "السفر الاقتصادي", "الاستثمار العقاري", "القراءة اليومية", "التعليم عن بعد",
  "الأمن الرقمي", "خدمة العملاء", "إدارة المشاريع", "التصميم الجرافيكي", "صناعة البودكاست", "التصميم الداخلي", "الزراعة المنزلية", "الطبخ السريع", "رمضان", "اليوم الوطني",
  "التخرج", "ميزانية الزواج", "العمل الحر", "الإعلانات الممولة", "تحسين الظهور في البحث", "قناة اليوتيوب", "البث المباشر", "المسؤولية الاجتماعية", "حفظ القرآن", "الصلاة والخشوع",
  "العناية بالبشرة", "العطور", "العقار", "السيارات الكهربائية", "الطاقة الشمسية", "التوفير في الفواتير", "التسويق عبر واتساب", "العمل الجماعي", "القيادة", "الكتابة الإبداعية",
];
const AUDIENCES = ["المبتدئين", "أصحاب المشاريع", "الموظفين", "الطلاب", "الأمهات والآباء", "المدراء", "المستقلين", "الجمهور العام", "المختصين", "الشباب"];
const PLATFORMS = ["انستغرام", "لينكدإن", "تيك توك", "سناب", "إكس", "فيسبوك"];

const COVER_FRAMES: Record<StructureId, (t: string, n: number) => { title: string; line: string }> = {
  steps: (t, n) => ({ title: `${n} خطوات لإتقان ${t}`, line: "اسحب للخطوة الأولى" }),
  list: (t, n) => ({ title: `${n} أفكار عن ${t}`, line: "احفظها قبل أن تنساها" }),
  story: (t) => ({ title: `قصتي مع ${t}`, line: "ما توقعت هذه النهاية" }),
  compare: (t) => ({ title: `${t}: أيهما تختار؟`, line: "مقارنة صريحة" }),
  teach: (t) => ({ title: `${t} في دقيقتين`, line: "شرح مبسّط من الصفر" }),
  mistakes: (t, n) => ({ title: `${n} أخطاء في ${t}`, line: "تجنّبها من اليوم" }),
  qa: (t) => ({ title: `أسئلة شائعة عن ${t}`, line: "وإجاباتها المختصرة" }),
  before_after: (t) => ({ title: `${t}: قبل وبعد`, line: "الفرق أكبر مما تتخيل" }),
  stats: (t) => ({ title: `أرقام عن ${t} تفاجئك`, line: "من واقع البيانات" }),
  myth: (t) => ({ title: `خرافات عن ${t}`, line: "وما الحقيقة" }),
  case: (t) => ({ title: `كيف نجح مشروعنا في ${t}`, line: "دراسة حالة" }),
  quote: (t) => ({ title: `كلمات عن ${t}`, line: "تأمّل قبل أن تكمل" }),
  journey: (t) => ({ title: `رحلتنا في ${t}`, line: "محطة بعد محطة" }),
  cheat: (t) => ({ title: `ورقة ${t} المرجعية`, line: "كل ما تحتاجه في مكان واحد" }),
  proof: (t) => ({ title: `ماذا قال عملاؤنا عن ${t}`, line: "آراء حقيقية" }),
};

const BODY_LINES = [
  "ابدأ بخطوة صغيرة وواضحة", "حدّد هدفًا واحدًا فقط", "اكتب ما تريده قبل أن تبدأ", "قِس ما تفعله كل أسبوع", "تجاهل ما لا يخدم هدفك",
  "اطلب رأي شخص تثق به", "كرّر القليل المفيد", "لا تنتظر الوقت المثالي", "اجعلها عادة يومية", "راجع تقدّمك بصدق",
  "ابسّط ما يمكن تبسيطه", "اختر الأهم ثم الأهم", "التزم قبل أن تتحمّس", "احتفل بكل تقدّم صغير", "تعلّم من الخطأ بسرعة",
];
const BODY_TITLES: Record<StructureId, (i: number) => string> = {
  steps: (i) => `الخطوة ${i}`,
  list: (i) => `الفكرة ${i}`,
  story: (i) => `المشهد ${i}`,
  compare: (i) => (i % 2 ? "الخيار الأول" : "الخيار الثاني"),
  teach: (i) => `النقطة ${i}`,
  mistakes: (i) => `الخطأ ${i}`,
  qa: (i) => `السؤال ${i}`,
  before_after: (i) => (i % 2 ? "قبل" : "بعد"),
  stats: (i) => `الرقم ${i}`,
  myth: (i) => `الخرافة ${i}`,
  case: (i) => ["المشكلة", "النهج", "النتيجة", "الدرس"][(i - 1) % 4],
  quote: (i) => `الاقتباس ${i}`,
  journey: (i) => `المحطة ${i}`,
  cheat: (i) => `القسم ${i}`,
  proof: (i) => `رأي ${i}`,
};
const CLOSING = ["احفظ المنشور", "شاركه مع من يحتاجه", "اكتب رأيك في التعليقات", "تابعنا للمزيد", "راسلنا الآن", "جرّب اليوم"];

const ask = (r: Rng, t: string, structure: StructureId, tpl: string, aud: string, plat: string, n: number) =>
  r.pick([
    `أبي كاروسيل بقالب «${tpl}» عن ${t} لـ${aud}`,
    `سوّ لي كاروسيل ${structureName(structure)} عن ${t} على ${plat}، بقالب «${tpl}»`,
    `كاروسيل ${n} شرائح عن ${t} لـ${aud} بأسلوب «${tpl}»`,
    `صمّم لي شرائح ${structureName(structure)} عن ${t} على ${plat} بقالب «${tpl}»`,
    `أبي كاروسيل عن ${t} بنفس روح قالب «${tpl}»`,
  ]);

function make(tplIndex: number, r: Rng): Omit<TemplateExample, "id"> {
  const tpl = CAROUSEL_TEMPLATES[tplIndex];
  const topic = r.pick(TOPICS);
  const structure = r.pick(tpl.structures);
  const palette = r.int(0, 2);
  const n = r.pick([5, 6, 7, 8, 9, 10]);
  const slides: TemplateExample["slides"] = [];
  const cover = COVER_FRAMES[structure](topic, n - 2 > 1 ? n - 2 : n);
  slides.push({ n: 1, role: "cover", ...cover });
  for (let i = 1; i <= n - 2; i++) slides.push({ n: i + 1, role: "body", title: BODY_TITLES[structure](i), line: r.pick(BODY_LINES) });
  slides.push({ n, role: "closing", title: r.pick(CLOSING), line: "وتابع الحساب للمزيد" });

  const compose = (s: TemplateExample["slides"][number], anatomy: string) =>
    [
      designSystem(tpl, palette),
      `Slide ${s.n} of ${n}. ${anatomy}`,
      `Text on the slide, written exactly and right-to-left: headline "${s.title}"; line "${s.line}".`,
      ARABIC_TEXT_RULES,
    ].join("\n\n");
  const mid = slides[Math.min(2, slides.length - 2)];
  return {
    template: tpl.id,
    ask: ask(r, topic, structure, tpl.name, r.pick(AUDIENCES), r.pick(PLATFORMS), n),
    structure,
    palette,
    slides,
    coverPrompt: compose(slides[0], tpl.cover),
    bodyPrompt: compose(mid, tpl.body),
  };
}

const banks = new Map<string, TemplateExample[]>();

/** The worked carousels of one template (the same every time). */
export function templateExamplesFor(template: string, count = TEMPLATE_EXAMPLES_PER): TemplateExample[] {
  const key = `${template}:${count}`;
  const hit = banks.get(key);
  if (hit) return hit;
  const idx = CAROUSEL_TEMPLATES.findIndex((t) => t.id === template);
  if (idx < 0) return [];
  const r = new Rng(idx * 15485863 + 101);
  const out: TemplateExample[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (out.length < count && guard++ < count * 40) {
    const e = make(idx, r);
    const sig = `${e.ask}|${e.slides.map((s) => s.title + s.line).join("|")}|${e.palette}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({ id: `${template}-${out.length + 1}`, ...e });
  }
  banks.set(key, out);
  return out;
}

export const allTemplateExamples = () => CAROUSEL_TEMPLATES.flatMap((t) => templateExamplesFor(t.id));

const norm = (s: string) => s.toLowerCase().normalize("NFC").replace(/[ً-ْٰـ]/g, "").replace(/[إأآ]/g, "ا").replace(/ة/g, "ه");
const tokens = (s: string) =>
  new Set(
    norm(s)
      .split(/[^\p{L}\p{N}]+/u)
      .map((w) => w.replace(/^(ال|لل|بال|وال|ل|ب|و)(?=.{3})/, ""))
      .filter((w) => w.length >= 2),
  );

/** The closest worked carousels to a message, within the template the person chose (or all templates when none). */
export function nearestTemplateExamples(message: string, template: string | null, k = 2): TemplateExample[] {
  const pool = template && findTemplate(template) ? templateExamplesFor(template) : allTemplateExamples();
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

/** The worked carousels as «محمد باقر» sees them in a turn. */
export function templateExamplesBrief(list: TemplateExample[]) {
  if (!list.length) return "";
  return `أمثلة كاروسيل مكتملة بنفس القالب (اتبع شكل الخطة وطريقة كتابة توجيه الصورة: نظام التصميم كاملًا في كل شريحة، ثم ما يخصها، والنص العربي حرفيًا بين علامتي اقتباس؛ كيّف المضمون لما يريده هذا العميل ولا تنسخ نصوصها):\n${list
    .map((e, i) => {
      const t = findTemplate(e.template)!;
      return `${i + 1}. الطلب: «${e.ask}» · القالب: ${t.name} · البنية: ${structureName(e.structure)} · اللوحة: ${t.palettes[e.palette].name}\n   الشرائح: ${e.slides.map((s) => `${s.n}) ${s.title} — ${s.line}`).join(" | ")}\n   توجيه الغلاف:\n${e.coverPrompt}`;
    })
    .join("\n\n")}`;
}
