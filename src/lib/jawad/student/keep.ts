// «الطالب الذكي» — what a change really needs, so the student never pays to have the same text written again. The owner:
// «لو سوى ملخص ١٣ صفحة بعدين غير يبيه ١٤ صفحة تخيل يروح يعيد كل شي تماما!!». A changed setting is one of:
//   • "render" — only how the written text is printed (design, fonts, frame, PDF / Word, numbering…): the plan and the
//     written chapters are kept and the file is made again ($0 of Claude);
//   • "fit" — the page count or the page size: the same, then the type is scaled to land on the count, and only when the
//     type alone can't, the one or two chapters with the most material are made longer or shorter (outputs.ts);
//   • "content" — what is written (density, special requests, the kind of writing…): planned again (with the previous
//     plan, so what did not change stays) and only the chapters whose plan or writing inputs changed are written again.
// Pure (no server imports): the server decides with it, and the page says the truth with it before the student saves.

import { emptyWish, formatOf, maxOn, pagesOf, PAGED_KINDS, type Design, type DesignWish } from "@config/jawad/student";
import { maxChapters } from "./pages";

type S = Record<string, unknown>;
export type SettingsChange = "none" | "render" | "fit" | "content";

const paged = (kind: string) => (PAGED_KINDS as readonly string[]).includes(kind);
/** The page count and the page size: the text stays, the file is fitted to them. */
const FIT_KEYS = ["pages", "page"];

/** Settings that only change how an output already written is printed (never what is written), by kind. */
export function renderKeys(kind: string, s: S): string[] {
  // «حيدرا ماكس» designs its pages with Claude: any change there is paid design work (left to the full path)
  if (maxOn(s)) return [];
  if (paged(kind)) return ["design", "numbered", "format", "pictures"];
  if (kind === "sermon") return ["design", "numbered", "format"];
  // which sheets are printed and their title; the questions stay
  if (kind === "quiz") return ["design", "title", "usage", "pictures"];
  // slides made from the map by the template (pictures drawn by GPT Image 2 depend on the design: they are drawn again)
  if (kind === "slides") return s.render === "image" ? [] : ["design", "aspect"];
  if (kind === "brochure") return ["design"];
  return [];
}

/** The design an output was made with, as the design step's answers (so going back starts from what it is now). */
export function wishOf(d: unknown): DesignWish {
  const x = d as Design | undefined;
  if (!x?.main) return emptyWish();
  return { style: x.main, ideas: x.custom?.description ?? "", heading: x.fonts?.heading ?? "", body: x.fonts?.body ?? "", frame: x.frame !== false };
}

/** JSON with sorted keys (the database returns the same object with its keys in another order). */
export const stable = (v: unknown): string =>
  Array.isArray(v) ? `[${v.map(stable).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable((v as S)[k])}`).join(",")}}` : (JSON.stringify(v) ?? "null");

/** One setting as it is meant (an empty value is the same as none; the defaults of the page size, numbering and format). */
function norm(k: string, v: unknown): string {
  if (k === "pages") return String(pagesOf({ pages: v }));
  if (k === "page") return v === "A5" ? "A5" : "A4";
  if (k === "numbered") return String(v !== false);
  if (k === "format") return formatOf({ format: v });
  if (v === undefined || v === null || v === "") return "";
  return stable(v);
}

const keysOf = (a: S, b: S) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !k.startsWith("_"));

/** The settings that changed between two versions (the hidden `_` ones never count). */
export const changedKeys = (before: S, after: S) => keysOf(before, after).filter((k) => norm(k, before[k]) !== norm(k, after[k]));

/** A plan whose chapters still suit a page count (a 30-chapter plan does not fit 5 pages: it is planned again). */
export function keepsPlan(plan: unknown, pages: number) {
  const n = (plan as { chapters?: unknown[] } | null)?.chapters?.length ?? 0;
  return !pages || !n || n <= maxChapters(pages);
}

/** What saving `after` over `before` needs (see the top of this file). `plan`: the output's plan, when it has one. */
export function settingsChange(kind: string, before: S, after: S, plan?: unknown): SettingsChange {
  const changed = changedKeys(before, after);
  if (!changed.length) return "none";
  // switching «حيدرا ماكس» on or off, or a change inside it, is the full path
  if (maxOn(before) || maxOn(after)) return "content";
  const r = renderKeys(kind, before);
  const fit = paged(kind) ? FIT_KEYS : [];
  if (!changed.every((k) => r.includes(k) || fit.includes(k))) return "content";
  if (!changed.some((k) => fit.includes(k))) return "render";
  return keepsPlan(plan, pagesOf(after)) ? "fit" : "content";
}

/** The settings that shape what is WRITTEN (everything but the printing, the page count and the hidden ones), as one key. */
export function contentKey(kind: string, s: S) {
  const skip = new Set([...renderKeys(kind, s), ...(paged(kind) ? FIT_KEYS : [])]);
  return stable(Object.fromEntries(Object.keys(s).filter((k) => !k.startsWith("_") && !skip.has(k) && norm(k, s[k]) !== "").sort().map((k) => [k, norm(k, s[k])])));
}

/** Whether an output's text is all written (its chapters / questions / files), so a printing change only prints it again. */
export function isWritten(kind: string, plan: unknown, content: unknown, hasFiles: boolean) {
  if (paged(kind) || kind === "sermon") {
    const want = (plan as { chapters?: unknown[] } | null)?.chapters?.length ?? 0;
    const got = (content as { chapters?: unknown[] } | null)?.chapters ?? [];
    return want > 0 && got.length >= want && got.slice(0, want).every(Boolean);
  }
  if (kind === "quiz") {
    const rows = (plan as { rows?: unknown[] } | null)?.rows?.length ?? 0;
    return rows > 0 && Number((content as { rowsDone?: number } | null)?.rowsDone ?? 0) >= rows;
  }
  if (kind === "slides" || kind === "brochure") return Boolean(plan) && hasFiles;
  return false;
}

// ───────────────────────────── chapters kept across a new plan ─────────────────────────────

/** A short hash of a string (53-bit, cyrb53): a change detector, not a security measure. */
export function hashOf(str: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

/**
 * What one chapter is written FROM: its purpose, its segments and their text, the source rules and level, and the
 * settings that shape the writing. Not its title (a renamed chapter keeps its text, under the new title), not the page
 * count (fitted afterwards). The same signature under a new plan means the chapter would be written the same: kept.
 */
export function chapterSig(o: { purpose: string; segments: string[]; texts: string[]; rules: string; settings: string }) {
  return hashOf(stable([o.purpose.trim(), o.segments, o.texts.map(hashOf), o.rules, o.settings]));
}

type Ch = { title: string; blocks: unknown[]; sig?: string };

/**
 * The written chapters a new plan can keep: each new chapter takes the old chapter with its signature (once), under its
 * new title; the others are left empty and written. Null when nothing is kept.
 */
export function keptChapters<C extends Ch>(old: { chapters?: (C | null)[] } | null | undefined, sigs: string[], titles: string[]): (C | null)[] | null {
  const pool = (old?.chapters ?? []).filter((c): c is C => Boolean(c?.sig));
  const used = new Set<number>();
  const out = sigs.map((sig, i) => {
    const k = pool.findIndex((c, j) => !used.has(j) && c.sig === sig);
    if (k < 0) return null;
    used.add(k);
    return { ...pool[k], title: titles[i] ?? pool[k].title };
  });
  return out.some(Boolean) ? out : null;
}

// ───────────────────────────── «اجعله ١٤ صفحة» ─────────────────────────────

const DIGITS: Record<string, string> = Object.fromEntries([..."٠١٢٣٤٥٦٧٨٩"].map((d, i) => [d, String(i)]).concat([..."۰۱۲۳۴۵۶۷۸۹"].map((d, i) => [d, String(i)])));
/** Words that ask for something besides the length: such a request goes to the normal revision. */
const OTHER_ASK = /(أضف|اضف|ضيف|زد|زيد|احذف|حذف|شيل|امسح|اشرح|وضح|وضّح|بسط|بسّط|رتب|صحح|مثال|أمثلة|امثلة|جدول|سؤال|أسئلة|اسئلة|صور|عنوان|فصل|خط|لون|ترجم)/;

/**
 * The page count a request asks for, when the request is ONLY about the length («اجعله ١٤ صفحة»، «صفحتين»، «أقصر»):
 * then the text is fitted to it like a changed page count, not every chapter rewritten. `current`: the pages now (the
 * chosen count, or what the file came out at). Null for anything else.
 */
export function pagesAsked(note: string, current: number): number | null {
  const raw = note.replace(/[٠-٩۰-۹]/g, (d) => DIGITS[d] ?? d).trim();
  if (!raw || raw.split(/\s+/).length > 8) return null;
  // «بدل ١٣» names the count it has now, not the one asked for
  const t = raw.replace(/(بدل|بدال|عوض|بدلا من|بدلاً من|مو|وليس)\s*\d{1,3}(\s*(صفحة|صفحات|صفحه))?/g, " ");
  let n: number | null = null;
  let rest = t;
  const num = t.match(/(\d{1,3})\s*(?:صفحة|صفحات|صفحه|ورقة|ورقات|أوراق|اوراق|pages?)/i);
  if (num) {
    n = Number(num[1]);
    rest = t.replace(num[0], " ");
  } else if (/صفحتين|ورقتين/.test(t)) {
    n = 2;
    rest = t.replace(/صفحتين|ورقتين/, " ");
  } else if (/(صفحة|ورقة)\s*(وحدة|واحدة|وحده|واحده)/.test(t)) {
    n = 1;
    rest = t.replace(/(صفحة|ورقة)\s*(وحدة|واحدة|وحده|واحده)/, " ");
  } else if (current > 0 && /(أقصر|اقصر|اختصره|اختصرها|قصّره|قصره|قصّرها|قصرها)/.test(t)) {
    n = Math.max(1, current - Math.max(1, Math.round(current * 0.2)));
  } else if (current > 0 && /(أطول|اطول|طوّله|طوّلها)/.test(t)) {
    n = current + Math.max(1, Math.round(current * 0.2));
  }
  // another number left (e.g. «الفصل ٣») or another ask: not only the length
  if (n === null || /\d/.test(rest) || OTHER_ASK.test(rest)) return null;
  return n >= 1 && n <= 300 ? n : null;
}

/** Question numbers a request names («السؤال ٣»، «الأسئلة ٢ و٥»، «س4»), 0-based, within `total`. Empty when none is named. */
export function questionsNamed(note: string, total: number): number[] {
  const t = note.replace(/[٠-٩۰-۹]/g, (d) => DIGITS[d] ?? d);
  const out = new Set<number>();
  // a word of its own (the «س» of «درس ٣» is not a question)
  const re = /(?<!\p{L})(?:السؤال|سؤال|الأسئلة|الاسئلة|أسئلة|اسئلة|س|Q)\s*(?:رقم\s*)?(\d{1,3}(?:\s*(?:،|,|و|-|–|إلى|الى|to)\s*\d{1,3})*)/giu;
  for (const m of t.matchAll(re)) {
    const nums = m[1].split(/\s*(?:،|,|و)\s*/);
    for (const part of nums) {
      const range = part.split(/\s*(?:-|–|إلى|الى|to)\s*/).map(Number);
      const [a, b] = [range[0], range[range.length - 1]];
      for (let k = Math.min(a, b); k <= Math.max(a, b) && k - Math.min(a, b) < 100; k++) if (k >= 1 && k <= total) out.add(k - 1);
    }
  }
  return [...out].sort((x, y) => x - y);
}
