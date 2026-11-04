// «محمد باقر» والموشن كاروسيل — the carousel whose slides are short videos (the words enter with motion, a soft sound
// with each entry, sometimes a moving background): what he knows (Instagram's own rules, when it beats a still carousel
// or a reel, how each slide is built — from a web study and a look at about 100 motion-carousel posts on Instagram,
// 4 November 2026), the ten ready motion styles the person picks from (or one built from zero with him), and the three
// ways of making it, cheapest first. «حيدرا ماكس» makes every slide in the person's browser: he writes the slide as a
// moving scene in the motion lab's kit, looks at its frames, fixes it, and the page renders it to MP4 with its sound.
// Pure (server and browser).

/** How the slides' pictures are made, cheapest first: code only · a GPT Image 2 picture per slide · GPT Image 2 elements cut out. */
export type MotionRoute = "code" | "picture" | "elements";

export interface MotionCarouselStyle {
  id: string;
  n: number;
  name: string;
  /** what it looks and feels like, for the person */
  feel: string;
  bestFor: string;
  /** the cheapest way that does it justice */
  route: MotionRoute;
  /** seconds of each slide */
  seconds: number;
  /** how «حيدرا ماكس» builds it (English, for him) */
  craft: string;
}

export const MOTION_CAROUSEL_STYLES: MotionCarouselStyle[] = [
  {
    id: "calm-reveal", n: 1, name: "الدخول الهادئ", route: "code", seconds: 5,
    feel: "كل سطر يطلع من تحت قناع بهدوء ويثبت، والخلفية ساكنة. أنظف ستايل وأسهله قراءة.",
    bestFor: "النصائح، والمعلومة الدينية، والمحتوى الخاشع والتعليمي",
    craft: "Each line rises from behind a mask (40–60% of its height, outExpo 0.7 s), one line after another 0.25–0.4 s apart, then everything holds still and readable for the rest of the slide. The background stays calm (paper, a soft gradient that barely breathes). One soft tick or breath of air per line, nothing else. Restraint is the style.",
  },
  {
    id: "kinetic-word", n: 2, name: "الكلمة المتحركة", route: "code", seconds: 4,
    feel: "تايبوغرافي كبير جريء: الكلمة المهمة تكبر وتثقل وتتلوّن، والباقي يرتّب نفسه حولها.",
    bestFor: "الهوك، والجمل القوية، والأخبار والإعلانات",
    craft: "Big kinetic typography: the key word lands first, huge and heavy (weight 800–900), then the rest of the line settles around it; one punch of scale (4–8%) or a colour flip on the key word; blur-to-sharp entrances. A whoosh on the move and a soft hit on the landing frame. The final 1.5 s hold the whole line still.",
  },
  {
    id: "counter", n: 3, name: "العدّاد والأرقام", route: "code", seconds: 5,
    feel: "الأرقام تعدّ قدامه، والأعمدة والدوائر تكبر لين قيمتها.",
    bestFor: "الإحصائيات، والأسعار، والمقارنات، والنتائج",
    craft: "Numbers count up from 0 to their value (an ease-out over 1–1.6 s, digits in a tabular, steady width), bars and rings grow to their exact values, labels fade in after the number lands. Use only the numbers given. Soft UI ticks while counting, one gentle hit when it lands. Hold the final values still.",
  },
  {
    id: "connected", n: 4, name: "الشرائح المتصلة", route: "code", seconds: 5,
    feel: "مشهد واحد عريض ممتد على كل الشرائح: خط أو شكل يعبر من شريحة للي بعدها، فيضطر المتابع يسحب.",
    bestFor: "القصة بخطوات، والرحلة، والقوائم المرتبة",
    craft: "One wide canvas cut into slides: a path, line or shape runs through every slide and exits the edge where the next slide picks it up at the SAME height, colour and thickness (the left edge of slide n continues into the right edge of slide n+1 in Arabic order: the story moves right to left). Draw the line along its path, then the slide's words enter beside it. A soft whoosh as the line travels. The slide's edges must match its neighbours exactly at the end of the slide.",
  },
  {
    id: "flipbook", n: 5, name: "امسك واسحب", route: "code", seconds: 4,
    feel: "كل شريحة خطوة من حركة واحدة، فإذا سحب الشرائح بسرعة تتحرك الصورة مثل دفتر الرسوم.",
    bestFor: "التحدي والتفاعل، والتحوّل التدريجي، وجذب الانتباه",
    craft: "Flipbook: the carousel is one movement split across the slides. Each slide's final held frame is ONE pose of that movement (slide n is step n of total), drawn in the same place and size on every slide so a fast swipe animates it. Inside the slide, the element moves gently into its pose, then holds. Words are few and stay in the same spot on every slide. Slide 1 says to hold and swipe fast. A tiny tick when the pose lands.",
  },
  {
    id: "before-after", n: 6, name: "قبل وبعد", route: "code", seconds: 5,
    feel: "الشكل العادي يتحوّل قدامه للشكل المتقن: مسحة تكشف الفرق.",
    bestFor: "تحسين المنتج، والتعليم، وعرض الخدمة، والتصميم",
    craft: "The ordinary version shows first (dull, plain, labelled «قبل»), then a clean wipe or a sliding divider reveals the polished version («بعد») with a little light sweep across it. Both are built from the slide's content. A soft swoosh on the wipe and a light shimmer on the reveal. Hold the «بعد» state still at the end.",
  },
  {
    id: "handwritten", n: 7, name: "الخط اليدوي", route: "code", seconds: 5,
    feel: "الكلمة المهمة تنرسم قدامه بقلم: خط تحتها، أو دائرة حولها، أو سهم يأشّر.",
    bestFor: "الملاحظات، والدروس، والتنبيهات، والمحتوى الشخصي القريب",
    craft: "Hand-drawn marks are drawn stroke by stroke (path length reveal, 0.4–0.8 s each): an underline under the key word, a circle around it, an arrow pointing at it, a quick scribble highlight. The words themselves are set in the font and enter calmly first; the marks come after. A soft pencil-scratch sound on each stroke. Notebook or paper feel when it fits the style.",
  },
  {
    id: "living-bg", n: 8, name: "الخلفية الحية", route: "code", seconds: 6,
    feel: "الكلام ثابت وواضح، وخلفه خلفية تتحرك ببطء: تدرّج يتنفس، أو ضوء يمر، أو ذرات تطفو.",
    bestFor: "الاقتباسات، والفخامة، والسكينة، والهوية الهادئة",
    craft: "The words are on screen from frame 0 (a very soft settle at most) and stay perfectly readable; behind them the background lives slowly: a breathing gradient, a light sweep, drifting particles, a slow texture pan, bokeh. The loop is seamless: the last frame equals the first. Almost silent: one soft airy swell at the start.",
  },
  {
    id: "sticker-pop", n: 9, name: "الملصقات المفرّغة", route: "elements", seconds: 4,
    feel: "عناصر مرسومة ومفرّغة تنط في الشريحة بخفة: منتج، أيقونة، شخصية، مع الكلام.",
    bestFor: "المنتجات، والأطفال، والمحتوى المرح، والمتاجر",
    craft: "The slide's cut-out elements (photo1…, transparent PNGs) pop in one after another with a soft spring (scale 0.6 → 1 with a small overshoot, 0.35 s), cast a soft contact shadow, then float gently (2–4 px). The words enter between the pops. A soft pop sound on each element, never loud.",
  },
  {
    id: "cinematic", n: 10, name: "المشهد السينمائي", route: "picture", seconds: 6,
    feel: "صورة مرسومة كاملة تقرّب الكاميرا عليها ببطء مع ضوء يمر، والكلام يظهر عليها بهدوء.",
    bestFor: "القصص، والأماكن، والمنتجات الفاخرة، والإعلانات",
    craft: "photo1 is the slide's full painted picture: a slow camera push (3–6% over the slide) with a gentle parallax drift, a soft light sweep or rising dust, the grade of the carousel's look. The words fade and rise over the calm area of the picture with a soft scrim behind them if needed. A low soft whoosh at the start, nothing else.",
  },
];

export const findMotionCarouselStyle = (id: string | null | undefined) => MOTION_CAROUSEL_STYLES.find((s) => s.id === id) ?? null;

/** The three ways, cheapest first: what each adds, and what it costs beyond «حيدرا ماكس»'s own work. */
export const MOTION_ROUTES: { id: MotionRoute; label: string; what: string }[] = [
  { id: "code", label: "حيدرا ماكس بالكود فقط (الأرخص)", what: "حيدرا ماكس يرسم كل شيء بالكود: الكلام والأشكال والأيقونات والخلفيات والحركة والصوت. تدفع شغل حيدرا ماكس فقط." },
  { id: "picture", label: "حيدرا ماكس + صورة GPT Image 2 لكل شريحة", what: "جواد يرسم صورة كاملة لكل شريحة بـ GPT Image 2 (بدون كتابة)، وحيدرا ماكس يحرّكها ويكتب عليها. فوق شغل حيدرا ماكس سعر صورة لكل شريحة." },
  { id: "elements", label: "حيدرا ماكس + عناصر GPT Image 2 مفرّغة (الأغلى)", what: "جواد يرسم عنصر كل شريحة بـ GPT Image 2 (منتج، شخصية، أيقونة)، ويُفرَّغ من خلفيته، وحيدرا ماكس يحرّكه فوق خلفية يرسمها بالكود. فوق شغل حيدرا ماكس سعر صورة لكل شريحة، والتفريغ بدون رسوم إضافية." },
];
export const routeById = (id: string | null | undefined) => MOTION_ROUTES.find((r) => r.id === id) ?? null;

/** Each slide's length (seconds): the style's own, kept between 3 and 8. */
export const slideSeconds = (s: MotionCarouselStyle | null) => Math.max(3, Math.min(8, s?.seconds ?? 5));

/** The motion style as «حيدرا ماكس» reads it with each slide. */
export const motionStyleForCode = (s: MotionCarouselStyle | null, own: string) =>
  s ? `THE MOTION STYLE of the carousel («${s.name}»): ${s.craft}` : `THE MOTION STYLE of the carousel, in the person's own words (build it from zero with them): ${own || "one you design to fit the subject"}`;

/** The guide, as محمد باقر reads it. */
export const MOTION_CAROUSEL_GUIDE = `الموشن كاروسيل (كاروسيل كل شريحة فيه فيديو قصير: الكلام يدخل بحركة، ومع كل دخول صوت خفيف، وقد تتحرك الخلفية):

ما هو ومتى يفيد:
- يجمع ميزة الكاروسيل (يُحفظ ويُسحب ويُرجع له، والسحب تفاعل) وميزة الفيديو (الحركة توقف الإصبع). الحركة تلفت العين في فيد كله صور ثابتة.
- يُستعمل حين: الفكرة تُفهم بالحركة (خطوات تظهر واحدة واحدة، رقم يعدّ، قبل وبعد يتبدّل، شيء يتركّب)؛ أو العلامة تريد أن تبدو حديثة ومتقنة؛ أو المحتوى أخبار وأدوات ونصائح قصيرة؛ أو منتج رقمي (تطبيق، خدمة، دورة) لا يحتاج تصويرًا.
- لا يُستعمل حين: الشريحة نص طويل يُقرأ بهدوء (الحركة تشتّت القراءة)؛ أو محتوى ديني أو حزين أو خاشع يحتاج سكونًا (إن تحرّك فبهدوء شديد ودخول ناعم فقط: ستايل «الدخول الهادئ» أو «الخلفية الحية»)؛ أو العميل يريد الوصول لغير متابعيه بالأساس (هنا الريل أقوى)؛ أو كل شريحة صورة فنية كاملة تكفي بنفسها.
- الكاروسيل الثابت يبقى الأنسب للمعلومة الكثيفة والمراجع التي تُحفظ. الريل للوصول الواسع. الموشن كاروسيل بينهما: يتفاعل معه المتابع أكثر، ولا يحتاج وجهًا ولا تصويرًا.
- في السوق العربي شبه غائب (في بحث إنستقرام لم يظهر تقريبًا أي موشن كاروسيل عربي ناجح)، فهو فرصة للتميّز.

قواعد إنستقرام (مؤكدة):
- حتى ٢٠ شريحة، ويجوز خلط الصور والفيديو في كاروسيل واحد.
- المقاس ٤:٥ (1080×1350)، ويُقبل ٣:٤ (1080×1440). شبكة البروفايل تقصّ كل بوست ٣:٤ من الوسط، فكل المهم يبقى في الوسط وبعيدًا عن الحواف بنحو ١٥٠ بكسل.
- الغلاف هو أول فريم من الشريحة الأولى، فيجب أن يكون أول فريم تصميمًا كاملًا مقروءًا (العنوان ظاهر من اللحظة صفر، لا يبدأ فارغًا ثم يدخل).
- إنستقرام يعيد عرض الكاروسيل على من لم يسحب بادئًا من الشريحة الثانية، فالشريحة الثانية هوك ثانٍ يعمل وحده.
- كثير من الناس يشاهدون بلا صوت: كل شريحة تُفهم كاملة بلا صوت.
- غير مؤكد (لا تعِد به): أن الموسيقى المضافة من إنستقرام تعمل فوق شرائح الفيديو، وتشغيل الشرائح التالية تلقائيًا، وظهور الكاروسيل في تبويب الريلز. لذلك يكون صوت كل شريحة داخل ملفها.

بناء كل شريحة:
- طولها ٣ إلى ٦ ثوانٍ، والكاروسيل كله ٥ إلى ١٠ شرائح.
- فكرة واحدة في الشريحة، ولا تزيد على ٣ أو ٤ أسطر قصيرة؛ إن زادت فقسّمها.
- الحركة تخدم المعنى: كل سطر يدخل بدوره (انزلاق خفيف أو ظهور كلمة كلمة)، ثم يثبت الكلام ثانيتين على الأقل ليُقرأ. آخر فريم حالة ثابتة مقروءة.
- الحركة الخفيفة أقوى من الصاخبة: عنصر واحد يتحرك أو عنصران في وقت واحد، لا كل الشريحة.
- الخلفية المتحركة اختيارية: ملمس يتحرك ببطء، أو تدرّج يتنفس، أو عنصر يطفو؛ ولا تنافس الكلام.
- الصوت: مؤثر ناعم قصير مع دخول كل سطر أو عنصر فقط (نقرة، همسة، ومضة). لا موسيقى خلفية ولا صوت محيط إلا إذا طلبه العميل.
- الحلقة: الشريحة تعيد نفسها، فإما أن تنتهي بالفريم الذي بدأت به فتبدو حلقة لا تنقطع، أو تنتهي بحالة ثابتة هادئة.
- الشريحة الأخيرة دعوة واحدة واضحة (مثلًا: اكتب كلمة في التعليقات ويوصلك الرابط أو الهدية).

أفكار أثبتت نفسها في إنستقرام:
- الشرائح المتصلة: مشهد واحد عريض يُقسّم على الشرائح، وعنصر يعبر من شريحة لأخرى، فيضطر المتابع للسحب. من أنجح ما رأيناه (آلاف الإعجابات وآلاف التعليقات).
- «امسك واسحب بسرعة»: الشرائح متتالية كأنها دفتر رسوم متحرك (فليب بوك)، فإذا سحبها بسرعة تحرّكت الصورة. تفاعل عالٍ.
- قبل وبعد في الشريحة نفسها: الشكل العادي يتحوّل أمامه للشكل المتقن.
- تايبوغرافي يتكشّف: الكلمة المهمة تُكتب أو تُرسم أمامه، أو تُخط بخط يدوي.
- الملاحظة من البحث: البوستات التي قالت «الذكاء الاصطناعي حرّك كل شريحة» دون أن تريه نتيجة لافتة لم تنتشر. الأداة ليست الهوك؛ النتيجة هي الهوك.

ستايلات الحركة العشرة الجاهزة (جدول kind="motioncarousels"؛ يختار منها العميل، أو يبنيها معك من الصفر بوصفه، أو يطلب مساعدتك):
${MOTION_CAROUSEL_STYLES.map((s) => `- ${s.id} — ${s.n}) ${s.name}: ${s.feel} يناسب: ${s.bestFor}. أرخص طريقة تناسبه: ${routeById(s.route)!.label}.`).join("\n")}

طرق الصنع، من الأرخص للأغلى (قدّم الأرخص أولًا دائمًا، وبيّن بوضوح ما فيه تكلفة إضافية):
${MOTION_ROUTES.map((r, i) => `${i + 1}) ${r.label}: ${r.what}`).join("\n")}
- حيدرا ماكس هنا يعمل بكامل حريته وحكمه، كأنه مبرمج مستقل: الستايل والقواعد مكتبة يستشيرها، وهو من يقرر كيف يبني كل شريحة. يكتب كل شريحة مشهدًا متحركًا، ويشوف فريماتها ويقيّمها ويعيد كتابتها لين تنجح، ثم يطلّعها الموقع فيديو MP4 بصوته.
- في الطريقتين ٢ و٣ اكتب في "picture" لكل شريحة توجيه الصورة أو العنصر بالإنجليزية بدون أي كتابة (في ٣: عنصر واحد واضح منفرد على خلفية سادة، فيُفرَّغ).

كيف تتعامل مع العميل:
- إذا طلب كاروسيلًا ورأيت أن الموشن كاروسيل يخدم هدفه، اقترحه بسطر واحد مع السبب، والقرار له. الموقع يسأله بعد الخط: ثابت أو متحرك.
- إذا اختار المتحرك: يفتح له الموقع جدول ستايلات الحركة، ثم يسأله عن طريقة الصنع من الأرخص للأغلى مع السعر التقريبي. لا تسأل عنهما بخيارات نصية.
- اكتب نصوص الشرائح قصيرة (٣–٤ أسطر)، واكتب في "prompt" لكل شريحة ما يتحرك فيها وكيف يدخل الكلام وما يبقى ثابتًا في آخرها، والموقع يضيف ستايل الحركة لكل شريحة.
- الشرائح تُصنع في صفحة العميل وتأخذ وقتًا أطول من الثابتة (دقائق لكل شريحة)، فقل له ذلك قبل التصنيع، وإنها تطلع فيديو MP4 يحمّله وينشره كاروسيل.`;

const ASK = /كاروسيل|كاروسل|شرائح|carousel|موشن|متحرك|متحركة|animated|motion/i;

/** Whether the conversation is about a carousel or motion (so the guide goes with the turn). */
export const isMotionCarouselAsk = (text: string) => ASK.test(text);
