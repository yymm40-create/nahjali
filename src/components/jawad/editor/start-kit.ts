// What a new project starts with, from the launcher's «مشروع جديد»: files from the device (kept in memory while the
// page moves to the editor; they can't travel in the address) or works of the person's already brought into it.

import type { Timeline } from "@/lib/editor/model";
import type { EditorAsset } from "./types";

export type StartKit = {
  projectId: string;
  files: File[];
  assets: EditorAsset[];
  /** «افتح مشروع محفوظ»: a saved project's timeline and its files (each with the id the timeline knows it by) */
  pkg?: { timeline: Timeline; media: { oldId: string; file: File }[] };
};

let kit: StartKit | null = null;

export const leaveStartKit = (k: StartKit) => {
  kit = k;
};

/** The kit for this project, once (a reload or another project gets nothing). */
export const takeStartKit = (projectId: string) => {
  if (kit?.projectId !== projectId) return null;
  const k = kit;
  kit = null;
  return k;
};
