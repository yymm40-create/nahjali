// «الجواد الذكي!» | JAWAD AI — the example bank «جواد» learns the ten kinds of work from: a thousand worked examples
// for each (a request as people write it → the form it should become: generator options and a full prompt), made
// deterministically from seed lists so they cost nothing to keep and the tests can check every one of them.
// At each turn the closest examples to the person's message are shown to Claude (few-shot), so it answers the way
// the examples do. Pure. The site's rule holds in every example: no real women, ever.

import { PLAYBOOKS, detectPlaybook, type Playbook, type Studio } from "./playbooks";
import type { Settings } from "./types";

export interface PlaybookExample {
  id: string;
  playbook: string;
  studio: Studio;
  /** The request, as a person writes it (Gulf Arabic). */
  ask: string;
  /** The options the form should take (the registry's keys). */
  settings: Settings;
  /** The prompt the form should hold. */
  prompt: string;
}

export const EXAMPLES_PER_PLAYBOOK = 1000;

// ───────────────────────────── seed lists ─────────────────────────────

interface Noun {
  ar: string;
  en: string;
}
const n = (ar: string, en: string): Noun => ({ ar, en });

const PRODUCTS: Noun[] = [
  n("عطر", "perfume bottle"), n("كريم وجه", "face cream jar"), n("زيت شعر", "hair oil bottle"), n("قهوة مختصة", "specialty coffee bag"), n("شاي", "tea tin"), n("عسل", "honey jar"), n("تمر", "box of dates"), n("شوكولاتة", "chocolate box"),
  n("ساعة يد", "wristwatch"), n("نظارة شمسية", "pair of sunglasses"), n("حذاء رياضي", "sneaker"), n("حقيبة ظهر", "backpack"), n("محفظة جلد", "leather wallet"), n("سماعة", "headphones"), n("جوال", "smartphone"), n("لابتوب", "laptop"),
  n("كوب قهوة", "ceramic coffee mug"), n("ترمس", "thermos flask"), n("شمعة معطرة", "scented candle"), n("صابون طبيعي", "natural soap bar"), n("بخور", "bakhoor box"), n("مسواك", "miswak pack"), n("مكمل غذائي", "supplement bottle"), n("بروتين", "protein tub"),
  n("مشروب طاقة", "energy drink can"), n("عصير", "juice bottle"), n("ماء", "water bottle"), n("شيبس", "chips bag"), n("بسكويت", "biscuit pack"), n("آيس كريم", "ice cream tub"), n("برجر", "burger"), n("بيتزا", "pizza"),
  n("كعك", "cake"), n("كنافة", "kunafa tray"), n("قهوة عربية", "Arabic coffee dallah"), n("مبخرة", "incense burner"), n("سجادة صلاة", "prayer rug"), n("مصحف", "Quran with an ornate cover"), n("دلة", "golden dallah"), n("سكين مطبخ", "kitchen knife"),
  n("كاميرا", "camera"), n("سماعة بلوتوث", "bluetooth speaker"), n("لعبة أطفال", "children's toy car"), n("كتاب", "hardcover book"), n("عود", "oud wood chips"), n("مفتاح سيارة", "car key fob"), n("قلم", "fountain pen"), n("حقيبة سفر", "travel suitcase"),
];

const SURFACES: Noun[] = [
  n("على رخام أبيض", "on white marble"), n("على خشب", "on warm oak wood"), n("على ثلج", "on a slab of ice with frost"), n("وسط رذاذ ماء", "with a water splash"), n("على حجر أسود", "on black basalt stone"), n("على قماش كتان", "on natural linen"),
  n("على خلفية بيضاء", "on a pure white seamless background"), n("على خلفية سادة ملونة", "on a seamless pastel void"), n("طايف في الهوا", "floating in mid-air"), n("على رمل الصحراء", "on desert sand at golden hour"), n("على ستاند أسود لامع", "on a glossy black pedestal"), n("بين ورق أخضر", "among fresh green leaves"),
];

const PLACES: Noun[] = [
  n("في المطبخ", "in a bright modern kitchen"), n("في المكتب", "in a tidy office"), n("في السيارة", "in a car"), n("في الشارع", "on a city street"), n("على البحر", "at the beach"), n("في المجلس", "in a traditional majlis"),
  n("في الجيم", "at the gym"), n("في المقهى", "in a café"), n("في الصحراء", "in the desert"), n("في المزرعة", "at a farm"), n("على السطح", "on a rooftop at sunset"), n("في المطار", "at the airport"),
];

const MEN: Noun[] = [
  n("شاب", "a young man in his twenties"), n("رجل", "a man in his thirties"), n("رجل كبير", "a man in his fifties"), n("ولد صغير", "a boy around eight"), n("شاب بثوب", "a young man in a white thobe"), n("رجل بشماغ", "a man in a thobe and red shemagh"),
  n("شاب رياضي", "an athletic young man in sportswear"), n("موظف", "a man in a business shirt"), n("أب مع ولده", "a father with his young son"), n("شيف", "a male chef in whites"),
];

const MOODS: Noun[] = [n("فخم", "luxurious"), n("طبيعي", "natural and candid"), n("مرح", "playful and bright"), n("هادي", "calm and minimal"), n("طاقة", "high-energy"), n("دافي", "warm and cosy"), n("حديث", "modern and clean"), n("تراثي", "heritage, traditional Gulf")];

const PLATFORMS: { ar: string; img: string; vid: string }[] = [
  { ar: "للمتجر", img: "1:1", vid: "1:1" },
  { ar: "للانستغرام", img: "1:1", vid: "9:16" },
  { ar: "لستوري", img: "9:16", vid: "9:16" },
  { ar: "لريلز", img: "9:16", vid: "9:16" },
  { ar: "لتيك توك", img: "9:16", vid: "9:16" },
  { ar: "ليوتيوب", img: "16:9", vid: "16:9" },
  { ar: "لسناب", img: "9:16", vid: "9:16" },
  { ar: "لموقعي", img: "16:9", vid: "16:9" },
  { ar: "للطباعة", img: "2:3", vid: "16:9" },
  { ar: "لأمازون", img: "1:1", vid: "1:1" },
];

const TOPICS: Noun[] = [
  n("السفر لليابان", "travel to Japan"), n("الاستثمار", "investing"), n("تعلم البرمجة", "learning to code"), n("الطبخ", "cooking"), n("الرياضة", "fitness"), n("السيارات", "cars"), n("الألعاب", "gaming"), n("القهوة", "coffee"),
  n("الذكاء الاصطناعي", "AI"), n("ريادة الأعمال", "entrepreneurship"), n("التصوير", "photography"), n("الكاميرات", "cameras"), n("العقار", "real estate"), n("التاريخ", "history"), n("الفضاء", "space"), n("الصحة", "health"),
  n("الجوالات", "smartphones"), n("المذاكرة", "studying"), n("الزراعة", "gardening"), n("الصيد", "fishing"), n("الرحلات البرية", "desert camping"), n("البودكاست", "podcasting"), n("التسويق", "marketing"), n("الكتب", "books"),
];
const HOOKS = ["ليش؟!", "ما تتوقع", "بـ ٣٠٠ ريال", "السر", "أول مرة", "الحقيقة", "جربتها", "لا تسويها", "خطأ الكل يسويه", "أسهل طريقة", "في ٧ أيام", "صدمة"];
const FEELINGS: Noun[] = [n("صدمة", "shock"), n("فضول", "curiosity"), n("فرح", "joy"), n("جدية", "seriousness"), n("حماس", "excitement")];
const COLORS: Noun[] = [n("أزرق وأصفر", "blue and yellow"), n("أحمر وأسود", "red and black"), n("أخضر وأبيض", "green and white"), n("ذهبي وأسود", "gold and black"), n("بنفسجي ونيون", "purple and neon cyan"), n("برتقالي وكحلي", "orange and navy")];

const OCCASIONS: Noun[] = [n("رمضان", "Ramadan"), n("العيد", "Eid"), n("اليوم الوطني", "National Day"), n("افتتاح الفرع", "the branch opening"), n("نهاية الأسبوع", "the weekend"), n("يوم التأسيس", "Founding Day"), n("العودة للمدارس", "back to school"), n("الجمعة البيضاء", "White Friday")];
const OFFERS = ["خصم ٥٠٪", "خصم ٣٠٪", "اشتر ٢ والثالث مجانًا", "توصيل مجاني", "عرض محدود", "جديد", "قريبًا", "افتتاح"];

const GARMENTS: Noun[] = [
  n("ثوب", "white thobe"), n("شماغ", "red shemagh"), n("بشت", "black bisht with gold trim"), n("جاكيت جلد", "leather jacket"), n("قميص", "linen shirt"), n("حذاء جلد", "leather shoes"), n("ساعة", "watch"), n("نظارة", "glasses"),
  n("عباية", "abaya"), n("فستان", "dress"), n("طرحة", "hijab scarf"), n("حقيبة يد", "handbag"), n("خاتم", "ring"), n("عقد", "necklace"), n("جلابية", "jalabiya"), n("تيشيرت", "printed t-shirt"),
];
const WOMENS = new Set(["عباية", "فستان", "طرحة", "حقيبة يد", "عقد", "جلابية"]);

const EFFECTS: Noun[] = [
  n("ايرث زوم", "Earth zoom: the camera pulls straight up and back from the subject through the clouds to orbit in one unbroken move"),
  n("بوليت تايم", "Bullet time: the subject freezes mid-action while the camera sweeps a smooth 180° arc around the frozen scene, then time resumes"),
  n("كراش زوم", "Crash zoom: a violent fast push-in from a wide shot to a tight close-up on the subject's face with a slight shake"),
  n("دوران 360", "360 orbit: the camera circles the subject once at eye level, smooth and steady, background sweeping past"),
  n("كلونز", "Clones: identical copies of the subject step out beside them one by one and mirror the same move"),
  n("يختفي", "Vanish: the subject disappears in an instant and their empty clothes collapse to the ground"),
  n("يذوب", "Melting: the subject slowly melts into a glossy puddle, clothes stretching into liquid trails"),
  n("تجميد الزمن", "Frozen in motion: the subject hangs frozen mid-air while people and traffic keep moving around them"),
  n("عملاق في المدينة", "Street colossus: the subject grows into a giant standing among the city's buildings, cars tiny below"),
  n("انهيار الخلفية", "Cutout: the surroundings break apart into floating paper layers revealing a white void, then snap back"),
  n("تحويل اللوحة", "Painting split: the bottom half is a classical painting, the top half the subject recreating it, both animate"),
  n("درون FPV", "FPV drone: the camera dives past the subject and races through the space at high speed"),
];

const STYLES: Noun[] = [
  n("أنمي", "anime cel-shaded"), n("بيكسار", "Pixar-like 3D with soft skin"), n("رسم فيكتور", "flat vector illustration"), n("أكشن فيقر", "collectible action figure in a blister pack"), n("كرتون", "cartoon"), n("كوميكس", "comic-book ink and halftone"),
  n("رسم زيتي", "classical oil painting"), n("لعبة فيديو", "stylised video-game character render"), n("كلاي", "claymation figure"), n("بكسل", "pixel art"),
];
const BACKDROPS: Noun[] = [n("خلفية رمادية", "a plain warm-grey studio background"), n("خلفية بيضاء", "a clean white background"), n("مكتب مبهر", "a softly blurred modern office"), n("خلفية كحلية", "a deep navy backdrop"), n("خلفية زرقاء فاتحة", "a light blue gradient background"), n("مكتبة", "a blurred bookshelf")];
const OUTFITS: Noun[] = [n("بدلة كحلية", "a navy suit and white shirt"), n("ثوب أبيض وشماغ", "a white thobe and red shemagh"), n("قميص أبيض", "a crisp white shirt"), n("بليزر رمادي", "a grey blazer over a black tee"), n("ثوب وغترة بيضاء", "a white thobe and white ghutra"), n("جاكيت أسود", "a black jacket")];
const JOBS: Noun[] = [n("مهندس", "engineer"), n("طبيب", "doctor"), n("مدير", "manager"), n("مبرمج", "software developer"), n("محامي", "lawyer"), n("معلم", "teacher"), n("رجل أعمال", "businessman"), n("طالب", "student"), n("مصمم", "designer"), n("طيار", "pilot")];

const MOTION_SUBJECTS: Noun[] = [
  n("شعاري", "the logo @ref"), n("اسم متجري", 'the words "متجر النور"'), n("تطبيقي", "the app screenshot @ref inside a phone mock-up"), n("موقعي", "the website screenshot @ref inside a laptop mock-up"), n("أرقام الأرباح", 'the number "+٣٢٠٪" counting up'), n("قائمة مميزات", 'three short labels "سريع", "آمن", "مجاني"'),
  n("كلمة تخفيضات", 'the words "تخفيضات" and "٥٠٪"'), n("أيقونات الخدمات", "four flat icons: a cart, a truck, a card, a star"), n("عنوان الحلقة", 'the title "الحلقة ١"'), n("شريط الأخبار", 'a ticker with the word "عاجل"'),
];
const MOTION_STYLES: Noun[] = [n("مينيمال", "clean minimal SaaS style with soft gradients and rounded cards"), n("ملوّن مرح", "playful flat 2D with pastel shapes"), n("3D لامع", "glossy 3D chrome"), n("كولاج ريترو", "paper-cut retro collage"), n("تايبوغرافي جريء", "bold kinetic typography"), n("نيون", "neon outlines on dark"), n("كرتون", "cartoon 2D"), n("شاشة قديمة", "retro CRT scanlines")];

// ───────────────────────────── a deterministic picker ─────────────────────────────

class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = (seed >>> 0) || 1;
  }
  next() {
    // xorshift32
    let x = this.s;
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return this.s / 4294967296;
  }
  pick<T>(a: T[]): T {
    return a[Math.floor(this.next() * a.length)];
  }
  int(min: number, max: number) {
    return min + Math.floor(this.next() * (max - min + 1));
  }
}

const KEEP = "kept exactly as in @ref: same shape, label, colours and text";

// ───────────────────────────── one example of each kind ─────────────────────────────

type Maker = (r: Rng) => { ask: string; settings: Settings; prompt: string; studio: Studio };

const MAKERS: Record<string, Maker> = {
  "product-shot": (r) => {
    const p = r.pick(PRODUCTS);
    const s = r.pick(SURFACES);
    const m = r.pick(MOODS);
    const pl = r.pick(PLATFORMS);
    const listing = s.ar === "على خلفية بيضاء" || pl.ar === "للمتجر" || pl.ar === "لأمازون";
    const ask = r.pick([`أبي صورة منتج لـ${p.ar} ${s.ar} ${pl.ar}`, `صوّر لي ${p.ar} ${s.ar}`, `صورة احترافية لـ${p.ar} ${pl.ar}، جو ${m.ar}`, `سوّ لي تصوير منتج ${p.ar}`, `عندي ${p.ar} أبي صورته ${s.ar} ${pl.ar}`, `صورة ${p.ar} ${s.ar} بجو ${m.ar}`]);
    const prompt = listing
      ? `Professional e-commerce product photo of the ${p.en} @ref, ${KEEP}. Centred on a pure white seamless background, eye-level three-quarter view, soft studio key light from the left, subtle rim light, soft natural shadow beneath, faint reflection. Photoreal, sharp, commercial product photography. No hands, no other objects, no added text.`
      : `${m.en.charAt(0).toUpperCase() + m.en.slice(1)} advertising product shot of the ${p.en} @ref (${KEEP}), ${s.en}, three-quarter view, soft studio key light with a warm rim light, soft shadow and a faint reflection, shallow depth of field, photoreal, high-end commercial look. One product only, no hands, no people, no added text.`;
    return { ask, settings: { aspect: pl.img, quality: "high", resolution: "hi" }, prompt, studio: "image" };
  },
  "product-lifestyle": (r) => {
    const p = r.pick(PRODUCTS);
    const who = r.pick(MEN);
    const pl = r.pick(PLACES);
    const platform = r.pick(PLATFORMS);
    const ugc = r.next() < 0.5;
    const ask = r.pick([`صورة ${who.ar} يمسك ${p.ar} ${pl.ar}`, `أبي لايف ستايل لـ${p.ar} مع ${who.ar} ${platform.ar}`, `${who.ar} يستخدم ${p.ar} ${pl.ar}، صورة طبيعية`, `صورة واقعية لـ${p.ar} بيد ${who.ar} ${pl.ar}`, `لايف ستايل: ${p.ar} مع ${who.ar} ${pl.ar} ${platform.ar}`, `${who.ar} يمسك ${p.ar} ${pl.ar} ${platform.ar}`]);
    const prompt = `${ugc ? "UGC-style candid photo" : "Campaign-style lifestyle photo"}: ${who.en} holds the ${p.en} @ref (${KEEP}) up toward the camera with a natural relaxed expression, ${pl.en}, ${ugc ? "phone-shot look, slightly imperfect framing, natural window or daylight" : "50mm lens, shallow depth of field, soft natural light"}, the product sharp and readable, real skin texture. Vertical framing, no added text.`;
    return { ask, settings: { aspect: platform.img === "16:9" ? "3:2" : "2:3", quality: "high", resolution: "hi" }, prompt, studio: "image" };
  },
  "hyper-motion": (r) => {
    const p = r.pick(PRODUCTS);
    const m = r.pick(MOODS);
    const platform = r.pick(PLATFORMS);
    const sec = r.pick([5, 6, 8, 8, 10]);
    const event = r.pick(["ice cubes and water splash burst in from the sides in slow motion", "fruit slices and droplets explode outward and freeze mid-air", "coloured powder bursts behind it in a cloud", "silk fabric ripples around it like water", "glass shards fly outward and reassemble", "golden particles swirl into an orbit around it", "a liquid wave curls around it without touching the label", "the floor cracks and light bursts from beneath"]);
    const ask = r.pick([`أبي إعلان هايبر موشن لـ${p.ar}`, `إعلان CGI لـ${p.ar} ${platform.ar}، ${sec} ثواني`, `فيديو إعلاني لـ${p.ar} بجو ${m.ar}`, `اعلان منتج ${p.ar} بدون ناس، بس المنتج`, `سوّ لي فيديو منتج ${p.ar} بسبلاش وطاقة`]);
    const prompt = `Hyper-motion CGI commercial, ${sec} seconds, no people, no voice-over, no on-screen text. The ${p.en} @ref (exact shape, label and colours of @ref throughout) stands on a glossy reflective floor in a ${m.en} studio. 0–${Math.round(sec * 0.3)} s: macro push-in on its surface details. ${Math.round(sec * 0.3)}–${Math.round(sec * 0.7)} s: the camera sweeps a fast orbit as ${event}. ${Math.round(sec * 0.7)}–${sec} s: everything settles and the product lands centred under a warm rim light with a clean highlight. Premium product lighting, shallow depth of field, 24 fps cinematic. Sound: whoosh, impact hit, a soft bass drop at the end.`;
    return { ask, settings: { ratio: platform.vid, resolution: "1080p", duration: sec, audio: true }, prompt, studio: "video" };
  },
  "ugc-ad": (r) => {
    const p = r.pick(PRODUCTS);
    const who = r.pick(MEN);
    const pl = r.pick(PLACES);
    const kind = r.pick(["review", "unboxing", "tutorial"]);
    const line = r.pick(["Sarahatan hatha al-muntaj ghayyar yomi", "Wallah ma tawaqqa‘t yikoon bihal jawda", "Jarrabtah usboo‘ wa hatha raayi", "Shoofoo shloon sahl isti‘malah", "Hatha illi kint adawwir ‘alaih"]);
    const ask = r.pick([`ريفيو لـ${p.ar} بصوت ${who.ar} ${pl.ar}`, `أبي أنبوكسنق لـ${p.ar} مع ${who.ar}`, `إعلان UGC لـ${p.ar}: ${who.ar} يتكلم عنه ${pl.ar}`, `${who.ar} يشرح ${p.ar} للكاميرا ${pl.ar}`, `اعلان بشخص يجرب ${p.ar} ${pl.ar}`, `مراجعة ${p.ar} بأسلوب ${who.ar}`]);
    const body = kind === "unboxing" ? `opens a cardboard box on a table, lifts out the ${p.en} @ref (exactly as in @ref) with a genuine surprised reaction, turns it in his hands` : kind === "tutorial" ? `shows the ${p.en} @ref (exactly as in @ref) to the camera and demonstrates how it is used step by step` : `holds the ${p.en} @ref (label exactly as in @ref) up beside his face, smiles`;
    const prompt = `UGC-style ${kind} ad, 8 seconds, vertical phone video, front camera, handheld, natural light ${pl.en}. ${who.en.charAt(0).toUpperCase() + who.en.slice(1)} ${body} and says in Gulf Arabic: "${line}" — his lips match the words; he ends with a small nod to the camera. Real skin texture, slight camera shake, room tone, clear voice, no music, no on-screen text.`;
    return { ask, settings: { ratio: "9:16", resolution: "720p", duration: 8, audio: true }, prompt, studio: "video" };
  },
  thumbnail: (r) => {
    const t = r.pick(TOPICS);
    const h = r.pick(HOOKS);
    const f = r.pick(FEELINGS);
    const c = r.pick(COLORS);
    const reel = r.next() < 0.25;
    const side = r.pick(["left", "right"]);
    const ask = r.pick([`ثامبنيل لفيديو عن ${t.ar}`, `أبي ثامبنيل يوتيوب عن ${t.ar} بإحساس ${f.ar}`, `${reel ? "كفر ريل" : "ثامبنيل"} عن ${t.ar}، النص "${h}"`, `سوّ لي صورة مصغرة لفيديو ${t.ar} بألوان ${c.ar}`, `ثامب لحلقة عن ${t.ar}`]);
    const prompt = `${reel ? "Reel cover 9:16" : "YouTube thumbnail 16:9"}. ${side === "left" ? "Left" : "Right"} third left EMPTY for the host with a soft rim-light glow there, no person and no face drawn anywhere. The other side: a bold, simple ${t.en}-themed scene in ${c.en}, slightly blurred, and huge text "${h}" in thick white letters with a black outline and one highlighted word in yellow, very high contrast, a ${f.en} mood, readable at phone size, no clutter, bottom-right corner clear.`;
    return { ask, settings: { aspect: reel ? "9:16" : "16:9", quality: "high", resolution: "hi" }, prompt, studio: "image" };
  },
  "poster-social": (r) => {
    const o = r.pick(OFFERS);
    const occ = r.pick(OCCASIONS);
    const p = r.pick(PRODUCTS);
    const c = r.pick(COLORS);
    const platform = r.pick(PLATFORMS);
    const ask = r.pick([`ستوري لعرض ${o} على ${p.ar}`, `بوستر ${occ.ar} لمتجري`, `منشور ${platform.ar}: ${o} بمناسبة ${occ.ar}`, `تصميم إعلان ${o} لـ${p.ar} بألوان ${c.ar}`, `بوست منيو لـ${p.ar} ${platform.ar}`, `دعوة ${occ.ar} بتصميم فخم`]);
    const prompt = `${platform.img === "9:16" ? "Instagram story design 9:16" : platform.img === "1:1" ? "Square 1:1 social post design" : "Poster design"} for ${occ.en}. Palette ${c.en}, a clean festive background with soft light, the ${p.en} @ref (${KEEP}) centred in the lower half with a soft spotlight. Bold text "${o}" in large clear well-spaced letters at the top third, one smaller line "بمناسبة ${occ.ar}" below it. The logo @logo kept exactly, small at the bottom centre. High contrast, safe margins, no other text, no people.`;
    return { ask, settings: { aspect: platform.img, quality: "high", resolution: "hi" }, prompt, studio: "image" };
  },
  "try-on-fashion": (r) => {
    const g = r.pick(GARMENTS);
    const womens = WOMENS.has(g.ar);
    const who = r.pick(MEN);
    const pl = r.pick(PLACES);
    const cartoon = womens && r.next() < 0.4;
    const mood = r.pick(MOODS);
    const ask = r.pick([`${g.ar} على موديل ${who.ar} للمتجر`, `أبي تجربة لبس لـ${g.ar} ${pl.ar}`, `لقطة أزياء لـ${g.ar} ${pl.ar} بجو ${mood.ar}`, `صوّر ${g.ar} ملبوس على ${who.ar}`, `لوك بوك لـ${g.ar} بجو ${mood.ar}`, `تجربة لبس ${g.ar} على ${who.ar} ${pl.ar}`]);
    const prompt = womens
      ? cartoon
        ? `Flat 2D illustrated fashion figure, cartoon style, fully covered in an abaya and a hijab covering the hair completely, wearing the ${g.en} @ref (same cut, colour and pattern as @ref) over it, a simple stylised face, standing in a clean pastel studio, soft shading, elegant pose. Illustration only, not photoreal, vertical 2:3, no text.`
        : `Ghost-mannequin product photo of the ${g.en} @ref (cut, colour, fabric and details exactly as in @ref) shown as if worn on an invisible mannequin: no person, no face, no skin visible, full length in a clean light-grey studio, soft even lighting, fabric draping naturally. Photoreal, sharp texture, shop catalogue style, vertical 2:3, no text.`
      : `Virtual try-on photo: ${who.en} wears the ${g.en} @ref (cut, colour, pattern and details exactly as in @ref) ${pl.en}, full-body three-quarter pose, soft natural light, 50mm lens, shallow depth of field, the garment sharp with real fabric texture and a correct natural fit. Photoreal, vertical 2:3, no text.`;
    return { ask, settings: { aspect: "2:3", quality: "high", resolution: "hi" }, prompt, studio: "image" };
  },
  "viral-effect": (r) => {
    const e = r.pick(EFFECTS);
    const who = r.pick(MEN);
    const sec = r.pick([4, 5, 5, 6]);
    const platform = r.pick(PLATFORMS);
    const ask = r.pick([`خلي صورتي تسوي ${e.ar} ${platform.ar}`, `أبي مؤثر ${e.ar} على الصورة، ${sec} ثواني`, `حرّك الصورة بـ${e.ar} ${platform.ar}`, `ترند ${e.ar} على صورة ${who.ar}`, `لقطة سينمائية ${e.ar} من صورتي ${platform.ar}`, `مؤثر ${e.ar} على صورة ${who.ar}، ${sec} ثواني`]);
    const prompt = `Starts exactly from @ref as the first frame (${who.en}). ${e.en}. The person's face, clothes and the place stay exactly as in @ref; one effect only, ${sec} seconds, 24 fps cinematic, vertical for reels, slow motion on the hero moment. Sound: a whoosh and a deep bass hit at the move, no speech.`;
    return { ask, settings: { resolution: "720p", duration: sec, audio: true }, prompt, studio: "video" };
  },
  "headshot-avatar": (r) => {
    const st = r.pick(STYLES);
    const job = r.pick(JOBS);
    const c = r.pick(COLORS);
    const headshot = r.next() < 0.45;
    const bg = r.pick(BACKDROPS);
    const fit = r.pick(OUTFITS);
    const ask = headshot
      ? r.pick([`هيدشوت للينكدإن بـ${fit.ar}`, `صورة بروفايل رسمية كـ${job.ar} على ${bg.ar}`, `أبي صورة شخصية احترافية لسيرتي الذاتية بـ${fit.ar}`, `حوّل صورتي لهيدشوت رسمي على ${bg.ar}`, `هيدشوت ${job.ar} بـ${fit.ar}`])
      : r.pick([`حوّل صورتي ${st.ar} على ${bg.ar}`, `أفاتار ${st.ar} مني بـ${fit.ar}`, `سوني شخصية ${st.ar} كـ${job.ar}`, `أبي صورتي بستايل ${st.ar} بألوان ${c.ar}`, `أفاتار ${st.ar} بألوان ${c.ar} على ${bg.ar}`]);
    const prompt = headshot
      ? `Professional LinkedIn headshot of the same person as @ref: same face, features, skin tone, hair, beard and glasses, identity unchanged. Head-and-shoulders crop, 85mm lens look, soft large key light from the front-left with a gentle fill, ${bg.en} slightly blurred, wearing ${fit.en} fitting a ${job.en}, a natural confident expression, eyes to camera. Photoreal, sharp eyes, square 1:1, no text.`
      : `${st.en.charAt(0).toUpperCase() + st.en.slice(1)} portrait of the same person as @ref: same face shape, features, skin tone, hairstyle, beard and glasses, stylised in this look. Waist-up, friendly expression, wearing ${fit.en}, palette ${c.en}, ${bg.en} as a simple matching background, clean polished render. Square 1:1, no text.`;
    return { ask, settings: { aspect: "1:1", quality: "high", resolution: "hi" }, prompt, studio: "image" };
  },
  "motion-graphics": (r) => {
    const sub = r.pick(MOTION_SUBJECTS);
    const st = r.pick(MOTION_STYLES);
    const platform = r.pick(PLATFORMS);
    const sec = r.pick([4, 5, 6, 6, 8]);
    const ask = r.pick([`موشن جرافيك لـ${sub.ar}`, `انترو ${st.ar} لـ${sub.ar}`, `أبي ${sub.ar} يتحرك بالموشن ${platform.ar}`, `شرح بالموشن لـ${sub.ar} بستايل ${st.ar}`, `نص متحرك: ${sub.ar}`]);
    const prompt = `Motion graphics, ${sec} seconds, ${platform.vid}, ${st.en}. On a clean gradient background, ${sub.en} (kept exactly) enters by sliding in with smooth easing, scales up with a snappy overshoot, holds for a beat while a light sweep passes across, then settles centred; a thin accent shape draws on underneath. Two to three colours only, consistent line weights, nothing else moving. Sound: soft whooshes, a snap and a light chime, no speech.`;
    return { ask, settings: { ratio: platform.vid, resolution: "1080p", duration: sec, audio: true }, prompt, studio: "video" };
  },
};

// ───────────────────────────── the bank ─────────────────────────────

const banks = new Map<string, PlaybookExample[]>();

/** A thousand examples of one kind of work (the same every time). */
export function examplesFor(playbook: string, count = EXAMPLES_PER_PLAYBOOK): PlaybookExample[] {
  const key = `${playbook}:${count}`;
  const hit = banks.get(key);
  if (hit) return hit;
  const make = MAKERS[playbook];
  const def = PLAYBOOKS.find((p) => p.id === playbook);
  if (!make || !def) return [];
  const r = new Rng(PLAYBOOKS.indexOf(def) * 7919 + 17);
  const out: PlaybookExample[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (out.length < count && guard++ < count * 20) {
    const e = make(r);
    const sig = `${e.ask}|${e.prompt}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({ id: `${playbook}-${out.length + 1}`, playbook, studio: e.studio, ask: e.ask, settings: e.settings, prompt: e.prompt });
  }
  banks.set(key, out);
  return out;
}

export const allExamples = () => PLAYBOOKS.flatMap((p) => examplesFor(p.id));

const tokens = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .normalize("NFC")
      .replace(/[ً-ْٰـ]/g, "")
      .replace(/[إأآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/^(ال|لل|بال|وال)/, "")
      .split(/[^\p{L}\p{N}]+/u)
      .map((w) => w.replace(/^(ال|لل|بال|وال|ل|ب|و)(?=.{3})/, ""))
      .filter((w) => w.length >= 2),
  );

/**
 * The closest examples to a message, for the kind of work it asks (or all kinds when none is clear): the ones whose
 * request shares the most words with it, from the examples of this studio first.
 */
export function nearestExamples(message: string, studio: Studio, k = 3, context = ""): PlaybookExample[] {
  const id = detectPlaybook(message, context);
  const pool = id ? examplesFor(id) : allExamples();
  const q = tokens(message);
  const seenAsk = new Set<string>();
  const scored = pool.flatMap((e) => {
    // one entry per distinct request (the bank repeats a request with other options)
    if (seenAsk.has(e.ask)) return [];
    seenAsk.add(e.ask);
    const t = tokens(e.ask);
    let score = e.ask === message ? 100 : 0;
    for (const w of q) if (t.has(w)) score += w.length >= 4 ? 2 : 1;
    if (e.studio === studio) score += 1.5;
    return [{ e, score }];
  });
  scored.sort((a, b) => b.score - a.score || a.e.id.localeCompare(b.e.id));
  return scored.slice(0, k).map((x) => x.e);
}

/** The examples as Claude sees them in a turn. */
export function examplesBrief(list: PlaybookExample[]) {
  if (!list.length) return "";
  return `EXAMPLES of requests like this one and the form they became (follow their shape; adapt the content to what this person wants):\n${list
    .map((e, i) => `${i + 1}. Request: «${e.ask}»\n   generator options: ${JSON.stringify(e.settings)}\n   prompt: ${e.prompt}`)
    .join("\n")}`;
}

export type { Playbook };
