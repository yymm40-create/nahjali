// «صانع المحتوى» — the 50 Arabic fonts a person picks from for a carousel, after its style (the owner's order, 2 November
// 2026: «خيار اختيار الخطوط المناسبة … وبعض الستايلات معاها خط جاهز»). Every one is a font of «حيدرة كت»'s catalogue
// (src/lib/editor/fonts.ts: open licences, checked to load with CORS and to join Arabic on a canvas), so «حيدرا ماكس»
// writes with the real file; GPT Image 2 cannot take a file, so it gets the font's look in words.
// Which were chosen: an Instagram look at 360 posts under 14 Arabic-font hashtags (2 November 2026). Most of the fonts
// those posts name are paid (Hacen, DG, TS, Adobe), so the list keeps the free ones they show (`seen`) and fills the rest
// from the catalogue by type; ★ (`top`) is one per group, from those posts where they named one, else my judgment.

import { FONT_BY_ID } from "@/lib/editor/fonts";

export const FONT_GROUPS = ["حديث", "عناوين عريضة", "كوفي", "نسخ", "رقعة", "يدوي", "مغربي", "زخرفي"] as const;
export type FontGroup = (typeof FONT_GROUPS)[number];

export interface ContentFont {
  /** the catalogue id (src/lib/editor/fonts.ts) */
  id: string;
  name: string;
  group: FontGroup;
  /** what it looks like, to the person */
  feel: string;
  bestFor: string;
  /** its look in words, for GPT Image 2 (which cannot load a file) */
  gpt: string;
  /** where the Instagram look saw it */
  seen?: string;
  /** the strongest of its group */
  top?: boolean;
}

export const CONTENT_FONTS: ContentFont[] = [
  // ───────── حديث ─────────
  { id: "ibm-plex-sans-arabic", name: "بلكس عربي", group: "حديث", top: true, seen: "قوائم الخطوط المفضلة عند المصممين، وخط IBM الرسمي", feel: "حديث ونظيف ومتوازن، يقرأ بسهولة بكل الأوزان.", bestFor: "التقنية والشرح والأعمال وأي نص طويل", gpt: "a clean modern corporate Arabic sans-serif like IBM Plex Sans Arabic, even strokes, open shapes" },
  { id: "cairo", name: "القاهرة", group: "حديث", feel: "عريض وواضح، من أكثر الخطوط انتشارًا على الشاشات.", bestFor: "العناوين القوية والميمز والتسويق", gpt: "a bold friendly geometric Arabic sans like Cairo, wide and very legible" },
  { id: "tajawal", name: "تجوال", group: "حديث", feel: "خفيف ورشيق بزوايا ناعمة.", bestFor: "التطبيقات والإشعارات ونصوص الشرائح", gpt: "a light elegant modern Arabic sans like Tajawal, slim and airy" },
  { id: "almarai", name: "المراعي", group: "حديث", feel: "سعودي الروح، بسيط وثقيل في العريض.", bestFor: "التويتات والاقتباسات القصيرة والإعلانات", gpt: "a simple heavy Saudi-style Arabic sans like Almarai, plain and confident" },
  { id: "readex-pro", name: "ريدكس", group: "حديث", feel: "هندسي ومريح، خط موقع الجواد نفسه.", bestFor: "هوية الجواد والمحادثات والواجهات", gpt: "a rounded geometric modern Arabic sans like Readex Pro, calm and clear" },
  { id: "alexandria", name: "الإسكندرية", group: "حديث", feel: "هندسي حاد وثقيل جدًا في الأسود.", bestFor: "الشرائح البيضاء الكبيرة والعناوين الضخمة", gpt: "a heavy geometric Arabic sans like Alexandria, strong flat terminals, very bold" },
  { id: "zain", name: "زين", group: "حديث", seen: "منشور «خطوط مجانية لمشروعك القادم» (٨ أوزان، استخدام تجاري)", feel: "عصري بثمانية أوزان، ناعم ومرن.", bestFor: "الهويات والمشاريع التجارية", gpt: "a soft contemporary Arabic sans like Zain, smooth curves, many weights" },
  { id: "beiruti", name: "بيروتي", group: "حديث", seen: "منشور «خطوط مجانية لمشروعك القادم» (٨ أوزان، استخدام تجاري)", feel: "مضغوط قليلًا وأنيق، فيه روح الملصقات.", bestFor: "الملصقات والفعاليات والعناوين الطويلة", gpt: "a slightly condensed stylish Arabic sans like Beiruti, poster feel" },
  { id: "mada", name: "مدى", group: "حديث", seen: "قوائم الخطوط العربية للتصميم (حساب علي علاء)", feel: "واضح وبسيط بلا زخرفة.", bestFor: "الإنفوجرافيك والجداول والأرقام", gpt: "a plain clear Arabic sans like Mada, no decoration, very readable" },
  { id: "rubik", name: "روبيك", group: "حديث", feel: "زوايا مدورة خفيفة، ودود.", bestFor: "المحتوى الشبابي والتطبيقات", gpt: "a friendly Arabic sans with slightly rounded corners like Rubik" },
  { id: "fustat", name: "الفسطاط", group: "حديث", feel: "حديث بلمسة كلاسيكية، متين.", bestFor: "المقالات والقوائم والنصوص الجادة", gpt: "a sturdy modern Arabic sans with a classical touch like Fustat" },
  { id: "changa", name: "تشانغا", group: "حديث", feel: "مربع قليلًا وتقني.", bestFor: "التقنية والألعاب والرياضة", gpt: "a squarish technical Arabic sans like Changa" },
  { id: "montserrat-arabic", name: "مونتسرات عربي", group: "حديث", feel: "هندسي عالمي يتماشى مع الإنجليزي.", bestFor: "المحتوى الثنائي اللغة والبراندات", gpt: "a geometric Arabic sans that pairs with Montserrat, international look" },
  { id: "alan-sans", name: "آلان سانس", group: "حديث", feel: "نظيف ومحايد بثلاثة أوزان.", bestFor: "النصوص الصغيرة والتسميات", gpt: "a neutral clean Arabic sans like Alan Sans" },
  // ───────── عناوين عريضة ─────────
  { id: "baloo-bhaijaan-2", name: "بالو بهايجان", group: "عناوين عريضة", top: true, seen: "قوائم الخطوط العربية للتصميم (حساب علي علاء)", feel: "مدور وممتلئ ومرح، كأنه منفوخ.", bestFor: "المحتوى الطفولي والـ3D والكوميكس", gpt: "a chunky rounded bubbly Arabic display typeface like Baloo Bhaijaan, soft and playful" },
  { id: "lalezar", name: "لاله‌زار", group: "عناوين عريضة", feel: "أثقل خط عريض، صاخب وضخم.", bestFor: "الأسئلة الاستفزازية والإعلانات والعروض", gpt: "an ultra-heavy loud Arabic display typeface like Lalezar, poster weight" },
  { id: "lemonada", name: "ليمونادة", group: "عناوين عريضة", feel: "مدور ومنعش وفيه حركة.", bestFor: "الطعام والمشروبات وأفلام الأنيميشن", gpt: "a rounded fresh lively Arabic display typeface like Lemonada" },
  { id: "el-messiri", name: "المسيري", group: "عناوين عريضة", feel: "أنيق بلمسة خط يدوي كلاسيكي.", bestFor: "الاقتباسات الهادئة والفخامة", gpt: "an elegant Arabic display typeface with a calligraphic touch like El Messiri" },
  { id: "rakkas", name: "رقّاص", group: "عناوين عريضة", feel: "عريض بتباين كبير، فيه طابع إعلانات قديمة.", bestFor: "الملصقات القديمة والسينما", gpt: "a high-contrast heavy Arabic display typeface like Rakkas, vintage poster feel" },
  { id: "jomhuria", name: "جمهورية", group: "عناوين عريضة", feel: "مضغوط وطويل وقوي.", bestFor: "الأخبار والعناوين الطويلة في سطر واحد", gpt: "a tall condensed bold Arabic display typeface like Jomhuria" },
  { id: "marhey", name: "مرحى", group: "عناوين عريضة", feel: "مرح ومتمايل، كأنه مرسوم باليد.", bestFor: "الصلصال والأطفال والمناسبات", gpt: "a playful bouncy hand-drawn Arabic display typeface like Marhey" },
  { id: "badeen-display", name: "بديع", group: "عناوين عريضة", feel: "زخرفي حديث بحواف مميزة.", bestFor: "الشعارات والعناوين الفنية", gpt: "a modern decorative Arabic display typeface like Badeen Display" },
  { id: "alyamama", name: "اليمامة", group: "عناوين عريضة", feel: "قوي بطابع سعودي ونجدي.", bestFor: "المحتوى السعودي والهويات المحلية", gpt: "a strong Najdi-inspired Arabic display typeface like Alyamama" },
  { id: "katibeh", name: "كتيبة", group: "عناوين عريضة", feel: "رفيع وطويل بطابع مخطوط قديم.", bestFor: "التراث والحكايات", gpt: "a tall slim manuscript-feel Arabic display typeface like Katibeh" },
  // ───────── كوفي ─────────
  { id: "reem-kufi", name: "ريم كوفي", group: "كوفي", top: true, feel: "كوفي هندسي حديث ونظيف.", bestFor: "الهويات والشعارات والعناوين المعمارية", gpt: "a clean modern geometric Kufi Arabic typeface like Reem Kufi" },
  { id: "kufam", name: "كوفام", group: "كوفي", feel: "كوفي بخطوط مستقيمة وزوايا حادة.", bestFor: "التقنية والمعمار", gpt: "a sharp straight-lined Kufi Arabic typeface like Kufam" },
  { id: "qahiri", name: "قاهري", group: "كوفي", feel: "كوفي تاريخي مستوحى من نقوش القاهرة.", bestFor: "التاريخ والتراث والمناسبات", gpt: "a historic Fatimid-inspired Kufi Arabic typeface like Qahiri" },
  { id: "noto-kufi-arabic", name: "نوتو كوفي", group: "كوفي", feel: "كوفي واضح بكل الأوزان.", bestFor: "الواجهات والعناوين الرسمية", gpt: "a clear Kufi-style Arabic sans like Noto Kufi Arabic" },
  // ───────── نسخ ─────────
  { id: "amiri", name: "أميري", group: "نسخ", top: true, feel: "نسخ كلاسيكي فاخر كخط الكتب المطبوعة.", bestFor: "الشعر والأدب والجرائد والكتب", gpt: "a classical book Naskh Arabic typeface like Amiri, elegant traditional strokes" },
  { id: "noto-naskh-arabic", name: "نوتو نسخ", group: "نسخ", feel: "نسخ واضح ومتزن.", bestFor: "النصوص الطويلة والمراجع", gpt: "a clear balanced Naskh Arabic typeface like Noto Naskh Arabic" },
  { id: "scheherazade-new", name: "شهرزاد", group: "نسخ", feel: "نسخ مريح وكبير الحروف.", bestFor: "التعليم والقراءة السهلة", gpt: "a large comfortable Naskh Arabic typeface like Scheherazade New" },
  { id: "markazi-text", name: "مركزي", group: "نسخ", feel: "نسخ عصري بتباين أنيق، يصلح للعناوين.", bestFor: "المجلات والإديتوريال", gpt: "a contemporary high-contrast editorial Naskh Arabic typeface like Markazi Text" },
  { id: "harmattan", name: "هرمتان", group: "نسخ", seen: "قوائم الخطوط العربية للتصميم (حساب علي علاء)", feel: "نسخ بسيط بطابع أفريقي هادئ.", bestFor: "الاقتباسات والنصوص الدينية والهادئة", gpt: "a simple calm Naskh Arabic typeface like Harmattan" },
  { id: "lateef", name: "لطيف", group: "نسخ", feel: "نسخ ناعم ودائري.", bestFor: "الرسائل والنصوص الدافئة", gpt: "a soft rounded Naskh Arabic typeface like Lateef" },
  { id: "mirza", name: "ميرزا", group: "نسخ", feel: "نسخ ثقيل بطابع فارسي.", bestFor: "العناوين التراثية", gpt: "a heavy Persian-flavoured Naskh Arabic typeface like Mirza" },
  { id: "parastoo", name: "پرستو", group: "نسخ", seen: "قوائم الخطوط العربية للتصميم (حساب علي علاء)", feel: "نسخ رشيق وطويل.", bestFor: "الأماكن والسفر والقصص", gpt: "a slender graceful Naskh Arabic typeface like Parastoo" },
  { id: "kitab", name: "كتاب", group: "نسخ", feel: "نسخ مخصص للكتب، مريح جدًا.", bestFor: "الكتاب المفتوح والمراجع", gpt: "a bookish reading Naskh Arabic typeface like Kitab" },
  // ───────── رقعة ─────────
  { id: "aref-ruqaa", name: "رقعة عارف", group: "رقعة", top: true, feel: "رقعة حقيقية كخط اليد المدرسي الجميل.", bestFor: "الشعر والحكم والاقتباسات الشخصية", gpt: "a genuine Ruq'ah calligraphic Arabic typeface like Aref Ruqaa" },
  { id: "aref-ruqaa-ink", name: "رقعة عارف ملوّن", group: "رقعة", feel: "رقعة بحبر ملوّن متدرّج.", bestFor: "المناسبات والتهاني", gpt: "a Ruq'ah Arabic typeface with coloured ink gradients like Aref Ruqaa Ink" },
  // ───────── يدوي ─────────
  { id: "playpen-sans-arabic", name: "بلاي بن", group: "يدوي", top: true, feel: "خط يد مرتب كأنه بقلم جاف.", bestFor: "الدفتر والسبورة والملاحظات", gpt: "a neat handwritten ballpoint-pen Arabic like Playpen Sans Arabic" },
  { id: "gulzar", name: "گلزار نستعليق", group: "يدوي", feel: "نستعليق مائل وفني.", bestFor: "الشعر الفارسي الروح والفن", gpt: "a flowing slanted Nastaliq Arabic-script typeface like Gulzar" },
  { id: "noto-nastaliq-urdu", name: "نوتو نستعليق", group: "يدوي", feel: "نستعليق كلاسيكي هادئ.", bestFor: "الأبيات والعبارات القصيرة", gpt: "a classical Nastaliq typeface like Noto Nastaliq Urdu" },
  // ───────── مغربي ─────────
  { id: "alkalami", name: "القلمي", group: "مغربي", top: true, feel: "خط مغربي بقلم عريض.", bestFor: "المحتوى المغاربي والتراث", gpt: "a broad-pen Maghribi Arabic typeface like Alkalami" },
  { id: "ruwudu", name: "رودو", group: "مغربي", feel: "مغربي أنيق ومتصل.", bestFor: "العناوين التراثية والفن", gpt: "an elegant connected Maghribi-style Arabic typeface like Ruwudu" },
  // ───────── زخرفي ─────────
  { id: "reem-kufi-fun", name: "ريم كوفي مرح", group: "زخرفي", top: true, feel: "كوفي ملوّن ومرح بألوان جاهزة.", bestFor: "الأطفال والأعياد والعروض", gpt: "a colourful playful Kufi Arabic like Reem Kufi Fun" },
  { id: "reem-kufi-ink", name: "ريم كوفي ملوّن", group: "زخرفي", feel: "كوفي بحبر متدرّج.", bestFor: "العناوين الفنية", gpt: "a Kufi Arabic with ink gradients like Reem Kufi Ink" },
  { id: "blaka", name: "بلاكا", group: "زخرفي", feel: "بلاك ليتر عربي، حاد وغريب.", bestFor: "الموسيقى والجرأة والستريت ستايل", gpt: "an Arabic blackletter display typeface like Blaka, sharp and bold" },
  { id: "blaka-ink", name: "بلاكا ملوّن", group: "زخرفي", feel: "بلاكا بحبر ملوّن.", bestFor: "الملصقات الفنية", gpt: "an Arabic blackletter with coloured ink like Blaka Ink" },
  { id: "handjet", name: "هاندجت", group: "زخرفي", feel: "حروف من مربعات بكسل كشاشة قديمة.", bestFor: "الألعاب والتقنية والشاشات القديمة", gpt: "a blocky pixel-grid Arabic typeface like Handjet, as on an old screen" },
  { id: "vibes", name: "فايبز", group: "زخرفي", feel: "خط ستيكرات مرح.", bestFor: "الستوري والمحتوى العفوي", gpt: "a fun sticker-like Arabic display typeface like Vibes" },
];

export const findContentFont = (id: string) => CONTENT_FONTS.find((f) => f.id === id);

/** A font's look for a slide's brief: the real file for «حيدرا ماكس», its look in words for GPT Image 2. */
export const fontBlock = (f: ContentFont) => `TYPEFACE the person chose («الخط»): ${f.name} — set every Arabic word in ${f.gpt}. Keep it in every slide.`;

/** The font a code-made slide must use: read back from the brief by the picture's writer. */
export const FONT_PIN = (id: string) => `[FONT_ID:${id}]`;
export const pinnedFont = (s: string) => {
  const id = /\[FONT_ID:([a-z0-9-]+)\]/.exec(s)?.[1];
  return id && FONT_BY_ID.has(id) ? id : null;
};
