// «الطالب الذكي» — making «🧠 الخريطة الذهنية» on the server: صادق plans the maps (Claude, by the grade of who studies),
// the student reviews them as an outline, then each map is drawn by صادق (Chromium: a sharp PNG with exact Arabic text,
// free) with its blank recall copy, and — when the student chose it — redrawn by GPT Image 2 as an illustrated map, with
// صادق's picture as its reference (the structure and the words stay, the art is GPT Image 2's). Server only.

import { createHash } from "node:crypto";
import { defaultDesign, fontById, type Design } from "@config/jawad/student";
import { GPT_IMAGE_2_SIZES, gptImage2OutputTokens } from "@config/jawad/generators";
import { providerUserId } from "@/lib/jawad/server/providers/common";
import { openaiImage } from "@/lib/jawad/server/providers/openai";
import { askJson, claudeCeilingUsd } from "./claude";
import { allChars, allText, basedOn, researchText, scopeRules, understandingText, type Ctx } from "./context";
import { putFile, saveOutput, type Output } from "./db";
import type { StepResult } from "./jobs";
import { MAP_GRADES, MAP_ICON_IDS, MAP_TYPES, MAP_TYPE_IDS, clampMap, gradeOf, mapSettings, mapTypeName, mapWords, mapsWanted, type MindMap, type MindPlan } from "./mindmap";
import { mapHtml, pictureAspect, pictureScale } from "./render/mindmap";
import { colorsOf } from "./render/css";
import { fontFacesData, htmlToPngs } from "./render/server";
import { picturesPdf } from "./slide-images";

const MODEL = "gpt-image-2-2026-04-21";
/** OpenAI's gpt-image-2 prices (USD per 1M tokens): image out 30 · image in 8 · text in 5. */
const OUT = 30;
const REF_TOKENS = 7100;

/** USD ceiling of one map drawn by GPT Image 2: the dearest of its three shapes, the reference (صادق's map) and the prompt. */
export function mapImageUsd(quality: "high" | "medium") {
  const out = Math.max(...(["1:1", "3:2", "2:3"] as const).map((a) => gptImage2OutputTokens(...GPT_IMAGE_2_SIZES.hi[a], quality)));
  return (out * OUT + REF_TOKENS * 8 * 2 + 3000 * 5) / 1e6;
}

const content = (m: MindMap) => JSON.stringify([m.title, m.center, m.icon, m.type, m.branches, m.links]);
/** What صادق's picture depends on: when it changes, it is drawn again. */
export const mapSig = (m: MindMap, design: Design) => createHash("sha256").update(content(m) + JSON.stringify(design)).digest("hex").slice(0, 16);
/** What GPT Image 2's picture depends on. */
export const artSig = (m: MindMap, design: Design, quality: string, note = "") => createHash("sha256").update(content(m) + JSON.stringify(design) + quality + note).digest("hex").slice(0, 16);

const designOf = (o: Output): Design => (o.settings.design as Design) ?? defaultDesign("editorial");

// ───────────────────────────── estimates ─────────────────────────────

export function mapPlanUsd(c: Ctx, o: Output) {
  const n = mapsWanted(mapSettings(o.settings).scope, c.understanding.sections.length);
  return claudeCeilingUsd(Math.min(allChars(c) + (c.research ? 20_000 : 0), 400_000), 3000 + n * 2500);
}

/** The maps still to draw with GPT Image 2 (none when صادق draws them: that costs nothing). */
export function mapFinalUsd(o: Output, action: string) {
  const s = mapSettings(o.settings);
  if (s.render !== "image") return 0;
  const per = mapImageUsd(s.imageQuality);
  if (action === "revise") return per;
  const plan = o.plan as MindPlan | null;
  const d = designOf(o);
  return (plan?.maps ?? []).filter((m) => !m.picture?.path || m.picture.sig !== artSig(m, d, s.imageQuality)).length * per;
}

// ───────────────────────────── the plan ─────────────────────────────

const str = { type: "string" };
const MAP_SCHEMA = {
  type: "object",
  properties: {
    title: str,
    center: str,
    icon: { type: "string", enum: MAP_ICON_IDS },
    type: { type: "string", enum: [...MAP_TYPE_IDS] },
    branches: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: str,
          icon: { type: "string", enum: MAP_ICON_IDS },
          link: str,
          children: { type: "array", items: { type: "object", properties: { label: str, link: str, details: { type: "array", items: str } }, required: ["label", "link", "details"], additionalProperties: false } },
        },
        required: ["label", "icon", "link", "children"],
        additionalProperties: false,
      },
    },
    links: { type: "array", items: { type: "object", properties: { from: str, to: str, label: str }, required: ["from", "to", "label"], additionalProperties: false } },
  },
  required: ["title", "center", "icon", "type", "branches", "links"],
  additionalProperties: false,
};
const PLAN_SCHEMA = { type: "object", properties: { maps: { type: "array", items: MAP_SCHEMA } }, required: ["maps"], additionalProperties: false };

export async function mapPlanStep(o: Output, c: Ctx, base: string, studentFirst: string): Promise<StepResult> {
  const s = mapSettings(o.settings);
  const grade = gradeOf(c.project.level);
  const g = MAP_GRADES[grade];
  const parts = c.understanding.sections.slice(0, 8);
  const n = mapsWanted(s.scope, c.understanding.sections.length);
  const which =
    n > 1
      ? `Make EXACTLY ${n} maps: map 1 = the WHOLE material (its main branches are the material's parts); then one map for each of these parts, in order: ${parts.map((p, i) => `${i + 2}) «${p.title}»`).join(" · ")}.`
      : "Make EXACTLY 1 map of the whole material.";
  const shape =
    s.mapType === "auto"
      ? `Choose each map's type by its content: ${MAP_TYPES.map((t) => `"${t.id}" = ${t.en}`).join("; ")}. For this level the default is "${g.type}"; use "flow" for a process, steps or a history, "tree" for categories and types, "concept" when the relations between ideas are the point.`
      : `Every map's type is "${s.mapType}": ${MAP_TYPES.find((t) => t.id === s.mapType)!.en}.`;
  const r = await askJson<MindPlan>({
    system: `You design professional MIND MAPS of the student's material, in Arabic, by the researched laws: the topic in the centre (a short title of 1–4 words), main branches that together cover the WHOLE material in its own order, KEY WORDS not sentences (a branch is a noun phrase, never a full sentence), one idea per branch, parallel wording between sibling branches, the most important on the first branches, an icon for each branch from the list. Labels must be exact and taken from the material (its own terms, names, numbers, dates); nothing invented.
${which}
${shape}
GRADE (${g.name}) — follow it strictly: ${g.rule} Main branches: ${g.branches[0]} to ${g.branches[1]}.
"link": the short linking phrase written on the line INTO this node (2–3 words, e.g. «يتكون من», «يؤدي إلى», «مثل»): required on every node of a "concept" map, empty on the others. "links": cross-links between two nodes of the SAME map whose labels you copy exactly (from, to) with their phrase; only when the material really connects them; empty if none.
"title" names the map for the student (the part's name for a part's map).
${studentFirst}
${scopeRules(c)}`,
    parts: [{ type: "text", text: `${base}\n\nUNDERSTANDING:\n${understandingText(c)}\n\nMATERIAL:\n${allText(c)}\n${researchText(c)}` }],
    schema: PLAN_SCHEMA,
    maxTokens: Math.min(32000, 4000 + n * 3000),
  });
  const fallback = s.mapType === "auto" ? g.type : s.mapType;
  const maps = r.data.maps.slice(0, n).map((m) => clampMap(s.mapType === "auto" ? m : { ...m, type: s.mapType }, grade, fallback)).filter((m) => m.branches.length);
  if (!maps.length) throw new Error("the map came back empty");
  const plan: MindPlan = { maps };
  await saveOutput(o.id, { plan, plan_approved: false, status: "plan_review", content: null, files: {}, based_on: basedOn(c) }, { kind: "plan", snapshot: plan, userId: o.user_id });
  return { done: true, usd: r.usd, stage: n > 1 ? `${maps.length} خرائط جاهزة للمراجعة` : "الخريطة جاهزة للمراجعة" };
}

// ───────────────────────────── drawing ─────────────────────────────

async function pageOpts(o: Output, c: Ctx) {
  const d = designOf(o);
  const col = colorsOf(d, d.main);
  const grade = gradeOf(c.project.level);
  return {
    colors: { bg: col.bg, paper: col.paper, ink: col.ink, muted: col.muted, accent: col.accent, line: col.line },
    fonts: { heading: fontById(d.fonts.heading).family, body: fontById(d.fonts.body).family },
    fontFaces: await fontFacesData([d.fonts.heading, d.fonts.body]),
    young: grade === "primary",
    gradeName: MAP_GRADES[grade].name,
  };
}

const outPath = (o: Output, name: string) => `${o.user_id}/${o.project_id}/maps/${o.id}/${Date.now()}-${name}`;

/** صادق draws map i: its picture and its blank recall copy. */
async function renderMap(o: Output, c: Ctx, plan: MindPlan, i: number) {
  const m = plan.maps[i];
  const p = await pageOpts(o, c);
  const caption = `خريطة ذهنية · ${mapTypeName(m.type)} · ${p.gradeName}`;
  const full = mapHtml(m, { ...p, caption });
  const blank = mapHtml(m, { ...p, caption, blank: true });
  const [png, empty] = await htmlToPngs([
    { ...full, scale: pictureScale(full.w, full.h) },
    { ...blank, scale: pictureScale(blank.w, blank.h) },
  ]);
  const path = outPath(o, `map-${i + 1}.png`);
  const blankPath = outPath(o, `blank-${i + 1}.png`);
  await putFile(path, png, "image/png");
  await putFile(blankPath, empty, "image/png");
  return { path, blank: blankPath, sig: mapSig(m, designOf(o)) };
}

/** GPT Image 2 redraws map i as an illustrated map, from صادق's layout (without the details: fewer words, fewer mistakes). */
async function drawMap(o: Output, c: Ctx, plan: MindPlan, i: number, note = "") {
  const m = plan.maps[i];
  const s = mapSettings(o.settings);
  const p = await pageOpts(o, c);
  const lite = mapHtml(m, { ...p, details: false });
  const [ref] = await htmlToPngs([{ ...lite, scale: pictureScale(lite.w, lite.h, 2048, 6e6) }]);
  const aspect = pictureAspect(lite.w, lite.h);
  const words = mapWords(m, false);
  const prompt = [
    `Redraw the reference image as ONE finished, professional, hand-illustrated MIND MAP for studying (${mapTypeName(m.type)}; for a ${p.gradeName} student).`,
    `Keep EXACTLY the reference's structure: the same centre, the same main branches in the same places and colours, the same sub-branches under each, the same lines and cross-links.`,
    m.type === "radial" ? `Buzan style: a small illustration of the topic in the centre, organic curved branches thick at the centre and thin at the ends, one colour per main branch, a small drawn icon beside every main branch, each word sitting on its line.` : `Clean and structured, as in the reference (boxes, columns and arrows), with small drawn icons beside the main branches.`,
    `Language and direction: Arabic, right-to-left.`,
    `Background ${p.colors.bg}; text ${p.colors.ink}. Large, high-contrast lettering, generous margins, nothing cropped.`,
    `Write EXACTLY these Arabic words and no others — every letter correct and properly joined, no made-up or garbled letters, no extra captions or watermarks:`,
    ...words.map((w) => `«${w}»`),
    ...m.branches.flatMap((b) => [b.link, ...b.children.map((x) => x.link)]).filter(Boolean).length ? [`The small linking phrases on the lines: ${m.branches.flatMap((b) => [b.link, ...b.children.map((x) => x.link)]).filter(Boolean).map((w) => `«${w}»`).join(" ")}`] : [],
    note ? `The student's request for this map: ${note}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const res = await openaiImage({ model: MODEL, prompt, aspect, resolution: "hi", quality: s.imageQuality, count: 1, references: [{ bytes: ref, mime: "image/png" }], user: providerUserId(o.user_id) });
  const path = outPath(o, `art-${i + 1}.png`);
  await putFile(path, res.images[0], "image/png");
  return { path, usd: res.costUsd ?? mapImageUsd(s.imageQuality) };
}

/** One step of making the maps: a map drawn by صادق, or by GPT Image 2, or (at the end) the files put together. */
export async function mapFinalStep(job: { kind: string; input: Record<string, unknown>; progress: Record<string, unknown> }, o: Output, c: Ctx): Promise<StepResult> {
  const plan = o.plan as MindPlan;
  const s = mapSettings(o.settings);
  const d = designOf(o);
  const total = plan.maps.length;
  // صادق's pictures first (free, and the reference GPT Image 2 draws from)
  const todo = plan.maps.findIndex((m) => !m.rendered?.path || m.rendered.sig !== mapSig(m, d));
  if (todo >= 0) {
    plan.maps[todo].rendered = await renderMap(o, c, plan, todo);
    await saveOutput(o.id, { plan });
    return { done: false, stage: `صادق يرسم الخريطة ${todo + 1} من ${total}` };
  }
  if (s.render === "image") {
    if (job.kind === "revise") {
      // one map drawn again with the student's request; the others stay
      const i = Number(job.input.chapter);
      if (!job.progress.drawn && plan.maps[i]) {
        const note = String(job.input.note ?? "");
        const r = await drawMap(o, c, plan, i, note);
        plan.maps[i].picture = { path: r.path, sig: artSig(plan.maps[i], d, s.imageQuality) };
        await saveOutput(o.id, { plan });
        return { done: false, usd: r.usd, progress: { drawn: true }, stage: `رسم الخريطة ${i + 1} من جديد بـ GPT Image 2` };
      }
    } else {
      const k = plan.maps.findIndex((m) => !m.picture?.path || m.picture.sig !== artSig(m, d, s.imageQuality));
      if (k >= 0) {
        const r = await drawMap(o, c, plan, k);
        plan.maps[k].picture = { path: r.path, sig: artSig(plan.maps[k], d, s.imageQuality) };
        await saveOutput(o.id, { plan });
        return { done: false, usd: r.usd, stage: `GPT Image 2 يرسم الخريطة ${k + 1} من ${total}` };
      }
    }
  }
  // the files: every map as a picture, all of them in one PDF, the blank copies, and GPT Image 2's maps
  const files: Record<string, string> = {};
  plan.maps.forEach((m, i) => {
    files[`map_${i + 1}`] = m.rendered!.path;
    if (s.recall && m.rendered!.blank) files[`blank_${i + 1}`] = m.rendered!.blank;
    if (s.render === "image" && m.picture?.path) files[`art_${i + 1}`] = m.picture.path;
  });
  const pdf = async (name: string, paths: string[]) => {
    const path = outPath(o, `${name}.pdf`);
    await putFile(path, await picturesPdf(paths), "application/pdf");
    files[name] = path;
  };
  await pdf("maps_pdf", plan.maps.map((m) => m.rendered!.path));
  if (s.recall) await pdf("blank_pdf", plan.maps.map((m) => m.rendered!.blank).filter(Boolean));
  if (s.render === "image") await pdf("art_pdf", plan.maps.map((m) => m.picture?.path ?? "").filter(Boolean));
  await saveOutput(o.id, { status: "review", files, content: { maps: total } }, { kind: job.kind === "revise" ? "revision" : "final", snapshot: { plan, files: Object.values(files) }, userId: o.user_id });
  return { done: true, stage: total > 1 ? `${total} خرائط جاهزة` : "الخريطة جاهزة" };
}

