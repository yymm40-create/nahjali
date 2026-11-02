import { JAWAD_KNOWLEDGE } from "./knowledge";

// A short version of the site's knowledge for a robot that works inside ONE section (the whole text is ~96k tokens a
// call): what JAWAD AI is and who it talks to, the coins in two lines, every section by its name and first words (so
// the robot still knows where to send someone), its OWN section in full, and the content and safety rules. Built from
// JAWAD_KNOWLEDGE itself, so it never drifts from it, and always the same text for a section, so it caches.

const body = JAWAD_KNOWLEDGE.replace(/^<platform_knowledge>\n?/, "").replace(/\n?<\/platform_knowledge>$/, "");
const lines = body.split("\n");

/** The lines of the part that begins with this heading (until the next heading). */
function part(heading: string): string[] {
  const at = lines.findIndex((l) => l.startsWith(`## ${heading}`));
  if (at < 0) return [];
  const out: string[] = [];
  for (let i = at + 1; i < lines.length && !lines[i].startsWith("## "); i++) if (lines[i].trim()) out.push(lines[i]);
  return out;
}

/** A long line cut at a sentence end near `max` characters. */
function head(line: string, max: number): string {
  if (line.length <= max) return line;
  const cut = line.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "), cut.lastIndexOf(": "));
  return `${(end > max * 0.4 ? cut.slice(0, end + 1) : cut).trimEnd()} …`;
}

const cache = new Map<string, string>();

/**
 * The short knowledge for the section named «name» (as the knowledge writes it, e.g. "صانع المحتوى"): its own line in
 * full and everything else in brief. Unknown name: the brief alone.
 */
export function sectionKnowledge(name: string): string {
  const hit = cache.get(name);
  if (hit) return hit;
  const intro = lines.find((l) => l.startsWith("You are working inside")) ?? "";
  const site = part("The site and its owner");
  const audience = site.filter((l) => /The audience speaks Arabic/.test(l));
  const coins = part("Smart coins").map((l) => head(l, 360));
  const sections = part("Sections");
  const own = sections.filter((l) => l.includes(`«${name}»`) && /^\d+\.\s/.test(l));
  const index = sections.filter((l) => /^\d+\.\s/.test(l) && !own.includes(l)).map((l) => head(l, 240));
  const safety = part("Content and safety").map((l) => head(l, 700));
  const text = [
    "<platform_knowledge>",
    head(intro, 600),
    "This is the SHORT version of the platform's knowledge, for your own section: yours is in full, the others in brief. If someone asks about another section in detail, give what is here and point them to that section, where its own assistant knows it fully.",
    ...audience,
    "",
    "## Smart coins «النقود الذكية» (in brief)",
    ...coins,
    "",
    "## The other sections (in brief)",
    ...index,
    "",
    ...(own.length ? ["## Your section (in full)", ...own, ""] : []),
    "## Content and safety",
    ...safety,
    "</platform_knowledge>",
  ].join("\n");
  cache.set(name, text);
  return text;
}
