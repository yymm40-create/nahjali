// «نص الهوك» — when the person asks Claude for a hook text, the hook is designed as one piece in three parts: the
// picture of the words (a GPT Image 2 prompt, Pixar-like 3D, its background taken out or kept), the entrance and exit
// (the editor's own animations, applied on the clip) and two sound effects (ElevenLabs, peaking on the arrival and
// the exit). Claude first looks up on the web what wins now for that field and age. The fixed library below is the
// owner's: nothing is added to it; the research only decides which of its entries wins.

import { ANIMS, ANIM_MS, type AnimKind } from "./model";

export const HOOK_STYLES = [
  "حروف منفوخة لامعة كالبالون: مرح وألفة فورية",
  "حروف صلصال ببصمات الأصابع: دفء وإحساس بالصنعة اليدوية",
  "حروف خشبية منحوتة بحواف ناعمة: روح الحكاية والأصالة",
  "حروف حلوى وسكر شفاف: بهجة وشهية بصرية",
  "حروف بلورية يتوهج نور بداخلها: سحر ودهشة",
  "حروف ذهبية بزخارف عربية إسلامية: وقار وهوية",
  "حروف قماش محشو بغرز خياطة ظاهرة: حنان وطفولة",
  "حروف من الطبيعة (أوراق، غيوم، ماء): هدوء ونقاء",
  "الحرف كشخصية بعيون وتعابير: الأقوى لجذب الأطفال",
  "حروف مضيئة كلافتة مسرح أو فانوس: فخامة سينمائية ليلية",
] as const;

export const HOOK_PALETTES = [
  "ذهبي الغروب مع عسلي وكريمي: أمان وحنين",
  "مرجاني مع أصفر شمسي: طاقة وانتباه فوري",
  "سماوي مع أبيض غيمي ولمسة أصفر: صفاء وثقة",
  "نعناعي مع خوخي: لطف ونمو",
  "بنفسجي ليلي مع ذهبي نجمي: سحر قصص ما قبل النوم",
  "فيروزي مع رملي: هوية خليجية صحراوية",
  "زمردي مع ذهبي عتيق: قداسة ووقار",
  "كهرماني مع بني كاكاو: دفء حكايات الجدة",
  "ألوان الحلوى الهادئة: نعومة للأصغر سناً",
  "قرمزي مع أسود دافئ ونور ذهبي: توتر درامي سينمائي",
] as const;

/** The ten entrances, each with its sound, and the editor animation closest to it (the template in the program). */
export const HOOK_ENTRANCES: { label: string; sound: string; anim: AnimKind }[] = [
  { label: "سقوط وارتداد بانضغاط وتمدد", sound: "رنين مطاطي وارتطام ناعم", anim: "drop" },
  { label: "انتفاخ من العدم كالبالون", sound: "صوت نفخ ثم فرقعة", anim: "pop" },
  { label: "ظهور الحروف متتابعة حرفاً بعد حرف", sound: "نقرات تصاعدية النغمة", anim: "wipe" },
  { label: "انبثاق من غبار سحري لامع", sound: "أجراس صغيرة وبريق", anim: "flash" },
  { label: "شخصية تسحب الكلمة إلى الإطار", sound: "خطوات واحتكاك حبل", anim: "fromRight" },
  { label: "نمو الكلمة من الأرض كالنبتة", sound: "حفيف أوراق وفرقعة لطيفة", anim: "rise" },
  { label: "طيران سريع ثم توقف حاد بانضغاط", sound: "صفير هواء ثم ارتطام", anim: "whip" },
  { label: "خط من نور يرسم الحروف", sound: "همهمة متصاعدة ورنين ختامي", anim: "wipe" },
  { label: "انكشاف من خلف ستار أو غيمة أو باب", sound: "صوت تصاعدي ثم ضربة عميقة", anim: "blur" },
  { label: "تجمع الكلمة من قطع صغيرة", sound: "طقطقة متتالية ولمعة ختامية", anim: "glitch" },
];

/** The editor's animations a picture can take (the «templates in the program» the hook's motion comes from). */
export const MEDIA_ANIMS = (Object.keys(ANIMS) as AnimKind[]).filter((k) => {
  const a = ANIMS[k] as { only?: string };
  return a.only !== "text" && k !== "kenburns";
});

export interface HookInputs {
  text: string;
  lang: string;
  /** from the project's shape */
  orientation: "vertical" | "horizontal";
  domain: string;
  age: string;
}

export interface HookSound {
  kind: "effect" | "instrument";
  prompt: string;
  seconds: number;
  /** where in the sound its peak is (ms from its start) */
  peakMs: number;
  why: string;
}

export interface HookDesign {
  research: string;
  researched: boolean;
  style: number;
  styleWhy: string;
  element: string;
  elementWhy: string;
  palette: number;
  paletteWhy: string;
  background: "transparent" | "scene";
  backgroundDesc: string;
  backgroundWhy: string;
  layout: string;
  layoutWhy: string;
  entrance: number;
  entranceWhy: string;
  inAnim: AnimKind;
  inMs: number;
  exit: string;
  exitWhy: string;
  outAnim: AnimKind;
  outMs: number;
  imagePrompt: string;
  lengthMs: number;
  sfxIn: HookSound;
  sfxOut: HookSound;
  open: string;
}

const sound = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "prompt", "seconds", "peakMs", "why"],
  properties: {
    kind: { type: "string", enum: ["effect", "instrument"], description: "a natural sound effect, or a note played on an instrument" },
    prompt: { type: "string", description: "ElevenLabs sound-effect prompt in English: the sound, its physical source, its length and where its peak is." },
    seconds: { type: "number", description: "0.5–5" },
    peakMs: { type: "number", description: "ms from the sound's start to its peak (the arrival or the vanishing)" },
    why: { type: "string", description: "one short Arabic line" },
  },
} as const;

export const DESIGN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["research", "researched", "style", "styleWhy", "element", "elementWhy", "palette", "paletteWhy", "background", "backgroundDesc", "backgroundWhy", "layout", "layoutWhy", "entrance", "entranceWhy", "inAnim", "inMs", "exit", "exitWhy", "outAnim", "outMs", "imagePrompt", "lengthMs", "sfxIn", "sfxOut", "open"],
  properties: {
    research: { type: "string", description: "one Arabic line: what wins now for this field and age, with its source (or that research was not possible)" },
    researched: { type: "boolean" },
    style: { type: "integer", description: "1–10 (the library entry)" },
    styleWhy: { type: "string" },
    element: { type: "string", description: "the 3D element interacting with the words, and what it does (Arabic)" },
    elementWhy: { type: "string" },
    palette: { type: "integer", description: "1–10 (the library entry)" },
    paletteWhy: { type: "string" },
    background: { type: "string", enum: ["transparent", "scene"], description: "transparent = the words (and their element) cut out over the video; scene = a full-frame title card" },
    backgroundDesc: { type: "string", description: "Arabic: what the background is" },
    backgroundWhy: { type: "string" },
    layout: { type: "string", description: "Arabic: the word order for the orientation" },
    layoutWhy: { type: "string" },
    entrance: { type: "integer", description: "1–10 (the library entry)" },
    entranceWhy: { type: "string" },
    inAnim: { type: "string", enum: MEDIA_ANIMS, description: "the editor animation applied as the entrance (the entrance's template or its nearest)" },
    inMs: { type: "integer", description: `${ANIM_MS.min}–${ANIM_MS.max}` },
    exit: { type: "string", description: "Arabic name of the exit motion chosen by research" },
    exitWhy: { type: "string" },
    outAnim: { type: "string", enum: MEDIA_ANIMS, description: "the editor animation applied as the exit (its template or nearest)" },
    outMs: { type: "integer", description: `${ANIM_MS.min}–${ANIM_MS.max}` },
    imagePrompt: { type: "string", description: "the GPT Image 2 prompt in English, in the required order" },
    lengthMs: { type: "integer", description: "1200–6000: how long the hook stays on screen, entrance and exit included" },
    sfxIn: sound,
    sfxOut: sound,
    open: { type: "string", description: "Arabic: only what stays unresolved and matters; empty if nothing" },
  },
} as const;

const lib = (title: string, list: readonly string[]) => `${title}\n${list.map((x, i) => `${i + 1}. ${x}`).join("\n")}`;

export const DESIGN_SYSTEM = `# R - ROLE
You are a designer of 3D hook texts and of their motion and sound, for children's and family content, in Pixar's warm cinematic look: the words are a tangible object in the scene, with material and light, and a 3D element interacts with them.
You do not change the hook's words, language or diacritics. You write the prompts for the image and the sounds; the editor makes them and applies your motion (only the entrance and exit, nothing else). The background is your decision.

# O - OBJECTIVE
A hook that stops the viewer in the first seconds, warm cinematic 3D, motion and sound matched, fitting the field, the audience's age and what wins in that field now.
Success: the hook text in the image prompt is exactly the given text, letter for letter, nothing added or missing · one decisive choice per element, no alternatives · word order follows the orientation · clear contrast, letters readable on a phone · style, palette and entrance come from the fixed library, justified by the research, field and age · the exit is an animation that really exists in the editor · each sound prompt says the kind of sound, its length and where its peak is relative to the motion · a short Arabic justification line for every choice.
Priority when they conflict: text accuracy and readability, then fit for age and field, then what wins in the research, then aesthetics.

# C - CONTEXT
Fixed rules: no diacritics by default; if the hook arrives with diacritics keep them exactly. Vertical: words stacked on top of each other. Horizontal: the text takes part of the frame, never all of it.
Research facts: the first seconds decide; too many transitions and effects scatter the message and look dated. Children lean slightly to warm colours and are drawn more to less saturated, lighter colours within moderate limits; very weak contrast weakens focus. A short whoosh before the pop makes a title feel like it comes from somewhere. A rising effect's peak sits exactly on the reveal. Image generators draw Arabic better than before, but not reliably: it needs checking.
Expected trend (an inference, not a proven fact): the winning text lives inside the scene and interacts with a character or element, with a tangible material and warm light, rather than a flat layer over the video.

## FIXED LIBRARY (nothing is added; the research decides which entry wins)
${lib("STYLES (each with a 3D element interacting with it):", HOOK_STYLES)}

${lib("PALETTES:", HOOK_PALETTES)}

ENTRANCES (with their sound, and the editor template that does it):
${HOOK_ENTRANCES.map((e, i) => `${i + 1}. ${e.label}: ${e.sound} → editor "${e.anim}"`).join("\n")}

THE EDITOR'S ANIMATIONS (the only templates there are; inAnim and outAnim must be one of them):
${MEDIA_ANIMS.map((k) => `${k} (${ANIMS[k].label}, default ${ANIMS[k].ms} ms)`).join(" · ")}
An exit plays the same animation in reverse as the clip leaves.

# T - TASK
1. Use the research given (it was done on the web just before; keep what was found apart from what you infer). If it says research was not possible, say so and choose by field and age only.
2. Choose one style, one interacting 3D element that serves the words' meaning, one palette, the background (transparent = cut out over the video; scene = a full-frame card) and the word order for the orientation.
3. Write the GPT Image 2 prompt in English in this order: (1) render type: Pixar-style 3D render; (2) the hook text verbatim between double quotes, with an explicit request to write it right to left with correctly joined letter forms (for Arabic); (3) the material; (4) the interacting element and what it does; (5) the colours; (6) warm cinematic lighting; (7) the background; (8) composition and frame for the orientation; (9) no other text or letters anywhere.
4. Motion: inAnim = the chosen entrance's editor template (or the nearest); the exit is the one the research points to for this style and field, applied with the nearest editor template. Give their lengths.
5. Two ElevenLabs sound prompts in English, entrance and exit: natural effect or instrument note (whichever serves the hook), the sound and its physical source, its length, and its peak placed on the arrival (entrance) or the vanishing (exit). Give peakMs inside the sound.
Check before answering: the text verbatim, the order by orientation, style/palette/element in harmony, sound length and peak matching the motion, a justification line for each choice. Avoid very saturated colours, weak contrast and exaggerated motion.

# F - FORMAT
All justifications in short clear Arabic; the prompts in English only. Decisive and short: no alternatives, no repetition.`;

export const RESEARCH_SYSTEM =
  "You research short-form video hooks. Search the web (recent sources first) and answer in Arabic in exactly two lines, each ending with its source URL in parentheses: 1) نوع نص الهوك وحركته الأنجح حاليًا لهذا المجال والعمر. 2) حركة الخروج الأنسب لنص هوك ثلاثي الأبعاد بهذا الأسلوب والمجال. Mark anything you inferred rather than found with «(استنتاج)». No other text.";

export const researchPrompt = (h: HookInputs) => `المجال: ${h.domain}\nالفئة العمرية: ${h.age}\nالاتجاه: ${h.orientation === "vertical" ? "عمودي" : "أفقي"}\nلغة الهوك: ${h.lang}`;

export const designPrompt = (h: HookInputs, research: string) =>
  `نص الهوك (حرفيًا): «${h.text}»\nاللغة: ${h.lang}\nالاتجاه: ${h.orientation === "vertical" ? "عمودي" : "أفقي"}\nالمجال: ${h.domain}\nالفئة العمرية: ${h.age}\n\nنتيجة البحث:\n${research}`;

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, Math.round(Number(n) || 0)));

/** A design made safe: the words verbatim in the prompt, the animations real, the lengths sane. */
export function checkDesign(d: HookDesign, h: HookInputs): HookDesign {
  const inAnim = MEDIA_ANIMS.includes(d.inAnim) ? d.inAnim : HOOK_ENTRANCES[clamp(d.entrance, 1, 10) - 1].anim;
  const outAnim = MEDIA_ANIMS.includes(d.outAnim) ? d.outAnim : "fade";
  const inMs = clamp(d.inMs, ANIM_MS.min, ANIM_MS.max);
  const outMs = clamp(d.outMs, ANIM_MS.min, ANIM_MS.max);
  const lengthMs = Math.max(clamp(d.lengthMs, 1200, 6000), inMs + outMs + 600);
  const fixSound = (s: HookSound, motionMs: number): HookSound => {
    const seconds = Math.min(5, Math.max(0.5, Math.round((Number(s.seconds) || 1) * 10) / 10));
    return { ...s, kind: s.kind === "instrument" ? "instrument" : "effect", seconds, peakMs: clamp(s.peakMs || motionMs, 0, seconds * 1000) };
  };
  // the hook's words must be in the image prompt exactly as given
  let imagePrompt = String(d.imagePrompt ?? "").slice(0, 3800);
  if (!imagePrompt.includes(`"${h.text}"`)) imagePrompt = `${imagePrompt}\nThe only text in the image is exactly "${h.text}", written right to left with correctly joined letter forms.`;
  return {
    ...d,
    style: clamp(d.style, 1, 10),
    palette: clamp(d.palette, 1, 10),
    entrance: clamp(d.entrance, 1, 10),
    background: d.background === "scene" ? "scene" : "transparent",
    inAnim,
    outAnim,
    inMs,
    outMs,
    lengthMs,
    imagePrompt,
    sfxIn: fixSound(d.sfxIn, inMs),
    sfxOut: fixSound(d.sfxOut, 0),
  };
}

/** The picture's frame: a card fills the project's shape; cut-out words are a stack (vertical) or a band (horizontal). */
export const hookAspect = (d: Pick<HookDesign, "background">, orientation: HookInputs["orientation"]) =>
  d.background === "scene" ? (orientation === "vertical" ? "9:16" : "16:9") : orientation === "vertical" ? "1:1" : "3:2";

/** The delivery, in the order the owner set (the prompts as copyable blocks). */
export function deliveryText(d: HookDesign, h: HookInputs) {
  const block = (s: string) => "```\n" + s + "\n```";
  return [
    `**${h.text}**`,
    `البحث: ${d.research}`,
    [
      `• الأسلوب: ${HOOK_STYLES[d.style - 1].split(":")[0]} — ${d.styleWhy}`,
      `• العنصر: ${d.element} — ${d.elementWhy}`,
      `• اللوحة: ${HOOK_PALETTES[d.palette - 1].split(":")[0]} — ${d.paletteWhy}`,
      `• الخلفية: ${d.backgroundDesc} — ${d.backgroundWhy}`,
      `• ترتيب الكلمات: ${d.layout} — ${d.layoutWhy}`,
      `• الدخولية: ${HOOK_ENTRANCES[d.entrance - 1].label} — ${d.entranceWhy}`,
      `• الخروجية: ${d.exit} — ${d.exitWhy}`,
    ].join("\n"),
    `أمر الصورة:\n${block(d.imagePrompt)}`,
    `في البرنامج: الدخول «${ANIMS[d.inAnim].label}» ${(d.inMs / 1000).toFixed(1)} ث · الخروج «${ANIMS[d.outAnim].label}» ${(d.outMs / 1000).toFixed(1)} ث · مدة الهوك ${(d.lengthMs / 1000).toFixed(1)} ث.`,
    `مؤثر الدخول (${d.sfxIn.seconds} ث، الذروة ${(d.sfxIn.peakMs / 1000).toFixed(2)} ث):\n${block(d.sfxIn.prompt)}`,
    `مؤثر الخروج (${d.sfxOut.seconds} ث، الذروة ${(d.sfxOut.peakMs / 1000).toFixed(2)} ث):\n${block(d.sfxOut.prompt)}`,
    `⚠️ راجع رسم الحروف العربية في الصورة الناتجة.${d.open ? `\n${d.open}` : ""}`,
  ].join("\n\n");
}
