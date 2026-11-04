// «صانع المحتوى» — what a press in the questions becomes as a message: the answers as bullets, a pick in a gallery
// carrying a mark ([قالب:id] / [ستايل:id] / [موشن:id] / [مزاج:id] / [ألوان:id] / [كاروسيل:id] / [خط:id] / [حركة:id]) that the server reads and the page hides. Pure (server and browser).

export interface Pick {
  id: string;
  name: string;
}

const MARK = /\s*\[(?:قالب|ستايل|موشن|مزاج|ألوان|كاروسيل|خط|حركة):[a-z0-9-]+\]/g;

/** The text as the person reads it (the marks are for the server). */
export const stripMarks = (text: string) => text.replace(MARK, "");

/** A template pick as a line of a message (id "none" = the person chose no ready template). */
export const templateLine = (p: Pick) => (p.id === "none" ? "• القالب: بدون قالب جاهز، صمّم لي حسب الموضوع [قالب:none]" : `• القالب: «${p.name}» [قالب:${p.id}]`);

/** A cartoon-style pick as a line of a message (id "none" = no cartoon style). */
export const styleLine = (p: Pick) => (p.id === "none" ? "• الستايل الكرتوني للصور: بدون ستايل كرتوني [ستايل:none]" : `• الستايل الكرتوني للصور: «${p.name}» [ستايل:${p.id}]`);

/** A motion-skill pick («مهارات الموشن» of حيدرا ماكس) as a line of a message (id "none" = he chooses). */
export const motionLine = (p: Pick) => (p.id === "none" ? "• مهارة الموشن: اختر لي الأنسب [موشن:none]" : `• مهارة الموشن: «${p.name}» [موشن:${p.id}]`);

/** A mood pick (the feeling of the motion piece) as a line of a message (id "none" = he chooses). */
export const moodLine = (p: Pick) => (p.id === "none" ? "• المزاج: اختر لي الأنسب للموضوع [مزاج:none]" : `• مزاج الموشن: «${p.name}» [مزاج:${p.id}]`);

/** A colour pick (one of the 100 four-colour palettes) as a line of a message (id "none" = he chooses the colours). */
export const paletteLine = (p: Pick) => (p.id === "none" ? "• الألوان: اختر لي الأنسب للموضوع [ألوان:none]" : `• الألوان: «${p.name}» [ألوان:${p.id}]`);

/** A pick in the table of carousel styles as a line of a message. */
export const carouselLine = (p: Pick) => `• ستايل الكاروسيل: «${p.name}» [كاروسيل:${p.id}]`;

/** The person does not know which to pick: «محمد باقر» helps them choose. */
export const CAROUSEL_HELP_LINE = "• ستايل الكاروسيل: ما أعرف أختار، ساعدني [كاروسيل:help]";

/** The person wants something that is not in the table, in their own words. */
export const carouselOwnLine = (what: string) => `• ستايل الكاروسيل: أبي شيئًا غير الموجود: ${what.trim()} [كاروسيل:own]`;

/** A pick in the list of fonts as a line of a message. */
export const fontLine = (p: Pick) => `• الخط: «${p.name}» [خط:${p.id}]`;

/** The person keeps the font that comes with the chosen style. */
export const fontStyleLine = (name: string) => `• الخط: خط الستايل الجاهز «${name}» [خط:style]`;

/** The person lets «محمد باقر» pick the font. */
export const FONT_AUTO_LINE = "• الخط: اختر لي الأنسب للستايل والموضوع [خط:auto]";

/** A pick in the table of motion-carousel styles as a line of a message. */
export const motionCarouselLine = (p: Pick) => `• ستايل الحركة: «${p.name}» [حركة:${p.id}]`;

/** The person does not know which motion style to pick: «محمد باقر» helps them choose. */
export const MOTION_CAROUSEL_HELP_LINE = "• ستايل الحركة: ما أعرف أختار، ساعدني [حركة:help]";

/** The person builds the motion style from zero with «محمد باقر», in their own words. */
export const motionCarouselOwnLine = (what: string) => `• ستايل الحركة: أبنيه من الصفر معك: ${what.trim()} [حركة:own]`;

/** An answer of the buttons: a line per question. */
export const answerLine = (label: string, answers: string[]) => `• ${label}: ${answers.join("، ")}`;

/** What is sent when the person lets him decide what they left unanswered. */
export const DELEGATE_LINE = "• ما لم أحدده أعلاه: اختر أنت الأنسب لهدفي وجمهوري (تلقائي)، واذكر اختياراتك.";
