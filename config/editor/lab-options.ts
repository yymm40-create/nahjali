// «مختبر الموشن» — the CHOICES the person can make before حيدرة plans: the look, the structure, how the shots connect,
// the motion feel, the pace, the camera, the type, the finish and the ending. Distilled from ~110 sources (the 70
// most-watched Claude-made pieces and their prompts, ~90 open motion skills, the owner's two Higgsfield skills — see
// research_notes/موشن جرافيكس بكلود كود/lab_styles_from_100_sources.md). Every option carries the English "prompt"
// that goes into the plan as a BINDING instruction, and the skill files worth opening for it. Pure data; used by the
// server (the plan) and the browser (the gallery). The samples are drawn live in the page (src/components/jawad/editor/
// lab-demos.ts), never generated pictures.

export type ChoiceKey = "look" | "structure" | "connect" | "feel" | "pace" | "camera" | "type" | "finish" | "ending";

export interface LabOption {
  id: string;
  /** the name the person reads */
  ar: string;
  en: string;
  /** one line under the name */
  tip: string;
  /** the binding instruction for the plan (English, for حيدرة) */
  prompt: string;
  /** where it comes from (a skill, a viral piece, a measured study) — shown small */
  from: string;
  /** the colours of its live sample (and, for looks, the palette حيدرة starts from) */
  swatch?: { bg: string; ink: string; accent: string };
  /** the owner's Higgsfield files to open for it (catalogue ids) */
  refs?: string[];
  /** the kind of live sample the gallery draws */
  demo: string;
}
export interface LabGroup {
  id: ChoiceKey;
  ar: string;
  /** what the choice decides, one line */
  hint: string;
  /** more than one may be picked (up to max) */
  multi?: boolean;
  max?: number;
  options: LabOption[];
}

const TRANSITIONS = "higgsfield-motion-saas/references/transitions.md";
const TECHNIQUES = "higgsfield-motion-saas/references/techniques.md";
const EASE = "higgsfield-motion-saas/references/ease-math.md";
const VISUAL = "higgsfield-motion-saas/references/visual-language.md";
const STYLES = (n: number) => `higgsfield-motion/references/parts/20_part2_3_styles_derive.md#${n}`;
const MOTION = (n: number) => `higgsfield-motion/references/parts/12_part1c_motion_time.md#${n}`;
const TYPE = (n: number) => `higgsfield-motion/references/parts/11_part1b_type_colour.md#${n}`;

export const LAB_GROUPS: LabGroup[] = [
  {
    id: "look",
    ar: "الأسلوب البصري",
    hint: "الشكل العام: الألوان، المادة، نوع الخط، الكثافة. يبدأ منه حيدرة ويلتزم به.",
    options: [
      { id: "swiss-editorial", ar: "سويسري تحريري", en: "Swiss editorial", tip: "أبيض/أسود، خط عريض نظيف، مسطرة حمراء واحدة، أرقام ضخمة «01»", prompt: "LOOK: Swiss editorial (K.HFT.theme('swiss-editorial')): flat, sharp, neo-grotesk, asymmetric editorial grid, ONE red accent used as a 4 px rule or a giant index number; no texture, no glow.", from: "مهارة المالك · بريسِت swiss-editorial", swatch: { bg: "#f4f3ef", ink: "#111111", accent: "#e4321b" }, refs: [STYLES(10)], demo: "look-editorial" },
      { id: "luxury-serif", ar: "فخامة سيريف", en: "Luxury serif", tip: "أسود عميق، ذهب/برونز خافت، خط نسخي رفيع، حركة بطيئة", prompt: "LOOK: Luxury serif (K.HFT.theme('luxury-serif')): near-black tonal ground, subtle metallic gold, a tall elegant display face (Arabic: a refined naskh), sparse minimal-centred composition, luxury-slow motion, no texture.", from: "مهارة المالك · بريسِت luxury-serif", swatch: { bg: "#0e0d0b", ink: "#f1ebdd", accent: "#c9ae7c" }, refs: [STYLES(11)], demo: "look-luxury" },
      { id: "playful-pop", ar: "بوب مرح", en: "Playful pop", tip: "ألوان ثنائية مشبّعة، أشكال مدوّرة، هالفتون، ارتداد مرح", prompt: "LOOK: Playful pop (K.HFT.theme('playful-pop')): saturated duotone, round clay-like shapes, maximal collage, halftone texture, playful bouncy motion (overshoot allowed on badges only).", from: "مهارة المالك · بريسِت playful-pop", swatch: { bg: "#ffe7f1", ink: "#1a1026", accent: "#ff5fa2" }, refs: [STYLES(12)], demo: "look-pop" },
      { id: "cinematic-noir", ar: "نوار سينمائي", en: "Cinematic noir", tip: "ظلام وحبيبات، خط مكثّف، ضوء كهرماني واحد", prompt: "LOOK: Cinematic noir (K.HFT.theme('cinematic-noir')): mono palette on deep black, grain, one amber light source, condensed display type, sparse asymmetric frames, cinematic slow moves with motion blur.", from: "مهارة المالك · بريسِت cinematic-noir", swatch: { bg: "#0a0a0c", ink: "#e8e4dc", accent: "#e9a04a" }, refs: [STYLES(13)], demo: "look-noir" },
      { id: "soft-pastel-ui", ar: "باستيل ناعم", en: "Soft pastel UI", tip: "ألوان هادئة، كروت زجاجية بظلال ناعمة، حركة منتِجة", prompt: "LOOK: Soft pastel UI (K.HFT.theme('soft-pastel-ui')): pastel palette, soft shadows and frosted glass cards, round shapes, geometric sans, balanced density, calm productive motion.", from: "مهارة المالك · بريسِت soft-pastel-ui", swatch: { bg: "#eef0ff", ink: "#23243a", accent: "#9d8cff" }, refs: [STYLES(14)], demo: "look-pastel" },
      { id: "tech-terminal", ar: "تيرمنال تقني", en: "Tech terminal", tip: "أسود، مونو، سيان، خطوط سكان، مؤشر يرمش", prompt: "LOOK: Tech terminal (K.HFT.theme('tech-terminal')): black ground, monospace type, cyan signal accent, scanlines, left-axis keynote layout, glitch-tech motion (controlled, never on every cut), blinking caret.", from: "مهارة المالك · بريسِت tech-terminal", swatch: { bg: "#06090c", ink: "#d9f6ff", accent: "#2bd9ff" }, refs: [STYLES(15)], demo: "look-terminal" },
      { id: "brutalist-raw", ar: "بروتالي خام", en: "Brutalist raw", tip: "أصفر وأسود، خط ممتد ضخم، شبكة قاسية، قصّ حاد", prompt: "LOOK: Brutalist raw (K.HFT.theme('brutalist-raw')): signal yellow on black, expanded display type led poster layout, hard grid, halftone, hard cuts and shifting blocks.", from: "مهارة المالك · بريسِت brutalist-raw", swatch: { bg: "#101010", ink: "#f5f5f0", accent: "#ffd500" }, refs: [STYLES(16)], demo: "look-brutal" },
      { id: "organic-editorial", ar: "ورقي تحريري", en: "Organic editorial", tip: "ورق كريمي بحبيبات، سيريف تحريري، طيني دافئ، حركة بطيئة", prompt: "LOOK: Organic editorial (K.HFT.theme('organic-editorial')): cream paper grain, tonal warm palette with a terracotta accent, editorial serif (Arabic: naskh), soft shapes, luxury-slow motion.", from: "مهارة المالك · بريسِت organic-editorial", swatch: { bg: "#f2e8cf", ink: "#2b2520", accent: "#c2643f" }, refs: [STYLES(17)], demo: "look-paper" },
      { id: "y2k-chrome", ar: "Y2K كروم", en: "Y2K chrome modern", tip: "كروم وطيف ألوان، زجاج، خط ممتد، كبسولات", prompt: "LOOK: Y2K chrome modern (K.HFT.theme('y2k-chrome-modern')): spectral gradient, chrome and modern glass, pill shapes, expanded display type, expressive motion.", from: "مهارة المالك · بريسِت y2k-chrome-modern", swatch: { bg: "#0b0f1a", ink: "#f2f6ff", accent: "#8fe3ff" }, refs: [STYLES(18)], demo: "look-chrome" },
      { id: "kinetic-type", ar: "تايب حركي", en: "Kinetic type", tip: "أحادي اللون، كلمة واحدة تملأ الكادر، كل ضربة كلمة", prompt: "LOOK: Kinetic type (K.HFT.theme('kinetic-type')): mono palette with one electric blue accent, poster type-led, one word fills the frame, a new word on every beat, flat and sharp.", from: "مهارة المالك · بريسِت kinetic-type · @higgsfield_ai typography reel", swatch: { bg: "#0b0b10", ink: "#f2f0eb", accent: "#3346ff" }, refs: [STYLES(19), MOTION(1)], demo: "look-kinetic" },
      { id: "dot-matrix", ar: "دوت ماتريكس", en: "Dot matrix", tip: "شبكة نقاط نيون، حروف بكسل، «الجهاز يفكّر»", prompt: "LOOK: Dot matrix (K.HFT.theme('dot-matrix')): dot-grid texture, pixel display type, neon light on black, minimal centred, glitch-tech motion; everything built from dots.", from: "مهارة المالك · بريسِت dot-matrix", swatch: { bg: "#050505", ink: "#f4f4f0", accent: "#f4f4f0" }, refs: [STYLES(20)], demo: "look-dots" },
      { id: "paper-collage", ar: "كولاج ورقي", en: "Paper cut-out collage", tip: "ورق مقصوص وهالفتون أبيض/أسود على ألوان صريحة، ستوب-موشن", prompt: "LOOK: Paper cut-out collage: flat saturated paper grounds (deep purple, mustard, red, teal), black-and-white halftone photo cut-outs, cardstock accents, tape and marker type; pieces slide in one at a time and settle with a stop-motion feel (hold poses 2 frames); nothing fades.", from: "gbro-collage-broll (1.4k★) · VOX collage · anidoodle cut-paper", swatch: { bg: "#3b2a6b", ink: "#fff7e6", accent: "#f2b134" }, refs: [TYPE(6)], demo: "look-collage" },
      { id: "dark-tech-hud", ar: "تقني داكن HUD", en: "Dark tech HUD", tip: "أزرق داكن، خطوط رفيعة، حقل تدفّق، أرقام تتدحرج", prompt: "LOOK: Dark tech HUD: deep navy-black, thin luminous lines, a flow field or point cloud, rolling counters, restrained bloom; the HUD elements must be the product's own output, never decoration.", from: "RuiC-motion-reel dark tech · lemo-opuscar hologram HUD", swatch: { bg: "#070b14", ink: "#dfe8ff", accent: "#4f8cff" }, refs: [TYPE(4)], demo: "look-hud" },
      { id: "keynote-light", ar: "كيبوت أبيض", en: "Apple-keynote light", tip: "أوف-وايت دافئ، UI أسود، زجاج سائل، لقطة واحدة، كل شيء على الضربة", prompt: "LOOK: Apple-keynote light: warm off-white canvas, black UI, liquid-glass panels over photos; text rises from a mask line, icons pop on a spring, bars draw across, pages push, a black shape floods the frame and contracts into the next scene; BANNED: crossfades, blur-ins, 3D flips, particles, glows, holds over one second.", from: "@twoclipping Apple-keynote launch (138K) · IskakovDamir/apple-motion", swatch: { bg: "#f7f4ee", ink: "#0a0a0a", accent: "#0a0a0a" }, refs: [TRANSITIONS, VISUAL], demo: "look-keynote" },
      { id: "gulf-gold", ar: "خليجي ذهبي", en: "Gulf gold", tip: "أخضر/أزرق عميق، ذهب نحاسي، زخرفة هندسية تتجمّع من جزيئات", prompt: "LOOK: Gulf gold: deep dark ground (emerald or midnight), brass-gold accent, Arabic display type (kufi or thuluth-like display) right to left, geometric Islamic patterns assembling from particles and lines drawing themselves; restrained bloom, grain.", from: "قواعد المختبر العربية · حملات خليجية", swatch: { bg: "#0b2a22", ink: "#f4ecd8", accent: "#d4af37" }, refs: [TYPE(3)], demo: "look-gulf" },
      { id: "hand-drawn", ar: "رسم يدوي/سبورة", en: "Hand-drawn / whiteboard", tip: "ورق أوف-وايت، حبر أزرق، لمسة برتقالية، الخطوط تُرسم لا تتلاشى", prompt: "LOOK: Hand-drawn notes: off-white paper, ink-blue line work, one orange accent, rough strokes; every mark is DRAWN in stroke order (K.drawOn), characters appear as if written; a wobble of 1–2 px on twos.", from: "chuspeeism hand-drawn notes · explainroo · motalim whiteboard", swatch: { bg: "#f8f5ec", ink: "#1f3a8a", accent: "#f08a24" }, refs: [TYPE(6)], demo: "look-sketch" },
    ],
  },
  {
    id: "structure",
    ar: "بنية الفيلم",
    hint: "كيف تُبنى اللقطات من أول ثانية لآخر إطار.",
    options: [
      { id: "one-take", ar: "لقطة واحدة متصلة", en: "One continuous shot", tip: "ما فيه قصّ: كل مشهد يُبنى من اللي قبله", prompt: "STRUCTURE: one continuous take — no cuts; each scene is built out of the previous one (a shape morphs, a camera dives, a colour floods); the last frame can hand back to the first.", from: "@twoclipping · AbubakrChan «One shape, never cut» · Reroll 0–7 s", demo: "struct-one-take" },
      { id: "pure-type", ar: "تايبوغرافي خالص", en: "Pure typography", tip: "كلمات فقط، كلمة ثقيلة واحدة لكل ضربة", prompt: "STRUCTURE: pure typography — words only, one idea per beat, one heavy key word 2–4× the filler words, mask reveals rising from a line, swaps in the same slot; no illustrations.", from: "iart kinetic quote · @higgsfield_ai typography reel", demo: "struct-type" },
      { id: "problem-gone", ar: "مشكلة → اختفت", en: "Problem → gone", tip: "فوضى تتكدّس، ثم ضربة واحدة تنظّفها", prompt: "STRUCTURE: problem → gone — the problem piles up visibly (clutter, errors, waiting), then ONE action clears it in a single satisfying motion; the product appears as the cause.", from: "bang-motion concept 3 · charlie947 explainer", demo: "struct-problem" },
      { id: "before-after", ar: "قبل / بعد", en: "Before / after", tip: "نفس الكادر، تنقسم أو تنمسح بين حالتين", prompt: "STRUCTURE: before / after — the same frame in two states; a wipe, a split or a relight carries from the old to the new; the direction of the wipe runs right→left for Arabic.", from: "bang-motion concept 4 · @twoclipping day→golden-hour relight", demo: "struct-before-after" },
      { id: "ui-journey", ar: "رحلة داخل الواجهة", en: "Journey inside the UI", tip: "مؤشر يضغط، الكاميرا تدخل مع كل نقرة", prompt: "STRUCTURE: journey inside the UI — a cursor clicks, drags and long-presses; the camera zooms so each moment fills the frame; the real screenshots (if given) are broken into animatable parts; no invented UI when a picture was given.", from: "bang-motion concept 5 · @HO_BA juicy screenshots · Strata/Halftone (المالك)", refs: [TECHNIQUES], demo: "struct-ui" },
      { id: "product-macro", ar: "ماكرو المنتج", en: "Product macro", tip: "الشيء وحده، قريب، ضوء يمسح، ظل تلامس", prompt: "STRUCTURE: product macro — the given picture alone at 60–70% of the frame on a ground sampled from its own colour, slow orbit-like parallax, a specular sweep, contact shadow, one burst frozen mid-air.", from: "bang-motion concept 6 · viral format 6", demo: "struct-macro" },
      { id: "object-metaphor", ar: "استعارة بشيء", en: "Object metaphor", tip: "شيء واحد يحكي الفكرة (كرة، حرف، أسطوانة)", prompt: "STRUCTURE: object metaphor — ONE hero object (a ball, a letter, a record, a prompt bar) travels the whole film and performs each idea; every scene is staged around it.", from: "Stephan Livera showreel (red ball) · BLIP./LO. (المالك)", demo: "struct-metaphor" },
      { id: "living-number", ar: "الرقم الحي", en: "Living number", tip: "رقم واحد يتدحرج ويكبر وهو القصة", prompt: "STRUCTURE: living number — one number is the hero: it counts on ticks, grows, splits into its parts, lands on the exact value with a hit; everything else supports it.", from: "bang-motion concept 8 · charlie947 milestone-reveal · population staircase", demo: "struct-number" },
      { id: "logo-stage", ar: "اللوقو مسرح", en: "Logo as stage", tip: "اللوقو هو الأرض اللي يحدث عليها كل شيء", prompt: "STRUCTURE: logo as stage — the given logo (never redrawn) is the ground: things happen on it, inside it, through its letters; its final reveal is the ending.", from: "bang-motion concept 12 · pixel2motion · @tdinh_me slow reveal", demo: "struct-logo" },
      { id: "object-relay", ar: "تناوب الأشياء", en: "Object relay", tip: "كل مشهد يسلّم شيئًا للمشهد اللي بعده", prompt: "STRUCTURE: object relay — each shot hands one object to the next (a cursor into a prompt bar, a card into a CTA, a tile into a full-frame colour); the hand-off rect is identical in screen pixels on both sides.", from: "bang-motion concept 13 · transitions.md §3 object carry (المالك)", refs: [TRANSITIONS], demo: "struct-relay" },
      { id: "claim-how-result", ar: "ادّعاء → كيف → نتيجة", en: "Claim → how → result", tip: "ثلاث فصول واضحة، كل فصل بنبرة", prompt: "STRUCTURE: claim → how → result — three acts: a bold claim (type-led), how it works (UI or diagram), the result (a number or a before/after), then a clean end card.", from: "bang-motion concept 15 · @alex_prompter 5-scene explainer", demo: "struct-acts" },
      { id: "infinite-zoom", ar: "زوم لانهائي", en: "Infinite zoom", tip: "كل مشهد مرسوم داخل اللي قبله، الكاميرا تغوص بلا توقف", prompt: "STRUCTURE: infinite zoom — each scene is drawn inside the previous one (a window, a pupil, a dot, a letter's counter); the camera zooms forever in log space; the last contains the first.", from: "viral format 8 · LO. Z 17 into the O (المالك)", refs: [TRANSITIONS], demo: "struct-zoom" },
      { id: "dust-word", ar: "غبار → كلمة", en: "Dust to word", tip: "آلاف الجزيئات تتجمّع كلمة، ضوء يمسحها، تتبعثر للمشهد التالي", prompt: "STRUCTURE: dust to word — thousands of particles (K.textPoints → K.swarm) fly on a curl flow and lock into the key word; a light sweep; then they blow away into the next shot; hook on frame 1.", from: "viral format 1 · @leo_xiaolei procedural 2D", demo: "struct-dust" },
      { id: "data-story", ar: "قصة بيانات", en: "Data story", tip: "الرسم البياني نفسه يحكي: ينمو، يتسارع، يفاجئ", prompt: "STRUCTURE: data story — the chart IS the story: bars grow on springs, a line draws itself and becomes the next shape, the pace of the data is dramatized (slow crawl, then snaps); one highlighted fact; real numbers only.", from: "lemo-opuscar data storytelling · iart population staircase · Vox-style (7wuYBfE131U)", demo: "struct-data" },
      { id: "showreel", ar: "فصول شوريل", en: "Showreel chapters", tip: "6–8 فصول قصيرة، كل فصل تقنية مختلفة، شيء واحد يربطها", prompt: "STRUCTURE: showreel chapters — 6–8 chapters of ~2 s, each a different technique (type, shape play, camera, colour shift, particles, 3D), one object or colour threading them, a hook in the first second and a clean final frame.", from: "@stephanlivera (2.3M) · @darel023 brief · RuiC 8 bars × 128 BPM", demo: "struct-reel" },
    ],
  },
  {
    id: "connect",
    ar: "ربط اللقطات",
    hint: "كيف تنتقل اللقطة للي بعدها (اختر حتى ٣؛ حيدرة يوزّعها).",
    multi: true,
    max: 3,
    options: [
      { id: "needle-zoom", ar: "زوم الإبرة", en: "Needle zoom", tip: "الشيء يبقى، العالم يتبدّل، أسرع إطار للزوم هو القصّ", prompt: "CONNECT: needle zoom — a persistent object breathes a zoom (×1.12, bezier .95/0/.05/1 over ±0.2 s) whose fastest frame is the cut; the backgrounds hard-cut underneath and never scale.", from: "transitions.md §1 (المالك) · Halftone", refs: [TRANSITIONS, EASE], demo: "con-needle" },
      { id: "fly-through", ar: "الغوص خلال شيء", en: "Fly-through", tip: "الكاميرا تطير داخل حرف أو زر؛ المشهد التالي يكمل بنفس الاتجاه", prompt: "CONNECT: fly-through — zoom ×6–12 in log space into the object (E.in(4–5), 0.45 s); the next shot starts FARTHER away (×0.26–0.4) and decelerates in; the direction never flips (check d(ln scale)/dt on both sides).", from: "transitions.md §2 (المالك) · LO. praised", refs: [TRANSITIONS], demo: "con-fly" },
      { id: "object-carry", ar: "حمل الشيء", en: "Object carry", tip: "شيء من المشهد الأول يصير جزءًا من الثاني بلا قصّ", prompt: "CONNECT: object carry — measure the object's screen rect at the hand-off; the incoming scene draws an identical copy there, the outgoing hides the original under it; the copy lifts (×1.05–1.12 + shadow, 0.1 s) and travels on E.smooth while the rest whips out.", from: "transitions.md §3 (المالك) · Strata", refs: [TRANSITIONS], demo: "con-carry" },
      { id: "grow-point", ar: "النمو من نقطة", en: "Grow from a point", tip: "النتائج تولد من الزر اللي صنعها", prompt: "CONNECT: grow from a point — results are born from the thing that produced them: start at ×0.06 at the button's centre, fly on gentle arcs (position E.out(3), scale soft, bank −6…+5°→0), centre first, sides +0.06/+0.12 s.", from: "transitions.md §4 (المالك) · Strata C3", refs: [TRANSITIONS], demo: "con-grow" },
      { id: "whip-smear", ar: "مسحة / ويب", en: "Smear & whip", tip: "العناصر تعبر حافة الكادر بسرعة والضبابية ترسم المسحة", prompt: "CONNECT: smear/whip — side objects travel ~1150 px on E.in(2) and stay opaque while crossing the frame edge (the sub-frame blur draws the smear); the incoming scene arrives from the opposite side on E.out(3) with equal speed across the cut; layered parallax (dots 0.5, type 1.0, UI 1.1, cursors 1.2).", from: "transitions.md §5 (المالك) · Strata v1", refs: [TRANSITIONS], demo: "con-whip" },
      { id: "ui-morph", ar: "تحوّل الواجهة", en: "UI morph", tip: "كرت يصير كرت، زر يصير CTA — بالحجم لا بالتكبير", prompt: "CONNECT: UI morph — morph the box SIZE never scale: outgoing +18% into the cut (bezier .66/0/.9/.1), incoming from −18% (.07/.44/.16/1); content swaps with a short blur; the label rolls, never two labels at once.", from: "transitions.md §6 · techniques.md SM.uiMorph (المالك)", refs: [TRANSITIONS, TECHNIQUES], demo: "con-morph" },
      { id: "mockup-handoff", ar: "تسليم الموك-أب", en: "Mockup hand-off", tip: "نفس الواجهة بنفس المكان عبر القصّ، الطاقة تنتقل لخاصية ثانية", prompt: "CONNECT: mockup hand-off — the same flat UI at the same screen rect and scale on both sides of the cut (a light→dark polarity flip is fine); after the cut the energy moves to another property (a tilt into an exploded layer stack).", from: "transitions.md §7 (المالك) · Strata s5→s6", refs: [TRANSITIONS], demo: "con-handoff" },
      { id: "flood", ar: "طوفان لون", en: "Colour flood", tip: "اللون الجديد ينتشر من نقطة الفعل (الزر المضغوط) ويملأ الكادر", prompt: "CONNECT: colour flood — the next state spreads from the ACTION POINT's screen position (the pressed button, the carried object) as a union of soft wobbling circles until it clears the farthest corner; fade text before the front reaches it.", from: "transitions.md §8 FILM.BG (المالك) · @twoclipping flood", refs: [TRANSITIONS], demo: "con-flood" },
      { id: "pour", ar: "صبّ أعمدة", en: "Column pour", tip: "أعمدة تنزل من المنتصف للخارج وتجلب الورقة الجديدة", prompt: "CONNECT: column pour — 48 px columns, centre-first stagger, each growing to full height in 0.34 s; the new ground is clipped to the columns; each front carries a few glyphs.", from: "transitions.md §8 pour (المالك) · LO.", refs: [TRANSITIONS], demo: "con-pour" },
      { id: "infinite-band", ar: "شريط لانهائي", en: "Infinite band", tip: "شريط يحمل الكلام ما ينتهي؛ الانتقال يحدث داخله", prompt: "CONNECT: infinite band — a band carrying the type is overscanned (+360 px each side); colour panels wipe through it right→left with 0.1 s stagger; the last panel is the next scene's ground and the band's clip opens to full frame at the cut.", from: "transitions.md §9 (المالك) · Kadra", refs: [TRANSITIONS], demo: "con-band" },
      { id: "geo-morph", ar: "تحوّل هندسي", en: "Geometric morph", tip: "الحرف O يصير كوكبًا؛ الشكل يتحوّل لشكل", prompt: "CONNECT: geometric morph — one shape becomes another (a letter's counter becomes a planet, a pill becomes a chart): K.springTo on size, radius and colour; the geometry is continuous, the rest hard-cuts.", from: "transitions.md §10 (المالك) · LO.", refs: [TRANSITIONS], demo: "con-geo" },
      { id: "state-change", ar: "تغيّر حالة بدل تلاشي", en: "State change, not a fade", tip: "ما شي يظهر أو يختفي بالشفافية — ينقلب، يتبدّل، يُدفع", prompt: "CONNECT: state changes instead of fades — nothing important appears or leaves by opacity alone: it is carried, grown, pushed, wiped, morphed or cut (the client's rule «не делай переходы через opacity»).", from: "transitions.md §11 · client-taste (المالك)", refs: [TRANSITIONS], demo: "con-state" },
      { id: "iris", ar: "إيريس", en: "Iris hand-off", tip: "دائرة تنغلق على الشعار أو تنفتح من نقطة", prompt: "CONNECT: iris hand-off — a circle closes on the object (or opens from the action point) into the wordmark; the iris edge is crisp, the motion E.in(3) then a soft landing.", from: "transitions.md §12 (المالك) · @twoclipping iris-blade · arabic-motion-graphics-skill IrisTransition", refs: [TRANSITIONS], demo: "con-iris" },
      { id: "hard-cut-beat", ar: "قصّ حاد على الضربة", en: "Hard cut on the beat", tip: "القصّ على الضربة وسرعة الحركة في قمتها لحظة القصّ", prompt: "CONNECT: hard cuts on the beat grid — every cut on a downbeat (120 BPM → 0.5 s multiples), the speed never zero at a cut, the cut rate rising toward the climax (0.85 s → 0.65 s); the direction of motion survives the cut.", from: "transitions.md §0 · motionmaxxing (96% hard cuts) · PHYLLA 45 cuts/30 s", refs: [TRANSITIONS, MOTION(6)], demo: "con-cut" },
      { id: "disintegrate", ar: "تفكّك غبار", en: "Disintegrate", tip: "صورة أو كلمة تذوب غبارًا ينجرف ويتكوّن العنصر التالي", prompt: "CONNECT: disintegrate — a picture or word dissolves into dust (K.imagePoints / K.textPoints, p 1→0, from 'explode', curl high) that drifts and re-forms as the next element.", from: "viral format 10 · DUST TO WORD", demo: "con-dust" },
    ],
  },
  {
    id: "feel",
    ar: "إحساس الحركة",
    hint: "شخصية الحركة: سرعتها، نعومتها، هل ترتدّ.",
    options: [
      { id: "house", ar: "منتِج ناعم (البيت)", en: "Productive / house", tip: "كل دخول = حركة + 0.96→1 + شفافية + ضبابية 8→0، على expo-out", prompt: "FEEL: productive/house — every entry combines move + scale (0.96→1) + opacity + blur (8→0 px) landing on expo-out; exits mirror on cubic-in at 60–75% of the entry; headline 0.6 s, hero 0.9 s, camera 1.5 s; overshoot only on chips (≤6%).", from: "client-taste §7 (المالك) · motionmaxxing softLand", refs: [MOTION(4)], demo: "feel-house" },
      { id: "luxury-slow", ar: "فخم بطيء", en: "Luxury slow", tip: "حركات طويلة 0.8–2 ث، ما فيه ارتداد، ضوء يمسح", prompt: "FEEL: luxury slow — moves 0.8–2 s on silk/outQuint, zero overshoot, long holds with a slow 2–4% push, a light sweep once per ~3 s, no snaps.", from: "HFT motionPersonality luxury-slow", refs: [MOTION(4)], demo: "feel-luxury" },
      { id: "kinetic-sharp", ar: "حركي حاد", en: "Kinetic sharp", tip: "0.15–0.3 ث، منحنيات قوية على الانتقالات فقط، شيء جديد كل ضربة", prompt: "FEEL: kinetic sharp — energy 0.15–0.3 s moves, strong in(3)/out(3) curves ONLY on transitions, soft inside scenes (0.45–0.7 s, overshoot ≤2%), something new on every beat.", from: "SaaS SKILL.md rule · @higgsfield_ai typography reel", refs: [EASE], demo: "feel-kinetic" },
      { id: "playful-bounce", ar: "مرح نابض", en: "Playful bounce", tip: "ارتداد 5–10٪ على الشارات، أشكال تتفتّح، مطاطية", prompt: "FEEL: playful bounce — elastic entrances with 5–10% overshoot on badges and props (never on type or opacity), blooming shapes, squash and stretch on landings.", from: "bang-motion pastel playful · HFT playful-bouncy", demo: "feel-bounce" },
      { id: "cinematic", ar: "سينمائي", en: "Cinematic", tip: "كاميرا واسعة بطيئة، ضبابية حركة، رامب سرعة، تركيز", prompt: "FEEL: cinematic — slow wide camera moves (3–6 s), 180° motion blur, a speed ramp into the reveal, rack focus 0.4–0.8 s, grain; hits land with a soft camera kick ≤6 px.", from: "HFT cinematic · client-taste camera rules", refs: [MOTION(7)], demo: "feel-cinema" },
      { id: "on-twos", ar: "يدوي على اثنين", en: "Hand-made on twos", tip: "كل وضعية تثبت إطارين، اهتزاز خفيف، ملمس مصنوع باليد", prompt: "FEEL: hand-made on twos — hold each pose 2 frames (12 fps feel inside a 30 fps film), 1–2 px wobble, strokes drawn in order, no motion blur; bounce is still banned as a default.", from: "charlie947 «on twos» · anidoodle paper-craft · @leo_xiaolei", demo: "feel-twos" },
    ],
  },
  {
    id: "pace",
    ar: "الإيقاع",
    hint: "سرعة النبض وكم شيء جديد يحدث.",
    options: [
      { id: "slow-60", ar: "٦٠–٨٠ سينمائي", en: "60–80 BPM cinematic", tip: "فخامة وتراث؛ شيء جديد كل 2–4 ث", prompt: "PACE: 60–80 BPM (cinematic/heritage); something new every 2–4 s; cuts on bars; the slowest shot ≥ 3× the fastest.", from: "amrit's prompt BPM table · explainer pacing", demo: "pace-60" },
      { id: "smooth-100", ar: "٩٠–١١٠ سلس", en: "90–110 BPM smooth", tip: "منتج/SaaS؛ شيء جديد كل 1–2 ث", prompt: "PACE: 90–110 BPM (smooth, effortless); something new every 1–2 s; no dead air over 0.6 s; listed reads only (status 1.0 s, name 0.6 s, three numbers 1.2 s).", from: "client-taste §8 (المالك) · amrit", demo: "pace-100" },
      { id: "kinetic-120", ar: "١١٥–١٢٣ حركي", en: "115–123 BPM kinetic", tip: "طاقة؛ كل ضربة حدث، قصّ على 0.5 ث", prompt: "PACE: 120 BPM kinetic — cuts on 0.5 s multiples, an event on every beat, the cut rate accelerating toward the climax, a riser into the drop.", from: "@twoclipping 120 BPM/54 beats · Strata · BLIP.", demo: "pace-120" },
      { id: "reel-128", ar: "١٢٨ ريل ٨ بارات", en: "128 BPM reel grid", tip: "15 ث = 8 بارات بالضبط، مشهد لكل بار", prompt: "PACE: 128 BPM reel grid — 15 s = exactly 8 bars; one scene per bar, every cut on a downbeat; build 0–30%, breathe, resolve.", from: "RuiC-motion-reel (450 frames, 8 scenes)", demo: "pace-128" },
    ],
  },
  {
    id: "camera",
    ar: "الكاميرا",
    hint: "كيف تتحرك العين على المشهد.",
    options: [
      { id: "drift", ar: "ثابتة بانسياب", en: "Locked with drift", tip: "تقريبًا ثابتة، دفع 2–4٪ على كل وقفة", prompt: "CAMERA: locked with drift — near-static, a 2–4% push on every hold, no whips; energy comes from the staging.", from: "MILLION_DOLLAR camera rule", demo: "cam-drift" },
      { id: "push", ar: "دفع وسحب", en: "Push / pull", tip: "تدخل على البطل وتتراجع لتكشف", prompt: "CAMERA: push/pull — pushes into the hero on reveals, pull-backs to show scale, ease in and out at both ends (zero slope), direction carried across cuts.", from: "client-taste §7 CA-02 (المالك)", refs: [MOTION(7)], demo: "cam-push" },
      { id: "parallax", ar: "2.5D بارالاكس", en: "2.5D parallax", tip: "3–5 طبقات عمق، قريب 1.5×، بعيد 0.3×، عمق مجال", prompt: "CAMERA: 2.5D parallax — 3–5 depth planes via K.camera/K.inSpace (near 1.5×, hero 1×, far 0.2–0.4×) with depth of field; the camera never stands still.", from: "viral format 4 · LO code rain parallax (المالك)", demo: "cam-parallax" },
      { id: "fly", ar: "طيران خلال", en: "Fly-through", tip: "الكاميرا تغوص في الأشياء وتخرج منها", prompt: "CAMERA: fly-through — the camera dives through objects (letters, buttons, windows) in log space and keeps flying forward on the other side; speed ramp fast → slow on the reveal.", from: "transitions.md §2 (المالك)", refs: [TRANSITIONS], demo: "cam-fly" },
      { id: "orbit", ar: "مدار", en: "Orbit", tip: "دوران بطيء 15–40° حول البطل؛ تمرّ على كل عنصر في «الكثير»", prompt: "CAMERA: orbit — slow orbits (15–40° over 4–6 s) around the hero; on a one→many beat fly the camera past every item (a ~200° carousel turn), never a static ring.", from: "client-taste CA-03 (المالك) · PLAY", demo: "cam-orbit" },
    ],
  },
  {
    id: "type",
    ar: "الخط العربي",
    hint: "صوت الخط في الفيلم (الخطان من كتالوج المختبر).",
    options: [
      { id: "heavy-display", ar: "عريض ثقيل", en: "Heavy display", tip: "كلمة ثقيلة تملأ 60–80٪ من العرض، تباين 900/300", prompt: "TYPE: heavy display — a black-weight Arabic display face (alexandria 900 / noto-kufi 900 class) for the key word at 60–80% of the width, thin 300 filler; ≤ 2 families.", from: "kinetic-type · brutalist-raw", demo: "type-heavy" },
      { id: "editorial-naskh", ar: "تحريري نسخي", en: "Editorial naskh", tip: "نسخ راقٍ للعناوين، سانس للنص، مسافات سخية", prompt: "TYPE: editorial naskh — a refined naskh display (amiri / noto-naskh class) for headlines, a clean sans for support, generous leading 1.4, diacritics room.", from: "luxury-serif · organic-editorial", demo: "type-naskh" },
      { id: "geometric-kufi", ar: "كوفي هندسي", en: "Geometric kufi", tip: "كوفي مربّع للعناوين، شبكة واضحة، أرقام كبيرة", prompt: "TYPE: geometric kufi — a geometric kufi (reem-kufi / kufam class) on a visible grid, giant index numbers, labels in caps-like small size ≥ 3.3% of the width.", from: "swiss-editorial · gulf-gold", demo: "type-kufi" },
      { id: "rounded-fun", ar: "مدوّر مرح", en: "Rounded playful", tip: "خط مدوّر ودود (بالو/مرحى)، كلمات تتفتّح", prompt: "TYPE: rounded playful — a rounded friendly display (baloo-bhaijaan-2 / marhey class), words bloom in whole (never letter by letter), colourful pills.", from: "playful-pop · soft-pastel-ui", demo: "type-round" },
    ],
  },
  {
    id: "finish",
    ar: "التشطيب",
    hint: "الطبقة الأخيرة على الصورة.",
    options: [
      { id: "grain-vignette", ar: "حبيبات + فينييت", en: "Grain & vignette", tip: "2–5٪ حبيبات كل إطار، فينييت 10–25٪", prompt: "FINISH: grain 2–5% every frame (K.grain), vignette 10–25%, one grade for the whole piece.", from: "MILLION_DOLLAR finish · claude-remotion 5-layer stack", demo: "fin-grain" },
      { id: "clean-flat", ar: "فلات نظيف", en: "Clean flat", tip: "بدون ملمس ولا توهّج؛ حواف حادة", prompt: "FINISH: clean flat — no texture, no glow, no vignette; crisp edges, blur 0 on UI.", from: "swiss-editorial · keynote-light", demo: "fin-flat" },
      { id: "bloom", ar: "بلوم وتوهّج", en: "Bloom & glow", tip: "توهّج مبرّر على البطل فقط، قوة 0.2–0.6", prompt: "FINISH: restrained bloom (strength 0.2–0.6) and a motivated rim/glow on the hero only; never a glow for its own sake, never the washed frame.", from: "dark-tech-hud · RuiC bloom threshold 0.68", demo: "fin-bloom" },
      { id: "halftone", ar: "طباعة هالفتون", en: "Halftone print", tip: "نقاط طباعة، لونان مع انزياح تسجيل", prompt: "FINISH: halftone print — a dot screen over tones, two inks with a slight registration offset, paper white never pure.", from: "anidoodle riso/newsprint · gbro halftone", demo: "fin-halftone" },
      { id: "anamorphic", ar: "عدسة أنامورفك", en: "Anamorphic lens", tip: "فلير أفقي، ضبابية خلفية، تشويه طفيف بالأطراف", prompt: "FINISH: anamorphic lens — horizontal flare on highlights, soft background blur, slight barrel at the edges, 180° motion blur (the photographic pass).", from: "SaaS lens.py pass (المالك) · طلب المالك «عدسة أنامورفك»", demo: "fin-lens" },
    ],
  },
  {
    id: "ending",
    ar: "النهاية",
    hint: "كيف ينتهي الفيلم.",
    options: [
      { id: "packshot", ar: "باكشوت نصي محتجز", en: "Held text packshot", tip: "كلمة العلامة أكبر، ثم CTA، 2 ث ثابتة بدفع ≤3٪", prompt: "ENDING: a clean centred text packshot — wordmark (bigger than on the title) → pill → CTA, staged one after another, landing on the final hit, held ≥ 2 s with a ≤3% push; no hero person, no orbit.", from: "client-taste §10 (المالك) · T-18", demo: "end-packshot" },
      { id: "loop", ar: "لوب سلس", en: "Seamless loop", tip: "آخر 0.5 ث تطابق البداية، للشبكة والستوري", prompt: "ENDING: a seamless loop — the last 0.5 s match frame 1 in position AND velocity; the piece can play forever on a grid or a story.", from: "AbubakrChan 14 s loop · viral format 2", demo: "end-loop" },
      { id: "cta", ar: "دعوة واضحة", en: "CTA hit", tip: "زر أو رابط يُكتب ويضرب على آخر ضربة", prompt: "ENDING: a CTA — the URL/handle typed on (TQ-quantised, with a caret) or a button that lands on the last beat; readable ≥ 2 s; safe zone respected.", from: "arabic-motion-graphics EndCard · SaaS FILM.typedN", demo: "end-cta" },
    ],
  },
];

export const LAB_GROUP_BY_ID = new Map(LAB_GROUPS.map((g) => [g.id, g]));

/** The person's picks, by group (ids); a group left out means «حيدرة يختار». */
export type LabChoices = Partial<Record<ChoiceKey, string[]>>;

/** Keeps only known ids, within each group's limit; drops empty groups. */
export function readChoices(raw: unknown): LabChoices {
  const out: LabChoices = {};
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  for (const g of LAB_GROUPS) {
    const v = o[g.id];
    const ids = (Array.isArray(v) ? v : typeof v === "string" ? [v] : []).map((x) => String(x ?? "").trim());
    const known = ids.filter((id, i) => g.options.some((op) => op.id === id) && ids.indexOf(id) === i).slice(0, g.multi ? g.max ?? 3 : 1);
    if (known.length) out[g.id] = known;
  }
  return out;
}

/** The chosen options, in the catalogue's order. */
export function chosenOptions(c: LabChoices): { group: LabGroup; option: LabOption }[] {
  const out: { group: LabGroup; option: LabOption }[] = [];
  for (const g of LAB_GROUPS) for (const id of c[g.id] ?? []) {
    const option = g.options.find((o) => o.id === id);
    if (option) out.push({ group: g, option });
  }
  return out;
}

/** What the plan receives: the picks as binding instructions (empty string when nothing was picked). */
export function choicesText(c: LabChoices): string {
  const picks = chosenOptions(c);
  if (!picks.length) return "";
  const lines = picks.map(({ option }) => `- ${option.prompt}`);
  const looks = picks.filter((p) => p.group.id === "look").map((p) => p.option.swatch).filter(Boolean) as NonNullable<LabOption["swatch"]>[];
  const pal = looks.length ? `\nSTART THE PALETTE FROM THE CHOSEN LOOK: bg ${looks[0].bg}, ink ${looks[0].ink}, accent ${looks[0].accent} (adapt to the brand colours when given; keep its character).` : "";
  const missing = LAB_GROUPS.filter((g) => !c[g.id]?.length).map((g) => g.ar);
  return `THE PERSON'S CHOICES (BINDING — the plan, the shots and the program must follow every line; where they conflict with a default of yours, the choice wins):\n${lines.join("\n")}${pal}${missing.length ? `\nLeft to you: ${missing.join(", ")} — decide them from the brief and say what you chose in "say".` : ""}`;
}

/** The owner's skill files the picks ask for (catalogue ids, unique), to open with the plan. */
export function choicesRefs(c: LabChoices): string[] {
  const ids: string[] = [];
  for (const { option } of chosenOptions(c)) for (const r of option.refs ?? []) if (!ids.includes(r)) ids.push(r);
  return ids;
}
