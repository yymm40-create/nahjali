// «مهارات الموشن» — ten real topics every skill is tried on (the owner's acceptance test: ten pieces a skill), each
// with the words a piece needs: a title, a line, points, a number, a quote, a handle. Shared by the tests and the
// contact sheet.

import type { Beat, BeatKind, Storyboard } from "@/lib/editor/motion-build";

export interface Topic {
  topic: string;
  title: string;
  line: string;
  points: string[];
  value: string;
  label: string;
  note: string;
  quote: string;
  by: string;
  right: { title: string; text: string };
  left: { title: string; text: string };
  words: string[];
  handle: string;
}

export const TOPICS: Topic[] = [
  { topic: "الصدقة", title: "الصدقة تطفئ غضب الرب", line: "وتزيد في الرزق والعمر", points: ["تصدّق في الخفاء", "بكّر بها كل صباح", "داوم ولو بالقليل"], value: "70%", label: "من البركة تأتي بالعطاء", note: "جرّب شهرًا واحدًا", quote: "الصدقة دواء منجح", by: "الإمام علي (ع)", right: { title: "قبل", text: "مال محبوس" }, left: { title: "بعد", text: "مال مبارك" }, words: ["صدقة", "اليوم", "تغيّر", "حياتك"], handle: "@nahjali" },
  { topic: "قلة النوم", title: "لماذا تنام قليلًا وتتعب كثيرًا", line: "النوم أقل من ست ساعات يضعف التركيز", points: ["أطفئ الشاشات مبكرًا", "ثبّت وقت النوم", "خفف القهوة بعد العصر"], value: "6", label: "ساعات هي الحد الأدنى", note: "لمعظم البالغين", quote: "النوم سلطان", by: "مثل شعبي", right: { title: "نوم قليل", text: "عصبية ونسيان" }, left: { title: "نوم كافٍ", text: "صفاء وتركيز" }, words: ["نم", "مبكرًا", "تصحو", "أقوى"], handle: "@sleep.well" },
  { topic: "إطلاق منتج", title: "تطبيق محفظتي صار بين يديك", line: "رتّب مصاريفك في دقيقة", points: ["يسجل كل حركة تلقائيًا", "يحذرك قبل التجاوز", "يقسم الميزانية شهريًا"], value: "1,250", label: "ريال وفّرها المستخدمون شهريًا", note: "في المتوسط", quote: "أول مرة أعرف وين تروح فلوسي", by: "مستخدم من الرياض", right: { title: "بدون التطبيق", text: "تخمين ونسيان" }, left: { title: "مع محفظتي", text: "أرقام واضحة" }, words: ["حمّل", "محفظتي", "الحين"], handle: "@mahfazati" },
  { topic: "مولد النبي", title: "مولد خير البرية", line: "في الثاني عشر من ربيع الأول", points: ["صلّ عليه كثيرًا", "اقرأ من سيرته", "أطعم طعامًا"], value: "571", label: "عام الفيل ولد فيه", note: "في مكة المكرمة", quote: "وإنك لعلى خلق عظيم", by: "القرآن الكريم", right: { title: "قبل البعثة", text: "ظلمة وجهل" }, left: { title: "بعدها", text: "نور وهدى" }, words: ["صلّوا", "على", "محمد", "وآله"], handle: "@nahjali" },
  { topic: "تعلم البرمجة", title: "ابدأ البرمجة من الصفر", line: "بدون شهادة ولا خبرة سابقة", points: ["اختر لغة واحدة", "ابنِ مشروعًا صغيرًا", "شارك شغلك كل أسبوع"], value: "3", label: "أشهر تكفي لأول وظيفة", note: "مع ساعتين يوميًا", quote: "أفضل وقت للبدء كان أمس، والثاني اليوم", by: "حكمة", right: { title: "دورات بلا نهاية", text: "تشاهد ولا تكتب" }, left: { title: "مشروع حقيقي", text: "تكتب وتتعلم" }, words: ["اكتب", "أول", "سطر", "اليوم"], handle: "@code.ar" },
  { topic: "ترشيد الماء", title: "كل قطرة تحسب", line: "استهلاك الفرد عندنا من الأعلى عالميًا", points: ["أغلق الصنبور وقت الفرشاة", "أصلح التسرب فورًا", "اسقِ الزرع فجرًا"], value: "265", label: "لترًا يستهلكها الفرد يوميًا", note: "في بعض مدننا", quote: "وجعلنا من الماء كل شيء حي", by: "القرآن الكريم", right: { title: "صنبور مفتوح", text: "12 لترًا بالدقيقة" }, left: { title: "صنبور مغلق", text: "صفر" }, words: ["أغلق", "الصنبور", "الحين"], handle: "@water.ksa" },
  { topic: "التسويق", title: "لماذا لا يشتري زبونك", line: "ليس السعر، بل الثقة", points: ["أظهر تجارب حقيقية", "ردّ خلال ساعة", "اعرض ضمانًا واضحًا"], value: "92%", label: "يقرؤون التقييمات قبل الشراء", note: "دراسة 2025", quote: "الناس تشتري من الناس", by: "مقولة تسويقية", right: { title: "إعلان صاخب", text: "نقرة بلا شراء" }, left: { title: "ثقة", text: "شراء وتكرار" }, words: ["الثقة", "تبيع", "أكثر"], handle: "@growth.ar" },
  { topic: "الإمام الحسين", title: "درس من كربلاء", line: "الكرامة لا تساوَم", points: ["قل الحق ولو كان مرًّا", "لا تبِع موقفك", "اثبت على المبدأ"], value: "72", label: "رجلًا ثبتوا حتى النهاية", note: "في يوم عاشوراء", quote: "هيهات منا الذلة", by: "الإمام الحسين (ع)", right: { title: "الذل", text: "حياة بلا معنى" }, left: { title: "الكرامة", text: "خلود" }, words: ["هيهات", "منا", "الذلة"], handle: "@nahjali" },
  { topic: "الرياضة", title: "عشر دقائق مشي تكفي", line: "لتبدأ تغييرًا حقيقيًا", points: ["امشِ بعد كل وجبة", "اصعد الدرج", "اضبط منبّه الحركة"], value: "10", label: "دقائق يوميًا تقلل خطر القلب", note: "حسب منظمة الصحة", quote: "العقل السليم في الجسم السليم", by: "مثل", right: { title: "جلوس طويل", text: "ظهر وتعب" }, left: { title: "حركة يومية", text: "طاقة" }, words: ["امشِ", "عشر", "دقائق"], handle: "@move.daily" },
  { topic: "الذكاء الاصطناعي", title: "الذكاء الاصطناعي ما راح يأخذ شغلك", line: "لكن من يستخدمه سيأخذه", points: ["تعلم أداة واحدة", "أتمت مهمة مملة", "راجع نتائجه دائمًا"], value: "40%", label: "من المهام اليومية قابلة للأتمتة", note: "تقدير 2026", quote: "الأداة بيد من يحسن استخدامها", by: "حكمة", right: { title: "يخاف منه", text: "يتأخر" }, left: { title: "يستخدمه", text: "يتقدم" }, words: ["تعلّمه", "قبل", "لا", "يسبقك"], handle: "@ai.arabi" },
];

/** A storyboard of a skill's beats, filled from a topic (every kind the skill uses, in its order). */
export function storyboardFor(style: string, kinds: BeatKind[], t: Topic, extra: Partial<Storyboard> = {}): Storyboard {
  const beats: Beat[] = kinds.map((kind) => {
    switch (kind) {
      case "title":
        return { kind, title: t.title, text: t.line };
      case "statement":
        return { kind, text: t.line };
      case "stat":
        return { kind, value: t.value, label: t.label, text: t.note };
      case "points":
        return { kind, title: t.topic, items: t.points };
      case "steps":
        return { kind, title: t.topic, items: t.points };
      case "compare":
        return { kind, title: t.topic, right: t.right, left: t.left };
      case "quote":
        return { kind, text: t.quote, by: t.by };
      case "kinetic":
        return { kind, words: t.words, hot: Math.min(1, t.words.length - 1) };
      case "outro":
        return { kind, title: t.title.split(" ").slice(0, 3).join(" "), text: "تابعنا للمزيد", handle: t.handle };
    }
  });
  return { style, beats, ...extra };
}
