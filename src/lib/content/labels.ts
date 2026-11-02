// «صانع المحتوى» — the words of the two fixed questions before a carousel, shared by the server (lib/content/maker.ts
// reads the presses) and the page (the start form sends them). Pure, and small enough for the browser.

/** Who makes the slides: the person picks (the owner's order: no default). */
export const MAKER_LABEL = "من يصمم الشرائح؟";
export const MAKER_CODE = "حيدرا ماكس (كتابة عربية دقيقة بالكود)";
export const MAKER_GPT = "GPT Image 2 (رسم كامل بالذكاء الاصطناعي)";
export const MAKER_MIX = "GPT Image 2 للصور + حيدرا ماكس للكتابة";

/** A style with realistic pictures: the person adds their own, or it is made from zero. */
export const PHOTOS_LABEL = "هذا الستايل فيه صور واقعية: تضيف صورك أو نسويها لك؟";
export const PHOTOS_MINE = "أضيف صوري";
export const PHOTOS_MAKE = "سوّوها لي من الصفر";
