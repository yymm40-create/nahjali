// «زهراء» — what she learns from: a thousand worked requests over the kinds of work people bring a photo editor — light and
// colour problems, looks, crops and platform sizes, tilt and turns, titles and names on pictures, product and portrait
// finishing, thumbnails, cards sent from «كاظم», old photos, requests to جواد (a new picture, a cut-out, an edit) and the
// edits of a layer already there. Each one is a request as people write it, what she sees in it, the
// EXACT commands she gives (the tests run every one on a project and check their effect), and the reply that explains why.
// Made deterministically from seed lists (nothing to store), the closest are shown to her at each message. Pure.

import { FONTS } from "./jawad/student";
import { Rng } from "./content-examples";
import { SIZE_PRESETS, type AdjustKey } from "./photo";

export type PhotoKind =
  | "exposure" | "color_cast" | "flat" | "extremes" | "look" | "crop_platform" | "straighten" | "title" | "name_bar" | "product"
  | "portrait" | "thumbnail" | "card" | "old_photo" | "jawad" | "edit_layer";

export const PHOTO_KINDS: { id: PhotoKind; name: string }[] = [
  { id: "exposure", name: "إضاءة (غامقة أو ساطعة)" },
  { id: "color_cast", name: "حرارة وصبغة الألوان" },
  { id: "flat", name: "صورة باهتة أو مبالغ فيها" },
  { id: "extremes", name: "إضاءات محروقة وظلال مطموسة" },
  { id: "look", name: "فلتر وإحساس" },
  { id: "crop_platform", name: "قص ومقاس المنصة" },
  { id: "straighten", name: "تقويم وتدوير وقلب" },
  { id: "title", name: "عنوان مقروء على الصورة" },
  { id: "name_bar", name: "اسم أو شريط معلومات" },
  { id: "product", name: "صورة منتج" },
  { id: "portrait", name: "صورة رجل أو طفل" },
  { id: "thumbnail", name: "مصغّرة يوتيوب" },
  { id: "card", name: "تصميم وصل من كاظم" },
  { id: "old_photo", name: "صورة قديمة" },
  { id: "jawad", name: "طلب لجواد (صورة، قص، تعديل)" },
  { id: "edit_layer", name: "تعديل طبقة موجودة" },
];

/** What the test checks after the commands run on the baseline project. */
export interface Expect {
  /** sliders: [">" | "<" | "=", value] */
  adjust?: Partial<Record<AdjustKey, [">" | "<" | "=", number]>>;
  filter?: string;
  size?: [number, number];
  /** the canvas's width ÷ height, to 2 decimals */
  ratio?: number;
  /** layers added (negative: removed) */
  layers?: number;
  /** a text layer with this text exists */
  text?: string;
  /** the base picture is turned by this */
  rotate?: number;
  /** nothing changes */
  none?: true;
}

export interface PhotoExample {
  id: string;
  kind: PhotoKind;
  /** the request, as a person writes it (Gulf Arabic) */
  ask: string;
  /** what she sees in it (her diagnosis, one line) */
  diagnosis: string;
  /** the commands (objects; the model writes them as JSON strings) */
  ops: Record<string, unknown>[];
  /** the reply that explains what and why */
  reply: string;
  suggestions: string[];
  expect: Expect;
  /** a request for جواد, when the work needs one */
  jawad?: { kind: "generate" | "cutout" | "edit"; prompt: string; aspect: string; target: "base" | "layer" | "file"; source: string };
}

export const PHOTO_EXAMPLES_COUNT = 1000;

// ───────────────────────────── seed lists ─────────────────────────────

const SUBJECTS = ["صورة رجل", "صورة طفل", "صورة منتج", "صورة قهوة", "صورة مبنى", "منظر طبيعي", "صورة سيارة", "صورة أكل", "صورة ساعة", "صورة بحر", "صورة مجلس رجال", "صورة عطر", "صورة محل", "صورة تمر", "صورة جوال"];
const DEAR = ["", "", "لو سمحتي ", "يا زهراء ", "زهراء "];
const TITLES = ["افتتاح فرع جديد", "عرض الجمعة", "مجلس العزاء", "حفل التخرج", "قهوتنا الجديدة", "خصم ٣٠٪", "ذكرى المولد", "ورشة التصوير", "وصل حديثًا", "تهنئة بالمولود", "أهلًا بكم", "حصريًا لدينا", "سباق الدراجات", "معرض الكتاب", "دورة المبرمجين"];
const NAMES = ["محمد العلي", "أبو حسن", "مؤسسة الندى", "ستوديو الإبداع", "علي الكاظمي", "شركة النجاح", "متجر الأصالة", "عبدالله الموسوي"];
const COLORS = [["#FFFFFF", "#000000"], ["#FFD166", "#1B1B1B"], ["#F8F4E3", "#2B2B2B"], ["#FFFFFF", "#0B1F3A"], ["#E9C46A", "#000000"], ["#FFFFFF", "#7B1E3A"]] as const;
const TITLE_FONTS = FONTS.filter((f) => ["messiri", "reemkufi", "readex", "markazi"].includes(f.id)).map((f) => f.id);
const BODY_FONTS = FONTS.filter((f) => ["plex", "tajawal", "amiri"].includes(f.id)).map((f) => f.id);
const PLATFORMS = SIZE_PRESETS.filter((s) => ["ig_post", "ig_square", "story", "yt_thumb", "x_post", "linkedin", "card", "a4", "banner", "avatar"].includes(s.id));
const PLATFORM_NAME: Record<string, string> = { ig_post: "منشور انستغرام", ig_square: "مربع", story: "ستوري", yt_thumb: "مصغّرة يوتيوب", x_post: "منشور إكس", linkedin: "لينكدإن", card: "بطاقة", a4: "ورقة A4", banner: "بانر", avatar: "صورة شخصية" };
const LOOKS = [["cinematic", "سينمائي", "ظلال باردة وإضاءات دافئة وتباين"], ["warm", "دافئ", "حرارة ذهبية مريحة"], ["matte", "مات", "أسود مرفوع وألوان هادئة"], ["vintage", "قديم", "ألوان باهتة وحبيبات"], ["bw", "أبيض وأسود", "كلاسيكي هادئ"], ["bw_contrast", "أسود وأبيض قوي", "تباين عالٍ"], ["golden", "ساعة ذهبية", "وهج الغروب"], ["teal_orange", "تيل وبرتقالي", "ألوان الأفلام الحديثة"], ["noir", "نوار", "ليل قاتم"], ["fade", "باهت ناعم", "لمسة ضبابية"], ["emerald", "زمردي", "نغمة خضراء عميقة"], ["cool", "بارد", "نغمة زرقاء هادئة"], ["bright", "ساطع", "إضاءة عالية ونظافة"], ["dramatic", "درامي", "قتام وتباين وحدّة"]] as const;
const RATIO_NAME: Record<string, string> = { "1:1": "مربعة", "4:5": "طولية انستغرام", "16:9": "عرضية", "9:16": "ستوري", "2:3": "بطاقة", "3:2": "عريضة", "3:1": "بانر", "4:3": "عرضية قديمة" };
const RATIO_NUM: Record<string, number> = { "1:1": 1, "4:5": 0.8, "16:9": 1.78, "9:16": 0.56, "2:3": 0.67, "3:2": 1.5, "3:1": 3, "4:3": 1.33 };
const FOCUS = [["الوجه", 50, 30], ["الموضوع على اليمين", 72, 50], ["الموضوع على اليسار", 28, 50], ["الجزء الأعلى", 50, 20], ["الجزء الأسفل", 50, 80], ["الوسط", 50, 50]] as const;

const pickN = <T,>(r: Rng, xs: readonly T[]) => r.pick(xs);
const ask = (r: Rng, s: string) => `${r.pick(DEAR)}${s}`.trim();
const SUGG: Record<PhotoKind, string[]> = {
  exposure: ["أضف حدة خفيفة", "جرّب فلتر دافئ", "قصّها لستوري"],
  color_cast: ["خلّها أدفأ شوي", "زد التباين", "جرّب فلتر طبيعي"],
  flat: ["أضف تظليل للأطراف", "جرّب فلتر سينمائي", "زد الحدة"],
  extremes: ["زد التباين شوي", "أضف حدة", "جرّب فلتر طبيعي"],
  look: ["قلّل قوة الفلتر", "أضف عنوانًا", "قصّها لانستغرام"],
  crop_platform: ["أضف عنوانًا", "حسّن الألوان", "جرّب مقاس ثاني"],
  straighten: ["قصّها", "حسّن الإضاءة", "أضف عنوانًا"],
  title: ["غيّر لون العنوان", "كبّر الخط", "أضف اسمك أسفل"],
  name_bar: ["غيّر الخط", "حرّكه للأعلى", "أضف عنوانًا"],
  product: ["اقصص الخلفية", "أضف خلفية بيضاء", "أضف سعرًا"],
  portrait: ["أضف تظليل خفيف", "قصّها مربعة", "جرّب فلتر دافئ"],
  thumbnail: ["كبّر العنوان", "زد التشبع", "أضف إطارًا"],
  card: ["رجّعها لكاظم", "جرّب فلتر ناعم", "أضف زخرفة"],
  old_photo: ["حوّلها أبيض وأسود", "أضف حدة", "قصّ الأطراف"],
  jawad: ["ضعها خلف النص", "حرّك العنصر", "أضف ظلًا"],
  edit_layer: ["حرّكه للأعلى", "كبّره", "غيّر الخط"],
};

type Maker = (r: Rng) => Omit<PhotoExample, "id" | "kind">;

const MAKERS: Record<PhotoKind, Maker> = {
  exposure: (r) => {
    const dark = r.next() < 0.5;
    const subj = pickN(r, SUBJECTS);
    const e = dark ? r.int(14, 36) : -r.int(12, 30);
    const sh = dark ? r.int(10, 30) : 0;
    const hi = dark ? 0 : -r.int(8, 24);
    const c = r.int(0, 12);
    const values: Record<string, number> = { exposure: e, ...(sh ? { shadows: sh } : {}), ...(hi ? { highlights: hi } : {}), ...(c ? { contrast: c } : {}) };
    return {
      ask: ask(r, dark ? r.pick([`${subj} طالعة غامقة`, `${subj} ظلام وما تبين التفاصيل`, `فتّح ${subj}`, `${subj} مصوّرة بالليل وأبيها أوضح`]) : r.pick([`${subj} ساطعة بزيادة`, `${subj} محروقة من الإضاءة`, `خفّف السطوع في ${subj}`])),
      diagnosis: dark ? "الصورة تحت الإضاءة؛ المشكلة في الظلال والسطوع العام، لا في الألوان." : "الإضاءة عالية والإضاءات تقترب من الحرق؛ يلزم خفض السطوع واسترجاع تفاصيل الفاتح.",
      ops: [{ op: "adjust", values }],
      reply: dark
        ? `رفعت السطوع ${e} ورفعت الظلال ${sh} حتى تظهر التفاصيل المخفية بدون ما نحرق الفاتح${c ? `، وزدت التباين ${c} لأن الرفع يميل لتبييض الصورة` : ""}. لو ظهرت حبيبات شوي في الظلام فهذا طبيعي في الصور الليلية.`
        : `خفضت السطوع ${-e} وخففت الإضاءات ${-hi} عشان ترجع التفاصيل في المناطق الفاتحة${c ? `، وزدت التباين ${c} حتى ما تصير الصورة باهتة` : ""}.`,
      suggestions: SUGG.exposure,
      expect: { adjust: { exposure: [dark ? ">" : "<", 0], ...(sh ? { shadows: [">", 0] as [">", number] } : {}), ...(hi ? { highlights: ["<", 0] as ["<", number] } : {}) } },
    };
  },
  color_cast: (r) => {
    const warmCast = r.next() < 0.5;
    const t = warmCast ? -r.int(14, 38) : r.int(14, 38);
    const tint = r.next() < 0.4 ? r.int(-14, 14) : 0;
    const subj = pickN(r, SUBJECTS);
    return {
      ask: ask(r, warmCast ? r.pick([`${subj} طالعة صفراء`, `الألوان في ${subj} مايلة للأصفر`, `${subj} من لمبة صفراء وأبيها طبيعية`]) : r.pick([`${subj} طالعة زرقاء وباردة`, `الصورة باردة وأبيها أدفأ`, `دفّي ${subj}`])),
      diagnosis: warmCast ? "ميل أصفر من إضاءة اصطناعية؛ يلزم تبريد الحرارة لإعادة توازن الأبيض." : "ميل أزرق (بارد)؛ يلزم رفع الحرارة لتدفئة الصورة.",
      ops: [{ op: "adjust", values: { temperature: t, ...(tint ? { tint } : {}) } }],
      reply: `${warmCast ? "برّدت" : "دفّيت"} الصورة بضبط الحرارة على ${t}${tint ? ` وعدّلت الصبغة ${tint} لأن في ميل أخضر/بنفسجي خفيف` : ""}. الهدف أن يبان الأبيض أبيض والبشرة طبيعية؛ قل لي إذا تبي لمسة أدفأ أو أبرد من كذا.`,
      suggestions: SUGG.color_cast,
      expect: { adjust: { temperature: [warmCast ? "<" : ">", 0] } },
    };
  },
  flat: (r) => {
    const dull = r.next() < 0.6;
    const subj = pickN(r, SUBJECTS);
    const c = dull ? r.int(10, 28) : -r.int(10, 24);
    const s = dull ? r.int(8, 28) : -r.int(10, 30);
    const sh = dull ? r.int(10, 22) : 0;
    return {
      ask: ask(r, dull ? r.pick([`${subj} باهتة ومالها روح`, `زد الألوان في ${subj}`, `خلّ ${subj} أحيى`]) : r.pick([`ألوان ${subj} صارخة بزيادة`, `${subj} متشبعة وتتعب العين`, `هدّي ألوان ${subj}`])),
      diagnosis: dull ? "تباين وتشبّع منخفضان؛ تحتاج دفعة معتدلة لا مبالغة." : "تشبّع زائد يرهق العين ويحرق ألوان البشرة؛ يلزم تهدئته.",
      ops: [{ op: "adjust", values: { contrast: c, saturation: s, ...(sh ? { sharpen: sh } : {}) } }],
      reply: dull
        ? `رفعت التباين ${c} والتشبع ${s}${sh ? ` وأضفت حدة ${sh} لتتضح الحواف` : ""}. حافظت على القيم معتدلة؛ لو زودنا أكثر تبدأ الألوان تنفجر وتتبهدل البشرة.`
        : `نزّلت التشبع ${-s} وخففت التباين ${-c} حتى ترتاح العين ويرجع اللون طبيعي. لو تبي إحساس أهدى كمان جرّب فلتر «مات».`,
      suggestions: SUGG.flat,
      expect: { adjust: { saturation: [dull ? ">" : "<", 0], contrast: [dull ? ">" : "<", 0] } },
    };
  },
  extremes: (r) => {
    const burnt = r.next() < 0.5;
    const subj = pickN(r, SUBJECTS);
    const hi = burnt ? -r.int(35, 70) : -r.int(0, 10);
    const sh = burnt ? r.int(0, 12) : r.int(35, 70);
    return {
      ask: ask(r, burnt ? r.pick([`السماء في ${subj} محروقة بيضاء`, `الوجه لامع ومحروق في ${subj}`, `${subj} فيها أماكن بيضاء ما فيها تفاصيل`]) : r.pick([`الظلال في ${subj} سودا وما تبين`, `${subj} ضد الضوء والموضوع غامق`, `أبي أشوف التفاصيل في الظلال`])),
      diagnosis: burnt ? "إضاءات محروقة؛ الحل خفض الإضاءات فقط (ليس السطوع كله) لاسترجاع التفاصيل." : "ظلال مطموسة وصورة ضد الضوء؛ الحل رفع الظلال فقط وإبقاء الإضاءات.",
      ops: [{ op: "adjust", values: { highlights: hi, shadows: sh } }],
      reply: burnt
        ? `خفضت الإضاءات ${hi} فقط، فالسماء والمناطق الفاتحة ترجع لها تفاصيلها بدون ما أغمّق الصورة كلها. لو الحرق كامل (أبيض تام) ما تقدر أي أداة ترجّع الشي المفقود، لكن هنا فيه معلومات ظهرت.`
        : `رفعت الظلال ${sh} فقط، فتظهر التفاصيل في الغامق وتبقى الإضاءات مثل ما هي. هذا أفضل من رفع السطوع لأنه يحافظ على السماء.`,
      suggestions: SUGG.extremes,
      expect: { adjust: burnt ? { highlights: ["<", 0] } : { shadows: [">", 0] } },
    };
  },
  look: (r) => {
    const [id, name, hint] = r.pick(LOOKS);
    const k = pickN(r, [40, 50, 60, 70, 80, 100]);
    return {
      ask: ask(r, r.pick([`خلّها ${name}`, `أبيها بإحساس ${name}`, `ضع فلتر ${name}`, `جرّب ${name} على الصورة`])),
      diagnosis: `طلب إحساس: «${name}» (${hint}). أستخدم الفلتر الجاهز بقوة تناسب الصورة بدل تعديل كل شريحة.`,
      ops: [{ op: "filter", id, strength: k }],
      reply: `طبّقت فلتر «${name}» بقوة ${k}. ${k >= 100 ? "وهذا كامل القوة؛ " : ""}لو حسّيته قوي نزّل القوة، وتقدر تضبط الإضاءة بالشرائح فوقه.`,
      suggestions: SUGG.look,
      expect: { filter: id },
    };
  },
  crop_platform: (r) => {
    const byPreset = r.next() < 0.55;
    const [fname, fx, fy] = r.pick(FOCUS);
    if (byPreset) {
      const p = r.pick(PLATFORMS);
      const name = PLATFORM_NAME[p.id];
      return {
        ask: ask(r, r.pick([`جهّزها لـ${name}`, `أبيها مقاس ${name}`, `قصّها ${name} وركّز على ${fname}`])),
        diagnosis: `مقاس منصة: ${name} (${p.w}×${p.h}). أقصّ حول ${fname} فلا ينقص الموضوع.`,
        ops: [{ op: "canvas", preset: p.id, focus: { x: fx, y: fy } }],
        reply: `ضبطت اللوحة على ${name} (${p.w}×${p.h}) وقصيت حول ${fname}. كل الطبقات تحركت معها. لو الموضوع انقص من طرف قل لي أي جهة وأحرّك التركيز.`,
        suggestions: SUGG.crop_platform,
        expect: { size: [p.w, p.h] },
      };
    }
    const ratio = r.pick(Object.keys(RATIO_NUM));
    return {
      ask: ask(r, r.pick([`قصّها ${RATIO_NAME[ratio]}`, `أبيها نسبة ${ratio}`, `خلّها ${RATIO_NAME[ratio]} وركّز على ${fname}`])),
      diagnosis: `قص بنسبة ${ratio} مع تركيز على ${fname}.`,
      ops: [{ op: "crop_ratio", ratio, focus: { x: fx, y: fy } }],
      reply: `قصيت الصورة بنسبة ${ratio} وخليت التركيز على ${fname}، وأخذت أكبر مساحة ممكنة حتى ما تنقص الجودة.`,
      suggestions: SUGG.crop_platform,
      expect: { ratio: RATIO_NUM[ratio] },
    };
  },
  straighten: (r) => {
    const mode = r.int(0, 3);
    const deg = (r.next() < 0.5 ? -1 : 1) * r.int(1, 8);
    if (mode === 0) return { ask: ask(r, r.pick([`الأفق مايل`, `الصورة مايلة شوي، عدّلها`, `قوّم الصورة`])), diagnosis: "ميل خفيف في الأفق؛ التقويم بالدرجات الصغيرة مع تكبير يخفي الزوايا.", ops: [{ op: "straighten", deg }], reply: `قوّمت الصورة ${deg}° وكبّرتها قليلًا حتى ما تظهر زوايا فاضية. لو بقي ميل زد أو نقّص درجة.`, suggestions: SUGG.straighten, expect: {} };
    if (mode === 1) return { ask: ask(r, r.pick([`دوّرها يمين`, `الصورة نايمة على جنبها`, `لفّها ٩٠ درجة`])), diagnosis: "الصورة في اتجاه خاطئ؛ تدوير ربع دورة مع اللوحة كلها.", ops: [{ op: "rotate", deg: 90 }], reply: "دوّرتها ٩٠° مع اللوحة وكل طبقاتها. لو اتجهت للجهة الغلط قل لي أرجعها يسار.", suggestions: SUGG.straighten, expect: { rotate: 90 } };
    if (mode === 2) return { ask: ask(r, r.pick([`دوّرها يسار`, `لفّها عكس الساعة`])), diagnosis: "طلب تدوير ربع دورة عكس عقارب الساعة (يسار).", ops: [{ op: "rotate", deg: -90 }], reply: "دوّرتها ٩٠° لليسار مع كل طبقاتها، وتقدر تتراجع لو الاتجاه مو مضبوط.", suggestions: SUGG.straighten, expect: { rotate: 270 } };
    return { ask: ask(r, r.pick([`اقلبها`, `اقلب الصورة أفقي`, `خلّ الصورة معكوسة`])), diagnosis: "قلب أفقي؛ النصوص تبقى مقروءة (لا تنعكس) وتتحرك مواضعها فقط.", ops: [{ op: "flip", axis: "h" }], reply: "قلبتها أفقيًا. النصوص ما انعكست حتى تبقى مقروءة، بس تغيّر مكانها مع الصورة.", suggestions: SUGG.straighten, expect: {} };
  },
  title: (r) => {
    const t = pickN(r, TITLES);
    const [fg, bg] = r.pick(COLORS);
    const font = pickN(r, TITLE_FONTS);
    const y = pickN(r, [14, 18, 82, 86]);
    const top = y < 50;
    const size = r.int(6, 10);
    return {
      ask: ask(r, r.pick([`اكتب «${t}» ${top ? "فوق" : "تحت"}`, `أضف عنوان ${t}`, `ضع كلمة ${t} على الصورة بخط عريض`])),
      diagnosis: "عنوان على صورة: يلزم مقروئية على الجوال؛ خلفية معتّمة خلف النص أو حد/ظل، حجم ٦–١٠٪، وهوامش آمنة.",
      ops: [
        { op: "add_shape", shape: "rect", x: 50, y, w: 100, h: 17, fill: bg, opacity: 0.5 },
        { op: "add_text", text: t, font, size, color: fg, x: 50, y, w: 84, align: "center", effect: "shadow", effect_color: "#000000", weight: 700 },
      ],
      reply: `كتبت «${t}» ${top ? "في الأعلى" : "في الأسفل"} بخط ${font} حجم ${size}٪ وحطيت شريطًا معتّمًا شفافًا خلفه عشان يتقرأ على أي خلفية، وتركت هوامش من الأطراف. تقدر تحرّكه بالسحب أو تقول لي أغيّر اللون والخط.`,
      suggestions: SUGG.title,
      expect: { layers: 2, text: t },
    };
  },
  name_bar: (r) => {
    const n = pickN(r, NAMES);
    const [fg, bg] = r.pick(COLORS);
    const font = pickN(r, BODY_FONTS);
    return {
      ask: ask(r, r.pick([`اكتب اسمي «${n}» تحت`, `أضف توقيع ${n} في الزاوية`, `حط شريط تحت وفيه ${n}`])),
      diagnosis: "اسم أو شريط معلومات: نص صغير مقروء في الأسفل مع شريط خفيف خلفه.",
      ops: [
        { op: "add_shape", shape: "rect", x: 50, y: 94, w: 100, h: 9, fill: bg, opacity: 0.7 },
        { op: "add_text", text: n, font, size: 3.8, color: fg, x: 50, y: 94, w: 70, align: "center", effect: "none", weight: 400 },
      ],
      reply: `أضفت شريطًا في أسفل الصورة وكتبت فيه «${n}» بخط ${font} حجم صغير مقروء، بدون ما يغطي الموضوع.`,
      suggestions: SUGG.name_bar,
      expect: { layers: 2, text: n },
    };
  },
  product: (r) => {
    const subj = pickN(r, ["المنتج", "العطر", "الساعة", "علبة التمر", "كوب القهوة", "الجوال"]);
    const mode = r.int(0, 2);
    if (mode === 0) return {
      ask: ask(r, r.pick([`جهّز صورة ${subj} للمتجر`, `نظّف صورة ${subj} وخلّها احترافية`])),
      diagnosis: "صورة منتج للمتجر: إضاءة نظيفة، حدة، ألوان صادقة، تظليل خفيف يركّز على الوسط، وقص مربع.",
      ops: [{ op: "adjust", values: { exposure: 8, contrast: 10, saturation: 8, sharpen: 24, shadows: 12, vignette: 10 } }, { op: "crop_ratio", ratio: "1:1" }],
      reply: `رفعت الإضاءة قليلًا وزدت الحدة والتباين والتشبع بحدود صغيرة عشان يبان المنتج بلونه الحقيقي، وأضفت تظليلًا خفيفًا للأطراف، وقصيتها مربعة لأنها أنسب لعرض المتاجر.`,
      suggestions: SUGG.product,
      expect: { adjust: { sharpen: [">", 0] }, ratio: 1 },
    };
    if (mode === 1) return {
      ask: ask(r, r.pick([`اقصص خلفية ${subj}`, `أبي ${subj} بدون خلفية`, `شيل الخلفية وخلّها بيضاء`])),
      diagnosis: "قص الخلفية يحتاج جواد (إزالة الخلفية)؛ بعدها خلفية بيضاء نظيفة.",
      ops: [{ op: "bg", color: "#FFFFFF" }],
      reply: `طلبت من جواد يقص خلفية ${subj} ويرجّعه عنصرًا شفافًا. أول ما يوصل أحطه على لوحة بيضاء نظيفة. القص يُخصم من رصيدك (ما عدا من لا يدفع).`,
      suggestions: SUGG.product,
      expect: {},
      jawad: { kind: "cutout", prompt: "", aspect: "auto", target: "layer", source: "base" },
    };
    return {
      ask: ask(r, r.pick([`أضف سعر ${subj}`, `اكتب السعر على ${subj}`])),
      diagnosis: "سعر على صورة منتج: شارة بارزة بلون واضح في زاوية، نص كبير قصير.",
      ops: [
        { op: "add_shape", shape: "ellipse", x: 82, y: 16, w: 24, h: 17, fill: "#E63946", opacity: 1, stroke: "#FFFFFF", stroke_w: 0.6 },
        { op: "add_text", text: `${r.pick([49, 79, 99, 149, 199, 299])} ر.س`, font: "readex", size: 4.2, color: "#FFFFFF", x: 82, y: 16, w: 22, align: "center", effect: "none", weight: 700 },
      ],
      reply: "حطيت شارة حمراء دائرية في الزاوية العليا وكتبت السعر بخط عريض أبيض، فيبين من أول نظرة بدون ما يغطي المنتج.",
      suggestions: SUGG.product,
      expect: { layers: 2 },
    };
  },
  portrait: (r) => {
    const who = r.pick(["صورة رجل", "صورة الوالد", "صورة طفل", "صورة الشيخ", "صورتي"]);
    const mode = r.int(0, 2);
    if (mode === 0) return {
      ask: ask(r, r.pick([`حسّن ${who}`, `${who} أبيها أحلى`, `لمسة نهائية على ${who}`])),
      diagnosis: "تحسين صورة شخص: بشرة طبيعية، دفء خفيف، وجه أوضح، وتظليل ناعم يركّز على الوجه.",
      ops: [{ op: "adjust", values: { exposure: 6, temperature: 8, shadows: 12, highlights: -10, sharpen: 14, vignette: 18 } }],
      reply: "رفعت الإضاءة قليلًا وخففت الإضاءات اللامعة على الوجه ودفّيت بدرجة صغيرة وزدت حدة خفيفة وظللت الأطراف بنعومة. ما أفرطت حتى تبقى البشرة طبيعية.",
      suggestions: SUGG.portrait,
      expect: { adjust: { vignette: [">", 0], highlights: ["<", 0] } },
    };
    if (mode === 1) return {
      ask: ask(r, r.pick([`قصّ ${who} مربعة للحساب`, `${who} أبيها صورة شخصية`])),
      diagnosis: "صورة شخصية: مربعة والوجه في الثلث العلوي.",
      ops: [{ op: "canvas", preset: "avatar", focus: { x: 50, y: 32 } }],
      reply: "قصيتها مربعة 800×800 ووجّهت التركيز على الثلث العلوي حيث الوجه عادة، فيظهر الوجه كبير وواضح في الدائرة.",
      suggestions: SUGG.portrait,
      expect: { size: [800, 800] },
    };
    return {
      ask: ask(r, r.pick([`${who} أبيها بالأبيض والأسود`, `حوّل ${who} لأبيض وأسود`])),
      diagnosis: "أبيض وأسود لصورة شخص: تباين معتدل يحفظ تفاصيل الوجه.",
      ops: [{ op: "filter", id: "bw", strength: 100 }, { op: "adjust", values: { contrast: 12, sharpen: 12 } }],
      reply: "طبّقت فلتر الأبيض والأسود وزدت التباين والحدة شوي حتى تبقى تفاصيل الوجه واضحة ولا تصير الصورة رمادية باهتة.",
      suggestions: SUGG.portrait,
      expect: { filter: "bw" },
    };
  },
  thumbnail: (r) => {
    const t = pickN(r, TITLES);
    const font = pickN(r, ["reemkufi", "messiri", "readex"]);
    return {
      ask: ask(r, r.pick([`جهّز مصغّرة يوتيوب وفيها «${t}»`, `سوّ لي thumbnail بكلمة ${t}`, `حسّن المصغّرة واكتب ${t}`])),
      diagnosis: "مصغّرة يوتيوب: 16:9، ألوان حيوية وتباين عالٍ، عنوان قصير ضخم بحد أسود يُقرأ على الجوال.",
      ops: [
        { op: "canvas", preset: "yt_thumb" },
        { op: "adjust", values: { contrast: 18, saturation: 22, sharpen: 20 } },
        { op: "add_text", text: t, font, size: 15, color: "#FFE14D", x: 50, y: 78, w: 88, align: "center", effect: "outline", effect_color: "#000000", weight: 700 },
      ],
      reply: `ضبطت المقاس 16:9، وقوّيت التباين والتشبع والحدة لأن المصغّرة تتنافس مع عشرات غيرها بحجم صغير، وكتبت «${t}» بخط ${font} ضخم أصفر بحد أسود يتقرأ حتى من الجوال. خلّ الكلمات ٢–٤ كلمات بس.`,
      suggestions: SUGG.thumbnail,
      expect: { size: [1280, 720], text: t },
    };
  },
  card: (r) => {
    const mode = r.int(0, 2);
    if (mode === 0) return {
      ask: ask(r, r.pick([`التصميم من كاظم حلو بس أبيه أدفأ`, `خفف تشبع خلفية البطاقة بدون ما تلمس الكلام`, `زد وضوح الزخرفة`])),
      diagnosis: "تصميم من كاظم: الشرائح تؤثر على الصورة الأساسية فقط، والنصوص طبقات حقيقية لا تتأثر.",
      ops: [{ op: "adjust", values: { temperature: 10, saturation: -6, sharpen: 12 } }],
      reply: "عدّلت الألوان في صورة التصميم فقط (أدفأ وأهدى وأحد شوي) والنصوص ما انلمست ولا تغيّرت. لو خلصت قل «رجّعها لكاظم».",
      suggestions: SUGG.card,
      expect: { adjust: { temperature: [">", 0] } },
    };
    if (mode === 1) return {
      ask: ask(r, r.pick([`أضف إطار رفيع على البطاقة`, `حط إطار ذهبي حولها`])),
      diagnosis: "إطار رفيع: مستطيل بلا تعبئة وحد ذهبي بهامش من الأطراف.",
      ops: [{ op: "add_shape", shape: "rect", x: 50, y: 50, w: 92, h: 94, fill: "", stroke: "#D4AF37", stroke_w: 0.6, radius: 1.5, opacity: 1 }],
      reply: "أضفت إطارًا ذهبيًا رفيعًا بلا تعبئة وبزوايا مستديرة قليلًا وبهامش من الأطراف، فيعطي أناقة بدون ما يزاحم الكلام.",
      suggestions: SUGG.card,
      expect: { layers: 1 },
    };
    return {
      ask: ask(r, r.pick([`خلصنا، رجّعه لكاظم`, `رجّع التصميم لكاظم`, `تمام، أرسله لكاظم`])),
      diagnosis: "العميل أنهى ويطلب الإرجاع لكاظم صراحة؛ لا تعديل جديد، وأكتب في السجل ما تغيّر.",
      ops: [],
      reply: "تمام! جهّزت التصميم للرجوع: الصورة كلها بدون الكلام تصير خلفية جديدة لكاظم، والنصوص تبقى عنده قابلة للتعديل. اضغط «رجّع لكاظم» وأكتب له ملخصًا بما غيّرته.",
      suggestions: ["رجّع لكاظم"],
      expect: { none: true },
    };
  },
  old_photo: (r) => {
    const subj = r.pick(["صورة جدي", "صورة قديمة للبيت", "صورة قديمة للمسجد", "صورة قديمة بالأبيض والأسود", "صورة مسح ضوئي باهتة"]);
    const mode = r.int(0, 1);
    return mode === 0
      ? { ask: ask(r, `${subj} باهتة وصفراء، رجّع لها الحياة`), diagnosis: "صورة قديمة: اصفرار وتباين منخفض وحدة ضعيفة؛ أبرّد الحرارة وأقوّي التباين وأرفع الحدة، ولا أبالغ.", ops: [{ op: "adjust", values: { temperature: -14, contrast: 22, saturation: 8, sharpen: 30, shadows: 14 } }], reply: "برّدت الاصفرار وزدت التباين والحدة ورفعت الظلال شوي. الصور القديمة ما ترجع جديدة تمامًا، لكن هذا يعطي أقصى ما فيها من تفاصيل. لو تبي أبيض وأسود ثابت قل لي.", suggestions: SUGG.old_photo, expect: { adjust: { contrast: [">", 0], sharpen: [">", 0] } } }
      : { ask: ask(r, `خلّ ${subj} بإحساس قديم أصيل`), diagnosis: "العكس: إحساس قديم مقصود؛ فلتر «قديم» بقوة معتدلة.", ops: [{ op: "filter", id: "vintage", strength: 70 }], reply: "طبّقت فلتر «قديم» بقوة 70: ألوان باهتة دافئة وحبيبات وتظليل. نزّل القوة لو تبيه أخف.", suggestions: SUGG.old_photo, expect: { filter: "vintage" } };
  },
  jawad: (r) => {
    const mode = r.int(0, 2);
    if (mode === 0) {
      const bgs = ["a soft warm studio backdrop with a gentle gradient and plenty of calm empty space", "a luxurious dark marble surface with soft golden light", "a clean bright minimal background in pale beige with a soft shadow", "an elegant deep green velvet texture with subtle light"];
      const bg = r.pick(bgs);
      return { ask: ask(r, r.pick([`سوّ لي خلفية فخمة`, `أبي خلفية استوديو للمنتج`, `ولّد لي خلفية جميلة`])), diagnosis: "صورة جديدة (خلفية) لا تُصنع بالأوامر: أطلبها من جواد بوصف دقيق، بلا نص مكتوب، وأضعها خلف كل شي.", ops: [], reply: "طلبت من جواد خلفية جديدة بهذا الوصف، وأول ما توصل أضعها صورة أساسية خلف طبقاتك. الصورة تظهر أيضًا في «أعمالي» وتُخصم من رصيدك (ما عدا من لا يدفع).", suggestions: SUGG.jawad, expect: {}, jawad: { kind: "generate", prompt: `${bg}, empty center area for placing a product, photographic, no text, no people`, aspect: "auto", target: "base", source: "base" } };
    }
    if (mode === 1) return { ask: ask(r, r.pick([`اقصص الشخص من الصورة`, `أبي الموضوع بدون خلفية`, `شيل خلفية الصورة`])), diagnosis: "قص الخلفية: جواد يعيد الموضوع شفافًا فوق الصورة؛ أتحقق أن في صورة أساسية.", ops: [], reply: "طلبت من جواد يقص الموضوع بخلفية شفافة. يوصل عنصرًا فوق الصورة وتقدر تحرّكه وتحط خلفية جديدة تحته.", suggestions: SUGG.jawad, expect: {}, jawad: { kind: "cutout", prompt: "", aspect: "auto", target: "layer", source: "base" } };
    return { ask: ask(r, r.pick([`خلّ الخلفية ليل بدل النهار`, `غيّر الجو العام للصورة لغروب`, `أضف غيوم للسماء`])), diagnosis: "تعديل صورة بوصف: جواد يعدّل الصورة الأساسية ويحافظ على باقي العناصر.", ops: [], reply: "طلبت من جواد تعديل الصورة بهذا الوصف مع إبقاء كل شي ثاني كما هو. أول ما يرجع أضعه مكان الأساسية، وتقدر ترجع للأصلية بالتراجع.", suggestions: SUGG.jawad, expect: {}, jawad: { kind: "edit", prompt: "Change only the sky and the overall time of day as requested, keep every other element, composition and colour of the subject exactly the same, photographic, no text", aspect: "auto", target: "base", source: "base" } };
  },
  edit_layer: (r) => {
    const mode = r.int(0, 5);
    const [fg] = r.pick(COLORS);
    const font = pickN(r, TITLE_FONTS);
    switch (mode) {
      case 0: return { ask: ask(r, `غيّر لون العنوان`), diagnosis: "تعديل لون طبقة نص موجودة؛ أحافظ على كل شي ثاني.", ops: [{ op: "update", id: "t1", patch: { color: fg } }], reply: `غيّرت لون العنوان إلى ${fg}. تأكد أنه واضح على الخلفية؛ لو مو واضح أضيف له حدًا أو ظلًا.`, suggestions: SUGG.edit_layer, expect: {} };
      case 1: return { ask: ask(r, `كبّر العنوان`), diagnosis: "تكبير طبقة نص؛ الحجم بالمئة من ارتفاع اللوحة.", ops: [{ op: "update", id: "t1", patch: { size: 11 } }], reply: "كبّرت العنوان إلى 11٪ من ارتفاع اللوحة. لو طلع طويل بالعرض قلّل العرض أو الحجم.", suggestions: SUGG.edit_layer, expect: {} };
      case 2: return { ask: ask(r, `غيّر خط العنوان`), diagnosis: "تغيير الخط من قائمة خطوط الموقع.", ops: [{ op: "update", id: "t1", patch: { font } }], reply: `بدّلت خط العنوان إلى ${font}. جرّبه، وإن ما عجبك أجرّب غيره.`, suggestions: SUGG.edit_layer, expect: {} };
      case 3: return { ask: ask(r, `حرّك العنوان للأعلى`), diagnosis: "تحريك طبقة نص: القيمة الرأسية الأصغر تعني أعلى اللوحة.", ops: [{ op: "move", id: "t1", x: 50, y: 14 }], reply: "حرّكت العنوان للأعلى في المنتصف مع إبقاء حجمه وخطه كما هما.", suggestions: SUGG.edit_layer, expect: {} };
      case 4: return { ask: ask(r, `وسّط العنوان`), diagnosis: "محاذاة طبقة نص أفقيًا إلى منتصف اللوحة.", ops: [{ op: "align", id: "t1", to: "center" }], reply: "وسّطت العنوان أفقيًا في اللوحة، وبقي ارتفاعه في مكانه.", suggestions: SUGG.edit_layer, expect: {} };
      default: return { ask: ask(r, `احذف الشريط المعتّم`), diagnosis: "حذف طبقة شكل موجودة (الشريط المعتّم).", ops: [{ op: "delete", id: "s2" }], reply: "حذفت الشريط. تقدر ترجعه بزر التراجع لو غيّرت رأيك.", suggestions: SUGG.edit_layer, expect: { layers: -1 } };
    }
  },
};

/** How many of the thousand each kind gets (the rest go to the biggest groups). */
const SHARE: Record<PhotoKind, number> = { exposure: 80, color_cast: 70, flat: 70, extremes: 60, look: 104, crop_platform: 110, straighten: 40, title: 100, name_bar: 50, product: 70, portrait: 60, thumbnail: 40, card: 40, old_photo: 30, jawad: 40, edit_layer: 50 };

let bank: PhotoExample[] | null = null;

/** The thousand worked examples (the same every time). */
export function photoExamples(): PhotoExample[] {
  if (bank) return bank;
  const out: PhotoExample[] = [];
  PHOTO_KINDS.forEach((k, ki) => {
    const r = new Rng(900_001 + ki * 7919);
    const seen = new Set<string>();
    let n = 0;
    let guard = 0;
    while (n < SHARE[k.id] && guard++ < SHARE[k.id] * 60) {
      const e = MAKERS[k.id](r);
      const sig = `${e.ask}|${JSON.stringify(e.ops)}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push({ id: `${k.id}-${n + 1}`, kind: k.id, ...e });
      n++;
    }
  });
  bank = out;
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[ً-ْ]/g, "");
const tokens = (s: string) => new Set(norm(s).split(/[^\p{L}\p{N}]+/u).map((w) => w.replace(/^(ال|لل|بال|وال|ل|ب|و)(?=.{3})/, "")).filter((w) => w.length >= 2));

/** The closest examples to a message: the ones whose request shares the most words, one per kind first. */
export function nearestPhotoExamples(message: string, k = 3): PhotoExample[] {
  const q = tokens(message);
  const scored = photoExamples().map((e) => {
    const t = tokens(`${e.ask} ${e.diagnosis}`);
    let score = 0;
    for (const w of q) if (t.has(w)) score += w.length >= 4 ? 2 : 1;
    return { e, score };
  });
  scored.sort((a, b) => b.score - a.score || a.e.id.localeCompare(b.e.id));
  const out: PhotoExample[] = [];
  const seenAsk = new Set<string>();
  const kinds = new Set<string>();
  for (const { e, score } of scored) {
    if (out.length >= k || score === 0) break;
    if (seenAsk.has(e.ask) || kinds.has(e.kind) && out.length < k - 1) continue;
    seenAsk.add(e.ask);
    kinds.add(e.kind);
    out.push(e);
  }
  return out;
}

/** The examples as «زهراء» sees them in a turn. */
export function photoExamplesBrief(list: PhotoExample[]): string {
  if (!list.length) return "";
  return `أمثلة مرجعية لطلبات تشبه هذا الطلب وكيف تُعالَج (اتبعي منطقها وقيمها المعتدلة، وكيّفي الأرقام والمعرّفات لحالة اللوحة الحالية؛ لا تذكريها للعميل):\n${list
    .map((e, i) => `${i + 1}. الطلب: «${e.ask}»\n   التشخيص: ${e.diagnosis}\n   الأوامر: ${e.ops.length ? e.ops.map((o) => JSON.stringify(o)).join(" ") : "(لا أوامر)"}${e.jawad ? `\n   طلب لجواد: ${JSON.stringify(e.jawad)}` : ""}\n   الرد: ${e.reply}`)
    .join("\n")}`;
}
