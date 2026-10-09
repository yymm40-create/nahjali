// «محمد باقر» — the persona's text: the owner's edit (content_kv) or the default template (config/content.ts), and
// the whole system text of a conversation (persona + the platform's rules + the tools + the examples of the turn +
// the project's record). Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { BAQIR_PERSONA, CONTENT_KV, CONTENT_PLATFORM_RULES, CONTENT_TOOLS } from "@config/content";
import { CAROUSEL_TEMPLATES, designSystem, findTemplate, structureName } from "@config/content-templates";
import { FILM_STYLES, findStyle } from "@config/film-styles";

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

const TEMPLATE_MARK = /\[قالب:([a-z0-9-]+)\]/g;
const STYLE_MARK = /\[ستايل:([a-z0-9-]+)\]/g;

/** What the person picked in the galleries: the last mark of each kind in their messages ("none" = they chose neither). */
export function chosenIds(userTexts: string[]): { template: string | null; style: string | null } {
  let template: string | null = null;
  let style: string | null = null;
  for (const t of userTexts) {
    for (const m of t.matchAll(TEMPLATE_MARK)) template = m[1];
    for (const m of t.matchAll(STYLE_MARK)) style = m[1];
  }
  return { template, style };
}

/** The full details of what was picked (the design system to copy into every slide, the style's meaning). */
export function chosenBlock(ids: { template: string | null; style: string | null }): string {
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
  return out.join("\n\n");
}
