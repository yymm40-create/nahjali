// Art styles the parent chooses from. Edit the prompts freely.
// `sample` is the preview image shown on the order page (public/styles/<key>.jpg).

export type StyleKey = "pixar" | "illumination" | "golden2d" | "anime";

export interface ArtStyle {
  label: string;
  description: string;
  prompt: string;
  /** Optional extra image sent to OpenAI to show the look (style only, never content). */
  referenceImage?: string;
}

export const STYLES: Record<StyleKey, ArtStyle> = {
  pixar: {
    label: "بيكسار حديث",
    description: "ثلاثي الأبعاد سينمائي بلمسة مرسومة",
    prompt: `Modern stylized Pixar. Deliberate anime-influenced distortion, exaggerated squash in the shapes, flatter shading ramps, punchier saturated color, graphic simplification of secondary detail, expressive posing, cinematic lighting retained.`,
    referenceImage: "config/style-reference.png",
  },
  illumination: {
    label: "كرتون ثلاثي الأبعاد",
    description: "ناعم ومدوّر وألوانه مرحة",
    prompt: `Illumination Entertainment 3D animation style. Rounded simplified shape language, smooth clean low-noise surfaces, broad readable forms, high-saturation color, soft even lighting with gentle contrast, reduced detail density, friendly accessible rendering.`,
  },
  golden2d: {
    label: "رسم كلاسيكي",
    description: "رسوم يدوية دافئة مثل قصص زمان",
    prompt: `Classic hand-drawn 2D animation, golden-age Disney. Ink-and-paint cel characters with soft grease-pencil line weight, flat gouache color fills, lush watercolor painted backgrounds with visible paper grain, warm vintage film tone, gentle vignetting.`,
  },
  anime: {
    label: "أنمي ياباني",
    description: "ألوان قوية وإضاءة ساحرة",
    prompt: `Modern ufotable style anime. Cel-shaded characters with crisp ink outlines and hard-edged shadow shapes composited over detailed painted 3D environments, heavy digital compositing, volumetric light shafts, floating particles, glow bloom, dramatic color script.`,
  },
};

export const DEFAULT_STYLE: StyleKey = "pixar";

export const isStyle = (s: unknown): s is StyleKey => typeof s === "string" && s in STYLES;
