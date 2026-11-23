// «🎓 درس لطلابك» — the film maker's lesson path (the owner, 23 Nov 2026): a teacher gives a lesson (written, a PDF, a
// video from the device or a YouTube link) and it becomes something visual and easy for the students — a short story
// with characters, a working 3D model (how the heart works), or a hyper-motion dive into the finest details with a
// voice-over. Always shorter and easier than the film path: سجاد confirms his understanding, the screenwriter writes the
// lesson straight away (one approval), the sheets are made in ONE fixed style («الانحراف الأسلوبي», modern Pixar-like),
// the person approves them, and the narration is spoken with ElevenLabs («الأصوات», speaker «الراوي»).
// The teaching rules come from the strongest education channels (Kurzgesagt, TED-Ed, Veritasium, 3Blue1Brown, Jared
// Owen, Lesics, Nucleus, Dr. Binocs; Mayer's multimedia principles): one question, show then name, one step per shot,
// a zoom ladder, keyword labels only, a recap and a check question. Edit freely.

/** The lesson's one style, always (no style test). */
export const LESSON_STYLE_ID = "stylistic-drift";

/** The visual shapes a lesson takes (سجاد picks the fitting one; the teacher may name it). */
export const LESSON_FORMATS = [
  { id: "story", icon: "🎬", ar: "قصة قصيرة بشخصيات", fits: "القيم والسلوك والتاريخ، وتصحيح فكرة خاطئة بحوار قصير" },
  { id: "model", icon: "🫀", ar: "مجسم ثلاثي الأبعاد يشتغل", fits: "شي ينشاف كامل: القلب، المحرك، البركان — مقطع عرضي وأجزاء تنكشف خطوة خطوة" },
  { id: "hypermotion", icon: "🔬", ar: "هايبرموشن لأدق التفاصيل", fits: "شي أصغر من أن يُرى: الخلية، الذرة، الحويصلات — دخول من الكبير للصغير مع تعليق صوتي" },
] as const;
export type LessonFormat = (typeof LESSON_FORMATS)[number]["id"];
export const lessonFormat = (v: unknown) => LESSON_FORMATS.find((f) => f.id === v) ?? null;

/** A lesson's length (seconds): short, one lesson that stands on its own. */
export const LESSON_SECONDS = { min: 30, best: 60, max: 90 } as const;

/** What سجاد is told at the gate when the work is a lesson (added to his turn, never to the cached system). */
export const LESSON_INTAKE_RULES = `## هذا درس تعليمي (مسار «🎓 درس لطلابك»)
المعلم أعطاك درسًا (مكتوب، أو ملف PDF مرفق، أو فيديو) ويبي يحوّله لشي بصري قصير سهل لطلابه. مسار الدرس دايمًا أقصر وأسهل من الفيلم:
- افهم الدرس بأمانة. لا تخترع معلومة ما في الدرس ولا في توضيح المعلم، ولا تغيّر حقيقة علمية أو دينية فيه. المصطلحات والأرقام كما هي.
- lesson.question: السؤال الواحد اللي يجاوبه الدرس (هو أول جملة في الدرس).
- lesson.points: النقاط الأساسية بالترتيب، ٣ إلى ٦ نقاط قصيرة، من الكل إلى التفاصيل.
- lesson.audience: الطلاب وأعمارهم إذا انذكرت، وإلا فاضي.
- lesson.format: الشكل الأنسب: "story" قصة قصيرة بشخصيات (القيم، السلوك، التاريخ، تصحيح فكرة خاطئة بحوار قصير) · "model" مجسم ثلاثي الأبعاد يشتغل (شي ينشاف كامل: القلب، المحرك، البركان) بمقطع عرضي وأجزاء تنكشف خطوة خطوة · "hypermotion" هايبرموشن يدخل من الكبير لأدق التفاصيل (شي أصغر من أن يُرى: الخلية، الذرة) مع تعليق صوتي. إذا طلب المعلم شكلًا بعينه فهو اللي ينفّذ.
- الستايل ثابت دايمًا: «الانحراف الأسلوبي» (ثلاثي أبعاد عصري بروح بيكسار الحديثة). لا تسأل عنه ولا تقترح غيره.
- targetDurationSec بين 45 و75 ثانية (لا يتجاوز 90). الدرس الأكبر: خذ أول جزء يقف بنفسه وقل هذا في understanding.
- characters: الشخصيات اللي يحتاجها الدرس فقط (القصة: شخصيتان بالكثير؛ المجسم والهايبرموشن: غالبًا بدون شخصيات، أو مرشد واحد للأطفال). places: الأماكن اللي يحتاجها فقط (المجسم نفسه يُكتب هنا كمكان).
- scenePlan: عنصر واحد (الدرس مشهد واحد متصل).
- questions: سؤال واحد بالكثير، وفقط إذا كان مانع فعلًا (مثل عمر الطلاب لو يغيّر كل شي). غير كذا اختر أنت وقل اختيارك في understanding.
- understanding قصير جدًا: وش فهمت من الدرس في سطرين، والشكل اللي اخترته وليش في سطر، والمدة.
- concept: خطة الدرس للسيناريست: السؤال، والنقاط بالترتيب مع الحقائق الدقيقة من الدرس، والشكل، والصورة أو التشبيه البصري لكل نقطة.`;

/** The screenwriter's brief for a lesson (its kind's «brief», read before the lesson itself). */
export const LESSON_BRIEF = `هذا درس تعليمي قصير لطلاب، والمعلم أكّد فهم سجاد له (تحت). مسار الدرس مختصر جدًا:
- لا تسلّم فهمًا ولا أسئلة: تخطَّ المرحلة 2 والمرحلة 3. أول رد منك هو المرحلة 5 مباشرة («# القصة المطوّرة» مختصرة ثم «# السيناريو» = نص الدرس كامل) للاعتماد، وبعد «اعتمد» سلّم المرحلة 6.
- معلومة ناقصة غير مانعة: اختر الأنسب واكتبه في notes «(اختيار المساعد)». لا تخترع معلومة ما في الدرس.
قواعد الدرس (من أقوى القنوات التعليمية):
1. سؤال واحد للدرس كله، وهو أول جملة تنقال في أول ٣ ثوانٍ (أو الفكرة الخاطئة الشائعة، ثم تنكسر بعدين).
2. اعرض الشي قبل اسمه: المثال الملموس أولًا ثم المصطلح.
3. سمِّ جزأين أو ثلاثة رئيسية قبل ما تبدأ الحركة أو العملية.
4. كل لقطة خطوة وحدة (٦–١٠ ثوانٍ) بالترتيب.
5. سلّم الزوم: الكل ← الداخل ← أدق تفصيل ← الرجوع للكل.
6. تشبيه بصري واحد لكل فكرة يبقى ثابت، وألوان ثابتة للمعاني (مثل الأحمر للدم المؤكسج والأزرق لغير المؤكسج).
7. الكتابة على الشاشة كلمة إلى ثلاث كلمات فقط تطلع مع الكلام، وتنضاف في المونتاج (مولدات الفيديو تخرب الكتابة): اكتبها في السيناريو كـ «كلمة الشاشة: …».
8. لا شي زايد: لا معلومات جانبية ولا خلفيات مزدحمة.
9. خاطب الطالب بـ«أنت» بصوت دافي.
10. للأطفال: شخصية مرشد واحدة ثابتة تسأل سؤال الطالب.
11. النهاية: خلاصة في سطر، وسؤال تحقق واحد.
المدة ٤٥–٧٥ ثانية (٨–١٢ لقطة).
الكلام مختصر جدًا دايمًا:
- التعليق الصوتي باسم «الراوي (تعليق صوتي)»: جمل من ٦ إلى ١٠ كلمات، فكرة وحدة في كل جملة؛ نحو ١٫٧ كلمة بالثانية للكبار و١٫٣ للأطفال، وخلّ ١٥–٢٠٪ من الوقت بلا كلام عشان الصورة تشرح.
- الحوار: كل جملة ٨ كلمات بالكثير، وشخصيتان بالكثير في المشهد.
التسليم (المرحلة 6):
- «# قرارات التصميم»: الستايل ثابت «الانحراف الأسلوبي»، والشخصيات والأماكن (أو المجسم) اللي يحتاجها الدرس فقط.
- «# قرارات الإخراج»: إذا فيه حوار شخصيات اكتب «مصدر الحوار: تتولّد الفويسات هنا (بأصوات الجواد) وتنحط أصوات مرجعية مع كل فيديو»، وإذا كله تعليق صوتي اكتب «مصدر الحوار: الفيديو بدون حوار، وأضيف الحوار بعدين في المونتاج». وفي سطر ثاني: «التعليق الصوتي: الراوي بصوت ElevenLabs من «الأصوات»، ينضاف على الفيديو».`;

/** The sheet maker's note for a lesson (sent with the screenwriter's handoff). */
export const LESSON_SHEETS_NOTE = `## درس تعليمي (مسار «🎓 درس لطلابك»)
- الستايل ثابت مسبقًا: «الانحراف الأسلوبي». ما فيه لقطة اختبار: مع اعتماد الخريطة يوصلك «الستايل المعتمد»، فسلّم برومبت الماستر STY-00 (المرحلة 5) مباشرة.
- الخريطة: الشخصيات والأماكن اللي يحتاجها الدرس فقط. المجسم التعليمي (مثل القلب أو المحرك) خذه كـ ENV: لوحة مرجعية للمجسم نفسه — منظر كامل، مقطع عرضي، الأجزاء بالألوان الثابتة للمعاني، وأدق التفاصيل اللي ينزل لها الدرس.`;

/** The question on the sheet map of a lesson, before anything is drawn. */
export const LESSON_MAP_QUESTION = "عندك شخصيات معيّنة تبي تستخدمها أو تحوّلها للستايل؟ اختر لكل وحدة تحت، أو خلّها «اصنعه لي» واعتمد.";
