// The site's sections, shown on the home page and in the header menu. Add a new one here.

export interface SiteSection {
  key: string;
  title: string;
  description: string;
  icon: string;
  href: string;
  /** Only users with access to the film branch can open it; others see "قريبًا". */
  requiresFilmAccess?: boolean;
}

export const SECTIONS: SiteSection[] = [
  {
    key: "booklet",
    title: "كتيب نهج علي",
    description: "صورة طفلك تصير شخصية كرتونية تتعلّم الصلاة والقرآن والعادات الطيبة، في كتيب ملوّن باسمه.",
    icon: "📖",
    href: "/booklet",
  },
  {
    key: "film",
    title: "صناعة فيلم",
    description: "من فكرتك إلى سيناريو وشخصيات ومقاطع فيديو وأصوات، خطوة بخطوة.",
    icon: "🎬",
    href: "/film",
    requiresFilmAccess: true,
  },
  {
    key: "mahdi",
    title: "لأجل المهدي",
    description: "تابع عاداتك ومشاريعك اليومية بهدوء وثبات، واعرف أين تقدّمت وأين تحتاج انتباهًا.",
    icon: "📿",
    href: "/mahdi",
  },
];
