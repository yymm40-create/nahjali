// What run.mjs needs from the site on its side (built for node by esbuild): the page's assembly and fence, the checks, the pictures.
import { Script } from "node:vm";
export { assemble, inlineScripts, pageProblems, playCsp } from "@config/games-build";
export { backgroundFile, coverFile, spriteFile } from "@/lib/games/art";
import { inlineScripts } from "@config/games-build";
export const syntaxOk = (page: string) => inlineScripts(page).every((s) => {
  try { new Script(s); return true; } catch { return false; }
});
