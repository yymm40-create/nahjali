// «صانع المحتوى» — what a press in the questions becomes as a message: the answers as bullets, a pick in a gallery
// carrying a mark ([قالب:id] / [ستايل:id] / [موشن:id] / [مزاج:id]) that the server reads and the page hides. Pure (server and browser).

export interface Pick {
  id: string;
  name: string;
}

const MARK = /\s*\[(?:قالب|ستايل|موشن|مزاج):[a-z0-9-]+\]/g;

/** The text as the person reads it (the marks are for the server). */
export const stripMarks = (text: string) => text.replace(MARK, "");

/** A template pick as a line of a message (id "none" = the person chose no ready template). */
export const templateLine = (p: Pick) => (p.id === "none" ? "• القالب: بدون قالب جاهز، صمّم لي حسب الموضوع [قالب:none]" : `• القالب: «${p.name}» [قالب:${p.id}]`);

/** A cartoon-style pick as a line of a message (id "none" = no cartoon style). */
export const styleLine = (p: Pick) => (p.id === "none" ? "• الستايل الكرتوني للصور: بدون ستايل كرتوني [ستايل:none]" : `• الستايل الكرتوني للصور: «${p.name}» [ستايل:${p.id}]`);

/** A motion-skill pick («مهارات الموشن» of حيدرة) as a line of a message (id "none" = he chooses). */
export const motionLine = (p: Pick) => (p.id === "none" ? "• مهارة الموشن: اختر لي الأنسب [موشن:none]" : `• مهارة الموشن: «${p.name}» [موشن:${p.id}]`);

/** A mood pick (the feeling of the motion piece) as a line of a message (id "none" = he chooses). */
export const moodLine = (p: Pick) => (p.id === "none" ? "• المزاج: اختر لي الأنسب للموضوع [مزاج:none]" : `• مزاج الموشن: «${p.name}» [مزاج:${p.id}]`);

/** An answer of the buttons: a line per question. */
export const answerLine = (label: string, answers: string[]) => `• ${label}: ${answers.join("، ")}`;

/** What is sent when the person lets him decide what they left unanswered. */
export const DELEGATE_LINE = "• ما لم أحدده أعلاه: اختر أنت الأنسب لهدفي وجمهوري (تلقائي)، واذكر اختياراتك.";
