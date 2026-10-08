-- «الذكاء الإسلامي» (JAWAD AI): the library the owner feeds (sites read and indexed), the method, and the answers log.
-- Every table is reached with the service role only (RLS on, no policies): the owner's dashboard and the branch's
-- API check who is asking themselves.

-- ───────────────────────────── sources: the sites the owner gives ─────────────────────────────
create table if not exists public.islamic_sources (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  url text not null,
  -- how it is read: a reader written for the site, or the general reader («site»: sitemap / links of one host)
  adapter text not null default 'site' check (adapter in ('thaqalayn', 'almojib', 'aqaed', 'site')),
  enabled boolean not null default true,
  notes text not null default '',
  -- where the reading stopped (continued on the next run) and what it did
  cursor jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.islamic_sources (key, name, url, adapter) values
  ('thaqalayn', 'الثقلين — المكتبة الشيعية الشاملة', 'https://thaqalayn.com/ar', 'thaqalayn'),
  ('almojib', 'المجيب', 'https://almojib.com/ar', 'almojib'),
  ('aqaed', 'مركز الأبحاث العقائدية', 'https://aqaed.net', 'aqaed')
on conflict (key) do nothing;

-- ───────────────────────────── documents: one page / question / text each ─────────────────────────────
-- The text itself lives in the chunks (below); the document keeps an excerpt and where it came from.
create table if not exists public.islamic_docs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.islamic_sources (id) on delete cascade,
  url text not null unique,
  kind text not null default 'page',
  title text not null default '',
  excerpt text not null default '',
  chars integer not null default 0,
  meta jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now()
);
create index if not exists islamic_docs_source_idx on public.islamic_docs (source_id);

-- ───────────────────────────── chunks: searchable pieces of the documents ─────────────────────────────
-- Arabic made the same however it was typed (no diacritics or tatweel, one alef, one ya, ta marbuta as ha, the
-- article «ال» — with a one-letter prefix before it — dropped from words long enough), the same rules as
-- lib/islamic/text.ts uses on the question, so a search finds the words whatever their spelling.
create or replace function public.islamic_norm(s text) returns text
language sql immutable strict parallel safe as $$
  select lower(regexp_replace(regexp_replace(regexp_replace(
    translate(regexp_replace(s, '[\u064B-\u0652\u0670\u0640\u06D6-\u06ED\u0610-\u061A]', '', 'g'),
              'أإآٱىیةکؤئ', 'ااااييهكوي'),
    '[^[:alpha:][:digit:]\s]', ' ', 'g'),
    '(^|\s)[وفبكل]?(ال|لل)(?=\S\S\S)', '\1', 'g'),
    '\s+', ' ', 'g'));
$$;

create table if not exists public.islamic_chunks (
  id bigserial primary key,
  doc_id uuid not null references public.islamic_docs (id) on delete cascade,
  n integer not null,
  text text not null,
  tsv tsvector generated always as (to_tsvector('simple', public.islamic_norm(text))) stored,
  unique (doc_id, n)
);
create index if not exists islamic_chunks_tsv_idx on public.islamic_chunks using gin (tsv);
create index if not exists islamic_chunks_doc_idx on public.islamic_chunks (doc_id);

-- ───────────────────────────── settings: the method and the persona files ─────────────────────────────
create table if not exists public.islamic_kv (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

-- ───────────────────────────── answers: every question and what was answered ─────────────────────────────
create table if not exists public.islamic_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  question text not null,
  answer text not null,
  sources jsonb not null default '[]'::jsonb,
  found boolean not null default true,
  usd numeric(10, 5) not null default 0,
  -- the owner's correction (the training that comes later)
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists islamic_answers_created_idx on public.islamic_answers (created_at desc);

-- ───────────────────────────── search ─────────────────────────────
-- `q` is a tsquery text the server builds from the normalised question (words joined by « | », prefixes with «:*»).
create or replace function public.islamic_search(q text, k integer default 12)
returns table (chunk_id bigint, doc_id uuid, n integer, url text, title text, kind text, source_name text, text text, rank real)
language sql stable as $$
  select c.id, d.id, c.n, d.url, d.title, d.kind, s.name, c.text,
         ts_rank_cd(c.tsv, to_tsquery('simple', q), 32) as rank
  from public.islamic_chunks c
  join public.islamic_docs d on d.id = c.doc_id
  join public.islamic_sources s on s.id = d.source_id
  where s.enabled and c.tsv @@ to_tsquery('simple', q)
  order by rank desc, c.id
  limit greatest(1, least(k, 60));
$$;

-- how much of the database the library takes (shown on the dashboard)
create or replace function public.islamic_size() returns bigint
language sql stable as $$
  select pg_total_relation_size('public.islamic_chunks') + pg_total_relation_size('public.islamic_docs');
$$;

alter table public.islamic_sources enable row level security;
alter table public.islamic_docs enable row level security;
alter table public.islamic_chunks enable row level security;
alter table public.islamic_kv enable row level security;
alter table public.islamic_answers enable row level security;
revoke all on public.islamic_sources, public.islamic_docs, public.islamic_chunks, public.islamic_kv, public.islamic_answers from anon, authenticated;
revoke all on function public.islamic_search(text, integer), public.islamic_size() from anon, authenticated;
