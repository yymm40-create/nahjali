// «الجواد الذكي!» | JAWAD AI — the sections bar. Built-in sections live here; the owner can rename, reorder, hide or
// add sections from /jawad-ai/admin (stored in jawad_sections). A section only appears once it is linked to one of
// the IMPLEMENTATIONS below: adding a row never creates a working section by itself.

import type { OutputKind } from "./types";

export const SECTION_IMPLEMENTATIONS = {
  "studio:image": { label: "استوديو الصور (مولدات الصور)", output: "image" as OutputKind },
  "studio:video": { label: "استوديو الفيديو (مولدات الفيديو)", output: "video" as OutputKind },
  "studio:audio": { label: "استوديو الصوت (مولدات الصوت)", output: "audio" as OutputKind },
  film: { label: "صناعة الفيلم بالخطوات (المسار القائم)", output: null },
  student: { label: "الطالب الذكي (مواد دراسية إلى ملخصات وكتب وعروض وصوت واختبارات)", output: null },
  editor: { label: "حيدرة كت (مونتاج الفيديو: قص وترتيب ونصوص وتصدير)", output: null },
  islamic: { label: "الذكاء الإسلامي (أسئلة تُجاب من مكتبة المصادر التي يغذّيها المالك)", output: null },
  games: { label: "صانع الألعاب الذكي (محادثة مع «قنبر» لتصميم الألعاب)", output: null },
  content: { label: "صانع المحتوى (محادثة مع «محمد باقر»: كاروسيل وريلز وموشن)", output: null },
  designer: { label: "المصمم الذكي (محادثة مع «كاظم»: بطاقات وبوسترات ومصغّرات بطبقات نصية)", output: null },
  photo: { label: "زهراء فوتو ماستر (برنامج تحرير الصور والتصميم المستقل مع الروبوت «زهراء»)", output: null },
} as const;
export type SectionImplementation = keyof typeof SECTION_IMPLEMENTATIONS;
export const isImplementation = (s: string): s is SectionImplementation => s in SECTION_IMPLEMENTATIONS;

/** Icons the owner can pick for a section (drawn by src/components/jawad/Icon.tsx). */
export const SECTION_ICONS = ["image", "video", "film", "audio", "book", "sparkles", "wand", "layers", "camera", "mic", "music", "palette", "user", "scissors"] as const;
export type SectionIcon = (typeof SECTION_ICONS)[number];

export interface SectionDef {
  id: string;
  name: string;
  icon: string;
  implementation: SectionImplementation;
  sort: number;
  enabled: boolean;
}

export const DEFAULT_SECTIONS: SectionDef[] = [
  { id: "images", name: "صناعة الصور", icon: "image", implementation: "studio:image", sort: 10, enabled: true },
  { id: "video", name: "صناعة الفيديو", icon: "video", implementation: "studio:video", sort: 20, enabled: true },
  { id: "film", name: "الفيلم السينمائي", icon: "film", implementation: "film", sort: 30, enabled: true },
  { id: "editor", name: "حيدرة كت", icon: "scissors", implementation: "editor", sort: 35, enabled: true },
  { id: "audio", name: "صناعة الصوت", icon: "audio", implementation: "studio:audio", sort: 40, enabled: true },
  { id: "student", name: "الطالب الذكي", icon: "book", implementation: "student", sort: 50, enabled: true },
  // in its private trial: the page itself opens for the owner only (src/app/jawad-ai/islamic)
  { id: "islamic", name: "الذكاء الإسلامي", icon: "sparkles", implementation: "islamic", sort: 60, enabled: false },
  // private: the page opens for the owner, and for whoever holds the «games» permission once the owner turns it on
  { id: "games", name: "صانع الألعاب الذكي", icon: "wand", implementation: "games", sort: 70, enabled: false },
  // private: the page opens for the owner and for whoever holds the «content» permission (the owner's switch in /admin/content)
  { id: "content", name: "صانع المحتوى", icon: "layers", implementation: "content", sort: 80, enabled: false },
  // private: the page opens for the owner and for whoever holds the «designer» permission (the owner's switch in /admin/designer)
  { id: "designer", name: "المصمم الذكي", icon: "palette", implementation: "designer", sort: 90, enabled: false },
  // private: the page opens for the owner and for whoever holds the «photo» permission (the owner's switch in /admin/photo)
  { id: "photo", name: "زهراء فوتو ماستر", icon: "camera", implementation: "photo", sort: 95, enabled: false },
];

/** Paths under /jawad-ai that a section id may not take. */
export const RESERVED_SECTION_IDS = ["admin", "login", "username", "coins", "api", "works", "film", "student", "editor", "islamic", "games", "content", "designer", "photo"];

/** Implementations with their own fixed pages (one section each, not added again by the owner). */
export const FIXED_IMPLEMENTATIONS: string[] = ["film", "student", "editor", "islamic", "games", "content", "designer", "photo"];

/** Where a section opens. The film maker, «الطالب الذكي» and «حيدرة كت» keep their own pages; studio sections open at /jawad-ai/<id>. */
export const sectionPath = (s: { id: string; implementation: string }) =>
  FIXED_IMPLEMENTATIONS.includes(s.implementation) ? `/jawad-ai/${s.implementation}` : `/jawad-ai/${s.id}`;
