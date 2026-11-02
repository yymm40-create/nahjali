import { JAWAD_KNOWLEDGE } from "./knowledge";

// What a robot is told about the site (the owner's order: «شلها من الكل… لو انطلب منه شي معين يبحث فيه بس»). The
// whole text is ~96k tokens; no call sends it any more. Every call gets the BRIEF: what JAWAD AI is and who it talks
// to, the coins in brief, every section by its name and first words (so a robot still knows where to send someone),
// its OWN section in full (found from the names in its task), and the content and safety rules — built from
// JAWAD_KNOWLEDGE itself, so it never drifts, and the same text for the same task, so it caches. When a message asks
// about something specific, `lookupKnowledge` searches the whole text and only the closest pieces go with THAT message.

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

/** The sections of the list: the numbered line and the lines that follow it, with the names it is known by. */
const SECTIONS = (() => {
  const list = part("Sections");
  const out: { lines: string[]; names: string[] }[] = [];
  for (const l of list) {
    if (/^\d+\.\s/.test(l)) out.push({ lines: [l], names: [...l.slice(0, 220).matchAll(/«([^»]{2,40})»/g)].map((m) => m[1]) });
    else out.at(-1)?.lines.push(l);
  }
  return out;
})();

/** The section a task is about: the one whose names (the section's, its assistant's) its text mentions most. */
function sectionOf(task: string): (typeof SECTIONS)[number] | null {
  let best: (typeof SECTIONS)[number] | null = null;
  let most = 0;
  for (const s of SECTIONS) {
    const n = s.names.reduce((a, name) => a + task.split(name).length - 1, 0);
    if (n > most) [best, most] = [s, n];
  }
  return best;
}

const cache = new Map<string, string>();

function brief(own: (typeof SECTIONS)[number] | null): string {
  const intro = lines.find((l) => l.startsWith("You are working inside")) ?? "";
  const audience = part("The site and its owner").filter((l) => /The audience speaks Arabic/.test(l));
  const coins = part("Smart coins").map((l) => head(l, 360));
  const index = SECTIONS.filter((s) => s !== own).map((s) => head(s.lines[0], 240));
  const safety = part("Content and safety").map((l) => head(l, 700));
  return [
    "<platform_knowledge>",
    head(intro, 600),
    "This is the SHORT version of the platform's knowledge: your own section in full, the others in brief. When the person asks about a detail of the site, the platform adds the matching passages of its full knowledge to that message (<site_lookup>); answer from them. What is in neither, say plainly you are not sure and point to the section, where its own assistant knows it fully.",
    ...audience,
    "",
    "## Smart coins «النقود الذكية» (in brief)",
    ...coins,
    "",
    "## The sections (in brief)",
    ...index,
    "",
    ...(own ? ["## Your section (in full)", ...own.lines, ""] : []),
    "## Content and safety",
    ...safety,
    "</platform_knowledge>",
  ].join("\n");
}

/** The short knowledge for the section named «name» (as the knowledge writes it, e.g. "صانع المحتوى"). */
export function sectionKnowledge(name: string): string {
  const key = `name:${name}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const text = brief(SECTIONS.find((s) => s.names[0] === name || s.names.includes(name)) ?? null);
  cache.set(key, text);
  return text;
}

/** The short knowledge for a robot, its own section found from its task's text (the same text for the same task). */
export function siteKnowledge(task: string): string {
  const own = sectionOf(task);
  return sectionKnowledge(own?.names[0] ?? "");
}

// ───────── the lookup: the passages of the whole text a message asks about ─────────

/** Arabic and English written one way (no marks, one alef, one ya, ha for ta marbuta), lower case. */
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي");

const STOP = new Set(
  "من في على عن الى الي الا الذي التي اللي هذا هذه هذي ذلك تلك هناك هنا كيف وش ايش شو ليش لماذا متى وين اين هل يا انا انت انتم هو هي هم نحن مع او ام بس لو اذا ان كان يكون كل بعض شي شيء ابي ابغي ابغى اريد نبي يبي تبي ممكن عشان علشان لان حتى قبل بعد عند عندي عندك فيه فيها منه منها له لها لي لك الموقع موقع the and for with you are this that what how why when where can does have has from into your about which there their they will would should could not but all any".split(" ").map(norm),
);

/** A word's stem: «ال» and «و/ب/ف/ك/ل» taken off a long Arabic word, and its endings (ـي، ـك، ـه، ـها، ـنا، ـكم، ـات…); an English plural's «s». */
function stem(w: string): string {
  if (/^[؀-ۿ]+$/.test(w)) {
    let x = w;
    if (/^(?:وال|بال|فال|كال)[؀-ۿ]{3,}/.test(x)) x = x.slice(3);
    else if (/^لل[؀-ۿ]{3,}/.test(x)) x = x.slice(2);
    else if (/^ال[؀-ۿ]{3,}/.test(x)) x = x.slice(2);
    else if (/^[وفب][؀-ۿ]{4,}/.test(x)) x = x.slice(1);
    for (const end of ["هم", "كم", "ها", "نا", "ات", "ين", "ون", "ه", "ي", "ك"]) {
      if (x.length - end.length >= 3 && x.endsWith(end)) {
        x = x.slice(0, -end.length);
        break;
      }
    }
    return x;
  }
  return w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w;
}

/** The words of a text worth searching by (3 letters or more, no common words), stemmed. */
function words(s: string): string[] {
  return norm(s)
    .split(/[^\p{L}\p{N}/._-]+/u)
    .map((w) => w.replace(/^[./_-]+|[./_-]+$/g, ""))
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map(stem)
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

/**
 * Most of the knowledge is written in English and the person asks in Arabic: the site's common words, Arabic (stemmed
 * as `words` stems them, ة written ه) → the English the knowledge uses. Section and assistant names are Arabic in both.
 */
const SYNONYMS: Record<string, string[]> = Object.fromEntries(
  Object.entries({
    "خلفيه خلفي": "background",
    "صور صوره": "picture image photo",
    "فيديو مقطع مقاطع": "video clip",
    "صوت اصوات": "voice sound audio",
    "سعر اسعار تكلف تكلفه": "price cost",
    "رصيد": "balance wallet",
    "شحن اشحن": "top-up balance package",
    "باق باقه": "package",
    "اشتراك اشترك": "subscription",
    "لعب لعبه": "game",
    "فيلم افلام": "film",
    "ذاكر ذاكره": "memory",
    "كاروسيل": "carousel slide",
    "شريح شرائح": "slide",
    "كود": "code",
    "دخول سجل تسجيل": "sign account login",
    "حساب": "account",
    "ترجم ترجمه": "translate translation",
    "كابشن": "caption",
    "مونتاج": "edit editor timeline",
    "موسيق": "music",
    "كرتون كرتوني": "cartoon",
    "شعار لوقو": "logo",
    "تصميم صمم": "design",
    "مولد مولدات": "generator",
    "دور دوره دورات": "course",
    "طالب": "student",
    "ملخص": "summary",
    "اختبار": "quiz test",
    "بودكاست": "podcast",
    "دبلج دبلجه": "dub dubbing",
    "تكبير ترقيه": "upscale",
    "حذف احذف شيل": "remove delete",
    "تحميل نزل": "download",
    "رفع ارفع ارفق": "upload attach",
    "مجان مجاني": "free",
    "اعمال": "works",
    "موشن": "motion",
    "ريل ريلز": "reel",
    "سكربت": "script",
    "كتاب": "book",
    "جدول جداول": "table booklet",
    "خطب خطيب": "sermon",
    "قران": "quran",
  }).flatMap(([ar, en]) => ar.split(" ").map((w) => [w, en.split(" ")])),
);

interface Piece {
  /** as it is sent: where it is from, then the passage */
  text: string;
  /** the passage alone, as the knowledge writes it */
  raw: string;
  terms: Set<string>;
}

/** The whole text in pieces: a line, or a long line cut at sentence ends (~1600 characters), each with where it is from. */
const PIECES: Piece[] = (() => {
  const out: Piece[] = [];
  let heading = "";
  for (const l of lines) {
    if (!l.trim()) continue;
    if (l.startsWith("## ")) {
      heading = l.slice(3).trim();
      continue;
    }
    const from = `[${heading}] `;
    if (l.length <= 1800) {
      out.push({ text: from + l, raw: l, terms: new Set(words(l)) });
      continue;
    }
    const lead = head(l, 160);
    const sentences = l.split(/(?<=[.;])\s+/);
    let cur = "";
    for (const s of sentences) {
      if (cur && cur.length + s.length > 1600) {
        out.push({ text: `${from}${l.startsWith(cur) ? "" : `(${lead}) `}${cur}`, raw: cur, terms: new Set(words(cur)) });
        cur = "";
      }
      cur = cur ? `${cur} ${s}` : s;
    }
    if (cur) out.push({ text: `${from}${l.startsWith(cur) ? "" : `(${lead}) `}${cur}`, raw: cur, terms: new Set(words(cur)) });
  }
  return out;
})();

/** In how many pieces each word is (a word in many pieces says little). */
const DF = (() => {
  const df = new Map<string, number>();
  for (const p of PIECES) for (const t of p.terms) df.set(t, (df.get(t) ?? 0) + 1);
  return df;
})();

/**
 * The passages of the whole knowledge closest to what is asked (`query`: the person's message), at most `max`
 * characters, leaving out what `known` already holds (the brief the robot has). Empty when nothing is close enough:
 * a message that is not about the site gets nothing.
 */
export function lookupKnowledge(query: string, known = "", max = 7000): string {
  const asked = words(query);
  const q = [...new Set([...asked, ...asked.flatMap((w) => SYNONYMS[w] ?? [])])].filter((t) => DF.has(t) && DF.get(t)! <= PIECES.length * 0.12);
  if (!q.length) return "";
  const N = PIECES.length;
  const scored = PIECES.map((p) => {
    const hits = q.filter((t) => p.terms.has(t));
    // a word almost nothing else has, long enough to be a name and not a greeting («هلا»)
    const rare = hits.some((t) => DF.get(t)! <= 3 && (t.length >= 5 || /[a-z0-9/]/.test(t)));
    return { p, n: hits.length, rare, score: hits.reduce((a, t) => a + Math.log(N / DF.get(t)!), 0) };
  })
    // close enough: two of the asked words, or one word almost nothing else has (a name, an address, a feature)
    .filter((x) => x.n >= 2 || x.rare)
    .filter((x) => !known.includes(x.p.raw.slice(0, 200)))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const out: string[] = [];
  let size = 0;
  for (const x of scored) {
    if (size + x.p.text.length > max) continue;
    out.push(x.p.text);
    size += x.p.text.length;
  }
  return out.join("\n\n");
}

/** The lookup as the block added to a message (empty when there is nothing). */
export function siteLookupBlock(query: string, known = ""): string {
  const found = lookupKnowledge(query, known);
  return found ? `<site_lookup>\n(من معرفة الموقع الكاملة، المقاطع الأقرب لما سأل عنه العميل في هذه الرسالة)\n${found}\n</site_lookup>` : "";
}
