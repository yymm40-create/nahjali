// «محمد باقر» — the persona's text: the owner's edit (content_kv) or the default template (config/content.ts), and
// the whole system text of a conversation (persona + the platform's rules + the tools + the examples of the turn +
// the project's record). Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { BAQIR_PERSONA, CONTENT_KV, CONTENT_PLATFORM_RULES, CONTENT_TOOLS } from "@config/content";
import { CAROUSEL_TEMPLATES, designSystem, findTemplate, structureName } from "@config/content-templates";
import { FILM_STYLES, findStyle } from "@config/film-styles";
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
  return [persona, CONTENT_PLATFORM_RULES, CONTENT_TOOLS, ...parts, record ? `سجل المشروع الحالي (كما حفظته آخر مرة؛ حدّثه في "record" عند أي تغيير):\n${record}` : ""].filter(Boolean).join("\n\n");
}

/** The two galleries the person can pick from, one line each (always the same text, so it caches). */
export function catalogBlock(): string {
  const tpl = CAROUSEL_TEMPLATES.map((t) => `- ${t.id} — ${t.name} (${t.group}) — ${t.description} يناسب: ${t.bestFor}. بنيات: ${t.structures.map(structureName).join("، ")}. حتى ${t.words} كلمة في الشريحة.`).join("\n");
  const sty = FILM_STYLES.map((x) => `- ${x.id} — ${x.name} (${x.group}) — ${x.feel}`).join("\n");
  return `قوالب الكاروسيل التي يعرضها الموقع للعميل (معرض kind="templates"؛ يختار واحدًا أو لا يختار):\n${tpl}\n\nالستايلات الكرتونية الـ٢٤ لرسوم الصور (معرض kind="styles"؛ يطبّق الموقع نص الستايل حرفيًا على الرسوم والشخصيات والمشاهد المرسومة فقط، لا على تخطيط الكتابة):\n${sty}`;
}

/**
 * What حيدرة can do in motion graphics, one line each (the same text every time, so it caches): the skills the client
 * can choose from (kind="motion"), the feelings (kind="moods"), and the drawing tools he arranges backgrounds with.
 */
export function motionCatalogBlock(): string {
  const skills = MOTION_STYLES.filter((x) => !x.talk).map((x) => `- ${x.id} — ${x.ar} ${x.icon} — ${x.hint}. لقطاته: ${x.beats.join("، ")}.`).join("\n");
  const moods = MOODS.map((m) => `- ${m.id} — ${m.ar} ${m.icon} — ${m.hint}.`).join("\n");
  return `مهارات الموشن التي يعرضها الموقع للعميل (معرض kind="motion"؛ يختار واحدة أو يترك الاختيار لحيدرة):\n${skills}\n\nمشاعر الموشن (معرض kind="moods"؛ تغيّر الإيقاع والدخول والمشهد المرسوم خلف الكلام):\n${moods}\n\nأدوات الرسم عند حيدرة: حيدرة يرتب الخلفيات بنفسه بأدوات «حيدرة كت» ولا يطلب خلفية من أي مولّد صور: ${SCENE_IDS.filter((x) => x !== "none").length} مشهدًا مرسومًا (${SCENE_IDS.filter((x) => x !== "none").join("، ")})، ومكتبة من ${MOTION_ICONS.length} أيقونة مرسومة، وأشكال يرسمها بنفسه، وتوقيت يتبع طول التعليق الصوتي. لا تطلب من جواد صورًا لخلفيات الموشن، ولا تطلب «GPT Image 2» للموشن إلا إذا طلب العميل صورة صراحةً.`;
}

const TEMPLATE_MARK = /\[قالب:([a-z0-9-]+)\]/g;
const STYLE_MARK = /\[ستايل:([a-z0-9-]+)\]/g;
const MOTION_MARK = /\[موشن:([a-z0-9-]+)\]/g;
const MOOD_MARK = /\[مزاج:([a-z0-9-]+)\]/g;

/** What the person picked in the galleries: the last mark of each kind in their messages ("none" = they chose neither). */
export interface Chosen {
  template: string | null;
  style: string | null;
  /** the motion skill and the mood of the piece ("none" = حيدرة chooses) */
  motion?: string | null;
  mood?: string | null;
}
export function chosenIds(userTexts: string[]): Required<Chosen> {
  let template: string | null = null;
  let style: string | null = null;
  let motion: string | null = null;
  let mood: string | null = null;
  for (const t of userTexts) {
    for (const m of t.matchAll(TEMPLATE_MARK)) template = m[1];
    for (const m of t.matchAll(STYLE_MARK)) style = m[1];
    for (const m of t.matchAll(MOTION_MARK)) motion = m[1];
    for (const m of t.matchAll(MOOD_MARK)) mood = m[1];
  }
  return { template, style, motion, mood };
}

/** The full details of what was picked (the design system to copy into every slide, the style's meaning). */
export function chosenBlock(ids: Chosen): string {
  const out: string[] = [];
  const t = ids.template ? findTemplate(ids.template) : null;
  if (t) {
    out.push(
      `القالب الذي اختاره العميل: ${t.name} (${t.id}). ${t.description}\nبنيات تناسبه: ${t.structures.map(structureName).join("، ")}. حتى ${t.words} كلمة في الشريحة.\nتشريح الغلاف: ${t.cover}\nتشريح الشريحة الداخلية: ${t.body}\nتشريح الخاتمة: ${t.closing}\nاللوحات الثلاث (يختار منها العميل أو يقترح لوحته):\n${t.palettes.map((p, i) => `  ${i + 1}) ${p.name} — #${p.bg.slice(1)} خلفية، #${p.text.slice(1)} نص، #${p.primary.slice(1)} أساسي، #${p.accent.slice(1)} إبراز`).join("\n")}\nنظام التصميم الذي تنسخه حرفيًا في توجيه كل شريحة (بلوحة العميل المختارة؛ استبدل سطر Palette إن اختار لوحة أخرى):\n${designSystem(t, 0)}`,
    );
  } else if (ids.template === "none") out.push("العميل اختار «بدون قالب جاهز»: صمّم نظامًا واحدًا يناسب موضوعه وجمهوره (ألوانًا برموزها، خطًا ونمطه، هوامش، موضع الشعار) واعرضه عليه، وثبّته في كل الشرائح.");
  const x = ids.style ? findStyle(ids.style) : null;
  if (x) out.push(`الستايل الكرتوني الذي اختاره العميل لرسوم الصور: ${x.name} (${x.id}) — ${x.description} (الموقع يضيف نصه الكامل حرفيًا إلى كل شريحة؛ ضع في "style_id" معرّفه: ${x.id}).`);
  else if (ids.style === "none") out.push('العميل اختار «بدون ستايل كرتوني»: اترك "style_id" فارغًا وصمّم الصور تصميمًا رسوميًا نظيفًا أو بصورًا حسب القالب والموضوع.');
  const sk = ids.motion ? motionStyleOf(ids.motion) : null;
  const md = ids.mood ? moodOf(ids.mood) : null;
  if (sk) out.push(`مهارة الموشن التي اختارها العميل: ${sk.ar} (${sk.id}) — ${sk.hint}.\nطريقة حيدرة فيها: ${sk.craft}\nضع "style":"${sk.id}" في لوحة القصة (storyboard) التي تسلّمها لحيدرة.`);
  else if (ids.motion === "none") out.push('العميل ترك مهارة الموشن لك: اختر الأنسب لهدفه وجمهوره وقل له اسمها بالعربية، وضع معرّفها في "style" في لوحة القصة.');
  if (md) out.push(`مزاج الموشن الذي اختاره العميل: ${md.ar} (${md.id}) — ${md.hint}.\nكيف يُكتب: ${md.craft}\nضع "mood":"${md.id}" في لوحة القصة.`);
  else if (ids.mood === "none") out.push('العميل ترك مزاج الموشن لك: اختر الأنسب للموضوع (فرح، حزن، تعليم، توعية، استعجال، سكينة، فخر، حماس، خشوع) وضعه في "mood".');
  return out.join("\n\n");
}
