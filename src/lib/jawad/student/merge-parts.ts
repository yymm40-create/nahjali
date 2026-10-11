// «الطالب الذكي» · «ادمج النواتج في PDF واحد» — which outputs go into the combined file. Pure (the page uses it to know
// when to offer the button; the server uses it to build the file: merge.ts).

import type { Output } from "./db";

/** The most files and bytes one combined PDF takes (a serverless function holds them all in memory). */
export const MERGE_MAX_FILES = 30;
export const MERGE_MAX_BYTES = 80 * 1024 * 1024;

const FINISHED = new Set(["done", "review"]);

export interface MergePart {
  id: string;
  title: string;
  kind: string;
  file: "pictures_pdf" | "pdf";
  path: string;
}

export type MergeItem = Pick<Output, "id" | "title" | "kind" | "ord" | "status" | "files">;

/**
 * Which outputs go into the combined file and which are left out (a recording, a conversation, a mind map drawn as
 * a picture, anything unfinished or without a PDF). `ids` limits it to the outputs the student ticked.
 */
export function mergeParts(list: MergeItem[], ids?: string[]): { parts: MergePart[]; skipped: string[] } {
  const want = ids?.length ? new Set(ids) : null;
  const parts: MergePart[] = [];
  const skipped: string[] = [];
  for (const o of [...list].sort((a, b) => a.ord - b.ord)) {
    if (o.kind === "chat" || (want && !want.has(o.id))) continue;
    const file = o.files.pictures_pdf ? "pictures_pdf" : o.files.pdf ? "pdf" : null;
    if (!file || !FINISHED.has(o.status)) {
      skipped.push(o.title);
      continue;
    }
    parts.push({ id: o.id, title: o.title, kind: o.kind, file, path: o.files[file] });
  }
  return { parts, skipped };
}

