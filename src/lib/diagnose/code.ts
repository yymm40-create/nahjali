// «المشخّص» — the owner's diagnostician can look inside the site's own code: list a folder, search for a word, read a
// range of lines. Read-only, and only the source the site was built from (src, config, the SQL migrations, the tests, a
// few root files). Never a secret: env files, keys and anything outside those folders are refused, and anything that
// looks like a key inside a file is hidden in what comes back. Server only.

import { readdir, readFile } from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const DIRS = ["src", "config", "supabase/migrations", "tests"];
const ROOT_FILES = ["AGENTS.md", "CLAUDE.md", "package.json", "next.config.ts"];
const EXT = /\.(tsx?|css|json|md|sql)$/;
const BLOCK = /(^|\/)(\.env[^/]*|node_modules|\.next|\.git|\.vercel)(\/|$)|\.(pem|key|p12)$/i;
const KEYS = /(sk-[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|AKIA[A-Z0-9]{16}|xox[bp]-[A-Za-z0-9-]{20,})/g;

export const MAX_READ_LINES = 250;
const MAX_FILES = 6000;

let files: string[] | null = null;
const texts = new Map<string, string>();

/** The hidden-key mask applied to everything that leaves this module. */
export const hideKeys = (s: string) => s.replace(KEYS, "[مخفي]");

async function walk(dir: string, out: string[]) {
  let entries: import("fs").Dirent[];
  try {
    entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const rel = `${dir}/${e.name}`;
    if (BLOCK.test(rel) || out.length >= MAX_FILES) continue;
    if (e.isDirectory()) await walk(rel, out);
    else if (EXT.test(e.name)) out.push(rel);
  }
}

/** Every readable source file (relative, with "/"), listed once per server instance. */
export async function codeFiles(): Promise<string[]> {
  if (files) return files;
  const out: string[] = [];
  for (const d of DIRS) await walk(d, out);
  for (const f of ROOT_FILES) out.push(f);
  files = out.sort();
  return files;
}

/** Forget what was listed and read (tests, and a fresh deploy never needs it). */
export function forgetCode() {
  files = null;
  texts.clear();
}

/** A requested path as the exact listed file, or null when it is outside what may be read. */
export async function allowedPath(p: unknown): Promise<string | null> {
  if (typeof p !== "string") return null;
  const clean = path.posix.normalize(p.trim().replace(/\\/g, "/").replace(/^\.\//, ""));
  if (!clean || clean.startsWith("/") || clean.startsWith("..") || clean.includes("\0") || BLOCK.test(clean)) return null;
  return (await codeFiles()).includes(clean) ? clean : null;
}

async function textOf(rel: string): Promise<string> {
  const hit = texts.get(rel);
  if (hit !== undefined) return hit;
  const t = await readFile(path.join(ROOT, rel), "utf8").catch(() => "");
  texts.set(rel, t);
  return t;
}

/** The entries one level under a folder ("" = the top): folders end with "/". */
export async function listDir(prefix: unknown): Promise<string[]> {
  const base = typeof prefix === "string" ? path.posix.normalize(prefix.trim().replace(/\\/g, "/").replace(/^\.\//, "")).replace(/^\.$/, "").replace(/\/$/, "") : "";
  if (base.startsWith("..") || base.startsWith("/") || BLOCK.test(base)) return [];
  const seen = new Set<string>();
  for (const f of await codeFiles()) {
    if (base && !f.startsWith(`${base}/`)) continue;
    const rest = base ? f.slice(base.length + 1) : f;
    const i = rest.indexOf("/");
    seen.add(i === -1 ? rest : `${rest.slice(0, i)}/`);
  }
  return [...seen].sort().slice(0, 200);
}

/** A range of lines of one file, numbered. At most MAX_READ_LINES at a time. */
export async function readCode(p: unknown, from = 1, to?: number): Promise<{ path: string; from: number; to: number; total: number; text: string } | { error: string }> {
  const rel = await allowedPath(p);
  if (!rel) return { error: `ملف غير موجود أو غير مسموح قراءته: ${String(p).slice(0, 120)}` };
  const lines = (await textOf(rel)).split("\n");
  const a = Math.max(1, Math.floor(Number(from)) || 1);
  const b = Math.min(lines.length, a + MAX_READ_LINES - 1, Math.max(a, Math.floor(Number(to)) || a + MAX_READ_LINES - 1));
  const text = lines.slice(a - 1, b).map((l, i) => `${a + i}: ${l}`).join("\n");
  return { path: rel, from: a, to: b, total: lines.length, text: hideKeys(text) };
}

export interface CodeHit {
  path: string;
  line: number;
  text: string;
}

/**
 * Lines that contain the text (not case-sensitive); `/regex/` is read as a pattern. `in` narrows to paths that contain
 * it. At most `max` lines, the most specific files first (config and lib before the tests).
 */
export async function searchCode(query: unknown, opts: { in?: unknown; max?: number } = {}): Promise<CodeHit[]> {
  const q = typeof query === "string" ? query.trim().slice(0, 200) : "";
  if (q.length < 2) return [];
  let test: (l: string) => boolean;
  const m = /^\/(.+)\/([a-z]*)$/.exec(q);
  if (m) {
    try {
      const re = new RegExp(m[1], m[2].includes("i") ? m[2] : `${m[2]}i`);
      test = (l) => re.test(l);
    } catch {
      return [];
    }
  } else {
    const needle = q.toLowerCase();
    test = (l) => l.toLowerCase().includes(needle);
  }
  const within = typeof opts.in === "string" ? opts.in.trim().replace(/\\/g, "/") : "";
  const max = Math.min(80, Math.max(1, opts.max ?? 40));
  const rank = (f: string) => (f.startsWith("tests/") ? 2 : f.startsWith("supabase/") ? 1 : 0);
  const list = (await codeFiles()).filter((f) => !within || f.includes(within)).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  const out: CodeHit[] = [];
  for (const f of list) {
    const lines = (await textOf(f)).split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (test(lines[i])) {
        out.push({ path: f, line: i + 1, text: hideKeys(lines[i].trim().slice(0, 220)) });
        if (out.length >= max) return out;
      }
    }
  }
  return out;
}
