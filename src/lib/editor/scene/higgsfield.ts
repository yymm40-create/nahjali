// «مختبر الموشن» + the owner's two Higgsfield skills (config/editor/skills/higgsfield-motion and higgsfield-motion-saas),
// installed the way a skill is used: each SKILL.md is given WORD FOR WORD in the lab's system prompt, and every other
// file of each skill (references, the Russian handbook split at its headings, templates, reference films, scripts) is
// listed in a catalogue that حيدرة opens ON DEMAND — the skills' own rule ("never read the handbook whole, open only the
// part you need"). The client-taste files, which both skills say to read before designing, are always open at the plan.
// The skills' own code runs in the scene page: K.HFT (hf-tokens.js) and K.HF (hf-motion.js). Server only (large).

import { HF_REFS, HF_SKILLS, type HfRef } from "@/lib/editor/higgsfield-skills-text";

const BY_ID = new Map(HF_REFS.map((r) => [r.id, r]));
/** What one call may open from the skills (characters): enough for several sections, never the whole handbook. */
export const OPEN_BUDGET = 160_000;
/** Opened at every plan: both skills say to read the client's taste before designing. */
export const ALWAYS_AT_PLAN = ["higgsfield-motion/references/client-taste.md", "higgsfield-motion-saas/references/client-taste.md"];

const catalogue = () => HF_REFS.map((r) => `${r.id} — ${r.title} (${Math.max(1, Math.round(r.text.length / 1000))}k)`).join("\n");

/** The part of the lab's system prompt that installs the two skills. */
export const HF_LAB_TEXT = `THE OWNER'S HIGGSFIELD SKILLS — two skills he installed for this lab, each SKILL.md word for word between <skill> tags. Use them as written: their workflow, their non-negotiables, their motion grammar (the cut hides in peak speed, the direction survives the cut, overlap at 0.45 on a parent, nothing appears or leaves by opacity alone, nothing pops, no dead air, an active motivated camera, a visible trigger for every transition, tokens only, legibility and contrast numbers, the end card), their taste files and their QA. Where they and the older method above differ, these two (the owner's newest) lead for craft; the lab's contract (the machine below) stays as it is.
HOW THEY MAP TO THIS LAB (their files were written for a Mac with a terminal; the lab is that machine):
- Their page's pure __seek(t) / FILM scene is your scene's draw(K, t, ctx): the same rule — a pure function of t, seeded, no clocks.
- Their capture.mjs / render_film.sh / sub-frame motion blur / Swift encode / mux / probe are the lab's own renderer (blur = the scene's shutter); their stills and contact sheets are the sheets and stills you receive at review. Their fdiff / activity / textcheck checks are your review's job, by eye, on those frames.
- Their tokens and motion helpers RUN here: K.HFT is hf-tokens.js (HFT.theme, derive, validate, du, ms2f, beatGrid, timeline, readTime …) and K.HF is hf-motion.js (call K.HF.use(<style or theme>) in setup, then K.HF.p / tw / kf / E …). Mentioning K.HFT or K.HF in the program loads them. Fonts still come only from K.fonts (the lab's catalogue): HFT.fontLink / Google Fonts are not reachable from the scene page, so take sizes, colours, easings and timings from the theme and the type from K.fonts.
- Not here: After Effects (ExtendScript), Figma MCP, the Higgsfield generation MCP (Soul / Nano Banana / Seedance), music_window / cut_audio on a supplied track, Python sound synthesis. Sound is the lab's cues (the editor's SFX library) and its music bed; a generated picture or clip only through the editor when the person asks.
- Arabic over the skills' Latin/Cyrillic notes: whole words or lines, never letter by letter; mirror left→right moves; right-align or centre.
OPENING THEIR FILES: the catalogue below lists every other file of both skills by id (a big handbook file is split at its headings: path#n). At the PLAN you return "skillRefs": the ids you need open while writing and reviewing this piece (the sections the SKILL.md tells you to open for this job — transitions, techniques, ease math, code engine, the handbook part for the genre, a reference film …), at most 12 and about ${OPEN_BUDGET / 1000}k characters together. They are then given to you word for word.
${HF_SKILLS.map((s) => `<skill name="${s.name}">\n${s.text}\n</skill>`).join("\n\n")}
<skill-catalogue>
${catalogue()}
</skill-catalogue>`;

/** The ids worth keeping from a plan's "skillRefs" (known, unique, in order, at most 12). */
export function knownRefs(ids: unknown): string[] {
  const out: string[] = [];
  for (const v of Array.isArray(ids) ? ids : []) {
    const id = String(v ?? "").trim();
    if (BY_ID.has(id) && !out.includes(id)) out.push(id);
    if (out.length >= 12) break;
  }
  return out;
}

/** The files opened word for word, inside the budget (what does not fit is named so حيدرة knows it was not given). */
export function openRefs(ids: string[], budget = OPEN_BUDGET): { text: string; opened: string[]; skipped: string[] } {
  const opened: string[] = [];
  const skipped: string[] = [];
  const blocks: string[] = [];
  let used = 0;
  for (const id of ids) {
    const r: HfRef | undefined = BY_ID.get(id);
    if (!r) continue;
    if (used + r.text.length > budget) {
      skipped.push(id);
      continue;
    }
    used += r.text.length;
    opened.push(id);
    blocks.push(`<skill-file id="${r.id}">\n${r.text}\n</skill-file>`);
  }
  const note = skipped.length ? `\n(Not opened — over this call's budget: ${skipped.join(", ")}. Ask for fewer or smaller sections next time.)` : "";
  return { text: blocks.length ? `THE SKILL FILES YOU OPENED (word for word):\n${blocks.join("\n\n")}${note}` : "", opened, skipped };
}
