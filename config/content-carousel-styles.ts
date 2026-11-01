// «صانع المحتوى» — جدول ستايلات الكاروسيل: 50 looks, sorted by niche, that the person picks from INSTEAD of being asked about
// colours, fonts and margins (the owner's order, 2 November 2026). Each one is a complete look: its colours, type and the
// anatomy of its slides go verbatim into every slide's brief, whoever makes it (GPT Image 2 or «حيدرا ماكس»). A style that
// shows realistic pictures has a `photoIdea`: the person is asked whether they add their own or it is made from zero.
// Pure (server and browser).
//
// Where they come from: the owner's Instagram research of 1 November 2026 (likes read on the posts, since a carousel's views
// are not public, so the "winner" of a niche is the strongest thing seen, not a measurement) plus 2026 carousel guides.
// The samples in /public/content/carousel-styles were painted with GPT Image 2 from these same descriptions.
// What those 100 slides taught is written down in CAROUSEL_GPT_CRAFT and CAROUSEL_CODE_CRAFT.

export const CAROUSEL_NICHES = ["تعليمي وشرح", "تسويق وبزنس", "علم نفس وتطوير ذات", "اقتباسات وتحفيز", "كوميدي وترفيه", "سفر ولايف ستايل", "طعام ووصفات", "تقنية وذكاء اصطناعي", "منتجات وبراندات", "صحة ولياقة", "مال وأعمال شخصية", "تفاعلي"] as const;
export type CarouselNiche = (typeof CAROUSEL_NICHES)[number];

export interface CarouselStyle {
  id: string;
  n: number;
  niche: CarouselNiche;
  name: string;
  /** what it looks like, to the person */
  description: string;
  bestFor: string;
  /** the strongest of its niche in the research */
  winner?: boolean;
  /** words a slide carries at most */
  words: number;
  /** the look with its colours, in English: goes into every slide's brief */
  look: string;
  /** the Arabic typography, in English */
  type: string;
  cover: string;
  body: string;
  closing: string;
  /** how «حيدرا ماكس» builds it in code, and what must come as a picture */
  code: string;
  /** it shows realistic pictures: what the person could add of their own (asked before it is made) */
  photoIdea?: string;
}

export const CAROUSEL_STYLES: CarouselStyle[] = [
  // ───────── تعليمي وشرح ─────────
  {
    id: "notebook", n: 1, niche: "تعليمي وشرح", name: "الدفتر", winner: true, words: 22,
    description: "صفحة دفتر سلك حقيقية مصوّرة من فوق، بخط يد أزرق وتظليل فوسفوري وسهم مرسوم، كأنها ملاحظات شخص تثق فيه.",
    bestFor: "الشرح والملخصات والنصائح التي يحفظها الناس",
    look: "Overhead photograph of a real spiral-bound grid-paper notebook on a warm wooden desk, soft window light with leaf shadows, a pencil and a yellow sticky note near the page. Ink #1B3A8F, highlighter #FFE135 and #FF8FC0.",
    type: "Large neat handwritten Arabic in blue ballpoint, right-aligned, connected letters, as if a person wrote it carefully.",
    cover: "The question handwritten large over three lines filling the page, one key word under a real yellow highlighter stroke, a small hand-drawn arrow pointing at it.",
    body: "A heading in a pink highlighter stroke, one or two short handwritten lines, and one small pen sketch that explains the point; a paperclip or a piece of tape.",
    closing: "A boxed handwritten note with the one rule to remember and a doodled tick.",
    code: "Paint the desk and the notebook as photo1 (no writing) and set the handwriting yourself in a handwritten catalogue font, slightly rotated with the page; draw highlighter strokes with multiply blending and irregular edges; pen doodles with slightly wobbly paths.",
    photoIdea: "صوّر صفحة من دفترك أو مكتبك من فوق، ونكتب عليها الكلام، أو نسوي لك الدفتر من الصفر.",
  },
  {
    id: "white-text", n: 2, niche: "تعليمي وشرح", name: "الشريحة البيضاء", words: 16,
    description: "أبيض وكلام أسود عريض فقط، بلا أي صورة أو زخرفة. يبدو بسيطًا لكنه يوقف السكرول لأنه مختلف عن كل ما حوله.",
    bestFor: "الأفكار القوية والقوائم القصيرة والحسابات الجادة",
    look: "Pure white background #FFFFFF, nothing but huge black text #111111, flush right, wide margins, Swiss discipline, no pictures, no icons, no decoration.",
    type: "Heavy geometric Arabic sans at very large size, tight leading, right-aligned.",
    cover: "The number and the promise stacked over several lines, filling most of the slide, and a tiny thin black arrow at the bottom left.",
    body: "A big numeral at the top right, a bold statement under it filling the width, and one smaller grey line #666666.",
    closing: "One bold sentence with the request, nothing else on the white.",
    code: "Pure typography: size it boldly and fill the width, keep the white truly empty, never add shapes to fill the space.",
  },
  {
    id: "screenshot-steps", n: 3, niche: "تعليمي وشرح", name: "لقطة شاشة لكل خطوة", words: 14,
    description: "جوال حقيقي بشاشة التطبيق، مع دائرة حمراء مرسومة باليد وسهم ورقم على المكان المطلوب.",
    bestFor: "شرح التطبيقات والإعدادات والأدوات خطوة بخطوة",
    look: "A real smartphone tilted on a soft sky-blue background #BFE3F7 with faint clouds, its interface labels blurred so nothing on the screen can be read; rough hand-drawn red #E11D1D circles and arrows on it.",
    type: "Bold dark Arabic sans #0F172A at the top; a white caption strip with dark Arabic at the bottom on inner slides.",
    cover: "A bold two-line headline above the tilted phone, and a rough red circle around one toggle or button.",
    body: "A close-up of the screen, a thick red arrow to the exact spot, a red round number badge, and a white strip with one short instruction.",
    closing: "The whole screen with all the marks done, and the request in the white strip.",
    code: "Place the person's screenshot or the painted phone as photo1, then draw the red circle, arrow, number badge and caption strip on top in code.",
    photoIdea: "أرسل لقطات شاشتك الحقيقية من التطبيق، خطوة لكل شريحة، ونضع عليها الدوائر والأسهم، أو نسوي لك شاشة توضيحية من الصفر.",
  },
  {
    id: "big-numbers", n: 4, niche: "تعليمي وشرح", name: "الخطوات المرقمة", words: 16,
    description: "رقم عربي ضخم يأخذ ثلثي الشريحة بلون صريح، وتحته الخطوة بخط عريض. بوستر أكثر منه منشور.",
    bestFor: "الخطوات والقوائم المرقمة والدروس السريعة",
    look: "Bold flat poster design. Cover: electric cobalt-blue background #0A14C8 with a gigantic cream #F5EFDC Arabic numeral. Inner slides: cream background #F7F1DF with a gigantic cobalt #0A4FD6 numeral.",
    type: "Very heavy Arabic sans for the headline in the same colour as the numeral; a smaller line under it.",
    cover: "The numeral fills two thirds of the slide; one bold line under it says what the steps lead to.",
    body: "A giant numeral on the right side, the step's bold headline over three lines on the left of it, and one smaller supporting line.",
    closing: "A recap in a few words with the request, on the blue.",
    code: "Draw the giant numerals as huge type in the heaviest font with sharp flat colour; no shadows, no gradients; let the numeral bleed close to the edge.",
  },
  {
    id: "mind-map", n: 5, niche: "تعليمي وشرح", name: "المخطط الذهني", words: 18,
    description: "رسم يدوي على ورق كريمي: دائرة في الوسط وفروع ملونة بأيقونات صغيرة. يبان كأن شخصًا لخّص لك الموضوع.",
    bestFor: "تلخيص موضوع كبير وربط الأفكار ببعضها",
    look: "Hand-inked sketchnote on cream textured paper #F7EFD9, thick branches in coral #E9785E, teal #2F9C95 and mustard #E0A92E, tiny doodle icons, professional illustrator quality.",
    type: "Hand-lettered Arabic in black ink inside the central circle, smaller lettered labels inside coloured outlines.",
    cover: "The topic's word inside a bold central circle, with six to eight branches ending in doodle icons and no labels on them.",
    body: "One branch enlarged: its word in the centre and three labelled sub-branches, each with a small doodle.",
    closing: "The whole map with every label filled, as a summary to save.",
    code: "Draw the branches as tapered bezier strokes with a slight wobble on a paper texture; hand-lettered font for the labels; simple line icons in the same pen width.",
  },
  {
    id: "two-columns", n: 6, niche: "تعليمي وشرح", name: "المقارنة بعمودين", words: 24,
    description: "الشريحة مقسومة: أخضر «افعل» وأحمر «لا تفعل»، صف صف، فتُفهم من نظرة.",
    bestFor: "الأخطاء الشائعة، افعل ولا تفعل، الفرق بين خيارين",
    look: "Flat split layout: deep green #1F6B3A on the right, dusty red #B34A4A on the left, big white rounded X and check marks on the cover; inside, a soft table on off-white #FBFAF5 with pale green #E8F3EA and pale red #F8E8E8 cells.",
    type: "Bold clean Arabic sans, white on the colour headers, dark green and dark red in the cells.",
    cover: "A bold white headline across the top of both halves, a huge X on the red half and a huge check on the green half.",
    body: "A two-column table: green header on the right, red header on the left, and two or three short rows.",
    closing: "One verdict line and the request across both colours.",
    code: "Exact flat layout: draw the table with precise cells and equal rows; every cell's text centred and large.",
  },

  // ───────── تسويق وبزنس ─────────
  {
    id: "editorial", n: 7, niche: "تسويق وبزنس", name: "الإديتوريال المجلي", winner: true, words: 24,
    description: "غلاف مجلة راقٍ: بورتريه أبيض وأسود يتداخل مع عنوان عربي ضخم بالأحمر الغامق، وداخله صفحات بأعمدة.",
    bestFor: "المسوقين والمصممين والحسابات التي تريد مظهرًا فخمًا",
    look: "High-end magazine on off-white paper #F1ECE2: dramatic black-and-white studio portrait of a man cut out, overlapping a huge deep-red #8E1B1B Arabic serif headline; thin black rules, award-winning art direction.",
    type: "Elegant high-contrast Arabic naskh display for headlines, a clean small sans for labels, right-aligned.",
    cover: "A two-word headline filling the top two thirds with the portrait overlapping it (never covering a letter's meaning), lots of paper around it.",
    body: "A large serif pull quote, two narrow columns shown as plain grey bars or real short text, thin rules and one small black-and-white photo.",
    closing: "A pull quote between two rules and the request as a small folio line.",
    code: "Place the cut-out portrait as photo1 over the type (draw the headline first, the portrait above it), grade it to grayscale, set rules with exact thin lines and generous margins.",
    photoIdea: "أرسل صورة لك بخلفية سادة، أو صورة منتجك، ونحولها أبيض وأسود فوق العنوان مثل غلاف المجلة، أو نصنع لك صورة من الصفر.",
  },
  {
    id: "sharp-deck", n: 8, niche: "تسويق وبزنس", name: "العرض التقديمي الحاد", words: 14,
    description: "أسود صافٍ وكلام أبيض ضخم مع خط ليموني واحد، مثل شريحة عرض على مسرح.",
    bestFor: "الأفكار الجريئة في التسويق والأعمال ولينكدإن",
    look: "Keynote slide on pure black #000000, huge white #FFFFFF Arabic, one thin acid-lime #C6F135 accent only: an underline or a thin line chart with no labels.",
    type: "Very large bold Arabic grotesque, right-aligned, generous leading.",
    cover: "A provocative question over three lines with a thin lime underline under its last word.",
    body: "A thin lime chart line at the top and the answer in large white type below it.",
    closing: "One line and the request, with the lime underline.",
    code: "Pure code: draw the thin chart with exact points, keep the black empty, one accent only.",
  },
  {
    id: "before-after-design", n: 9, niche: "تسويق وبزنس", name: "قبل وبعد التصميم", words: 10,
    description: "نفس البوستر مرتين: واحد مزدحم وسيئ وواحد نظيف ورائع، والقارئ يحكم بنفسه.",
    bestFor: "المصممين وصناع المحتوى وعرض الخدمات",
    look: "Two poster designs compared on a warm taupe #B8A890 or light grey #D8D6D0 wall: one ugly cluttered flyer with clashing colours and clip-art shapes, one stunning minimal redesign with one strong picture. The posters contain only shapes and images, no words.",
    type: "Bold Arabic sans on a plum #4B3A6B band for the question; small labels on tags for the verdicts.",
    cover: "The ugly poster above, the beautiful one below, and a central band with the question.",
    body: "The two posters side by side with a red X tag and label on the bad one and a green tick tag and label on the good one.",
    closing: "The good version alone, large, with the request.",
    code: "Compose both posters in code (it is pure design work) or take them as photos, then draw the tags and labels yourself.",
  },
  {
    id: "framework", n: 10, niche: "تسويق وبزنس", name: "الإطار النظري", words: 14,
    description: "رسم استشاري نظيف: هرم أو مراحل بثلاثة ألوان، يبين الفكرة كنظام يُحفظ ويُطبَّق.",
    bestFor: "الأطر والنماذج والمناهج في التسويق والإدارة",
    look: "Clean consultancy diagram on ivory #FBF8EF: a large three-layer pyramid in navy #14305C, teal #1F7F7F and gold #C9A23C, thin navy guide lines and tick marks.",
    type: "Refined Arabic sans in navy for the headline, white or dark labels inside the layers.",
    cover: "The empty diagram large with a short title above it, so the reader wants to know what fills it.",
    body: "The same diagram with its labels filled and a one-line lesson as the headline.",
    closing: "The full diagram and the request.",
    code: "Pure code: exact geometry, thin guide lines, labels centred in each layer at a readable size.",
  },
  {
    id: "route-map", n: 11, niche: "تسويق وبزنس", name: "خارطة الرحلة", words: 12,
    description: "خريطة مثل تطبيقات الجوال: طريق أزرق ودبوس أحمر وبطاقات بيضاء، وكل شريحة محطة.",
    bestFor: "رحلة العميل والمراحل والخطط من الصفر",
    look: "Stylised top-down digital map: pale grey streets #E8E9EC, soft green parks #BFE3B0, a bold blue route #1A73E8, a red pin #E53935, white rounded cards with soft shadows. Clean map-app look, no real place names.",
    type: "Medium dark Arabic sans inside white cards, centred.",
    cover: "The whole route to the red pin with a white card holding the promise.",
    body: "A closer view: the route with a numbered round stop marker and a white callout card with that stage.",
    closing: "The pin reached, with the result and the request in the card.",
    code: "Pure code: draw streets as a grid of rounded lines, a thick route with a white outline, exact pins and cards; keep the same map across slides by moving the camera.",
  },

  // ───────── علم نفس وتطوير ذات ─────────
  {
    id: "dark-art-fact", n: 12, niche: "علم نفس وتطوير ذات", name: "الفن الداكن وجملة حقيقة", winner: true, words: 14,
    description: "لوحة سريالية داكنة تأخذ العين، وجملة واحدة بيضاء كبيرة. أعلى الإعجابات في بحثنا كانت بهذا الشكل.",
    bestFor: "علم النفس والفلسفة والحقائق التي تثير الفضول",
    look: "Surreal dark fine-art matte painting filling the slide: deep indigo #10143A and teal #0F4C5C fog, one colossal symbolic subject and a tiny lone man for scale, volumetric light, awe-inspiring.",
    type: "Very bold white Arabic sans with a soft shadow, placed on a calm dark area of the painting.",
    cover: "The painting with its subject in the upper part and a short shocking sentence in large white at the bottom.",
    body: "Another painting in the same world, darker, with the sentence large in the centre on a dark area.",
    closing: "A quiet dark scene and the question or request.",
    code: "The painting is photo1 from GPT Image 2 and never drawn in code; grade it darker where the type sits with a gradient scrim and set the sentence large.",
  },
  {
    id: "classic-paintings", n: 13, niche: "علم نفس وتطوير ذات", name: "القائمة النفسية المرقمة", words: 14,
    description: "لوحات زيتية كلاسيكية وتماثيل رخام بإضاءة درامية، مع رقم ذهبي وعنوان. فخم وثقيل.",
    bestFor: "المفارقات والقوائم الفكرية والفلسفة",
    look: "Museum-quality classical oil paintings and marble statues of men, Caravaggio lighting on near-black #0B0906, gold details #C9A45C.",
    type: "Bold off-white #F3E9D2 Arabic with a slightly classical feel, gold numerals.",
    cover: "A thinking man in a dark room with the number and the title in the lower third.",
    body: "A statue with a big gold numeral above it and a two-line title.",
    closing: "A calm painting and one line with the request.",
    code: "The painting is photo1; set the gold numeral and the title in code with a gradient scrim behind them.",
  },
  {
    id: "tweet-dark", n: 14, niche: "علم نفس وتطوير ذات", name: "لقطة التويت الداكنة", words: 12,
    description: "منشور بالوضع الداكن على أسود، باسم وعلامة توثيق وجملة ضخمة. يبان ككلام إنسان، مو كتصميم.",
    bestFor: "الجمل القوية والآراء والنفسيات",
    look: "A dark-mode social media post filling a pure black #000000 slide: a small round ink-portrait avatar at the top right, a display name in white and a blue verified badge #1D9BF0. No logo of any platform.",
    type: "Huge bold white Arabic sans filling the whole width over three lines, easy to read on a phone.",
    cover: "One sentence in huge type under the name row.",
    body: "The next sentence in the same place and the same size.",
    closing: "The last sentence, then the request in smaller type.",
    code: "Pure code: draw the avatar row exactly and make the sentence huge; the empty black is part of the look.",
  },
  {
    id: "advice-age", n: 15, niche: "علم نفس وتطوير ذات", name: "نصيحة كنت أحتاجها", words: 16,
    description: "صورة قديمة دافئة من ألبوم التسعينات مع خط شبه يدوي. فيها حنين، والناس يحفظونها ويرسلونها.",
    bestFor: "الدروس الشخصية والقصص وما تعلمته من عمرك",
    look: "Faded 1990s family-album photographs: warm sunset tones, film grain, soft focus, no faces toward the camera. A boy on a bicycle on a dusty street, an old cassette and a folded letter.",
    type: "White handwritten-style Arabic with a soft shadow, medium size, right-aligned.",
    cover: "The old photo with the title over three lines in the calm part of the picture.",
    body: "Another old object or scene with the advice written on it or beside it.",
    closing: "A quiet photo with a reflective question and the request.",
    code: "The old photo is photo1 (the person's or painted), graded warm with grain in code; set the handwriting in a handwritten font.",
    photoIdea: "أرسل صورة قديمة من طفولتك أو من مكان تحبه، ونكتب عليها، أو نصنع لك صورة بهذا الشعور من الصفر.",
  },
  {
    id: "loud-question", n: 16, niche: "علم نفس وتطوير ذات", name: "السؤال الاستفزازي", words: 10,
    description: "أصفر نيون وكلام أسود ضخم يملأ الشريحة من الحافة للحافة. صوته عالٍ ويُرى من بعيد.",
    bestFor: "تبسيط المفاهيم الصعبة والأسئلة المباشرة",
    look: "Full neon yellow #FAFF00 background on the cover, black #000000 on inner slides, giant ultra-black Arabic filling the slide edge to edge, tightly stacked. One flat icon at most. Raw and loud.",
    type: "The heaviest Arabic display available, tight leading, black on yellow then yellow on black.",
    cover: "The question alone, so big that its letters almost touch the edges.",
    body: "The answer in yellow on black, four or five big lines and one simple flat icon.",
    closing: "One short line and the request in the same loud type.",
    code: "Pure code: fit each line to the full width, keep the leading tight, never touch the cut edge.",
  },

  // ───────── اقتباسات وتحفيز ─────────
  {
    id: "printed-note", n: 17, niche: "اقتباسات وتحفيز", name: "التويت المطبوع", winner: true, words: 12,
    description: "جملة مطبوعة على ورقة ممزقة ملصقة على جدار أو مغناطيس على ثلاجة. مشهد حقيقي، لا تصميم.",
    bestFor: "الاقتباسات والجمل التي تُرسل للأصدقاء",
    look: "A real photograph: a sheet of white paper filling most of the frame, taped to a rough concrete wall in hard sunlight with leaf shadows, or held by a magnet on a kitchen fridge. Real, tactile, moody.",
    type: "Large bold black printed Arabic over three lines, easy to read on a phone.",
    cover: "The torn sheet taped to the wall with the sentence filling the paper.",
    body: "Another real place, the same paper idea, the next sentence.",
    closing: "The paper with the request in the same printed type.",
    code: "The real scene with a blank sheet is photo1; set the printed line yourself with the paper's perspective and let the shadows pass over it with a multiply layer.",
    photoIdea: "صوّر ورقة بيضاء على جدار بيتك أو مكتبك ونطبع الجملة عليها، أو نسوي لك المشهد من الصفر.",
  },
  {
    id: "grainy-gradient", n: 18, niche: "اقتباسات وتحفيز", name: "التدرج الحبيبي", words: 10,
    description: "تدرج ألوان حالم بحبيبات فيلم وسطر رفيع في المنتصف. هادئ جدًا.",
    bestFor: "التأملات والعبارات الهادئة",
    look: "Dreamy grainy gradient with heavy film noise and nothing else: peach #FF9E7A, lilac #B79CE8 and electric blue #1F4DFF on one slide, mint #A8D8B0 and coral #F58F6C on the next.",
    type: "Elegant thin Arabic with a calligraphic feel, white or dark, centred, medium size.",
    cover: "One short sentence in the exact centre.",
    body: "The next sentence on a shifted gradient.",
    closing: "One gentle line and the request.",
    code: "Pure code: mix several soft radial gradients on a low-resolution layer, scale it up and add strong noise; avoid banding; thin centred type.",
  },
  {
    id: "letterpress", n: 19, niche: "اقتباسات وتحفيز", name: "الحبر البارز", words: 8,
    description: "حروف مضغوطة في ورق قطني سميك بإضاءة جانبية، فتبان محفورة بظلال حقيقية. فخم بلا صور.",
    bestFor: "العبارات القصيرة القوية والعلامات الراقية",
    look: "Deep debossed letterpress type pressed into thick cotton card, photographed in raking light so the letters cast real shadows; emerald green #17492F on the cover, mustard #D39B1A on the next slide. Luxurious stationery feel.",
    type: "Very large clean Arabic, debossed in the same colour as the card, over three lines.",
    cover: "Two to four words filling the card.",
    body: "The next short phrase pressed into a card of the second colour.",
    closing: "The request pressed into the card.",
    code: "Fake the deboss in code: same-colour text with a dark inner shadow on top and a light edge at the bottom, paper grain and a raking-light gradient across the slide.",
  },
  {
    id: "typewriter", n: 20, niche: "اقتباسات وتحفيز", name: "الآلة الكاتبة", words: 18,
    description: "آلة كاتبة قديمة تحت ضوء مصباح، وورق قديم عليه حبر غير منتظم. سينمائي ودافئ.",
    bestFor: "الرسائل والقصص والعبارات الشخصية",
    look: "Cinematic photograph of a vintage typewriter on a dark wooden desk under warm lamp light #E5A84B; close-ups of aged paper #D9C69A with uneven typed ink.",
    type: "Typewriter-like Arabic with slightly uneven ink, black on the aged paper.",
    cover: "The typewriter with a sheet in the roller carrying the title.",
    body: "A close-up of the aged paper filling the slide with one or two typed sentences and a red pencil underline under one word.",
    closing: "A typed last line and the request.",
    code: "The typewriter scene and the blank aged paper are photos; set the type in code with slight per-word position and ink variation; draw the red pencil line as a textured stroke.",
    photoIdea: "إذا عندك صورة لمكتبك أو لورقة بخطك أرسلها، وإلا نصنع لك مشهد الآلة الكاتبة من الصفر.",
  },

  // ───────── كوميدي وترفيه ─────────
  {
    id: "comic-4", n: 21, niche: "كوميدي وترفيه", name: "الكوميكس ٤ مربعات", winner: true, words: 22,
    description: "أربعة مربعات بخط أسود سميك وألوان مسطحة وشخصيات بسيطة، والنكتة مكتملة في الشريحة نفسها.",
    bestFor: "النكت والمواقف من الحياة والعمل",
    look: "Modern webcomic with 4 equal panels and white gutters, thick black ink outlines, flat bold colours (cyan #3CC8F0, warm orange #FF9F1C, lilac #B59CE8), simple funny round-headed male characters, professional comic artist quality.",
    type: "Rounded friendly Arabic in black inside white speech bubbles with thick outlines, reading right to left: top right, top left, bottom right, bottom left.",
    cover: "A complete joke in four panels with its punchline in the last one.",
    body: "Another complete joke in four panels, with the same characters.",
    closing: "One last panel with the request said by a character.",
    code: "Draw the panels and simple round-headed characters with clean thick strokes and flat colours; set every bubble's Arabic yourself and fit it exactly in its bubble.",
  },
  {
    id: "comic-quiet", n: 22, niche: "كوميدي وترفيه", name: "الكوميكس الحنين", words: 18,
    description: "رسم رصاص رمادي هادئ وعنصر واحد ملوّن فقط، وقصة صغيرة تؤلم بلطف.",
    bestFor: "المشاعر والوحدة والعمل والحياة اليومية",
    look: "Quiet pencil-and-ink comic with 4 panels in soft greys, only one element coloured (a sunset #F28C38 or a desk lamp #F6D365), a young man alone at home. Tender and melancholic.",
    type: "Small neat Arabic in white caption boxes with thin outlines, right-aligned, reading from the top right.",
    cover: "A short story in four panels with a silent panel before the last.",
    body: "Another short story in the same pencil world.",
    closing: "A single large panel with the request as a caption.",
    code: "Better painted: photo1 is the whole comic with empty caption boxes and no writing; set each caption yourself inside its box.",
  },
  {
    id: "meme", n: 23, niche: "كوميدي وترفيه", name: "الميم", words: 10,
    description: "صورة موقف واقعية بكلام أبيض سميك فوق وتحت. يصل بسرعة ويُرسل للأصحاب.",
    bestFor: "المواقف اليومية التي يقول عنها الناس: هذا أنا",
    look: "Classic meme layout: a dark candid photograph of an exhausted or shocked man lit by a phone or laptop screen, bold white text with a black outline at the top and the bottom.",
    type: "Bold white Arabic sans with a thick black outline, large, centred.",
    cover: "The setup at the top and the punchline at the bottom of one photo.",
    body: "The next stage of the same situation with a new expression.",
    closing: "The last reaction and the request.",
    code: "The photo is photo1; set the outlined top and bottom lines in code with exact size so they never cover the face.",
    photoIdea: "أرسل صورتك بتعبير مضحك أو صورة من يومك، ونكتب عليها، أو نصنع لك صورة موقف من الصفر.",
  },
  {
    id: "phone-chat", n: 24, niche: "كوميدي وترفيه", name: "محادثة آيفون", words: 20,
    description: "شاشة رسائل بفقاعات زرقاء ورمادية، والقصة تتكشف رسالة رسالة.",
    bestFor: "القصص القصيرة والمواقف والمبيعات بأسلوب حوار",
    look: "An exact phone messages screen on white #FFFFFF: a contact name at the top, grey bubbles #E9E9EB on the left, blue bubbles #0A84FF on the right.",
    type: "Clean Arabic system-like sans at a large readable size, black in grey bubbles, white in blue bubbles.",
    cover: "Three messages that open a story and stop before the answer.",
    body: "The next messages; a blurred photo attachment may appear as a bubble.",
    closing: "The last bubble with the twist or the request.",
    code: "Pure code: draw exact rounded bubbles with tails, sized to the text, in the right order, right-to-left text inside.",
  },
  {
    id: "raw-messy", n: 25, niche: "كوميدي وترفيه", name: "الخام المتعمد", words: 12,
    description: "صورة جوال عادية بفلاش وقص مائل وخط كبير أو قلم أحمر. يبان عفويًا وصادقًا، وهذا سر قوته.",
    bestFor: "الاعترافات والكواليس والحقائق بلا تجميل",
    look: "Deliberately messy low-quality phone flash photo of a cluttered desk or a notebook on a bed, overexposed, crooked crop, no retouching, no people's faces.",
    type: "Huge white Arabic with a black shadow, off-centre and tilted like a quick story caption, or a rough red marker scrawl #E01818.",
    cover: "The messy photo with the confession in huge tilted type.",
    body: "Another messy photo with a red marker scrawl on it.",
    closing: "One more raw photo with the request in the same scrawl.",
    code: "Use the person's raw photo as photo1 and only add the tilted caption or marker scrawl; never tidy it, never add design.",
    photoIdea: "هذا الستايل أحلى بصورك العادية من جوالك: مكتبك، طاولتك، كواليس شغلك. أرسلها كما هي، أو نصنع لك لقطة خام من الصفر.",
  },

  // ───────── سفر ولايف ستايل ─────────
  {
    id: "photo-dump", n: 26, niche: "سفر ولايف ستايل", name: "الفوتو دمب", words: 4,
    description: "صور عفوية متفرقة بلا ترتيب، وكلمة صغيرة في الزاوية. الصورة هي الكلام.",
    bestFor: "اليوميات والرحلات والكواليس",
    look: "Candid 35mm flash or phone photographs, unposed, slightly blurred, warm and real: hands sharing tea on a rooftop at dusk, a desert highway through a car window.",
    type: "Tiny white Arabic in a corner, a word or two only.",
    cover: "The strongest candid moment with one tiny word in the corner.",
    body: "Another candid moment with a tiny word or none.",
    closing: "A quiet last photo.",
    code: "Place the photo full-bleed as photo1 and add only the tiny corner word; nothing else.",
    photoIdea: "هذا الستايل يقوم على صورك أنت: أرسل صور رحلتك أو يومك، أو نصنع لك لقطات عفوية من الصفر.",
  },
  {
    id: "scrapbook-real", n: 27, niche: "سفر ولايف ستايل", name: "السكراب بوك", winner: true, words: 12,
    description: "صفحة ألبوم يدوية: ورق ممزق وشريط لاصق وصور فورية وزهور مجففة، كأنها مصنوعة باليد.",
    bestFor: "الرحلات والذكريات والمناسبات",
    look: "Photograph of a handmade scrapbook page: torn kraft #B98F5F and pink #E8B4B8 paper, washi tape, real instant photos of the sea and palm trees, pressed flowers and dried leaves. Rich and tactile.",
    type: "Cut-out paper Arabic letters for the title; brown pen Arabic handwriting #5B3A29 for notes.",
    cover: "A title in cut-out paper letters in the middle, with two instant photos around it.",
    body: "An open album page with ticket stubs, film photos and a short handwritten note.",
    closing: "A torn note with the request.",
    code: "Paint the album page with empty paper areas as photo1, or place the person's photos in instant-photo frames with tape drawn in code; set every word yourself.",
    photoIdea: "أرسل صور رحلتك أو ذكرياتك ونضعها داخل الصفحة بإطارات وشريط لاصق، أو نصنع لك الألبوم من الصفر.",
  },
  {
    id: "film-strip", n: 28, niche: "سفر ولايف ستايل", name: "إطار الفيلم", words: 8,
    description: "شريط فيلم ٣٥ مم بثقوبه وحبيباته، وتاريخ برتقالي في الزاوية. كأنه خرج من درج قديم.",
    bestFor: "صور السفر والأماكن والحنين",
    look: "Scan of a 35mm film strip on black #0A0A0A with visible perforations, one big frame with heavy grain and golden-hour colour; or a contact sheet of six frames on off-white with a red grease-pencil circle #C8322B.",
    type: "Arabic in an orange date-stamp look #FF7A1A in a corner of the frame; red Arabic handwriting for the contact sheet.",
    cover: "One big frame with the date-stamp caption.",
    body: "The contact sheet with one frame circled and a red handwritten line.",
    closing: "The last frame with the request as a stamp.",
    code: "Draw the film edges, perforations and grain in code around photo1; set the orange stamp as seven-segment-like Arabic digits and words.",
    photoIdea: "أرسل صورك من السفر أو من مدينتك، ونركّبها داخل إطار الفيلم، أو نصنع لك لقطات من الصفر.",
  },
  {
    id: "panorama-scene", n: 29, niche: "سفر ولايف ستايل", name: "البانوراما المتصلة", words: 8,
    description: "مشهد واحد عريض يكمل من شريحة إلى شريحة، فيسحب القارئ ليرى الباقي.",
    bestFor: "الأماكن والقصص البصرية والعروض",
    look: "One continuous epic landscape spread across the slides: golden desert dunes at sunset #E8891C with a lone camel caravan walking across the cut, the same horizon height on every slide.",
    type: "Large white bold Arabic with a soft shadow, placed safely away from the cut between slides.",
    cover: "The start of the scene with the headline; an element crosses the slide's edge to invite the swipe.",
    body: "The scene continues at the same horizon height, with a short line.",
    closing: "The end of the scene and the request.",
    code: "This slide's part of the scene is photo1, full-bleed; keep the horizon at the height of slide 1 so the slides read as one scene; set the words away from the edges.",
    photoIdea: "أرسل صورة بانوراما من جوالك أو صورة عريضة لمكانك ونقسمها على الشرائح، أو نصنع لك المشهد من الصفر.",
  },
  {
    id: "newspaper", n: 30, niche: "سفر ولايف ستايل", name: "الجريدة", words: 12,
    description: "صفحة جريدة قديمة حقيقية بعنوان ضخم وصورة منقطة، ودائرة حمراء بالقلم حول الخبر.",
    bestFor: "الأخبار والقصص والتحليلات ولفت الانتباه",
    look: "Photograph of an old Arabic broadsheet newspaper on a table with coffee: greyish paper #DAD6CC, black ink, a black-and-white halftone photo of a man or an object, columns of tiny grey lines instead of words, a thick red marker circle #D21F1F.",
    type: "Heavy classic Arabic newspaper headline type in black, the masthead in a calligraphic feel.",
    cover: "A masthead, a giant headline and a halftone photo.",
    body: "A close crop on one headline circled in red with its halftone portrait.",
    closing: "A small boxed note on the page with the request.",
    code: "Draw the page in code on a paper texture with grey column bars, apply a halftone to photo1, set the headline, and draw the marker circle as a rough stroke.",
    photoIdea: "أرسل صورة لك أو للخبر الذي تتكلم عنه ونحولها صورة جريدة منقطة، أو نصنع لك الصفحة من الصفر.",
  },
  {
    id: "ticket-passport", n: 31, niche: "سفر ولايف ستايل", name: "التذكرة والجواز", words: 10,
    description: "بطاقة صعود قديمة على قماش، وصفحة جواز مليئة بالأختام، وكل شريحة ختم جديد.",
    bestFor: "خطط السفر والجداول والبرامج السياحية",
    look: "A vintage boarding pass #EBDDBE on beige linen beside a leather passport, warm light; a passport page full of colourful ink visa stamps in faded blue, purple, green and red.",
    type: "Elegant printed Arabic on the ticket; ink-stamp lettering in a big stamp and blue handwriting across it.",
    cover: "The ticket large with the destination and the duration.",
    body: "The passport page with one big central stamp for the day and a handwritten tip.",
    closing: "The last stamp with the request.",
    code: "Paint the linen and passport with empty areas as photo1, or draw the ticket in code; set the stamp text with a rough ink mask.",
    photoIdea: "أرسل صورة من وجهتك أو من رحلتك لنضعها داخل التذكرة، أو نصنع لك التصميم من الصفر.",
  },

  // ───────── طعام ووصفات ─────────
  {
    id: "tested-list", n: 32, niche: "طعام ووصفات", name: "القائمة المجربة بالصور", winner: true, words: 12,
    description: "صورة طعام شهية تملأ الشريحة وعنوان عريض يعد بنتيجة محددة، وكل شريحة عنصر بشريط صغير.",
    bestFor: "الوصفات والمطاعم والقوائم التي تُحفظ",
    look: "Appetising natural-light food photography filling the slide, a hand holding a ceramic bowl on the cover, a full-bleed close dish inside.",
    type: "Very bold white Arabic with a soft shadow on the cover; a small black label box #000000 with white Arabic inside.",
    cover: "The best dish with a big centred promise such as how many were tried and how many are worth it.",
    body: "One dish full-bleed with its numbered name in a small black label at the bottom corner.",
    closing: "A last dish with the request in the black label.",
    code: "The dish is photo1 (the person's or painted); set the big white title with a soft shadow, and the exact black label box.",
    photoIdea: "أرسل صور أطباقك الحقيقية، طبق لكل شريحة، وهذا أقوى من أي صورة مولّدة، أو نصنع لك الصور من الصفر.",
  },
  {
    id: "recipe-card", n: 33, niche: "طعام ووصفات", name: "بطاقة الوصفة", words: 16,
    description: "بطاقة وصفات قديمة بخط يد أزرق على رخام عليه طحين وبيض، كأنها من مطبخ الجدة.",
    bestFor: "الوصفات العائلية والحلويات",
    look: "Photograph of a vintage recipe index card #F1DFA8 with red rules on a flour-dusted marble counter with eggs and a rolling pin, warm kitchen light.",
    type: "Blue ink handwritten Arabic, large, right-aligned on the card's lines.",
    cover: "The card with only its title handwritten, the rest of the card empty.",
    body: "The card close up with a heading and a short handwritten list on the lines.",
    closing: "The card with a short note and the request.",
    code: "Paint the counter and an empty card as photo1 and set the handwriting yourself along the card's lines.",
    photoIdea: "صوّر وصفتك بخطك أو مطبخك وأرسلها، أو نصنع لك البطاقة من الصفر.",
  },
  {
    id: "macro-steps", n: 34, niche: "طعام ووصفات", name: "الخطوة بصورة قريبة", words: 8,
    description: "لقطة قريبة جدًا سينمائية على أسود، وسطر ذهبي صغير. تُشاهد بالعين قبل أن تُقرأ.",
    bestFor: "الحلويات والقهوة والمنتجات الفاخرة",
    look: "Extreme macro cinematic food photography against a black #070504 backdrop: molten chocolate, a whisk in thick batter, dramatic light.",
    type: "Small elegant gold #C9A45C Arabic in a calm corner.",
    cover: "The most striking macro shot with one small gold line.",
    body: "The macro shot of this step with a small numbered gold line.",
    closing: "The finished thing with a small gold line and the request.",
    code: "The macro shot is photo1, full-bleed; set the small gold line only, in the empty dark area.",
    photoIdea: "أرسل لقطات قريبة من منتجك أو طبقك وأنت تحضّره، أو نصنع لك اللقطات من الصفر.",
  },
  {
    id: "receipt", n: 35, niche: "طعام ووصفات", name: "الإيصال", words: 14,
    description: "إيصال حراري مجعد على رخام أسود، والمقادير أو التكاليف مكتوبة كفاتورة. فكرة ذكية تبقى في الذاكرة.",
    bestFor: "التكاليف والميزانيات والمقادير",
    look: "Photograph of a slightly crumpled thermal receipt #F2EFE6 on dark marble #1C1C1E with a fork and basil leaves.",
    type: "Monospaced-feeling Arabic print in dark grey, large, with a bold total under a dashed line.",
    cover: "The receipt tilted with a big two-line promise printed on it.",
    body: "The receipt close up with item rows, a dashed line and a bold total.",
    closing: "The bottom of the receipt with the request printed like a footer.",
    code: "Draw the receipt in code as exact rows on a paper texture with a zigzag edge; the marble and the props may be a painted photo1.",
    photoIdea: "أرسل صورة طبقك أو منتجك لتكون بجانب الإيصال، أو نصنع لك المشهد من الصفر.",
  },

  // ───────── تقنية وذكاء اصطناعي ─────────
  {
    id: "tool-before-after", n: 36, niche: "تقنية وذكاء اصطناعي", name: "قبل وبعد الأداة", winner: true, words: 12,
    description: "لابتوب في غرفة داكنة: رسمة بسيطة على جهة ونتيجة مذهلة على الجهة الثانية. الناس تبي تشوف النتيجة أولًا.",
    bestFor: "شرح أدوات الذكاء الاصطناعي والتطبيقات",
    look: "A laptop on a desk in a dark studio #0D0D10 with a warm lamp, its screen split between a rough pencil sketch and a polished finished result, glowing; interface text blurred.",
    type: "Bold white Arabic above the laptop; an amber tag #C98A2B with dark Arabic for the small captions.",
    cover: "The split screen under a big promise over two lines.",
    body: "A close-up of the input or the result with an amber tag saying what was done.",
    closing: "The finished result full on the screen with the request.",
    code: "Place the person's real before and after screenshots inside a laptop frame drawn or painted as photo1; set every word in code.",
    photoIdea: "أرسل لقطة «قبل» ولقطة «بعد» الحقيقية من الأداة، وهذا أصدق شي، أو نصنع لك مثالًا من الصفر.",
  },
  {
    id: "dark-code", n: 37, niche: "تقنية وذكاء اصطناعي", name: "الواجهة الداكنة والكود", words: 12,
    description: "نافذة محرر أكواد داكنة بألوان وخط أخضر مضيء، تخاطب الجمهور التقني بلغته.",
    bestFor: "البرمجة والأوامر والأتمتة",
    look: "A dark code editor window on deep navy #0B1220 with syntax-highlighted code and three window dots; a black terminal with one highlighted line. The code itself may be in English.",
    type: "Glowing green #5BFF7A monospaced-feeling Arabic for headlines and captions.",
    cover: "A green headline above the editor window full of code.",
    body: "A terminal close-up with one highlighted line and a green caption under it.",
    closing: "A command-style line with the request.",
    code: "Pure code: draw the window chrome and real short code with a monospaced font and exact colours; the green headline set in Arabic.",
  },
  {
    id: "tools-grid", n: 38, niche: "تقنية وذكاء اصطناعي", name: "شبكة الأدوات", words: 12,
    description: "تسع أيقونات ثلاثية الأبعاد لامعة على بنفسجي فاتح، تُحفظ كقائمة مرجعية.",
    bestFor: "قوائم الأدوات والتطبيقات والموارد",
    look: "A neat 3×3 grid of glossy 3D abstract app icons with no logos on soft lilac #E2D3F5; inside, one large icon on a white rounded card.",
    type: "Bold deep-purple #3A1E74 Arabic sans.",
    cover: "A two-line headline above the 3×3 icon grid.",
    body: "One large icon on a white card with its numbered name and one short line.",
    closing: "The grid again, smaller, with the request.",
    code: "Paint the icons as photo1 or draw clean rounded icons in code with soft gradients and shadows; set the words yourself.",
  },
  {
    id: "phone-mockup", n: 39, niche: "تقنية وذكاء اصطناعي", name: "الجوال المحاكى", words: 10,
    description: "جوال ثلاثي الأبعاد يطفو على لون صريح، وعلى شاشته التطبيق، وكلمات كبيرة بجانبه.",
    bestFor: "عرض التطبيقات والمنتجات الرقمية",
    look: "A hyper-real 3D smartphone floating on a vivid flat colour: orange #FF6A00 on the cover, teal #0E8F8F inside, its screen showing an abstract colourful interface with no words.",
    type: "Very bold white Arabic beside the phone, over three lines.",
    cover: "The phone at an angle with the app's promise beside it.",
    body: "The phone facing front with this feature on its screen, a short line beside it.",
    closing: "The phone with the request beside it.",
    code: "Place the person's real screenshot inside a phone frame (a painted empty phone as photo1 or a drawn one) and set the words in code.",
    photoIdea: "أرسل لقطات شاشة تطبيقك أو موقعك لنضعها داخل الجوال، أو نصنع لك شاشة توضيحية من الصفر.",
  },
  {
    id: "bento", n: 40, niche: "تقنية وذكاء اصطناعي", name: "البنتو", words: 12,
    description: "مربعات مستديرة بأحجام مختلفة مثل صفحات المنتجات الحديثة، رقم هنا وأيقونة هناك.",
    bestFor: "المزايا والأرقام والمقارنات السريعة",
    look: "Bento grid of rounded cards, premium product-page look: on the cover dark cards #15152A on near-black with violet glow #8F6BFF; inside soft white cards #F7F6F1 with pastel 3D icons.",
    type: "Clean Arabic sans, white on the dark cards, dark on the white cards.",
    cover: "One big stat card, an icon card, a gradient card, a chart card and a headline card.",
    body: "Four equal cards, each a 3D icon and one word.",
    closing: "A headline card with the request.",
    code: "Pure code: exact grid, equal gaps, one radius; draw charts and gradients in code; only paint 3D icons if they are needed.",
  },

  // ───────── منتجات وبراندات ─────────
  {
    id: "product-panorama", n: 41, niche: "منتجات وبراندات", name: "البانوراما المنتجية", words: 8,
    description: "منتج فاخر في مشهد عريض يكمل بين الشريحتين، ودخان ذهبي يعبر الحد بينهما.",
    bestFor: "العطور والساعات والمنتجات الفاخرة",
    look: "One wide luxury product photograph spread across slides: the product standing on black sand #0B0906, golden smoke #C9A45C sweeping from edge to edge across every slide.",
    type: "Elegant gold Arabic, medium size, placed safely away from the cut.",
    cover: "The product's name on the calm side, the product crossing the cut.",
    body: "The other half of the scene with one short line.",
    closing: "The product with its name and the request.",
    code: "This slide's part of the scene is photo1, full-bleed; keep the smoke at the height of slide 1 so the slides read as one scene; set the gold words in code away from the edges.",
    photoIdea: "أرسل صورة منتجك بخلفية نظيفة ونضعها وسط المشهد، أو نصنع لك صورة المنتج من الصفر.",
  },
  {
    id: "cut-out-pop", n: 42, niche: "منتجات وبراندات", name: "القص واللصق", winner: true, words: 8,
    description: "المنتج مقصوص بحد أبيض كملصق على لون صارخ، وكلام أصفر ضخم. لا يمكن تجاوزه بالسكرول.",
    bestFor: "المتاجر والعروض والمنتجات الشبابية",
    look: "Bold pop collage: the product cut out with a thick white sticker outline and a hard shadow on vivid magenta #E5004F with halftone dots on the cover, cobalt #0A2BE0 inside; torn-paper tags in yellow #FFD60A and lime #A6F000.",
    type: "Huge heavy yellow Arabic on the cover; heavy dark Arabic on the tilted tags.",
    cover: "A huge short claim above the product sticker.",
    body: "The product from another side with tilted sticker tags for its specifications.",
    closing: "The product sticker with the price or the request on a tag.",
    code: "Cut the person's product photo with a mask, draw the white outline and hard shadow in code, the halftone and tags in code; set all the words yourself.",
    photoIdea: "أرسل صورة منتجك الحقيقية ونقصها ونحولها ملصق مثل هذا، أو نصنع لك صورة منتج من الصفر.",
  },
  {
    id: "quiet-catalog", n: 43, niche: "منتجات وبراندات", name: "الكتالوج الهادئ", words: 6,
    description: "صورة منتج هادئة بضوء طبيعي ومساحة فارغة كبيرة، واسم صغير وسعر. الفخامة في السكوت.",
    bestFor: "الحرف والديكور والمنتجات اليدوية",
    look: "Quiet minimal catalogue photograph: one object on a warm-white plinth #EFE7DA or natural linen, lots of empty space, soft shadow, morning side light.",
    type: "Tiny elegant Arabic in warm grey at the bottom, name then price.",
    cover: "One object with the collection's name small at the bottom.",
    body: "The next object with its name and price small.",
    closing: "One object with a small line for how to order.",
    code: "The photo is photo1, untouched; set the tiny name and price only.",
    photoIdea: "صوّر منتجك على طاولة قرب الشباك بضوء الصبح وأرسله، أو نصنع لك الصورة من الصفر.",
  },
  {
    id: "layer-by-layer", n: 44, niche: "منتجات وبراندات", name: "طبقة فوق طبقة", words: 4,
    description: "نفس اللقطة تمامًا، وفي كل شريحة يضاف عنصر جديد، فيقلب القارئ ليرى كيف يكتمل.",
    bestFor: "مكونات المنتج وكيف يُصنع الشيء خطوة خطوة",
    look: "Top-down studio photograph on pale grey #DEDEDC with the exact same framing on every slide: one centred object gaining one new layer per slide, lots of empty space.",
    type: "A small clean dark Arabic label under the object.",
    cover: "The first layer alone with its small label.",
    body: "The same framing with one more layer and its label.",
    closing: "The complete object with its name and the request.",
    code: "Keep the frame identical: photo1 of each stage placed at the same size and position; set one small label.",
    photoIdea: "صوّر منتجك من فوق بالجوال وهو ثابت في مكانه، وأضف قطعة في كل لقطة، أو نصنع لك المراحل من الصفر.",
  },

  // ───────── صحة ولياقة ─────────
  {
    id: "body-before-after", n: 45, niche: "صحة ولياقة", name: "قبل وبعد الجسم", words: 10,
    description: "صورة الرجل نفسه قبل وبعد في الغرفة نفسها، وعنوان بالمدة. أقوى إثبات لو كانت الصور حقيقية.",
    bestFor: "اللياقة والتغذية وقصص التغيير الحقيقية",
    look: "A split photo of the same man in a plain grey t-shirt, fully clothed, in the same room: slouched and heavier on the right, upright and fit on the left, soft natural light, beige labels. Inside: a man tying his running shoes on a quiet street at dawn.",
    type: "Dark bold Arabic headline at the top; bold white Arabic on the street photo.",
    cover: "The two sides with «قبل» and «بعد» labels under the headline that gives the duration.",
    body: "One habit behind the change in a real scene with a short bold line.",
    closing: "The result and the request.",
    code: "Use the person's two real photos side by side as photo1 and photo2; draw the dividing line and labels in code.",
    photoIdea: "أرسل صورتك الحقيقية قبل وبعد، وهذا هو ما يقنع الناس. لو نسويها من الصفر فهي مثال توضيحي ولا تُقدَّم كنتيجة حقيقية.",
  },
  {
    id: "weekly-plan", n: 46, niche: "صحة ولياقة", name: "جدول الأسبوع", words: 16,
    description: "جدول أسبوع ملوّن، كل يوم بلونه وأيقونته. يُحفظ ويُرجع إليه كل يوم.",
    bestFor: "البرامج الرياضية والروتين والخطط",
    look: "A colourful weekly planner board on a wall with seven colour-coded columns on the cover; inside, clean rounded colour rows on off-white #FBF9F2 in soft green, amber, lilac, sky and coral, each with a round icon.",
    type: "Bold dark Arabic sans, one row per day at a large readable size.",
    cover: "A big headline above the empty colourful board.",
    body: "One rounded row per day with its icon, the day's name and the task.",
    closing: "A small recap with the request.",
    code: "Pure code for the rows: exact equal rows, soft colours and simple icons; the wall scene of the cover may be a painted photo1.",
    photoIdea: "إذا عندك صورة لوحك أو مكان تمرينك أرسلها للغلاف، أو نصنع لك الغلاف من الصفر.",
  },
  {
    id: "myth-stamp", n: 47, niche: "صحة ولياقة", name: "الحقيقة ضد الخرافة", winner: true, words: 10,
    description: "ختم مطاطي ضخم «خرافة» على أحمر و«حقيقة» على أخضر. أكثر صيغة تفتح التعليقات والنقاش.",
    bestFor: "تصحيح المفاهيم الخاطئة في الصحة والمال والتربية",
    look: "Solid red #D40000 slide for the myth and solid green #3F9B2F slide for the fact, a giant rubber-stamp impression at an angle, one photographed object at the bottom edge.",
    type: "Bold white Arabic at the top; the stamp's word in distressed dark ink inside a rough rectangle.",
    cover: "The false claim as a question, the stamp «خرافة» across the middle, the object below.",
    body: "The fact in white, the stamp «حقيقة», and the object below.",
    closing: "A last line on the same green with the request.",
    code: "Draw the stamp in code (rough rectangle, distressed mask, rotation), place the object as photo1 at the bottom, set the words yourself.",
    photoIdea: "أرسل صورة الشيء الذي تتكلم عنه أو منتجك ليكون تحت الختم، أو نصنع لك صورة من الصفر.",
  },

  // ───────── مال وأعمال شخصية ─────────
  {
    id: "real-screenshot", n: 48, niche: "مال وأعمال شخصية", name: "لقطة الشاشة الحقيقية", winner: true, words: 10,
    description: "جوال أو جدول حقيقي في يد صاحبه، مع مربع أبيض صغير كتعليق سريع. الدليل هو الذي يقنع.",
    bestFor: "المال والتوفير والأرقام الشخصية والنتائج",
    look: "A candid photo of a hand holding a phone with a finance graph, or a laptop with a spreadsheet and one row highlighted yellow #F7D23E; all numbers and cell text blurred; dim warm room; a rough red hand-drawn arrow.",
    type: "Black Arabic inside a small white rounded box, like a quick story caption.",
    cover: "The phone in hand with the question in a white box.",
    body: "The spreadsheet with one highlighted row and the finding in a white box.",
    closing: "The result in the white box with the request.",
    code: "Place the person's real screenshot in the frame as photo1 with sensitive numbers blurred, and draw only the arrow and the white caption box.",
    photoIdea: "أرسل لقطة شاشتك الحقيقية من البنك أو الجدول بعد إخفاء الأرقام الحساسة، أو نصنع لك لقطة توضيحية من الصفر.",
  },
  {
    id: "plan-abc", n: 49, niche: "مال وأعمال شخصية", name: "الخطة أ ب ج", words: 10,
    description: "مخطط هندسي أزرق بطرق تتفرع من نقطة واحدة، وكل شريحة طريق مختلف لنفس الهدف.",
    bestFor: "الخيارات والخطط وطرق تحقيق هدف واحد",
    look: "A blueprint on deep blue paper #0E3A7A with fine white technical lines and a faint grid: three chalk paths diverging from one point; inside, a maze-like plan with one path highlighted in orange #F08A24.",
    type: "White chalk-like bold Arabic for the headline; big letters «أ» «ب» «ج» in thin circles.",
    cover: "The three paths from one point, labelled with the letters, under the headline.",
    body: "One path highlighted in orange leading to its letter, with the plan as the headline.",
    closing: "All three paths with the request.",
    code: "Pure code: blueprint grid, exact thin lines, the path drawn in orange; slight chalk texture on the words.",
  },

  // ───────── تفاعلي ─────────
  {
    id: "choose-path", n: 50, niche: "تفاعلي", name: "اختر مسارك", winner: true, words: 12,
    description: "شاشة لعبة بكسل قديمة فيها سؤال وزران، وكل جواب يودي القارئ لشريحة مختلفة. يقلّب ذهابًا وإيابًا.",
    bestFor: "زيادة وقت القراءة والتعليقات والاختبارات",
    look: "Retro pixel-art video game screen with vivid colours: a fork in a road, a small male pixel hero seen from behind, a castle on one side and a coin pile on the other, dark navy dialogue boxes #0F1E4A with gold frames #E0B23A.",
    type: "Bold pixel-friendly Arabic, white and yellow #FFD93B in the dialogue box, white on orange and blue buttons.",
    cover: "The question in the framed box and two big pixel buttons with the two answers.",
    body: "The result of one path in a dialogue box, which says which slide to go to next.",
    closing: "The end screen with the request.",
    code: "Better painted: photo1 is the pixel scene with empty boxes and no writing; set every word yourself inside the boxes and buttons.",
  },
];

export const findCarouselStyle = (id: string) => CAROUSEL_STYLES.find((s) => s.id === id);

/** The two samples of a style, drawn once and kept with the site. */
export const carouselSample = (s: Pick<CarouselStyle, "n">, which: "cover" | "slide") => `/content/carousel-styles/${String(s.n).padStart(2, "0")}-${which}.webp`;

/** Who appears in the carousel: the owner's rule, added to every slide and every painted picture. */
export const NO_REALISTIC_WOMEN =
  "PEOPLE RULE: never show a realistic adult woman anywhere in this picture, not as the subject, not in the background, not a realistic woman's face or figure. If a person is needed, show a man, hands, or objects instead. A woman may appear only as a clearly non-realistic cartoon drawing.";

/** How a slide's brief is written for GPT Image 2, as «محمد باقر» reads it (from what the 100 samples taught). */
export const CAROUSEL_GPT_CRAFT = `كيف تكتب توجيه GPT Image 2 لشريحة كاروسيل (بالإنجليزية، والنص العربي حرفيًا):
١) الموقع يضيف وصف الستايل المختار (الألوان والخط وتشريح الشريحة) حرفيًا إلى كل شريحة؛ فلا تنسخه، واكتب في "prompt" ما يخص هذه الشريحة فقط: المشهد أو الشيء المحدد، وأين يقع الكلام، وحجمه.
٢) صف شيئًا محددًا كأنه موجود: "Photograph of a torn sheet of white paper taped to a concrete wall" أقوى من "a creative design". سمِّ المادة والضوء والزاوية.
٣) اكتب النص العربي حرفيًا بين علامتي اقتباس مزدوجتين "..." لا بين «» لأنها تظهر مرسومة على الصورة. وقل أين يقع كل نص، وفي الكوميكس اكتب ترتيب المربعات: top right ثم top left ثم bottom right ثم bottom left.
٤) حدد الحجم دائمًا: "huge bold text filling the whole width over three lines, easy to read on a phone". بدون هذا يخرج الكلام صغيرًا جدًا لا يُقرأ على الجوال. استثناء: الستايلات التي كلامها صغير عمدًا (الكتالوج، الفوتو دمب).
٥) اجعل النص قصيرًا: من ٢ إلى ١٢ كلمة في الشريحة. وتجنب الأرقام التي تبدأ بصفر مثل «٠١» لأن الصفر يخرج خمسة («٥١»)، واكتب «العدد الأول» أو احذفها.
٦) إذا ظهرت شاشة أو جريدة أو كتاب فاطلب صراحةً: "interface labels blurred" أو "columns of plain grey bars instead of words" حتى لا يخترع كلامًا مشوهًا.
٧) لا تطلب شعارات ولا أسماء منصات أو شركات. والأشخاص: رجال أو أيدٍ أو أشياء؛ ولا تصف امرأة واقعية أبدًا.
٨) اجعل الغلاف فكرة واحدة تنقرأ في ثانية، والشريحة الثانية تزيد السؤال ولا تجاوبه كله، والجواب في الربع الأخير.`;

/** What «حيدرا ماكس» always follows when he makes a carousel slide in code. */
export const CAROUSEL_CODE_CRAFT =
  "CAROUSEL CRAFT: this slide must stop a thumb on a phone: one idea readable in a second, type large enough to fill the width unless the style says small. NEVER imitate a photograph, a realistic person, food, a place or a realistic object by drawing it in code, because it looks cheap: anything realistic comes to you as photo1 (fit it to the frame and only grade or mask it). In code you draw what code does beautifully: type, flat colour, grids, charts, paper grain, frames, stickers, tags, arrows, bubbles. Never show a realistic adult woman.";

/** The look of a style, as it goes into a slide's brief. */
export function carouselStyleBlock(s: CarouselStyle): string {
  return [
    `CAROUSEL STYLE "${s.id}" (verbatim; the whole carousel follows it so the slides read as one set; its colours are fixed unless the client asked otherwise).`,
    `Look: ${s.look}`,
    `Arabic type: ${s.type}`,
    `Cover slide: ${s.cover}`,
    `Inner slides: ${s.body}`,
    `Last slide: ${s.closing}`,
    `At most about ${s.words} words on a slide, all inside a safe area 8% from each edge.`,
  ].join("\n");
}

/** What «حيدرا ماكس» is told about the chosen look (his «الستايل» field, at most 2000 characters). */
export function carouselStyleForCode(s: CarouselStyle): string {
  return `${s.name}: ${s.look}\nType: ${s.type}\nHow to build it: ${s.code}\n${CAROUSEL_CODE_CRAFT}`;
}
