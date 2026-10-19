// «لأجل المهدي» — every place in the app, in one list: the side menu (☰), the computer's side bar and the phone's
// bottom bar all read it, so a new screen is added once. Pure.

import { t } from "@/lib/mahdi/i18n";
import type { IconName } from "./Icon";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** the colour of its tile in the menu */
  color: string;
  match: (path: string) => boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

const starts = (...p: string[]) => (path: string) => p.some((x) => path === x || path.startsWith(`${x}/`));

export const HOME: NavItem = { href: "/mahdi", label: t.nav.home, icon: "home", color: "#8b5cf6", match: (p) => p === "/mahdi" || p.startsWith("/mahdi/day") };
export const HABITS: NavItem = { href: "/mahdi/projects", label: t.nav.side.projects, icon: "projects", color: "#ec4899", match: starts("/mahdi/projects", "/mahdi/habits") };
export const READING: NavItem = { href: "/mahdi/reading", label: t.nav.side.reading, icon: "book", color: "#f97316", match: starts("/mahdi/reading") };
export const COMMUNITY: NavItem = { href: "/mahdi/community", label: t.nav.side.community, icon: "globe", color: "#06b6d4", match: starts("/mahdi/community", "/mahdi/challenges", "/mahdi/share") };
export const PROGRESS: NavItem = { href: "/mahdi/progress", label: t.nav.side.progress, icon: "progress", color: "#10b981", match: starts("/mahdi/progress") };

/** The side menu: everything, in four groups. `username` makes «صفحتي». */
export function navGroups(username: string | null): NavGroup[] {
  return [
    {
      title: "يومي",
      items: [
        HOME,
        HABITS,
        READING,
        { href: "/mahdi/health", label: "الصحة العلوية", icon: "streak", color: "#ef4444", match: starts("/mahdi/health") },
        { href: "/mahdi/khatma", label: t.khatma.title, icon: "book", color: "#16a34a", match: starts("/mahdi/khatma") },
        PROGRESS,
        { href: "/mahdi/challenges", label: t.challenges.title, icon: "flag", color: "#eab308", match: starts("/mahdi/challenges") },
      ],
    },
    {
      title: "المجتمع",
      items: [
        COMMUNITY,
        { href: "/mahdi?view=following", label: t.slider.following, icon: "users", color: "#3b82f6", match: () => false },
        { href: "/mahdi/stories", label: "القصص", icon: "camera", color: "#d946ef", match: starts("/mahdi/stories") },
        { href: "/mahdi/groups", label: t.groups.title, icon: "users", color: "#14b8a6", match: starts("/mahdi/groups") },
        ...(username ? [{ href: `/mahdi/u/${username}`, label: "صفحتي", icon: "user" as IconName, color: "#6366f1", match: starts(`/mahdi/u/${username}`) }] : []),
      ],
    },
    {
      title: "أنا",
      items: [
        { href: "/mahdi/inbox", label: t.inbox.title, icon: "bell", color: "#f43f5e", match: starts("/mahdi/inbox") },
        { href: "/mahdi/more", label: t.nav.account, icon: "settings", color: "#64748b", match: (p) => p === "/mahdi/more" },
        { href: "/mahdi/more#look", label: "المظهر والثيمات", icon: "sparkle", color: "#a855f7", match: () => false },
        { href: "/mahdi/more/rewards", label: t.rewards.title, icon: "star", color: "#f59e0b", match: starts("/mahdi/more/rewards") },
        { href: "/mahdi/more/family", label: t.family.link, icon: "users", color: "#22c55e", match: starts("/mahdi/more/family") },
        { href: "/mahdi/more/privacy", label: t.privacy.title, icon: "lock", color: "#0ea5e9", match: starts("/mahdi/more/privacy") },
        { href: "/mahdi/more/notifications", label: "التذكير والتنبيهات", icon: "timer", color: "#8b5cf6", match: starts("/mahdi/more/notifications") },
      ],
    },
  ];
}

/** The phone's bottom bar: four places around the «+». */
export const BOTTOM: readonly [NavItem, NavItem, NavItem, NavItem] = [HOME, HABITS, READING, COMMUNITY];
