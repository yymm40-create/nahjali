// Writes src/lib/editor/higgsfield-skills-text.ts from the owner's two Higgsfield skills in config/editor/skills/
// (higgsfield-motion, higgsfield-motion-saas), VERBATIM: each SKILL.md whole, and every text file of each skill as a
// reference that the motion lab opens on demand (a big handbook file is split at its "## " headings, never rewritten:
// the sections joined back are the file, byte for byte — tests/editor/higgsfield-skills.test.ts proves it).
// hf-tokens.js is not a reference (743 KB of data): it RUNS in the scene page as K.HFT (public/editor/skills/).
// Run after changing a skill:  npx tsx scripts/generate-higgsfield-skills.mts
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = "config/editor/skills";
const SKILLS = ["higgsfield-motion", "higgsfield-motion-saas"];
const OUT = "src/lib/editor/higgsfield-skills-text.ts";
const TEXT = /\.(md|js|mjs|jsx|html|py|sh|swift)$/;
const SKIP = new Set(["higgsfield-motion/scripts/hf-tokens.js"]);
/** a file bigger than this is split at its "## " headings */
const SPLIT = 40_000;

const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = path.join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

const skills = SKILLS.map((name) => ({ name, text: readFileSync(path.join(ROOT, name, "SKILL.md"), "utf8") }));
const refs: { id: string; skill: string; file: string; title: string; text: string }[] = [];
for (const name of SKILLS) {
  for (const full of walk(path.join(ROOT, name)).sort()) {
    const file = path.relative(path.join(ROOT, name), full);
    if (file === "SKILL.md" || !TEXT.test(file) || SKIP.has(`${name}/${file}`)) continue;
    const text = readFileSync(full, "utf8");
    if (!file.endsWith(".md") || text.length <= SPLIT) {
      refs.push({ id: `${name}/${file}`, skill: name, file, title: (text.match(/^#\s+(.+)$/m)?.[1] ?? file).slice(0, 120), text });
      continue;
    }
    // split at the start of every "## " line (and a still-big piece at its "### " lines); the first piece is what
    // comes before the first heading. Pieces stay in file order, so joined back they are the file.
    const at = (s: string, re: RegExp) => [0, ...[...s.matchAll(re)].map((m) => m.index!).filter((i) => i > 0)];
    const pieces = (s: string, re: RegExp) => at(s, re).map((a, k, all) => s.slice(a, all[k + 1] ?? s.length));
    const parts = pieces(text, /^## .*$/gm).flatMap((p) => (p.length > SPLIT ? pieces(p, /^### .*$/gm) : [p]));
    parts.forEach((piece, k) => {
      const head = piece.match(/^#{1,3}\s+(.+)$/m)?.[1] ?? "(start)";
      refs.push({ id: `${name}/${file}#${k + 1}`, skill: name, file, title: head.slice(0, 120), text: piece });
    });
  }
}
writeFileSync(
  OUT,
  `// GENERATED — do not edit by hand. The owner's two Higgsfield skills, VERBATIM from ${ROOT}/{${SKILLS.join(",")}}\n` +
    `// (regenerate with: npx tsx scripts/generate-higgsfield-skills.mts). Server only: it is large.\n\n` +
    `export interface HfSkill { name: string; text: string }\n` +
    `export interface HfRef { id: string; skill: string; file: string; title: string; text: string }\n` +
    `export const HF_SKILLS: HfSkill[] = ${JSON.stringify(skills)};\n` +
    `export const HF_REFS: HfRef[] = ${JSON.stringify(refs)};\n`,
);
console.log(`${OUT}: ${skills.length} skills, ${refs.length} references, ${refs.reduce((s, r) => s + r.text.length, 0)} chars`);
