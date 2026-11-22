-- «لأجل المهدي» · the sheikh's own library (the owner, 22 November 2026): every hadith of مكتبة الثقلين, from the open
-- copy on GitHub (MohammedArab1/ThaqalaynAPI, V2/ThaqalaynData — 39 books, ~71,000 hadiths), one row per hadith, sorted
-- by book, section, chapter and number, with its Arabic and English text and the gradings of its chain (المجلسي،
-- البهبودي، المحسني and the others, with their references). «الشيخ الذكي» searches it itself — nothing to do with
-- «الذكاء الإسلامي» and its library. Filled by the owner's «حمّل الكتب» (/api/mahdi/sheikh/library), not by this file.
--   · mahdi_hadiths — the hadiths; `tsv` is the search index of the Arabic (no diacritics, one spelling of alef/ya/ta).
--   · mahdi_hadith_search() — the search; mahdi_hadith_counts() — how many hadiths each book has here.
--   · mahdi_sheikh_messages.mode — «سريع» or «شامل» on each message of the chat (0123).
-- Run in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run twice.

-- Arabic as the index reads it: no diacritics or tatweel, one alef, ya and ha, no punctuation, «ال» and the joined
-- letters before it (و ف ب ك ل) taken off a word of three letters or more.
create or replace function public.mahdi_ar_norm(s text) returns text
language sql immutable strict parallel safe as $$
  select lower(regexp_replace(regexp_replace(regexp_replace(
    translate(regexp_replace(s, '[ً-ْٰـۖ-ۭؐ-ؚ]', '', 'g'),
              'أإآٱىیةکؤئ', 'ااااييهكوي'),
    '[^[:alpha:][:digit:]\s]', ' ', 'g'),
    '(^|\s)[وفبكل]?(ال|لل)(?=\S\S\S)', '\1', 'g'),
    '\s+', ' ', 'g'));
$$;

create table if not exists public.mahdi_hadiths (
  -- the hadith's place on thaqalayn.com: book/section/chapter/number (its page is https://thaqalayn.com/hadith/<id>)
  id text primary key,
  book integer not null,
  book_slug text not null,
  volume integer not null default 1,
  section_id integer not null,
  section text not null default '',
  chapter_id integer not null,
  chapter text not null default '',
  n integer not null,
  -- its number in the book (the order of the GitHub file)
  seq integer not null,
  arabic text not null,
  english text not null default '',
  majlisi text not null default '',
  behbudi text not null default '',
  mohseni text not null default '',
  gradings jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  tsv tsvector generated always as (to_tsvector('simple', public.mahdi_ar_norm(arabic))) stored
);
create index if not exists mahdi_hadiths_tsv_idx on public.mahdi_hadiths using gin (tsv);
create index if not exists mahdi_hadiths_place_idx on public.mahdi_hadiths (book, section_id, chapter_id, n);

alter table public.mahdi_hadiths enable row level security;
revoke all on public.mahdi_hadiths from anon, authenticated;

-- The search: `q` is a tsquery over normalised words (built by the server), `books` narrows it to some books.
-- Best matches first; at most `lim`.
create or replace function public.mahdi_hadith_search(q text, books integer[] default null, lim integer default 10)
returns table (id text, book integer, volume integer, section text, chapter text, n integer, arabic text, majlisi text, behbudi text, mohseni text, graded boolean, rank real)
language sql stable as $$
  select h.id, h.book, h.volume, h.section, h.chapter, h.n, h.arabic, h.majlisi, h.behbudi, h.mohseni,
         jsonb_array_length(h.gradings) > 0, ts_rank_cd(h.tsv, query) as rank
  from public.mahdi_hadiths h, to_tsquery('simple', q) query
  where h.tsv @@ query and (books is null or h.book = any (books))
  order by rank desc, h.book, h.seq
  limit least(greatest(lim, 1), 30);
$$;
revoke all on function public.mahdi_hadith_search(text, integer[], integer) from anon, authenticated;

create or replace function public.mahdi_hadith_counts()
returns table (book integer, hadiths bigint)
language sql stable as $$
  select book, count(*) from public.mahdi_hadiths group by book order by book;
$$;
revoke all on function public.mahdi_hadith_counts() from anon, authenticated;

alter table public.mahdi_sheikh_messages add column if not exists mode text not null default 'quick' check (mode in ('quick', 'deep'));
