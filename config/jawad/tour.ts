// «الجولة التعريفية» — how a newcomer makes a film from nothing, in plain formal Arabic. It opens by itself after the
// first sign-in, can be skipped, and stays in the header as a ring that shows how much of it is done (open it any
// time). Two paths: the studio (images → video → editing) or the film maker («المشهد القصير», step by step). The first
// image is the person's own, made free once per account with GPT Image 2 (standard size). Pure content.

import { JAWAD } from "./brand";

export interface TourStep {
  id: string;
  title: string;
  body: string;
  /** a picture that shows the step (public path) */
  image?: string;
  /** where the step happens */
  href?: string;
  cta?: string;
}
export interface TourPath {
  id: "studio" | "film";
  title: string;
  lead: string;
  image: string;
  steps: TourStep[];
}

const base = JAWAD.base;
const style = (id: string) => `/film/styles/${id}.jpg`;

export const TOUR_WELCOME = {
  title: "أهلًا بك في الجواد الذكي",
  body: "الجواد الذكي منصة تعليمية تبدأ معك من الصفر. ستصنع صورتك الأولى بنفسك، ثم نوضح لك خطوة بخطوة كيف تصل إلى فيلم كامل: صور، ثم فيديو، ثم مونتاج. لا تحتاج خبرة سابقة.",
  points: ["تتعلّم بالتجربة لا بالقراءة فقط", "كل خطوة لها شرح مختصر ومثال", "تقدر تتخطى الجولة وترجع لها متى شئت من الدائرة أعلى الصفحة"],
  images: [style("pixar-classic"), style("ghibli"), style("shinkai"), style("dreamworks-epic")],
};

export const TOUR_TRY = {
  title: "جرّب بنفسك: صورتك الأولى مجانًا",
  body: "اكتب وصفًا لصورة تتخيلها: من فيها، وأين، وكيف الإضاءة والجو. كلما كان الوصف أوضح كانت الصورة أقرب لما في ذهنك. هذه التجربة مجانية مرة واحدة بمحرك GPT Image 2 بالمقاس القياسي.",
  tips: ["من؟ الشخصية أو الشيء الرئيسي", "أين؟ المكان والوقت", "كيف؟ الإضاءة والألوان والزاوية"],
  examples: [
    "طفل يقرأ كتابًا تحت شجرة نخيل عند الغروب، إضاءة ذهبية دافئة، أسلوب بيكسار",
    "قارب خشبي صغير في بحر هادئ ليلًا، القمر ينعكس على الماء، ألوان زرقاء ناعمة",
    "سوق شعبي قديم مزدحم صباحًا، أشعة الشمس تدخل بين المظلات، تفاصيل واقعية",
    "رائد فضاء يزرع وردة على سطح القمر، الأرض تظهر في الخلفية، أسلوب سينمائي",
  ],
};

export const TOUR_PATHS: TourPath[] = [
  {
    id: "studio",
    title: "الطريق الأول: الاستوديو خطوة بخطوة",
    lead: "تصنع كل جزء بنفسك مع «جواد»: الصور أولًا، ثم تحوّلها إلى فيديو، ثم تجمعها في المونتاج. مناسب لمن يريد فهم كل مرحلة والتحكم بها.",
    image: style("hybrid-2d3d"),
    steps: [
      { id: "s-images", title: "١. صناعة الصور", body: "اكتب لجواد ما تريد، فيكتب لك البرومبت ويختار المولّد والإعدادات. اختر «الستايل» من الصور إن أردت أسلوبًا موحدًا لكل أعمالك، ثم اضغط «توليد». الصورة الجيدة هي أساس الفيديو الجيد.", image: style("pixar-natural"), href: `${base}/images`, cta: "افتح صناعة الصور" },
      { id: "s-video", title: "٢. صناعة الفيديو", body: "خذ صورتك واجعلها الإطار الأول للمقطع، ثم صف الحركة: ماذا يتحرك، وكيف تتحرك الكاميرا. ابدأ بمقاطع قصيرة من ٤ إلى ٨ ثوانٍ، فهي أسهل في الضبط وأقل تكلفة.", image: style("dreamworks-epic"), href: `${base}/video`, cta: "افتح صناعة الفيديو" },
      { id: "s-audio", title: "٣. الصوت", body: "أضف تعليقًا صوتيًا أو مؤثرات أو موسيقى من صناعة الصوت. الصوت يصنع نصف الإحساس في الفيلم.", image: style("ghibli"), href: `${base}/audio`, cta: "افتح صناعة الصوت" },
      { id: "s-edit", title: "٤. المونتاج في «حيدرة كت»", body: "اجمع مقاطعك وأصواتك على التايملاين، ورتّبها وقصّها وأضف الكتابة والانتقالات. «حيدرة» يساعدك في كل خطوة، ثم تصدّر فيلمك.", image: style("comic-print"), href: `${base}/editor`, cta: "افتح حيدرة كت" },
    ],
  },
  {
    id: "film",
    title: "الطريق الثاني: صانع الفيلم السينمائي",
    lead: "تكتب فكرتك مرة واحدة، والمنصة تأخذك عبر مراحل الفيلم بالترتيب: من القصة حتى المونتاج. مناسب لمن يريد مشهدًا قصيرًا متكاملًا بأقل جهد.",
    image: style("shinkai"),
    steps: [
      { id: "f-story", title: "١. القصة", body: "اكتب فكرة المشهد بكلماتك، ولو كانت سطرًا واحدًا. «سجّاد» يسألك ما يلزم ليكتمل التصور.", image: style("golden-2d") },
      { id: "f-script", title: "٢. السيناريست", body: "تتحول الفكرة إلى سيناريو: الشخصيات، والحوار، وما يحدث في كل لقطة. تراجعه وتعدّل ما تريد قبل الانتقال.", image: style("drawn-over-cg") },
      { id: "f-sheets", title: "٣. صانع الشيت", body: "تُرسم الشخصيات والأماكن بالستايل الذي تختاره، لتبقى الشخصية نفسها في كل لقطة.", image: style("pixar-caricature") },
      { id: "f-director", title: "٤. المخرج", body: "تُقسَّم القصة إلى لقطات، لكل لقطة زاويتها وحركتها ومدتها.", image: style("seinen") },
      { id: "f-videos", title: "٥. التوليد", body: "تتحول كل لقطة إلى مقطع فيديو. تختار الأفضل من بين المحاولات.", image: style("modern-shonen") },
      { id: "f-voices", title: "٦. الأصوات", body: "يُعطى كل متحدث صوتًا يناسبه، وتُضاف المؤثرات.", image: style("anime-western") },
      { id: "f-edit", title: "٧. المونتاج", body: "تُجمع اللقطات في فيلم واحد، وتقدر تكمل تحسينه في «حيدرة كت».", image: style("retro-cel"), href: `${base}/film/new`, cta: "ابدأ مشهدك القصير" },
    ],
  },
];

export const TOUR_DONE = {
  title: "أحسنت، بدأت رحلتك",
  body: "عرفت الآن الطريقين لصناعة فيلم من الصفر. اختر أحدهما وابدأ، والجولة تبقى في الدائرة أعلى الصفحة متى احتجت تراجعها.",
};

/** Every mark the ring counts: welcome, the free image, choosing a path, and each step of both paths. */
export const TOUR_MARKS = ["welcome", "ask", "try", "path", ...TOUR_PATHS.flatMap((p) => p.steps.map((s) => s.id))];
/** The ring is full when the welcome, the trial, a path and every step of the chosen path are done. */
export function tourProgress(done: readonly string[], path: TourPath["id"] | null): number {
  const p = TOUR_PATHS.find((x) => x.id === path) ?? TOUR_PATHS[0];
  const need = ["welcome", "ask", "try", "path", ...p.steps.map((s) => s.id)];
  return need.filter((m) => done.includes(m)).length / need.length;
}

export const TOUR_TRY_MAX = 800;

/** «جواد يتعرّف عليك»: a few questions in the tour, so the offers fit what each person likes. */
export const TOUR_ASK = {
  title: "جواد يتعرّف عليك",
  body: "قبل أن نبدأ، يسألك جواد بعض الأسئلة القصيرة ليقترح عليك ما يناسبك. اختر ما ينطبق عليك، ويمكنك التخطي.",
  questions: [
    { id: "make", q: "ماذا تريد أن تصنع؟", multi: true, options: ["أفلام ومشاهد قصيرة", "إعلانات ومحتوى تسويقي", "ريلز ومحتوى للسوشال", "محتوى تعليمي", "محتوى ديني", "قصص للأطفال", "صور وتصاميم", "ألعاب"] },
    { id: "level", q: "ما خبرتك في صناعة المحتوى بالذكاء الاصطناعي؟", multi: false, options: ["مبتدئ تمامًا", "جرّبت قليلًا", "أستخدمه باستمرار", "محترف"] },
    { id: "goal", q: "لمن تصنع؟", multi: false, options: ["لنفسي وهواية", "لعملي أو مشروعي", "لعملاء", "للتعليم والدراسة"] },
    { id: "want", q: "ما الذي يهمك أكثر؟", multi: true, options: ["أتعلم خطوة بخطوة", "نتائج سريعة", "جودة سينمائية", "توفير التكلفة"] },
  ],
  words: "اكتب كلمة أو كلمتين عن فكرتك أو ما تحب أن تصنعه (اختياري)",
} as const;
export type TourAnswers = Partial<Record<(typeof TOUR_ASK.questions)[number]["id"], string[]>>;

/** The answers made safe: only known options, and a few words. */
export function readAnswers(raw: unknown, wordsRaw: unknown): { answers: TourAnswers; words: string } {
  const o = (raw ?? {}) as Record<string, unknown>;
  const answers: TourAnswers = {};
  for (const q of TOUR_ASK.questions) {
    const v = (Array.isArray(o[q.id]) ? (o[q.id] as unknown[]) : []).map(String).filter((x) => (q.options as readonly string[]).includes(x));
    if (v.length) answers[q.id] = q.multi ? [...new Set(v)] : [v[0]];
  }
  return { answers, words: String(wordsRaw ?? "").replace(/\s+/g, " ").trim().slice(0, 120) };
}
