// «المصمم الذكي» — the style library «كاظم» designs from: for each kind, what owns the niche this year (distilled
// from web research on Saudi wedding cards 2026, Husseini event posters, newborn cards and YouTube/latmiya
// thumbnails — not "Islamic = lanterns and ornaments"), with three directions a person can pick, the palettes,
// the typography, the composition, and what to avoid. Pure (server and browser); the examples and tests use it too.

import type { DesignKind } from "./designer";

export interface Direction {
  id: string;
  name: string;
  /** two or three words the person sees */
  short: string;
  /** background, text, primary, accent */
  colors: [string, string, string, string];
  /** the font ids (config/jawad/student.ts FONTS) for the title and the body */
  fonts: { title: string; body: string };
  /** what the artwork looks like (English, goes into the prompt), always without text */
  artwork: string;
}

export interface KindStyle {
  kind: DesignKind;
  /** what owns this niche this year, in Arabic (shown to كاظم) */
  owns: string;
  /** what to avoid, in Arabic */
  avoid: string;
  /** the typical shapes, first is the default */
  aspects: string[];
  /** the text zones a plan should keep (where the layers go) */
  zones: string;
  directions: Direction[];
}

export const DESIGN_LIBRARY: KindStyle[] = [
  {
    kind: "wedding",
    owns: "البطاقات التي تتصدر الزواج السعودي ٢٠٢٦: بساطة فاخرة (luxury minimal) — خلفية داكنة (أسود، كحلي، أخضر زيتوني) أو بيج ترابي، اسما العروسين بخط عربي مدمج (ديواني أو ثلث حديث) هو بطل التصميم، إطار رفيع ذهبي أو خط مذهّب واحد، ورد مائي خفيف (أبيض، كريمي، أخضر رمادي) في زاوية لا في كل مكان، بسم الله في الأعلى بخط صغير، وعبارة الدعوة بخط نسخ واضح. النسخة الإلكترونية (واتساب/ستوري) هي الأصل والمطبوعة تابعة. الاتجاه الثاني: الأبيض الكريمي مع الأخضر والأزهار المرسومة (garden luxury)، والثالث: الهندسة النجدية الخفيفة (نقوش القط العسيري/النجدي بخطوط رفيعة) لمن يريد هوية محلية.",
    avoid: "فوانيس، أهلّة، زخارف ممتلئة، ورود ثقيلة في كل الحواف، أكثر من لونين معدنيين، خطوط مكتبية (Arial)، كلمة Save the date بلا معنى، نص صغير جدًا على جوال.",
    aspects: ["2:3", "9:16", "1:1"],
    zones: "القمة: بسم الله (صغير). الثلث الأعلى: اسم العائلة/الوالد (متوسط). الوسط: اسما العروسين (الأكبر). الثلث الأسفل: عبارة الدعوة، التاريخ، الوقت، المكان (متن). الحواف خالية.",
    directions: [
      { id: "wedding-noir-gold", name: "ليل وذهب", short: "أسود فاخر · ذهبي", colors: ["#0B0B0D", "#F3E9D2", "#C9A961", "#8A6D2F"], fonts: { title: "amiri", body: "readex" }, artwork: "a luxury minimal Saudi wedding card background: deep charcoal-black velvet with a very subtle fine linen texture, one thin hand-drawn gold-foil frame inset from the edges with delicate corners, a single sprig of watercolour white jasmine and eucalyptus leaves in the lower-left corner, soft warm vignette, a calm empty centre and upper area for typography, print quality, flat and elegant" },
      { id: "wedding-garden", name: "حديقة الصباح", short: "كريمي · أخضر · ورد", colors: ["#F6F1E7", "#2F3A2A", "#6E8B5B", "#C98B6B"], fonts: { title: "messiri", body: "plex" }, artwork: "an elegant wedding card background on warm cream paper with faint cotton texture, loose watercolour botanicals (sage-green eucalyptus, blush and terracotta roses, small white flowers) arranged along the top-right and bottom-left corners only, soft shadows, lots of clean cream space in the centre for typography, refined and airy" },
      { id: "wedding-najdi", name: "نقش نجدي", short: "كحلي · ذهبي · نقش محلي", colors: ["#13213A", "#F4EBDB", "#D4AF37", "#A8323A"], fonts: { title: "reemkufi", body: "readex" }, artwork: "a Saudi wedding card background: deep navy with a faint Najdi door-carving geometric pattern (thin gold triangles and lozenges) running as a narrow band along the top and bottom edges, a thin gold rule under the band, soft golden light bloom in the upper centre, a clean dark centre for calligraphy, dignified and modern" },
    ],
  },
  {
    kind: "husseini_joy",
    owns: "دعوات الفرح الحسيني (مواليد الأئمة، الغدير، الزهراء) هذا العام: الأخضر الزمردي أو الفيروزي مع الذهب والأبيض، إضاءة ساطعة، فوانيس حقيقية أحيانًا هنا (مناسبة فرح) لكن بذوق، أقواس وقباب مضيئة من بعيد، ورد ذهبي، وبرنامج الفقرات في جدول واضح مع أسماء المقدّمين وصورهم مربعة أو دائرية مرتبة في صف. العنوان بخط ثلث/ديواني مضيء، والبرنامج بخط نسخ واضح. مقاس مربع للواتساب وستوري للنشر.",
    avoid: "أسود وأحمر داكن (ألوان العزاء)، راية حمراء، شموع، نص مزدحم بلا تسلسل، أكثر من ٣ ألوان.",
    aspects: ["1:1", "9:16", "2:3"],
    zones: "الأعلى: المناسبة والعنوان (كبير). الوسط: فقرات البرنامج صفًّا صفًّا أو صور المقدّمين في صف. الأسفل: الزمان والمكان والقائم بالدعوة. ربع الأعلى والأسفل هادئان.",
    directions: [
      { id: "joy-emerald", name: "زمرد الغدير", short: "زمردي · ذهبي · إضاءة", colors: ["#0E3B2E", "#FFF8E7", "#D9B45B", "#2EC4A6"], fonts: { title: "amiri", body: "readex" }, artwork: "a festive Husseini celebration poster background: rich emerald green with golden light rays from the top, a glowing golden shrine dome and minarets silhouette small at the very top centre, hanging golden lantern lights and tiny bokeh sparkles along the top edge, a thin ornamental gold arch frame, the centre and lower areas kept calm and darker green for text, luminous and joyful" },
      { id: "joy-turquoise", name: "فيروز وبهجة", short: "فيروزي · أبيض · ورد ذهبي", colors: ["#0B6E7A", "#FFFFFF", "#F2C94C", "#F5F0E1"], fonts: { title: "messiri", body: "tajawal" }, artwork: "a bright celebration invitation background: turquoise to teal gradient, white Islamic geometric latticework (arabesque) softly glowing at the corners, golden roses and ribbons in the upper corners, soft confetti light, a clean lighter band across the middle for a programme, cheerful and elegant" },
      { id: "joy-ivory", name: "عاج وذهب", short: "أبيض · ذهبي · هادئ", colors: ["#FBF7EE", "#1E2A24", "#C9A040", "#2E7D5B"], fonts: { title: "scheherazade", body: "plex" }, artwork: "a refined celebration card background on ivory with gold-leaf ornamental corners (thin arabesque), a pale green watercolour wash at the bottom, a small golden crescent-free star pattern at the top edge, soft shadow, ample clean ivory space for text, elegant and light" },
    ],
  },
  {
    kind: "husseini_mourning",
    owns: "إعلانات المجالس الحسينية التي تتصدر هذا العام: أسود أو كحلي داكن مع الذهب الهادئ والأحمر الداكن، إضاءة سينمائية خافتة، الخطيب والرادود كل في إطار بصورته واسمه ولقبه (الشيخ/السيد، الرادود/الملا)، راية حمراء أو قبّة الحسين من بعيد أو دخان خفيف كلمسة واحدة من المصيبة، شريط أسفل للزمان (هجري وميلادي) والمكان والقائم بالمجلس، وعنوان بخط ثلث عريض. نسختان: مربع ١٠٨٠ للواتساب وستوري ١٠٨٠×١٩٢٠.",
    avoid: "دماء، مبالغة درامية، ألوان فاقعة، فوانيس وأهلّة رمضانية، زخرفة تخنق الصور، أكثر من خطّين.",
    aspects: ["1:1", "9:16", "2:3"],
    zones: "الأعلى: اسم المناسبة (مثل ليالي محرم / وفاة الإمام) كبير. الوسط: الخطيب والرادود (الصور في إطارين، الأسماء تحتها). الأسفل: شريط الزمان والمكان. يسار الأعلى: القائم بالمجلس (صغير).",
    directions: [
      { id: "mourning-velvet", name: "مخمل أسود", short: "أسود · ذهبي · راية", colors: ["#07070A", "#EFE6D3", "#B89552", "#8B1E24"], fonts: { title: "amiri", body: "readex" }, artwork: "a solemn Husseini majlis poster background: near-black velvet with soft dark-red cinematic rim light from the top corners, a faint distant golden shrine dome in haze at the top centre, thin gold ornamental frame lines, a single deep-red flag softly waving at the upper-left fading into darkness, two empty rounded portrait frames with thin gold borders side by side in the middle (left and right of centre) for photographs, a slightly lighter dark band across the bottom for information, dignified, restrained, high contrast" },
      { id: "mourning-navy", name: "كحلي ورماد", short: "كحلي · فضي · ضباب", colors: ["#0C1626", "#E8E4DA", "#C2B280", "#5C1F26"], fonts: { title: "scheherazade", body: "plex" }, artwork: "a dignified mourning announcement background: deep navy with light grey mist drifting at the bottom, a thin silver-gold arch frame, a faint black banner texture at the top, two empty portrait medallion frames with thin silver borders at mid-height, soft candle glow at the bottom corners, calm, cinematic and respectful" },
      { id: "mourning-red", name: "عتمة وحمرة", short: "أسود · أحمر داكن · ذهب", colors: ["#0A0608", "#F1E7D8", "#C8A35A", "#A01C2B"], fonts: { title: "reemkufi", body: "tajawal" }, artwork: "a Husseini mourning poster background: black with a wide deep-crimson gradient glow rising from the bottom like a dusk, fine gold geometric border, faint smoke wisps, a small distant golden dome silhouette at the top, one empty large portrait frame slightly left of centre and a smaller one to its right, both with thin gold borders, the lower fifth darker and plain for details, emotional but restrained" },
    ],
  },
  {
    kind: "newborn",
    owns: "بطاقات المولود هذا العام: ألوان باستيل هادئة (سماوي، بيج، أخضر نعناعي، وردي مغبّر للبنت)، زخرفة إسلامية خفيفة أو سحاب وقمر ونجوم مرسومة بلطف، دعاء قصير (اللهم بارك له...) أو آية، اسم المولود كبيرًا بخط ناعم، التاريخ بالهجري والميلادي، اسم الوالد، وأحيانًا نسخة إنجليزية في النصف الآخر (bilingual). مربع للواتساب أو طولي للطباعة.",
    avoid: "ألوان صارخة، كثرة الألعاب الكرتونية، نص طويل، كلمة Baby boy/girl بحروف بلا ذوق.",
    aspects: ["1:1", "2:3", "9:16"],
    zones: "الأعلى: الدعاء أو الآية (صغير). الوسط: اسم المولود (الأكبر). تحته: اسم الوالد. الأسفل: التاريخ (هجري/ميلادي). النسخة الإنجليزية إن طُلبت في النصف الأسفل أو على سطر موازٍ.",
    directions: [
      { id: "newborn-sky", name: "سماء ناعمة", short: "سماوي · سحاب · ذهبي", colors: ["#DCEBF7", "#2B3A4A", "#F0C987", "#9FBEDC"], fonts: { title: "playpen", body: "readex" }, artwork: "a gentle newborn announcement background: soft powder-blue sky with fluffy pastel clouds at the bottom and sides, tiny golden stars and a thin golden crescent-free light arc at the top, a small cream-coloured knitted blanket and a wooden toy at the bottom corner, watercolour softness, a calm empty centre for the name, warm and tender" },
      { id: "newborn-sand", name: "رمل وزيتون", short: "بيج · أخضر · زخرفة خفيفة", colors: ["#F2E8D8", "#3E3A33", "#7B8F6A", "#C8A070"], fonts: { title: "amiri", body: "plex" }, artwork: "a calm newborn card background on sandy beige paper, faint Islamic geometric line pattern in pale olive at the top and bottom borders, a sprig of olive leaves in one corner, soft shadow, a clean centre for calligraphy, elegant and quiet" },
      { id: "newborn-blush", name: "وردي مغبّر", short: "وردي · كريمي · ورد صغير", colors: ["#F4E4E4", "#4A3A3F", "#D29A9A", "#E8CFA3"], fonts: { title: "messiri", body: "tajawal" }, artwork: "a soft newborn card background: dusty-rose to cream gradient, delicate small watercolour roses and gold-leaf dots along the top edge, a thin golden oval frame in the middle, gentle vignette, empty centre for the name, sweet and refined" },
    ],
  },
  {
    kind: "thumbnail",
    owns: "المصغّرات التي تتصدر يوتيوب هذا العام (١٢٨٠×٧٢٠): وجه واحد كبير بتعبير واضح يملأ ثلث الصورة على الأقل، خلفية بسيطة بلون واحد قوي أو مشهد مضبّب، ٢–٤ كلمات ضخمة بحد خارجي داكن وظل، لون واحد للإبراز (أصفر/أحمر/أخضر فاقع) ثابت لكل فيديوهات القناة، عنصر واحد يصنع فجوة معلومات (سهم، دائرة، قبل/بعد)، ولا شيء مهم في الزاوية السفلى اليمنى.",
    avoid: "أكثر من ٤ كلمات، نص صغير، خلفية مزدحمة، أكثر من لونين للإبراز، وجوه كثيرة، نص في الصورة المرسومة.",
    aspects: ["16:9"],
    zones: "الوجه أو العنصر في يمين الصورة (أو يسارها) يملأ ثلثها. العنوان ٢–٤ كلمات على الجهة الأخرى في سطرين، ارتفاع الحرف ١٢–١٨٪. شارة صغيرة أعلى الزاوية. الزاوية السفلى اليمنى فارغة.",
    directions: [
      { id: "thumb-beast", name: "انفجار لوني", short: "أصفر · أحمر · تباين", colors: ["#1A1A1A", "#FFFFFF", "#FFD400", "#FF2E2E"], fonts: { title: "lalezar", body: "readex" }, artwork: "a YouTube thumbnail artwork 16:9: a bold saturated yellow-to-orange radial background with subtle speed lines, the subject (a man or an object described in the brief) large on the right third, dramatically lit with a strong rim light, a clean plain area on the left two thirds for huge typography, punchy, high contrast, slight 3D pop" },
      { id: "thumb-clean", name: "نظيف ومحترف", short: "أبيض · أسود · لون واحد", colors: ["#F4F4F4", "#111111", "#2F74FF", "#111111"], fonts: { title: "readex", body: "plex" }, artwork: "a clean professional YouTube thumbnail artwork 16:9: a soft light grey studio background with a gentle gradient, the subject on the right third in a well-lit half-length portrait, a single bold electric-blue geometric accent shape behind the subject, the left side plain and bright for typography, minimal and modern" },
      { id: "thumb-dark", name: "سينمائي داكن", short: "أسود · برتقالي · ضوء", colors: ["#0B0D14", "#FFFFFF", "#FF8A1E", "#28D1FF"], fonts: { title: "baloo", body: "readex" }, artwork: "a cinematic YouTube thumbnail artwork 16:9: a dark teal-black background with a warm orange light leak from the right, the subject on the right third lit by that light, faint dust particles, a dark calm left side for big text, dramatic and premium" },
    ],
  },
  {
    kind: "latmiya",
    owns: "مصغّرات اللطميات التي تتصدر قنوات كبار الرواديد هذا العام (باسم الكربلائي، أباذر الحلواجي، حسين الأكرف، نزار القطري، مهدي العبودي وأمثالهم): وجه الرادود كبيرًا وواضحًا من صورته الحقيقية (مرفقة) على ثلث الصورة، عنوان اللطمية بخط ثلث أو كوفي عريض بذهبي أو أبيض بحد داكن، سطر صغير للمناسبة أو السنة (محرم ١٤٤٨)، خلفية سينمائية داكنة للعزاء (أسود/كحلي/أحمر داكن، قبّة أو راية من بعيد) أو مضيئة زمردية/ذهبية للفرح، شعار القناة صغيرًا في الزاوية العليا، وهوية ثابتة بين فيديوهات القناة (لون الإبراز نفسه، موضع الاسم نفسه).",
    avoid: "فوانيس رمضانية، زخارف تغطي الوجه، أكثر من عنوانين، نص صغير، ألوان فاقعة في العزاء.",
    aspects: ["16:9"],
    zones: "صورة الرادود في يمين الصورة يملأ ثلثها إلى نصفها. العنوان في اليسار على سطرين كبيرين. اسم الرادود تحته أو فوقه بخط أصغر. المناسبة سطر صغير. الزاوية السفلى اليمنى فارغة.",
    directions: [
      { id: "latmiya-mourning", name: "عزاء سينمائي", short: "أسود · ذهبي · راية", colors: ["#06060A", "#F5EBD6", "#D4AF37", "#9B1C2A"], fonts: { title: "amiri", body: "readex" }, artwork: "a Husseini latmiya YouTube thumbnail artwork 16:9: a dark cinematic black background with deep-red atmospheric light from the right, a faint distant golden shrine dome in haze at the far left, light smoke, the reciter (from the attached photo) placed large on the right third in a dignified half-length portrait with warm rim light, the left side kept dark and calm for large gold typography, respectful and powerful" },
      { id: "latmiya-joy", name: "فرح زمردي", short: "زمردي · ذهبي · ضوء", colors: ["#0B3D2E", "#FFFFFF", "#F1C656", "#2EC4A6"], fonts: { title: "reemkufi", body: "readex" }, artwork: "a Husseini celebration latmiya YouTube thumbnail artwork 16:9: an emerald green background with golden light rays and soft bokeh, a glowing golden dome silhouette small at the top left, the reciter (from the attached photo) large on the right third, bright and festive, the left side clean for bold typography" },
      { id: "latmiya-navy", name: "كحلي ملكي", short: "كحلي · فضي · ضباب", colors: ["#0A1430", "#F2EFE6", "#C9B27A", "#6B1F2B"], fonts: { title: "scheherazade", body: "plex" }, artwork: "a latmiya YouTube thumbnail artwork 16:9: deep royal navy with silver-grey mist at the bottom, thin gold light streak across the top, the reciter (from the attached photo) on the right third with soft cool rim light, the left side plain navy for typography, elegant and sombre" },
    ],
  },
  {
    kind: "other",
    owns: "أي تصميم آخر: الطريقة نفسها — عنصر بطل واحد، لوحة من ٣ ألوان، خطّان على الأكثر، مناطق هادئة للنص، تباين عالٍ.",
    avoid: "الزحام، أكثر من ٣ ألوان، خطوط كثيرة، نص داخل الصورة المرسومة.",
    aspects: ["1:1", "9:16", "2:3", "16:9", "3:2"],
    zones: "العنوان في الثلث الأعلى، المتن في الوسط، التفاصيل في الأسفل.",
    directions: [
      { id: "other-bold", name: "جريء", short: "لون قوي · أبيض", colors: ["#111111", "#FFFFFF", "#FFD400", "#2F74FF"], fonts: { title: "lalezar", body: "readex" }, artwork: "a bold poster background: a strong single-colour backdrop with a subtle grain, one large abstract geometric shape in a contrasting accent colour, clean empty areas for typography, modern and punchy" },
      { id: "other-elegant", name: "أنيق", short: "كريمي · ذهبي", colors: ["#F6F1E7", "#2A2A2A", "#C9A961", "#6E8B5B"], fonts: { title: "amiri", body: "plex" }, artwork: "an elegant poster background: warm cream paper texture with a thin gold frame and small ornamental corners, soft shadow, clean centre for typography" },
      { id: "other-dark", name: "داكن سينمائي", short: "أسود · أزرق · ضوء", colors: ["#050813", "#FFFFFF", "#2F74FF", "#8BBCFF"], fonts: { title: "readex", body: "tajawal" }, artwork: "a dark cinematic poster background: night-blue black with a blue lens-flare streak and soft glow, faint dust, calm dark areas for typography" },
    ],
  },
];

export const findKindStyle = (kind: string) => DESIGN_LIBRARY.find((k) => k.kind === kind) ?? null;
export const findDirection = (id: string) => DESIGN_LIBRARY.flatMap((k) => k.directions).find((d) => d.id === id) ?? null;

/** The library as «كاظم» reads it at every turn (always the same text, so it caches). */
export function libraryBlock(): string {
  return `مكتبة الأنماط (خلاصة بحث عن التصاميم التي تتصدر كل نوع هذا العام؛ مرجعك في الاتجاهات والألوان والخطوط والتكوين):\n${DESIGN_LIBRARY.map(
    (k) =>
      `## ${k.kind}\nما يتصدر: ${k.owns}\nتجنّب: ${k.avoid}\nالمقاسات: ${k.aspects.join("، ")} (الأول الافتراضي)\nمناطق الكتابة: ${k.zones}\nالاتجاهات (kind="directions"):\n${k.directions.map((d) => `- ${d.id} — ${d.name} — ${d.short} — ${d.colors.join(" ")} — خط العنوان ${d.fonts.title}، المتن ${d.fonts.body} — ${d.artwork}`).join("\n")}`,
  ).join("\n\n")}`;
}
