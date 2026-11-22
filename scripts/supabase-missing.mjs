// Which SQL files of supabase/migrations have NOT been run on a database? Prints ONE query to paste in the Supabase SQL
// editor: it lists every migration whose mark (a table, a column, a function or an index it creates — or, for a few
// files that only change data, a hand-written check) is missing. Read-only: it changes nothing.
//   node scripts/supabase-missing.mjs > missing.sql
// A file with no mark that can be checked is listed at the end of the query as a comment.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(import.meta.dirname, "..", "supabase", "migrations");
const q = (s) => `'${s.replace(/'/g, "''")}'`;

// Files that only change data or constraints: what to look for, as a boolean SQL expression (catalog reads only, or a
// guarded read so a missing table never stops the query).
const HAND = {
  "0012_site_usernames_arabic.sql": `exists (select 1 from pg_constraint where conname = 'site_usernames_username_check' and pg_get_constraintdef(oid) like '%ء%')`,
  "0022_mahdi_shrines_complete.sql": guardedCount("mahdi_shrines", "id = 'jamkaran'"),
  "0117_mahdi_book_pages.sql": `exists (select 1 from pg_constraint where conname = 'mahdi_books_pages_check' and pg_get_constraintdef(oid) like '%100000%')`,
  "0122_mahdi_read_challenge_new_pages.sql": `exists (select 1 from pg_proc where proname = 'mahdi_read_challenge_rows' and prosrc like '%first_save%')`,
};
function guardedCount(table, where) {
  const sql = `select count(*) as n from public.${table} where ${where}`;
  return `case when to_regclass('public.${table}') is null then false else coalesce((xpath('/row/n/text()', query_to_xml(${q(sql)}, false, true, '')))[1]::text::int > 0, false) end`;
}

const strip = (s) => s.replace(/--[^\n]*/g, "");
const unq = (n) => n.replace(/^public\./i, "").replace(/"/g, "");
function markOf(file, sql) {
  if (HAND[file]) return HAND[file];
  const s = strip(sql);
  let m = /create table (?:if not exists )?((?:[a-z_]+\.)?"?[a-z_0-9]+"?)/i.exec(s);
  if (m) return `to_regclass(${q("public." + unq(m[1]))}) is not null`;
  m = /alter table (?:if exists )?(?:only )?((?:[a-z_]+\.)?[a-z_0-9]+)\s+add column (?:if not exists )?"?([a-z_0-9]+)"?/i.exec(s);
  if (m) return `exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = ${q(unq(m[1]))} and column_name = ${q(m[2])})`;
  m = /create (?:or replace )?function ((?:[a-z_]+\.)?[a-z_0-9]+)\s*\(/i.exec(s);
  if (m) return `exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = ${q(unq(m[1]))})`;
  m = /create (?:unique )?index (?:if not exists )?([a-z_0-9]+)/i.exec(s);
  if (m) return `to_regclass(${q("public." + m[1])}) is not null`;
  return null;
}

const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const rows = [];
const unchecked = [];
for (const f of files) {
  const mark = markOf(f, readFileSync(join(DIR, f), "utf8"));
  if (mark) rows.push(`  select ${q(f)} as file, (${mark}) as ok`);
  else unchecked.push(f);
}

console.log(`-- الملفات الناقصة في قاعدتك (قراءة بس، ما يغيّر شي). ${rows.length} ملف ينفحص.
-- اللي ما ينفحص تلقائيًا (بيانات أو جدولة أو مفاتيح سرية): ${unchecked.join("، ")}
with checks as (
${rows.join("\n  union all\n")}
)
select file as "الملف الناقص" from checks where not ok order by file;`);
