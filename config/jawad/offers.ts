// «عروض الإطلاق» (/jawad-ai/offers) — the three launch offers: a finished result at a riyal price, no subscription. Each is
// ordered on WhatsApp (the owner's number from the credit settings, the message already written with the offer's code) or
// tried in its own section. The page is public: no sign-in.

export interface Offer {
  key: "shop" | "kid" | "exam";
  title: string;
  /** what is paid, in riyals */
  priceSar: number;
  /** beside the price: the bundle, or what the price becomes after the launch */
  priceNote: string;
  bullets: readonly [string, string, string];
  /** the section where the person makes it by themselves */
  href: string;
  /** the WhatsApp message, already written (its code tells the owner which offer) */
  whatsappText: string;
}

export const OFFERS_BASE = "/jawad-ai/offers";

export const OFFERS: readonly Offer[] = [
  {
    key: "shop",
    title: "إعلان متجرك بوجهك وصوتك",
    priceSar: 149,
    priceNote: "ريل واحد · ٣ ريلز بـ ٣٤٩",
    bullets: ["فيديو عمودي بلهجتك، بوجهك الحقيقي أو مقدّم ذكي", "ترجمة عربية وتسليم خلال ٤٨ ساعة", "تعديل واحد مجاني"],
    href: "/jawad-ai/video",
    whatsappText: "السلام عليكم، أبي عرض «إعلان متجرك بوجهك وصوتك» (كود أ)",
  },
  {
    key: "kid",
    title: "لعبة لطفلك باسمه",
    priceSar: 29,
    priceNote: "عرض افتتاحي، بعدها ٤٩",
    bullets: ["لعبة كاملة تنلعب من الجوال برابط", "باسم طفلك وشخصيته المفضلة", "بدون محادثة ولا جمع بيانات، وتشوف كل شي"],
    href: "/jawad-ai/games",
    whatsappText: "السلام عليكم، أبي عرض «لعبة لطفلك باسمه» (كود ب)",
  },
  {
    key: "exam",
    title: "حزمة الاختبار النهائي",
    priceSar: 19,
    priceNote: "للمادة · ٥٩ لخمس مواد",
    bullets: ["ملخص وخريطة ذهنية من ملف المادة", "أسئلة تدريب بالحل", "جاهزة خلال دقائق"],
    href: "/jawad-ai/student",
    whatsappText: "السلام عليكم، أبي عرض «حزمة الاختبار النهائي» (كود ج)",
  },
];
