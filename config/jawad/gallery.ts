// «معرض الناس» (/jawad-ai/gallery) and the permanent share link of one work (/jawad-ai/w/<slug>): what a person's
// finished picture or video carries into the gallery, the owner's review, and «جرّبه» — the studio opened with the same
// kind, generator (or an available one of the same kind), shape, style and prompt. Never the work's references: other
// people's photos are never copied, only the names the prompt mentions («@img1») so the visitor's own pictures take them.
// Pure (the pages, the server routes, the studio and the tests share it).

import { generatorById } from "@config/jawad/generators";
import { fitSettings } from "@config/jawad/ready-apps";
import { findStyle } from "@config/film-styles";
import type { RefKind, RefStyle, Settings } from "@config/jawad/types";

export const GALLERY_BASE = "/jawad-ai/gallery";
export const SHARE_BASE = "/jawad-ai/w";
/** the studio a «جرّبه» opens (the unified studio: it switches to the work's kind by itself) */
export const STUDIO_PATH = "/jawad-ai/images";

/** Only pictures and videos go to the gallery or get a share link (a sound may carry a person's own cloned voice). */
export type GalleryKind = "image" | "video";
export const isGalleryKind = (k: unknown): k is GalleryKind => k === "image" || k === "video";

/**
 * none: not in the gallery (a share link only) · pending: waiting for the owner · approved: in the gallery ·
 * rejected: the owner said no (the person may send it again) · hidden: the owner took it down — gallery AND share link.
 */
export type GalleryStatus = "none" | "pending" | "approved" | "rejected" | "hidden";
export const GALLERY_STATUSES: GalleryStatus[] = ["none", "pending", "approved", "rejected", "hidden"];
export const STATUS_LABEL: Record<GalleryStatus, string> = {
  none: "غير منشور",
  pending: "ينتظر موافقة الإدارة",
  approved: "منشور في المعرض",
  rejected: "ما انقبل",
  hidden: "أخفته الإدارة",
};

export const TITLE_MAX = 80;
export const PAGE_SIZE = 24;

/** A short title as typed: no control characters, single spaces, at most TITLE_MAX characters. */
export function cleanTitle(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return [...raw.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, " ").replace(/\s+/g, " ").trim()].slice(0, TITLE_MAX).join("").trim();
}

/** What «جرّبه» needs, as the gallery stores it with the work (no reference file, no upload id, no link). */
export interface GalleryUse {
  id: string;
  kind: GalleryKind;
  title: string;
  prompt: string;
  generatorId: string;
  settings: Settings;
  styleId: string;
  refStyle: RefStyle;
  /** the names the prompt gives its references, with their kind — the visitor's own files take them */
  refNames: { name: string; kind: RefKind }[];
}

/** One work as everyone sees it. */
export interface GalleryCard extends GalleryUse {
  generatorName: string;
  featured: boolean;
  width: number | null;
  height: number | null;
  /** the stable address of its picture or video (the server signs a fresh link on each request) */
  mediaUrl: string;
  at: string;
}

export const mediaUrlOf = (id: string) => `/api/jawad/gallery/${id}/media`;
export const shareUrlOf = (slug: string) => `${SHARE_BASE}/${slug}`;
/** «جرّبه»: the studio opened on this work (it reads it from the server, so it works after signing in or on another device). */
export const tryHref = (id: string) => `${STUDIO_PATH}?gallery=${encodeURIComponent(id)}`;
/** Signed out: sign in first, then land in the filled studio. */
export const tryLoginHref = (id: string) => `/jawad-ai/login?next=${encodeURIComponent(tryHref(id))}`;

/** A new share link's name: 12 letters and digits (about 71 bits), unguessable. */
export function newShareSlug(): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => abc[b % abc.length]).join("");
}
export const isShareSlug = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9]{8,32}$/.test(s);

/**
 * The gallery's copy of a job, taken when its owner publishes or shares it: the prompt, generator, settings this
 * generator has (a voice from someone's library is never carried), the style and the reference style — and only the
 * names and kinds of the references.
 */
export function galleryFromJob(job: { generator_id: string; prompt: string; inputs: unknown; refs: unknown }): Omit<GalleryUse, "id" | "kind" | "title"> {
  const inputs = (job.inputs && typeof job.inputs === "object" ? job.inputs : {}) as { settings?: unknown; styleId?: unknown; refStyle?: unknown };
  const def = generatorById(job.generator_id);
  const raw = inputs.settings && typeof inputs.settings === "object" ? (inputs.settings as Record<string, unknown>) : {};
  const settings: Settings = {};
  for (const o of def?.options ?? []) {
    const v = raw[o.key];
    // a voice is never carried (it may be one the person designed or copied)
    if (o.key === "voice" || (o.kind === "choice" && o.picker === "voice") || (typeof v === "string" && v.startsWith("v:"))) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") settings[o.key] = v;
  }
  const styleId = typeof inputs.styleId === "string" && findStyle(inputs.styleId) ? inputs.styleId : "";
  const refStyle: RefStyle = inputs.refStyle === "frames" || inputs.refStyle === "references" ? inputs.refStyle : "none";
  const refNames = (Array.isArray(job.refs) ? job.refs : []).flatMap((r) => {
    const x = r as { name?: unknown; kind?: unknown };
    const kind: RefKind | null = x.kind === "image" || x.kind === "video" || x.kind === "audio" ? x.kind : null;
    const name = typeof x.name === "string" ? x.name.replace(/^@/, "").slice(0, 24) : "";
    return kind && /^[\p{L}\p{N}_-]{1,24}$/u.test(name) ? [{ name, kind }] : [];
  });
  return { prompt: String(job.prompt ?? ""), generatorId: job.generator_id, settings, styleId, refStyle, refNames: refNames.slice(0, 12) };
}

/**
 * The generator a «جرّبه» opens: the work's own when this account has it, else an available one of the same kind — one
 * that takes the work's way of using references first, and never an editor that needs a video of the person's to start.
 */
export function pickTryGenerator(generatorId: string, kind: GalleryKind, available: { id: string }[], refStyle: RefStyle = "none"): { id: string | null; fellBack: boolean } {
  if (available.some((g) => g.id === generatorId) && generatorById(generatorId)?.output === kind) return { id: generatorId, fellBack: false };
  const rank = (id: string) => {
    const modes = generatorById(id)?.modes ?? [];
    // an editor works only from the person's own clip («references» alone): last
    const creator = modes.some((m) => m.refStyle !== "references");
    return creator && modes.some((m) => m.refStyle === refStyle) ? 0 : creator ? 1 : 2;
  };
  const other = available
    .filter((g) => generatorById(g.id)?.output === kind)
    .map((g, i) => ({ id: g.id, r: rank(g.id) * 1000 + i }))
    .sort((a, b) => a.r - b.r)[0];
  return { id: other?.id ?? null, fellBack: Boolean(other) };
}

/** The studio form a «جرّبه» fills. `refs` is always empty: the visitor adds their own. */
export interface TryDraft {
  generatorId: string;
  fellBack: boolean;
  prompt: string;
  settings: Settings;
  styleId: string;
  refStyle: RefStyle;
  refs: [];
  wantNames: { name: string; kind: RefKind }[];
}

export function buildTryDraft(use: Pick<GalleryUse, "kind" | "generatorId" | "prompt" | "settings" | "styleId" | "refStyle" | "refNames">, available: { id: string }[]): TryDraft | null {
  const pick = pickTryGenerator(use.generatorId, use.kind, available, use.refStyle);
  const def = pick.id ? generatorById(pick.id) : undefined;
  if (!pick.id || !def) return null;
  // the shape and the other settings the chosen generator has (the nearest shape when it lacks the exact one)
  const settings = fitSettings(def, use.settings);
  const supports = (s: RefStyle) => def.modes.some((m) => m.refStyle === s);
  const refStyle: RefStyle = supports(use.refStyle) ? use.refStyle : ((def.modes.map((m) => m.refStyle).find((s) => s !== "none") ?? "none") as RefStyle);
  const styleId = use.styleId && findStyle(use.styleId) ? use.styleId : "";
  // a prompt longer than the chosen generator takes is cut there (the person sees it and can shorten it)
  const max = def.prompt.max;
  const prompt = max && use.prompt.length > max ? use.prompt.slice(0, max) : use.prompt;
  const wantNames = use.refNames.filter((r, i, all) => all.findIndex((x) => x.name.toLowerCase() === r.name.toLowerCase()) === i).map((r) => ({ name: r.name, kind: r.kind }));
  return { generatorId: def.id, fellBack: pick.fellBack, prompt, settings, styleId, refStyle, refs: [], wantNames };
}

/** The shape of a work («16:9»), from its settings. */
export const shapeOf = (settings: Settings) => {
  const v = settings.aspect ?? settings.ratio;
  return typeof v === "string" && /^\d+:\d+$/.test(v) ? v : null;
};

/** What publishing (again) does to a work's status; null = not allowed (the owner hid it). */
export function publishStatus(existing: { status: GalleryStatus; title: string } | null, title: string): GalleryStatus | null {
  if (!existing) return "pending";
  if (existing.status === "hidden") return null;
  // already in the gallery under the same title: stays; a new title waits for the owner again
  if (existing.status === "approved" && existing.title === title) return "approved";
  return "pending";
}

export type ReviewAction = "approve" | "reject" | "hide" | "unhide" | "feature" | "unfeature";
export const REVIEW_ACTIONS: ReviewAction[] = ["approve", "reject", "hide", "unhide", "feature", "unfeature"];
export const isReviewAction = (a: unknown): a is ReviewAction => REVIEW_ACTIONS.includes(a as ReviewAction);

/**
 * The change the owner's button makes; null = not for a work in that state. Only a work its person sent («pending»,
 * or one already reviewed) can enter the gallery: a work that is only shared by link (none) never does.
 */
export function reviewPatch(action: ReviewAction, current: GalleryStatus, nowIso: string, by: string): Record<string, unknown> | null {
  const sent = current === "pending" || current === "approved" || current === "rejected";
  switch (action) {
    case "approve":
      return sent ? { status: "approved", reviewed_at: nowIso, reviewed_by: by } : null;
    case "reject":
      return current === "pending" || current === "approved" ? { status: "rejected", featured: false, reviewed_at: nowIso, reviewed_by: by } : null;
    case "hide":
      return current === "hidden" ? null : { status: "hidden", featured: false, share_on: false, reviewed_at: nowIso, reviewed_by: by };
    case "unhide":
      // back to private: its person may send it again or turn its link on again
      return current === "hidden" ? { status: "none", reviewed_at: nowIso, reviewed_by: by } : null;
    case "feature":
      // only a work in the gallery is featured (approving it first if it waited)
      return current === "approved" || current === "pending" ? { status: "approved", featured: true, reviewed_at: nowIso, reviewed_by: by } : null;
    case "unfeature":
      return { featured: false };
  }
}

/** The owner's rules for what goes in the gallery, shown above the review list. */
export const GALLERY_RULES = [
  "كل عمل ما ينشر إلا بعد موافقتك.",
  "لا صور واقعية لنساء بالغات أبدًا.",
  "لا شي بطابع خليجي أو ثوب وشماغ.",
  "لا وجه شخص حقيقي معروف ولا شي يخالف الذوق.",
];
