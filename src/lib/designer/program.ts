// «المصمم الذكي» — a design's PROGRAM kept with it: the scene program «حيدرا ماكس» drew the design from (with its fonts,
// its frame and the photos it placed, in order), stored in the artwork's record (designer_files.meta.program, next to
// the brief in meta.prompt). A change to that design (a word, a typo, a colour, a place) is then answered as EDITS on
// this program instead of a new program written from zero. Pure: the page and the tests read it too.

import { pictureSize } from "@/lib/claude-code/picture-rubric";

/** The longest program kept (the same bound as the picture's program on the server). */
export const PROGRAM_MAX = 140_000;

export interface DesignProgram {
  code: string;
  fonts: { head: string; body: string };
  /** the frame it draws, in pixels */
  size: [number, number];
  /** what it placed as photo1…photoN, in order: the painted picture (a designer_files id), then the person's photos */
  photos: string[];
}

/** What the page sends to change a design: the program to edit, and what it needs to tell the change. */
export interface DesignEdit {
  code: string;
  fonts: { head: string; body: string };
  /** the brief the program was drawn from */
  brief: string;
  /** the person's words asking for the change */
  said: string;
  /** the photos to place are not the ones the program placed */
  photosChanged: boolean;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** A program from storage or from the page, checked; null when it can't be used. `size`, when given, must match. */
export function readProgram(raw: unknown, size?: [number, number]): DesignProgram | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const code = typeof p.code === "string" ? p.code.trim() : "";
  if (!code || code.length > PROGRAM_MAX) return null;
  const f = (p.fonts ?? {}) as Record<string, unknown>;
  const head = str(f.head, 60), body = str(f.body, 60);
  if (!head || !body) return null;
  const s = Array.isArray(p.size) ? p.size.map(Number) : [];
  if (s.length !== 2 || !s.every((n) => Number.isInteger(n) && n > 0 && n <= 8000)) return null;
  if (size && (s[0] !== size[0] || s[1] !== size[1])) return null;
  const photos = (Array.isArray(p.photos) ? p.photos : []).filter((x): x is string => typeof x === "string" && x.length > 0 && x.length < 80).slice(0, 20);
  return { code, fonts: { head, body }, size: [s[0], s[1]], photos };
}

/** What the design places as photo1…photoN, in order: the painted picture, then the person's photos to place. */
export function photoKeys(p: { art?: string | null; refs: string[]; place?: string[] }): string[] {
  const place = new Set(p.place ?? []);
  return [...(p.art ? [p.art] : []), ...p.refs.filter((id) => place.has(id))].slice(0, 20);
}

/**
 * The edit to offer for a design that changes a design drawn before: its stored program, when it draws the same frame
 * as the new design's aspect; null otherwise (the new design is drawn from zero).
 */
export function editOf(o: { program: unknown; aspect: string; brief: string; said: string; photos: string[] }): DesignEdit | null {
  const prog = readProgram(o.program, pictureSize(o.aspect));
  if (!prog) return null;
  const photosChanged = prog.photos.length !== o.photos.length || prog.photos.some((k, i) => k !== o.photos[i]);
  return { code: prog.code, fonts: prog.fonts, brief: o.brief.slice(0, 16000), said: o.said.slice(0, 4000), photosChanged };
}
