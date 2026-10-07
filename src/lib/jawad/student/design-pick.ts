// «الطالب الذكي» — the design is Claude's choice, not the student's: for each designed output it picks one of the
// branch's styles and fonts (or a style of its own when none fits, or when the student asked for something special),
// from the material, the level, the purpose and the student's special request. Server only. Free for the student
// (a short, low-effort call); if it fails, a sensible style is used and nothing stops.

import { FONTS, STYLES, briefLine, defaultDesign, readBrief, type Design, type StyleId } from "@config/jawad/student";
import { askJson } from "./claude";
import type { Project } from "./db";

export const DESIGNED_KINDS = ["summary", "explain", "book", "slides", "quiz"];

const hex = { type: "string", description: "#rrggbb" };
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["picks"],
  properties: {
    picks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "style", "heading", "body", "accent", "custom", "colors", "texture", "note"],
        properties: {
          kind: { type: "string" },
          style: { type: "string", enum: STYLES.map((s) => s.id) },
          heading: { type: "string", enum: FONTS.map((f) => f.id) },
          body: { type: "string", enum: FONTS.map((f) => f.id) },
          accent: { type: "string", enum: FONTS.map((f) => f.id) },
          custom: { type: "string", description: "Empty, or (only when no style fits or the student asked for a look) a short description of your own style, in Arabic." },
          colors: {
            type: "object",
            additionalProperties: false,
            required: ["bg", "paper", "ink", "muted", "accent", "accent2", "line"],
            properties: { bg: hex, paper: hex, ink: hex, muted: hex, accent: hex, accent2: hex, line: hex },
            description: "Used only with a custom style: page background, paper, text, muted text, two accents, rules. Readable contrast.",
          },
          texture: { type: "string", enum: ["none", "paper", "lines", "grid"] },
          note: { type: "string", description: "What of the student's special request applies to this output, in Arabic (empty if nothing)." },
        },
      },
    },
  },
};

const SYSTEM = `You are the designer of «الطالب الذكي». The student never chooses fonts or styles: you do, for each output listed, so it suits the material, the student's level and age, and what it is for. Choose one of these styles (or describe your own in "custom" with your own colours, only when none fits or the student's special request asks for a look the styles don't have):
${STYLES.map((s) => `- ${s.id}: ${s.name} — ${s.idea} Suits: ${s.suits}`).join("\n")}
Fonts (ids; heading = titles, body = reading text, accent = quotes, margin notes and verbatim text):
${FONTS.map((f) => `- ${f.id}: ${f.label} — ${f.role}`).join("\n")}
Rules: body text must be very readable for long reading (young students: rounder, bigger-looking fonts); headings may have character; outputs of one material should look like one family unless the special request says otherwise. "note": pass on what the student's special request asks of this output (content, length, look, language), in Arabic; empty when it asks nothing of it.`;

/** One design per designed output (by kind) and the part of the special request for each. */
export async function pickDesigns(project: Project, kinds: string[], topic: string, special: string): Promise<{ designs: Record<string, Design>; notes: Record<string, string> }> {
  const want = kinds.filter((k) => DESIGNED_KINDS.includes(k));
  const designs: Record<string, Design> = {};
  const notes: Record<string, string> = {};
  if (!want.length && !special) return { designs, notes };
  try {
    const r = await askJson<{ picks: { kind: string; style: StyleId; heading: string; body: string; accent: string; custom: string; colors: NonNullable<Design["custom"]>["colors"]; texture: "none" | "paper" | "lines" | "grid"; note: string }[] }>({
      system: SYSTEM,
      parts: [
        {
          type: "text",
          text: `Material: ${project.title}\nTopic: ${topic}\nLevel: ${project.level || "unspecified"}. Audience: ${project.audience || "the student"}. ${briefLine(readBrief(project.brief))}\nOutputs: ${kinds.join(", ")}\nThe student's special request: ${special || "(none)"}`,
        },
      ],
      schema: SCHEMA,
      maxTokens: 4000,
      effort: "low",
    });
    for (const p of r.data.picks) {
      if (!kinds.includes(p.kind)) continue;
      if (p.note.trim()) notes[p.kind] = p.note.trim().slice(0, 2000);
      if (!DESIGNED_KINDS.includes(p.kind)) continue;
      designs[p.kind] = {
        main: p.style,
        roles: {},
        fonts: { heading: p.heading, body: p.body, accent: p.accent },
        custom: p.custom.trim() ? { description: p.custom.trim().slice(0, 3000), colors: p.colors, texture: p.texture, radius: 12, notes: "" } : null,
      };
    }
  } catch (e) {
    console.error("student design pick", e);
  }
  // what Claude didn't answer: the style that suits the level, and the special request as it was written
  const young = /ابتدائي|متوسط/.test(project.level);
  for (const k of want) designs[k] ??= defaultDesign(k === "slides" ? "bento" : young ? "notebook" : "editorial");
  if (special) for (const k of kinds) notes[k] ??= special;
  return { designs, notes };
}
