// The site's sections, shown on the home page and in the header menu. Add a new one here.
// (The film maker lives only inside «الجواد الذكي!» now: /jawad-ai/film; old /film links redirect there, see proxy.ts.)

export interface SiteSection {
  key: string;
  title: string;
  description: string;
  icon: string;
  href: string;
  /** Listed but closed («تحت التطوير») while «كتيب نهج علي» is not open for everyone (/admin/limits); the owner can still open it. */
  underDevelopment?: boolean;
}

export const SECTIONS: SiteSection[] = [
  {
    key: "booklet",
    title: "كتيب نهج علي",
    description: "صورة طفلك تصير شخصية كرتونية تتعلّم الصلاة والقرآن والعادات الطيبة، في كتيب ملوّن باسمه.",
    icon: "📖",
    href: "/booklet",
    underDevelopment: true,
  },
  {
    key: "mahdi",
    title: "لأجل المهدي",
    description: "تابع عاداتك ومشاريعك اليومية بهدوء وثبات، واعرف أين تقدّمت وأين تحتاج انتباهًا.",
    icon: "📿",
    href: "/mahdi",
  },
];
