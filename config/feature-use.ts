// «استخدام المزايا» (the owner's /admin/use): which features of «الاستوديو الإبداعي» and «حيدرة كت» people really use,
// and where they stop. Each counted feature with the name the owner reads, the two funnels, and the check of what a page
// sends (src/app/api/feature-use). Nothing typed by the person is ever counted: the account, the feature, how many times
// a day. Pure (the pages, the server and the tests share it).

export type UseSection = "studio" | "editor";

export const USE_SECTIONS: { id: UseSection; label: string }[] = [
  { id: "studio", label: "🎨 الاستوديو الإبداعي" },
  { id: "editor", label: "🎬 حيدرة كت" },
];

/** Every feature counted, by section, in the order the owner reads them. An id never changes once it is counted. */
export const FEATURES = [
  // «الاستوديو الإبداعي» (/jawad-ai/images · video · audio)
  { id: "studio.open", section: "studio", label: "فتح الاستوديو" },
  { id: "studio.kind.image", section: "studio", label: "اختيار «صورة»" },
  { id: "studio.kind.video", section: "studio", label: "اختيار «فيديو»" },
  { id: "studio.kind.audio", section: "studio", label: "اختيار «صوت»" },
  { id: "studio.generator", section: "studio", label: "تغيير المولّد" },
  { id: "studio.style", section: "studio", label: "اختيار ستايل" },
  { id: "studio.ref_add", section: "studio", label: "إضافة مرجع" },
  { id: "studio.prompt", section: "studio", label: "كتابة برومبت" },
  { id: "studio.prompt_preset", section: "studio", label: "شكل جاهز بضغطة (تحت البرومبت)" },
  { id: "studio.prompt_speak", section: "studio", label: "«تكلّم بدل الكتابة»" },
  { id: "studio.voice_tag", section: "studio", label: "وسوم الصوت (المشاعر والأصوات)" },
  { id: "studio.director_boost", section: "studio", label: "«طوّر» (المخرج الخارق)" },
  { id: "studio.extra_prompt", section: "studio", label: "برومبت ثاني وثالث" },
  { id: "studio.generate", section: "studio", label: "ضغط «توليد»" },
  { id: "studio.job_ok", section: "studio", label: "توليد نجح" },
  { id: "studio.download", section: "studio", label: "تنزيل النتيجة" },
  { id: "studio.use_as_ref", section: "studio", label: "النتيجة «كمرجع»" },
  { id: "studio.reuse", section: "studio", label: "«استخدم الإعدادات»" },
  { id: "studio.share_link", section: "studio", label: "«رابط مؤقت» للمشاركة" },
  { id: "studio.share_permanent", section: "studio", label: "«رابط دائم» لعمل (انشر وشارك)" },
  { id: "studio.gallery_publish", section: "studio", label: "«انشر في المعرض» (معرض الناس)" },
  { id: "studio.gallery_open", section: "studio", label: "فتح «معرض الناس»" },
  { id: "studio.gallery_try", section: "studio", label: "«جرّبه» من معرض الناس" },
  { id: "studio.variation", section: "studio", label: "«نسخة ثانية»" },
  { id: "studio.smart_edit", section: "studio", label: "«التعديل الذكي»" },
  { id: "studio.sound_on_video", section: "studio", label: "«شاهد مع الفيديو» (الصوت على الفيديو)" },
  { id: "studio.compose_person", section: "studio", label: "«ركّب الشخص» على الصورة" },
  { id: "studio.claude_draw", section: "studio", label: "رسم بـ«حيدرا ماكس» في الصور" },
  { id: "studio.assistant", section: "studio", label: "فتح «جواد» (المساعد)" },
  { id: "studio.director_chat", section: "studio", label: "فتح «جواد المخرج»" },

  // «حيدرة كت» (/jawad-ai/editor)
  { id: "editor.open", section: "editor", label: "فتح مشروع في حيدرة كت" },
  { id: "editor.clip_add", section: "editor", label: "إضافة مقطع للتايملاين" },
  { id: "editor.edit", section: "editor", label: "تعديل بيده (قص، سحب، إعدادات)" },
  { id: "editor.tab.basic", section: "editor", label: "قسم «تعديل» (الأساسي)" },
  { id: "editor.tab.crop", section: "editor", label: "قسم «القص»" },
  { id: "editor.tab.fx", section: "editor", label: "قسم «مؤثرات»" },
  { id: "editor.tab.motion", section: "editor", label: "قسم «حركة» (كي فريم)" },
  { id: "editor.tab.opacity", section: "editor", label: "قسم «شفافية»" },
  { id: "editor.tab.anim", section: "editor", label: "قسم «دخول/خروج»" },
  { id: "editor.tab.color", section: "editor", label: "قسم «ألوان» / غرفة التلوين" },
  { id: "editor.tab.backdrop", section: "editor", label: "قسم «الخلفية»" },
  { id: "editor.tab.sound", section: "editor", label: "قسم «الصوت»" },
  { id: "editor.tab.transition", section: "editor", label: "قسم «انتقال»" },
  { id: "editor.text", section: "editor", label: "إضافة نص" },
  { id: "editor.captions", section: "editor", label: "فتح «الكابشن»" },
  { id: "editor.mask", section: "editor", label: "الماسك (شكل أو ماسك ذكي)" },
  { id: "editor.key", section: "editor", label: "الكي (كروما / لوما)" },
  { id: "editor.beat", section: "editor", label: "علامات الإيقاع" },
  { id: "editor.sync", section: "editor", label: "«زامن الصوت»" },
  { id: "editor.motion_track", section: "editor", label: "«مسار الموشن» (عنصر موشن)" },
  { id: "editor.motion_lab", section: "editor", label: "«مختبر الموشن»" },
  { id: "editor.depth", section: "editor", label: "«موشن العمق» (ورا الشخص / تتبّع الوجه)" },
  { id: "editor.motion_styles", section: "editor", label: "«أساليب الموشن» (اختر بالصورة)" },
  { id: "editor.talk_reel", section: "editor", label: "موشن على الكلام (ريل متكلّم)" },
  { id: "editor.recipe.tight-cut", section: "editor", label: "أسلوب جاهز: «قص السكتات (ريلز)»" },
  { id: "editor.recipe.jump-zoom", section: "editor", label: "أسلوب جاهز: «جمب كت بزوم»" },
  { id: "editor.recipe.reel-captions", section: "editor", label: "أسلوب جاهز: «كابشن ريلز»" },
  { id: "editor.recipe.hook", section: "editor", label: "أسلوب جاهز: «هوك افتتاحي»" },
  { id: "editor.recipe.beat-montage", section: "editor", label: "أسلوب جاهز: «مونتاج على الإيقاع»" },
  { id: "editor.recipe.podcast", section: "editor", label: "أسلوب جاهز: «مقطع بودكاست»" },
  { id: "editor.recipe.calm", section: "editor", label: "أسلوب جاهز: «شرح هادي»" },
  { id: "editor.recipe", section: "editor", label: "أسلوب جاهز آخر" },
  { id: "editor.upscale", section: "editor", label: "«رفع الدقة»" },
  { id: "editor.speed_ramp", section: "editor", label: "«منحنى السرعة» (منحنى جاهز أو تعديل نقاطه)" },
  { id: "editor.caption_translate", section: "editor", label: "«ترجم الكابشن» (مسار ترجمة جديد)" },
  { id: "editor.export_preset", section: "editor", label: "«مقاس جاهز للمنصة» في نافذة التصدير" },
  { id: "editor.haidara_msg", section: "editor", label: "رسالة لـ«حيدرا ماكس»" },
  { id: "editor.haidara_talk", section: "editor", label: "محادثة صوتية مع «حيدرا ماكس»" },
  { id: "editor.export.video", section: "editor", label: "تصدير: فيديو مع الصوت" },
  { id: "editor.export.alpha", section: "editor", label: "تصدير: خلفية شفافة" },
  { id: "editor.export.mute", section: "editor", label: "تصدير: بدون صوت" },
  { id: "editor.export.audio", section: "editor", label: "تصدير: الصوت بروحه" },
  { id: "editor.export.srt", section: "editor", label: "تصدير: الكابشن SRT" },
  { id: "editor.export.frame", section: "editor", label: "تصدير: الفريم صورة" },
] as const satisfies readonly { id: string; section: UseSection; label: string }[];

export type FeatureId = (typeof FEATURES)[number]["id"];

const BY_ID = new Map<string, (typeof FEATURES)[number]>(FEATURES.map((f) => [f.id, f]));
export const isFeatureId = (id: unknown): id is FeatureId => typeof id === "string" && BY_ID.has(id);
export const featureOf = (id: string) => BY_ID.get(id);

/** «أساليب جاهزة» in «حيدرة كت»: each recipe its own feature (one added later is counted under «أسلوب جاهز آخر»). */
export const recipeFeature = (recipeId: string): FeatureId => {
  const id = `editor.recipe.${recipeId}`;
  return isFeatureId(id) ? id : "editor.recipe";
};

/** Where people stop: each step counts the people who did any of its features in the period. */
export const FUNNELS: Record<UseSection, { label: string; any: FeatureId[] }[]> = {
  studio: [
    { label: "فتحوا الاستوديو", any: ["studio.open"] },
    { label: "كتبوا برومبت", any: ["studio.prompt"] },
    { label: "ضغطوا «توليد»", any: ["studio.generate"] },
    { label: "نجح توليدهم", any: ["studio.job_ok"] },
    { label: "نزّلوا النتيجة أو استخدموها", any: ["studio.download", "studio.use_as_ref", "studio.share_link", "studio.share_permanent", "studio.gallery_publish", "studio.variation", "studio.smart_edit", "studio.compose_person"] },
  ],
  editor: [
    { label: "فتحوا حيدرة كت", any: ["editor.open"] },
    { label: "أضافوا مقطع", any: ["editor.clip_add"] },
    { label: "عدّلوا بأيديهم", any: ["editor.edit"] },
    { label: "سألوا «حيدرا ماكس»", any: ["editor.haidara_msg", "editor.haidara_talk"] },
    { label: "صدّروا", any: FEATURES.flatMap((f) => (f.id.startsWith("editor.export.") ? [f.id] : [])) },
  ],
};

/** The most one feature may add in one batch from a page (a page sends every few seconds). */
export const MAX_PER_BATCH = 50;

/**
 * What a page sent (`{ uses: { [featureId]: count } }`), kept to the features of the list with a whole count of 1 to
 * MAX_PER_BATCH; an unknown id is dropped. Null when nothing counted is left.
 */
export function cleanUses(raw: unknown): Partial<Record<FeatureId, number>> | null {
  const uses = raw && typeof raw === "object" ? (raw as { uses?: unknown }).uses : null;
  if (!uses || typeof uses !== "object" || Array.isArray(uses)) return null;
  const out: Partial<Record<FeatureId, number>> = {};
  for (const [id, n] of Object.entries(uses)) {
    if (!isFeatureId(id) || typeof n !== "number" || !Number.isFinite(n) || n < 1) continue;
    out[id] = Math.min(MAX_PER_BATCH, Math.floor(n));
  }
  return Object.keys(out).length ? out : null;
}

/** The day a use is counted on (Saudi time), as YYYY-MM-DD. */
export function dayOf(now = Date.now()): string {
  return new Date(now + 3 * 3600_000).toISOString().slice(0, 10);
}
