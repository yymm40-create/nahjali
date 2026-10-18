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


/** The outputs that make a PDF (a recording, a conversation and a mind map do not), so "all in one PDF" has meaning for them. */
export const PDF_KINDS = ["summary", "explain", "preread", "transcript", "book", "slides", "quiz", "brochure"] as const;
export const pdfKinds = (kinds: readonly string[]) => kinds.filter((k) => (PDF_KINDS as readonly string[]).includes(k));
/** "In one PDF" is offered from two outputs that can make one. */
export const canTogether = (kinds: readonly string[]) => pdfKinds(kinds).length >= 2;

/** The mark a batch of outputs made "in one PDF" carries in its settings (the page watches for the batch to finish). */
export const TOGETHER_KEY = "_together";

type Tagged = Pick<MergeItem, "id" | "kind" | "status"> & { settings: Record<string, unknown> };

/**
 * A batch made "in one PDF" whose outputs have all finished and not yet been put together: its id and outputs, or null.
 * `done` holds the batches already put together (kept on the device by the page).
 */
export function togetherReady(list: Tagged[], done: ReadonlySet<string> = new Set()): { batch: string; ids: string[] } | null {
  const batches = new Map<string, Tagged[]>();
  for (const o of list) {
    const b = String(o.settings?.[TOGETHER_KEY] ?? "");
    if (b) batches.set(b, [...(batches.get(b) ?? []), o]);
  }
  for (const [batch, members] of batches) {
    if (done.has(batch) || members.length < 2) continue;
    if (members.every((m) => FINISHED.has(m.status))) return { batch, ids: members.map((m) => m.id) };
  }
  return null;
}
