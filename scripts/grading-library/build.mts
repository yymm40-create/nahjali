/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- a one-off build script over loosely typed Wikimedia API answers */
// Builds «حيدرة»'s grading library: a few hundred high-quality photos from Wikimedia Commons (featured pictures under
// free licences that allow changes, each credited), and from each one, teaching examples in Haydara's own grade:
//   · three MISTAKES (a colour cast, wrong exposure, milky or crushed blacks, flat log-like contrast, over/under
//     saturation, wrong split…) made on purpose, each with the ONE TOUCH that brings it back — found by searching
//     Haydara's own controls until the picture matches the photographer's (so the fix is real, and its residual
//     honest: what was clipped stays lost);
//   · one LOOK: the clean photo taken to a cinematic grade (one of the editor's looks), the creative step.
// Writes public/grading-library/*.jpg (320 px) and config/grading-library/library.json (+ CREDITS.md).
// Usage: npx jiti scripts/grading-library/build.mts [maxPhotos]   (polite to Wikimedia: paced, retried)

import { mkdir, writeFile, readFile } from "fs/promises";
import { existsSync } from "fs";
import sharp from "sharp";
import { NEUTRAL_GRADE, LOOKS, applyLook, readGrade, type Grade } from "../../src/lib/editor/grade";
import { gradeFn, gradePixels } from "../../src/lib/editor/grade-cpu";
import { scopeOf, type Scope } from "../../src/lib/editor/scopes";

const MAX = Number(process.argv[2] ?? 260);
const UA = "nahjali-grading-library/1.0 (https://github.com/yymm40-create/nahjali)";
const OUT_IMG = "public/grading-library";
const OUT_JSON = "config/grading-library";
const CACHE = "tmp/grading-library";

const CATEGORIES: { cat: string; tags: string[]; want: number }[] = [
  { cat: "Featured_pictures_of_people", tags: ["people", "skin"], want: 45 },
  { cat: "Featured_pictures_of_landscapes", tags: ["landscape"], want: 35 },
  { cat: "Featured_pictures_of_night", tags: ["night", "low-key"], want: 25 },
  { cat: "Featured_pictures_of_sunsets_and_sunrises", tags: ["sunset", "warm"], want: 20 },
  { cat: "Featured_pictures_of_interiors", tags: ["interior"], want: 25 },
  { cat: "Featured_pictures_of_cityscapes", tags: ["city"], want: 25 },
  { cat: "Featured_pictures_of_architecture", tags: ["architecture"], want: 20 },
  { cat: "Featured_pictures_of_religious_buildings", tags: ["architecture", "religious"], want: 20 },
  { cat: "Featured_pictures_of_food_and_drink", tags: ["food"], want: 15 },
  { cat: "Featured_pictures_of_deserts", tags: ["desert", "warm"], want: 15 },
  { cat: "Featured_pictures_of_seascapes", tags: ["sea"], want: 15 },
  { cat: "Featured_pictures_of_forests", tags: ["forest", "green"], want: 15 },
  { cat: "Featured_pictures_of_events", tags: ["event", "people"], want: 15 },
  { cat: "Featured_pictures_of_sport", tags: ["sport", "people"], want: 10 },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string, binary = false): Promise<any> {
  for (let i = 0; i < 6; i++) {
    const res = await fetch(url, { headers: { "user-agent": UA } }).catch(() => null);
    if (res?.ok) return binary ? Buffer.from(await res.arrayBuffer()) : res.json();
    const wait = Number(res?.headers.get("retry-after") ?? 0) * 1000 || 4000 * (i + 1);
    console.log(`  … ${res?.status ?? "network"}; waiting ${wait / 1000}s`);
    await sleep(wait);
  }
  throw new Error(`failed: ${url}`);
}

const FREE = /^(cc0|public domain|pd|cc by(-sa)? ?[\d.]*( [a-z]+)?|cc-by(-sa)?-[\d.]+|attribution|gfdl)/i;
const strip = (s: string) => String(s ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

interface Source { id: string; title: string; page: string; author: string; license: string; licenseUrl: string; tags: string[]; thumb: string }

// topics searched inside the featured pictures (to reach a balanced few hundred)
const SEARCHES: { q: string; tags: string[]; want: number }[] = [
  { q: "portrait", tags: ["people", "skin"], want: 18 },
  { q: "woman portrait", tags: ["people", "skin"], want: 10 },
  { q: "man portrait", tags: ["people", "skin"], want: 10 },
  { q: "child", tags: ["people", "skin"], want: 8 },
  { q: "night city", tags: ["night", "city", "low-key"], want: 12 },
  { q: "night street lights", tags: ["night", "city", "low-key"], want: 8 },
  { q: "interior hall", tags: ["interior"], want: 10 },
  { q: "mosque interior", tags: ["interior", "religious"], want: 8 },
  { q: "mosque", tags: ["architecture", "religious"], want: 8 },
  { q: "market", tags: ["people", "city"], want: 8 },
  { q: "desert", tags: ["desert", "warm"], want: 10 },
  { q: "sunset", tags: ["sunset", "warm"], want: 10 },
  { q: "sea coast", tags: ["sea", "landscape"], want: 8 },
  { q: "mountain landscape", tags: ["landscape"], want: 10 },
  { q: "forest", tags: ["forest", "green", "landscape"], want: 8 },
  { q: "snow winter", tags: ["snow", "landscape"], want: 6 },
  { q: "fog", tags: ["fog", "landscape"], want: 6 },
  { q: "food dish", tags: ["food"], want: 6 },
  { q: "candle", tags: ["low-key", "warm"], want: 5 },
  { q: "concert stage", tags: ["night", "people", "event"], want: 6 },
  { q: "festival", tags: ["event", "people"], want: 6 },
  { q: "workshop craftsman", tags: ["people", "interior"], want: 6 },
];

async function search(have: Source[]): Promise<Source[]> {
  const out: Source[] = [];
  const ids = new Set(have.map((s) => s.id));
  for (const s of SEARCHES) {
    if (have.length + out.length >= MAX) break;
    const q = new URLSearchParams({ action: "query", format: "json", generator: "search", gsrsearch: `incategory:Featured_pictures_on_Wikimedia_Commons ${s.q} filetype:bitmap`, gsrnamespace: "6", gsrlimit: "40", prop: "imageinfo", iiprop: "url|extmetadata|mime|size", iiurlwidth: "640" });
    const d = await get(`https://commons.wikimedia.org/w/api.php?${q}`);
    await sleep(6000);
    let got = 0;
    for (const p of Object.values(d?.query?.pages ?? {}) as any[]) {
      if (got >= s.want || have.length + out.length >= MAX) break;
      const src = toSource(p, s.tags);
      if (!src || ids.has(src.id)) continue;
      ids.add(src.id);
      out.push(src);
      got++;
    }
    console.log(`search «${s.q}»: ${got}`);
  }
  return out;
}

function toSource(p: any, tags: string[]): Source | null {
  const ii = p.imageinfo?.[0];
  const m = ii?.extmetadata ?? {};
  const lic = strip(m.LicenseShortName?.value);
  if (ii?.mime !== "image/jpeg" || !ii.thumburl || !FREE.test(lic) || /\b(nd|nc)\b/i.test(lic)) return null;
  if (ii.width < 1200 || ii.height < 800 || ii.width / ii.height > 2.4 || ii.height / ii.width > 1.6) return null;
  return { id: `w${p.pageid}`, title: strip(p.title).replace(/^File:/, "").replace(/\.jpe?g$/i, ""), page: ii.descriptionurl, author: strip(m.Artist?.value).slice(0, 120) || "Wikimedia Commons", license: lic, licenseUrl: strip(m.LicenseUrl?.value), tags, thumb: ii.thumburl };
}

async function collect(): Promise<Source[]> {
  const out: Source[] = [];
  for (const c of CATEGORIES) {
    let cont: Record<string, string> = {};
    let got = 0;
    for (let page = 0; page < 6 && got < c.want && out.length < MAX; page++) {
      const q = new URLSearchParams({ action: "query", format: "json", generator: "categorymembers", gcmtitle: `Category:${c.cat}`, gcmtype: "file", gcmlimit: "50", prop: "imageinfo", iiprop: "url|extmetadata|mime|size", iiurlwidth: "640", ...cont });
      const d = await get(`https://commons.wikimedia.org/w/api.php?${q}`);
      await sleep(1500);
      const pages = Object.values(d?.query?.pages ?? {}) as any[];
      if (!pages.length) {
        console.log(`(no files in ${c.cat})`);
        break;
      }
      for (const p of pages) {
        if (got >= c.want || out.length >= MAX) break;
        const ii = p.imageinfo?.[0];
        const m = ii?.extmetadata ?? {};
        const lic = strip(m.LicenseShortName?.value);
        if (ii?.mime !== "image/jpeg" || !ii.thumburl || !FREE.test(lic) || /\b(nd|nc)\b/i.test(lic)) continue;
        if (ii.width < 1200 || ii.height < 800 || ii.width / ii.height > 2.4 || ii.height / ii.width > 1.6) continue;
        out.push({ id: `w${p.pageid}`, title: strip(p.title).replace(/^File:/, "").replace(/\.jpe?g$/i, ""), page: ii.descriptionurl, author: strip(m.Artist?.value).slice(0, 120) || "Wikimedia Commons", license: lic, licenseUrl: strip(m.LicenseUrl?.value), tags: c.tags, thumb: ii.thumburl });
        got++;
      }
      if (!d.continue) break;
      cont = d.continue;
    }
    console.log(`${c.cat}: ${got}`);
  }
  return out;
}

// ───────── the mistakes, in Haydara's grade ─────────

type Partial = Record<string, unknown>;
const W = (r: number, g: number, b: number, y = 0) => ({ rgb: [r, g, b], y });
const grade = (p: Partial): Grade => readGrade({ ...NEUTRAL_GRADE, ...p })!;
const rnd = (a: number, b: number, k: number) => a + (b - a) * ((((Math.sin(k * 12.9898) * 43758.5453) % 1) + 1) % 1);

interface Flaw { kind: string; ar: string; en: string; make: (k: number) => Partial; params: (keyof Grade | "lift.y" | "gamma.y" | "gain.y" | "lift.rb" | "gain.rb")[]; avoid?: string[] }
const FLAWS: Flaw[] = [
  { kind: "warm_cast", ar: "ميل أصفر/برتقالي (توازن أبيض دافي غلط)", en: "warm/yellow cast (wrong white balance)", make: (k) => ({ temp: rnd(0.25, 0.55, k) }), params: ["temp", "tint"], avoid: ["sunset", "desert"] },
  { kind: "cool_cast", ar: "ميل أزرق بارد (توازن أبيض بارد غلط)", en: "cool/blue cast", make: (k) => ({ temp: -rnd(0.25, 0.55, k) }), params: ["temp", "tint"], avoid: ["night"] },
  { kind: "green_tint", ar: "ميل أخضر (إضاءة فلورسنت/ليد رخيصة)", en: "green tint (fluorescent/cheap LED)", make: (k) => ({ tint: rnd(0.25, 0.5, k) }), params: ["tint", "temp"], avoid: ["forest"] },
  { kind: "magenta_tint", ar: "ميل وردي/بنفسجي", en: "magenta tint", make: (k) => ({ tint: -rnd(0.25, 0.5, k) }), params: ["tint", "temp"] },
  { kind: "under", ar: "إضاءة ناقصة (الصورة غامقة)", en: "underexposed", make: (k) => ({ exposure: -rnd(0.8, 1.5, k) }), params: ["exposure", "gamma.y", "shadows"], avoid: ["night", "low-key"] },
  { kind: "over", ar: "إضاءة زايدة (الأبيض محروق)", en: "overexposed (clipped highlights)", make: (k) => ({ exposure: rnd(0.7, 1.2, k) }), params: ["exposure", "highlights", "whites"] },
  { kind: "flat", ar: "باهتة مسطحة كأنها لوق ما انفك (تباين وتشبع ناقصين)", en: "flat, log-like (low contrast and saturation)", make: (k) => ({ contrast: rnd(0.55, 0.7, k), saturation: rnd(0.5, 0.65, k), lift: W(0, 0, 0, 0.12) }), params: ["contrast", "saturation", "lift.y"] },
  { kind: "milky", ar: "أسود حليبي مرفوع (الظلال رمادية)", en: "milky lifted blacks", make: (k) => ({ blacks: rnd(0.35, 0.6, k), lift: W(0, 0, 0, rnd(0.08, 0.16, k)) }), params: ["blacks", "lift.y", "contrast"] },
  { kind: "crushed", ar: "أسود مسحوق (تفاصيل الظلال ضايعة)", en: "crushed blacks", make: (k) => ({ blacks: -rnd(0.4, 0.7, k), contrast: rnd(1.2, 1.4, k) }), params: ["blacks", "contrast", "shadows"], avoid: ["night"] },
  { kind: "oversat", ar: "تشبع زايد (ألوان فاقعة، البشرة برتقالية)", en: "oversaturated", make: (k) => ({ saturation: rnd(1.55, 1.9, k) }), params: ["saturation", "vibrance"] },
  { kind: "undersat", ar: "ألوان ميتة (تشبع ناقص)", en: "undersaturated, lifeless colour", make: (k) => ({ saturation: rnd(0.35, 0.55, k) }), params: ["saturation", "vibrance"] },
  { kind: "harsh", ar: "تباين قاسي (ظلال سوداء وأبيض محروق)", en: "harsh contrast", make: (k) => ({ contrast: rnd(1.45, 1.7, k) }), params: ["contrast", "shadows", "highlights"] },
  { kind: "split_wrong", ar: "ظلال زرقاء وأضواء صفراء زيادة عن اللزوم (تيل-أورنج مبالغ)", en: "overdone teal shadows / orange highlights", make: (k) => ({ lift: W(-0.08, 0, rnd(0.14, 0.22, k)), gain: W(rnd(0.14, 0.22, k), 0, -0.12) }), params: ["lift.rb", "gain.rb"] },
];

// ───────── one touch: Haydara's controls searched until the picture matches the original ─────────

const BOUNDS: Record<string, [number, number]> = { temp: [-1, 1], tint: [-1, 1], exposure: [-3, 3], contrast: [0.3, 2], saturation: [0, 2], vibrance: [-1, 1], shadows: [-1, 1], highlights: [-1, 1], blacks: [-1, 1], whites: [-1, 1], "lift.y": [-0.5, 0.5], "gamma.y": [-0.5, 0.5], "gain.y": [-0.5, 0.5] };

function withParam(p: Partial, key: string, v: number): Partial {
  const q: any = { ...p };
  if (key === "lift.y" || key === "gamma.y" || key === "gain.y") {
    const w = key.split(".")[0];
    q[w] = { rgb: q[w]?.rgb ?? [0, 0, 0], y: v };
  } else if (key.startsWith("lift.rb") || key.startsWith("gain.rb")) {
    const w = key.split(".")[0];
    const ch = key.endsWith(":r") ? 0 : 2;
    const rgb = [...(q[w]?.rgb ?? [0, 0, 0])];
    rgb[ch] = v;
    q[w] = { rgb, y: q[w]?.y ?? 0 };
  } else q[key] = v;
  return q;
}
const getParam = (p: Partial, key: string, def: number) => {
  const q: any = p;
  if (key.endsWith(".y")) return q[key.split(".")[0]]?.y ?? 0;
  if (key.includes(".rb:")) return q[key.split(".")[0]]?.rgb?.[key.endsWith(":r") ? 0 : 2] ?? 0;
  return q[key] ?? def;
};
const DEF: Record<string, number> = { contrast: 1, saturation: 1 };

function err(a: Uint8ClampedArray | Uint8Array, b: Uint8ClampedArray | Uint8Array) {
  let s = 0;
  for (let i = 0; i < a.length; i += 4) {
    const dr = a[i] - b[i], dg = a[i + 1] - b[i + 1], db = a[i + 2] - b[i + 2];
    s += 0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db;
  }
  return Math.sqrt(s / (a.length / 4)) / 2.55; // RMS in %
}

function solve(flawed: Uint8ClampedArray, target: Uint8Array, keys: string[]) {
  const expand = keys.flatMap((k) => (k.endsWith(".rb") ? [`${k}:r`, `${k}:b`] : [k]));
  let p: Partial = {};
  let best = err(gradePixels(flawed, grade(p)), target);
  let step = 0.25;
  for (let round = 0; round < 40 && step > 0.004; round++) {
    let improved = false;
    for (const k of expand) {
      const [lo, hi] = BOUNDS[k] ?? [-0.5, 0.5];
      const cur = getParam(p, k, DEF[k] ?? 0);
      for (const d of [step, -step]) {
        const v = Math.min(hi, Math.max(lo, cur + d * (k === "exposure" ? 4 : 1)));
        const q = withParam(p, k, v);
        const e = err(gradePixels(flawed, grade(q)), target);
        if (e < best - 1e-4) {
          best = e;
          p = q;
          improved = true;
          break;
        }
      }
    }
    if (!improved) step /= 2;
  }
  // rounded the way a person would set it
  const tidy: Partial = {};
  for (const [k, v] of Object.entries(p)) tidy[k] = typeof v === "number" ? Math.round(v * 100) / 100 : { rgb: (v as any).rgb.map((x: number) => Math.round(x * 100) / 100), y: Math.round((v as any).y * 100) / 100 };
  return { fix: tidy, residual: Math.round(err(gradePixels(flawed, grade(tidy)), target) * 10) / 10 };
}

// ───────── pictures ─────────

async function rgba(buf: Buffer, w: number) {
  const { data, info } = await sharp(buf).rotate().resize({ width: w, height: w, fit: "inside" }).removeAlpha().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { px: new Uint8Array(data.buffer, data.byteOffset, data.length), w: info.width, h: info.height };
}
const jpg = (px: Uint8Array | Uint8ClampedArray, w: number, h: number) => sharp(Buffer.from(px.buffer, px.byteOffset, px.length), { raw: { width: w, height: h, channels: 4 } }).removeAlpha().jpeg({ quality: 74, mozjpeg: true }).toBuffer();

const r1 = (n: number) => Math.round(n * 10) / 10;
const scopeShort = (s: Scope) => ({ ...s, cast: s.cast, skin: s.skin });

async function main() {
  await mkdir(OUT_IMG, { recursive: true });
  await mkdir(OUT_JSON, { recursive: true });
  await mkdir(CACHE, { recursive: true });
  const listFile = `${CACHE}/sources.json`;
  const sources: Source[] = existsSync(listFile) ? JSON.parse(await readFile(listFile, "utf8")) : await collect();
  // topped up from searches until there are enough
  if (sources.length < MAX) sources.push(...(await search(sources)));
  await writeFile(listFile, JSON.stringify(sources));
  console.log(`${sources.length} photos`);

  const kept: (Source & { scope: Scope; w: number; h: number })[] = [];
  const examples: any[] = [];
  let n = 0;
  for (const s of sources) {
    n++;
    const raw = `${CACHE}/${s.id}.jpg`;
    let buf: Buffer;
    try {
      buf = existsSync(raw) ? await readFile(raw) : await get(s.thumb, true);
      if (!existsSync(raw)) {
        await writeFile(raw, buf);
        await sleep(400);
      }
    } catch {
      console.log(`skip ${s.id}`);
      continue;
    }
    const big = await rgba(buf, 320);
    const small = await rgba(buf, 72);
    const scope = scopeOf(big.px, big.w, big.h);
    const tags = [...s.tags];
    if (scope.skin && scope.skin.share > 3) tags.push("skin");
    if (scope.p50 < 25) tags.push("low-key");
    if (scope.p50 > 65) tags.push("high-key");
    // a photo that's already extreme teaches badly as "the right answer"
    if (scope.blown > 8 || scope.crushed > 25) continue;
    // black-and-white (or nearly) photos teach nothing about colour
    if (scope.sat < 6) continue;
    await writeFile(`${OUT_IMG}/${s.id}.jpg`, await jpg(big.px, big.w, big.h));
    kept.push({ ...s, tags: [...new Set(tags)], scope, w: big.w, h: big.h });

    // three mistakes that fit this photo, and their one-touch fixes
    const fit = FLAWS.filter((f) => !f.avoid?.some((a) => tags.includes(a)));
    const pick = [0, 1, 2].map((i) => fit[(n * 7 + i * 5 + Math.floor(n / 3)) % fit.length]);
    const seen = new Set<string>();
    for (const [i, f] of pick.entries()) {
      if (seen.has(f.kind)) continue;
      seen.add(f.kind);
      const made = f.make(n * 3 + i + 1);
      const g = grade(made);
      const bad = gradePixels(big.px, g);
      const badSmall = gradePixels(small.px, g);
      const { fix, residual } = solve(badSmall, small.px, f.params as string[]);
      const id = `${s.id}-${f.kind}`;
      await writeFile(`${OUT_IMG}/${id}.jpg`, await jpg(bad, big.w, big.h));
      examples.push({ id, src: s.id, kind: "flaw", flaw: f.kind, made, scope: scopeShort(scopeOf(bad, big.w, big.h)), fix, residual });
    }
    // one look: the clean photo taken somewhere cinematic
    const lookPool = tags.includes("night") || tags.includes("low-key") ? ["vision3-500t", "hussaini", "cyberpunk", "teal-orange"] : tags.includes("skin") ? ["teal-orange", "kodak-2383", "golden", "pastel", "fincher", "bw-soft"] : tags.includes("landscape") || tags.includes("sea") || tags.includes("forest") ? ["fuji-3513", "golden", "clean", "vision3-250d", "bleach"] : ["kodak-2383", "teal-orange", "fincher", "matrix", "bw-trix", "vintage", "mexico", "cross"];
    const look = LOOKS.find((l) => l.id === lookPool[n % lookPool.length])!;
    const lg = applyLook(NEUTRAL_GRADE, look);
    const looked = gradePixels(big.px, lg);
    const lid = `${s.id}-look-${look.id}`;
    await writeFile(`${OUT_IMG}/${lid}.jpg`, await jpg(looked, big.w, big.h));
    examples.push({ id: lid, src: s.id, kind: "look", look: look.id, scope: scopeShort(scopeOf(looked, big.w, big.h)) });
    if (n % 20 === 0) console.log(`${n}/${sources.length} · ${examples.length} examples`);
  }

  const flaws = Object.fromEntries(FLAWS.map((f) => [f.kind, { ar: f.ar, en: f.en }]));
  await writeFile(
    `${OUT_JSON}/library.json`,
    JSON.stringify({
      version: 1,
      built: new Date().toISOString().slice(0, 10),
      flaws,
      sources: kept.map(({ thumb: _t, ...k }) => ({ ...k, scope: k.scope })),
      examples,
    }),
  );
  const credits = ["# Haydara's grading library — photo credits", "", "Featured pictures from Wikimedia Commons, used under their free licences (changed: resized, and graded on purpose to show grading mistakes and looks).", ""];
  for (const k of kept) credits.push(`- [${k.title}](${k.page}) — ${k.author} — ${k.license}${k.licenseUrl ? ` (${k.licenseUrl})` : ""}`);
  await writeFile(`${OUT_JSON}/CREDITS.md`, credits.join("\n") + "\n");
  console.log(`done: ${kept.length} photos, ${examples.length} examples (${examples.filter((e) => e.kind === "flaw").length} mistakes + ${examples.filter((e) => e.kind === "look").length} looks)`);
}

void r1;
void gradeFn;
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
