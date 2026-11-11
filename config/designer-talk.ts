// «المصمم الذكي» — the talk, built on «صانع المحتوى»'s way (the owner, 10 November 2026: «طوّره من تعاليم صانع
// المحتوى بما يتناسب»): short by default and longer on request, edits read precisely and said back in one line, and
// what the person picked in the galleries travels in their messages as marks ([خط:id] / [ألوان:id]) that the server
// reads and the page hides. (The kinds of design and their first questions were removed with the old method.) Pure.

// ───────── the marks ─────────

const MARK = /\s*\[(?:نوع|مصدر|خط|ألوان):[a-z0-9_-]+\]/g;

/** The text as the person reads it (the marks are for the server). */
export const stripMarks = (text: string) => text.replace(MARK, "");

/** A font of the list, as the answer it sends («auto»: he picks). */
export const fontAnswer = (f: { id: string; name: string } | "auto") => (f === "auto" ? "اختر لي الأنسب للتصميم [خط:auto]" : `«${f.name}» [خط:${f.id}]`);

/** A palette of the 100, as the answer it sends («auto»: he picks). */
export const paletteAnswer = (p: { id: string; name: string } | "auto") => (p === "auto" ? "اختر لي الألوان الأنسب [ألوان:auto]" : `«${p.name}» [ألوان:${p.id}]`);

/** The last id the person gave for a mark (the last one wins), or null. */
export function lastMark(texts: string[], mark: "خط" | "ألوان"): string | null {
  const re = new RegExp(`\\[${mark}:([a-z0-9_-]+)\\]`, "g");
  let hit: string | null = null;
  for (const t of texts) for (const m of t.matchAll(re)) hit = m[1];
  return hit;
}

/** What the person has decided so far (the chips over the chat, each one tappable to change it). */
export interface Decision {
  key: "font" | "palette";
  label: string;
  name: string;
  /** the message a tap sends to change it */
  change: string;
}

const KINDS: { key: Decision["key"]; label: string; mark: string; change: string }[] = [
  { key: "font", label: "الخط", mark: "خط", change: "أبي أغيّر الخط" },
  { key: "palette", label: "الألوان", mark: "ألوان", change: "أبي أغيّر الألوان" },
];

export function decisionsOf(userTexts: string[]): Decision[] {
  const out: Decision[] = [];
  for (const k of KINDS) {
    let hit: { id: string; name: string } | null = null;
    const named = new RegExp(`[^\\[\\n«]*(?:«([^»\\n]+)»)?[^\\[\\n]*\\[${k.mark}:([a-z0-9_-]+)\\]`, "g");
    for (const t of userTexts) for (const m of t.matchAll(named)) hit = { id: m[2], name: m[1] ?? "" };
    if (!hit) continue;
    const name = hit.id === "auto" ? "تلقائي" : hit.name || "تم الاختيار";
    out.push({ key: k.key, label: k.label, name, change: k.change });
  }
  return out;
}

// ───────── the talk ─────────

/** The talk's rules (the owner's order for «صانع المحتوى», carried here: short, so the person pays less; longer on request). */
export const DESIGNER_TALK_RULES = `أسلوب المحادثة (أمر صاحب المنصة؛ يعلو أي سطر في القالب يقول غير ذلك):
- اختصر: ردّك لا يزيد عن ٣ أسطر قبل الأسئلة؛ لا ترحيب ولا ختام ولا إعادة لما قاله العميل ولا شرح لما لم يُسأل عنه. هدفنا أن يصل لتصميمه بأقل رسائل وأقل تكلفة.
- اجمع كل ما ينقص في دفعة أسئلة واحدة (حتى ٣ أسئلة، لكل سؤال ٢ إلى ٥ خيارات قصيرة جاهزة للضغط). قائمة الخطوط أو معرض الألوان تُعدّ سؤالًا. لا تسأل عمّا استنتجته من كلامه أو مرفقاته، ولا تعد سؤالًا أجاب عنه.
- العميل يختار بالضغط أو بالكتابة بحرية، ويقدر يدمج («الأول مع الثالث»، «نفس الألوان بس الخط الثاني»)، ويغيّر أي قرار في أي لحظة: لا تتمسك بسؤالك، ولا تعترض ولا تكرر تحذيرًا نبّهت عليه مرة؛ نفّذ ما قال.
- «اختر أنت» أو «تلقائي»: قرّر بنفسك وقل قرارك في سطر.
- إن تشعّب الطلب: لخّص ما فهمت في سطرين واسأل «صح؟» بزرّين (نعم، عدّل).
- اختيارات العميل من المعارض تصلك بعلامات في رسالته: [خط:…] معرّف الخط من القائمة (auto = اختر أنت)، [ألوان:…] لوحة من معرض الألوان (auto = اختر أنت). آخر علامة من كل نوع هي المعتمدة؛ لا تعيد سؤالًا حسمته علامة.`;

/** Added when the person asks for the longer talk. */
export const DESIGNER_VERBOSE_RULES = `وضع المحادثة المطوّلة (طلبه العميل الآن): يجوز أن تشرح أسباب اقتراحاتك، وتقترح بدائل مع مقارنة قصيرة، وتسأل أسئلة أعمق (حتى ٥ في الدفعة). لا تحشُ ولا تكرّر.`;

/** How edits are read (the owner: a high ability to understand what the client changes). */
export const DESIGNER_EDIT_RULES = `فهم التعديلات (كل رسالة بعد أول تصميم قد تكون تعديلًا):
١) حدّد بدقة ما الذي يتغير (كلمة، سطر، اسم، تاريخ، الخط، الألوان، مكان عنصر، حجمه، الصورة المرسومة، صورة شخص، المقاس) وأبقِ كل ما لم يُذكر كما هو في السجل.
٢) افهم الإشارات: «العنوان/السطر الأخير/اللي تحت الاسم» على آخر تصميم؛ «أغمق/أفتح/أكبر/أصغر/أوضح» تعديل نسبي على القيمة الحالية؛ «ارجع للأول/للي قبل» القيمة السابقة المحفوظة في «سجل التعديلات»؛ «شيل/احذف» حذف؛ «بدل س بـ ص» استبدال؛ وعدة تعديلات في رسالة واحدة تُنفَّذ كلها.
٣) التعديل على التصميم الواقف لا يحتاج إذنًا جديدًا ولا ملخصًا: املأ "produce" في ردّك نفسه بـ "change": true، و"picture_keep": true إذا ما طلب تغيير الصورة المرسومة، والنصوص كلها في "layers" بعد التعديل؛ ثم قل في سطر واحد ما تغيّر بالضبط («غيّرت: …؛ والباقي كما هو»). وحدّث "record" بالقرار الجديد وسطرًا في «سجل التعديلات» (آخر ٥: ما كان ← ما صار).
٤) تغيير المقاس أو فكرة جديدة كليًا = تصميم جديد ("change": false)؛ اسأل مرة واحدة «أصمّمه من جديد؟» بزرّي نعم ولا، إلا إذا طلبه صراحةً.
٥) إن احتمل الطلب معنيين فسؤال واحد بزرّين، ولا تسأل أكثر من ذلك.
٦) إن عاد العميل من نقطة عدّل فيها رسالة قديمة، فالمحادثة بدأت من هناك: لا تفترض شيئًا من بعدها.`;
