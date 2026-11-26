// «لأجل المهدي» — every place in the app, in one list. The plan «واجهة لأجل المهدي الجديدة» (approved by the owner,
// 26 November 2026): five destinations always in sight (اليوم · عاداتي · القراءة · المجتمع · أنا), no side menu; every
// other screen is one tap from one of them, and an inner screen has a back arrow and its own title. Pure.

import { t } from "@/lib/mahdi/i18n";
import type { IconName } from "./Icon";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  match: (path: string) => boolean;
}

const starts = (...p: string[]) => (path: string) => p.some((x) => path === x || path.startsWith(`${x}/`));

export const HOME: NavItem = { href: "/mahdi", label: "اليوم", icon: "home", match: (p) => p === "/mahdi" || p.startsWith("/mahdi/day") };
export const HABITS: NavItem = {
  href: "/mahdi/projects",
  label: "عاداتي",
  icon: "projects",
  match: starts("/mahdi/projects", "/mahdi/habits", "/mahdi/progress", "/mahdi/health", "/mahdi/grow"),
};
export const READING: NavItem = {
  href: "/mahdi/reading",
  label: "القراءة",
  icon: "book",
  match: starts("/mahdi/reading", "/mahdi/khatma", "/mahdi/read-challenge"),
};
export const COMMUNITY: NavItem = {
  href: "/mahdi/community",
  label: "المجتمع",
  icon: "globe",
  match: starts("/mahdi/community", "/mahdi/challenges", "/mahdi/share", "/mahdi/stories", "/mahdi/groups", "/mahdi/race", "/mahdi/p", "/mahdi/post", "/mahdi/u"),
};
export const ME: NavItem = { href: "/mahdi/more", label: "أنا", icon: "user", match: starts("/mahdi/more", "/mahdi/inbox", "/mahdi/sheikh", "/mahdi/support") };
/** kept for older imports */
export const PROGRESS: NavItem = { href: "/mahdi/progress", label: t.nav.side.progress, icon: "progress", match: starts("/mahdi/progress") };

/** The five destinations, in reading order (right to left). */
export const TABS: readonly NavItem[] = [HOME, HABITS, READING, COMMUNITY, ME];

/** The destination a path belongs to (null outside the app). */
export const tabOf = (path: string): NavItem | null => TABS.find((x) => x.match(path)) ?? null;

/** A destination's own first screen: the top bar shows its name and no back arrow. */
export const isTabRoot = (path: string) => TABS.some((x) => x.href === path);

/** Inner screens: their title in the top bar (the longest matching start wins). */
const TITLES: [string, string][] = [
  ["/mahdi/day", "يومك"],
  ["/mahdi/progress", "تقدّمي"],
  ["/mahdi/projects", "المشروع"],
  ["/mahdi/habits", "العادة"],
  ["/mahdi/health", "الصحة العلوية"],
  // its inner screens (its four views keep the section's name; an exercise steps back to «تعلّم»)
  ["/mahdi/health/learn", "الصحة العلوية"],
  ["/mahdi/health/setup", "خطة جديدة"],
  ["/mahdi/health/habits", "أدخلها في عاداتي"],
  ["/mahdi/health/research", "البحث والمصادر"],
  ["/mahdi/grow", "أهدافي"],
  ["/mahdi/reading/add", "كتاب جديد"],
  ["/mahdi/reading/goals", "هدف القراءة"],
  ["/mahdi/reading/guide", "مسبار القارئ"],
  ["/mahdi/reading/shelf", "مكتبتي"],
  ["/mahdi/reading/book", "الكتاب"],
  ["/mahdi/reading/session", "جلسة قراءة"],
  ["/mahdi/reading/read", "القارئ"],
  ["/mahdi/khatma", "ختمتي"],
  ["/mahdi/khatma/free", "القراءة الحرة"],
  ["/mahdi/khatma/groups", "ختمات المجموعات"],
  ["/mahdi/khatma/read", "القرآن"],
  ["/mahdi/read-challenge", "تحدي القراءة"],
  ["/mahdi/challenges", "التحديات"],
  ["/mahdi/share", "شارك يومك"],
  ["/mahdi/stories", "القصص"],
  ["/mahdi/groups", "المجموعات"],
  ["/mahdi/race", "المسابقة"],
  ["/mahdi/p", "المنشور"],
  ["/mahdi/post/new", "منشور جديد"],
  ["/mahdi/u", "الصفحة"],
  ["/mahdi/inbox", "الإشعارات"],
  ["/mahdi/sheikh", "الشيخ الذكي"],
  ["/mahdi/support", "ادعم التطبيق"],
  ["/mahdi/more/family", "العائلة"],
  ["/mahdi/more/privacy", "الخصوصية"],
  ["/mahdi/more/rewards", "المكافآت"],
  ["/mahdi/more/notifications", "التذكير"],
  ["/mahdi/more/metrics", "الأرقام"],
  ["/mahdi/more/sheikh-questions", "أسئلة الشيخ"],
];

export function titleOf(path: string): string {
  const root = TABS.find((x) => x.href === path);
  if (root) return root.label;
  let best: [string, string] | null = null;
  for (const e of TITLES) if ((path === e[0] || path.startsWith(`${e[0]}/`)) && (!best || e[0].length > best[0].length)) best = e;
  return best?.[1] ?? tabOf(path)?.label ?? t.brand;
}

/**
 * Where «رجوع» goes when there is no in-app history (the screen was opened from a link or a notification): one step up
 * the path, else the destination's first screen.
 */
export function parentOf(path: string): string {
  const tab = tabOf(path);
  const parts = path.split("/").filter(Boolean);
  while (parts.length > 1) {
    parts.pop();
    const up = `/${parts.join("/")}`;
    if (TITLES.some((e) => e[0] === up) || TABS.some((x) => x.href === up)) return up;
  }
  return tab?.href ?? "/mahdi";
}

/** The doors of each destination: the screens that used to live in the side menu, one tap away. */
export interface Door {
  href: string;
  label: string;
  icon: IconName;
}
export const DOORS = {
  habits: [
    { href: "/mahdi/progress", label: "تقدّمي", icon: "progress" },
    { href: "/mahdi/grow", label: "أهدافي", icon: "target" },
    { href: "/mahdi/health", label: "الصحة العلوية", icon: "streak" },
  ],
  reading: [
    { href: "/mahdi/khatma", label: "ختمتي", icon: "book" },
    { href: "/mahdi/khatma/free", label: "القراءة الحرة", icon: "book" },
    { href: "/mahdi/khatma/groups", label: "ختمات المجموعات", icon: "users" },
    { href: "/mahdi/read-challenge", label: "تحدي القراءة", icon: "flag" },
    { href: "/mahdi/reading/guide", label: "مسبار القارئ", icon: "search" },
    { href: "/mahdi/sheikh", label: "الشيخ الذكي", icon: "chat" },
  ],
  community: [
    { href: "/mahdi?view=following", label: "المتابَعون", icon: "users" },
    { href: "/mahdi/stories", label: "القصص", icon: "camera" },
    { href: "/mahdi/groups", label: "المجموعات", icon: "users" },
    { href: "/mahdi/challenges", label: "التحديات", icon: "flag" },
    { href: "/mahdi/race", label: "المسابقة", icon: "sparkle" },
  ],
} satisfies Record<string, Door[]>;
