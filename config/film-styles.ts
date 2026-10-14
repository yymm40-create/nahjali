// The shared 24-style library used by image generation, video generation, content creation and the cinematic workflow.
// Prompts contain only reusable technical descriptions: no artist, studio or protected-work names and no negative prompt.

export interface FilmStyle {
  id: string;
  group: string;
  name: string;
  description: string;
  text: string;
  videoText?: string;
  feel: string;
  bestFor: string;
  tier: "free" | "paid" | null;
}

const ARABIC_STYLE_NAMES: Record<string, string> = {
  "pixar-classic": "بيكسار الكلاسيكية",
  "pixar-caricature": "بيكسار الكاريكاتيرية",
  illumination: "إلومينيشن",
  "neo-disney": "النيو-ديزني",
  "pixar-natural": "بيكسار الطبيعية",
  "dreamworks-epic": "دريم ووركس الملحمي",
  shinkai: "شينكاي",
  seinen: "سايبربانك / ساينن",
  "dreamworks-painterly": "دريم ووركس اللوحي",
  "hybrid-2d3d": "الهجين 2D/3D",
  "drawn-over-cg": "المرسوم فوق CG",
  "golden-2d": "العصر الذهبي 2D",
  ghibli: "جيبلي",
  "pixar-abstract": "بيكسار التجريدي",
  "comic-print": "الكوميكس المطبوع",
  "modern-shonen": "شونين حديث",
  "anime-western": "الهجين الأنمي-غربي",
  "dreamworks-satire": "دريم ووركس الساخر",
  "retro-cel": "ريترو سِل",
  "3dcg-anime": "3DCG أنمي",
  auteur: "تجريبي / مؤلف",
  "stylistic-drift": "الانحراف الأسلوبي",
  chibi: "موي / تشيبي",
  "renaissance-90s": "نهضة التسعينات",
};

const STYLE_DEFINITIONS: FilmStyle[] = [
  { id: "pixar-classic", group: "الدفء العائلي", name: "ثلاثي الأبعاد المستدير الكلاسيكي", description: "أسطح ناعمة بلمعة ساتان خفيفة، أشكال ودودة وإضاءة مسرحية دافئة سهلة القراءة.", text: "Classic stylized 3D animation look. Clean smooth surfaces with a faint satin sheen, simplified material variety, theatrical three-point key lighting with crisp falloff, warm key light against cool fill, low texture noise, bright readable silhouettes, rounded friendly shape language.", feel: "لعب · براءة · أمان", bestFor: "قصص أطفال · أشياء جامدة تنبض بالحياة · تمائم وإعلانات ودودة", tier: null },
  { id: "pixar-caricature", group: "الدفء العائلي", name: "الواقعية الكاريكاتيرية ثلاثية الأبعاد", description: "شخصيات محسّنة بلطف داخل بيئة مقنعة، خامات واقعية وإضاءة سينمائية دافئة.", text: "Stylized 3D animated feature film still, caricatured realism. Gently stylized character proportions set inside a physically believable environment, realistic material response, soft subsurface scattering, meticulous groom and surface detail, warm cinematic color grade, shallow depth of field, unified rendering between character and environment.", feel: "صدق · ألفة · تعاطف", bestFor: "دراما عائلية · رحلة بطل عادي · إعلانات عاطفية", tier: null },
  { id: "illumination", group: "الدفء العائلي", name: "ثلاثي الأبعاد المشرق المبسّط", description: "أشكال مستديرة مبسطة، تشبّع حيوي مضبوط وإضاءة ناعمة بتباين لطيف.", text: "Bright simplified 3D animation style. Rounded simplified shape language, smooth clean low-noise surfaces, broad readable forms, vivid but controlled saturation, soft even lighting with gentle contrast, reduced detail density, friendly accessible rendering.", feel: "خفة · مرح · بساطة", bestFor: "كوميديا جماهيرية · محتوى سريع · سوشيال", tier: null },
  { id: "neo-disney", group: "الدفء العائلي", name: "ثلاثي الأبعاد اللوحي المضيء", description: "حواف لوحية ناعمة، ارتداد لوني مضيء، ألوان جوهرية وزخارف دقيقة محسوبة.", text: "Painterly luminous 3D animation style. CG with softened painterly edges, luminous color bounce, jewel-toned art-directed lighting favoring beauty over physical accuracy, elegant flowing motion in fabrics and hair, fine ornamental detail, sparse subtle particles drifting in the air.", feel: "انبهار · حلم · رومانسية", bestFor: "حكاية سحرية · بطولة أنثوية · إعلانات فخامة وعطور", tier: null },
  { id: "pixar-natural", group: "الوقار الملحمي", name: "المحاكاة الطبيعية ثلاثية الأبعاد", description: "محاكاة فيزيائية دقيقة للخامات والعناصر مع بقاء تصميم الشخصية متحركًا ومبسّطًا.", text: "Stylized 3D animation with naturalistic simulation. Physically accurate refraction, caustics, surface tension and micro-droplets on surfaces, photographic environment lighting, atmospheric haze, damp realistic textures, muted naturalistic palette, believable weight in every material, character design remains stylized and animated.", feel: "رهبة الطبيعة · واقعية", bestFor: "الماء والنار والعواصف · إعلانات المشروبات والخامات", tier: null },
  { id: "dreamworks-epic", group: "الوقار الملحمي", name: "ثلاثي الأبعاد الملحمي بالحبر المائي", description: "تكوينات واسعة وخلفيات بتقنية الحبر المائي مع ضوء حواف وضباب حجمي درامي.", text: "Epic stylized 3D animation style. Cinematic wide-scale staging, rich background painting using ink-wash technique, dramatic rim lighting and volumetric haze, stylized but weighty character rendering, sweeping grand atmosphere.", feel: "جلال · شرف · تصاعد", bestFor: "معارك · أساطير · افتتاحيات ضخمة", tier: null },
  { id: "shinkai", group: "الوقار الملحمي", name: "أنمي السماء المضيئة", description: "خلفيات مرسومة فائقة التفصيل، سماء وماء عميقان ووهج ضوئي رومانسي مضبوط.", text: "2D anime style with hyper-detailed painted backgrounds. Extreme sky and water rendering, restrained lens flares, light scattering and soft bloom, deep saturated blues with glowing warm accents, glass-like reflective surfaces, romantic luminous atmosphere, characters drawn with clean anime linework.", feel: "شوق · جمال موجع", bestFor: "لحظة تأمل تحت سماء هائلة · سياحة ومدن", tier: null },
  { id: "seinen", group: "الوقار الملحمي", name: "أنمي ساينن خافت", description: "نسب واقعية، ألوان باردة خافتة، خامات صناعية وعمارة دقيقة بنبرة ناضجة.", text: "Mature seinen anime style. Detailed realistic proportions, restrained muted cold palette, industrial textures and subtle film grain, subdued flat lighting with readable values, grounded adult tone, precise architectural backgrounds.", videoText: "slow deliberate pacing", feel: "عزلة · ثقل · وحدة", bestFor: "عالم بارد · قصص سلطة وقهر · تقنية ومستقبل", tier: null },
  { id: "dreamworks-painterly", group: "اللمسة اليدوية", name: "ثلاثي الأبعاد بضربات فرشاة", description: "ضربات فرشاة وخامات جافة ظاهرة فوق المجسمات مع حواف رسومية وأشكال زاوية.", text: "Painterly stylized 3D animation. Visible brush strokes and dry-media texture layered over 3D forms, hand-painted highlight shapes, graphic edge lines on silhouettes, heightened contrast, bold angular shape language.", videoText: "stepped animation on 2s and 3s", feel: "حرفية · أصالة · دفء", bestFor: "حكاية تراثية بروح معاصرة · هوية بصرية مميزة", tier: null },
  { id: "hybrid-2d3d", group: "اللمسة اليدوية", name: "هجين بخطوط قلم فوق ثلاثي الأبعاد", description: "مجسمات تحمل خطوطًا يدوية متغيرة وتظليل قلم ولوحة شبه أحادية بلمسة لونية واحدة.", text: "Hybrid 2D-over-3D animation style. Three-dimensional forms carrying hand-drawn expressive contour lines that vary in weight, near-monochrome palette with a single accent color of [COLOR], soft pencil-texture shading, visible drawn imperfection over precise geometry.", feel: "حنين · رقة · خصوصية", bestFor: "لحظة شاعرية قصيرة · رسائل عاطفية · مناسبات", tier: null },
  { id: "drawn-over-cg", group: "اللمسة اليدوية", name: "اسكتش قصاصات فوق المجسمات", description: "خطوط اسكتش وخامات ورقية وإضاءات مرسومة فوق مجسمات بروح ألبوم قصاصات.", text: "Hand-drawn-over-CG animation style. Rough sketch lines, scribbled hatch marks and hand-painted light shapes layered on top of 3D geometry, slightly imperfect registration, illustrated scrapbook energy, textured paper overlay, small doodle accents.", feel: "عفوية · صدق · قرب", bestFor: "محتوى شبابي · مذكرات · إعلانات مرحة", tier: null },
  { id: "golden-2d", group: "اللمسة اليدوية", name: "السِل الكلاسيكي ثنائي الأبعاد", description: "شخصيات حبر وسِل بألوان مسطحة وخلفيات مائية ذات حبيبات ورق ونبرة دافئة قديمة.", text: "Classic hand-drawn 2D animation style. Ink-and-paint cel characters with soft pencil line weight, flat gouache color fills, lush watercolor painted backgrounds with visible paper grain, warm vintage film tone, gentle vignetting.", videoText: "full animation on 1s", feel: "حنين · طفولة · تراث", bestFor: "حدوتة كلاسيكية · حكايات أطفال", tier: null },
  { id: "ghibli", group: "الهدوء التأملي", name: "ألوان مائية ريفية ثنائية الأبعاد", description: "خلفيات مائية ناعمة، ألوان طبيعية هادئة، فراغ بصري واسع وإحساس فيلم تناظري دافئ.", text: "Hand-drawn 2D animation style. Soft watercolor painted backgrounds with atmospheric depth, gentle consistent line weight, muted natural palette, generous still framing and quiet negative space, warm analog film feel.", videoText: "restrained realistic movement", feel: "سكينة · صفاء · امتنان", bestFor: "حياة يومية · طبيعة · طفولة", tier: null },
  { id: "pixar-abstract", group: "الهدوء التأملي", name: "الفراغ التجريدي ثلاثي الأبعاد", description: "فضاء رمزي بلا أفق، خامات شفافة متوهجة ولوحة محدودة مع موضوع واضح الإضاءة.", text: "Conceptual abstract 3D style. Environment reduced to symbolic essentials with no horizon and no background architecture, only void and soft floating light motes, materials simplified to glowing translucency, ethereal non-literal space, minimal palette, dreamlike scale, main subject clearly lit and readable.", feel: "تجرّد · دهشة · غموض", bestFor: "عالم داخلي · روح وذاكرة · تقنية مفاهيمية", tier: null },
  { id: "comic-print", group: "الطاقة البصرية", name: "طباعة كوميكس بنقاط هافتون", description: "نقاط هافتون وخطوط حبر وسرعة وانحراف تسجيل طباعي مع كتل لونية جريئة.", text: "Graphic comic-print animation style. Halftone dot shading in shadow zones, chromatic aberration split on high-contrast edges, hand-drawn line work and speed-line accents, print-registration misalignment, flat bold color blocking, comic ink texture.", videoText: "variable frame rate mixing 1s and 2s", feel: "اندفاع · صدمة · شباب", bestFor: "أكشن · افتتاحيات · هوية جريئة", tier: null },
  { id: "modern-shonen", group: "الطاقة البصرية", name: "أنمي أكشن بتظليل سِل", description: "حدود حبر واضحة وظلال حادة فوق بيئات مرسومة مع ضوء حجمي وتوهج مضبوط.", text: "Modern action anime style. Cel-shaded characters with crisp ink outlines and hard-edged shadow shapes composited over detailed painted 3D environments, volumetric light shafts, floating particles, controlled glow bloom, dramatic color script.", videoText: "dynamic camera", feel: "تصاعد · حماس · قوة", bestFor: "معركة · لحظة انفجار · ذروة", tier: null },
  { id: "anime-western", group: "الطاقة البصرية", name: "هجين أنمي غربي لامع", description: "تظليل أنمي تعبيري مع حرفية ثلاثية الأبعاد وظلال رسومية ولمسات لون محددة وسط العتمة.", text: "Western-anime hybrid animation style. Anime-derived cel shading and expressive posing fused with Western 3D craft, sharp graphic shadow shapes, accent colors of [COLOR] against deep darkness, glossy highlight punctuation.", videoText: "snappy stylized timing", feel: "بريق · حداثة · جاذبية", bestFor: "موسيقى · ترند · إعلان", tier: null },
  { id: "dreamworks-satire", group: "الطاقة البصرية", name: "كاريكاتير ساخر ثلاثي الأبعاد", description: "نسب زاوية مبالغ فيها لكن جذابة، وضعيات قوية وإضاءة كوميدية عالية التباين.", text: "Caricature 3D animation style. Exaggerated angular proportions that stay appealing, strong pose-driven silhouettes, high-contrast comedic lighting, glossy stylized materials, punchy saturated palette.", videoText: "snappy exaggerated timing", feel: "ذكاء · سخرية · جرأة", bestFor: "كوميديا ساخرة · إعلانات جريئة", tier: null },
  { id: "retro-cel", group: "التوقيع الشخصي", name: "أنمي سِل ريترو", description: "ملمس ألوان سِل ظاهر، حبيبات وهالة فيلم دافئة، نزف لوني وإحساس بث قديم.", text: "Retro hand-painted cel anime style from the 1980s-90s era. Visible paint texture on cel surfaces, slightly off-register color, warm film grain and halation, analog color bleed, vintage broadcast palette, soft scanline feel, sharp linework under the grain.", videoText: "limited animation on 3s", feel: "نوستالجيا · دفء قديم", bestFor: "استحضار الثمانينات والتسعينات", tier: null },
  { id: "3dcg-anime", group: "التوقيع الشخصي", name: "أنمي ثلاثي الأبعاد بتظليل تون", description: "مجسمات بظلال سِل طبقية وحدود نظيفة وأسطح بلورية مع تفاصيل هندسية دقيقة.", text: "3DCG anime style with toon shading. Three-dimensional models rendered with flat banded cel shadows and clean outline passes, crystalline reflective surfaces, precise geometric detail.", videoText: "smooth continuous camera movement", feel: "غرابة · دقة · برود", bestFor: "خيال علمي · كائنات بلورية · تقنية", tier: null },
  { id: "auteur", group: "التوقيع الشخصي", name: "أنمي تجريبي مؤلف", description: "منظور مشوّه وخطوط تعبيرية غير مستقرة وخلفية رمزية مع بقاء الشكل الرئيسي واضحًا.", text: "Experimental auteur animation style. Distorted perspective and unstable expressive line work, raw expressive drawing, limited high-contrast palette, abstract symbolic background treatment, main subject silhouette remains readable.", videoText: "drawing shifts between frames, unconventional broken timing", feel: "اضطراب · حرية · صدمة", bestFor: "فن · رسالة شخصية · فيديو كليب", tier: null },
  { id: "stylistic-drift", group: "التوقيع الشخصي", name: "ثلاثي الأبعاد العصري المنمّق", description: "تشويه مقصود متأثر بالأنمي، تظليل مسطح وألوان قوية مع تشريح ثابت وإضاءة سينمائية.", text: "Modern stylized 3D animation. Deliberate anime-influenced distortion, exaggerated squash in the shapes, flatter shading ramps, punchy saturated color, graphic simplification of secondary detail, expressive posing, cinematic lighting retained, consistent anatomy.", feel: "عصرية · تمرّد", bestFor: "جيل شاب · هوية مختلطة · إعلانات حديثة", tier: null },
  { id: "chibi", group: "التوقيع الشخصي", name: "تشيبي لطيف", description: "نسب بطول رأسين أو ثلاثة، رأس كبير وجسم مبسط وحدود ناعمة وألوان باستيل.", text: "Chibi style. Compressed proportions of exactly [2 or 3] heads tall, oversized head and simplified body, thick soft outlines, pastel palette, flat gentle shading, minimal detail, cute rounded forms.", feel: "ظرافة · لعب", bestFor: "محتوى خفيف · ملصقات · تمائم", tier: null },
  { id: "renaissance-90s", group: "الصقل الاحتفالي", name: "النهضة المسرحية ثنائية الأبعاد", description: "رسم تعبيري وتكوين مسرحي وألوان غنية مع توهج هوائي ناعم وخلفيات متعددة الطبقات.", text: "Theatrical hand-drawn 2D animation style. Bold expressive character draftsmanship, dramatic theatrical staging and lighting, rich saturated color keys, soft airbrushed glow effects composited over cel art, layered multiplane painted backgrounds with depth.", feel: "فخامة · شجن · مسرح", bestFor: "لحظة غنائية · ذروة عاطفية · مناسبات وطنية", tier: null },
];

export const FILM_STYLES: FilmStyle[] = STYLE_DEFINITIONS.map((style) => ({
  ...style,
  name: ARABIC_STYLE_NAMES[style.id] ?? style.name,
}));

export const findStyle = (id: string) => FILM_STYLES.find((style) => style.id === id);

/** The style's existing preview picture (public/film/styles, one per stable style id, 640×360). */
export const styleImage = (id: string) => `/film/styles/${id}.jpg`;
