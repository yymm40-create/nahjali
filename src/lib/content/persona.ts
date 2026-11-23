// «محمد باقر» — the persona's text: the owner's edit (content_kv) or the default template (config/content.ts), and
// the whole system text of a conversation (persona + the platform's rules + the tools + the examples of the turn +
// the project's record). Server only.

import { HUSSEINI_MOURNING_FEED } from "@config/husseini-mourning";
import { PSYCH_TRICKS_RULES } from "@config/content-psych";
import { createAdminClient } from "@/lib/supabase/admin";
import { BAQIR_PERSONA, CONTENT_KV, CONTENT_PLATFORM_RULES, CONTENT_TOOLS } from "@config/content";
import { CAROUSEL_TEMPLATES, designSystem, findTemplate, structureName } from "@config/content-templates";
import { CAROUSEL_GPT_CRAFT, CAROUSEL_STYLES, carouselStyleBlock, findCarouselStyle } from "@config/content-carousel-styles";
import { CONTENT_FONTS, findContentFont, FONT_GROUPS } from "@config/content-fonts";
import { findMotionCarouselStyle, routeById } from "@config/content-motion-carousel";
import { findPath, PATH_EDIT_RULES, PATH_TALK_RULES, PATH_VERBOSE_RULES } from "@config/content-paths";
import { FILM_STYLES, findStyle } from "@config/film-styles";
import { findPalette, lightness } from "@config/content-palettes";
import { MOODS, MOTION_STYLES, moodOf, motionStyleOf } from "@/lib/editor/motion-styles";
import { MOTION_ICONS } from "@/lib/editor/motion-icons";
import { SCENE_IDS } from "@/lib/editor/motion-styles";

const db = () => createAdminClient();
const MAX = 80_000;

/** The persona now (the owner's edit when there is one), and whether it is an edit. */
export async function getPersona(): Promise<{ text: string; edited: boolean }> {
  const { data } = await db().from("content_kv").select("value").eq("key", CONTENT_KV.persona).maybeSingle();
  const v = String(data?.value ?? "").trim();
  return v ? { text: v, edited: true } : { text: BAQIR_PERSONA, edited: false };
}

export async function savePersona(text: string) {
  const t = text.trim();
  if (t.length < 200) throw new Error("القالب قصير جدًا.");
  if (t.length > MAX) throw new Error(`القالب أطول من ${MAX} حرف.`);
  const { error } = await db().from("content_kv").upsert({ key: CONTENT_KV.persona, value: t, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Back to the default template. */
export async function resetPersona() {
  await db().from("content_kv").delete().eq("key", CONTENT_KV.persona);
}

/**
 * The whole system text: the persona, what the platform requires, how its tools are reached, then (per turn) the
 * extra blocks (the catalogues, what the person chose, the closest examples) and the project's record.
 */
export function systemText(persona: string, parts: string[] = [], record = "") {
  return [persona, CONTENT_PLATFORM_RULES, CONTENT_TOOLS, PSYCH_TRICKS_RULES, HUSSEINI_MOURNING_FEED, CAROUSEL_GPT_CRAFT, ...parts, recordText(record)].filter(Boolean).join("\n\n");
}

/**
 * Whether the long tables (styles, fonts, templates, cartoon styles: ~19k tokens) can still be needed: until the look of
 * a carousel is picked (he recommends from them and names their ids), when he is left to choose the font, and whenever
 * the message speaks of a style, a font or a template. A motion-graphics or reel path never uses them. Once the look is
 * picked the site gives him the full details of the pick (chosenBlock), so the tables are read for nothing.
 */
export function needsCatalog(ids: Chosen, said: string): boolean {
  if (/(?:^|[\s«"(،])(?:ال|بال|لل|وال)?(?:ستايل|ستايلات|خط|خطوط|قالب|قوالب|كرتوني|كرتون)(?:[\s»".،؟!):]|$)|style|font|template/i.test(said)) return true;
  if (ids.path === "motion-graphics" || ids.path === "reel-graphics") return false;
  const lookPicked = !!(ids.carousel && findCarouselStyle(ids.carousel)) || ids.carousel === "own" || (!!ids.template && ids.template !== "none");
  const fontPicked = !!ids.font && ids.font !== "auto";
  return !(lookPicked && fontPicked);
}

const recordText = (record: string) => (record ? `سجل المشروع الحالي (كما حفظته آخر مرة؛ حدّثه في "record" عند أي تغيير):\n${record}` : "");

/** What changes from one message to the next (examples, chosen blocks, the record): read with this turn, not in the system. */
export function turnText(parts: string[] = [], record = "") {
  return [...parts, recordText(record)].filter(Boolean).join("\n\n");
}

/** The two galleries the person can pick from, one line each (always the same text, so it caches). */
export function catalogBlock(): string {
  const tpl = CAROUSEL_TEMPLATES.map((t) => `- ${t.id} — ${t.name} (${t.group}) — ${t.description} يناسب: ${t.bestFor}. بنيات: ${t.structures.map(structureName).join("، ")}. حتى ${t.words} كلمة في الشريحة.`).join("\n");
  const sty = FILM_STYLES.map((x) => `- ${x.id} — ${x.name} (${x.group} · ${x.school}) — ${x.feel}`).join("\n");
  const car = CAROUSEL_STYLES.map((s) => `- ${s.id} — ${s.n}) ${s.name} (${s.niche})${s.winner ? " ★الأقوى في مجاله" : ""}${s.photoIdea ? " [صور واقعية]" : ""}${s.font ? ` [خطه الجاهز: ${s.font}]` : ""} — ${s.description} يناسب: ${s.bestFor}.`).join("\n");
  const fonts = CONTENT_FONTS.map((f) => `- ${f.id} — ${f.name} (${f.group})${f.top ? " ★" : ""} — ${f.feel} يناسب: ${f.bestFor}.`).join("\n");
  return `جدول ستايلات الكاروسيل (${CAROUSEL_STYLES.length} ستايلًا مصنفة حسب المجال، بصورتين لكل واحد: غلاف وشريحة؛ جدول kind="carousels"؛ هو طريقة اختيار شكل الكاروسيل):\n${car}\n\nقائمة الخطوط العربية (${CONTENT_FONTS.length} خطًا في ${FONT_GROUPS.length} أنواع؛ قائمة kind="fonts"؛ تُسأل بعد الستايل: الموقع يعرضها بنفسه، وإذا رشّحت خطوطًا فضع معرّفاتها في "options"):\n${fonts}\n\nقوالب الكاروسيل التي يعرضها الموقع للعميل (معرض kind="templates"؛ يختار واحدًا أو لا يختار):\n${tpl}\n\nخريطة الستايلات (${FILM_STYLES.length} ستايلًا في ١٤ عائلة، كل واحد تحت شركته أو مدرسته) لرسوم الصور (معرض kind="styles"؛ يطبّق الموقع نص الستايل حرفيًا على الرسوم والشخصيات والمشاهد المرسومة فقط، لا على تخطيط الكتابة):\n${sty}`;
}

/**
 * What حيدرا ماكس can do in motion graphics, one line each (the same text every time, so it caches): the skills the client
 * can choose from (kind="motion"), the feelings (kind="moods"), and the drawing tools he arranges backgrounds with.
 */
export function motionCatalogBlock(): string {
  const skills = MOTION_STYLES.filter((x) => !x.talk).map((x) => `- ${x.id} — ${x.ar} ${x.icon} — ${x.hint}. لقطاته: ${x.beats.join("، ")}.`).join("\n");
  const moods = MOODS.map((m) => `- ${m.id} — ${m.ar} ${m.icon} — ${m.hint}.`).join("\n");
  return `مهارات الموشن التي يعرضها الموقع للعميل (معرض kind="motion"؛ يختار واحدة أو يترك الاختيار لحيدرا ماكس):\n${skills}\n\nمشاعر الموشن (معرض kind="moods"؛ تغيّر الإيقاع والدخول والمشهد المرسوم خلف الكلام):\n${moods}\n\nأدوات الرسم عند حيدرا ماكس: حيدرا ماكس يرتب الخلفيات بنفسه بأدوات «حيدرة كت» ولا يطلب خلفية من أي مولّد صور: ${SCENE_IDS.filter((x) => x !== "none").length} مشهدًا مرسومًا (${SCENE_IDS.filter((x) => x !== "none").join("، ")})، ومكتبة من ${MOTION_ICONS.length} أيقونة مرسومة، وأشكال يرسمها بنفسه، وتوقيت يتبع طول التعليق الصوتي. لا تطلب من جواد صورًا لخلفيات الموشن، ولا تطلب «GPT Image 2» للموشن إلا إذا طلب العميل صورة صراحةً.`;
}

const TEMPLATE_MARK = /\[قالب:([a-z0-9-]+)\]/g;
const STYLE_MARK = /\[ستايل:([a-z0-9-]+)\]/g;
const MOTION_MARK = /\[موشن:([a-z0-9-]+)\]/g;
const MOOD_MARK = /\[مزاج:([a-z0-9-]+)\]/g;
const PALETTE_MARK = /\[ألوان:([a-z0-9-]+)\]/g;
const CAROUSEL_MARK = /\[كاروسيل:([a-z0-9-]+)\]/g;
const FONT_MARK = /\[خط:([a-z0-9-]+)\]/g;
const MOVE_MARK = /\[حركة:([a-z0-9-]+)\]/g;
const PATH_MARK = /\[مسار:([a-z0-9-]+)\]/g;

/** What the person picked in the galleries: the last mark of each kind in their messages ("none" = they chose neither). */
export interface Chosen {
  template: string | null;
  style: string | null;
  /** the motion skill and the mood of the piece ("none" = حيدرا ماكس chooses) */
  motion?: string | null;
  mood?: string | null;
  /** one of the 100 four-colour palettes ("none" = he chooses the colours) */
  palette?: string | null;
  /** a style of the table of 104 ("help" = help me choose, "own" = something not in the table) */
  carousel?: string | null;
  /** a font of the list of 50 ("style" = the style's ready font, "auto" = he picks) */
  font?: string | null;
  /** a motion-carousel style of the ten ("help" = help me choose, "own" = built from zero with him) */
  move?: string | null;
  /** the path of the four the person opened: carousel, motion-carousel, motion-graphics, reel-graphics */
  path?: string | null;
}
export function chosenIds(userTexts: string[]): Required<Chosen> {
  let template: string | null = null;
  let style: string | null = null;
  let motion: string | null = null;
  let mood: string | null = null;
  let palette: string | null = null;
  let carousel: string | null = null;
  let font: string | null = null;
  let move: string | null = null;
  let path: string | null = null;
  for (const t of userTexts) {
    for (const m of t.matchAll(PATH_MARK)) path = m[1];
    for (const m of t.matchAll(MOVE_MARK)) move = m[1];
    for (const m of t.matchAll(TEMPLATE_MARK)) template = m[1];
    for (const m of t.matchAll(STYLE_MARK)) style = m[1];
    for (const m of t.matchAll(MOTION_MARK)) motion = m[1];
    for (const m of t.matchAll(MOOD_MARK)) mood = m[1];
    for (const m of t.matchAll(PALETTE_MARK)) palette = m[1];
    for (const m of t.matchAll(CAROUSEL_MARK)) carousel = m[1];
    for (const m of t.matchAll(FONT_MARK)) font = m[1];
  }
  return { template, style, motion, mood, palette, carousel, font, move, path };
}

/**
 * The talk's rules (short by default, longer when the person asks), how edits are read, and the steps of the path the person is on.
 * «جرافكس على ريل» also gets the skills for a talking video (the catalogue of motion on the speaker).
 */
/**
 * The cover's WORDS (slide 1), from the research on the best carousel covers (23 Nov 2026): the design rules go to
 * «حيدرا ماكس» with the slide (produce.ts COVER_RULE); what is written on it is his.
 */
export const COVER_COPY = `نص الغلاف (الشريحة ١) هو الهوك، فاكتبه بهذه القواعد:
- عنوان واحد قصير: ٢ إلى ٦ كلمات، ولا يزيد على ٨، ومعه عند الحاجة سطر صغير فوقه (تصنيف أو مناسبة) أو تحته.
- محدد لا عام: لمن هو، أو رقم، أو الفائدة، أو سؤال يسأله الجمهور فعلًا، أو رقم صادم واحد، أو عبارة تعاكس الشائع. «نصائح عن كذا» ضعيف.
- يفتح فضولًا يعرف القارئ أن جوابه داخل الكاروسيل دون أن يخمّنه، ولا يعد بشيء لا يقدّمه الكاروسيل.
- كلمة واحدة فيه هي المفتاح (تُبرز في التصميم).
- لا طُعم تفاعل («علّق نعم»، «منشن صديقك»، «شارك لتؤجر»)، ولا مبالغات رخيصة («لن تصدق»).
- في المحتوى الديني والعزاء: وقار وهدوء، الاسم أو المناسبة هي العنوان الضخم، بلا مبالغة.
- الشريحة ٢ هوك ثانٍ يعمل وحده: إنستقرام يعيد عرض الكاروسيل لمن لم يسحب بادئًا منها.`;

export function pathBlock(ids: Chosen, verbose: boolean): string {
  const p = findPath(ids.path);
  const talk = p?.id === "reel-graphics" ? `مهارات الموشن على المتكلم (للعرض كخيارات):\n${MOTION_STYLES.filter((x) => x.talk).map((x) => `- ${x.id} — ${x.ar} ${x.icon} — ${x.hint}.`).join("\n")}` : "";
  return [PATH_TALK_RULES, verbose ? PATH_VERBOSE_RULES : "", p ? `${p.flow}${talk ? `\n\n${talk}` : ""}` : "", p?.id === "carousel" || p?.id === "motion-carousel" ? COVER_COPY : "", PATH_EDIT_RULES].filter(Boolean).join("\n\n");
}

/** The full details of what was picked (the design system to copy into every slide, the style's meaning). */
export function chosenBlock(ids: Chosen): string {
  const out: string[] = [];
  const car = ids.carousel ? findCarouselStyle(ids.carousel) : null;
  if (car) {
    out.push(
      `ستايل الكاروسيل الذي اختاره العميل: ${car.n}) ${car.name} (${car.id}) من مجال «${car.niche}». ${car.description}\nضع معرّفه في "carousel_id". هوامشه وتخطيطه محسومة فيه. ألوانه هي الافتراضية، والموقع يسأل العميل بعد الستايل بنفسه: يبقي ألوان الستايل أو يغيّرها من معرض الألوان (١٠٠ لوحة)؛ لا تسأله أنت عن الألوان. والخط يسأله الموقع بعدها. لا تعرض القوالب إلا إذا طلب. حتى ${car.words} كلمة في الشريحة.\nوصف الستايل كما يضيفه الموقع حرفيًا إلى كل شريحة (للعلم، لا تنسخه في "prompt"؛ اكتب فيه ما يخص الشريحة فقط):\n${carouselStyleBlock(car)}${
        car.photoIdea
          ? `\nهذا الستايل فيه صور واقعية، فاسأله في ردّك التالي سؤالًا kind="choice" نصّه «هذا الستايل فيه صور واقعية: تضيف صورك أو نسويها لك؟» بخيارين حرفيًا: «أضيف صوري» و«سوّوها لي من الصفر»، وأعطه الفكرة لما يضيفه: ${car.photoIdea} وإذا اختار صوره فاطلب منه إرفاقها بزر 📎 وضع معرّفاتها في "refs"، وقل له أي صورة تذهب لأي شريحة (مثلًا: في الغلاف بوستر بصورتك هكذا).`
          : ""
      }`,
    );
  } else if (ids.carousel === "help") {
    out.push('العميل لا يعرف أي ستايل يختار، فساعده: اسأله عمّا لم تعرفه بعد فقط (الهدف، والجمهور، وهل عنده صور)، ثم رشّح له ٣ ستايلات من الجدول تناسبه مع سبب من سطر واحد لكل ستايل، واعرضها بسؤال kind="carousels" و"options" فيها معرّفات الثلاثة، فتظهر له أولًا ويقدر يفتح الجدول كله.');
  } else if (ids.carousel === "own") {
    out.push('العميل يريد شكلًا غير الموجود في الجدول، بكلامه هو: نفّذ وصفه كما هو، واترك "carousel_id" فارغًا. اكتب في "prompt" كل شريحة نظامًا واحدًا كاملًا (الألوان برموزها، والخط، والتخطيط)، ولا تسأله عن الهوامش. وإذا كان وصفه فيه صور واقعية فاسأله: يضيف صوره أو تصنعها له.');
  }
  const fontId = ids.font === "style" ? (car?.font ?? "auto") : ids.font;
  const font = fontId ? findContentFont(fontId) : null;
  if (font) out.push(`الخط الذي اختاره العميل: ${font.name} (${font.id}) من نوع «${font.group}». ضع معرّفه في "font_id". الموقع يضيف وصفه إلى كل شريحة، وحيدرا ماكس يكتب بملفه الحقيقي؛ لا تسأل عن الخط مرة ثانية.`);
  else if (fontId === "auto") out.push(`العميل ترك الخط لك: اختر من قائمة الخطوط الأنسب للستايل والموضوع${car?.font ? ` (للستايل خط جاهز: ${car.font})` : ""}، وضع معرّفه في "font_id"، واذكر له اسمه في ردّك.`);
  const mv = ids.move ? findMotionCarouselStyle(ids.move) : null;
  if (mv) out.push(`ستايل الحركة الذي اختاره العميل للموشن كاروسيل: ${mv.n}) ${mv.name} (${mv.id}) — ${mv.feel} كل شريحة نحو ${mv.seconds} ثوانٍ. الموقع يضيف طريقته لكل شريحة؛ اكتب في "prompt" ما يخص الشريحة (ما يدخل وبأي ترتيب، وما يبقى ثابتًا في آخرها). أرخص طريقة صنع تناسبه: ${routeById(mv.route)!.label}.`);
  else if (ids.move === "help") out.push('العميل لا يعرف أي ستايل حركة يختار، فساعده: رشّح له ٣ من ستايلات الحركة الجاهزة تناسب موضوعه مع سبب من سطر لكل واحد، وأرخصها أولًا، واعرضها بسؤال kind="motioncarousels" و"options" فيها معرّفات الثلاثة.');
  else if (ids.move === "own") out.push("العميل يبني ستايل الحركة من الصفر معك بكلامه: افهم منه كيف يدخل الكلام، وماذا يتحرك، والصوت، والخلفية، واقترح عليه ما ينقصه، ثم اكتب ذلك في \"prompt\" كل شريحة. الموقع يسلّم وصفه لحيدرا ماكس مع كل شريحة.");
  const t = ids.template ? findTemplate(ids.template) : null;
  if (t) {
    out.push(
      `القالب الذي اختاره العميل: ${t.name} (${t.id}). ${t.description}\nبنيات تناسبه: ${t.structures.map(structureName).join("، ")}. حتى ${t.words} كلمة في الشريحة.\nتشريح الغلاف: ${t.cover}\nتشريح الشريحة الداخلية: ${t.body}\nتشريح الخاتمة: ${t.closing}\nاللوحات الثلاث (يختار منها العميل أو يقترح لوحته):\n${t.palettes.map((p, i) => `  ${i + 1}) ${p.name} — #${p.bg.slice(1)} خلفية، #${p.text.slice(1)} نص، #${p.primary.slice(1)} أساسي، #${p.accent.slice(1)} إبراز`).join("\n")}\nنظام التصميم الذي تنسخه حرفيًا في توجيه كل شريحة (بلوحة العميل المختارة؛ استبدل سطر Palette إن اختار لوحة أخرى):\n${designSystem(t, 0)}`,
    );
  } else if (ids.template === "none") out.push("العميل اختار «بدون قالب جاهز»: صمّم نظامًا واحدًا يناسب موضوعه وجمهوره (ألوانًا برموزها، خطًا ونمطه، هوامش، موضع الشعار) واعرضه عليه، وثبّته في كل الشرائح.");
  const pal = ids.palette ? findPalette(ids.palette) : null;
  if (pal) {
    const by = [...pal.colors].sort((a, b) => lightness(a) - lightness(b));
    out.push(
      `الألوان التي اختارها العميل (لوحة رباعية من Color Hunt): «${pal.name}» — ${pal.colors.join(" · ")} (من الأغمق للأفتح: ${by.join(" · ")}). استعمل هذه الألوان الأربعة وحدها في كل الشرائح، برموزها حرفيًا في توجيه كل شريحة: الأغمق أو الأفتح خلفية، ونقيضه للنص، والباقيان للأساسي والإبراز (بتباين يقرأ). إن كان مع قالب فهي تحل محل لوحة القالب، وإن كان مع ستايل كاروسيل فهي تحل محل ألوانه وحدها ويبقى تخطيطه وأشكاله (الموقع يضيف هذه الألوان لكل شريحة وحيدرا ماكس).`,
    );
  } else if (ids.palette === "style") out.push("العميل أبقى ألوان الستايل نفسها: لا تغيّرها ولا تسأله عنها.");
  else if (ids.palette === "none") out.push("العميل ترك الألوان لك: اختر لوحة رباعية تناسب الموضوع وجمهوره، واذكر رموزها له.");
  const x = ids.style ? findStyle(ids.style) : null;
  if (x) out.push(`الستايل الكرتوني الذي اختاره العميل لرسوم الصور: ${x.name} (${x.id}) — ${x.description} (الموقع يضيف نصه الكامل حرفيًا إلى كل شريحة؛ ضع في "style_id" معرّفه: ${x.id}).`);
  else if (ids.style === "none") out.push('العميل اختار «بدون ستايل كرتوني»: اترك "style_id" فارغًا وصمّم الصور تصميمًا رسوميًا نظيفًا أو بصورًا حسب القالب والموضوع.');
  const sk = ids.motion ? motionStyleOf(ids.motion) : null;
  const md = ids.mood ? moodOf(ids.mood) : null;
  if (sk) out.push(`مهارة الموشن التي اختارها العميل: ${sk.ar} (${sk.id}) — ${sk.hint}.\nطريقة حيدرا ماكس فيها: ${sk.craft}\nضع "style":"${sk.id}" في لوحة القصة (storyboard) التي تسلّمها لحيدرا ماكس.`);
  else if (ids.motion === "none") out.push('العميل ترك مهارة الموشن لك: اختر الأنسب لهدفه وجمهوره وقل له اسمها بالعربية، وضع معرّفها في "style" في لوحة القصة.');
  if (md) out.push(`مزاج الموشن الذي اختاره العميل: ${md.ar} (${md.id}) — ${md.hint}.\nكيف يُكتب: ${md.craft}\nضع "mood":"${md.id}" في لوحة القصة.`);
  else if (ids.mood === "none") out.push('العميل ترك مزاج الموشن لك: اختر الأنسب للموضوع (فرح، حزن، تعليم، توعية، استعجال، سكينة، فخر، حماس، خشوع) وضعه في "mood".');
  // the client's choices come first (the owner, 17 Nov 2026: «في أي تعارض تقدّم خيارات العميل، خصوصًا الأساسية»)
  if (out.length) out.unshift("خيارات العميل مقدَّمة دائمًا: عند أي تعارض بين وصف الستايل أو القالب أو أمثلته وبين ما اختاره العميل أو طلبه (صورته المرجعية والشخصية، الألوان، الخط، المقاس، ما يضيفه أو يشيله أو يغيّره)، اتبع اختيار العميل واترك ما يخالفه من الستايل، واكتب ذلك صريحًا في توجيه كل شريحة. الستايل يكمّل فقط ما لم يحدده العميل.");
  return out.join("\n\n");
}
