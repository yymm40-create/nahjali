// «الجواد الذكي!» | JAWAD AI — the ten kinds of work people ask AI studios for most, and how «جواد» handles each.
// Shared by the server (the assistant's instructions and its examples) and the tests. Pure.
//
// Where the ten come from (read on 2026-10-08):
//   - Higgsfield's own catalogue through its API: Marketing Studio holds 649 templates — 418 «product shot» ones
//     (types product_shots and product_shots_people) and 231 «motion» ones (hypermotion, mixed_media, 2d_motion,
//     saas_motion) — and 87 «viral» effects (camera moves such as Earth zoom, Bullet time and Crash zoom; surreal ones
//     such as Clones, Vanish, Melting; split-screens with famous paintings; Y2K paparazzi). Its ad modes (page
//     marketing-studio-intro): TV Spot, UGC, Tutorial, Product Review, Unboxing, UGC Virtual Try-On, Hyper Motion,
//     Pro Virtual Try-On, Wild Card; plus posters and marketplace pictures.
//   - OpenArt's features: product image generator, headshot generator, photo to avatar (anime, 3D, illustrated),
//     style transfer, logo; its app's "business templates": product photos, virtual try-on, ad videos; photo-to-video.
//   - Freepik's suite (reviews): product photography and staging, background remover, retouch (clothes changer),
//     mockups, image to video, upscaling.
//   - Market reviews agree marketing and advertising is the largest use of AI images, social media next; text-to-image
//     is most sessions, image-to-image editing second.

import type { Settings } from "./types";
import { TRANSFORM_PLAYBOOK_ID } from "./video-transform";
import { FIGHT_PLAYBOOK_ID } from "./fight-scenes";

export type Studio = "image" | "video" | "audio";

export interface Playbook {
  id: string;
  /** Its name for the person. */
  name: string;
  /** What this kind of work is (one line for Claude). */
  what: string;
  /** Words (Arabic and English, lower-case) that point at it; the longest hits count most. */
  triggers: string[];
  /** Where it is best made; the others may still help (a voice for an ad, a first frame for a video). */
  studio: Studio;
  /** What to ask first (at most three; skip what the person already said). */
  ask: string[];
  /** How a strong prompt for it is built, in order. */
  recipe: string[];
  /** Options that fit it, per generator option key (the registry decides what exists). */
  settings: { image?: Settings; video?: Settings; audio?: Settings };
  /** What goes wrong when it is done carelessly. */
  pitfalls: string[];
  /** Full prompts that came out well (the examples the assistant learns the shape from). */
  exemplars: { ask: string; prompt: string; studio: Studio }[];
}

const IMG_PRODUCT: Settings = { aspect: "1:1", quality: "high", resolution: "hi" };

export const PLAYBOOKS: Playbook[] = [
  {
    id: "product-shot",
    name: "صورة منتج احترافية",
    what: "A clean studio or styled picture of ONE product (the person's photo of it as the reference) for a shop page, Amazon/Noon/Salla listing or an ad — Higgsfield's largest template family (product_shots: ice, water, stone, linen, pastel voids, floating, macro).",
    triggers: ["!صورة منتج", "!تصوير منتج", "!صور منتج", "!صورة احترافية", "!product shot", "!product photo", "!packshot", "+صوّر لي", "+صور لي", "+أبي صورته", "+ابي صورته", "+للمتجر", "+لأمازون", "+على خلفية", "+على رخام", "+على خشب", "+على ثلج", "+وسط رذاذ", "+طايف", "+على رمل", "+على حجر", "+على ستاند", "+على قماش", "+بين ورق", "+بجو", "منتج", "منتجي", "e-commerce", "listing", "catalog", "متجر"],
    studio: "image",
    ask: ["وش المنتج بالضبط، وعندك صورته؟ (ارفعها هنا وتصير المرجع)", "وين بتستخدم الصورة: صفحة متجر (خلفية بيضاء) ولا إعلان (خلفية مصمّمة)؟", "أي جو أو مادة تبيها: ثلج، ماء، رخام، خشب، قماش، لون سادة؟"],
    recipe: [
      "Start with the product named exactly and «@ref» for its photo: «keep the product exactly as in @ref: its shape, label, colours and text; do not redraw or change the label».",
      "The surface and the setting (a pedestal, water splash, ice, stone, linen, a seamless pastel void), then the camera (three-quarter, eye level or macro) and the lens feel.",
      "The light: soft studio key from the side, a rim light on the edge, soft shadow under the product, gentle reflection; no harsh glare on the label.",
      "The look: photoreal, sharp, commercial product photography, high-end. For a shop listing: pure white seamless background, centred, nothing else.",
      "What NOT to include: no hands, no extra products, no text on the picture (unless asked).",
    ],
    settings: { image: IMG_PRODUCT },
    pitfalls: ["The label text is rewritten with mistakes: tell the model to keep it exactly as in the reference photo.", "Too many props steal the picture: one product, one idea.", "A listing with a coloured background is refused by marketplaces: white for listings, styled for ads."],
    exemplars: [
      { studio: "image", ask: "أبي صورة لعطري للمتجر", prompt: 'Professional e-commerce product photo of the perfume bottle @ref, exactly as in @ref: same bottle shape, cap, label and text, unchanged. Centred on a pure white seamless background, eye-level three-quarter view, soft studio key light from the left, subtle rim light on the glass edges, soft natural shadow beneath, faint reflection. Photoreal, sharp, high-end commercial product photography. No hands, no other objects, no added text.' },
      { studio: "image", ask: "صورة إعلانية لكريم بجو ثلج", prompt: 'Advertising product shot of the face cream jar @ref (keep the jar, lid, label and text exactly as in @ref). The jar stands on a slab of clear ice with frost crystals, small ice cubes around it, cold blue-white studio light with a soft warm rim, shallow depth of field, macro feel, water droplets on the glass. Photoreal, luxurious skincare campaign, clean composition, no text, no people.' },
      { studio: "image", ask: "صورة قهوتي للانستغرام", prompt: 'Styled product photo of the coffee bag @ref (bag, label and text exactly as in @ref), standing on warm oak wood, a few roasted coffee beans scattered in front, a ceramic cup with latte art slightly behind and out of focus, morning window light from the right, soft shadows, cosy café mood. Photoreal, sharp on the bag, square composition, no added text.' },
    ],
  },
  {
    id: "product-lifestyle",
    name: "منتج مع ناس (لايف ستايل)",
    what: "The product in a real moment with a person using or holding it (Higgsfield's product_shots_people, UGC-style stills, OpenArt's lifestyle scenes): a hand holding the can, someone wearing the cap, a cup poured at breakfast.",
    triggers: ["!لايف ستايل", "!lifestyle", "!يمسك", "!يستخدم", "!بيد شاب", "!بيد رجل", "!بيد ولد", "!صورة واقعية", "!صورة طبيعية", "!model holding", "!in hand", "!ugc photo", "+مع شاب", "+مع رجل", "+مع ولد", "+مع شخص", "+مع ناس", "بيد", "استخدام", "واقعية"],
    studio: "image",
    ask: ["وش المنتج وعندك صورته؟", "مين يستخدمه في الصورة (رجل أو شاب أو طفل: العمر والستايل) ووين (مطبخ، شارع، مكتب، بحر)؟", "الجو: طبيعي بجوال، ولا تصوير حملة إعلانية؟"],
    recipe: [
      "«@ref» for the product with the same keep-it-exact instruction; the person described briefly (age range, look, clothing) doing ONE natural action with the product (holding, pouring, applying, wearing).",
      "The place and the time of day; candid framing (a phone-shot look for UGC, or a campaign look with a 50mm lens and shallow depth of field).",
      "Natural light named (window, golden hour, overcast); real skin texture; the product in focus and readable.",
      "Mood words (fresh, cosy, energetic) and the crop for the platform (9:16 story, 4:5 feed, 1:1).",
      "No text, no logos other than the product's own.",
    ],
    settings: { image: { aspect: "2:3", quality: "high", resolution: "hi" } },
    pitfalls: ["Hands and fingers go wrong around small products: ask for a simple grip and the product large in frame.", "A fake, too-perfect model reads as an ad: ask for candid, imperfect, phone-shot when UGC is wanted."],
    exemplars: [
      { studio: "image", ask: "صورة شاب يمسك علبة المشروب حقي", prompt: 'Lifestyle photo: a young man in his twenties in a casual summer outfit holds the drink can @ref (can, label and colours exactly as in @ref) up toward the camera with a relaxed smile, at a sunny beach boardwalk, golden hour light from behind, shallow depth of field, the can sharp and readable, candid phone-shot feel, real skin texture. Vertical 2:3 framing, no added text.' },
      { studio: "image", ask: "رجل يحط الكريم على وجهه في الحمام", prompt: 'UGC-style photo of a man in his thirties applying the moisturiser @ref (jar exactly as in @ref, open, in his hand) in a bright modern bathroom mirror, morning window light, towel on his shoulder, natural expression, iPhone-style candid framing, slightly soft background. The jar label clearly visible. No text.' },
      { studio: "image", ask: "صورة لكبوتي يلبسه شاب", prompt: 'Campaign-style photo of a young man wearing the cap @ref (cap shape, colour and logo exactly as in @ref) on a city street at dusk, 50mm lens, shallow depth of field, side light from a shop window, confident relaxed pose looking slightly off camera, cap sharp and prominent. Editorial streetwear mood, vertical framing, no text.' },
    ],
  },
  {
    id: "hyper-motion",
    name: "إعلان منتج CGI (هايبر موشن)",
    what: "A short fully CGI product commercial — Higgsfield's «Hyper Motion» — no people, no voice-over: the product is the hero, with dynamic camera moves, premium lighting and physics effects (splashes, powder bursts, ice, shattering, floating ingredients).",
    triggers: ["!هايبر موشن", "!هايبر", "!hyper motion", "!hypermotion", "!cgi", "!فيديو إعلاني", "!فيديو اعلاني", "!فيديو منتج", "!إعلان منتج", "!اعلان منتج", "!بدون ناس", "!بس المنتج", "!سبلاش", "!splash", "!product video", "!product ad", "!commercial", "+إعلان", "+اعلان", "+بطاقة", "+بطاقه", "تلاطم", "انفجار", "3d ad"],
    studio: "video",
    ask: ["وش المنتج وعندك صورته؟ (تصير الإطار الأول أو مرجع)", "وش الإحساس: طاقة وانفجار ألوان، ولا فخامة وهدوء؟", "فين ينعرض: ريلز 9:16 ولا شاشة 16:9، وكم ثانية؟"],
    recipe: [
      "One hero product (by @ref) with the keep-it-exact instruction; NO people, NO voice-over, NO text on screen.",
      "A camera plan in time: an opening macro or push-in, a sweeping orbit, a slow-motion hero moment, a final settle on the product, written as what happens second by second.",
      "A physics event matched to the product (a liquid splash for a drink, fruit and ice bursting, powder, fabric waves, light rays, cracking ice, floating ingredients).",
      "Premium CGI look: studio lighting with rim lights, reflective floor, controlled depth of field, 24 fps film feel, colours from the packaging.",
      "Sound (when the generator makes it): whooshes, impact hits, a liquid splash, a low musical bed; no speech.",
    ],
    settings: { video: { ratio: "9:16", resolution: "1080p", duration: 8, audio: true } },
    pitfalls: ["The product deforms during the orbit: say «the product keeps its exact shape and label throughout».", "Too many events in five seconds: one hero moment.", "Text on screen comes out wrong: leave it to the editor afterwards."],
    exemplars: [
      { studio: "video", ask: "إعلان هايبر موشن لعصيري", prompt: 'Hyper-motion CGI commercial, 8 seconds, no people, no voice-over. The juice bottle @ref (exact shape, label and colours of @ref throughout) stands on a glossy black reflective floor in a dark studio. 0–2 s: macro push-in on condensation drops on the bottle. 2–5 s: the camera sweeps a fast orbit as sliced oranges and ice cubes burst in from the sides in slow motion, a juice splash curls around the bottle without touching the label. 5–8 s: everything settles, the bottle lands centred under a warm rim light with a clean highlight. Premium product lighting, shallow depth of field, 24 fps cinematic. Sound: whoosh, ice clatter, a satisfying splash, soft bass hit at the end.' },
      { studio: "video", ask: "فيديو فخم لعطر", prompt: 'Luxury CGI perfume commercial, 10 seconds, no people, no voice-over, no on-screen text. The perfume bottle @ref (kept exactly as in @ref) rises slowly from dark silk fabric that ripples like water. 0–3 s: slow dolly in through drifting golden particles. 3–7 s: a gentle 180° orbit, light caustics travel across the glass, a single bloom of white jasmine petals floats past. 7–10 s: the bottle settles on a black marble pedestal, a soft spotlight, deep shadows. Elegant, slow, high-end fragrance ad; sound: airy pad, a soft chime, silk rustle.' },
      { studio: "video", ask: "اعلان لشيبس بطاقة عالية", prompt: 'High-energy hyper-motion snack ad, 6 seconds, vertical, no people, no voice. The chips bag @ref (exact bag and label of @ref) slams down onto a bright red studio floor, chips and chili flakes explode outward in slow motion, the camera whips around 360° low to the ground, then crash-zooms onto the bag which stands upright and sharp, a burst of red powder behind it. Bold saturated colours from the packaging, hard studio flashes, punchy. Sound: impact hit, crunch, whoosh, bass drop.' },
    ],
  },
  {
    id: "ugc-ad",
    name: "إعلان مراجعة (UGC) / أنبوكسنق",
    what: "A creator-style ad: a person talks to the camera about the product (review, tutorial, unboxing, try-on) in a real room with phone-style footage — Higgsfield's UGC, Tutorial, Product Review and Unboxing modes; OpenArt's «ad videos».",
    triggers: ["!ugc", "!يو جي سي", "!ريفيو", "!مراجعة", "!review", "!أنبوكسنق", "!انبوكسنق", "!unboxing", "!فتح الصندوق", "!يتكلم عنه", "!يشرح", "!للكاميرا", "!تجربتي", "!tutorial", "!إعلان بشخص", "!اعلان بشخص", "!يجرب", "!testimonial", "!تعليق صوتي", "!فويس أوفر", "!voice over", "!voiceover", "+مؤثر يتكلم", "+influencer", "+بصوت"],
    studio: "video",
    ask: ["وش المنتج، ومين يتكلم عنه (رجل أو شاب: العمر واللهجة)؟", "وش يقول بالضبط في 5–8 ثواني؟ (اكتبها لي، أو أكتب لك اقتراحًا)", "النوع: مراجعة، أنبوكسنق، شرح استخدام، ولا تجربة لبس؟"],
    recipe: [
      "A real-looking creator (age, look, clothing) in a real place (bedroom, kitchen, car, office), phone-shot look: front camera framing, handheld, natural window light, slightly imperfect.",
      "The product by @ref held up to the camera or being used; its label readable.",
      "The spoken line in double quotes, short (one or two sentences), with the generator's language rule (Seedance: Arabic lines transliterated in Latin letters); the person's mouth matches the words; genuine reaction for an unboxing.",
      "Shot order for 8 s: hook (face + product in the first second), the demo or reveal, the closing line.",
      "Sound on: room tone and the voice; no music over the speech.",
      "In the audio studio: write the voice-over text itself (Gulf Arabic, conversational, 20–35 words for 10 s), with a warm friendly delivery; pick the voice in the form.",
    ],
    settings: { video: { ratio: "9:16", resolution: "720p", duration: 8, audio: true }, audio: { stability: "0.5", diction: "precise" } },
    pitfalls: ["A polished studio look kills the UGC feel: phone camera, real room, no studio light.", "Long lines don't fit the seconds: 10–15 words per 5 seconds.", "A face from a photo isn't guaranteed to match: say it honestly."],
    exemplars: [
      { studio: "video", ask: "ريفيو لكريمي بصوت شاب سعودي", prompt: 'UGC-style product review, 8 seconds, vertical phone video, front camera, handheld, natural window light in a tidy bedroom. A Saudi man in his late twenties in a white thobe holds the face cream @ref (jar and label exactly as in @ref) up beside his face, smiles and says in Gulf Arabic: "Sarahatan hatha al-kreem ghayyar bashrati fi usboo‘, jarrabooh" — his lips match the words, he turns the jar to show the label, then gives a small thumbs up. Real skin texture, slight camera shake, room tone, clear voice, no music.' },
      { studio: "video", ask: "أنبوكسنق لسماعتي", prompt: 'Unboxing video, 8 seconds, vertical, phone-shot, handheld in a bright living room. A young man in a hoodie opens a cardboard box on a table, lifts out the headphones @ref (exactly as in @ref), his eyes widen with a genuine reaction, he turns them in his hands and says: "Wallah ashkal-ha ajmal min al-suwar" with matching lips, then puts them on. Natural daylight, real textures, box sounds and room tone, clear voice, no music.' },
      { studio: "audio", ask: "تعليق صوتي لإعلان قهوتي ١٠ ثواني", prompt: "صباحك قهوة… من أول رشفة تحس بالفرق. حبّة محمّصة بعناية، وريحة تعبّي البيت. جرّب قهوتنا اليوم، وخلّ صباحك يبدأ صح." },
    ],
  },
  {
    id: "thumbnail",
    name: "ثامبنيل يوتيوب / كفر",
    what: "A YouTube thumbnail (16:9) or a reel cover (9:16): one focal point, a big face with emotion on one side, 3–5 words of text on the other, high contrast — the most asked-for designed picture.",
    triggers: ["!ثامبنيل", "!ثمبنيل", "!ثامب", "!ثمب", "!thumbnail", "!كفر ريل", "!كفر", "!غلاف", "!صورة مصغرة", "!cover", "+يوتيوب", "+youtube", "حلقة"],
    studio: "image",
    ask: ["الفيديو عن إيش، ووش النص اللي تبيه يبين (3–5 كلمات)؟", "الإحساس: صدمة، فضول، فرح، جدّية؟ وأي ألوان أو هوية؟", "عندك صورتك عشان نحطك فيها؟ (أرفقها هنا)"],
    recipe: [
      "Aspect 16:9 (YouTube) or 9:16 (reel cover). ONE idea, ONE focal point.",
      "With the person's photo: design everything EXCEPT the person — background, effects, text, objects — and leave a clear area on one side («do not draw any person or face; leave the left third empty»); set thumbnailPerson/thumbnailSide so «ركّب الشخص» places their real photo.",
      "The text in double quotes, 3–5 words, thick outlined letters, high contrast against the background; its position stated.",
      "A bright simple or blurred background with one or two strong colours; glow or rim light where the person goes; bottom-right corner kept clear (the length badge).",
      "No clutter, no small details: it must read at 168×94 px on a phone.",
    ],
    settings: { image: { aspect: "16:9", quality: "high", resolution: "hi" } },
    pitfalls: ["Whole titles as text: three to five words.", "Faces redrawn by the model: use the cut-out from the real photo.", "Something important in the bottom-right corner."],
    exemplars: [
      { studio: "image", ask: "ثامبنيل لفيديو عن السفر لليابان", prompt: 'YouTube thumbnail 16:9. Right two-thirds: a bright, slightly blurred Tokyo street at night with neon signs in pink and cyan, a huge bold text "اليابان بـ ٣٠٠٠ ريال؟!" in thick white letters with a black outline and a yellow highlight word, high contrast, centred vertically. Left third left EMPTY with a soft warm glow and a faint rim light, no person and no face drawn anywhere. Clean, punchy, no small details, bottom-right corner clear.' },
      { studio: "image", ask: "كفر ريل لوصفة كيك", prompt: 'Reel cover 9:16. A glossy slice of chocolate cake on a white plate fills the lower half, dramatic warm side light, dark moody background, big bold text at the top third: "كيك بدون فرن" in thick cream-coloured letters with a dark brown outline, very high contrast, one focal point, no clutter, nothing in the bottom corners.' },
      { studio: "image", ask: "ثامبنيل لحلقة بودكاست عن الفلوس", prompt: 'YouTube thumbnail 16:9. Left third empty for the host (no person, no face drawn; a soft blue rim-light glow there). Right side: stacks of gold coins and a rising green arrow on a deep navy background, bold text "وين تروح فلوسك؟" in thick white letters with a black outline, the word "فلوسك" in yellow, high contrast, simple shapes, readable at phone size, bottom-right corner clear.' },
    ],
  },
  {
    id: "poster-social",
    name: "بوستر / منشور بنص (عروض، فعاليات، منيو)",
    what: "A designed picture that carries text — a sale announcement, an event poster, a menu item post, a quote card — for Instagram, Snapchat, WhatsApp or print (Higgsfield's «posters», Freepik's templates).",
    triggers: ["!بوستر", "!poster", "!منشور", "!بوست", "!post", "+ستوري", "+story", "!تصميم إعلان", "!تصميم", "!دعوة", "!منيو", "!menu", "!خصم", "+تخفيض", "!sale", "!عرض محدود", "!توصيل مجاني", "!افتتاح", "!بمناسبة", "+عرض", "+عروض", "+رمضان", "+العيد", "+اليوم الوطني", "+يوم التأسيس", "+الجمعة البيضاء", "+العودة للمدارس", "فعالية", "حفل", "سناب", "انستغرام", "انستقرام", "instagram"],
    studio: "image",
    ask: ["وش النص اللي لازم يبين حرفيًا (العنوان، السعر/التاريخ، سطر صغير)؟", "لمين وفين: ستوري 9:16، بوست 1:1 أو 4:5، ولا طباعة؟", "الهوية: ألوان، شعار (أرفقه)، والمزاج (فخم، مرح، رمضاني…)؟"],
    recipe: [
      "The exact text in double quotes, short (a headline of 2–4 words, one line of detail); say the hierarchy: headline largest, detail small; the position of each.",
      "Arabic text: ask for bold, clear, well-spaced letters; keep it to very few words because long Arabic text comes out with mistakes; offer to add fine print in the editor afterwards.",
      "The subject picture (the dish, the product by @ref, a festive motif) and the composition (subject one side, text the other, or text over a darkened area).",
      "The identity: 2–3 brand colours, the logo by @ref placed small in a corner, the mood.",
      "The aspect for the platform; safe margins; no clutter.",
    ],
    settings: { image: { aspect: "9:16", quality: "high", resolution: "hi" } },
    pitfalls: ["Paragraphs of text on the picture come out wrong: 2–6 words, the rest added in the editor.", "Logos redrawn: the logo as a reference, «keep @logo exactly».", "Important text too close to the edges of a story."],
    exemplars: [
      { studio: "image", ask: "ستوري لعرض خصم ٥٠٪ على العطور", prompt: 'Instagram story design 9:16 for a perfume shop. Dark elegant background with gold light streaks, the perfume bottle @ref (exactly as in @ref) centred in the lower half with a soft spotlight. At the top third, bold text "خصم ٥٠٪" in large gold letters, clear and well-spaced, and a smaller line below it "على كل العطور" in white. The logo @logo kept exactly, small at the bottom centre. Luxurious, high contrast, safe margins, no other text.' },
      { studio: "image", ask: "بوست لمنيو برجر جديد", prompt: 'Square 1:1 social post for a burger restaurant. A juicy double cheeseburger @ref (as in @ref) on the left, dramatic warm side light, melted cheese, sesame bun, on a dark wooden board; on the right, bold text "برجر الجمر" in thick red letters with a white outline and a smaller "جديد" badge in yellow above it. Deep charcoal background, smoke wisps, appetising, high contrast, no other text.' },
      { studio: "image", ask: "بوستر لفعالية اليوم الوطني", prompt: 'Event poster 2:3 for a Saudi National Day celebration. Green and white palette, a stylised palm and crossed swords motif in gold at the top, fireworks in the night sky, bold text "احتفال اليوم الوطني" in large white letters with a gold outline in the centre, and one smaller line "٢٣ سبتمبر · ٨ مساءً" in white below. Festive, clean, clear hierarchy, safe margins, no other text.' },
    ],
  },
  {
    id: "try-on-fashion",
    name: "تجربة لبس / لقطة أزياء",
    what: "A garment or accessory shown worn (virtual try-on) or an editorial fashion shot — Higgsfield's UGC and Pro Virtual Try-On, OpenArt's try-on template, Freepik's clothes changer.",
    triggers: ["!تجربة لبس", "!try on", "!try-on", "!tryon", "!ملبوس", "!على موديل", "!لوك بوك", "!lookbook", "!لقطة أزياء", "!أزياء", "!ازياء", "!fashion", "!editorial", "!يلبسه", "!مانيكان", "+لبس", "+ملابس", "+موضة", "فستان", "عباية", "عبايه", "ثوب", "شماغ", "بشت", "قميص", "جاكيت", "حجاب", "طرحة", "جلابية", "تيشيرت", "حقيبة يد", "نظارة", "مجوهرات", "خاتم", "عقد"],
    studio: "image",
    ask: ["وش القطعة، وعندك صورتها على مانيكان أو مفرودة؟ (المرجع)", "مين يلبسها: موديل رجل (الشكل والعمر)، مانيكان بدون وجه، ولا شخصية كرتونية بعباية للملابس النسائية؟ والمكان (ستوديو، شارع، مجلس)", "الهدف: صورة متجر واضحة، ولا لقطة مجلة/إعلان؟"],
    recipe: [
      "The garment by @ref with «keep the garment exactly: cut, colour, pattern, fabric, prints» worn by a described MALE model, or shown on a faceless mannequin / ghost mannequin / flat lay. Women's wear (abayas, dresses, hijabs) is NEVER shown on a real woman: on a mannequin, a flat lay, or an illustrated cartoon figure fully covered in an abaya and hijab.",
      "The pose and the framing (full body for fit, three-quarter for details, close-up for jewellery) and what the garment does (drapes, flows, catches light).",
      "The place and light: a clean studio grey backdrop for a shop; a street or interior with natural light for editorial.",
      "Photoreal fabric texture, correct fit, natural skin; the face secondary unless a reference face is given.",
      "For video: a slow walk toward the camera, a turn, fabric moving; 5–8 s.",
    ],
    settings: { image: { aspect: "2:3", quality: "high", resolution: "hi" }, video: { ratio: "9:16", resolution: "1080p", duration: 6, audio: false } },
    pitfalls: ["Prints and embroidery change: name them and keep the reference.", "Wrong fit (too tight or floating): say the size and how it hangs.", "A real customer's face from a photo may not match: be honest."],
    exemplars: [
      { studio: "image", ask: "تجربة لبس لعبايتي للمتجر", prompt: 'Ghost-mannequin product photo of the abaya @ref (cut, black fabric, gold embroidery on the sleeves and hem exactly as in @ref) shown as if worn on an invisible mannequin: no person, no face, no skin, standing full length in a clean light-grey studio, soft even lighting, the sleeves slightly lifted to show the embroidery, fabric draping naturally. Photoreal, sharp fabric texture, shop catalogue style, vertical 2:3, no text.' },
      { studio: "image", ask: "لقطة مجلة لجاكيتي الجلد", prompt: 'Editorial fashion photo: a man in his thirties wears the leather jacket @ref (exact cut, colour and zips of @ref) over a white tee, walking on a rainy city street at night, neon reflections on wet asphalt, 85mm lens, shallow depth of field, confident mid-step pose, the jacket catching the light. Moody magazine look, vertical, no text.' },
      { studio: "image", ask: "عبايتي على شخصية كرتونية", prompt: 'Flat 2D illustrated fashion figure, cartoon style, fully covered in the abaya @ref (same cut, colour and embroidery as @ref) with a matching black hijab covering the hair completely and a simple stylised face; the figure stands in a clean pastel studio, soft shading, an elegant pose with one hand showing the sleeve embroidery. Illustration only, not photoreal, vertical 2:3, no text.' },
      { studio: "video", ask: "فيديو قصير للثوب يتحرك", prompt: 'Fashion clip, 6 seconds, vertical, no sound. A man wears the white thobe @ref (exact colour, fabric and cut of @ref) with a red shemagh in a sunlit marble hall; he walks slowly toward the camera, the fabric moving with each step, then turns once so the cut shows and settles. Soft daylight through tall windows, 50mm, shallow depth of field, elegant, no text.' },
    ],
  },
  {
    id: "viral-effect",
    name: "مؤثر فيروسي / حركة كاميرا من صورة",
    what: "A short clip from ONE photo with a signature camera move or surreal effect — Higgsfield's viral presets (Earth zoom, Bullet time, Crash zoom, 360 orbit, Clones, Vanish, Melting, Frozen in motion, famous-painting split-screens) — for TikTok and reels.",
    triggers: ["!مؤثر", "!افكت", "!effect", "!فيروسي", "!viral", "!ترند", "!trend", "!حرّك الصورة", "!حرك الصورة", "!صورة تتحرك", "!خلي صورتي", "!من صورتي", "!على الصورة", "!على صورة", "!animate", "!image to video", "!ايرث زوم", "!earth zoom", "!بوليت تايم", "!bullet time", "!كراش زوم", "!crash zoom", "!دوران 360", "!360", "!أوربت", "!orbit", "!كلونز", "!كلون", "!clones", "!يختفي", "!يذوب", "!melting", "!تجميد الزمن", "!freeze", "!عملاق", "!انهيار الخلفية", "!تحويل اللوحة", "!درون", "!fpv", "!لقطة سينمائية", "+زوم", "+zoom", "+سينمائي", "ريلز", "reels", "تيك توك", "tiktok"],
    studio: "video",
    ask: ["أرفق الصورة اللي نبدأ منها (تصير الإطار الأول)", "أي حركة: زوم من الفضاء، 360 حول الشخص، تجميد الزمن، نسخ متعددة، يذوب/يختفي؟", "كم ثانية، وبصوت ولا بدون؟"],
    recipe: [
      "The photo as the first frame (refStyle «frames», role first_frame): «starts exactly from @ref».",
      "ONE named camera move or effect, described physically in time: e.g. Earth zoom: «the camera pulls straight up from the subject through the clouds to orbit in one unbroken move»; Bullet time: «the subject freezes mid-action while the camera sweeps 180° around them»; Clones: «identical copies of the subject step out beside them and mirror the move».",
      "What stays the same (the subject's face, clothing, the place) and what changes.",
      "Speed and feel: slow motion for the hero moment, a whip for the transition; 24 fps cinematic; vertical for reels.",
      "Sound: a whoosh and a bass hit at the move; no speech.",
    ],
    settings: { video: { resolution: "720p", duration: 5, audio: true } },
    pitfalls: ["Two effects in one clip fight each other: one.", "The face changes during the move: ask to keep it exactly.", "A long clip loses the effect: 4–6 seconds."],
    exemplars: [
      { studio: "video", ask: "خلي صورتي تسوي ايرث زوم", prompt: 'Starts exactly from @ref as the first frame. Earth zoom: the camera pulls straight up and back from the person at increasing speed — rooftops, the city grid, clouds, the curve of the Earth — in one unbroken move, ending on the planet seen from orbit. The person, their face and clothes stay exactly as in @ref during the first second. Cinematic, 24 fps, vertical. Sound: a rising whoosh and a deep bass hit at the end.' },
      { studio: "video", ask: "بوليت تايم لصورتي وأنا أقفز", prompt: 'Starts exactly from @ref. Bullet time: the jumping person freezes in midair as splashes of water hang frozen around them, while the camera sweeps a smooth 180° arc around the frozen scene, then time resumes and they land. Face, clothes and place exactly as in @ref. Slow, cinematic, shallow depth of field, vertical. Sound: time-stop hum, whoosh, a splash on landing.' },
      { studio: "video", ask: "نسخ مني تطلع من الصورة", prompt: 'Starts exactly from @ref. Clones: four identical copies of the person step out from behind them one by one, line up beside them and mirror the same confident step toward the camera; the original stays in the middle. Same face, clothes and background as @ref throughout, consistent lighting, 24 fps, vertical. Sound: soft pops as each clone appears, a light beat.' },
    ],
  },
  {
    id: "headshot-avatar",
    name: "هيدشوت احترافي / أفاتار",
    what: "A professional headshot for LinkedIn or a profile, or a stylised avatar of the person (anime, 3D Pixar-like, illustrated, action figure) from their photo — OpenArt's headshot generator and photo-to-avatar, Higgsfield's style presets.",
    triggers: ["!هيدشوت", "!headshot", "!صورة شخصية", "!صورة بروفايل", "!بروفايل", "!profile", "!لينكدإن", "!لينكد إن", "!linkedin", "!أفاتار", "!افاتار", "!avatar", "!حوّل صورتي", "!حول صورتي", "!صورتي بستايل", "!سوني شخصية", "!سيرتي الذاتية", "!سيرة ذاتية", "!cv", "!أنمي", "!انمي", "!anime", "!بيكسار", "!pixar", "!أكشن فيقر", "!action figure", "!كوميكس", "!رسم زيتي", "!رسم فيكتور", "!كلاي", "!بكسل", "!لعبة فيديو", "+كرتون", "+cartoon", "+3d", "+ثري دي", "+ستايل", "+style", "رسمة", "رسم"],
    studio: "image",
    ask: ["أرفق صورتك (وجه واضح، إضاءة جيدة)", "النوع: هيدشوت رسمي للعمل، ولا أفاتار بأسلوب (أنمي، 3D، رسم)؟", "الخلفية واللبس: رسمي، ألوان الشركة، ولا حر؟"],
    recipe: [
      "The face by @ref: «the same person as @ref: same face, features, skin tone, hair and beard; do not change the identity» — and the honest note that likeness varies.",
      "Headshot: head-and-shoulders crop, 85mm look, soft studio light (a large key, a gentle fill), a plain or softly blurred background, business clothing named, a natural confident expression, square or 4:5.",
      "Avatar: the style named precisely (anime cel shading; Pixar-like 3D with soft subsurface skin; flat vector illustration; collectible action figure in a blister pack with accessories), the pose and background, bold clean colours.",
      "Keep glasses, hijab, beard and other identity features as in the photo.",
    ],
    settings: { image: { aspect: "1:1", quality: "high", resolution: "hi" } },
    pitfalls: ["A beautified stranger instead of the person: identity words and a good reference photo.", "Glasses or hijab dropped: name them.", "Over-stylised headshots for LinkedIn: keep it real."],
    exemplars: [
      { studio: "image", ask: "هيدشوت للينكدإن", prompt: 'Professional LinkedIn headshot of the same person as @ref: same face, features, skin tone, hair and beard, identity unchanged. Head-and-shoulders crop, 85mm lens look, soft large key light from the front-left with a gentle fill, a plain warm-grey studio background slightly blurred, navy blazer over a white shirt, natural confident smile, eyes to camera. Photoreal, sharp eyes, square 1:1, no text.' },
      { studio: "image", ask: "سوني شخصية بيكسار", prompt: '3D animated character portrait of the same person as @ref in a Pixar-like style: same face shape, features, skin tone, hairstyle and glasses, stylised with big expressive eyes and soft subsurface skin. Waist-up, friendly smile, wearing a casual hoodie, standing in a bright colourful room with soft bokeh, warm studio lighting. Clean, polished 3D render, square, no text.' },
      { studio: "image", ask: "أكشن فيقر مني", prompt: 'A collectible action figure of the same person as @ref (same face, hair and beard) inside a clear plastic blister pack on a cardboard backing. The figure wears their outfit from @ref; small accessories beside it: a laptop, a coffee cup and a phone. The packaging card reads "عبدالله" in bold letters at the top. Toy-store product photo, soft studio light, square, photoreal plastic and card textures.' },
    ],
  },
  {
    id: "motion-graphics",
    name: "موشن جرافيك / شرح تطبيق أو شعار",
    what: "A short motion-graphics clip — animated typography, 2D shapes, a SaaS/app UI demo, a logo reveal, collage/mixed-media loops — Higgsfield's hypermotion typography, 2d_motion, saas_motion and mixed_media families.",
    triggers: ["!موشن جرافيك", "!موشن قرافيك", "!motion graphics", "!بالموشن", "!موشن", "!motion", "!شرح تطبيق", "!ديمو تطبيق", "!app demo", "!saas", "!شعار يتحرك", "!logo reveal", "!انترو", "!intro", "!مقدمة", "!تايبوغرافي", "!typography", "!نص متحرك", "!يتحرك", "!كولاج", "!collage", "!انفوجرافيك", "!infographic", "!explainer", "+تطبيقي", "+تطبيق", "+شعاري", "+لوقو", "+لوجو", "+logo", "+واجهة", "+ui", "+2d", "شرح"],
    studio: "video",
    ask: ["وش اللي يتحرك: نص/أرقام، شعار (أرفقه)، شاشات تطبيق (أرفق لقطة)، ولا أشكال؟", "الأسلوب: نظيف مينيمال، مرح ملوّن، ريترو كولاج، ولا 3D لامع؟", "كم ثانية وبأي نسبة، وفيه صوت؟"],
    recipe: [
      "What is on screen named exactly: the logo by @ref kept exact; the UI screenshot by @ref inside a phone or laptop; 2–4 short words of text in double quotes (long text fails).",
      "The motion written in order: enters how, moves how, settles how (slides, scales, pops, draws on, morphs), with easing words (smooth, snappy, bouncy) and the timing.",
      "The style family: flat 2D vector with pastel shapes; bold kinetic typography; glossy 3D chrome; paper-cut collage; retro CRT; clean SaaS with soft gradients and rounded cards.",
      "A solid or gradient background, a 2–3 colour palette, consistent line weights; loopable ending when wanted.",
      "Sound: UI clicks, swooshes, a light music bed; no speech.",
      "Arabic words on screen: only Seedance 2.5 accepts Arabic in the prompt (set the generator to it); with Seedance 2.0 keep the prompt in English and add the Arabic text in the editor afterwards.",
    ],
    settings: { video: { ratio: "16:9", resolution: "1080p", duration: 6, audio: true } },
    pitfalls: ["Real text in motion comes out garbled: few words, or add the text in the editor.", "A logo redrawn: reference + «exactly».", "Too many moving things: one focus at a time."],
    exemplars: [
      { studio: "video", ask: "انترو لشعاري", prompt: 'Logo reveal, 5 seconds, 16:9, clean 3D. On a deep navy gradient background, soft light particles drift; the logo @ref (kept exactly: shape, colours, text) assembles from glossy pieces that fly in and snap together with smooth easing, a bright light sweep passes across it, it settles centred with a subtle glow, then the scene holds for one second. Sound: soft whooshes, a snap, a warm chime.' },
      { studio: "video", ask: "شرح تطبيقي بموشن", prompt: 'SaaS app demo motion, 8 seconds, 16:9, clean minimal style. A white iPhone mock-up slides in from the right and tilts slightly; inside it the app screenshot @ref (exact UI of @ref); three rounded pastel cards pop out of the screen one by one with bouncy easing, each with a short label: "سريع", "آمن", "مجاني"; a cursor-style tap ripples on the first card; everything settles into a tidy layout on a soft lavender gradient. Sound: subtle UI clicks and a light upbeat bed.' },
      { studio: "video", ask: "نص متحرك لإعلان تخفيضات", prompt: 'Kinetic typography, 6 seconds, 9:16, bold and punchy. On a bright yellow background, the words "تخفيضات" then "٥٠٪" then "اليوم فقط" slam in one after another in thick black letters, each scaling up with a snappy overshoot, rotating slightly, and sliding away as the next arrives; a black circle wipes the screen between words; the final frame holds all three stacked. Flat 2D style, two colours only. Sound: three impact hits and a whoosh.' },
    ],
  },
  {
    id: FIGHT_PLAYBOOK_ID,
    name: "مشهد قتال سينمائي",
    what: "A cinematic fight staged the way the great fight directors do it — Hong Kong kung fu, wuxia, Wing Chun, American long-take tactical combat, street brawl, silat, the one-take corridor, the samurai duel, Egyptian street action, tahtib, the Arabian desert sword duel — written as numbered shots with seconds, sizes and inserts (cut density), clear geography, physics, rhythm and one decisive finish. Men and boys only; no blood or gore; generic people.",
    triggers: ["!مشهد قتال", "!مشاهد قتال", "!مشهد أكشن", "!مشهد اكشن", "!فايت سين", "!fight scene", "!fight sequence", "!معركة", "!معركه", "!قتال", "!مبارزة", "!مبارزه", "!عراك", "!تحطيب", "!كونغ فو", "!كونج فو", "!kung fu", "!ساموراي", "!ووشيا", "!سيلات", "!martial arts", "+ضد", "+يتقاتلون", "+يتضاربون", "+ضرب", "+سيوف", "+بالعصي", "+بالسيوف", "+بدون سلاح", "أكشن", "اكشن", "action"],
    studio: "video",
    ask: ["مين يتقاتل (رجال أو أولاد: العمر والشكل واللبس) ووين؟", "أي مدرسة قتال: صيني/هونغ كونغ، ووشيا، وينغ تشون، أمريكي (جون ويك)، عراك شوارع، سيلات، لقطة الممر، ساموراي، أكشن مصري، تحطيب، مبارزة سيوف صحراوية؟", "بالأيدي ولا بسلاح، الإحساس (حماس، تراجيدي، مضحك)، كم ثانية وأي مقاس؟"],
    recipe: [
      "Open with the specs: cinematic fight scene, the seconds, the ratio, the school's style, the mood; photoreal; NON-IP generic people; no blood, no gore, no wounds.",
      "The setting and the two sides: who is screen-left and who is screen-right, kept through every cut, the camera at their height, the action in the centre of the frame.",
      "The school's choreography grammar in one line (the masters' way: Chan's environment-as-weapon and double-angle hit, Yuen's floating wire ballet, Stahelski's long take on a wide lens, Evans's corridor silat, Park's one-take side track, the samurai stillness then one cut, Egyptian rooftops and alleys, tahtib's spinning sticks, the dune sword duel).",
      "3–6 numbered SHOTS, each 1–3 s and ONE move: «SHOT 1 (0–2 s, wide): … CUT TO SHOT 2 (2–3 s, insert): …» — wide to set the space, medium for the exchange, a 0.5–1 s INSERT (fist, foot pivot, eyes, grip, block) to sell a moment, the environment move, the decisive finish with a two-frame freeze and a slight shake, a held beat. A one-take school is one continuous shot, said as such.",
      "Physics: weight from the back foot, follow-through, every hit received, hair and cloth trailing, the environment reacting (dust, splinters, skidding chairs).",
      "Sound: whooshes, thuds, blocks, cloth, feet, grunts and breaths with no words, the school's music bed when it has one.",
    ],
    settings: { video: { ratio: "16:9", resolution: "720p", duration: 10, audio: true } },
    pitfalls: ["Prose-only fights play as three slow beats (walk in, raise the weapon, freeze): write shots.", "Too many moves in one shot smear: one move per shot.", "Fighters swapping sides confuse the eye: keep the 180° line.", "Blood or a death shown is refused: sell the hit with sound and reaction."],
    exemplars: [
      { studio: "video", ask: "أبي مشهد قتال صيني بين شاب بثوب أبيض ورجل ضخم في المطعم", prompt: "Cinematic fight scene, 10 seconds, 16:9, Hong Kong kung fu choreography, playful, with comic beats of pain. Photoreal, film grain, natural motion blur. NON-IP — generic people, no known actor's likeness. No blood, no gore, no wounds.\n\nSetting: a busy restaurant kitchen, pots and steam. A young man in a white thobe (screen-left) against a huge bald man in a vest (screen-right), whatever is at hand: chairs and bottles; each keeps his side of the frame through every cut, the camera at their height, the action in the centre of the frame.\n\nChoreography (Jackie Chan, Yuen Woo-ping, Sammo Hung): full-body framing on a medium-wide lens so every limb reads, rhythm of hit-hit-hit-pause, the environment used as a weapon and a shield, the biggest hit shown twice from two angles, a beat of pain or humour after it.\n\nSHOT 1 (0–2 s, wide): the young man faces the big man across the steel counter, a ladle in hand, a breath before the move. CUT TO SHOT 2 (2–4 s, medium two-shot): strike, block, counter with pot lids, each with weight from the back foot. CUT TO SHOT 3 (4–5 s, insert): insert of the back foot pivoting on the wet floor. CUT TO SHOT 4 (5–7.5 s, medium, camera circling low): the young man rolls across the counter and comes up behind the big man, pans clattering down. CUT TO SHOT 5 (7.5–10 s, wide): a spinning back kick sends the big man crashing through a stack of crates; a two-frame freeze and a slight shake on the impact, then a held beat; the young man shakes his stinging foot.\n\nSound: whooshes, the thud of each blow, pots clanging, cloth snapping, feet sliding, grunts and breaths, no words." },
      { studio: "video", ask: "مبارزة سيوف في الصحراء بين فارس بدوي ومبارز منافس وقت الغروب", prompt: "Cinematic fight scene, 12 seconds, 21:9, Arabian desert sword duel, epic and grand. Photoreal, film grain, natural motion blur. NON-IP — generic people, no known actor's likeness. No blood, no gore, no wounds.\n\nSetting: golden desert dunes at sunset. A bedouin horseman in a brown bisht (screen-left) against a rival swordsman in red (screen-right), curved swords; each keeps his side of the frame through every cut, the camera at their height, the action in the centre of the frame.\n\nChoreography (Gulf heritage drama): two men in thobes and shemaghs circling on a dune, the wind lifting sand and cloth, the swords ringing, wide shots on the dunes then tight inserts on the grips, a sunset behind.\n\nSHOT 1 (0–2.5 s, wide): the two men circle on the crest, swords low, sand streaming off the dune. CUT TO SHOT 2 (2.5–5 s, medium two-shot): three ringing clashes, each blade turned aside. CUT TO SHOT 3 (5–6 s, insert): insert of the blade catching the sun. CUT TO SHOT 4 (6–9 s, medium, camera circling low): the horseman slides down the slope under a swing and comes up behind his rival. CUT TO SHOT 5 (9–12 s, wide): he disarms the rival and the sword spins away and lands in the sand; a two-frame freeze on the impact, then a held beat against the sun.\n\nSound: wind, ringing blades, sand hissing, cloth snapping, breaths, no words." },
      { studio: "video", ask: "مشهد أكشن لقطة الممر الواحدة: شاب بهودي ضد مجموعة بلطجية", prompt: "Cinematic fight scene, 15 seconds, 16:9, one-take corridor fight seen from the side, grim and tragic. Photoreal, film grain, natural motion blur. NON-IP — generic people, no known actor's likeness. No blood, no gore, no wounds.\n\nSetting: a long dim hotel corridor. An athletic young man in a grey hoodie (screen-left) against a group of thugs with sticks (screen-right), a short wooden stick; each keeps his side of the frame, the camera at their height, the action in the centre of the frame.\n\nChoreography (Park Chan-wook): a single lateral tracking shot along a corridor, the hero pushing through a crowd of opponents, no cuts at all, exhaustion visible, the camera keeping everyone in frame.\n\nSHOT 1 (0–15 s, one continuous take): a single lateral tracking shot from the side: the young man pushes forward through the thugs, striking and shoving, each opponent entering from screen-right and dropping out of frame, the hero slowing and breathing hard by the end; one clean final strike, then silence; the last opponent slowly sinks to his knees.\n\nSound: thuds, sticks clacking on the walls, feet scraping, heavy breathing, no words, no music." },
    ],
  },
  {
    id: TRANSFORM_PLAYBOOK_ID,
    name: "تحويل فيديو شخصية واقعية (نفس الوجه، عالم جديد)",
    what: "The person's OWN clip of a man or a boy, kept exactly — face, identity, performance, framing and camera move — while one thing around him changes professionally: the whole environment, an object, his clothes, the light and time of day, the weather, an added or removed element, or the look (Seedance video-to-video, the clip as a video reference @source). Never a woman's clip.",
    triggers: ["!غير البيئة", "!غيّر البيئة", "!تغيير البيئة", "!بدل الخلفية", "!بدّل الخلفية", "!غير الخلفية", "!نفس الفيديو بس", "!نفس اللقطة بس", "!حافظ على وجهه", "!خل وجهه نفسه", "!بدون ما تغير وجهه", "!بدون ما تغيّر وجهه", "!خل الباقي نفسه", "!ونفس الحركة", "!نفس المكان ونفس الحركة", "!بنفس اللقطة", "!في نفس الفيديو", "!نفس الفيديو بس", "!ستايل الفيديو", "!الفيديو إلى ستايل", "!ونفس الوجه", "!بنفس وجهه", "!وجهه نفسه", "!وخل الباقي", "!من الفيديو", "!في الفيديو", "!على المشهد", "!video to video", "!keep the face", "!same video", "!change the background", "!replace the background", "+غير الطقس", "+غيّر الطقس", "+غير الإضاءة", "+غيّر الإضاءة", "+غير لبس", "+غيّر لبس", "+بدل ملابسه", "+بدّل ملابسه", "+حوّل الفيديو", "+حول الفيديو", "+احذف", "+شيل", "+امسح", "+نقّل", "+نقل", "+استبدل", "+بدل ", "+بدّل", "فيديوي", "مقطعي", "اللقطة", "المشهد", "الوجه", "وجهه", "حركته"],
    studio: "video",
    ask: ["ارفع المقطع (٤–١٥ ثانية، ثابت وواضح)، وقل لي وش فيه: مين، لابس وش، وين، وش يسوي، وكيف الكاميرا؟", "وش الشي الواحد اللي تبي يتغير: المكان، عنصر، اللبس، الإضاءة، الطقس، إضافة أو حذف، ولا الستايل؟", "الإضاءة: نخلي إضاءته الأصلية ونضبط العالم الجديد عليها (أأمن للوجه)، ولا نعيد إضاءة اللقطة كلها (ليل، نيون، غروب)؟"],
    recipe: [
      "The clip is a VIDEO reference named @source (references style «references», never a first frame); a picture that supplies a new thing (clothes, a product, a place, an animal's fur) is a second reference named by what it is, declared «appearance/texture only».",
      "Line 1 — the source declared: who is in it (a man or a boy), his wardrobe, the place, the action, the framing and camera move, the light; «Preserve his identity, face, wardrobe, performance, framing, camera and motion exactly; change only <the one thing>».",
      "Line 2 — the specs: «Photoreal. <the clip's aspect>. <the clip's seconds>s. <the grade>. NON-IP — generic designs. SFX and source dialogue only.» Set the duration option to the clip's seconds (4–15) and the ratio to the clip's own.",
      "The action as one continuous shot with the same framing: the FENCE (what stays, named) → the ONE change written A → B with an edit verb (replace, remove, relight, restyle, change … to …, add) → how the change sits in the plate (the same key direction and softness, the world's bounce on him, matched haze, depth of field and grain, a real contact shadow, parallax at his own speed, no cut-out edges) → the LOCK-DOWN CLAUSE last: «Face and identity unchanged … everything else identical to the source».",
      "Sound: «SFX and source dialogue only» — his own voice kept, only the change's sound added; never a new voice.",
      "One change per pass: environment first, the person's clothes or a relight on the result in a second pass; a change in one moment gets a window («between 0:02 and 0:04 … then back»).",
      "Say honestly: the face is kept by the lock and by not relighting it, never guaranteed; check the result against the original and fix small drift in another pass.",
    ],
    settings: { video: { resolution: "720p", audio: true } },
    pitfalls: ["No fence → the model «touches more than you asked».", "Two changes in one pass → the background is reinterpreted; environment first.", "Relighting the face (night, neon, a side key) is the riskiest change for likeness: warn, and lock identity and expression.", "A new world that doesn't move with him looks pasted: parallax at his speed, a ground, a contact shadow.", "A vague «make it nicer» has no target: always A → B."],
    exemplars: [
      { studio: "video", ask: "غيّر البيئة اللي ورا الشاب، خله على سطح في الرياض وقت الغروب، وخل وجهه نفسه", prompt: '@source: original clip — a young man in a white thobe, in an office against a plain grey wall, talks to the camera; a locked-off medium shot; soft window daylight from screen-left. Preserve his identity, face, wardrobe, performance, framing, camera and motion exactly; change only the environment around him.\n\nPhotoreal. 9:16. 6s. Warm cinematic grade. NON-IP — generic designs, nothing from a brand or a character. SFX and source dialogue only.\n\nOne continuous shot, a locked-off medium shot, same framing as @source. Keep the man, his face, his thobe, his hands, the medium shot and the timing exactly as in @source. Replace only the environment: the grey office wall becomes a Riyadh rooftop at golden hour, the skyline soft in haze behind him, a low warm sun from screen-left matching his original key. The rooftop is still like the office was; a ground he really stands on, his own soft contact shadow on it. Keep his original light and light the new world to match it: the same key direction and softness, warm bounce from the sunlit floor spilling onto him, a touch of the haze over him, matched depth of field and grain, no cut-out edges or halos. Face and identity unchanged — the same person, features, skin, hair and beard, the same expression and lip movement; the same wardrobe; the same framing, lens, camera move and timing; everything else identical to the source.\n\nSFX and source dialogue only: his own voice as in the source, a faint city hum and evening breeze under it.' },
      { studio: "video", ask: "بدّل كوب القهوة اللي بيده بعلبة المشروب حقي ونفس الحركة", prompt: '@source: original clip — a man in his thirties in a blue shirt, at a café table by the window, sips coffee and talks; a handheld medium close-up with gentle sway; soft window daylight from screen-right. Preserve his identity, face, wardrobe, performance, framing, camera and motion exactly; change only the coffee cup → the drink can.\n@product: a photo of the drink can: its exact shape, label, colours and text — appearance and texture reference only; ignore its background and lighting.\n\nPhotoreal. 9:16. 8s. Clean natural grade. NON-IP — generic designs, nothing from a brand or a character. SFX and source dialogue only.\n\nOne continuous shot, a handheld medium close-up, same framing as @source. Keep the man, his face, his shirt, his hands, the café, the handheld sway and the timing exactly as in @source. Replace the coffee cup with the drink can exactly as in @product (shape, label, colours and text unchanged): the same position, size and motion, held the same way by the same hand, its reflections and shadow redone for its own aluminium and matched to the window light. Nothing else in the frame changes. Face and identity unchanged — the same person, features, skin, hair and beard, the same expression and lip movement; the same wardrobe; the same framing, lens, camera move and timing; everything else identical to the source.\n\nSFX and source dialogue only: his own voice as in the source; a soft tap of the can on the table.' },
      { studio: "video", ask: "حط أسد جنبه في الفيديو بشكل واقعي وخل الرجال نفسه", prompt: '@source: original clip — a bearded man in a white shirt, on a rooftop, sits and speaks calmly; a tripod wide shot; golden late-afternoon sun from screen-left. Preserve his identity, face, wardrobe, performance, framing, camera and motion exactly; change only an added element: a lion beside him.\n@lion: a reference photo of the real animal: its fur, face and anatomy — appearance and texture reference only; ignore its background and lighting.\n\nPhotoreal. 16:9. 10s. Soft filmic grade with light halation. NON-IP — generic designs, nothing from a brand or a character. SFX and source dialogue only.\n\nOne continuous shot, a tripod wide shot, same framing as @source. Keep the man, his face, his shirt, his hands, the wide shot and the timing exactly as in @source. Add a full-grown lion lying calmly beside him, its look and texture from @lion: it settles its weight over the first seconds, breathes slowly, turns its head once toward him, a real soft-edged contact shadow on the rooftop floor, lit by the same low sun from screen-left with the same haze and depth of field; fully photoreal, real fur with individual strands, true anatomy, never CG, plastic or cartoonish. He stays unaware, mid-delivery, his performance untouched. Face and identity unchanged — the same person, features, skin, hair and beard, the same expression and lip movement; the same wardrobe; the same framing, lens, camera move and timing; everything else identical to the source.\n\nSFX and source dialogue only: his own voice as in the source, then a low slow breath and a soft shift of weight from the lion.' },
    ],
  },
];

export const playbookById = (id: string) => PLAYBOOKS.find((p) => p.id === id);

// ───────────────────────────── which kind of work a message asks for ─────────────────────────────

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFC")
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}\s@:%]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** A trigger's weight: «!phrase» is distinctive (5), «+phrase» fairly so (3), a plain word is common (1). */
const weigh = (t: string) => (t.startsWith("!") ? { t: normalize(t.slice(1)), w: 5 } : t.startsWith("+") ? { t: normalize(t.slice(1)), w: 3 } : { t: normalize(t), w: 1 });
const TRIGGERS = PLAYBOOKS.map((p) => ({ id: p.id, words: p.triggers.map(weigh) }));

/** The kind of work a message (plus the conversation before it) most likely asks for, or null when nothing fits. */
export function detectPlaybook(text: string, context = ""): string | null {
  const now = ` ${normalize(text)} `;
  const before = ` ${normalize(context)} `;
  let best: { id: string; score: number } | null = null;
  for (const p of TRIGGERS) {
    let score = 0;
    for (const { t, w } of p.words) {
      if (!t) continue;
      // a phrase counts inside a word too (Arabic prefixes: «لعطري», «بشماغ»), a single short word only whole
      const hit = (hay: string) => hay.includes(` ${t} `) || (t.length >= 4 && hay.includes(t));
      if (hit(now)) score += w * 2;
      else if (hit(before)) score += w;
    }
    if (score > 0 && (!best || score > best.score)) best = { id: p.id, score };
  }
  return best ? best.id : null;
}

/** One line per kind of work for the system prompt, so the assistant recognises them and follows the recipe. */
export function playbooksBrief(studio: Studio) {
  return PLAYBOOKS.map((p) => `- ${p.id} «${p.name}»${p.studio === studio ? "" : ` (best in the ${p.studio} studio; here help with the ${studio} part or send them there)`}: ${p.what}`).join("\n");
}

/** The full recipe of one kind of work, for the turn where it is asked. */
export function playbookGuide(id: string, studio: Studio) {
  const p = playbookById(id);
  if (!p) return "";
  const s = p.settings[studio];
  return [
    `REQUEST TYPE: ${p.id} «${p.name}» — ${p.what}`,
    `Ask first (only what they haven't said, at most three): ${p.ask.map((q, i) => `${i + 1}. ${q}`).join(" ")}`,
    `Prompt recipe, in order:\n${p.recipe.map((r) => `  - ${r}`).join("\n")}`,
    s ? `Options that fit (set them unless the person wants otherwise): ${JSON.stringify(s)}` : "",
    `Pitfalls: ${p.pitfalls.join(" ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}
