// «📣 إعلان» — the film maker's ad path (the owner, 23 Nov 2026: «فرع خاص للإعلانات، نفس الموجود»; «ماحط لي ان ارفع صور
// مرجعية لبراندي»). Made like «🎓 درس لطلابك»: the ad is given written, as a YouTube link or as a video from the device
// (a reference ad «ونقلده»: سجاد understands its style, rhythm and camera and carries them onto the person's brand), the
// brand's pictures are given from the start (the logo, the product, the colours), سجاد confirms his understanding, the
// screenwriter writes the ad straight away (one approval), and the person's request (length, generator, how many people)
// goes as it is. The brand's pictures reach سجاد, the screenwriter, the sheet maker (put on the sheet map by themselves:
// the logo and the product as they are, so the real product goes to every generation as a reference) and the director;
// a reference ad's frames and سجاد's reading of them reach the director, so the ad's shots follow it. Edit freely.

/** An ad's length (seconds). */
export const AD_SECONDS = { min: 5, best: 30, max: 120 } as const;

/** What a brand picture is (chosen by the person when it is uploaded). */
export const AD_BRAND_ROLES = [
  { id: "logo", icon: "🏷️", ar: "الشعار", max: 2 },
  { id: "product", icon: "📦", ar: "المنتج", max: 4 },
  { id: "colors", icon: "🎨", ar: "الألوان", max: 2 },
  { id: "other", icon: "🖼️", ar: "مرجع ثاني", max: 4 },
] as const;
export type AdBrandRole = (typeof AD_BRAND_ROLES)[number]["id"];
export const adBrandRole = (v: unknown) => AD_BRAND_ROLES.find((r) => r.id === v) ?? null;

/** A brand picture as the robots are told about it: its role, its name, and the mark that sends the picture itself. */
export interface AdBrandPicture {
  role: AdBrandRole;
  name: string;
  /** a film asset of the project ([[image:id]]), or null where the picture is sent another way (سجاد's gate) */
  assetId: string | null;
}

/** The brand's pictures as lines (each with its picture when it has an asset), grouped by role. */
export function adBrandLines(pictures: AdBrandPicture[]): string {
  if (!pictures.length) return "";
  const lines = AD_BRAND_ROLES.flatMap((r) =>
    pictures.filter((p) => p.role === r.id).map((p, i) => `- ${r.ar}${pictures.filter((x) => x.role === r.id).length > 1 ? ` ${i + 1}` : ""}${p.name ? ` («${p.name}»)` : ""}${p.assetId ? `: [[image:${p.assetId}]]` : ""}`),
  );
  return ["## صور البراند (رفعها صاحب الإعلان — مرجع ثابت، انقلها كما هي: الشعار بشكله وألوانه بالضبط، والمنتج بشكله وعبوته وكتابته بالضبط)", ...lines].join("\n");
}

/** What سجاد is told at the gate when the work is an ad (added to his turn, never to the cached system). */
export const AD_INTAKE_RULES = `## هذا إعلان (مسار «📣 إعلان»)
صاحب البراند يبي إعلان لمنتجه. أعطاك فكرته مكتوبة، أو إعلانًا مرجعيًا (رابط يوتيوب أو فيديو من جهازه) يبي ننقل أسلوبه على برانده، ومعه صور برانده (الشعار، المنتج، الألوان) إذا رفعها. مسار الإعلان دايمًا أقصر من الفيلم:
- لا تخترع شي من عندك: اسم البراند، المنتج، العرض، السعر، الشعار اللفظي، الجمهور — كلها من كلامه وصوره بس. اللي ما ذكره خلّه فاضي، ولا تكتب سعرًا أو عرضًا ما قاله.
- صور البراند: شفها وصف المنتج والشعار كما هم بالضبط (الشكل، العبوة، الألوان، الكتابة اللي عليها). هذي ثوابت ما تتغير.
- ad.brand: اسم البراند كما كتبه أو كما في الشعار. ad.product: المنتج كما في كلامه وصوره. ad.message: الرسالة أو الإحساس اللي يبيه من الإعلان (من كلامه). ad.audience: الجمهور إذا ذكره، وإلا فاضي. ad.ending: نهاية الإعلان اللي طلبها (الشعار، جملة، دعوة) إذا ذكرها، وإلا فاضي.
- ad.imitate: إذا أعطاك إعلانًا مرجعيًا: وصف دقيق لأسلوبه عشان المخرج يقلده على هذا البراند — اللقطات بالترتيب مع وقت كل وحدة تقريبًا، نوع كل لقطة (قريبة جدًا، متوسطة، من فوق…)، حركة الكاميرا (ثابتة، دوللي، بان، تتبّع، زوم…)، طريقة القطع والانتقالات، الإيقاع والسرعة (بطيء، سريع، على الموسيقى)، الإضاءة والألوان والجو، وش يظهر (أيدي فقط، أشخاص، منتج على خلفية…). بدون إعلان مرجعي: فاضي.
- طلبه يمشي دايمًا: أي شي حدده (المدة، المولّد أو طول التوليد، عدد الشخصيات، الشكل) تنفّذه كما هو ولا تسأل عنه ولا تغيّره.
- targetDurationSec: المدة اللي طلبها بالضبط (من 5 إلى 120 ثانية). إذا ما ذكر مدة: مدة الإعلان المرجعي إن وجد، وإلا 30.
- characters وplaces: اللي يحتاجها الإعلان فقط (المنتج نفسه ما يُكتب شخصية).
- scenePlan: عنصر واحد (الإعلان مشهد واحد متصل).
- questions: سؤال واحد بالكثير، وفقط إذا كان مانع فعلًا، وأبدًا عن شي حدده. غير كذا اختر أنت وقل اختيارك في understanding.
- understanding قصير جدًا: وش فهمت في سطرين، ووش بتنقل من الإعلان المرجعي (إن وجد) في سطر، والمدة.
- concept: خطة الإعلان للسيناريست: البراند والمنتج كما هم، والرسالة، وتسلسل الإعلان لقطة لقطة على أسلوب المرجعي (إن وجد)، والنهاية.`;

/** The screenwriter's brief for an ad (its kind's «brief», read before the ad itself). */
export const AD_BRIEF = `هذا إعلان لبراند صاحبه، وصاحبه أكّد فهم سجاد له (تحت). مسار الإعلان مختصر:
- لا تسلّم فهمًا ولا أسئلة: تخطَّ المرحلة 2 والمرحلة 3. أول رد منك هو المرحلة 5 مباشرة («# القصة المطوّرة» مختصرة ثم «# السيناريو» = نص الإعلان كامل لقطة لقطة) للاعتماد، وبعد «اعتمد» سلّم المرحلة 6.
- لا تخترع شي: لا اسم ولا سعر ولا عرض ولا شعار لفظي ما قاله صاحب البراند. معلومة ناقصة غير مانعة: اختر الأنسب واكتبه في notes «(اختيار المساعد)».
- صور البراند (إن وجدت) ثابتة: المنتج والشعار يظهرون كما هم بالضبط، ولا تكتب على الشاشة شي (مولدات الفيديو تخرب الكتابة؛ الكتابة والشعار ينضافون في المونتاج إذا طلبها).
- إذا فيه إعلان مرجعي: انقل تسلسل لقطاته وإيقاعه وحركة كاميرته وجوّه كما وصفه سجاد، على هذا البراند والمنتج.
- المدة وأي طلب في المولّد أو طول التوليد: كما اعتمده صاحب البراند بالضبط، واكتبه في «قرارات الإخراج».
التسليم (المرحلة 6):
- «# قرارات التصميم»: الشخصيات والأماكن اللي يحتاجها الإعلان فقط، والمنتج والشعار من صور البراند كما هم (ما ينرسمون من جديد).
- «# قرارات الإخراج»: أسلوب الإعلان المرجعي (اللقطات والكاميرا والإيقاع) إن وجد، ومصدر الحوار أو التعليق الصوتي إن وجد.`;

/** The sheet maker's note for an ad (sent with the screenwriter's handoff), with the brand's pictures. */
export function adSheetsNote(brand: string): string {
  return [
    `## إعلان (مسار «📣 إعلان»)
- صور البراند تحت مرفقة (رفعها صاحب الإعلان). شفها وافهمها: المنتج والشعار ينقلون كما هم بالضبط.
- في الخريطة: الشعار عنصر بالمعرّف LOG-01 (نوعه environment)، وكل منتج عنصر بالمعرّف PRD-01 ثم PRD-02… (نوعه environment، بنفس ترتيب صور المنتج). هذي العناصر تنحط عليها صور البراند نفسها «كما هي» وتروح مرجعًا مع التوليد، فلا تكتب لها برومبت ولا تحطها في دفعة البرومبتات إلا إذا طلب صاحب الإعلان.
- الماستر STY-00: إذا فيه صورة ألوان أو شعار، ألوان الماستر من ألوان البراند.
- باقي الخريطة: الشخصيات والأماكن اللي يحتاجها الإعلان فقط.`,
    brand,
  ].filter(Boolean).join("\n\n");
}

/** The director's note for an ad: the brand's pictures and the reference ad to follow (its frames and سجاد's reading). */
export function adDirectorNote(o: { imitate: string; frames: string[]; source: string }): string {
  if (!o.imitate && !o.frames.length) return "";
  return [
    `## إعلان على أسلوب إعلان مرجعي (${o.source || "أعطاه صاحب البراند"})
صاحب البراند يبي إعلانه يشابه هذا الإعلان المرجعي: نفس تسلسل اللقطات وأنواعها، ونفس حركة الكاميرا والقطع والانتقالات، ونفس الإيقاع والسرعة والجو والإضاءة — على برانده ومنتجه هو (صور البراند المعتمدة فوق). لا تنسخ شعار أو منتج أو كتابة الإعلان المرجعي.`,
    o.frames.length ? `لقطات من الإعلان المرجعي مرتبة بالوقت (الوقت مكتوب على كل لقطة): ${o.frames.map((id) => `[[image:${id}]]`).join(" ")}` : "",
    o.imitate ? `قراءة سجاد للإعلان المرجعي:\n${o.imitate}` : "",
    "في كل توليد: اكتب حركة الكاميرا ونوع اللقطة والإيقاع كما في اللقطة المقابلة من المرجعي.",
  ].filter(Boolean).join("\n\n");
}

/** What the screenwriter is told when a project already started is turned into an ad (joined with the person's next message). */
export const AD_CONVERT_NOTE = "تحويل: هذا المشروع صار إعلانًا (مسار «📣 إعلان»). كمّل من حيث وصلت بنفس الشغل، وخذ بقواعد الإعلان:";

/** The question on the sheet map of an ad, before anything is drawn. */
export const AD_MAP_QUESTION = "صور براندك انحطت على عناصرها «كما هي» وتروح مرجع مع التوليد. تبي تغيّر شي؟ اختر لكل وحدة تحت، أو اعتمد.";

/**
 * The reference ad's own video, sent with the generation (Wan 3.0 takes reference videos: up to 15 s in all, 16 fps or
 * more; fal charges its seconds like the video's own). The owner, 23 Nov 2026: «وبيّن ان نبي نقلد الفيديو المرجعي تماما».
 */
export const AD_REF_VIDEO_MAX_SEC = 15;

/** What the generator is told about the reference ad's video (named «Video 1» at Wan). */
export const AD_REF_VIDEO_PROMPT = `REFERENCE AD = Video 1. Recreate Video 1 EXACTLY, shot for shot: the same shots in the same order and at the same timing, the same shot sizes and angles, the same camera moves, cuts and transitions, the same speed ramps (speed-ups and slow motion) and rhythm, the same lighting, contrast, colour and mood. Change ONLY the brand: use this brand's product, logo and characters exactly as in the reference images (and as the prompt above says). Never copy Video 1's logo, text, brand or any person's face.`;
