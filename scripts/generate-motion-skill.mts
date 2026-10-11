// Writes src/lib/editor/motion-director-text.ts from config/editor/skills/motion-video-director/SKILL.md, VERBATIM.
// The skill is the owner's own file: it is never rewritten, summarised or edited — only escaped so TypeScript can hold
// it as a string (the runtime value is the file, byte for byte; tests/editor/motion-director.test.ts proves it).
// Run after changing SKILL.md:  npx tsx scripts/generate-motion-skill.mts
import { readFileSync, writeFileSync } from "node:fs";

const MD = "config/editor/skills/motion-video-director/SKILL.md";
const OUT = "src/lib/editor/motion-director-text.ts";
const text = readFileSync(MD, "utf8");
const escaped = text.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
writeFileSync(
  OUT,
  `// GENERATED — do not edit by hand. The owner's motion skill, VERBATIM from ${MD}\n` +
    `// (regenerate with: npx tsx scripts/generate-motion-skill.mts). حيدرة is given these words as they are, never rewritten.\n\n` +
    `export const MOTION_DIRECTOR_SKILL_TEXT = \`${escaped}\`;\n`,
);
console.log(`${OUT}: ${text.length} chars`);
