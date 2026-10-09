// «الجواد الذكي!» | JAWAD AI — «تحويل فيديو شخصية واقعية»: how «جواد» changes the world around a real person in their
// own clip (the environment, an object, the clothes, the light, the weather, an added or removed element, the look)
// while the person — face, identity, performance, framing and camera move — stays exactly as filmed. Pure; shared
// by the assistant's instructions, the example bank and the tests.
//
// Where the method comes from (read on 2026-10-09):
//   - Seedance 2.x editing, as the hosts document it (Runware's Seedance 2.5 editing guide, WaveSpeed's Seedance 2.0
//     Video Edit, PromeAI, Curious Refuge's Omni tutorial, Magic Hour's and heyuan110's reference guides, Luma's
//     guide): the source clip is a reference video addressed by its tag («Edit @video1: …»); an EDIT VERB first
//     (replace, remove, relight, restyle, change to, add); a FENCE naming what stays («keep the person, the framing,
//     the lighting and the camera move exactly unchanged») — without it the model «touches more than you asked»; the
//     change written A → B («from a cool overcast afternoon to a warm amber dusk»), never «make it warmer»; a timed
//     window («between 0:02 and 0:04») for a change in one moment; the output's length is the source's; a short,
//     evenly lit, steady source separates and fills most cleanly; the background is swapped before the subject
//     (a subject swap first reinterprets the background); one change per pass, and the strongest take becomes the
//     next pass's source. Identity: text drifts, so the lock is repeated and few references are used (one person
//     reported cutting references from six to two removed most of the drift); a side key light «turned the
//     character into a slightly different person», so relighting the person is the riskiest change.
//   - A working footage-transformation grammar (Anthropic's seedance-footage-vfx skill): declare the source and what
//     it holds, PRESERVE then CHANGE ONE THING, a specs line (photoreal, aspect, the source's seconds, the grade,
//     NON-IP, «SFX and source dialogue only»), one continuous shot with the transformation's physics and how it
//     interacts with the plate, and the LOCK-DOWN CLAUSE repeated last: «face and identity unchanged; everything
//     else identical to the source». Lighting integration beyond colour matching: the same key direction and
//     softness, the world's bounce on the person, matched haze, depth of field and grain, no cut-out edges. A new
//     world must stream past with parallax matching the original motion. Warm directional daylight worlds hold the
//     face better than night or neon (those force a relight).
// The site's own rule holds: the person in the clip is a man or a boy; never a real woman or girl.

import type { Settings } from "./types";

export const TRANSFORM_PLAYBOOK_ID = "video-transform";

/** What can be changed around a preserved person, and the words people use for it. */
export const TRANSFORM_KINDS = [
  { id: "environment", ar: "تغيير البيئة", en: "replace the whole environment around the person" },
  { id: "object", ar: "استبدال عنصر", en: "replace one object with another" },
  { id: "outfit", ar: "تغيير اللبس", en: "change the person's clothes" },
  { id: "relight", ar: "تغيير الإضاءة والوقت", en: "relight: the time of day and the light" },
  { id: "weather", ar: "تغيير الطقس", en: "change the weather and the sky" },
  { id: "add", ar: "إضافة عنصر", en: "add an element that interacts with the plate" },
  { id: "remove", ar: "حذف عنصر", en: "remove an element and fill the gap" },
  { id: "restyle", ar: "تغيير الستايل", en: "restyle the whole look while the motion stays" },
] as const;
export type TransformKind = (typeof TRANSFORM_KINDS)[number]["id"];

/** The lock-down clause every transformation prompt ends with (the fragile guardrail, said last). */
export const LOCK_CLAUSE = "Face and identity unchanged — the same person, features, skin, hair and beard, the same expression and lip movement; the same wardrobe unless changed above; the same framing, lens, camera move and timing; everything else identical to the source.";

/** The method, as the assistant reads it when a message asks for a transformation. */
export const TRANSFORM_METHOD = `METHOD — transforming a real person's own clip (keep the person, change the world):
1. THE SOURCE IS A VIDEO REFERENCE, never a first frame: set the references style to «references» (مراجع متعددة), add the person's clip as a video reference named «source», and mention it as @source. A picture that supplies a new thing (new clothes, a product, a place, an animal's real fur) is a second reference named by what it is (@jacket, @shop, @lion) and declared as «appearance/texture only; ignore its background and lighting».
2. THE SOURCE LINE first: «@source: original clip — <who is in it (a man or a boy), his wardrobe, where he is, what he does, the framing and the camera move, the light>. Preserve his identity, face, wardrobe, performance, framing, camera and motion exactly; change only <the one thing>.» Write what the clip really shows (ask the person what is in it when you can't see it; never invent).
3. ONE CHANGE PER PASS. Name it with an edit verb (replace, remove, relight, restyle, change … to …, add) and write it A → B («from a plain grey office wall to a sunlit Riyadh rooftop at golden hour»), never a vague «make it nicer». When they want two changes (a new place AND new clothes), do the environment in this pass and tell them the clothes come in a second pass on the result — a subject change first makes the model reinterpret the background.
4. THE FENCE: name what stays before the change («keep the man, his face, his thobe, his hands, the phone he holds, the medium shot, the slow push-in and the timing exactly as they are»). Then the change. Then the LOCK-DOWN CLAUSE as the last sentence of the action: «${LOCK_CLAUSE}»
5. SPECS LINE after the source line: «Photoreal. <the source's aspect>. <the source's seconds>s. <the grade, in words>. NON-IP — generic designs, nothing from a brand or a character. SFX and source dialogue only.» The output is as long as the source: set the duration option to the clip's seconds (4–15; a longer clip is trimmed to its strongest 4–15 s first) and the ratio to the clip's own.
6. LIGHT IS WHAT MAKES IT REAL. Choose with the person: (a) keep his original light and light the NEW world/element to match it — the same key direction (say screen-left or screen-right), the same softness and shadow density, the world's bounce spilling onto him, a touch of the scene's haze over him, matched depth of field and grain, no cut-out edges or halos — the safest for the face; or (b) relight the whole frame under one look (needed for night, neon, a sunset) — say so and lock identity, expression and wardrobe while only light and grade change; warn that relighting a face is the riskiest change for likeness.
7. A NEW ENVIRONMENT must move like the old one: the same parallax and speed (a walking man's new street slides past at his pace; a car's new road rushes under it), a ground he really stands on, his own soft contact shadow on it, reflections where the world is wet or glossy.
8. AN ADDED ELEMENT has physics over time: where it starts, how it spreads or moves, what light it throws on him and on the plate, its scale stated («enormous, dwarfing the building»), its sound; the person usually stays unaware, mid-delivery. A photoreal creature or material: «fully photoreal, real fur with individual strands, true anatomy, never CG, plastic or cartoonish», matched to the sun and the haze, a real soft contact shadow where it touches.
9. A REPLACED OBJECT keeps the original's position, size, motion and the way the hand holds it; the new one from @image when it must be exact (a product's label), with its reflections and shadow redone for its own material.
10. REMOVING: name the thing, where it is and when; «fill the gap naturally with what the scene would show behind it, matching the light and the perspective».
11. RELIGHT / WEATHER / SEASON: the light's new direction, colour and softness; what wet, snow, rain or dust do to surfaces, hair and clothes; the sky; the sound of it. A CHANGE IN ONE MOMENT: «between 0:02 and 0:04 … then back to the original; everything outside that window unchanged».
12. RESTYLE: the motion is the source's; describe only the look (medium, palette, line, grain) and keep the framing, timing and lip movement.
13. HONESTY: the face is kept by locking it in words and by not relighting it, never guaranteed — say the result must be checked against the original, and that another pass fixes small drift (fewer references, the lock repeated, one change). The provider may refuse a clip whose face is clearly a known public figure. The site's rule holds: the person is a man or a boy; a clip of a woman is not transformed.
14. Sound: keep the source's own speech («SFX and source dialogue only») and add only the sounds the change brings; a new voice is never written in.`;

/** A worked case: the clip as it was, what was asked, and the prompt that carries the change. */
export interface TransformCase {
  id: string;
  kind: TransformKind;
  /** the source clip in words */
  before: { who: string; whoAr: string; wardrobe: string; place: string; placeAr: string; action: string; actionAr: string; camera: string; light: string; seconds: number; ratio: string };
  /** the request as a person writes it (Gulf Arabic) */
  ask: string;
  /** the change in words */
  after: string;
  /** the second reference the change needs, when it does (name and what it holds) */
  ref?: { name: string; holds: string };
  settings: Settings;
  prompt: string;
  /** what to check in the result against the source */
  check: string[];
}

// ───────────────────────────── seed lists ─────────────────────────────

interface Noun {
  ar: string;
  en: string;
}
const n = (ar: string, en: string): Noun => ({ ar, en });

const MEN: Noun[] = [
  n("شاب بثوب أبيض", "a young man in a white thobe"), n("رجل بشماغ أحمر", "a man in a thobe and red shemagh"), n("رجل بقميص أزرق", "a man in his thirties in a blue shirt"), n("شاب بتيشيرت أسود", "a young man in a black t-shirt"),
  n("ولد صغير بجاكيت", "a boy around nine in a puffer jacket"), n("رجل كبير بغترة بيضاء", "an older man in a thobe and white ghutra"), n("شاب رياضي", "an athletic young man in a grey hoodie"), n("موظف ببدلة كحلية", "a man in a navy suit"),
  n("شيف بزي أبيض", "a male chef in whites"), n("شاب بنظارة", "a young man with glasses in a denim jacket"), n("رجل ملتحي بقميص أبيض", "a bearded man in a white shirt"), n("طالب بشنطة ظهر", "a male student with a backpack"),
];
const PLACES: Noun[] = [
  n("في مكتب بجدار رمادي", "in an office against a plain grey wall"), n("في المطبخ", "in a bright home kitchen"), n("في السيارة وهو يسوق", "in the driver's seat of a moving car"), n("في الشارع يمشي", "walking along a quiet city street"),
  n("في الاستوديو على خلفية بيضاء", "in a studio against a white backdrop"), n("في غرفة المعيشة", "in a living room on a sofa"), n("في المجلس", "in a traditional majlis"), n("على السطح", "on a rooftop"),
  n("في المقهى", "at a café table by the window"), n("في الجيم", "in a gym"), n("في الحديقة", "in a park"), n("عند الباب", "standing at a front door"),
];
const ACTIONS: Noun[] = [
  n("يتكلم للكاميرا", "talks to the camera"), n("يمسك جوال ويشرح", "holds up a phone and explains"), n("يشرب قهوة", "sips coffee and talks"), n("يمشي ويتكلم", "walks and talks to the camera"),
  n("يشير بيده", "gestures with one hand as he speaks"), n("يقرأ من ورقة", "reads from a sheet of paper"), n("يسوق ويتكلم", "drives and talks"), n("يضحك ويلوّح", "laughs and waves"),
  n("يفتح صندوق", "opens a box on the table"), n("يسوي تمارين", "does a set of push-ups"), n("يجلس ويتكلم بهدوء", "sits and speaks calmly"), n("يوقف ويعرض منتج", "stands and presents a product"),
];
const CAMERAS = ["a locked-off medium shot", "a handheld medium close-up with gentle sway", "a slow push-in from medium to close", "a static close-up", "a phone-style selfie framing at arm's length", "a slow lateral dolly", "a tripod wide shot", "a gimbal follow from the front"];
const LIGHTS = ["soft window daylight from screen-left", "flat overhead office light", "warm lamp light from screen-right", "overcast daylight, soft and even", "a bright key from screen-right with soft fill", "golden late-afternoon sun from screen-left"];
const RATIOS = ["9:16", "9:16", "16:9", "1:1"];
const SECONDS = [4, 5, 6, 6, 8, 8, 10, 12, 15];

const WORLDS: Noun[] = [
  n("سطح في الرياض وقت الغروب", "a Riyadh rooftop at golden hour, the skyline soft in haze"), n("شارع في طوكيو بالليل", "a rain-wet Tokyo street at night with neon signs"), n("صحراء بكثبان ذهبية", "golden desert dunes under a clear late sun"), n("شاطئ وقت المغرب", "a quiet beach at sunset, small waves"),
  n("مكتب زجاجي حديث", "a modern glass office with the city behind"), n("مكتبة قديمة", "an old wood-panelled library"), n("مجلس فخم", "a grand majlis with carved wood and brass lamps"), n("غابة صنوبر", "a pine forest with sun shafts through mist"),
  n("جبل ثلجي", "a snowy mountain ridge under a pale sky"), n("شارع في باريس", "a Paris boulevard in soft morning light"), n("مسجد قديم من الخارج", "the courtyard of an old mosque, sandstone arches"), n("محطة فضاء", "the interior of a space station with Earth in the window"),
  n("مزرعة نخيل", "a date-palm farm in afternoon sun"), n("كوخ خشبي بثلج", "a wooden cabin porch in falling snow"), n("ملعب كرة قدم", "a floodlit football stadium, stands full"), n("مطعم فخم", "a fine-dining restaurant with warm pendant lights"),
  n("سوق شعبي", "a busy traditional souq with lanterns"), n("جسر فوق النهر", "a bridge over a river at blue hour"), n("استوديو أبيض نظيف", "a clean white cyclorama studio"), n("قمة ناطحة سحاب", "the top deck of a skyscraper above the clouds"),
];
const OBJECTS: { from: Noun; to: Noun }[] = [
  { from: n("كوب القهوة", "the coffee cup"), to: n("كوب عصير", "a tall glass of orange juice") }, { from: n("الجوال", "the phone"), to: n("كتاب", "a hardcover book") }, { from: n("الورقة", "the sheet of paper"), to: n("تابلت", "a tablet") },
  { from: n("الكرسي", "the chair"), to: n("كرسي جلد فخم", "a tufted leather armchair") }, { from: n("اللابتوب", "the laptop"), to: n("آلة كاتبة", "a vintage typewriter") }, { from: n("الكوب", "the mug"), to: n("فنجان قهوة عربية", "a small Arabic coffee cup") },
  { from: n("الشنطة", "the backpack"), to: n("حقيبة جلد", "a brown leather satchel") }, { from: n("الصندوق", "the box"), to: n("صندوق هدية ذهبي", "a gold gift box with a ribbon") }, { from: n("الزجاجة", "the water bottle"), to: n("علبة المشروب حقي", "the drink can from @product") },
  { from: n("الساعة", "the watch"), to: n("ساعتي الجديدة", "the watch from @product") }, { from: n("النظارة", "the glasses"), to: n("نظارة شمسية", "aviator sunglasses") }, { from: n("القلم", "the pen"), to: n("ميكروفون", "a handheld microphone") },
];
const OUTFITS: Noun[] = [
  n("بدلة سوداء", "a black suit with a white shirt"), n("ثوب أبيض وشماغ", "a white thobe and red shemagh"), n("بشت", "a bisht over a white thobe"), n("جاكيت جلد", "a black leather jacket over a grey tee"),
  n("لبس رياضي", "a full tracksuit"), n("زي طيار", "a pilot's uniform"), n("زي شيف", "a chef's whites"), n("هودي أبيض", "a white hoodie"), n("قميص جينز", "a denim shirt"), n("زي رائد فضاء", "an astronaut suit, helmet off"),
  n("لبس شتوي", "a winter coat and scarf"), n("اللبس اللي في الصورة", "the outfit from @outfit"),
];
const RELIGHTS: { ar: string; from: string; to: string }[] = [
  { ar: "غروب", from: "flat overcast daylight", to: "a warm amber sunset, low sun from screen-left, long soft shadows, a golden grade" }, { ar: "ليل", from: "daylight", to: "night, a cool blue ambient with one warm practical lamp from screen-right, deep soft shadows" },
  { ar: "ساعة زرقاء", from: "afternoon sun", to: "blue hour, soft cool sky light, a faint warm glow from windows behind" }, { ar: "استوديو", from: "mixed room light", to: "a clean studio key from screen-right, soft fill, a subtle rim light on the hair and shoulder" },
  { ar: "فجر", from: "evening lamp light", to: "pale dawn light from screen-left, cool and soft, a hint of mist"}, { ar: "نيون", from: "daylight", to: "magenta and cyan neon from both sides, dark background, wet reflections" },
  { ar: "شمعة", from: "overhead light", to: "warm candlelight from below screen-left, flickering gently, everything else dark" }, { ar: "ضوء دافي", from: "cool white light", to: "warm tungsten light from screen-right, soft and flattering, a warm grade" },
];
const WEATHERS: Noun[] = [
  n("مطر", "steady rain: wet ground with reflections, drops on surfaces, a grey sky, hair and shoulders slightly damp"), n("ثلج", "falling snow: flakes drifting past, a thin white layer on surfaces, cold pale light, breath faintly visible"), n("غبار", "a dust haze: the air thick and orange, the sun a pale disc, dust on surfaces"),
  n("ضباب", "thick morning fog: the background dissolving into white, soft diffused light"), n("عاصفة", "a storm: dark clouds, wind pulling at clothes and hair, scattered rain"), n("شمس", "clear hard sunshine: a deep blue sky, crisp shadows, bright warm light"),
  n("غيوم", "an overcast sky: soft shadowless light, muted colours"), n("برق", "between 0:02 and 0:04, two quick forks of lightning light the sky and the scene, then back to the original storm light"),
];
const ADDS: Noun[] = [
  n("أسد جنبه", "a full-grown lion lying calmly beside him, fully photoreal, real fur with individual strands, never CG"), n("نار في يده", "a small flame igniting in his open palm with a soft whoomph, then a steady flame that throws warm flickering light on his face and shirt"), n("صقر على كتفه", "a saker falcon landing on his shoulder, feathers lifting as it settles, a real soft contact shadow"),
  n("ثلج يطيح", "soft snow beginning to fall around him, settling on his shoulders"), n("فراشات", "a dozen blue morpho butterflies drifting past him, catching the light"), n("دخان", "white smoke rolling in low along the floor behind him"),
  n("مخلوق ضخم ورا", "an enormous generic reptilian creature, clearly colossal, walking slowly far behind him across the skyline, dwarfing the buildings, a real soft shadow on the ground"), n("قطة على الطاولة", "a grey cat jumping onto the table beside him and sitting, fully photoreal"), n("طائرة تمر", "a passenger jet crossing the sky far behind him, slow and small"),
  n("ورق يطير", "a gust lifting a swirl of papers around him"), n("مطر ذهبي", "fine golden particles drifting slowly down through the air around him"), n("كلب يجي له", "a golden retriever trotting in from screen-left and sitting at his feet, photoreal"),
];
const REMOVES: Noun[] = [
  n("الشخص اللي ورا", "the second person in the background"), n("السيارة الواقفة", "the parked car behind him"), n("اللوحة على الجدار", "the framed picture on the wall"), n("الكرسي الفاضي", "the empty chair on the right"),
  n("الأسلاك", "the cables on the floor"), n("الشعار على القميص", "the logo on his shirt"), n("الكوب", "the cup on the table"), n("الناس في الخلفية", "everyone in the background except him"),
  n("الفوضى على الطاولة", "the clutter on the table"), n("اللافتة", "the sign behind him"),
];
const STYLES: Noun[] = [
  n("أنمي", "a hand-drawn anime look: clean line art, cel shading, a soft painted background"), n("ألوان مائية", "a soft hand-painted watercolour illustration with paper texture"), n("فيلم قديم", "16mm film from the 1970s: warm faded colours, heavy grain, soft gate weave"),
  n("أبيض وأسود", "high-contrast black-and-white 35mm, fine grain"), n("كرتون 3D", "a polished 3D animated look with soft subsurface skin and big expressive eyes"), n("سينمائي", "a cinematic teal-and-orange grade with gentle contrast and halation"),
  n("كوميك", "a comic-book look: bold ink outlines, halftone dots, flat colours"), n("رسم بالقلم", "a pencil sketch on cream paper, cross-hatched shading"),
];
const GRADES = ["warm cinematic grade", "clean natural grade", "soft filmic grade with light halation", "neutral grade matched to the source", "cool teal shadows, warm skin", "muted documentary grade"];

// ───────────────────────────── deterministic choice ─────────────────────────────

class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = (seed >>> 0) || 1;
  }
  next() {
    let x = this.s;
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return this.s / 4294967296;
  }
  pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.next() * list.length)];
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The two lines every prompt opens with: the source declared, then the specs. */
function head(b: TransformCase["before"], change: string, grade: string, ref?: TransformCase["ref"]) {
  const src = `@source: original clip — ${b.who}, ${b.place}, ${b.action}; ${b.camera}; ${b.light}. Preserve his identity, face, wardrobe, performance, framing, camera and motion exactly; change only ${change}.`;
  const extra = ref ? `\n@${ref.name}: ${ref.holds} — appearance and texture reference only; ignore its background and lighting.` : "";
  const specs = `Photoreal. ${b.ratio}. ${b.seconds}s. ${cap(grade)}. NON-IP — generic designs, nothing from a brand or a character. SFX and source dialogue only.`;
  return `${src}${extra}\n\n${specs}`;
}

const fence = (b: TransformCase["before"]) => `Keep the man, his face, his clothes, his hands and what he holds, the ${b.camera.replace(/^an? /, "")} and the timing exactly as in @source.`;

type Maker = (r: Rng, b: TransformCase["before"]) => Omit<TransformCase, "id" | "before" | "settings">;

const MAKERS: Record<TransformKind, Maker> = {
  environment: (r, b) => {
    const w = r.pick(WORLDS);
    const night = /night|neon|blue hour/.test(w.en);
    const grade = night ? "cool night grade, warm practicals" : r.pick(GRADES);
    const ask = r.pick([`غيّر البيئة اللي ورا ${b.whoAr}، خله ${w.ar}، وخل وجهه نفسه`, `حط ${b.whoAr} ${w.ar} بدل ${b.placeAr}`, `أبي نفس الفيديو بس المكان ${w.ar}`, `بدّل الخلفية: ${w.ar}، وحافظ على وجهه وحركته`, `نقّل ${b.whoAr} إلى ${w.ar} بنفس اللقطة`]);
    const light = night
      ? "Relight the whole frame under this night look: the new world's light wraps him — a cool ambient and one warm practical from screen-right — while his identity, expression and wardrobe are locked and only light and grade change."
      : `Keep his original light and light the new world to match it: the same key direction and softness, the world's bounce spilling onto him, a touch of the scene's haze over him, matched depth of field and grain, no cut-out edges or halos.`;
    const prompt = `${head(b, "the environment around him", grade)}\n\nOne continuous shot, ${b.camera}, same framing as @source. ${fence(b)} Replace only the environment: ${b.place.replace(/^(in|at|on|walking along|standing at) /, "")} becomes ${w.en}. The new world moves like the old one — the same parallax and speed as his motion — with a ground he really stands on, his own soft contact shadow on it and reflections where it is glossy or wet. ${light} ${LOCK_CLAUSE}\n\nSFX and source dialogue only: his own voice as in the source, the new place's quiet ambience under it.`;
    return { kind: "environment", ask, after: `the environment becomes ${w.en}`, prompt, check: ["the face against the source frame by frame", "the shadow under his feet", "the new world's parallax matches his motion", "no halo at his edges", "his voice untouched"] };
  },
  object: (r, b) => {
    const o = r.pick(OBJECTS);
    const needsRef = o.to.en.includes("@product");
    const ref = needsRef ? { name: "product", holds: "a photo of the product: its exact shape, label, colours and text" } : undefined;
    const ask = r.pick([`بدّل ${o.from.ar} اللي بيد ${b.whoAr} بـ${o.to.ar} في نفس الفيديو`, `خل ${o.from.ar} يصير ${o.to.ar} ونفس الحركة في الفيديو`, `غيّر ${o.from.ar} إلى ${o.to.ar} في الفيديو بدون ما تغيّر شي ثاني`, `استبدل ${o.from.ar} بـ${o.to.ar} في الفيديو`]);
    const prompt = `${head(b, `${o.from.en} → ${o.to.en}`, r.pick(GRADES), ref)}\n\nOne continuous shot, ${b.camera}, same framing as @source. ${fence(b)} Replace ${o.from.en} with ${o.to.en}${needsRef ? " exactly as in @product (shape, label, colours and text unchanged)" : ""}: the same position, size and motion, held the same way by the same hand, its reflections and shadow redone for its own material and matched to the source light. Nothing else in the frame changes. ${LOCK_CLAUSE}\n\nSFX and source dialogue only: his own voice as in the source; a small matching handling sound if the object makes one.`;
    return { kind: "object", ask, after: `${o.from.en} becomes ${o.to.en}`, ref, prompt, check: ["the hand grips the new object naturally", "the object's size and position match the original", "the label is exact when a product was given", "nothing else moved"] };
  },
  outfit: (r, b) => {
    const o = r.pick(OUTFITS);
    const needsRef = o.en.includes("@outfit");
    const ref = needsRef ? { name: "outfit", holds: "a photo of the clothes: their cut, colour, fabric and details" } : undefined;
    const ask = r.pick([`غيّر لبس ${b.whoAr} إلى ${o.ar} ونفس الوجه`, `خله لابس ${o.ar} في نفس الفيديو`, `بدّل ملابسه بـ${o.ar} بدون ما تغيّر وجهه`, `أبي ${b.whoAr} لابس ${o.ar}، نفس المكان ونفس الحركة`]);
    const prompt = `${head(b, "his clothes", r.pick(GRADES), ref)}\n\nOne continuous shot, ${b.camera}, same framing as @source. Keep the man, his face, his hair and beard, his hands, ${b.place.replace(/^(in|at|on|walking along|standing at) /, "")}, the ${b.camera.replace(/^an? /, "")} and the timing exactly as in @source. Replace only his clothing with ${o.en}${needsRef ? " (cut, colour, fabric and details exactly as in @outfit)" : ""}: it fits his body and follows his movement and gestures naturally, lit by the source's own light with the same key direction and shadows, the fabric's real texture and folds. Nothing else in the frame changes. ${LOCK_CLAUSE.replace("the same wardrobe unless changed above; ", "")}\n\nSFX and source dialogue only: his own voice as in the source; a faint fabric rustle on his movements.`;
    return { kind: "outfit", ask, after: `his clothes become ${o.en}`, ref, prompt, check: ["the face and hair against the source", "the clothes follow his gestures without sliding", "the collar and sleeves meet skin cleanly", "the place untouched"] };
  },
  relight: (r, b) => {
    const l = r.pick(RELIGHTS);
    const ask = r.pick([`غيّر الإضاءة إلى ${l.ar} وخل ${b.whoAr} نفسه`, `خل الوقت ${l.ar} في نفس الفيديو`, `أبي نفس اللقطة بس بإضاءة ${l.ar}`, `حوّل الجو إلى ${l.ar} بدون ما تغيّر وجهه`]);
    const prompt = `${head(b, "the light and the time of day", r.pick(GRADES))}\n\nOne continuous shot, ${b.camera}, same framing as @source. ${fence(b)} Relight the whole frame from ${l.from} to ${l.to}: the new light falls on him and on the place alike, consistent across his face, clothes and the ground, with matched shadow direction and softness, reflections and bounce where the surfaces ask for it; his identity, expression, lip movement and wardrobe are locked while only light and grade change. ${LOCK_CLAUSE}\n\nSFX and source dialogue only: his own voice as in the source, the room tone unchanged.`;
    return { kind: "relight", ask, after: `relit to ${l.to}`, prompt, check: ["the face still his under the new light (the riskiest change)", "one consistent light direction on face, clothes and ground", "no flicker through the clip", "lip movement unchanged"] };
  },
  weather: (r, b) => {
    const w = r.pick(WEATHERS);
    const timed = w.en.startsWith("between");
    const ask = r.pick([`حط ${w.ar} في الفيديو وخل ${b.whoAr} نفسه`, `غيّر الطقس إلى ${w.ar}`, `أبي نفس اللقطة بس فيها ${w.ar}`, `أضف ${w.ar} على المشهد بدون ما يتغير الشخص`]);
    const prompt = `${head(b, "the weather and the sky", r.pick(GRADES))}\n\nOne continuous shot, ${b.camera}, same framing as @source. ${fence(b)} Change the weather: ${w.en}${timed ? "; everything outside that window unchanged" : ""}. The weather touches the plate truthfully — the sky, the ground, the surfaces, his hair and shoulders — with the light adjusted only as that weather would adjust it, the same key direction kept. ${LOCK_CLAUSE}\n\nSFX and source dialogue only: his own voice as in the source, the weather's own sound under it.`;
    return { kind: "weather", ask, after: w.en, prompt, check: ["the weather affects surfaces and clothes, not only the sky", "his face unchanged", "the light direction kept", timed ? "the change stays inside its seconds" : "steady through the clip"] };
  },
  add: (r, b) => {
    const a = r.pick(ADDS);
    const creature = /lion|falcon|cat|retriever|creature/.test(a.en);
    const ref = /lion|falcon|retriever/.test(a.en) ? { name: a.en.includes("lion") ? "lion" : a.en.includes("falcon") ? "falcon" : "dog", holds: "a reference photo of the real animal: its fur or feathers, face and anatomy" } : undefined;
    const ask = r.pick([`أضف ${a.ar} في نفس الفيديو وخل وجه ${b.whoAr} نفسه`, `حط ${a.ar} في الفيديو بشكل واقعي بدون ما تغيّر وجهه`, `أبي ${a.ar} يدخل على اللقطة في الفيديو بدون ما يتغير الشخص`, `خل فيه ${a.ar} في نفس الفيديو وخل الباقي نفسه`]);
    const prompt = `${head(b, `an added element: ${a.en.split(",")[0]}`, r.pick(GRADES), ref)}\n\nOne continuous shot, ${b.camera}, same framing as @source. ${fence(b)} Add ${a.en}${ref ? `, its look and texture from @${ref.name}` : ""}: it starts, moves and settles over the seconds with real weight and physics, interacts with the plate — the light it throws or catches, a real soft-edged contact shadow where it touches, matched to the source's key direction, haze and depth of field${creature ? "; fully photoreal, true anatomy, never CG, plastic or cartoonish" : ""}. He stays unaware, mid-delivery, his performance untouched. ${LOCK_CLAUSE}\n\nSFX and source dialogue only: his own voice as in the source, then the element's own sound, specific and ordered.`;
    return { kind: "add", ask, after: `added: ${a.en.split(",")[0]}`, ref, prompt, check: ["the element's shadow and light match the source", "its scale as stated", creature ? "real fur or feathers, not CG" : "its physics over time", "his performance untouched"] };
  },
  remove: (r, b) => {
    const x = r.pick(REMOVES);
    const ask = r.pick([`احذف ${x.ar} من الفيديو وخل الباقي نفسه`, `شيل ${x.ar} بدون ما يتغير ${b.whoAr}`, `أبي نفس اللقطة بس بدون ${x.ar}`, `امسح ${x.ar} من المشهد`]);
    const prompt = `${head(b, `one removal: ${x.en}`, "neutral grade matched to the source")}\n\nOne continuous shot, ${b.camera}, same framing as @source. ${fence(b)} Remove ${x.en} for the whole clip and fill the gap naturally with what the scene would show behind it, matching the light, the perspective, the texture and the grain, consistent from frame to frame with no smear or shimmer. Nothing else in the frame changes. ${LOCK_CLAUSE}\n\nSFX and source dialogue only: his own voice as in the source, the room tone unchanged.`;
    return { kind: "remove", ask, after: `removed: ${x.en}`, prompt, check: ["the fill is steady, no smear across frames", "the perspective of the fill is right", "nothing else moved", "his face unchanged"] };
  },
  restyle: (r, b) => {
    const s = r.pick(STYLES);
    const ask = r.pick([`حوّل الفيديو إلى ستايل ${s.ar} ونفس الحركة ونفس الوجه`, `خل اللقطة في الفيديو ${s.ar} بس بنفس وجهه وحركته`, `أبي نفس الفيديو بس بستايل ${s.ar} ونفس الوجه`, `غيّر ستايل الفيديو إلى ${s.ar} بدون ما تغيّر وجهه ولا اللقطة`]);
    const prompt = `${head(b, "the visual style", s.en)}\n\nOne continuous shot, ${b.camera}, same framing as @source. Restyle the entire shot into ${s.en} while the composition, the motion, the timing and his lip movement are the source's exactly: his face, build, hair and clothes recognisably his, translated into this medium, not redrawn into someone else; the place the same place in this look. ${LOCK_CLAUSE}\n\nSFX and source dialogue only: his own voice as in the source.`;
    return { kind: "restyle", ask, after: `restyled: ${s.en}`, prompt, check: ["he is still recognisably himself in the new medium", "the motion and timing untouched", "the lip movement matches his voice", "one consistent style through the clip"] };
  },
};

// ───────────────────────────── the bank ─────────────────────────────

export const TRANSFORM_CASES = 1000;
let bank: TransformCase[] | null = null;

/** A thousand worked before→after cases (the same every time), spread evenly over the eight kinds. */
export function transformCases(count = TRANSFORM_CASES): TransformCase[] {
  if (bank && count === TRANSFORM_CASES) return bank;
  const r = new Rng(60_203);
  const out: TransformCase[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (out.length < count && guard++ < count * 30) {
    const kind = TRANSFORM_KINDS[out.length % TRANSFORM_KINDS.length].id;
    const who = r.pick(MEN);
    const place = r.pick(PLACES);
    const action = r.pick(ACTIONS);
    const before: TransformCase["before"] = { who: who.en, whoAr: who.ar, wardrobe: who.en.replace(/^.* in /, ""), place: place.en, placeAr: place.ar, action: action.en, actionAr: action.ar, camera: r.pick(CAMERAS), light: r.pick(LIGHTS), seconds: r.pick(SECONDS), ratio: r.pick(RATIOS) };
    const made = MAKERS[kind](r, before);
    const sig = `${made.ask}|${made.prompt}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({ id: `${TRANSFORM_PLAYBOOK_ID}-${out.length + 1}`, before, settings: { ratio: before.ratio, resolution: "720p", duration: before.seconds, audio: true }, ...made });
  }
  if (count === TRANSFORM_CASES) bank = out;
  return out;
}

const tokens = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .normalize("NFC")
      .replace(/[ً-ْٰـ]/g, "")
      .replace(/[إأآ]/g, "ا")
      .replace(/ة/g, "ه")
      .split(/[^\p{L}\p{N}]+/u)
      .map((w) => w.replace(/^(ال|لل|بال|وال|ل|ب|و)(?=.{3})/, ""))
      .filter((w) => w.length >= 2),
  );

/** The kind a transformation request asks for (by its words), or null. */
export function detectTransformKind(text: string): TransformKind | null {
  let t = ` ${text.toLowerCase().replace(/[إأآ]/g, "ا").replace(/ة/g, "ه").replace(/[ًٌٍَُِّْ]/g, "")} `;
  // the guard phrases (what must stay) and the person's description say nothing about the change: taken out first
  t = t
    .replace(/بدون ما (تغير|يتغير) (وجهه|الشخص|شي ثاني|اللقطه)( ولا اللقطه)?/g, " ")
    .replace(/و?خل( وجه)? (شاب|رجل|ولد|موظف|شيف|طالب)[^،,.]*? نفسه(?=\s|$)/g, " ")
    .replace(/و?(خل الباقي نفسه|نفس المكان ونفس الحركه|نفس الحركه ونفس الوجه|نفس الحركه|نفس الوجه|بنفس وجهه وحركته|حافظ على وجهه وحركته|بنفس اللقطه)/g, " ")
    .replace(/اللي بيد [^،,.]*? بـ/g, " بـ")
    .replace(/في (نفس )?الفيديو|على المشهد|على اللقطه|في اللقطه/g, " ");
  const has = (...ws: string[]) => ws.some((w) => t.includes(w));
  if (has("ستايل", "style", "انمي", "كرتون", "مائيه", "ابيض واسود", "كوميك", "رسم بالقلم", "فيلم قديم", "سينمائي")) return "restyle";
  if (has("الاضاءه", "اضاءه", "الوقت", "الجو الى", "relight")) return "relight";
  if (has("طقس", "مطر", "غبار", "ضباب", "عاصفه", "غيوم", "برق", "weather", "rain") || /\s(شمس|ثلج)\s/.test(t)) return "weather";
  if (has("لبس", "ملابس", "لابس", "outfit", "clothes")) return "outfit";
  if (has("احذف", "شيل", "امسح", "بس بدون", "remove", "delete")) return "remove";
  if (has("بيئه", "خلفيه", "مكان", "نقل", "environment", "background", "بدل في ", "بدل على ", "بدل عند ", "خله ")) return "environment";
  if (has("بدل", "استبدل", "يصير", "الى", "replace", "swap")) return "object";
  if (has("اضف", "حط ", "خل فيه", "يدخل", "add")) return "add";
  return null;
}

/** The closest cases to a message (its kind first, then shared words). */
export function nearestTransformCases(message: string, k = 3): TransformCase[] {
  const kind = detectTransformKind(message);
  const q = tokens(message);
  const seenAsk = new Set<string>();
  const scored = transformCases().flatMap((c) => {
    if (seenAsk.has(c.ask)) return [];
    seenAsk.add(c.ask);
    const t = tokens(c.ask);
    let score = c.ask === message ? 100 : 0;
    if (kind && c.kind === kind) score += 6;
    for (const w of q) if (t.has(w)) score += w.length >= 4 ? 2 : 1;
    return [{ c, score }];
  });
  scored.sort((a, b) => b.score - a.score || a.c.id.localeCompare(b.c.id));
  return scored.slice(0, k).map((x) => x.c);
}

/** The cases as the assistant sees them in a turn: the clip before, the ask, the prompt, what to check after. */
export function transformCasesBrief(list: TransformCase[]) {
  if (!list.length) return "";
  return `WORKED BEFORE→AFTER CASES like this one (follow their shape; the source line must describe THIS person's clip):\n${list
    .map((c, i) => `${i + 1}. Before: ${c.before.who}, ${c.before.place}, ${c.before.action}; ${c.before.camera}; ${c.before.light}; ${c.before.seconds}s ${c.before.ratio}.\n   Request: «${c.ask}»\n   After: ${c.after}${c.ref ? ` (second reference @${c.ref.name}: ${c.ref.holds})` : ""}\n   generator options: ${JSON.stringify(c.settings)}\n   prompt: ${c.prompt}\n   check: ${c.check.join("; ")}`)
    .join("\n")}`;
}
