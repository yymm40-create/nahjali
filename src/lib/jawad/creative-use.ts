// «جرّبه في الاستوديو»: a prompt from «طرق إبداعية» handed to the Creative Studio with the generator, settings and
// style it was made with. The page keeps it in localStorage (prompts are too long for a link) and opens the studio with
// ?use=1; the studio takes it once, clears the old references and names the new ones as the prompt expects.
// Browser only.

import type { PromptUse } from "@config/jawad/creative";

const KEY = "jawad:creative-use:v1";
/** a hand-off older than this is stale (the person came back to the studio another day) */
const MAX_AGE_MS = 30 * 60 * 1000;

export type CreativeUse = PromptUse & {
  prompt: string;
  /** the prompt's name on the method page, e.g. «شيت الشخصية» */
  label: string;
  /** the references the prompt mentions, in order: their «@name» and what each one is */
  refs: { name: string; what: string }[];
  at: number;
};

export function putCreativeUse(u: Omit<CreativeUse, "at">): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...u, at: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

/** The waiting hand-off, removed as it is read (a reload doesn't apply it twice). */
export function takeCreativeUse(): CreativeUse | null {
  try {
    const raw = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    if (!raw) return null;
    const u = JSON.parse(raw) as CreativeUse;
    if (typeof u.prompt !== "string" || typeof u.generatorId !== "string" || !(Date.now() - u.at < MAX_AGE_MS)) return null;
    return { ...u, refs: Array.isArray(u.refs) ? u.refs : [] };
  } catch {
    return null;
  }
}

/** «@img1» / «@image2» / «@aud1» → the reference kind it stands for. */
export function refKindOfTag(tag: string): "image" | "video" | "audio" | null {
  const t = tag.replace(/^@/, "").toLowerCase();
  if (/^(img|image)\d*$/.test(t)) return "image";
  if (/^(vid|video)\d*$/.test(t)) return "video";
  if (/^(aud|audio)\d*$/.test(t)) return "audio";
  return null;
}
