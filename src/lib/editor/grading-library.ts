// «حيدرة»'s grading library, always with him. Built once by scripts/grading-library/build.mts from featured photos
// of Wikimedia Commons (credited in config/grading-library/CREDITS.md): for each photo, mistakes made on purpose in
// Haydara's own grade (casts, exposure, milky/crushed blacks, flat log-like contrast, saturation, an overdone split)
// with the ONE TOUCH that brings each back — found by searching his own controls until the picture matched the
// photographer's — and the clean photo taken to a cinematic look.
// He learns from it in two ways: the LESSONS (what each mistake looks like in the scopes and what fixes it, measured
// over the whole library) are part of every request; and for a colour request, the CASES most like the clip in front
// of him (nearest by its scope, and by the person's words) are shown to him as pictures — the mistake, the original,
// and the exact fix in his controls. Server only.

import library from "@config/grading-library/library.json";
import type { ClaudePart } from "@/lib/film/anthropic";
import type { Scope } from "./scopes";

interface Example {
  id: string;
  src: string;
  kind: "flaw" | "look";
  flaw?: string;
  look?: string;
  made?: Record<string, unknown>;
  fix?: Record<string, unknown>;
  residual?: number;
  scope: Scope;
}
interface Source {
  id: string;
  title: string;
  author: string;
  license: string;
  tags: string[];
  scope: Scope;
}
interface Library {
  version: number;
  built: string;
  flaws: Record<string, { ar: string; en: string }>;
  sources: Source[];
  examples: Example[];
}

const LIB = library as unknown as Library;
const SOURCES = new Map(LIB.sources.map((s) => [s.id, s]));
export const LIBRARY_SIZE = { photos: LIB.sources.length, examples: LIB.examples.length, images: LIB.sources.length + LIB.examples.length };

// ───────── the lessons, measured over the whole library ─────────

const med = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown, k?: "y" | "r" | "b") =>
  typeof v === "number" ? v : v && typeof v === "object" ? (k === "r" ? ((v as { rgb: number[] }).rgb[0] ?? 0) : k === "b" ? ((v as { rgb: number[] }).rgb[2] ?? 0) : ((v as { y: number }).y ?? 0)) : 0;

/** For each kind of mistake: how it moves the scopes (median, vs the photographer's original) and the median fix. */
function lessons() {
  const lines: string[] = [];
  for (const [kind, label] of Object.entries(LIB.flaws)) {
    const ex = LIB.examples.filter((e) => e.kind === "flaw" && e.flaw === kind);
    if (!ex.length) continue;
    const d = (f: (s: Scope) => number) => r1(med(ex.map((e) => f(e.scope) - f(SOURCES.get(e.src)!.scope))));
    const sig = [
      `p2 ${d((s) => s.p2)}`,
      `p50 ${d((s) => s.p50)}`,
      `p98 ${d((s) => s.p98)}`,
      `crushed ${d((s) => s.crushed)}%`,
      `blown ${d((s) => s.blown)}%`,
      `sat ${d((s) => s.sat)}`,
      `cast mids r ${d((s) => s.cast.mids.r)} b ${d((s) => s.cast.mids.b)}`,
      `shadows r ${d((s) => s.cast.shadows.r)} b ${d((s) => s.cast.shadows.b)}`,
      `highs r ${d((s) => s.cast.highs.r)} b ${d((s) => s.cast.highs.b)}`,
    ].join(", ");
    const keys = [...new Set(ex.flatMap((e) => Object.keys(e.fix ?? {})))];
    const fix = keys
      .map((k) => {
        const vals = ex.map((e) => (e.fix ?? {})[k]);
        if (k === "lift" || k === "gain" || k === "gamma" || k === "offset") {
          const y = r2(med(vals.map((v) => num(v, "y"))));
          const r = r2(med(vals.map((v) => num(v, "r"))));
          const b = r2(med(vals.map((v) => num(v, "b"))));
          return `${k} ${y ? `y ${y}` : ""}${r || b ? ` r ${r} b ${b}` : ""}`.trim();
        }
        return `${k} ${r2(med(vals.map((v) => num(v))))}`;
      })
      .filter((s) => !/^\w+$/.test(s));
    const res = r1(med(ex.map((e) => e.residual ?? 0)));
    lines.push(`- ${label.en} («${label.ar}»), ${ex.length} cases. In the scopes (median change): ${sig}. Median fix in your controls: ${fix.join(", ")} (leaves ${res}% RMS from the original${res > 1.5 ? " — some of it can't come back: what was clipped or crushed is gone, so protect the highlights/shadows instead of chasing it" : ""}).`);
  }
  return lines.join("\n");
}

/** What the library taught, in words: part of every request («حيدرة» always has it). */
export const GRADING_LESSONS = `YOUR GRADING LIBRARY (${LIB.sources.length} professional photographs, ${LIB.examples.filter((e) => e.kind === "flaw").length} mistakes made on purpose and fixed in your own controls, ${LIB.examples.filter((e) => e.kind === "look").length} cinematic looks). What it teaches:
${lessons()}
Principles the library confirms (and real colourists work by):
- Correct first, then grade: a look on uncorrected footage amplifies its faults. Neutral things (white walls, grey concrete, clouds) must sit near zero cast in every band before any creative tint.
- Fix the cause with the control that made it: a cast is temp/tint (or the wheels for one tonal band only), exposure is exposure (not contrast), milky blacks are blacks/lift (not contrast alone), flat log is contrast + saturation together. One right touch beats five small ones.
- Read the numbers, then trust your eyes: blacks just above 0 IRE (crushed under ~1%), whites under 100 (blown under ~1%), skin hue 20–30°, saturation natural (mean ~20–35 for daylight scenes) — then judge the picture.
- Separation beats saturation: contrast between warm skin/practicals and cooler shadows makes a cinematic picture more than pushing saturation. Protect skin in every look.
- What is clipped or crushed cannot come back: bring the rest into a pleasing range and let the lost part roll off softly.
- Beauty over the formula: when a fix is technically right but dull, add a gentle, motivated look on its own layer (warmth from the light source, cooler shadows, soft roll-off), never a random one.`;

// ───────── the cases nearest to the clip in front of him ─────────

const WORDS: [RegExp, string[]][] = [
  [/اصفر|أصفر|مصفر|دافي|دافئ|برتقال|warm|yellow|orange/i, ["warm_cast"]],
  [/ازرق|أزرق|مزرق|بارد|cool|blue/i, ["cool_cast", "split_wrong"]],
  [/اخضر|أخضر|مخضر|green|فلورس/i, ["green_tint"]],
  [/وردي|بنفسج|موف|magenta|pink|purple/i, ["magenta_tint"]],
  [/غامق|مظلم|معتم|ظلمة|dark|under/i, ["under", "crushed"]],
  [/محروق|فاتح|ساطع|بيض|blown|over|bright/i, ["over"]],
  [/باهت|مسطح|لوق|رمادي|flat|log|washed/i, ["flat", "milky", "undersat"]],
  [/حليب|الاسود رمادي|الأسود رمادي|milky|lifted/i, ["milky"]],
  [/مسحوق|الظلال ضايعة|crush/i, ["crushed"]],
  [/فاقع|مشبع|تشبع زايد|oversat|saturated/i, ["oversat"]],
  [/ميت|بدون ألوان|بدون الوان|lifeless|undersat/i, ["undersat"]],
  [/قاسي|حاد|harsh/i, ["harsh"]],
  [/تيل|teal|اورنج|أورنج/i, ["split_wrong"]],
];
const LOOK_WORDS = /سينمائ|لوك|ستايل|جمال|احترافي|فيلم|cinematic|look|film|grade/i;

const vec = (s: Scope) => [
  s.p2 / 10,
  s.p50 / 15,
  s.p98 / 10,
  Math.min(s.crushed, 30) / 5,
  Math.min(s.blown, 30) / 5,
  s.sat / 8,
  s.cast.shadows.r / 3,
  s.cast.shadows.b / 3,
  s.cast.mids.r / 3,
  s.cast.mids.b / 3,
  s.cast.highs.r / 3,
  s.cast.highs.b / 3,
];
const dist = (a: number[], b: number[]) => Math.sqrt(a.reduce((t, v, i) => t + (v - b[i]) ** 2, 0));
const VECS = new Map(LIB.examples.map((e) => [e.id, vec(e.scope)]));

/** The library's cases most like this clip (its scope) and this request (its words): mistakes and, if asked, looks. */
export function nearestCases(scope: Scope | null, words: string, k = 3) {
  const wanted = new Set(WORDS.flatMap(([re, kinds]) => (re.test(words) ? kinds : [])));
  const here = scope ? vec(scope) : null;
  const skin = !!scope?.skin && scope.skin.share > 3;
  const flaws = LIB.examples
    .filter((e) => e.kind === "flaw")
    .map((e) => {
      let d = here ? dist(here, VECS.get(e.id)!) : 10;
      if (wanted.has(e.flaw!)) d *= 0.35;
      if (skin && SOURCES.get(e.src)?.tags.includes("skin")) d *= 0.85;
      return { e, d };
    })
    .sort((a, b) => a.d - b.d);
  // different mistakes, not three of the same
  const out: Example[] = [];
  for (const { e } of flaws) {
    if (out.length >= k) break;
    if (!out.some((o) => o.flaw === e.flaw)) out.push(e);
  }
  if (LOOK_WORDS.test(words)) {
    const looks = LIB.examples.filter((e) => e.kind === "look" && (!skin || SOURCES.get(e.src)?.tags.includes("skin")));
    const pick = here ? looks.sort((a, b) => dist(here, vec(SOURCES.get(a.src)!.scope)) - dist(here, vec(SOURCES.get(b.src)!.scope))) : looks;
    const seen = new Set<string>();
    for (const l of pick) {
      if (seen.size >= 2) break;
      if (seen.has(l.look!)) continue;
      seen.add(l.look!);
      out.push(l);
    }
  }
  return out;
}

/** Whether a request is about colour (the library is shown only then). */
export const aboutColour = (words: string) => /لون|ألوان|الوان|تلوين|كلر|كولر|grade|grading|colou?r|درج|تصحيح|توازن|أبيض|ابيض|اسود|أسود|إضاءة|اضاءة|exposure|تشبع|ميل|سينمائ|لوك|look/i.test(words);

const cache = new Map<string, string>();
async function picture(origin: string, id: string): Promise<string | null> {
  if (cache.has(id)) return cache.get(id)!;
  try {
    const res = await fetch(`${origin}/grading-library/${id}.jpg`);
    if (!res.ok) return null;
    const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
    if (cache.size > 400) cache.clear();
    cache.set(id, b64);
    return b64;
  } catch {
    return null;
  }
}

const scopeLineOf = (s: Scope) => `IRE ${r1(s.p2)}/${r1(s.p50)}/${r1(s.p98)}, crushed ${r1(s.crushed)}%, blown ${r1(s.blown)}%, sat ${r1(s.sat)}, cast mids r${r1(s.cast.mids.r)} b${r1(s.cast.mids.b)}`;

/** The cases as Claude reads them: for each, the mistake (picture + scope), the original, and the exact fix. */
export async function caseParts(cases: Example[], origin: string | null): Promise<ClaudePart[]> {
  if (!cases.length) return [];
  const parts: ClaudePart[] = [
    {
      type: "text",
      text: "FROM YOUR GRADING LIBRARY — the cases most like this one (study them before you grade: the mistake, the photographer's original, and the touch that fixed it in YOUR controls; a look shows the clean original taken somewhere cinematic). Use them as experience, not as a recipe: your clip is its own picture.",
    },
  ];
  for (const c of cases) {
    const src = SOURCES.get(c.src);
    const [a, b] = origin ? await Promise.all([picture(origin, c.id), picture(origin, c.src)]) : [null, null];
    if (c.kind === "flaw") {
      parts.push({
        type: "text",
        text: `CASE ${c.id} — mistake: ${LIB.flaws[c.flaw!]?.en} («${LIB.flaws[c.flaw!]?.ar}»). Its scope: ${scopeLineOf(c.scope)}. The original's: ${src ? scopeLineOf(src.scope) : "?"}. THE FIX that brought it back (a grade layer, your controls): ${JSON.stringify(c.fix)} → ${c.residual}% from the original.${a ? " Picture 1: the mistake. Picture 2: the original." : ""}`,
      });
    } else {
      parts.push({ type: "text", text: `LOOK ${c.look} on a clean photo (${src?.tags.join(", ") ?? ""}). Its scope after: ${scopeLineOf(c.scope)}.${a ? " Picture 1: the look. Picture 2: the clean original." : ""}` });
    }
    if (a) parts.push({ type: "image64", data: a, mediaType: "image/jpeg" });
    if (b) parts.push({ type: "image64", data: b, mediaType: "image/jpeg" });
  }
  return parts;
}
