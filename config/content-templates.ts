// «صانع المحتوى» — the carousel templates «محمد باقر» offers (قوالب الكاروسيل): 24 looks, each a complete design
// system (the look, the Arabic typography, the anatomy of the cover / body / closing slide, three palettes) that goes
// into every slide's prompt so the slides read as one set. A person can pick one, or none. Pure.
//
// Where they come from (web research read on 2026-10-09; the sources are vendor blogs and guides, so what they say
// about performance is direction, not measurement):
//   - Style families seen across the 2026 carousel guides: minimal, bold typography, editorial / magazine, soft
//     gradient and glassmorphism, seamless panorama, scrapbook (paper textures, tape, handwritten notes, polaroids),
//     mixed media and cut-outs, newspaper columns, stickers and doodles, neo-brutalism as an accent (thick borders,
//     hard shadows, saturated complementary pairs), technical / blueprint (grid, monospaced labels), micro-learning
//     (15–20 words a slide with one visual anchor) — Canva's carousel library, Envato, EasyCarousels' families
//     (Simple, Editorial, Storytelling, Gallery Wall, High-Density; Minimal, Split & Grid, Product Showcase), Scrolo,
//     My Social Boutique, Slidy Creator, Panoslice, SocialHabit, Krumzi, Whaaat.
//   - Structures that carry them: step-by-step tutorials, "things I wish I knew" lists, myth vs fact, cheat sheets,
//     before/after, behind the scenes, case studies (result first), polls, hot takes, product spotlights,
//     testimonials, data one-stat-a-slide, contrast, "what is…", red flags, journey / route, layer-by-layer, plan A/B/C,
//     follow-the-line, choose-your-path (Krumzi, Whaaat, LinkedGrow, Oktopost, Expandi, Buffer, Carousels-generator).
//   - Rules of thumb: 7–10 slides for Instagram (limit 20), 3–10 for LinkedIn; one idea a slide; 15–30 words a slide;
//     the cover promises one specific outcome and works as a thumbnail; the last slide is the call to action or a
//     saveable summary; one ratio across the set (4:5 / 1080×1350 recommended, 1:1 safe); key content inside the
//     central square (the profile grid crops the cover); text ≥ 80 px from the edges; body text ≥ 36 px on a 1080 px
//     canvas; the whole set in one consistent system (Socialinsider, Oktopost, Krumzi, Kalex, Contentdrips).
//   - Arabic: text goes right to left and is right-aligned; Arabic baselines sit lower (leading +10–15%); matched
//     Arabic/Latin families (Cairo, Tajawal, IBM Plex Sans Arabic, Almarai); in GPT Image 2 the exact copy goes in
//     quotes, verbatim, once, short lines, "no extra text", high quality for dense text (OpenAI's image prompting
//     cookbook, fal and sunra guides) — and a check after drawing, because no source settles Arabic joining or
//     direction in generated images.
// The worked examples built from these templates are in config/content-template-examples.ts.

export type StructureId = "steps" | "list" | "story" | "compare" | "teach" | "mistakes" | "qa" | "before_after" | "stats" | "myth" | "case" | "quote" | "journey" | "cheat" | "proof";

export const STRUCTURES: { id: StructureId; ar: string }[] = [
  { id: "steps", ar: "خطوات" },
  { id: "list", ar: "قائمة" },
  { id: "story", ar: "قصة" },
  { id: "compare", ar: "مقارنة" },
  { id: "teach", ar: "تعليم" },
  { id: "mistakes", ar: "أخطاء شائعة" },
  { id: "qa", ar: "أسئلة وأجوبة" },
  { id: "before_after", ar: "قبل وبعد" },
  { id: "stats", ar: "أرقام" },
  { id: "myth", ar: "خرافة وحقيقة" },
  { id: "case", ar: "دراسة حالة" },
  { id: "quote", ar: "اقتباس" },
  { id: "journey", ar: "رحلة" },
  { id: "cheat", ar: "ورقة مرجعية" },
  { id: "proof", ar: "آراء وإثبات" },
];

export interface Palette {
  name: string;
  bg: string;
  text: string;
  primary: string;
  accent: string;
}

export interface CarouselTemplate {
  id: string;
  group: string;
  name: string;
  description: string;
  bestFor: string;
  structures: StructureId[];
  /** words a slide carries at most, in this look */
  words: number;
  /** the design system, in English (it goes into every slide's prompt) */
  look: string;
  /** the Arabic typography, in English */
  type: string;
  cover: string;
  body: string;
  closing: string;
  palettes: [Palette, Palette, Palette];
}

const P = (name: string, bg: string, text: string, primary: string, accent: string): Palette => ({ name, bg, text, primary, accent });

export const TEMPLATE_GROUPS = ["نظيف وراقٍ", "حيوي وعصري", "لمسة يدوية", "تعليمي ومعلوماتي", "قصصي وبصري"] as const;

export const CAROUSEL_TEMPLATES: CarouselTemplate[] = [
  // ───────── نظيف وراقٍ ─────────
  {
    id: "minimal-clean", group: "نظيف وراقٍ", name: "بسيط نظيف",
    description: "خلفية هادئة ومساحة فارغة واسعة وعنوان كبير واحد، بلا زخرفة.",
    bestFor: "نصائح قصيرة، علامات راقية، محتوى يحتاج هدوءًا", structures: ["list", "teach", "quote", "steps"], words: 20,
    look: "Minimal layout on a flat, calm background: one oversized headline, a lot of empty space, a single thin accent line and a tiny slide marker. No decoration, no gradients, no shadows, no icons unless essential.",
    type: "Clean geometric Arabic sans (Cairo / Tajawal feel), medium-to-bold weight, generous line height, right-aligned.",
    cover: "The headline alone, large, in the upper-middle; a short one-line subtitle under it; the accent line; a tiny «اسحب» cue near the bottom edge.",
    body: "One idea: a short headline, one or two short lines of text, big margins; the slide number in a corner.",
    closing: "A calm closing line with a short call to action and the account handle small at the bottom.",
    palettes: [P("حليبي وأسود", "#F6F3EE", "#151515", "#151515", "#C8553D"), P("رمادي ناعم", "#ECEFF1", "#1C2A33", "#1C2A33", "#3E7CB1"), P("رملي وأخضر", "#F2EBDD", "#2B2B2B", "#2F5D50", "#D98E04")],
  },
  {
    id: "editorial-magazine", group: "نظيف وراقٍ", name: "مجلة تحريرية",
    description: "تخطيط مجلات: عنوان عرضي ضخم، خطوط رفيعة، وسوم صغيرة، وهوامش واسعة.",
    bestFor: "الموضة والجمال والفخامة والمقالات الفكرية", structures: ["story", "list", "case", "quote"], words: 25,
    look: "Magazine editorial layout: a large display headline, thin horizontal rules, small uppercase-style tag labels like an issue header, asymmetrical composition with generous margins, optional grayscale photo crop or a large drawn element. Refined and confident.",
    type: "Elegant high-contrast Arabic display (naskh-leaning serif feel, Amiri / Noto Naskh) for headlines, a clean Arabic sans for small labels, right-aligned.",
    cover: "A big headline across the upper two thirds, a small issue-style tag line above it, a thin rule, and a pull-line under it.",
    body: "A headline, a short paragraph in a narrow column, one pull-quote line between rules, and a page number like a magazine folio.",
    closing: "A closing pull-quote and a thin-ruled footer with the call to action.",
    palettes: [P("ورق جريدة", "#F4EFE6", "#1A1A1A", "#1A1A1A", "#B3261E"), P("كريمي وعنابي", "#FAF3E7", "#2A1A1D", "#6B1E2E", "#C9A24B"), P("أبيض وأسود", "#FFFFFF", "#0A0A0A", "#0A0A0A", "#FF4D00")],
  },
  {
    id: "bold-type", group: "نظيف وراقٍ", name: "خط عريض",
    description: "النص هو البطل: عنوان ضخم بتباين عالٍ وكلمة مفتاحية داخل كبسولة.",
    bestFor: "أفكار جريئة، آراء مثيرة للجدل، أغلفة تلفت الانتباه", structures: ["list", "mistakes", "myth", "teach"], words: 15,
    look: "Text-led design: a huge heavy headline fills most of the slide at extreme contrast, one keyword highlighted inside a solid pill or underline, nothing else competes. Flat colours, no photos.",
    type: "Very heavy Arabic sans (Cairo Black / Changa ExtraBold feel), tight but readable leading, right-aligned, the keyword in the accent colour.",
    cover: "A huge two-to-four-word headline with one highlighted word; a tiny swipe arrow in a corner.",
    body: "One bold statement per slide, a short supporting line in a smaller weight, big margins.",
    closing: "A bold closing statement and a pill-shaped call to action.",
    palettes: [P("أسود وأصفر", "#111111", "#FFFFFF", "#FFD60A", "#FF3B30"), P("أصفر وأسود", "#FFD60A", "#111111", "#111111", "#FFFFFF"), P("أزرق ملكي", "#0B3D91", "#FFFFFF", "#FFFFFF", "#FFB703")],
  },
  {
    id: "luxury-gold", group: "نظيف وراقٍ", name: "فخم أسود وذهبي",
    description: "خلفية داكنة، إطار ذهبي رفيع، تخطيط متمركز أنيق ومساحات واسعة.",
    bestFor: "العلامات الفاخرة والعقار والعطور والخدمات الراقية", structures: ["list", "story", "case", "quote"], words: 18,
    look: "Premium dark look: deep black or navy background, a thin gold hairline frame inset from the edges, centred elegant layout, subtle gold foil sheen on the headline only, ample breathing space, small ornamental divider.",
    type: "Refined Arabic display (naskh/thuluth-inspired for headlines, elegant and legible) with a light clean Arabic sans for the supporting lines, centred.",
    cover: "The headline centred inside the gold frame, a small ornament above it, a short subtitle below.",
    body: "A centred headline, two short lines, the gold divider, a small slide number in the frame's corner.",
    closing: "A centred closing line with the call to action and a small logo mark area at the bottom.",
    palettes: [P("أسود وذهبي", "#0B0B0F", "#F5F0E1", "#D4AF37", "#8C6D1F"), P("كحلي وذهبي", "#0B1F3A", "#F7F3E8", "#D4AF37", "#FFFFFF"), P("زمردي وذهبي", "#06251F", "#F4EEDC", "#C9A24B", "#5C8F7B")],
  },
  {
    id: "corporate-clean", group: "نظيف وراقٍ", name: "مؤسسي رسمي",
    description: "أبيض نظيف، شريط ملوّن، شبكة منظمة وأيقونة لكل نقطة (مناسب للينكدإن).",
    bestFor: "لينكدإن، الشركات، التقارير المختصرة، المحتوى المهني", structures: ["teach", "list", "steps", "case", "stats"], words: 30,
    look: "Clean corporate (LinkedIn) look: light background, a coloured header band or side bar, a structured grid, a small simple icon per point, a footer with the slide number and a small brand area, restrained palette, no ornament.",
    type: "Professional Arabic sans (IBM Plex Sans Arabic / Cairo feel), semi-bold headlines, regular body, right-aligned, orderly.",
    cover: "A coloured band with a small label, a clear headline that promises a result, a short subtitle and a small icon.",
    body: "A header band with the point's number, a headline, two or three short lines or bullets with small icons.",
    closing: "A summary or call-to-action panel in the primary colour with a contact line.",
    palettes: [P("أبيض وأزرق", "#FFFFFF", "#14213D", "#0A66C2", "#F4A261"), P("رمادي أزرق", "#F7F9FC", "#1B263B", "#1B4965", "#5FA8D3"), P("أبيض وأخضر مائي", "#FFFFFF", "#1F2937", "#0F766E", "#F59E0B")],
  },

  // ───────── حيوي وعصري ─────────
  {
    id: "gradient-glass", group: "حيوي وعصري", name: "تدرّج وزجاج",
    description: "تدرّج لوني ناعم متصل بين الشرائح وبطاقات زجاجية مصنفرة تحمل النص.",
    bestFor: "التقنية والتطبيقات والعلامات العصرية", structures: ["list", "teach", "steps", "stats"], words: 20,
    look: "Soft organic mesh-gradient background (3–4 hues blending in several directions) that feels continuous from slide to slide; frosted-glass rounded cards holding the text with a soft light edge and gentle shadow; premium, calm, no hard outlines.",
    type: "Clean modern Arabic sans (Tajawal / Almarai feel), medium to bold, right-aligned, white or very dark text on the glass.",
    cover: "A glass card centred over the gradient with the headline, a smaller subtitle chip, a soft glow behind.",
    body: "One glass card with a headline and a short text, a small round number chip, the gradient continuing behind.",
    closing: "A glass card with the call to action and a glowing button-like pill.",
    palettes: [P("بنفسجي غروب", "#2B1B5A", "#FFFFFF", "#FF7EB3", "#FFC371"), P("أزرق ليلي", "#0F2A44", "#FFFFFF", "#4FACFE", "#F093FB"), P("خوخي ناعم", "#FFD9C7", "#2A1A3A", "#7C5CFF", "#FF8FA3")],
  },
  {
    id: "neo-brutal", group: "حيوي وعصري", name: "بروتالي حديث",
    description: "حدود سوداء سميكة وظلال صلبة وألوان مشبعة متكاملة وبطاقات صندوقية.",
    bestFor: "المحتوى الشبابي، الأدوات، الأفكار الجريئة", structures: ["list", "mistakes", "myth", "steps"], words: 20,
    look: "Neo-brutalist: thick black outlines, hard offset drop shadows with no blur, flat saturated complementary colours, boxy cards, sticker-like labels and slightly rotated tags, buttons with heavy borders. Bold, playful, organised.",
    type: "Heavy Arabic sans (Cairo Black / Changa feel) in black, right-aligned, labels in uppercase-like compact weights.",
    cover: "A thick-bordered card with the headline, a rotated sticker label, a hard shadow and a big arrow shape.",
    body: "A thick-bordered box with a headline and a short line; a numbered tag sticking out of a corner.",
    closing: "A big bordered button-like box with the call to action.",
    palettes: [P("كريمي وأحمر", "#FFF1C9", "#000000", "#FF5A5F", "#3D5AFE"), P("نعناعي وأصفر", "#E8FFF3", "#000000", "#00C896", "#FFB400"), P("بنفسجي وليموني", "#F3E8FF", "#000000", "#9B5DE5", "#FEE440")],
  },
  {
    id: "dark-tech", group: "حيوي وعصري", name: "تقني داكن",
    description: "داكن مع شبكة خفيفة وتسميات بخط أحادي ولون نيون واحد وصناديق رفيعة.",
    bestFor: "البرمجة والذكاء الاصطناعي والأمن والأعمال التقنية", structures: ["steps", "list", "teach", "stats", "cheat"], words: 25,
    look: "Dark technical look: near-black background with a faint blueprint grid, monospaced Latin labels and numbers like code tags (e.g. 01 / 05), one neon accent colour, thin outlined boxes with small corner marks, subtle terminal-style details. Precise and calm.",
    type: "Arabic sans (IBM Plex Sans Arabic feel) for text, monospaced Latin only for small labels and numbers, right-aligned.",
    cover: "A tag line in monospace, the headline large, a thin outlined box, a blinking-cursor-like accent bar.",
    body: "A numbered label (01 / 06), a headline, a short text inside an outlined box, a small code-like detail.",
    closing: "A command-line-style call to action box and a handle.",
    palettes: [P("أسود وأخضر نيون", "#0A0F1C", "#E6EDF7", "#00E5A8", "#7C5CFF"), P("رمادي وأزرق", "#0D1117", "#C9D1D9", "#58A6FF", "#F78166"), P("أسود ووردي", "#111111", "#EDEDED", "#FF3D81", "#00D1FF")],
  },
  {
    id: "pop-blocks", group: "حيوي وعصري", name: "كتل ألوان مرحة",
    description: "كتل ألوان مسطحة وأشكال هندسية وخط مدوّر مرح بألوان زاهية.",
    bestFor: "المحتوى المرح، الأطفال والعائلة، العروض والفعاليات", structures: ["list", "qa", "story", "myth"], words: 20,
    look: "Playful flat colour blocks and geometric shapes (circles, squiggles, stars, half-moons), a bright saturated palette, bold rounded type, lively but organised composition with clear text areas.",
    type: "Rounded friendly Arabic sans (Tajawal / Marhey feel), bold, right-aligned.",
    cover: "A large colour block with the headline, two or three geometric shapes poking in from the edges.",
    body: "A colour block with a headline and a short line; shapes changing position each slide but staying in the same family.",
    closing: "A bright block with the call to action and a star or burst shape.",
    palettes: [P("أصفر ووردي", "#FFD166", "#1B1B1B", "#EF476F", "#06D6A0"), P("أزرق وفوشي", "#4361EE", "#FFFFFF", "#F72585", "#FFD60A"), P("كريمي وبرتقالي", "#FFF3E0", "#263238", "#FF7043", "#26A69A")],
  },

  // ───────── لمسة يدوية ─────────
  {
    id: "scrapbook", group: "لمسة يدوية", name: "دفتر قصاصات",
    description: "ورق بملمس، حواف ممزقة، شريط لاصق وإطارات بولارويد وملاحظات بخط يد.",
    bestFor: "السفر والحياة اليومية والقصص الشخصية والعلامات الدافئة", structures: ["story", "list", "journey", "before_after"], words: 22,
    look: "Scrapbook: textured paper background, torn-edge paper pieces, washi tape strips, polaroid-framed pictures or drawn items, handwritten-style Arabic notes, small doodles, slightly rotated elements, warm nostalgic mood. Elements overlap a little but the text stays clear.",
    type: "A handwritten-feeling Arabic (Mada / Aref Ruqaa feel) for notes and a clean Arabic sans for the main text, right-aligned.",
    cover: "A big paper piece with the headline taped on, a polaroid frame, a doodle arrow.",
    body: "A paper card taped to the page with a headline and a short note; a polaroid or sticker beside it.",
    closing: "A torn paper note with the call to action and a hand-drawn heart or star.",
    palettes: [P("ورق قديم", "#F1E4CC", "#3B2A20", "#C0563B", "#4F7C6D"), P("كريمي وبرتقالي", "#FBF1E6", "#2D2A32", "#D95D39", "#5B8E7D"), P("رمادي دافئ", "#EAE1D3", "#1F2933", "#B5838D", "#6D6875")],
  },
  {
    id: "doodle-notebook", group: "لمسة يدوية", name: "دفتر ملاحظات مرسوم",
    description: "صفحة دفتر مسطّرة أو مربعات مع خطوط تحتية وأسهم ودوائر ومظلل بخط اليد.",
    bestFor: "الشرح التعليمي، الملخصات، نصائح الدراسة والعمل", structures: ["teach", "steps", "cheat", "qa", "list"], words: 28,
    look: "Notebook page (ruled or grid paper) with hand-drawn marker underlines, arrows, circled words, highlighter strokes, small stars and boxes; the headline looks hand-lettered; friendly and personal, neat enough to read at a glance.",
    type: "Hand-lettered Arabic feel (Mada / Aref Ruqaa for headlines), a readable rounded Arabic sans for the body, right-aligned.",
    cover: "A notebook page with the headline hand-lettered and underlined, a doodled arrow and a highlighter stroke.",
    body: "A heading with a marker underline, short lines with small hand-drawn bullets, an arrow pointing to the key word.",
    closing: "A boxed note with the call to action and a doodled tick.",
    palettes: [P("ورق أبيض وأزرق", "#FFFEF7", "#1F2A44", "#2F6FED", "#FFD43B"), P("ورق كريمي وبرتقالي", "#FDFBF3", "#222222", "#E8590C", "#51CF66"), P("ورق رمادي وبنفسجي", "#F8F9FA", "#212529", "#7048E8", "#FCC419")],
  },
  {
    id: "sticker-collage", group: "لمسة يدوية", name: "ملصقات وكولاج",
    description: "عناصر كملصقات بحواف بيضاء فوق خلفية ملونة، وأشكال ورقية ونقاط هاف تون.",
    bestFor: "المحتوى الشبابي والترندات والأزياء والترفيه", structures: ["list", "story", "qa", "compare"], words: 18,
    look: "Cut-out collage: drawn subjects as white-bordered stickers over a bold coloured background, paper-cut shapes, halftone dots, pieces of tape; energetic and youthful, with a clear zone for the text.",
    type: "Bold Arabic sans (Alexandria / Cairo feel) with a slight tilt on key words, right-aligned.",
    cover: "Stickers around a bold headline on a saturated background, a halftone burst behind.",
    body: "A sticker-like label with the headline, a sticker illustration, a short line on a paper strip.",
    closing: "A burst-shaped sticker with the call to action.",
    palettes: [P("تركوازي وبرتقالي", "#2EC4B6", "#0B132B", "#FF9F1C", "#E71D36"), P("وردي وأصفر", "#FF6392", "#1B1B1B", "#FFE066", "#5BC0EB"), P("أصفر وأزرق", "#F4D35E", "#0D3B66", "#EE964B", "#F95738")],
  },
  {
    id: "flat-illustration", group: "لمسة يدوية", name: "رسم مسطّح دافئ",
    description: "رسوم متجهية مسطحة بأشكال مدوّرة وشخصيات بسيطة وملمس خفيف ولغة رسم موحدة.",
    bestFor: "التوعية والتعليم والصحة والأسرة والخدمات", structures: ["story", "teach", "steps", "before_after"], words: 22,
    look: "Warm flat vector illustration: simple characters and objects with rounded shapes and no outlines, soft grain texture, one consistent illustration language and colour logic across all slides, a clear text area on each slide. Friendly and trustworthy.",
    type: "Rounded clean Arabic sans (Tajawal / Almarai feel), bold headlines, regular body, right-aligned.",
    cover: "A large simple illustration that shows the topic, the headline in a clear area above or beside it.",
    body: "A medium illustration of the point, a headline and one or two short lines.",
    closing: "A friendly illustration with the call to action in a rounded panel.",
    palettes: [P("دافئ كريمي", "#FFF5E6", "#2B2D42", "#EF8354", "#4F5D75"), P("أخضر ماء", "#E8F5F2", "#1D3557", "#2A9D8F", "#E9C46A"), P("وردي ترابي", "#FDF0F0", "#3D2C2E", "#E76F51", "#8AB17D")],
  },

  // ───────── تعليمي ومعلوماتي ─────────
  {
    id: "step-numbers", group: "تعليمي ومعلوماتي", name: "خطوات مرقّمة",
    description: "رقم ضخم لكل خطوة وعنوان قصير وسطر شرح وشريط تقدّم في الأسفل.",
    bestFor: "الشروحات خطوة بخطوة والتعليم والتسجيل والإعداد", structures: ["steps", "teach", "cheat"], words: 25,
    look: "Step-by-step: a giant numeral for each step in a corner, a short headline, a one-line explanation, a small icon for the step and a progress bar or dots at the bottom showing the position; consistent and very scannable.",
    type: "Heavy Arabic numerals and headlines (Cairo Black feel) with a regular Arabic sans body, right-aligned.",
    cover: "The headline with the number of steps as a giant numeral («٥ خطوات…»), a short subtitle and the progress dots.",
    body: "The step's giant numeral, its headline, a one-line explanation, an icon, progress dots with the current one filled.",
    closing: "A recap strip of all the steps in one line each and the call to action.",
    palettes: [P("أبيض وأزرق", "#F7F7FF", "#0B1B3A", "#2D6CDF", "#FF7A00"), P("أبيض وأخضر", "#FFFFFF", "#1A2B1E", "#2E9E5B", "#F2B705"), P("كريمي وأحمر", "#FFF7F0", "#2B1B17", "#D6452D", "#1F7A8C")],
  },
  {
    id: "data-stats", group: "تعليمي ومعلوماتي", name: "أرقام وإحصاءات",
    description: "رقم ضخم واحد في كل شريحة مع سطر تعريف ورسم بسيط وسطر مصدر.",
    bestFor: "التقارير والدراسات والسوق والاقتصاد والصحة", structures: ["stats", "case", "teach", "list"], words: 20,
    look: "Data-driven: one huge statistic per slide with a short caption, a minimal chart (bar, ring or icon row) as the visual anchor, a small source line at the bottom, grid-aligned and uncluttered.",
    type: "Heavy Arabic numerals for the big number (Western or Arabic-Indic digits as given in the text), clean Arabic sans for captions, right-aligned.",
    cover: "The most striking number huge, a one-line promise under it, a simple chart hint.",
    body: "The big number, a caption sentence, a minimal chart, the source line.",
    closing: "A summary of the takeaway in one sentence with the call to action.",
    palettes: [P("داكن وتركوازي", "#0E1621", "#FFFFFF", "#2DD4BF", "#FACC15"), P("أبيض وأزرق", "#FFFFFF", "#0F172A", "#2563EB", "#F97316"), P("رمادي وبنفسجي", "#F8FAFC", "#111827", "#7C3AED", "#10B981")],
  },
  {
    id: "cheat-sheet", group: "تعليمي ومعلوماتي", name: "ورقة مرجعية",
    description: "بطاقة مرتبة بقائمة تحقق ومربعات علامة صح وأقسام معنونة، تُحفظ وتُصوَّر.",
    bestFor: "الملخصات والقوائم التي يحفظها الناس ويرجعون لها", structures: ["cheat", "list", "steps", "teach"], words: 40,
    look: "Cheat sheet: a tidy card with a checklist, boxes with tick marks, labelled sections, divider lines, compact but orderly spacing, designed to be saved and screenshotted. Dense but never cluttered, strong hierarchy.",
    type: "Readable Arabic sans (IBM Plex Sans Arabic / Cairo feel), semi-bold section labels, regular items, right-aligned, items at least 36 px on a 1080 px canvas.",
    cover: "A title with a small «احفظها» tag and a preview of the checklist look.",
    body: "A section label, four to six checklist rows with tick boxes, a divider.",
    closing: "A last row «تذكّر» with the single most important rule and the call to action.",
    palettes: [P("أبيض وسماوي", "#FFFFFF", "#1E293B", "#0EA5E9", "#F43F5E"), P("أصفر خفيف", "#FEFCE8", "#1C1917", "#CA8A04", "#16A34A"), P("أخضر خفيف", "#F0FDF4", "#14532D", "#16A34A", "#F59E0B")],
  },
  {
    id: "myth-fact", group: "تعليمي ومعلوماتي", name: "خرافة وحقيقة",
    description: "بطاقة بنصفين: «خرافة» بعلامة خطأ حمراء و«حقيقة» بعلامة صح خضراء.",
    bestFor: "تصحيح المفاهيم الخاطئة في الصحة والمال والتربية والتسويق", structures: ["myth", "mistakes", "qa"], words: 25,
    look: "Two-part cards: the top half labelled «خرافة» with a red cross mark and a short false statement, the bottom half labelled «حقيقة» with a green tick and the correction; very clear contrast between the halves; big short statements.",
    type: "Bold Arabic sans (Cairo feel), the labels in white on coloured tabs, right-aligned.",
    cover: "A split card with a large question mark and the headline («خرافات عن…»).",
    body: "The myth in the top half with a cross, the fact in the bottom half with a tick.",
    closing: "A card that says which myth surprised you, with the call to comment or share.",
    palettes: [P("أبيض وأحمر وأخضر", "#FFFFFF", "#111827", "#DC2626", "#16A34A"), P("كريمي وبرتقالي", "#FFF7ED", "#1F2937", "#EA580C", "#0D9488"), P("بنفسجي فاتح", "#F5F3FF", "#1E1B4B", "#E11D48", "#059669")],
  },
  {
    id: "split-compare", group: "تعليمي ومعلوماتي", name: "مقارنة منقسمة",
    description: "تصميم مقسوم نصفين لونيين: خيار أ مقابل خيار ب أو قبل وبعد، فرق واحد في كل شريحة.",
    bestFor: "المقارنات وقبل وبعد وتجارب المنتجات", structures: ["compare", "before_after", "mistakes", "list"], words: 24,
    look: "Split-screen layout divided into two coloured halves (vertical or horizontal): option A versus option B, or before versus after; one difference per slide, the two sides mirrored in structure so they read in parallel; a small «VS» badge on the dividing line.",
    type: "Bold Arabic sans (Cairo / Almarai feel), the two sides in matching sizes, right-aligned in each half.",
    cover: "The two sides named large with the VS badge, one short line of what is compared.",
    body: "The aspect in a small tab on top, side A's line on one half and side B's on the other.",
    closing: "A verdict slide: which side wins for whom, and the call to action.",
    palettes: [P("أحمر وأزرق", "#F1FAEE", "#1D3557", "#E63946", "#457B9D"), P("أحمر وأخضر", "#FFF8E7", "#2B2D42", "#EF233C", "#2B9348"), P("بنفسجي وبرتقالي", "#EDE7F6", "#1A1A2E", "#7E57C2", "#FFA726")],
  },
  {
    id: "quote-calm", group: "تعليمي ومعلوماتي", name: "اقتباس هادئ",
    description: "بطاقة اقتباس بعلامة تنصيص كبيرة ونص متمركز بخط أنيق ومصدر صغير وهدوء.",
    bestFor: "الحكم والاقتباسات والتأملات والمحتوى الروحي", structures: ["quote", "story", "list"], words: 25,
    look: "Quiet quote card: a large opening quotation mark, the quote centred in elegant Arabic type, the source small beneath, a soft textured background, a thin divider, lots of calm space.",
    type: "Elegant Arabic calligraphic-leaning type (naskh / ruqaa feel) for the quote, a light clean sans for the source, centred.",
    cover: "The most striking quote large and centred with the quotation mark.",
    body: "One quote per slide with its source, the same calm composition.",
    closing: "A reflective question or call to share, the account handle small.",
    palettes: [P("كريمي وبني", "#F4EDE4", "#2E2A25", "#8C6B4F", "#C9A87C"), P("كحلي وذهبي", "#14213D", "#F1F5F9", "#E5C07B", "#94A3B8"), P("أخضر ناعم", "#EAF2EF", "#1B3A33", "#2F6F5E", "#D8B26E")],
  },

  // ───────── قصصي وبصري ─────────
  {
    id: "journey-route", group: "قصصي وبصري", name: "رحلة ومسار",
    description: "خط مسار يمر عبر الشرائح ويربط محطات مرقمة كمراحل رحلة بعلامات خرائط.",
    bestFor: "قصص النجاح والمراحل والخرائط الزمنية ورحلة العميل", structures: ["journey", "story", "case", "steps"], words: 22,
    look: "A route line or winding path runs through the slides connecting numbered stops (the stages of a journey) with map-inspired markers and pins; each slide is one stop with the path entering and leaving at the edges so it reads as one road.",
    type: "Friendly Arabic sans (Tajawal feel), stop names bold, right-aligned, the route flowing from right to left.",
    cover: "The start of the route with a pin, the headline, the first stop's label.",
    body: "One stop: a numbered pin on the route, the stage's headline and a short line, the road continuing on both edges.",
    closing: "The destination with a flag, the result and the call to action.",
    palettes: [P("ورقي وأحمر", "#FFF9EC", "#25344F", "#D6453D", "#3E8E7E"), P("سماوي وبرتقالي", "#E9F5F9", "#14324A", "#FF8C42", "#2A9D8F"), P("خريطة قديمة", "#F3EFE0", "#263238", "#C0392B", "#2980B9")],
  },
  {
    id: "seamless-panorama", group: "قصصي وبصري", name: "بانوراما متصلة",
    description: "تكوين واحد ممتد عبر الشرائح: أشكال وخط ورسم يعبر حافة الشريحة إلى التي تليها.",
    bestFor: "رفع نسبة إكمال المشاهدة والقصص البصرية والعروض", structures: ["story", "journey", "list", "before_after"], words: 18,
    look: "One continuous panoramic composition spread across the slides: shapes, a line or an illustration bleed over a slide's edge into the next; a consistent background across the whole strip; text sits safely inside each slide away from the cut; each slide still works alone.",
    type: "Clean bold Arabic sans (Cairo / Alexandria feel), right-aligned, text placed away from the shared edges.",
    cover: "The start of the panorama with the headline, an element that crosses the left edge to invite a swipe.",
    body: "A part of the panorama with a headline and a short line, elements crossing both edges at the same height.",
    closing: "The end of the panorama resolving the shapes, with the call to action.",
    palettes: [P("خوخي وتركوازي", "#FBE8D3", "#2D1E2F", "#E4572E", "#17BEBB"), P("كحلي وأصفر", "#101D42", "#FFFFFF", "#FFC857", "#E9724C"), P("أخضر وبرتقالي", "#D8F3DC", "#1B4332", "#2D6A4F", "#FFB703")],
  },
  {
    id: "photo-led", group: "قصصي وبصري", name: "صورة تقود",
    description: "صورة أو لوحة بملء الشريحة مع تدرج داكن وشريط نص نظيف وتلوين موحد.",
    bestFor: "السفر والطعام والعقار والمنتجات والقصص المصورة", structures: ["story", "list", "journey", "case"], words: 18,
    look: "Full-bleed photographic or painterly picture on every slide with a dark gradient scrim at the bottom and a clean text band over it; large text with strong contrast; a cinematic crop; one consistent colour grade across the set.",
    type: "Bold Arabic sans (Cairo / Almarai feel) in white over the scrim, right-aligned.",
    cover: "The most striking picture full-bleed, the headline large on the scrim, a small label.",
    body: "A full-bleed picture of the point, the headline and one short line on the scrim.",
    closing: "A calm picture with the call to action on the scrim and the handle.",
    palettes: [P("داكن وأصفر", "#101820", "#FFFFFF", "#FEE715", "#F2AA4C"), P("كحلي وتركوازي", "#0B132B", "#FFFFFF", "#5BC0BE", "#FFFFFF"), P("رمادي وأحمر", "#1B1B1B", "#FFFFFF", "#E63946", "#F1FAEE")],
  },
  {
    id: "case-proof", group: "قصصي وبصري", name: "دراسة حالة وإثبات",
    description: "النتيجة أولًا برقم كبير، ثم المشكلة والنهج والنتيجة، وبطاقات آراء بنجوم.",
    bestFor: "المشاريع الناجحة وآراء العملاء وإثبات الخدمة", structures: ["case", "proof", "before_after", "stats"], words: 28,
    look: "Case study and proof: a bold big-number result first, then problem → approach → result slides with simple before/after figures, review-style quote cards with a name line and a row of stars; credible, orderly, one metric highlighted per slide.",
    type: "Professional Arabic sans (IBM Plex Sans Arabic / Cairo feel), the numbers heavy, right-aligned.",
    cover: "The result as a big number with one line of context and a small label «دراسة حالة».",
    body: "A step label (المشكلة / النهج / النتيجة), a headline, two short lines, a figure or a review card.",
    closing: "A summary of the lesson and the call to book or ask.",
    palettes: [P("أبيض وأزرق وأخضر", "#F8FAFC", "#0F172A", "#1D4ED8", "#22C55E"), P("كريمي وبني", "#FFFBEB", "#292524", "#B45309", "#15803D"), P("رمادي وتركوازي", "#F1F5F9", "#1E293B", "#0891B2", "#F59E0B")],
  },
  {
    id: "arabesque-heritage", group: "قصصي وبصري", name: "زخرفة تراثية",
    description: "زخارف هندسية إسلامية كنجوم في الإطار أو الزوايا وخط ذو روح خطية بأخضر أو كحلي مع ذهبي.",
    bestFor: "رمضان واليوم الوطني والمناسبات الدينية والثقافية والتراث", structures: ["quote", "story", "list", "teach"], words: 20,
    look: "Heritage arabesque: geometric Islamic star patterns in the border or corners, an ornate thin frame, a calm and dignified composition, deep green or navy with gold details, restrained and respectful, the ornament never touching the text.",
    type: "Display Arabic with a calligraphic naskh / thuluth-inspired character for headlines (fully legible), a clean Arabic naskh-leaning sans for the body, centred or right-aligned.",
    cover: "The headline in calligraphic display type inside an ornamental frame with a small star ornament above it.",
    body: "A framed panel with a headline and a short text, corner ornaments, a small star divider.",
    closing: "A framed closing blessing or call to action with a small ornament and the handle.",
    palettes: [P("أخضر وذهبي", "#0B3D2E", "#F8F1DC", "#D4AF37", "#8FBF9F"), P("كحلي وذهبي", "#12254A", "#F6F0E0", "#C9A24B", "#7FB3D5"), P("كريمي وأخضر", "#F7F1E3", "#1F3B2C", "#A67C00", "#7A1F2B")],
  },
];

export const findTemplate = (id: string) => CAROUSEL_TEMPLATES.find((t) => t.id === id);
export const structureName = (id: StructureId) => STRUCTURES.find((s) => s.id === id)!.ar;

/** The design system of a template with one of its palettes, as it is written into every slide's prompt. */
export function designSystem(t: CarouselTemplate, palette: number): string {
  const p = t.palettes[Math.max(0, Math.min(2, palette))];
  return [
    `DESIGN SYSTEM — identical on every slide of this carousel, so the set reads as one.`,
    `Look: ${t.look}`,
    `Palette: background ${p.bg}, text ${p.text}, primary ${p.primary}, accent ${p.accent} (use only these colours and their tints; text placed on a primary or accent shape uses whichever of the background and text colours contrasts more with that shape).`,
    `Typography: ${t.type}`,
    `Layout: keep every important element inside a safe area at least 8% from each edge, and the cover's key content inside the central square; at most about ${t.words} words on a slide; one idea per slide; large readable type (body no smaller than 3.3% of the slide height).`,
  ].join("\n");
}

/** What the carousel's slides must follow about Arabic text (added to every slide's prompt). */
export const ARABIC_TEXT_RULES =
  "Arabic text rules: write the Arabic exactly as given between the quotation marks, letter by letter, right-to-left and right-aligned, with the letters properly joined (never separated, reversed or mirrored), spelled exactly, each text shown exactly once, fully inside the slide and never cropped; no other words, letters, fake text or gibberish anywhere (decorative elements carry no letters); digits as given.";

/** The sample copy every thumbnail uses (the same words, so the looks can be compared). */
export const THUMB_TEXT = "٥ عادات تغيّر يومك";

/** The thumbnail of a template: one sample cover with the template's first palette. */
export function thumbPrompt(t: CarouselTemplate): string {
  return [
    `A COVER slide of an Instagram carousel, square 1:1, showing the look of the carousel template "${t.id}" so a person can choose it from a gallery.`,
    designSystem(t, 0),
    `Cover anatomy: ${t.cover}`,
    `The only text on the slide, written exactly and right-to-left: "${THUMB_TEXT}" (the headline).`,
    ARABIC_TEXT_RULES,
    "No logos, no real people, no brand names. Flat, print-quality.",
  ].join("\n\n");
}
