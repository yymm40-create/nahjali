// Draws every exercise's technique figure (first and last position) on one sheet, to check them by eye.
// Usage: npx tsx scripts/render-exercise-figures.mts <out.html>
import { writeFileSync } from "node:fs";
import { FIGURES } from "../config/mahdi/exercise-figures";
import { EXERCISES } from "../src/lib/mahdi/health/plan";
import { figureShapes, shapesToSvg, type Tone } from "../src/lib/mahdi/health/figure";

const colors: Record<Tone, string> = { body: "#e8edf2", far: "#7d8794", gear: "#9aa3ad", gearSoft: "#4b545e", accent: "#c6ff1a", ghost: "#e8edf2", floor: "#39414a" };
const only = process.argv.slice(3);
const cells = EXERCISES.filter((e) => !only.length || only.includes(e.id)).map((e) => {
  const def = FIGURES[e.id];
  if (!def) return `<div class="c miss"><b>${e.id}</b> missing</div>`;
  const last = def.frames.length - 1;
  const a = shapesToSvg(figureShapes(def, 0, { ghost: false, arrow: false }), colors);
  const b = shapesToSvg(figureShapes(def, last), colors);
  return `<div class="c"><b>${e.id} · ${e.name}</b><div class="row">${a}${b}</div></div>`;
});
writeFileSync(
  process.argv[2],
  `<!doctype html><meta charset="utf-8"><style>body{background:#0b0e12;color:#ccc;font:12px sans-serif;margin:8px;display:grid;grid-template-columns:repeat(${only.length ? 3 : 4},1fr);gap:8px}.c{background:#151a20;border-radius:8px;padding:6px}.row{display:grid;grid-template-columns:1fr 1fr;gap:4px}.miss{color:#f66}svg{width:100%;background:#10151a;border-radius:6px}</style>${cells.join("")}`,
);
console.log("figures:", Object.keys(FIGURES).length, "exercises:", EXERCISES.length);
