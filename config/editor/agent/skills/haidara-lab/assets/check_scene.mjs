// Checks a scene program against the lab machine's rules, before lab_render. Usage: node check_scene.mjs scene.js
import { readFileSync } from "node:fs";
const FORBIDDEN = [["\\bfetch\\s*\\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon","","network access"],["\\bimport\\s*\\(|\\brequire\\s*\\(|\\bimportScripts\\b","","loading code (use K.THREE / K.addon)"],["\\beval\\s*\\(|new\\s+Function\\b|\\bFunction\\s*\\(","","evaluating strings"],["\\bdocument\\.(cookie|domain|write|body|querySelector|getElement)|\\blocalStorage\\b|\\bsessionStorage\\b|\\bindexedDB\\b","","the page or its storage"],["\\b(parent|top|opener)\\s*\\.|\\bpostMessage\\s*\\(","","other windows"],["\\bWorker\\s*\\(|SharedArrayBuffer|\\bnavigator\\.","","workers or the device"],["Math\\.random\\s*\\(|Date\\.now|new\\s+Date\\s*\\(|performance\\.now|setTimeout|setInterval|requestAnimationFrame","","clocks or unseeded randomness (a frame depends only on t: use K.rng / K.hash)"]];
const s = readFileSync(process.argv[2], "utf8").replace(/^```[a-z]*\n?|```\s*$/g, "").trim();
const problems = [];
if (!s) problems.push("the program is empty");
if (!/\bscene\s*\(\s*\{/.test(s)) problems.push("the program never calls scene({ … })");
if (!/\bdraw\s*[:(]/.test(s)) problems.push("the scene has no draw(K, t, ctx)");
for (const [src, flags, why] of FORBIDDEN) if (new RegExp(src, flags).test(s)) problems.push("it uses " + why);
if (/<\/?script/i.test(s)) problems.push("it contains a script tag");
try { new Function(s); } catch (e) { problems.push("syntax: " + e.message); }
if (problems.length) { console.error(problems.map((p) => "- " + p).join("\n")); process.exit(1); }
console.log("ok");
