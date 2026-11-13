// JAWAD AI — «ترتيب أعمالي»: search, sort, folders and favourites of the studio's works. Pure and shared: the page
// filters what it already has with these rules while the server answers with the same ones
// (src/lib/jawad/server/works-organise.ts holds the database side).

import { isOpenStatus, type WorkItem } from "./labels";

export type WorksSort = "new" | "old";

/** How «أعمالي» is looked at, beside the kind filter (الكل/الصور/الفيديو/الصوت). */
export interface WorksView {
  /** words looked for in the prompt and the generator's name (a film work: its project's name) */
  q: string;
  sort: WorksSort;
  /** one folder's works (its id), or every work */
  folder: string | null;
  /** only the ⭐ works */
  fav: boolean;
}

export const DEFAULT_VIEW: WorksView = { q: "", sort: "new", folder: null, fav: false };
export const SEARCH_MAX = 100;
export const FOLDER_NAME_MAX = 40;
export const MAX_FOLDERS = 50;

export interface WorkFolder {
  id: string;
  name: string;
  /** how many works sit in it */
  count: number;
}

/** What the person set on one work. */
export interface WorkMark {
  folderId: string | null;
  favourite: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Arabic and Latin text made comparable: no diacritics or tatweel, one alef, ه for ة, ي for ى, lower case, single spaces —
 * so «مدرسة» finds «المدرسه» and «Kling» finds «kling».
 */
export function normaliseSearch(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** The words of a search (at most 100 characters). */
export const searchTerms = (q: string) => normaliseSearch(q.slice(0, SEARCH_MAX)).split(" ").filter(Boolean);

/** Whether a work answers the search: every word is in its prompt, its generator's name or id (a film work: its project). */
export function matchesWorkSearch(it: WorkItem, q: string): boolean {
  const terms = searchTerms(q);
  if (!terms.length) return true;
  const hay = normaliseSearch(it.type === "job" ? `${it.prompt} ${it.generatorName} ${it.generatorId}` : `${it.projectTitle} ${it.refKey} الفيلم السينمائي`);
  return terms.every((t) => hay.includes(t));
}

/** A job this page has just started (or is still making): shown whatever the view, so a new generation never seems lost. */
export const isFresh = (it: WorkItem) => it.type === "job" && (it.id.startsWith("temp-") || isOpenStatus(it.status));

/** Whether a work belongs in the view. Folders and ⭐ only count once their table exists (`organised`). */
export function matchesView(it: WorkItem, v: WorksView, organised: boolean): boolean {
  if (!matchesWorkSearch(it, v.q)) return false;
  if (!organised) return true;
  if (v.fav && !it.favourite) return false;
  if (v.folder && it.folderId !== v.folder) return false;
  return true;
}

/** The works in the order asked for (by when they were made). */
export function sortWorks<T extends { createdAt: string }>(items: T[], sort: WorksSort): T[] {
  const sign = sort === "old" ? 1 : -1;
  return [...items].sort((a, b) => (a.createdAt < b.createdAt ? -sign : a.createdAt > b.createdAt ? sign : 0));
}

/** The view as query words for /api/jawad/works (only what differs from the default). */
export function worksQuery(v: WorksView): string {
  const p = new URLSearchParams();
  const q = v.q.trim().slice(0, SEARCH_MAX);
  if (q) p.set("q", q);
  if (v.sort === "old") p.set("sort", "old");
  if (v.folder) p.set("folder", v.folder);
  if (v.fav) p.set("fav", "1");
  const s = p.toString();
  return s ? `&${s}` : "";
}

/** The view read back from the address (anything unknown falls back to the default). */
export function parseWorksView(p: URLSearchParams): WorksView {
  const folder = p.get("folder");
  return {
    q: (p.get("q") ?? "").trim().slice(0, SEARCH_MAX),
    sort: p.get("sort") === "old" ? "old" : "new",
    folder: folder && UUID.test(folder) ? folder.toLowerCase() : null,
    fav: p.get("fav") === "1",
  };
}

/** A folder's name as kept (single spaces, no control characters), or null when it is empty or too long. */
export function cleanFolderName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return s && [...s].length <= FOLDER_NAME_MAX ? s : null;
}

/** Whether two folder names are the same name (the person can't make two of one name). */
export const sameFolderName = (a: string, b: string) => normaliseSearch(a) === normaliseSearch(b);

/**
 * Who may set a work's folder or ⭐: only the person whose work it is, and only into a folder of their own.
 * `item` / `folder`: what the database found (null: nothing by that id). `folderId`: the folder asked for (null: out of
 * every folder; undefined: the folder isn't being changed). Returns why not, or null.
 */
export function markProblem(a: { userId: string; item: { ownerId: string | null } | null; folderId?: string | null; folder?: { ownerId: string } | null }): string | null {
  if (!a.item || !a.item.ownerId || a.item.ownerId !== a.userId) return "ما لقينا هذا العمل في أعمالك.";
  if (typeof a.folderId === "string" && (!a.folder || a.folder.ownerId !== a.userId)) return "ما لقينا هذا المجلد.";
  return null;
}

/** Who may rename or delete a folder: its owner only. */
export function folderProblem(userId: string, folder: { ownerId: string } | null): string | null {
  return folder && folder.ownerId === userId ? null : "ما لقينا هذا المجلد.";
}

/**
 * Whether a folder may take this name: not empty or too long, no other folder of the same name, and (a new folder) under
 * the limit. `renaming`: the id of the folder being renamed (its own name doesn't count against it).
 */
export function folderNameProblem(name: string | null, existing: { id: string; name: string }[], renaming?: string): string | null {
  if (!name) return `اسم المجلد: من حرف إلى ${FOLDER_NAME_MAX} حرفًا.`;
  if (existing.some((f) => f.id !== renaming && sameFolderName(f.name, name))) return `عندك مجلد اسمه «${name}».`;
  if (!renaming && existing.length >= MAX_FOLDERS) return `وصلت حد المجلدات (${MAX_FOLDERS}). احذف واحد أو انقل أعمالك لمجلد ثاني.`;
  return null;
}
