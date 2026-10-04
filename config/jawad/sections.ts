// «الجواد الذكي!» | JAWAD AI — the sections bar. Built-in sections live here; the owner can rename, reorder, hide or
// add sections from /jawad-ai/admin (stored in jawad_sections). A section only appears once it is linked to one of
// the IMPLEMENTATIONS below: adding a row never creates a working section by itself.

import type { OutputKind } from "./types";

export const SECTION_IMPLEMENTATIONS = {
  "studio:image": { label: "استوديو الصور (مولدات الصور)", output: "image" as OutputKind },
  "studio:video": { label: "استوديو الفيديو (مولدات الفيديو)", output: "video" as OutputKind },
  "studio:audio": { label: "استوديو الصوت (مولدات الصوت)", output: "audio" as OutputKind },
  film: { label: "صناعة الفيلم بالخطوات (المسار القائم)", output: null },
} as const;
export type SectionImplementation = keyof typeof SECTION_IMPLEMENTATIONS;
export const isImplementation = (s: string): s is SectionImplementation => s in SECTION_IMPLEMENTATIONS;

/** Icons the owner can pick for a section (drawn by src/components/jawad/Icon.tsx). */
export const SECTION_ICONS = ["image", "video", "film", "audio", "sparkles", "wand", "layers", "camera", "mic", "music", "palette", "user"] as const;
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
  { id: "audio", name: "صناعة الصوت", icon: "audio", implementation: "studio:audio", sort: 40, enabled: true },
];

/** Paths under /jawad-ai that a section id may not take. */
export const RESERVED_SECTION_IDS = ["admin", "login", "username", "coins", "api", "works", "film"];

/** Where a section opens. The film maker keeps its own pages; studio sections open at /jawad-ai/<id>. */
export const sectionPath = (s: Pick<SectionDef, "id" | "implementation">) => (s.implementation === "film" ? "/jawad-ai/film" : `/jawad-ai/${s.id}`);
