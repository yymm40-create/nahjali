-- «ذوقي» and «هويتي» in «الاستوديو الإبداعي».
--   «ذوقي» (like Midjourney's moodboards): a named taste the person made from 3–20 of their pictures. The site looked at
--   them ONCE (Claude) and wrote the look in words (palette, light, texture, composition, mood); up to 4 of the pictures
--   are kept as style references for the generators that take them. Up to 20 tastes per person.
--   «هويتي» (the brand kit): one per person — up to 6 colours, a logo (a checked PNG upload), up to 2 of the site's
--   Arabic fonts and a short brand voice line.
-- Run in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run again.
-- Until it runs, the studio hides both pickers with a one-line note; nothing else changes.
-- Each person reads only their own rows; every write goes through the server (src/lib/jawad/server/taste.ts), which
-- checks that the row and its pictures are theirs.

create table if not exists public.jawad_tastes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  -- the look in words, as the generators read it (English), and one plain Arabic line for the person
  description text not null check (char_length(description) between 1 and 2000),
  summary text not null default '' check (char_length(summary) <= 300),
  -- the main colours seen (#rrggbb), shown as chips
  palette text[] not null default '{}' check (cardinality(palette) <= 8),
  -- the pictures kept as style references (jawad_uploads ids of the person's own, checked by the server)
  ref_upload_ids uuid[] not null default '{}' check (cardinality(ref_upload_ids) <= 4),
  -- how many pictures it was made from
  source_count integer not null check (source_count between 3 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- one name once per person (whatever the letter case)
create unique index if not exists jawad_tastes_name_idx on public.jawad_tastes (user_id, lower(btrim(name)));
create index if not exists jawad_tastes_user_idx on public.jawad_tastes (user_id, created_at desc);
create index if not exists jawad_tastes_refs_idx on public.jawad_tastes using gin (ref_upload_ids);

create table if not exists public.jawad_brand_kits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  colors text[] not null default '{}' check (cardinality(colors) <= 6),
  logo_upload_id uuid references public.jawad_uploads (id) on delete set null,
  -- ids of config/content-fonts.ts
  fonts text[] not null default '{}' check (cardinality(fonts) <= 2),
  voice text not null default '' check (char_length(voice) <= 160),
  updated_at timestamptz not null default now()
);
create index if not exists jawad_brand_kits_logo_idx on public.jawad_brand_kits (logo_upload_id) where logo_upload_id is not null;

alter table public.jawad_tastes enable row level security;
alter table public.jawad_brand_kits enable row level security;
revoke all on public.jawad_tastes, public.jawad_brand_kits from anon, authenticated;

drop policy if exists "jawad tastes: read own" on public.jawad_tastes;
create policy "jawad tastes: read own" on public.jawad_tastes for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "jawad brand kits: read own" on public.jawad_brand_kits;
create policy "jawad brand kits: read own" on public.jawad_brand_kits for select to authenticated using (user_id = (select auth.uid()));
grant select on public.jawad_tastes, public.jawad_brand_kits to authenticated;
-- inserts, updates and deletes: no policy → server only
