// «محمد باقر» والموشن كاروسيل — the carousel whose slides are short videos (the words enter with motion, a soft sound
// with each entry, sometimes a moving background): what he knows (Instagram's own rules, when it beats a still carousel
// or a reel, how each slide is built — from a web study and a look at about 100 motion-carousel posts on Instagram,
// 4 November 2026), the ready motion styles the person picks from (ten, then eleven more from a second study the same day, then «حكاية بيكسار» the owner picked on 5 November 2026) (or one built from zero with him), and the three
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
  {
    id: "chat", n: 11, name: "المحادثة", route: "code", seconds: 6,
    feel: "الشريحة شكلها شات: رسالة تطلع، وبعدها نقاط «يكتب...»، وبعدها الرد، وفي الأخير «تمت القراءة».",
    bestFor: "القصص، وأسئلة العملاء، و«واحد سألني...»، والحوار بين شخصين",
    craft: "The slide is a chat window (a header with a round avatar, a name and «متصل» that turns to «يكتب...» while the dots bounce). Messages arrive one after another as bubbles that grow from their corner with a small overshoot (0.45 s): the question on one side in a light bubble, the answers on the other in the brand gradient, each answer preceded by 0.6–0.8 s of three bouncing dots. A read receipt at the end. Short messages (one line each, 2–4 per slide). A soft pop on each bubble, tiny ticks while typing.",
  },
  {
    id: "quiz", n: 12, name: "سؤال وجواب", route: "code", seconds: 6,
    feel: "سؤال وتحته ٣ خيارات، وشريط وقت يخلص، وبعدها الجواب الصح ينوّر والغلط يبهت. يخلي الناس يعلّقون بجوابهم.",
    bestFor: "المسابقات، والمعلومة اللي تفاجئ، والتعليم، وزيادة التعليقات",
    craft: "A question on top, then three option cards (letters أ ب ج) spring in one after another. A thin timer bar empties over about 2 s with a tick each half second. Then the right option fills with the brand gradient, scales up a touch and draws a check mark, while the wrong ones fade to 35% with a short shake. A last line invites the answer in the comments before swiping. Ticks for the timer, a soft rising chord on the reveal. The right answer must be the one the text gives.",
  },
  {
    id: "breaking", n: 13, name: "خبر عاجل", route: "code", seconds: 5,
    feel: "شريط «عاجل» يدخل مع لمعة، والعنوان يطلع كلمة كلمة، وتحته شريط أخبار يمشي. شكل نشرة الأخبار.",
    bestFor: "الأخبار اليومية، والتحديثات، والإعلان عن شي جديد",
    craft: "A news-studio slide: dark background with slow diagonal lines and a red glow; a red «عاجل» bar slides in from the right with a quick white flash, a blinking «مباشر» dot; the headline stamps in word by word (0.16 s apart) in two short lines that fit inside the frame; a white ticker bar along the bottom scrolls continuously to the right (Arabic reads into it) with more short headlines. Two short alert beeps, a whoosh, a tick per word, a soft air bed under the ticker.",
  },
  {
    id: "phone", n: 14, name: "شاشة الجوال", route: "code", seconds: 6,
    feel: "جوال في نص الشريحة، وإصبع يضغط زر داخله، والشاشة تنقلب للنتيجة وتنزل لتحت. شرح تطبيق بدون تصوير شاشة.",
    bestFor: "شرح التطبيقات والأدوات والمواقع، وخطوات «كيف تسويها»",
    craft: "A phone mockup rises into the middle (rounded dark frame, the screen clipped inside). The screen shows a simple app drawn in code (a top bar with the tool's name, a few cards, one big button with the slide's action). A soft fingertip glides in and taps the button (it sinks a little, a ripple spreads), the screen slides sideways to the result, which plays its own small motion, then the finger flicks and the screen scrolls a little. Only the words given appear on the screen. A pop on the tap, a whoosh on the slide, an airy swipe on the scroll.",
  },
  {
    id: "map-route", n: 15, name: "الخريطة والطريق", route: "code", seconds: 6,
    feel: "خريطة مرسومة، وطريق ينرسم من محطة لمحطة، ودبوس ينزل عند كل وحدة واسمها جنبه.",
    bestFor: "الرحلات، والأماكن والفروع، وخطوات من البداية للنهاية، وقصة البراند",
    craft: "A soft drawn map (blocks, streets, a river, in the carousel's colours, never a copy of a real map app). A smooth route (Catmull-Rom through a few points) draws itself as a dashed gradient line with a glowing dot at its head; when it reaches a stop a pin drops with a little bounce and its label card (the stop's name) fades in beside it. 2–4 stops per slide, labels kept clear of the title. A pop on each pin, a soft air sound while the route travels.",
  },
  {
    id: "panorama", n: 16, name: "المشهد الممتد", route: "code", seconds: 6,
    feel: "مشهد واحد عريض بكامل تفاصيله (سماء، تلال، طيارة ورق) مقسوم على الشرائح، يتحرك كله مع بعض، وشي يطير من شريحة للي بعدها. لما يسحب يحس إنه عالم واحد طويل.",
    bestFor: "القصة الطويلة، وإطلاق منتج، والإعلانات اللي تبي إبهار",
    craft: "The whole carousel is ONE wide moving world (slides side by side), not a line: a full background (sky, light, layered hills or a city) that drifts in parallax across every slide, and a traveller (a paper plane, a ball, a character) that flies through all of them with a trail. Each slide is one window of that world: write each slide as its own window, offset by its place (slide n shows x from (n-1)·W to n·W of the world, slide 1 on the LEFT end, because Instagram's next slide comes from the right), so the scenery, the trail and the traveller meet exactly at every edge. Each window carries its own short words. A long soft air bed and a whoosh as the traveller passes. A real AI video split the same way is possible later, but it is far more expensive.",
  },
  {
    id: "text-behind", n: 17, name: "الكلام ورا الشي", route: "elements", seconds: 5,
    feel: "كلمة كبيرة تطلع من ورا العنصر المفرّغ كأنها مدفونة في المشهد، والخلفية تتحرك. يعطي الشريحة عمق.",
    bestFor: "إطلاق منتج، والعناوين القوية، والمنتجات والشخصيات",
    craft: "Three layers in this order: a living background (soft colour blobs drifting), then ONE giant word (300–400 px, white or the brand colour) rising from below, then the cut-out element (photo1, transparent PNG) IN FRONT of the word so it covers part of it, floating gently with a soft shadow; a small readable line in front of everything. The word must still read with the element over it (the element covers its middle or lower part, not its first letters). A rising tone, a whoosh and a soft hit when the word lands.",
  },
  {
    id: "crumpled", n: 18, name: "الورقة المكرمشة", route: "code", seconds: 6,
    feel: "كورة ورق مكرمشة تنفتح شوي شوي لين تصير ورقة، وبعدها تنكتب عليها رسالة بخط القلم.",
    bestFor: "الرسائل الشخصية، والاعتراف، والنصيحة، و«وقّف السكرول»",
    craft: "A sheet of paper starts as a crumpled ball (a mesh of triangles pulled toward the middle, each facet shaded differently) and unfolds over about 2.4 s to a flat sheet with faint creases and notebook lines. Then the message is written right to left like a pen (a clip reveal) in a pen colour, one short line after another, and finally underlined by hand. The paper never covers the chrome. Paper-crinkle bursts while it opens, soft pen scratches while it writes.",
  },
  {
    id: "blur-warning", n: 19, name: "الشاشة المغطاة", route: "code", seconds: 6,
    feel: "الشريحة مغطاة بضباب مثل تحذير «محتوى حساس»: «هالشريحة فيها سر... متأكد تبي تشوف؟»، وبعدين الإصبع يضغط والضباب ينشال.",
    bestFor: "الكشف عن سر أو عرض، والمعلومة المفاجئة، وجذب الفضول",
    craft: "The slide's real content is drawn underneath, heavily blurred (40–50 px). Over it a dark glass cover with a crossed-out eye, the warning line, a sub line that swaps to «متأكد تبي تشوف؟», and a «شوف الشريحة» button. A fingertip comes in and taps the button (ripple), then the blur clears and the cover fades over about 1 s and the revealed line pops slightly. A parody of the app's own warning screen, drawn in the carousel's look, never a copy of it. A low tone at the start, ticks on the lines, a pop on the tap, a whoosh and a bright chime on the reveal.",
  },
  {
    id: "error-window", n: 20, name: "نافذة الخطأ", route: "code", seconds: 6,
    feel: "نوافذ خطأ من كمبيوتر قديم تطلع فوق بعض، والماوس يضغط «إصلاح»، فتنسكر كلها وتطلع نافذة «تم».",
    bestFor: "الأخطاء الشائعة، والمشكلة والحل، والمحتوى التقني المرح",
    craft: "A retro desktop (flat colour, a faint dot grid). Old-computer windows (bevelled grey, a navy title bar with three square buttons, a red «!» icon, one short error line, one bevelled button) pop up one after another, stacked with an offset. An arrow cursor glides to the last window's «إصلاح» button and clicks (the button bevel inverts), the windows close in reverse, and one last window with the brand gradient title and a check mark says the fix. Retro error beeps on each window, clicks, a short rising chime at the end.",
  },
  {
    id: "carousel-3d", n: 21, name: "البطاقات الثلاثية", route: "code", seconds: 6,
    feel: "بطاقات تلف في الفضاء مثل الدولاب ثلاثي الأبعاد، وتوقف على البطاقة المهمة قدامه.",
    bestFor: "عرض القائمة كاملة، والخدمات، والمنتجات، وأقسام الكورس",
    craft: "Five or six cards stand on a ring in 3D space (fake perspective in 2D: x = sin(angle)·R, depth = cos(angle), scale and brightness by depth, width squashed by |cos| so they turn, drawn back to front, a soft floor shadow). The ring turns one to one and a half times with an ease-in-out and settles with the slide's main card facing the viewer; only the facing cards show their words (a big faint number and one word). A line under it invites the swipe. Airy whooshes as cards pass the front, a soft hit when it stops.",
  },
  // the owner's pick of 5 November 2026: the modern Pixar story of carousel style 104, moving
  {
    id: "pixar-story", n: 22, name: "حكاية بيكسار", route: "picture", seconds: 6,
    feel: "كل شريحة لقطة من فيلم أنيميشن حديث: الكاميرا تقرّب بهدوء، الأغراض الذهبية تطفو وتلمع، وعنوان الفصل يطلع وبعده الكلام سطر سطر والجملة المهمة تلمع بالذهبي.",
    bestFor: "القصص والعِبر، والمواقف خطوة بخطوة، والمحتوى الديني والتربوي للشباب",
    craft: "photo1 is the slide's full GPT Image 2 scene in the look of carousel style 104 «بيكسار الحديث» (young cartoon characters in maroon hoodies, a deep burgundy background with a warm golden glow and floating glossy 3D props, no writing, the top part calm). Move it like a shot of an animated film: a slow camera push-in (4–6% over the slide) with a slight drift; a soft golden glow that breathes behind the characters; 10–20 small golden sparkles drifting up and twinkling; a gentle light sweep once. The words over the calm top: the chapter pill pops in first (scale 0.8 → 1 with a small overshoot, 0.35 s), then the white headline rises word by word (0.12 s apart, blur-to-sharp), its golden key phrase lands last with one soft shimmer passing over it, then the short lines fade up one by one; «اسحب ←» nudges left twice at the end. Everything holds still and readable for the last 2 s; the first frame is already a readable cover on slide 1. A soft whoosh on the push, a light chime on the pill, a tiny sparkle with the golden phrase; no music.",
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
- من بحث ثانٍ (٤ نوفمبر ٢٠٢٦، مقالات ترندات ٢٠٢٦ وبوستات إنستقرام): المشهد الممتد المتحرك على كل الشرائح (من أنجحها: عشرات الآلاف من الإعجابات)؛ الكلام ورا العنصر فوق خلفية متحركة؛ رحلة على خريطة؛ الشاشة المغطاة بتحذير ثم الكشف؛ الورقة المكرمشة اللي تنفتح؛ نوافذ الخطأ القديمة؛ البطاقات اللي تلف ثلاثي الأبعاد؛ ومعها شكل الشات، والسؤال والجواب، والخبر العاجل، وشاشة الجوال.
- الملاحظة من البحث: البوستات التي قالت «الذكاء الاصطناعي حرّك كل شريحة» دون أن تريه نتيجة لافتة لم تنتشر. الأداة ليست الهوك؛ النتيجة هي الهوك.

ستايلات الحركة الجاهزة (جدول kind="motioncarousels"؛ يختار منها العميل، أو يبنيها معك من الصفر بوصفه، أو يطلب مساعدتك):
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
